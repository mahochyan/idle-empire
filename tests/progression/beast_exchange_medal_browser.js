'use strict';
// 独立 Edge/CDP 入口验收：仅操作系统临时 profile，不接触玩家浏览器存档。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {killTreeSync}=require('../ie001/edge-reaper');
const edgePath=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edgePath){console.error('NO_BROWSER');process.exit(2)}
const tempRoot=path.resolve(os.tmpdir()),profile=fs.mkdtempSync(path.join(tempRoot,'medal-offer-edge-'));
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
  check('脚本加载',await ready('typeof S!=="undefined"&&typeof exchangeOfferedBonesForMedals==="function"'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("S.page='fight';S._fightTab='expedition';S.beastExchange.level=60;S.beastExchange.medalOffers=1;S.res.bone=300;S.res.medal=944;save();updateUI()");
  check('60级勋章货位入口与费用',await evalJs('(()=>{const button=document.querySelector("button[onclick=\'exchangeMedalOfferFromUI()\']");const card=[...document.querySelectorAll("#main .card")].find(x=>x.textContent.includes("边贸行 Lv60"));return {button:!!button,disabled:button?.disabled,input:!!document.getElementById("medal-offer-count"),price:card?.textContent.includes("300兽骨换1200"),overflow:card?.scrollWidth>card?.clientWidth+1}})()'),{button:true,disabled:false,input:true,price:true,overflow:false});
  await evalJs('document.querySelector("button[onclick=\'exchangeMedalOfferFromUI()\']").click()');
  check('按钮真实付款与写档',await evalJs('({bone:S.res.bone,medal:S.res.medal,offer:S.beastExchange.medalOffers,saved:JSON.parse(localStorage.getItem("rts_save")).res.medal})'),{bone:0,medal:2144,offer:0,saved:2144});
  await send('Page.reload',{ignoreCache:true});
  check('重载保留库存与货位',await ready('typeof S!=="undefined"&&S.res?.medal===2144'),true);
  check('重载勋章与兽骨',await evalJs('({bone:S.res.bone,medal:S.res.medal,offer:S.beastExchange.medalOffers})'),{bone:0,medal:2144,offer:0});
  await send('Emulation.setDeviceMetricsOverride',{width:400,height:780,deviceScaleFactor:1,mobile:true});
  await evalJs("S.page='fight';S._fightTab='expedition';updateUI()");
  check('400px无横向溢出',await evalJs('document.documentElement.scrollWidth>innerWidth'),false);
  check('页面无未捕获异常',exceptions,[]);
  console.log(`medal offer browser: ${passed} passed`);
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}killTreeSync(edge.pid);
  if(path.resolve(profile).startsWith(tempRoot+path.sep))for(let i=0;i<8&&fs.existsSync(profile);i++){
    await sleep(250);
    try{fs.rmSync(profile,{recursive:true,force:true})}catch(error){if(i===7)console.error('PROFILE_CLEANUP_FAILED',error.message)}
  }
});
