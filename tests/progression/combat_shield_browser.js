'use strict';
// Real Edge/CDP smoke for the expedition shield card. Runtime state injection
// exercises presentation only; it does not prove the unit is progression-reachable.
// Run: node tests/progression/combat_shield_browser.js
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

const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'combat-shield-profile-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=21400+Math.floor(Math.random()*800);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[],shots=[];
const pending=new Map();
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error;});

function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},10000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function setView(width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(150);
}
async function pageReady(){
  for(let i=0;i<30;i++){
    if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof openBattle==='function'"))return true;
    await sleep(100);
  }
  return false;
}
async function inspect(){
  return evalJs(`(()=>{
    const screen=document.getElementById('battle-screen');
    const field=document.getElementById('battle-field');
    const card=field?.querySelector('.our-zone .unit-box');
    const shield=card?.querySelector('.unit-shield');
    const unit=B.ourUnits[0];
    return {
      width:innerWidth,active:screen?.classList.contains('active')||false,
      cardTitle:card?.getAttribute('title')||'',cardAria:card?.getAttribute('aria-label')||'',
      cardVisibleText:card?.innerText||'',
      shieldText:shield?.textContent||'',hpBar:card?.querySelector('.unit-hpfill')?.style.width||'',
      hp:unit?.hp,maxHp:unit?.maxHp,shield:unit?.shield,
      formationCount:S.formation.front[0]?.count,
      overflow:{document:document.documentElement.scrollWidth>innerWidth+1,
        body:document.body.scrollWidth>innerWidth+1,
        screen:screen.scrollWidth>screen.clientWidth+1,
        field:field.scrollWidth>field.clientWidth+1}
    };
  })()`);
}
async function snap(width){
  const out=await send('Page.captureScreenshot',{format:'png'});
  const file=path.join(tempRoot,'combat-shield-'+process.pid+'-'+width+'.png');
  fs.writeFileSync(file,Buffer.from(out.data,'base64'));
  shots.push(file);
}

(async()=>{
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
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
  await setView(360);
  await send('Page.reload',{ignoreCache:true});
  check('real page scripts load after reload',await pageReady(),pageUrl);

  // Open the real battle screen, then inspect before its first scheduled turn.
  await evalJs("(()=>{S.formation={front:[{type:'mage_space',count:10,id:1001}],mid:[],back:[]};S.selEnemy=0;S.page='fight';updateUI();CFG.battleStepDelay=60000;S.battleSpeed=1;openBattle();return 'ok'})()");
  for(const width of [360,400]){
    await setView(width);
    const view=await inspect();
    check(width+' battle card visibly shows 10/10 people',view.width===width&&view.active&&view.formationCount===10&&view.hp===10&&view.maxHp===10&&view.cardVisibleText.includes('10/10')&&view.cardTitle.includes('10/10人')&&view.cardAria.includes('10/10人')&&view.hpBar==='100%',view);
    check(width+' shield is separate and shows 2',view.shield===2&&view.shieldText==='盾2'&&view.cardTitle.includes('护盾2'),view);
    check(width+' no horizontal overflow',Object.values(view.overflow).every(v=>v===false),view.overflow);
    await snap(width);
  }
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,4));
  console.log(JSON.stringify({checks,exceptions,shots,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,note:'Injected formation and delayed first turn verify battle-card presentation only.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
