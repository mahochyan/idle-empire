'use strict';
// Real Edge/CDP smoke for the bronze and iron military UI.
// Run: node tests/progression/military_browser.js
// Runtime state injection below checks presentation only, not progression reachability.
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
const profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'military-ui-profile-')));
if(!profile.startsWith(tempRoot+path.sep))throw Error('profile path outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const port=20500+Math.floor(Math.random()*800);
const browser=spawn(edge,[
  '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,pageUrl
],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[],shots=[];
const pending=new Map();
let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error;});

function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},10000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function setView(width){
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
  await sleep(150);
}
async function snap(width,name,title){
  if(title){
    const found=await evalJs(`(()=>{const e=[...document.querySelectorAll('#main .card')].find(x=>x.querySelector('h3')?.textContent.includes(${JSON.stringify(title)}))||[...document.querySelectorAll('#main .branch-header')].find(x=>x.textContent.includes(${JSON.stringify(title)}));e?.scrollIntoView({block:'start'});return !!e})()`);
    check(width+' '+name+' screenshot target',found,title);
    await sleep(150);
  }
  const out=await send('Page.captureScreenshot',{format:'png'});
  const file=path.join(tempRoot,'military-ui-'+process.pid+'-'+width+'-'+name+'.png');
  fs.writeFileSync(file,Buffer.from(out.data,'base64'));
  shots.push(file);
}
async function pageReady(){
  for(let i=0;i<30;i++){
    if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)"))return true;
    await sleep(100);
  }
  return false;
}
async function overflow(){
  return evalJs("(()=>{const main=document.getElementById('main');return {width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,main:main.scrollWidth,mainClient:main.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1}})()");
}
async function inspectTech(){
  return evalJs("(()=>{const row=name=>{const strong=[...document.querySelectorAll('#main .tech-science-row strong')].find(e=>e.textContent.trim()===name);const el=strong?.closest('.tech-science-row');return {text:el?.textContent||'',disabled:el?.querySelector('button')?.disabled??null}};return {bronze:row('青铜时代'),iron:row('铁器时代')}})()");
}
async function inspectBuildings(){
  return evalJs("(()=>{const card=key=>{const el=document.getElementById('build-'+key),icon=el?.querySelector('.i-'+key);return {text:el?.textContent||'',disabled:el?.querySelector('.build-entry-action')?.disabled??null,icon:icon?getComputedStyle(icon).backgroundImage:null}};return {bronze:card('bronze_workshop'),iron:card('iron_forge')}})()");
}
async function inspectTraining(){
  return evalJs("(()=>{const branch=name=>{const header=[...document.querySelectorAll('#main .barracks-branch-header')].find(e=>e.textContent.includes(name));return {text:header?.textContent||'',body:header?.nextElementSibling?.textContent||''}};const card=name=>{const strong=[...document.querySelectorAll('#main .barracks-unit-card strong')].find(e=>e.textContent.trim()===name),el=strong?.closest('.barracks-unit-card');return {text:el?.textContent||'',cost:el?.querySelector('.barracks-unit-cost')?.textContent||'',food:!!el?.querySelector('.i-food'),copper:!!el?.querySelector('.i-copper'),iron:!!el?.querySelector('.i-iron'),train:!!el?.querySelector('input[id^=train-barracks-]')}};return {bronzeBranch:branch('青铜刀盾兵'),ironBranch:branch('铁器长枪兵'),bronzeCard:card('青铜刀盾兵'),ironCard:card('铁器长枪兵')}})()");
}

(async()=>{
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break;}catch(_){}
  }
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
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
  await send('Runtime.enable');
  await send('Page.enable');
  await setView(360);
  // Capture load-time errors too: attach Runtime listener before reloading the page.
  await send('Page.reload',{ignoreCache:true});
  check('real page scripts load after reload',await pageReady(),pageUrl);

  await evalJs("S.page='tech';updateUI();'ok'");
  const tech360=await inspectTech();
  check('360 prerequisite-locked age research is hidden',!tech360.bronze.text&&!tech360.iron.text,tech360);
  // Presentation-only prerequisites: costs and buttons appear when the preceding research exists.
  await evalJs("S.sciences.push('sci_large_granary','sci_iron_warehouse');updateUI();'ok'");
  const eligible360=await inspectTech();
  check('360 bronze research reveals its cost after prerequisite',eligible360.bronze.text.includes('科技点 1200')&&eligible360.bronze.text.includes('前置「大粮仓」')&&eligible360.bronze.disabled===true,eligible360.bronze);
  check('360 iron research reveals its cost after prerequisite',eligible360.iron.text.includes('科技点 2500')&&eligible360.iron.text.includes('前置「铁仓库」')&&eligible360.iron.disabled===true,eligible360.iron);
  check('360 tech no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(360,'tech-bronze','资源科技');

  await evalJs("S.sciences=[];S.page='build';S._buildTab='barracks';updateUI();'ok'");
  const build360=await inspectBuildings();
  check('360 workshop sprites and science locks',build360.bronze.icon!=='none'&&build360.iron.icon!=='none'&&build360.bronze.text.includes('需先研究「青铜时代」')&&build360.iron.text.includes('需先研究「铁器时代」')&&build360.bronze.disabled===true&&build360.iron.disabled===true,build360);
  check('360 building no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(360,'build-bronze','青铜工坊');
  await snap(360,'build-iron','铁匠铺');

  await evalJs("S.page='barracks';S._barracksTab='train';updateUI();'ok'");
  const unresearched=await inspectTraining();
  check('360 unresearched training lines are hidden',!unresearched.bronzeBranch.text&&!unresearched.ironBranch.text&&!unresearched.bronzeCard.text&&!unresearched.ironCard.text,unresearched);
  await snap(360,'train-science-lock');

  // Presentation-only injection; never use this result to claim progression is reachable.
  await evalJs("S.sciences.push('sci_bronze_age','sci_iron_age');updateUI();'ok'");
  const unbuilt=await inspectTraining();
  check('360 unbuilt training lines remain hidden',!unbuilt.bronzeBranch.text&&!unbuilt.ironBranch.text&&!unbuilt.bronzeCard.text&&!unbuilt.ironCard.text,unbuilt);
  await snap(360,'train-building-lock');

  await evalJs("S.buildings.bronze_workshop={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.iron_forge={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};updateUI();'ok'");
  const trained360=await inspectTraining();
  check('360 bronze cost food 300 plus copper 100 per soldier',trained360.bronzeBranch.text&&trained360.bronzeCard.food&&trained360.bronzeCard.copper&&!trained360.bronzeCard.iron&&/每人消耗\s*300\s+100/.test(trained360.bronzeCard.cost)&&trained360.bronzeCard.train,trained360.bronzeCard);
  check('360 iron cost food 500 plus iron 100 per soldier',trained360.ironBranch.text&&trained360.ironCard.food&&trained360.ironCard.iron&&!trained360.ironCard.copper&&/每人消耗\s*500\s+100/.test(trained360.ironCard.cost)&&trained360.ironCard.train,trained360.ironCard);
  check('360 training no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(360,'train-bronze-ready','青铜刀盾兵');
  await snap(360,'train-iron-ready','铁器长枪兵');
  await setView(320);
  check('320 unlocked training cards have no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(320,'train-bronze-ready','青铜刀盾兵');

  await setView(400);
  await evalJs("S.sciences=[];S.buildings.bronze_workshop={lv:0,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.iron_forge={lv:0,state:'idle',timer:0,timerEnd:0,tier:0};S.page='tech';updateUI();'ok'");
  const tech400=await inspectTech();
  check('400 prerequisite-locked age research stays hidden',!tech400.bronze.text&&!tech400.iron.text,tech400);
  await evalJs("S.sciences.push('sci_large_granary','sci_iron_warehouse');updateUI();'ok'");
  const eligible400=await inspectTech();
  check('400 revealed age research retains cost and prerequisites',eligible400.bronze.text.includes('科技点 1200')&&eligible400.bronze.text.includes('前置「大粮仓」')&&eligible400.iron.text.includes('科技点 2500')&&eligible400.iron.text.includes('前置「铁仓库」'),eligible400);
  check('400 tech no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(400,'tech-iron','资源科技');
  await evalJs("S.sciences=[];S.page='build';S._buildTab='barracks';updateUI();'ok'");
  const build400=await inspectBuildings();
  check('400 workshop sprites and science locks',build400.bronze.text.includes('需先研究「青铜时代」')&&build400.iron.text.includes('需先研究「铁器时代」')&&build400.bronze.icon!=='none'&&build400.iron.icon!=='none'&&build400.bronze.disabled===true&&build400.iron.disabled===true,build400);
  check('400 building no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(400,'build-iron','铁匠铺');
  await evalJs("S.page='barracks';S._barracksTab='train';updateUI();'ok'");
  const locked400=await inspectTraining();
  check('400 locked training lines stay hidden',!locked400.bronzeBranch.text&&!locked400.ironBranch.text,locked400);
  await evalJs("S.sciences.push('sci_bronze_age','sci_iron_age');S.buildings.bronze_workshop={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.iron_forge={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};updateUI();'ok'");
  const trained400=await inspectTraining();
  check('400 both train cards retain metal costs',trained400.bronzeCard.copper&&trained400.ironCard.iron&&/每人消耗\s*300\s+100/.test(trained400.bronzeCard.cost)&&/每人消耗\s*500\s+100/.test(trained400.ironCard.cost),trained400);
  check('400 training no horizontal overflow',!(await overflow()).overflow,await overflow());
  await snap(400,'train-bronze-ready','青铜刀盾兵');
  await sleep(300);
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,4));

  console.log(JSON.stringify({checks,exceptions,shots,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,note:'Injected sciences/buildings verify UI presentation only; they do not prove gameplay reachability.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(250);
  try{if(profile.startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
});
