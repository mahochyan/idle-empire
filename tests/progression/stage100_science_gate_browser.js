'use strict';
// node tests/progression/stage100_science_gate_browser.js
// Real Edge/CDP smoke for the campaign menu. Science flags are injected only
// to exercise UI/action states, not to claim paid terminal progression.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'../..');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Microsoft Edge not installed');process.exit(2)}
const tempRoot=path.resolve(__dirname,'.edge-temp');
fs.mkdirSync(tempRoot,{recursive:true});
const profile=fs.mkdtempSync(path.join(tempRoot,'p387-'));
if(path.dirname(path.resolve(profile))!==tempRoot)throw Error('profile path outside test temp root');
const pageUrl=pathToFileURL(path.join(root,'index.html')).href;
const port=26000+Math.floor(Math.random()*1000);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
  '--disable-background-networking','--remote-debugging-port='+port,
  '--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,seq=0,spawnError;
const pending=new Map(),exceptions=[];
browser.on('error',error=>{spawnError=error});
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},10000);
    pending.set(id,{timer,resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function main(){
  let targets;
  for(let i=0;i<40;i++){
    if(spawnError)throw spawnError;
    await sleep(250);
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
      if(targets.some(t=>t.type==='page'))break}catch(_){/* Edge startup */}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  assert.ok(page?.webSocketDebuggerUrl,'Edge CDP page unavailable');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{
    const data=JSON.parse(event.data);
    if(data.id&&pending.has(data.id)){
      const task=pending.get(data.id);pending.delete(data.id);clearTimeout(task.timer);
      data.error?task.reject(Error(JSON.stringify(data.error))):task.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')
      exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  let ready=false;
  for(let i=0;i<80;i++){
    try{ready=await evalJs("document.readyState==='complete'&&typeof openBattle==='function'&&Array.isArray(window.APP_SCRIPTS)");if(ready)break}catch(_){/* reload */}
    await sleep(100);
  }
  assert.equal(ready,true,'game did not initialize');
  const scripts=await evalJs('window.APP_SCRIPTS');
  assert.deepEqual(scripts,['config.js','levels.js','sprites.js','math.js','garrison.js','technology.js','ui.js']);
  const state=await evalJs(`(()=>{
    const select=()=>document.querySelector('#main select[onchange*="selEnemy"]');
    const option=()=>select()?.querySelector('option[value="99"]');
    const battle=()=>document.querySelector('#main button[onclick="openBattle()"]');
    const picture=()=>({option:!!option(),optionDisabled:!!option()?.disabled,
      battleDisabled:!!battle()?.disabled,reason:document.getElementById('main').textContent,
      active:S.battleActive,clear:S.defeated.includes(100)});
    S.defeated=CFG.enemies.slice(0,99).map(e=>e.id);
    S.sciences=S.sciences.filter(id=>id!=='sci_star_array'&&id!=='sci_quantum_age');
    S.formation={front:[{type:'infantry',count:1,id:387}],mid:[],back:[]};
    S.selEnemy=99;S.page='fight';S._fightTab='expedition';updateUI();
    const locked=picture();openBattle();locked.activeAfterDirect=S.battleActive;
    S.sciences.push('sci_star_array','sci_quantum_age');updateUI();
    const unlocked=picture();openBattle();unlocked.activeAfterDirect=S.battleActive;
    if(S.battleActive)fleeBattle();
    S.sciences=S.sciences.filter(id=>id!=='sci_star_array'&&id!=='sci_quantum_age');
    S.defeated.push(100);S.selEnemy=99;updateUI();
    const historical=picture();openBattle();historical.activeAfterDirect=S.battleActive;
    if(S.battleActive)fleeBattle();
    return{locked,unlocked,historical}
  })()`);
  assert.equal(state.locked.option,true);
  assert.equal(state.locked.optionDisabled,true);
  assert.equal(state.locked.battleDisabled,true);
  assert.match(state.locked.reason,/星辉圣阵/);
  assert.match(state.locked.reason,/星界量子时代/);
  assert.equal(state.locked.activeAfterDirect,false);
  assert.equal(state.unlocked.optionDisabled,false);
  assert.equal(state.unlocked.battleDisabled,false);
  assert.equal(state.unlocked.activeAfterDirect,true);
  assert.equal(state.historical.clear,true);
  assert.equal(state.historical.optionDisabled,false);
  assert.equal(state.historical.battleDisabled,false);
  assert.equal(state.historical.activeAfterDirect,true);
  assert.deepEqual(exceptions,[],'browser JS exceptions');
  console.log('PASS stage100 science gate Edge 360px: locked, unlocked, historical replay (16 assertions)');
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1}).finally(async()=>{
  for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('browser closing'))}
  try{ws?.close()}catch(_){/* already closed */}
  browser.kill();
  await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),sleep(3000)]);
  // Delete only this test's temporary profile, after resolving its absolute path.
  if(path.dirname(path.resolve(profile))===tempRoot){
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
    catch(error){console.warn('TEMP_PROFILE_LEFT '+profile+' '+error.code)}
  }
});
