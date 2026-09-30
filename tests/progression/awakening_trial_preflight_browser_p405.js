'use strict';
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'awakening-preflight-p405-'));
const port=29000+Math.floor(Math.random()*1000);
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p390-star-array-entry-paid-save.json'),'utf8');
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
  '--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,url],
  {stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),exceptions=[];
let ws,id=0;
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method))},20000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
}
async function run(expression){
  const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
  return response.result.value;
}
async function ready(){for(let i=0;i<100;i++){try{if(await run("document.readyState==='complete'&&typeof openAwakeningTrial==='function'"))return true}catch(_){}await sleep(100)}return false}
function check(name,condition){if(!condition)throw Error('FAIL '+name);console.log('PASS '+name)}

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
  check('Edge page loaded',await ready());
  await run(`localStorage.setItem('rts_save',${JSON.stringify(source)})`);
  await send('Page.reload',{ignoreCache:true});
  check('paid v33 save loaded',await ready()&&await run("!saveProtected()&&S.population.current===1002"));
  const blocked=await run(`(()=>{
    S.sciences.push('sci_steam_military');S.steamMilitaryStars=50;S.items.trialFruit=1000;save();
    const before=localStorage.getItem('rts_save'),result=openAwakeningTrial('easy');
    return{result,fruit:S.items.trialFruit,active:S.battleActive,unchanged:localStorage.getItem('rts_save')===before,
      overCap:formSoldierCount()>steamMilitaryActiveFieldCap()}})()`);
  check('over-cap trial rejects before debit and save',blocked.overCap&&blocked.result.ok===false&&
    blocked.result.reason==='formation-too-large'&&blocked.fruit===1000&&!blocked.active&&blocked.unchanged);
  await send('Page.reload',{ignoreCache:true});
  check('refused trial still has full fruit after reload',await ready()&&await run('S.items.trialFruit===1000&&!S.battleActive'));
  const started=await run(`(()=>{
    S.steamMilitaryStars=0;save();const cost=awakeningTrialCost(),result=openAwakeningTrial('easy');
    return{result,cost,fruit:S.items.trialFruit,active:S.battleActive,saved:JSON.parse(localStorage.getItem('rts_save')).items.trialFruit}})()`);
  check('legal trial debits once and opens real battle',started.result.ok===true&&started.result.cost===started.cost&&
    started.active&&started.fruit===1000-started.cost&&started.saved===started.fruit);
  await sleep(700);
  check('async battle callback ran',await run('B.round>=1'));
  await run('if(S.battleActive)fleeBattle()');
  check('zero uncaught page exceptions',exceptions.length===0);
  console.log('awakening trial preflight browser P405: 7/7');
})().catch(error=>{console.error('BROWSER_FAIL',error.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(200);
});
