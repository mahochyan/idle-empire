'use strict';
// Real Edge/CDP smoke: unlocked market panel, permanent exchange click, and reload.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'permanent-cleanser-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),checks=[],exceptions=[];let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail})}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})}
async function evalJs(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
async function ready(){for(let i=0;i<100;i++){try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof exchangeDomainCleanser==='function'"))return true}catch(_){}await sleep(100)}return false}

(async()=>{
  const activePort=path.join(profile,'DevToolsActivePort');let port;
  for(let i=0;i<80;i++){await sleep(100);if(spawnError)throw spawnError;if(!fs.existsSync(activePort))continue;const candidate=Number(fs.readFileSync(activePort,'utf8').split(/\r?\n/,1)[0]);if(Number.isInteger(candidate)&&candidate>0&&candidate<=65535){port=candidate;break}}
  if(!port)throw Error('NO_OWN_CDP_PORT');
  let targets;
  for(let i=0;i<40;i++){await sleep(100);try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}}
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.id&&pending.has(data.id)){const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result)}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('scripts load at 360 px',await ready());
  const locked=await evalJs("(()=>{S.page='build';S._buildTab='economy';updateUI();return !document.getElementById('market-domain-cleanser-exchange')})()");
  check('unresearched market hides permanent recipe',locked);
  const shown=await evalJs(`(()=>{
    S.sciences=['sci_copper','sci_electric_age'];
    S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};
    S.marketSpecial.offers.domainCleanser=0;S.marketSpecial.cycles=1;S.marketSpecial.clockSec=1200;
    S.items.sacredBlood=6;save();updateUI();
    const button=document.getElementById('market-domain-cleanser-exchange');
    return{exists:!!button,enabled:!!button&&!button.disabled,label:button?.textContent,
      randomOffer:S.marketSpecial.offers.domainCleanser,overflow:document.documentElement.scrollWidth>innerWidth}
  })()`);
  check('permanent source-priced recipe is enabled with zero random offers and fits mobile',shown.exists&&shown.enabled&&shown.label.includes('圣兽血剂 3')&&shown.label.includes('镇域净化剂 1')&&shown.randomOffer===0&&!shown.overflow,shown);
  const paid=await evalJs(`(()=>{
    document.getElementById('market-domain-cleanser-exchange').click();
    const afterFirst={blood:S.items.sacredBlood,cleanser:S.items.domainCleanser};
    const repeat=exchangeDomainCleanser();
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return{afterFirst,repeat,cooling:document.getElementById('market-domain-cleanser-exchange')?.disabled,
      blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
      savedBlood:saved.items.sacredBlood,savedCleanser:saved.items.domainCleanser,randomOffer:S.marketSpecial.offers.domainCleanser}
  })()`);
  check('real button pays once, shows five-second cooldown, and saves state',paid.afterFirst.blood===3&&paid.afterFirst.cleanser===1&&paid.repeat.ok&&paid.repeat.repeat&&paid.cooling&&paid.blood===3&&paid.cleanser===1&&paid.savedBlood===3&&paid.savedCleanser===1&&paid.randomOffer===0,paid);
  await send('Page.reload',{ignoreCache:true});
  check('reload completes',await ready());
  const persisted=await evalJs("(()=>({protected:saveProtected(),blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,offer:S.marketSpecial.offers.domainCleanser}))()");
  check('exchange persists after reload without random offer consumption',!persisted.protected&&persisted.blood===3&&persisted.cleanser===1&&persisted.offer===0,persisted);
  const batch=await evalJs(`(()=>{
    S.page='build';S._buildTab='economy';
    S.ops=[];S.items.sacredBlood=18;S.items.domainCleanser=0;save();updateUI();
    const button=document.getElementById('market-domain-cleanser-exchange-six');
    const enabled=!!button&&!button.disabled;
    button?.click();
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return{enabled,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
      savedBlood:saved.items.sacredBlood,savedCleanser:saved.items.domainCleanser,
      cooling:document.getElementById('market-domain-cleanser-exchange-six')?.disabled,
      overflow:document.documentElement.scrollWidth>innerWidth}
  })()`);
  check('mobile batch button pays 18 blood for six cleansers and enters cooldown',batch.enabled&&batch.blood===0&&batch.cleanser===6&&batch.savedBlood===0&&batch.savedCleanser===6&&batch.cooling&&!batch.overflow,batch);
  await send('Page.reload',{ignoreCache:true});
  check('batch reload completes',await ready());
  const batchPersisted=await evalJs("(()=>({blood:S.items.sacredBlood,cleanser:S.items.domainCleanser}))()");
  check('six-cleansers batch persists',batchPersisted.blood===0&&batchPersisted.cleanser===6,batchPersisted);
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2}).finally(async()=>{
  try{if(ws?.readyState===1)ws.send(JSON.stringify({id:++nextId,method:'Browser.close'}))}catch(_){}
  await sleep(800);try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(500);
  try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300})}catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message)}
  process.exit(process.exitCode??0);
});
