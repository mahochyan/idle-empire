'use strict';
// 独立 Edge 冒烟：只清理本进程启动的实例，不碰并行 UI 工作的浏览器。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {killTreeSync}=require('../ie001/edge-reaper');
const edgePath=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edgePath){console.error('NO_BROWSER');process.exit(2)}
const port=10000+Math.floor(Math.random()*20000),profile=fs.mkdtempSync(path.join(os.tmpdir(),'soul-realm-edge-'));
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
    await waitFor(async()=>await evalJs('typeof S!=="undefined"&&typeof refreshSoulRealmTeam==="function"'));
    await evalJs("S.sciences=['sci_electric_age','sci_soul_realm'];S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[],back:[]};S.page='fight';S._fightTab='expedition';updateUI()");
    assert.equal(await evalJs('!!document.querySelector(\'button[onclick="refreshSoulRealmTeam()"]\')'),true);
    await evalJs('document.querySelector(\'button[onclick="refreshSoulRealmTeam()"]\').click()');
    assert.equal(await evalJs('S.soulRealmTeam.slots.length'),9);
    assert.equal(await evalJs('document.querySelectorAll(\'button[onclick^="openSoulRealmSlot("]\').length'),9);
    assert.equal(await evalJs('(()=>{const c=[...document.querySelectorAll("#main .card")].find(x=>x.textContent.includes("英魂遗境"));return !!c&&c.scrollWidth<=c.clientWidth+1})()'),true);
    assert.equal(await evalJs('JSON.parse(localStorage.getItem("rts_save")).soulRealmTeam.slots.length'),9);
    const selected=await evalJs('S.soulRealmTeam.slots[0]');
    await evalJs('document.querySelector(\'button[onclick="openSoulRealmSlot(0)"]\').click()');
    assert.equal(await evalJs('B.enemyCfg.soulTierId'),selected);
    await evalJs('fleeBattle()');
    assert.equal(await evalJs('S.soulRealmTeam.slots[0]'),selected);
    await send('Page.reload',{ignoreCache:true});
    await waitFor(async()=>await evalJs('typeof S!=="undefined"&&S.soulRealmTeam?.slots?.length===9'));
    assert.equal(await evalJs('S.soulRealmTeam.slots[0]'),selected);
    assert.equal(exceptions.length,0,exceptions.join(' | '));
    console.log('PASS Edge 九敌位真实按钮、选敌、败逃和刷新后存档保持');
  }finally{
    try{ws?.close()}catch(e){}
    killTreeSync(edge.pid);
    try{fs.rmSync(profile,{recursive:true,force:true})}catch(e){}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
