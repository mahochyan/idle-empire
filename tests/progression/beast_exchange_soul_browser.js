'use strict';
// 独立 Edge 冒烟；仅使用并清理本脚本启动的浏览器实例。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {killTreeSync}=require('../ie001/edge-reaper');
const edgePath=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edgePath){console.error('NO_BROWSER');process.exit(2)}
const port=10000+Math.floor(Math.random()*20000),profile=fs.mkdtempSync(path.join(os.tmpdir(),'soul-trade-edge-'));
const url=pathToFileURL(path.join(__dirname,'../../index.html')).href;
const edge=spawn(edgePath,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pending=new Map(),exceptions=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}))})}
async function evalJs(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
async function waitFor(fn){for(let i=0;i<40;i++){if(await fn())return;await sleep(250)}throw Error('页面未准备好')}
(async()=>{
  try{
    let pages;
    for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();break}catch(e){await sleep(250)}}
    const page=pages?.find(p=>p.type==='page'&&p.url.includes('index.html'));
    assert.ok(page?.webSocketDebuggerUrl,'Edge 页面未启动');
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
    ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result)}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.text)};
    await send('Runtime.enable');await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
    await waitFor(async()=>await evalJs('typeof S!=="undefined"&&typeof exchangeSoulElixirForStones==="function"'));
    await evalJs("S.page='fight';S._fightTab='expedition';S.beastExchange.level=60;S.beastExchange.soulOffers.emberElixir=1;S.items.emberElixir=10;S.items.soulStone=79;save();updateUI()");
    const before=await evalJs('(()=>{const b=document.querySelector(\'button[onclick="exchangeSoulElixirFromUI(\\\'emberElixir\\\')"]\');return !!b&&!b.disabled&&!!document.getElementById("soul-trade-count")})()');
    assert.equal(before,true,'60级兑换入口未显示或被禁用');
    assert.equal(await evalJs('(()=>{const card=[...document.querySelectorAll("#main .card")].find(x=>x.textContent.includes("边贸行 Lv60"));return !!card&&card.scrollWidth<=card.clientWidth+1})()'),true,'360px兑换卡片横向溢出');
    await evalJs('document.querySelector(\'button[onclick="exchangeSoulElixirFromUI(\\\'emberElixir\\\')"]\').click()');
    assert.equal(await evalJs('S.items.emberElixir'),0);
    assert.equal(await evalJs('S.items.soulStone'),83);
    assert.equal(await evalJs('S.beastExchange.soulOffers.emberElixir'),0);
    await send('Page.reload',{ignoreCache:true});
    await waitFor(async()=>await evalJs('typeof S!=="undefined"&&S.items?.soulStone===83'));
    assert.equal(await evalJs('S.items.emberElixir'),0);
    assert.equal(await evalJs('S.beastExchange.soulOffers.emberElixir'),0);
    assert.equal(exceptions.length,0,exceptions.join(' | '));
    console.log('PASS Edge 60级铭石货位按钮、一次付款和刷新重载');
  }finally{
    try{ws?.close()}catch(e){}
    killTreeSync(edge.pid);
    if(path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('soul-trade-edge-'))
      try{fs.rmSync(profile,{recursive:true,force:true})}catch(e){}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
