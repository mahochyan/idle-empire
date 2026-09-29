'use strict';
// P362: real Edge/CDP regression for the unlocked-only science and unit views.
// Run: node tests/progression/unlocked_only_browser_p362.js
// Every run uses a separate temporary browser profile. The stage/building/resource
// setup below is presentation-only in that profile; the science and unit purchases
// themselves go through their real UI buttons and action functions. This does not
// prove natural fresh-save progression reachability.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(candidate=>fs.existsSync(candidate));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2);}

const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'unlocked-only-p362-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=23000+Math.floor(Math.random()*1000);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[],pending=new Map();
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error;});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},20000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof updateUI==='function'"))return true;}
    catch(_){}
    await sleep(100);
  }
  return false;
}
async function reload(){
  await evalJs("window.__p362ReloadMarker=true;'marked'");
  await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<80;i++){
    try{
      if(await evalJs("document.readyState==='complete'&&window.__p362ReloadMarker===undefined&&typeof updateUI==='function'"))return true;
    }catch(_){}
    await sleep(100);
  }
  return false;
}
async function setView(width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(120);
}
async function viewTech(category){
  return evalJs(`(()=>{S.page='tech';setTechFullOpen(true);updateUI();setTechCategory(${JSON.stringify(category)});const full=document.getElementById('tech-full');return !!full&&full.open&&full.querySelector('.tech-full')?.dataset.category===${JSON.stringify(category)}})()`);
}
async function scienceRow(id){
  return evalJs(`(()=>{const name=sciName(${JSON.stringify(id)});const row=[...document.querySelectorAll('#tech-full .tech-science-row')].find(el=>el.querySelector('strong')?.textContent.trim()===name);return{exists:!!row,done:!!row?.classList.contains('is-researched'),button:!!row?.querySelector('button'),disabled:row?.querySelector('button')?.disabled??null,text:row?.textContent||''}})()`);
}
async function unitNode(id){
  return evalJs(`(()=>{const row=[...document.querySelectorAll('#tech-full .tech-unit-node')].find(el=>el.dataset.unit===${JSON.stringify(id)});return{exists:!!row,owned:!!row?.classList.contains('is-owned'),button:!!row?.querySelector('button[onclick]'),text:row?.textContent||''}})()`);
}
async function overflow(){
  return evalJs("(()=>{const main=document.getElementById('main'),phone=document.getElementById('phone');const p=phone.getBoundingClientRect();return{width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,main:main.scrollWidth,mainClient:main.clientWidth,phoneLeft:p.left,phoneRight:p.right,overflow:document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1}})()");
}
async function clickAction(call){
  return evalJs(`(()=>{const button=[...document.querySelectorAll('#tech-full button[onclick]')].find(el=>el.getAttribute('onclick')===${JSON.stringify(call)});if(!button||button.disabled)return false;button.click();return true})()`);
}

async function runWidth(width){
  await setView(width);
  await evalJs("localStorage.clear();'cleared isolated profile'");
  check(width+' clean new-save reload',await reload());
  const fresh=await evalJs("({order:window.APP_SCRIPTS.join(','),sciences:[...S.sciences],upgraded:{...S.upgradedUnits},defeated:[...S.defeated],protected:saveProtected()})");
  check(width+' real script order',fresh.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',fresh);
  check(width+' starts from unprotected clean save',!fresh.protected&&fresh.sciences.length===0&&Object.keys(fresh.upgraded).length===0&&fresh.defeated.length===0,fresh);

  check(width+' opens science graph',await viewTech('science'));
  const prospect=await scienceRow('sci_prospect');
  const near=await evalJs("[...document.querySelectorAll('#main .tech-near-card')].some(el=>el.textContent.includes('探矿术'))");
  const freshScienceCount=await evalJs("document.querySelectorAll('#tech-full .tech-science-row').length");
  check(width+' first research remains visible and actionable after earning points',prospect.exists&&prospect.button&&near&&freshScienceCount===1,{prospect,near,freshScienceCount});
  const freshLibrary=await scienceRow('sci_library');
  const freshBronze=await scienceRow('sci_bronze_age');
  const freshQuantum=await scienceRow('sci_quantum_age');
  check(width+' deep prerequisite-locked science absent from DOM',!freshLibrary.exists&&!freshBronze.exists&&!freshQuantum.exists,{freshLibrary,freshBronze,freshQuantum});
  check(width+' fresh science graph has no horizontal overflow',!(await overflow()).overflow,await overflow());

  check(width+' opens unit graph',await viewTech('units'));
  const freshInfantry=await unitNode('infantry');
  const freshArcher=await unitNode('archer');
  const freshT1=await unitNode('infantry_t1');
  const freshT2=await unitNode('infantry_shield');
  const freshT3=await unitNode('infantry_fortress');
  const freshCavalry=await unitNode('cavalry_t1');
  check(width+' owned starters shown, stage/building-locked descendants absent',freshInfantry.exists&&freshInfantry.owned&&freshArcher.exists&&freshArcher.owned&&!freshT1.exists&&!freshT2.exists&&!freshT3.exists&&!freshCavalry.exists,{freshInfantry,freshArcher,freshT1,freshT2,freshT3,freshCavalry});
  check(width+' fresh unit graph has no horizontal overflow',!(await overflow()).overflow,await overflow());

  await evalJs("S.page='barracks';S._barracksTab='train';updateUI();'train page'");
  const freshTraining=await evalJs("({bronze:!!document.querySelector('#main .barracks-unit-card[data-unit=bronze_guard]'),iron:!!document.querySelector('#main .barracks-unit-card[data-unit=iron_spearman]')})");
  check(width+' unresearched training units absent',!freshTraining.bronze&&!freshTraining.iron,freshTraining);
  check(width+' fresh training page has no horizontal overflow',!(await overflow()).overflow,await overflow());

  check(width+' returns to science graph',await viewTech('science'));
  const scienceSetup=await evalJs("(()=>{S.res.tech=activeSciences().sci_prospect.cost.tech;updateUI();return{tech:S.res.tech,cap:resCap('tech'),button:!![...document.querySelectorAll('#tech-full button[onclick]')].find(el=>el.getAttribute('onclick')===\"researchScience('sci_prospect')\"&&!el.disabled)}})()");
  check(width+' controlled science cost fits cap and enables real button',scienceSetup.button&&scienceSetup.tech===100&&scienceSetup.cap>=100,scienceSetup);
  check(width+' purchases prospect through real UI button',await clickAction("researchScience('sci_prospect')"));
  const researched=await evalJs("(()=>{const d=JSON.parse(localStorage.getItem('rts_save')||'null');return{sciences:[...S.sciences],tech:S.res.tech,savedSciences:d?.sciences||[],savedTech:d?.res?.tech}})()");
  check(width+' prospect paid once and persisted',researched.sciences.includes('sci_prospect')&&researched.savedSciences.includes('sci_prospect')&&researched.tech===0&&researched.savedTech===0,researched);
  const ownedProspect=await scienceRow('sci_prospect');
  const nextLibrary=await scienceRow('sci_library');
  const nextCoal=await scienceRow('sci_coal');
  const nextWoodStore=await scienceRow('sci_wood_store');
  const stillDeep=await scienceRow('sci_bronze_age');
  check(width+' researched science retained and direct next research revealed',ownedProspect.exists&&ownedProspect.done&&nextLibrary.exists&&nextCoal.exists&&nextWoodStore.exists&&!stillDeep.exists,{ownedProspect,nextLibrary,nextCoal,nextWoodStore,stillDeep});
  check(width+' post-research science graph has no horizontal overflow',!(await overflow()).overflow,await overflow());

  // A controlled snapshot of already-won stage 5 and a completed T1 infantry camp.
  // These prerequisites are not claimed to have been reached naturally in this test.
  const unitSetup=await evalJs("(()=>{S.defeated=[1,2,3,4,5];S.buildings.infantry_camp={lv:1,state:'idle',timer:0,tier:1};S.res.tech=200;S.merit=5;updateUI();return{levelLock:checkTierLevel(1),tier:bldSt('infantry_camp').tier,tech:S.res.tech,techCap:resCap('tech'),wood:S.res.wood,stone:S.res.stone,food:S.res.food,merit:S.merit}})()");
  check(width+' controlled T1 setup satisfies real action guards',unitSetup.levelLock===''&&unitSetup.tier===1&&unitSetup.techCap>=200&&unitSetup.wood>=200&&unitSetup.stone>=100&&unitSetup.food>=150&&unitSetup.merit>=5,unitSetup);
  check(width+' opens newly eligible unit graph',await viewTech('units'));
  const eligibleT1=await unitNode('infantry_t1');
  const stillLockedT2=await unitNode('infantry_shield');
  check(width+' direct eligible T1 shown while deeper T2 hidden',eligibleT1.exists&&eligibleT1.button&&!stillLockedT2.exists,{eligibleT1,stillLockedT2});
  const beforeUnit=await evalJs("({tech:S.res.tech,merit:S.merit,wood:S.res.wood,stone:S.res.stone,food:S.res.food})");
  check(width+' purchases T1 through real UI button',await clickAction("upgradeUnit('infantry','infantry_t1')"));
  const afterUnit=await evalJs("(()=>{const d=JSON.parse(localStorage.getItem('rts_save')||'null');return{owned:!!S.upgradedUnits.infantry_t1,savedOwned:!!d?.upgradedUnits?.infantry_t1,tech:S.res.tech,merit:S.merit,wood:S.res.wood,stone:S.res.stone,food:S.res.food}})()");
  check(width+' T1 charged once and persisted',afterUnit.owned&&afterUnit.savedOwned&&afterUnit.tech===beforeUnit.tech-200&&afterUnit.merit===beforeUnit.merit-5&&afterUnit.wood===beforeUnit.wood-200&&afterUnit.stone===beforeUnit.stone-100&&afterUnit.food===beforeUnit.food-150,{beforeUnit,afterUnit});
  const ownedT1=await unitNode('infantry_t1');
  check(width+' newly owned T1 remains visible and deep T2 remains hidden',ownedT1.exists&&ownedT1.owned&&!(await unitNode('infantry_shield')).exists,ownedT1);
  check(width+' post-unlock unit graph has no horizontal overflow',!(await overflow()).overflow,await overflow());

  check(width+' reloads purchased save',await reload());
  check(width+' reopens science graph after reload',await viewTech('science'));
  const retainedScience=await scienceRow('sci_prospect');
  check(width+' purchased science survives reload and remains visible',retainedScience.exists&&retainedScience.done,retainedScience);
  check(width+' reopens unit graph after reload',await viewTech('units'));
  const retainedUnit=await unitNode('infantry_t1');
  check(width+' purchased unit survives reload and remains visible',retainedUnit.exists&&retainedUnit.owned,retainedUnit);

  // Legacy-display probes only: existing ownership must win over a now-missing gate.
  const legacyUnit=await evalJs("(()=>{S.defeated=[];S.buildings.infantry_camp.tier=0;updateUI();const el=document.querySelector('#tech-full .tech-unit-node[data-unit=infantry_t1]');return{owned:!!S.upgradedUnits.infantry_t1,visible:!!el,isOwned:!!el?.classList.contains('is-owned')}})()");
  check(width+' historical owned unit visible despite missing current gate',legacyUnit.owned&&legacyUnit.visible&&legacyUnit.isOwned,legacyUnit);
  check(width+' opens historical science display probe',await viewTech('science'));
  const legacyScience=await evalJs("(()=>{S.sciences=['sci_library'];updateUI();const row=[...document.querySelectorAll('#tech-full .tech-science-row')].find(el=>el.querySelector('strong')?.textContent.trim()===sciName('sci_library'));return{researchOwned:S.sciences.includes('sci_library'),prerequisiteOwned:S.sciences.includes('sci_prospect'),visible:!!row,done:!!row?.classList.contains('is-researched')}})()");
  check(width+' historical researched science visible despite missing prerequisite',legacyScience.researchOwned&&!legacyScience.prerequisiteOwned&&legacyScience.visible&&legacyScience.done,legacyScience);
  check(width+' historical display has no horizontal overflow',!(await overflow()).overflow,await overflow());
}

(async()=>{
  let targets;
  for(let i=0;i<50;i++){
    await sleep(200);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(target=>target.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(target=>target.type==='page'&&target.url===pageUrl)||targets?.find(target=>target.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  check('real page scripts load',await ready());
  for(const width of [320,360,400])await runWidth(width);
  check('no uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,5));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(item=>item.ok).length,failed:checks.filter(item=>!item.ok).length},null,2));
  process.exitCode=checks.some(item=>!item.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{
    if(fs.existsSync(profile)){
      const resolved=fs.realpathSync(profile);
      if(!resolved.startsWith(tempRoot+path.sep))throw Error('profile cleanup path outside temp');
      fs.rmSync(resolved,{recursive:true,force:true});
    }
  }catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
