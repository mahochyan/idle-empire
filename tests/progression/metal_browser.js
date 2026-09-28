'use strict';
// 独立 Edge/CDP 冒烟：node tests/progression/metal_browser.js
// 360/400px 视口模拟验证煤链 DOM、旧配方切换与超仓库存。截图默认写入系统临时目录。
// 仅清理本脚本启动的 Edge 进程树及专用临时 profile；不清扫其它浏览器会话。
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
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const tempRoot=path.resolve(os.tmpdir());
const profile=path.resolve(tempRoot,'metal-ui-smoke-'+process.pid);
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const port=19700+Math.floor(Math.random()*800);
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws,id=0;
const pending=new Map(),exceptions=[],checks=[];
function check(name,ok,info){checks.push({name,ok:!!ok,info:ok?undefined:info});}
function send(method,params={}){return new Promise((resolve,reject)=>{const token=++id;pending.set(token,{resolve,reject});ws.send(JSON.stringify({id:token,method,params}));});}
async function evalJs(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function setView(width){await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});await sleep(150);}
async function snap(width){const out=await send('Page.captureScreenshot',{format:'png'});const file=path.join(tempRoot,'metal-ui-'+process.pid+'-'+width+'.png');fs.writeFileSync(file,Buffer.from(out.data,'base64'));return file;}
(async()=>{
  let targets;
  for(let tries=0;tries<40;tries++){
    await sleep(500);
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
  };
  await send('Runtime.enable');await send('Page.enable');await setView(360);await sleep(900);
  const home=await evalJs("(()=>({width:innerWidth,topCells:document.querySelectorAll('#topbar .top-res').length,visibleTopCells:[...document.querySelectorAll('#topbar .top-res')].filter(x=>getComputedStyle(x).display!=='none').length,silverHidden:getComputedStyle(document.getElementById('top-silver')).display==='none',coal:document.getElementById('res-coal')?.textContent,coalCap:document.getElementById('cap-coal')?.textContent,icon:getComputedStyle(document.querySelector('.i-coal')).backgroundImage,main:document.getElementById('main').textContent,overflow:document.documentElement.scrollWidth>innerWidth,topFits:[...document.querySelectorAll('#topbar .top-res')].every(x=>x.getBoundingClientRect().right<=document.getElementById('phone').getBoundingClientRect().right+1)}))()");
  check('360 viewport keeps nine visible early resources',home.width===360&&home.topCells===14&&home.visibleTopCells===9&&home.silverHidden,home);
  const scripts=await evalJs("({version:window.APP_VERSION,order:window.APP_SCRIPTS?.join(',')})");
  check('cache version 25 and script dependency order',scripts.version==='25'&&scripts.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',scripts);
  check('coal stock/cap and sprite render',home.coal==='0'&&home.coalCap==='/600'&&home.icon!=='none',home);
  check('360 no horizontal overflow',!home.overflow&&home.topFits,home);
  check('home coal-chain card',home.main.includes('矿煤冶炼')&&home.main.includes('石料／矿石'),home.main.slice(0,300));
  const shot360=await snap(360);
  await evalJs("[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('矿煤冶炼')).scrollIntoView({block:'start'});'ok'");await sleep(150);
  const shot360Card=await snap('360-card');
  await evalJs("S.page='build';S._buildTab='economy';updateUI();'ok'");
  const buildings=await evalJs("(()=>({names:document.getElementById('main').textContent,icon:getComputedStyle(document.querySelector('.i-coal_store')).backgroundImage}))()");
  check('coal mine and three stores in economy tab',['煤井','煤仓','铜仓','铁仓'].every(x=>buildings.names.includes(x))&&buildings.icon!=='none',buildings.names.slice(0,350));
  await evalJs("S.page='tech';updateUI();'ok'");
  const tech=await evalJs("(()=>({all:document.getElementById('main').textContent,copper:[...document.querySelectorAll('#main strong')].find(x=>x.textContent==='冶铜术')?.parentElement?.parentElement?.textContent}))()");
  check('coal research card and copper coal prerequisite',tech.all.includes('煤炭开采')&&tech.copper?.includes('前置「煤炭开采」'),tech.copper);
  const shortage=await evalJs("(()=>{S.sciences.push('sci_coal','sci_copper');S.popAlloc.copper=1;S.population.current=1;S.res.stone=0;S.res.coal=0;S.page='home';updateUI();return document.getElementById('main').textContent})()");
  check('coal recipe worker shows input and shortage',shortage.includes('每工投入 石料 2 + 煤 2')&&shortage.includes('本秒原料不足或被前序岗位占用'),shortage.slice(-800));
  await evalJs("S.popAlloc.copper=0;S.population.current=0;S.res.stone=300;S.metalRecipeMode='legacy';S.res.copper=1000;S.res.iron=1200;S.page='tech';updateUI();'ok'");
  const legacyCopper=await evalJs("[...document.querySelectorAll('#main strong')].find(x=>x.textContent==='冶铜术')?.parentElement?.parentElement?.textContent");
  check('legacy copper research keeps prospect prerequisite',legacyCopper?.includes('前置「探矿术」')&&!legacyCopper?.includes('前置「煤炭开采」'),legacyCopper);
  await evalJs("S.page='home';updateUI();'ok'");
  const legacy=await evalJs("(()=>({text:document.getElementById('main').textContent,disabled:[...document.querySelectorAll('#main button')].find(x=>x.textContent.includes('一次性切换煤链'))?.disabled,warning:metalSwitchWarning()}))()");
  check('legacy recipe and explicit cap/stock warning',legacy.text.includes('旧配方')&&legacy.text.includes('1000')&&legacy.text.includes('1200')&&legacy.warning.includes('库存 1000')&&legacy.warning.includes('上限')&&legacy.disabled===false,legacy.warning);
  await evalJs("[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('矿煤冶炼')).scrollIntoView({block:'start'});'ok'");await sleep(150);
  const shotLegacy=await snap('360-legacy-card');
  await evalJs("window.confirm=()=>{window.__switchPrompt=metalSwitchWarning();return true};[...document.querySelectorAll('#main button')].find(x=>x.textContent.includes('一次性切换煤链')).click();'ok'");
  const switched=await evalJs("(()=>({mode:S.metalRecipeMode,copper:S.res.copper,iron:S.res.iron,prompt:window.__switchPrompt,button:[...document.querySelectorAll('#main button')].some(x=>x.textContent.includes('一次性切换煤链')),capC:resCap('copper'),capI:resCap('iron')}))()");
  check('clicked one-way switch preserves historical over-cap stock',switched.mode==='coal'&&switched.copper===1000&&switched.iron===1200&&switched.capC===600&&switched.capI===600&&!switched.button,switched);
  await setView(400);
  const wide=await evalJs("(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,topFits:[...document.querySelectorAll('#topbar .top-res')].every(x=>x.getBoundingClientRect().right<=document.getElementById('phone').getBoundingClientRect().right+1),card:document.getElementById('main').textContent.includes('矿煤冶炼')}))()");
  check('400 no horizontal overflow and card visible',wide.width===400&&!wide.overflow&&wide.topFits&&wide.card,wide);
  const shot400=await snap(400);
  await evalJs("[...document.querySelectorAll('#main .card')].find(x=>x.textContent.includes('矿煤冶炼')).scrollIntoView({block:'start'});'ok'");await sleep(150);
  const shot400Card=await snap('400-card');
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,shots:[shot360,shot360Card,shotLegacy,shot400,shot400Card],passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(profile.startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});

