'use strict';
// Real Edge/CDP check for the P381 barracks history and 320 px UI paths.
// Run: node tests/progression/barracks_visibility_browser_p381.js
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(candidate=>fs.existsSync(candidate));
if(!edge){console.error('NO_BROWSER: Microsoft Edge 未安装');process.exit(2);}
const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'barracks-p381-')));
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
browser.on('error',error=>{spawnError=error;});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},15000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof rBarracks==='function'"))return true;}catch(_){}
    await sleep(100);
  }
  return false;
}
async function reload(){
  await evalJs("window.__p381ReloadMarker=true;'marked'");
  await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<80;i++){
    try{if(await evalJs("document.readyState==='complete'&&window.__p381ReloadMarker===undefined&&typeof rBarracks==='function'"))return true;}catch(_){}
    await sleep(100);
  }
  return false;
}
async function overflow(){
  return evalJs("(()=>{const main=document.getElementById('main'),overflow=document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1;const offenders=overflow?[...document.body.querySelectorAll('*')].map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>0&&r.right>innerWidth+1).sort((a,b)=>b.r.right-a.r.right).slice(0,6).map(({e,r})=>({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,80),right:Math.round(r.right),width:Math.round(r.width)})):[];return{inner:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,main:main.scrollWidth,client:main.clientWidth,overflow,offenders}})()");
}

(async()=>{
  let targets;
  for(let i=0;i<50;i++){
    await sleep(200);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(target=>target.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(target=>target.type==='page'&&target.url===pageUrl)||targets?.find(target=>target.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
  check('real page scripts load',await ready());
  await evalJs("localStorage.clear();'cleared isolated profile'");
  check('clean new save reload',await reload());
  const fresh=await evalJs("(()=>{S.page='barracks';S._barracksTab='train';updateUI();return{bronze:!!document.querySelector('.barracks-unit-card[data-unit=bronze_guard]'),iron:!!document.querySelector('.barracks-unit-card[data-unit=iron_spearman]')}})()");
  check('fresh locked lines remain hidden',!fresh.bronze&&!fresh.iron,fresh);

  const historical=await evalJs("(()=>{S.pool.bronze_guard=3;S.formation.front=[{type:'bronze_guard',count:2}];S._garrisonForm.front=[{type:'bronze_guard',count:1}];S.buildings.bronze_workshop={lv:1,state:'idle',timer:0,tier:0};updateUI();const card=document.querySelector('.barracks-unit-card[data-unit=bronze_guard]');return{shown:!!card,total:card?.querySelector('.barracks-unit-stock strong')?.textContent,locked:!!card?.querySelector('.barracks-unit-lock'),dismiss:!!card?.querySelector('button[onclick^=\"dismissN(\"]')}})()");
  check('historical stock and dismissal visible despite missing science',historical.shown&&historical.total==='6'&&historical.locked&&historical.dismiss,historical);
  check('historical card fits 320 px',!(await overflow()).overflow,await overflow());
  const dismissed=await evalJs("(()=>{document.querySelector('.barracks-unit-card[data-unit=bronze_guard] button[onclick^=\"dismissN(\"]')?.click();const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{pool:S.pool.bronze_guard,exp:S.formation.front[0]?.count,gar:S._garrisonForm.front[0]?.count,savedPool:saved?.pool?.bronze_guard}})()");
  check('real DOM dismissal saves pool and leaves deployed troops',dismissed.pool===2&&dismissed.exp===2&&dismissed.gar===1&&dismissed.savedPool===2,dismissed);
  check('saved historical stock reloads',await reload());
  const reloaded=await evalJs("(()=>{S.page='barracks';S._barracksTab='train';updateUI();const card=document.querySelector('.barracks-unit-card[data-unit=bronze_guard]');return{stock:S.pool.bronze_guard,shown:!!card,locked:!!card?.querySelector('.barracks-unit-lock')}})()");
  check('historical card remains visible after reload',reloaded.stock===2&&reloaded.shown&&reloaded.locked,reloaded);

  const lowTier=await evalJs("(()=>{S.upgradedUnits.infantry_t1=true;S.pool.infantry=2;S.buildings.infantry_camp={lv:1,state:'idle',timer:0,tier:0};updateUI();const root=document.querySelector('.barracks-unit-card[data-unit=infantry]'),high=document.querySelector('.barracks-unit-card[data-unit=infantry_t1]');return{root:!!root,rootTrain:!!root?.querySelector('button[onclick^=\"trainCustom(\"]'),high:!!high,highLock:!!high?.querySelector('.barracks-unit-lock')}})()");
  check('trainable low tier shown beside researched high tier',lowTier.root&&lowTier.rootTrain&&lowTier.high&&lowTier.highLock,lowTier);
  check('mixed old and current tiers fit 320 px',!(await overflow()).overflow,await overflow());

  const blockedTech=await evalJs("(()=>{delete S.upgradedUnits.infantry_t1;S.defeated=[1,2,3,4,5];S.buildings.infantry_camp={lv:0,state:'idle',timer:0,tier:1};Object.assign(S.res,{tech:200,wood:500,stone:300,food:300});S.merit=5;S.page='tech';setTechFullOpen(true);updateUI();setTechCategory('units');const node=document.querySelector('#tech-full .tech-unit-node[data-unit=infantry_t1]');const result=upgradeUnit('infantry','infantry_t1');return{node:!!node,action:result?.ok,owned:!!S.upgradedUnits.infantry_t1,tech:S.res.tech}})()");
  check('unfinished camp hides technology action and blocks direct research',!blockedTech.node&&blockedTech.action===false&&!blockedTech.owned&&blockedTech.tech===200,blockedTech);
  const toastLayout=await evalJs("(()=>{const toast=document.querySelector('.toast'),phone=document.getElementById('phone');return{shown:!!toast,position:toast?getComputedStyle(toast).position:null,bodyWidth:document.body.scrollWidth,viewport:innerWidth,phoneWidth:phone?.getBoundingClientRect().width}})()");
  check('rejected research toast stays fixed without shrinking the 320 px game',toastLayout.shown&&toastLayout.position==='fixed'&&toastLayout.bodyWidth<=toastLayout.viewport&&toastLayout.phoneWidth>=300,toastLayout);
  const paidTech=await evalJs("(()=>{S.buildings.infantry_camp.lv=1;updateUI();setTechCategory('units');const node=document.querySelector('#tech-full .tech-unit-node[data-unit=infantry_t1]');const button=node?.querySelector('button[onclick^=\"upgradeUnit(\"]');button?.click();const saved=JSON.parse(localStorage.getItem('rts_save')||'null');return{node:!!node,button:!!button,owned:!!S.upgradedUnits.infantry_t1,tech:S.res.tech,savedOwned:!!saved?.upgradedUnits?.infantry_t1}})()");
  check('completed camp reveals paid technology action and persists ownership',paidTech.node&&paidTech.button&&paidTech.owned&&paidTech.tech===0&&paidTech.savedOwned,paidTech);
  // A rejected action's toast is a separate transient overlay; measure graph layout after it expires.
  await sleep(2100);
  check('technology graph fits 320 px',!(await overflow()).overflow,await overflow());
  check('no uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,5));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(item=>item.ok).length,failed:checks.filter(item=>!item.ok).length},null,2));
  process.exitCode=checks.some(item=>!item.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  for(let attempt=0;attempt<5&&fs.existsSync(profile);attempt++){
    try{
      const resolved=fs.realpathSync(profile);
      if(!resolved.startsWith(tempRoot+path.sep))throw Error('profile cleanup path outside temp');
      fs.rmSync(resolved,{recursive:true,force:true});
    }catch(error){
      if(attempt===4)console.error('PROFILE_CLEANUP_FAILED',error.message);
      else await sleep(300);
    }
  }
});
