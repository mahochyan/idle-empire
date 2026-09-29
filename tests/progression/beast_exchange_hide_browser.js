'use strict';
// Edge/CDP entry check in an isolated temporary profile; never touches the player's browser save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {killTreeSync}=require('../ie001/edge-reaper');
const edgePath=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edgePath){console.error('NO_BROWSER');process.exit(2)}
const tempRoot=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'hide-exchange-edge-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const port=10000+Math.floor(Math.random()*20000),url=pathToFileURL(path.join(__dirname,'../../index.html')).href;
const edge=spawn(edgePath,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0,passed=0;const pending=new Map(),exceptions=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
async function evalJs(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
async function ready(expression){for(let i=0;i<50;i++){try{if(await evalJs(expression))return true}catch(_){}await sleep(200)}return false}
function check(name,value,expected){assert.deepEqual(value,expected,name);passed++;console.log('PASS '+name)}
(async()=>{
  let pages;
  for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(pages.some(p=>p.type==='page'))break}catch(_){}await sleep(250)}
  const page=pages?.find(p=>p.type==='page'&&p.url===url)||pages?.find(p=>p.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result)}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  check('脚本加载',await ready('typeof S!=="undefined"&&typeof exchangeHideForResource==="function"'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("S.page='fight';S._fightTab='expedition';S.res.hide=2;save();updateUI()");
  check('一级边贸行刷新入口',await evalJs('(()=>{const btn=document.querySelector("button[onclick=\\"beastExchangeActionFromUI(\'refresh\')\\"]");return {button:!!btn,disabled:btn?.disabled,hide:S.res.hide,level:S.beastExchange.level}})()'),{button:true,disabled:false,hide:2,level:1});
  await evalJs('Math.random=()=>0;document.querySelector("button[onclick=\\"beastExchangeActionFromUI(\'refresh\')\\"]").click()');
  check('真实刷新生成兽皮货位',await evalJs('({offers:S.beastExchange.hideOffers[290001].count,charges:S.beastExchange.refreshCharges,cost:beastHideTradeCost(290001)})'),{offers:8,charges:4,cost:1});
  check('360px兑换入口无卡片溢出',await evalJs('(()=>{const btn=document.querySelector("button[onclick=\\"exchangeHideFromUI(\'290001\')\\"]");const card=btn?.closest(".card");return {button:!!btn,disabled:btn?.disabled,input:!!document.getElementById("hide-trade-count"),overflow:card?.scrollWidth>card?.clientWidth+1}})()'),{button:true,disabled:false,input:true,overflow:false});
  await evalJs('document.querySelector("button[onclick=\\"exchangeHideFromUI(\'290001\')\\"]").click()');
  check('按钮实际扣费及写档',await evalJs('({hide:S.res.hide,food:S.res.food,progress:S.beastExchange.progress,offers:S.beastExchange.hideOffers[290001].count,saved:JSON.parse(localStorage.getItem("rts_save")).res.hide})'),{hide:1,food:1300,progress:1,offers:7,saved:1});
  await send('Page.reload',{ignoreCache:true});
  check('重载保留兽皮和经验',await ready('typeof S!=="undefined"&&S.res?.hide===1&&S.beastExchange?.progress===1'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:400,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("S.page='fight';S._fightTab='expedition';updateUI()");
  check('400px无横向溢出',await evalJs('document.documentElement.scrollWidth>innerWidth'),false);
  check('真实页面离线结算刷新边贸货位并写档',await evalJs('(()=>{S.population.current=0;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=1000;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=5;S.beastExchange.refreshClock=1;Math.random=()=>0;save();_loadedTs=Date.now()-121000;const result=settleOffline();updateUI();const saved=JSON.parse(localStorage.getItem("rts_save"));return {ok:result.ok,offers:S.beastExchange.heartOffers,savedOffers:saved.beastExchange.heartOffers,charges:S.beastExchange.refreshCharges,shown:document.body.textContent.includes("边贸行")}})()'),{ok:true,offers:11,savedOffers:11,charges:5,shown:true});
  await send('Page.reload',{ignoreCache:true});
  check('重载保留离线刷新的货位',await ready('typeof S!=="undefined"&&S.beastExchange?.heartOffers===11'),true);
  check('真实页面显示离线边贸被动奖励并写档',await evalJs('(()=>{S.page="home";S.population.current=0;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=0;S.res.bone=0;S.res.medal=0;S.res.deed=0;S.beastExchange.level=31;save();_loadedTs=Date.now()-900000;const result=settleOffline();updateUI();const saved=JSON.parse(localStorage.getItem("rts_save"));return {duration:result.durationSec,bone:S.res.bone,medal:S.res.medal,deed:S.res.deed,savedBone:saved.res.bone,shown:document.body.textContent.includes("兽骨 +1800")}})()'),{duration:900,bone:1800,medal:450,deed:270,savedBone:1800,shown:true});
  await send('Page.reload',{ignoreCache:true});
  check('重载保留离线被动奖励',await ready('typeof S!=="undefined"&&S.res?.bone===1800&&S.res?.medal===450&&S.res?.deed===270'),true);
  check('页面无未捕获异常',exceptions,[]);
  console.log(`beast exchange hide browser: ${passed} passed`);
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}killTreeSync(edge.pid);
  if(path.resolve(profile).startsWith(tempRoot+path.sep))for(let i=0;i<8&&fs.existsSync(profile);i++){
    await sleep(250);
    try{fs.rmSync(profile,{recursive:true,force:true})}catch(error){if(i===7)console.error('PROFILE_CLEANUP_FAILED',error.message)}
  }
});
