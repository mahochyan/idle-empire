'use strict';
// P395: real Edge/CDP smoke for the iron-store steel-cap copy and live cap.
// Uses only this test's disposable browser profile; no player save is touched.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>fs.existsSync(p));
if(!edge){console.error('NO_BROWSER: Microsoft Edge not installed');process.exit(2)}
const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'iron-store-p395-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=25000+Math.floor(Math.random()*1000);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[],pending=new Map();
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail})}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},12000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
  return response.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&typeof resCap==='function'&&typeof rBuild==='function'&&typeof updateUI==='function'"))return true}catch(_){}
    await sleep(100);
  }
  return false;
}

(async()=>{
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')
      exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('real page and game scripts loaded',await ready());
  const scriptOrder=await evalJs(`({declared:window.APP_SCRIPTS,
    actual:[...document.scripts].filter(s=>s.src).map(s=>new URL(s.src).pathname.split('/').pop())})`);
  const expected=['config.js','levels.js','sprites.js','math.js','garrison.js','technology.js','ui.js'];
  const expectedAll=['three.min.js','unit-vfx-profiles.js','hd2d.js',...expected];
  check('actual synchronous script order',
    JSON.stringify(scriptOrder.declared)===JSON.stringify(expected)&&
    JSON.stringify(scriptOrder.actual)===JSON.stringify(expectedAll),scriptOrder);

  const card=await evalJs(`(()=>{
    S.page='build';S._buildTab='economy';updateUI();
    const article=document.getElementById('build-iron_store');
    const detail=article?.querySelector('details');if(detail)detail.open=true;
    const text=detail?.textContent?.replace(/\\s+/g,' ').trim()||'';
    const cap=resCap('steel'),formatted=metalUiNumber(cap);
    const beforeLv=bldSt('iron_store').lv,had=Object.hasOwn(S.buildings,'iron_store');
    const original=S.buildings.iron_store;
    S.buildings.iron_store={...bldSt('iron_store'),lv:beforeLv+1};
    const nextCap=resCap('steel');
    if(had)S.buildings.iron_store=original;else delete S.buildings.iron_store;
    return{exists:!!article,visible:!!article&&!article.hidden&&getComputedStyle(article).display!=='none',
      detailsOpen:!!detail?.open,name:article?.querySelector('.build-entry-title')?.textContent,
      text,cap,formatted,nextCap,restoredLv:bldSt('iron_store').lv,beforeLv};
  })()`);
  check('iron-store real building card shows base steel +50 per level',
    card.visible&&card.detailsOpen&&card.name?.includes('铁仓')&&
    card.text.includes('每级提高基础钢容量 50'),card);
  check('building card shows current resCap(steel)',
    card.text.includes('当前钢上限 '+card.formatted)&&
    Number.isFinite(card.cap)&&card.restoredLv===card.beforeLv,card);
  check('one iron-store level adds 50 to base steel cap',card.nextCap-card.cap===50,
    {current:card.cap,next:card.nextCap});
  check('no uncaught browser exception',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,
    failed:checks.filter(x=>!x.ok).length},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=2}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  for(let attempt=0;attempt<10&&fs.existsSync(profile);attempt++){
    try{
      const resolved=fs.realpathSync(profile);
      if(!resolved.startsWith(tempRoot+path.sep))throw Error('profile cleanup path outside temp');
      fs.rmSync(resolved,{recursive:true,force:true});
    }catch(error){
      if(attempt===9){console.error('PROFILE_CLEANUP_FAILED',error.message);process.exitCode=2}
      else await sleep(250);
    }
  }
});
