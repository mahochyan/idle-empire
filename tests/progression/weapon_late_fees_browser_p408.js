'use strict';
// Real Edge UI/action/reload checks using explicit isolated high-level fixtures.
// This does not prove natural acquisition of a Lv10 weapon or its materials.
// The boundary click retains our one-action/one-fee rule; it does not reproduce
// the source callback's second if and possible extra fee on the same 9-to-10 call.
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Microsoft Edge not installed');process.exit(2)}
const tempRoot=path.resolve(os.tmpdir()),profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'weapon-fees-p408-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('Profile outside temporary root');
const pageUrl=pathToFileURL(path.join(root,'index.html')).href;
const port=24500+Math.floor(Math.random()*1000);
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,
  '--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mappings=[['gatling',5],['mortar',5],['electroRifle',10],['electroSniper',10],
  ['starFighter',20],['starMissile',20]];
const checks=[],exceptions=[],pending=new Map();
let ws,id=0,spawnError;
browser.on('error',error=>{spawnError=error});
function check(name,ok,detail){checks.push({name,ok:!!ok,...(!ok?{detail}: {})});if(!ok)console.error('FAIL '+name+' '+JSON.stringify(detail))}
function send(method,params={}){return new Promise((resolve,reject)=>{
  const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP_TIMEOUT '+method))},15000);
  pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({id:request,method,params}));
})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
async function ready(){for(let i=0;i<80;i++){try{if(await evaluate("document.readyState==='complete'&&typeof forgeWeapon==='function'&&typeof updateUI==='function'"))return true}catch(_){}await sleep(100)}return false}
async function viewArms(){return evaluate(`(()=>{const graph=document.getElementById('tech-full');
  if(!graph)return false;if(!graph.open)graph.querySelector('summary').click();
  graph.querySelector('.tech-tree-nav button[data-category="arms"]')?.click();return graph.open})()`)}
async function row(key){return evaluate(`(()=>{const button=[...document.querySelectorAll('#tech-full button[onclick]')]
  .find(e=>e.getAttribute('onclick')===\"forgeWeapon('${key}')\");
  const row=button?.closest('.tech-detail-row');return{found:!!row,visible:!!button&&button.getClientRects().length>0,
    disabled:button?.disabled,cost:row?.querySelector('.tech-detail-cost')?.textContent||''}})()`)}
async function click(key){return evaluate(`(()=>{const button=[...document.querySelectorAll('#tech-full button[onclick]')]
  .find(e=>e.getAttribute('onclick')===\"forgeWeapon('${key}')\");if(!button||button.disabled||!button.getClientRects().length)return false;button.click();return true})()`)}
async function state(key){return evaluate(`(()=>{const raw=JSON.parse(localStorage.getItem('rts_save'));return{
  steel:S.res.steel,core:S.items.godCore,weapon:S.weaponForge['${key}'],
  saved:raw&&{v:raw.v,steel:raw.res.steel,core:raw.items.godCore,weapon:raw.weaponForge['${key}']}}})()`)}
async function fixture(key,level,core,steel){await evaluate(`S.sciences=Object.keys(activeSciences());
  for(const w of Object.values(S.weaponForge))w.researched=true;
  S.weaponForge['${key}']={researched:true,level:${level},progress:0,equipped:true};
  S.res.steel=${steel};S.items.godCore=${core};S.page='tech';updateUI();true`);await viewArms()}
async function main(){
  let targets;
  for(let i=0;i<40;i++){await sleep(250);if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){
    const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
    data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result)}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  check('Page and actual game scripts loaded',await ready());
  const names=await evaluate(`({steel:CFG.res.steel.name,core:CFG.eraMaterials.godCore.name,scripts:window.APP_SCRIPTS.join(',')})`);
  check('Game script dependency order',names.scripts==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',names);
  for(const width of [320,360]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
    for(const [key,late]of mappings){
      await fixture(key,10,late-1,100000);
      const short=await row(key);
      check(`${width} ${key} shows core-only price and disables shortage`,short.found&&short.visible&&short.disabled&&
        short.cost.includes(names.core+' '+late)&&!short.cost.includes(names.steel+' '),short);
      await fixture(key,9,100,await evaluate(`CFG.weaponForge['${key}'].stepCost.steel+123`));
      await evaluate(`S.weaponForge['${key}'].progress=weaponForgeSteps('${key}')-1;updateUI();true`);
      await viewArms();
      const early=await row(key);
      check(`${width} ${key} Lv9 still shows steel`,early.cost.includes(names.steel+' '),early);
      check(`${width} ${key} actual boundary click`,await click(key));
      await viewArms();
      const tier10=await state(key),lateRow=await row(key);
      check(`${width} ${key} boundary persists Lv10`,tier10.weapon.level===10&&tier10.weapon.progress===0&&
        tier10.saved?.weapon.level===10&&tier10.steel===123,tier10);
      check(`${width} ${key} next visible price changes immediately`,lateRow.visible&&!lateRow.disabled&&
        lateRow.cost.includes(names.core+' '+late)&&!lateRow.cost.includes(names.steel+' '),lateRow);
      check(`${width} ${key} core-only click`,await click(key));
      const paid=await state(key);
      check(`${width} ${key} core debited once and steel unchanged`,paid.core===tier10.core-late&&paid.steel===123&&
        paid.weapon.progress===1&&paid.saved?.core===paid.core&&paid.saved?.steel===123,paid);
      check(`${width} ${key} no page overflow`,await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    }
  }
  const beforeReload=await state('starMissile');
  await evaluate('window.__weaponP408Reload=true');await send('Page.reload',{ignoreCache:true});
  let reloaded=false;for(let i=0;i<80;i++){try{if(await evaluate("document.readyState==='complete'&&window.__weaponP408Reload===undefined&&typeof forgeWeapon==='function'")){reloaded=true;break}}catch(_){}await sleep(100)}
  check('Real page reload',reloaded);
  const restored=await state('starMissile');
  check('v36 retains paid late-level state after page reload',restored.saved?.v===36&&
    JSON.stringify(restored.weapon)===JSON.stringify(beforeReload.weapon)&&restored.core===beforeReload.core&&restored.steel===beforeReload.steel,restored);
  check('No uncaught browser errors',exceptions.length===0,exceptions);
  const digest=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
  const result={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    hashes:Object.fromEntries(['config.js','math.js','ui.js','index.html','tests/progression/weapon_late_fees_browser_p408.js'].map(rel=>[rel,digest(rel)])),
    method:'Real isolated Edge; explicit Lv9/10 and material fixtures; actual displayed prices, button clicks and page reload. Not natural acquisition.',
    checks,exceptions,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length};
  const output='docs/codex/reports/data/p408-weapon-fee-browser.json';fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,passed:result.passed,failed:result.failed}));process.exitCode=result.failed?1:0;
}
main().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error.stack||error);process.exitCode=2}).finally(async()=>{
  if(ws?.readyState===WebSocket.OPEN)try{await Promise.race([send('Browser.close'),sleep(1000)])}catch(_){}
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(500);try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',profile,error.message);if(!process.exitCode)process.exitCode=3}
  process.exit(process.exitCode??0);
});
