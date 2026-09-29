'use strict';
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'steam-military-ui-'));
const port=28000+Math.floor(Math.random()*1000);
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const paid=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p390-star-array-entry-paid-save.json'),'utf8');
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
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
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){for(let i=0;i<100;i++){try{if(await run("document.readyState==='complete'&&typeof updateUI==='function'"))return true}catch(_){}await sleep(100)}return false}
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
  ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.id&&pending.has(data.id)){
    const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
    data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
  }if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  check('browser ready',await ready());
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});
  const fresh=await run("(()=>{S.page='tech';updateUI();return !document.getElementById('main').textContent.includes('军团整编')&&!document.getElementById('main').textContent.includes('蒸汽军制')})()");
  check('fresh profile hides locked branch',fresh);
  await run(`localStorage.setItem('rts_save',${JSON.stringify(paid)})`);
  await send('Page.reload',{ignoreCache:true});
  check('paid save reload ready',await ready());
  const result=await run("(()=>{for(let i=0;i<6;i++)tick();S.page='tech';updateUI();const before=!!document.querySelector(\"#main button[onclick=\\\"steamMilitaryStarStep(1)\\\"]\");const research=document.querySelector(\"#main button[onclick=\\\"researchScience('sci_steam_military')\\\"]\");const ready=!!research&&!research.disabled;research?.click();const card=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes('军团整编'));const up=card?.querySelector('button[onclick=\"steamMilitaryStarStep(1)\"]');const canUp=!!up&&!up.disabled;up?.click();const saved=JSON.parse(localStorage.getItem('rts_save'));return{before,ready,canUp,stars:S.steamMilitaryStars,paid:scienceUnlocked('sci_steam_military'),savedStars:saved.steamMilitaryStars,version:saved.v,visible:!!card,width:document.documentElement.scrollWidth,innerWidth}})()");
  check('research and star action use real DOM and save',!result.before&&result.ready&&result.canUp&&result.stars===1&&result.paid&&result.savedStars===1&&result.version===33&&result.visible);
  check('320px tech panel has no horizontal overflow',result.width<=result.innerWidth+1);
  await send('Page.reload',{ignoreCache:true});
  check('star reload ready',await ready());
  const after=await run("(()=>{S.page='tech';updateUI();return{stars:S.steamMilitaryStars,field:steamMilitaryFieldSize(),bonus:steamMilitaryStatMultiplier(),shown:document.getElementById('main').textContent.includes('军团整编'),protected:saveProtected()}})()");
  check('star persists after browser reload',after.stars===1&&after.field===957&&after.bonus===1.1&&after.shown&&!after.protected);
  check('zero uncaught browser exceptions',exceptions.length===0);
  console.log('steam military browser: 7/7');
})().catch(error=>{console.error('BROWSER_FAIL',error.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(200);
});
