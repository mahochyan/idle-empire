'use strict';
// Isolated Edge/CDP smoke: real 360px military UI, research action, portrait and reload.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const temp=path.resolve(os.tmpdir());
const profile=fs.mkdtempSync(path.join(temp,'quantum-soldier-ui-'));
if(!profile.startsWith(temp+path.sep))throw Error('profile outside temp');
const port=24000+Math.floor(Math.random()*1000);
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pending=new Map(),exceptions=[];
let ws,id=0;
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method))},20000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
}
async function run(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<100;i++){
    try{if(await run("document.readyState==='complete'&&typeof updateUI==='function'"))return true}catch(_){}
    await sleep(100);
  }
  return false;
}
function check(name,value){if(!value)throw Error('FAIL '+name);console.log('PASS '+name)}
(async()=>{
  let target;
  for(let i=0;i<100&&!target;i++){
    try{const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=pages.find(p=>p.type==='page'&&p.url.startsWith(url))||pages.find(p=>p.type==='page')}catch(_){}
    if(!target)await sleep(100);
  }
  if(!target?.webSocketDebuggerUrl)throw Error('Edge page unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  check('browser ready',await ready());
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  const locked=await run("(()=>{S.sciences=['sci_electric_age','sci_nuclear_age'];S.buildings.electric_armory={lv:1,state:'idle'};S.res.tech=3000000000;S.res.medal=3000000;S.res.copper=8000;S.res.iron=8000;S.res.steel=8000;S.page='barracks';updateUI();return document.getElementById('main').textContent.includes('星界构装卫士')&&document.getElementById('main').textContent.includes('需先研究「星界量子时代」')})()");
  check('locked quantum branch visible',locked);
  check('research paid',await run("researchScience('sci_quantum_age').ok"));
  const ui=await run("(async()=>{S.page='barracks';updateUI();const button=document.querySelector(\"#main button[onclick=\\\"trainCustom('quantum_trooper','train-barracks-quantum_trooper')\\\"]\");const image=[...document.querySelectorAll('#main img')].find(img=>img.src.endsWith('/star_trooper.png'));if(image&&!image.complete)await new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;setTimeout(resolve,1000)});return {button:!!button&&!button.disabled,image:!!image&&image.complete&&image.naturalWidth>0}})()");
  check('train control enabled',ui.button);check('own unit art loads',ui.image);
  check('train button pays through real action',await run("(()=>{const button=document.querySelector(\"#main button[onclick=\\\"trainCustom('quantum_trooper','train-barracks-quantum_trooper')\\\"]\");button.click();for(let i=0;i<9;i++)processQueue();const pending=S.pool.quantum_trooper===undefined&&S.queue.quantum_trooper.count===1;processQueue();return pending&&S.pool.quantum_trooper===1&&S.res.copper===0&&S.res.iron===0&&S.res.steel===0})()"));
  const portrait=await run("(async()=>{openUnitDetail('quantum_trooper');const img=document.querySelector('#unit-detail-content img');if(img&&!img.complete)await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;setTimeout(resolve,1000)});return !!img&&img.complete&&img.naturalWidth>0})()");
  check('unit detail portrait loads',portrait);
  check('zero uncaught browser exceptions',exceptions.length===0);
  console.log('quantum soldier browser: 8/8');
})().catch(error=>{console.error('BROWSER_FAIL',error.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  if(profile.startsWith(temp+path.sep))try{fs.rmSync(profile,{recursive:true,force:true})}catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message)}
});
