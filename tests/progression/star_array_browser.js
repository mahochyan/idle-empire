'use strict';
// Isolated Edge/CDP smoke for the real 320px tech page. Inventory is a UI fixture, not a paid material route.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'star-array-ui-'));
const port=25000+Math.floor(Math.random()*1000);
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
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
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:true});
  const research=await run("(()=>{S.sciences=['sci_nuclear_age','sci_star_beast_domain'];S.res.tech=300000000;S.res.medal=2000000;S.page='tech';updateUI();const b=document.querySelector(\"#main button[onclick=\\\"researchScience('sci_star_array')\\\"]\");const seen=!!b&&!b.disabled;b?.click();return{seen,paid:scienceUnlocked('sci_star_array'),tech:S.res.tech,medal:S.res.medal,version:JSON.parse(localStorage.getItem('rts_save')).v}})()");
  check('research button pays and saves',research.seen&&research.paid&&research.tech===0&&research.medal===0&&research.version===33);
  const actions=await run("(()=>{S.items.sacredRingCore=1000;S.items.illusionStone=100;S.items.starOriginStone=20;save();S.page='tech';updateUI();const open=document.querySelector(\"#main button[onclick=\\\"openStarArraySlot(0)\\\"]\");open?.click();const attune=document.querySelector(\"#main button[onclick=\\\"attuneStarArrayKnowledgeSlot(0)\\\"]\");attune?.click();const upgrade=document.querySelector(\"#main button[onclick=\\\"upgradeStarArraySlot(0,1)\\\"]\");upgrade?.click();const slot=S.starArray.star_trooper.slots[0];return{opened:!!open,attuned:!!attune,upgraded:!!upgrade,slot,stocks:[S.items.sacredRingCore,S.items.illusionStone,S.items.starOriginStone],saved:JSON.parse(localStorage.getItem('rts_save')).starArray.star_trooper.slots[0],width:document.documentElement.scrollWidth,innerWidth}})()");
  check('three real UI actions deduct three materials',actions.opened&&actions.attuned&&actions.upgraded&&actions.slot.open&&actions.slot.type==='knowledgeCap'&&actions.slot.level===2&&actions.slot.refreshCount===1&&actions.stocks.every(n=>n===0)&&actions.saved.level===2);
  check('mobile page has no horizontal overflow',actions.width<=actions.innerWidth+1);
  const bonus=await run("(()=>{const before=resCap('tech');S.awakening.star_trooper={level:20,stars:50,tracks:{easy:20,perfect:0,extreme:0}};save();updateUI();return{before,after:resCap('tech'),percent:starArrayKnowledgePercent(),shown:document.getElementById('main').textContent.includes('秘典知识仓上限 +4%')}})()");
  check('awakening activates visible knowledge capacity',bonus.percent===4&&bonus.after>bonus.before&&bonus.shown);
  await send('Page.reload',{ignoreCache:true});
  check('reload ready',await ready());
  const reload=await run("(()=>{const d=JSON.parse(localStorage.getItem('rts_save'));S.page='tech';updateUI();return{protected:saveProtected(),version:d.v,level:S.starArray.star_trooper.slots[0].level,percent:starArrayKnowledgePercent(),stocks:[S.items.sacredRingCore,S.items.illusionStone,S.items.starOriginStone],visible:document.getElementById('main').textContent.includes('星辉圣阵')}})()");
  check('research and slot survive reload',!reload.protected&&reload.version===33&&reload.level===2&&reload.percent===4&&reload.stocks.every(n=>n===0)&&reload.visible);
  const beastUi=await run("(()=>{S.killValues.starBeast=1000;save();S.page='fight';S._fightTab='expedition';updateUI();const card=[...document.querySelectorAll('#main .card')].find(c=>c.querySelector('h3')?.textContent.includes('星界兽域'));const tiers=card?[...card.querySelectorAll('button')].filter(b=>b.textContent.includes('阶星兽')):[];const calm=card?[...card.querySelectorAll('button')].find(b=>b.textContent.includes('镇静警戒')):null;const ready=!!calm&&!calm.disabled;calm?.click();const stored=JSON.parse(localStorage.getItem('rts_save'));return{card:!!card,tiers:tiers.length,ready,alert:S.killValues.starBeast,calms:dailyCount('starBeastCalm'),savedAlert:stored.killValues.starBeast,width:document.documentElement.scrollWidth,innerWidth}})()");
  check('expedition displays nine beast tiers and calm action',beastUi.card&&beastUi.tiers===9&&beastUi.ready&&beastUi.alert===0&&beastUi.calms===1&&beastUi.savedAlert===0);
  check('320px beast card has no horizontal overflow',beastUi.width<=beastUi.innerWidth+1);
  check('zero uncaught browser exceptions',exceptions.length===0);
  console.log('star array browser: 10/10');
})().catch(error=>{console.error('BROWSER_FAIL',error.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(200);
  // Profile is OS-temporary and intentionally left for normal system cleanup.
});
