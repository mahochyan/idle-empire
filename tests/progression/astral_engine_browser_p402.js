'use strict';
// Real Edge/CDP smoke. The 100b knowledge and warehouse expansion below are an
// isolated UI fixture, not evidence that the P401 natural save has earned them.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'../..');
const raw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p401-postquantum-medal-ready-save.json'),'utf8');
if(JSON.parse(raw).v!==35)throw Error('EXPECTED_V35_FIXTURE');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Microsoft Edge unavailable');process.exit(2)}
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'astral-engine-p402-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const pageUrl=pathToFileURL(path.join(root,'index.html')).href;
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
  '--no-sandbox','--disable-background-networking','--remote-debugging-port=0',
  '--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],exceptions=[],pending=new Map();
let ws,seq=0,spawnError;
browser.on('error',error=>{spawnError=error});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail})}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},15000);
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
  for(let i=0;i<100;i++){
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof setBattleSpeed==='function'"))return true}catch(_){}
    await sleep(100);
  }
  return false;
}
async function main(){
  const portFile=path.join(profile,'DevToolsActivePort');
  let port;
  for(let i=0;i<100;i++){
    await sleep(100);
    if(spawnError)throw spawnError;
    if(!fs.existsSync(portFile))continue;
    const candidate=Number(fs.readFileSync(portFile,'utf8').split(/\r?\n/,1)[0]);
    if(Number.isInteger(candidate)&&candidate>0&&candidate<=65535){port=candidate;break}
  }
  if(!port)throw Error('NO_OWN_CDP_PORT');
  let pages;
  for(let i=0;i<60;i++){
    await sleep(100);
    if(spawnError)throw spawnError;
    try{pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(pages.some(p=>p.type==='page'))break}catch(_){}
  }
  const page=pages?.find(p=>p.type==='page'&&p.url===pageUrl)||pages?.find(p=>p.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{
    const d=JSON.parse(event.data);
    if(d.id&&pending.has(d.id)){
      const p=pending.get(d.id);pending.delete(d.id);clearTimeout(p.timer);
      d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);
    }
    if(d.method==='Runtime.exceptionThrown')exceptions.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);
    if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error')exceptions.push('console.error: '+(d.params.args||[]).map(a=>a.value??a.description).join(' '));
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('fresh v36 app loads',await ready());
  const fresh=await evalJs(`(()=>{const b=document.querySelector('#battle-speed [data-spd="100"]');
    const two=document.querySelector('#battle-speed [data-spd="2"]');
    const before=S.battleSpeed;b.hidden=false;b.click();
    return{version:targetSaveVersion(),before,after:S.battleSpeed,locked:!scienceUnlocked('sci_astral_engine'),
      hidden:window.getComputedStyle(b).display==='none',twoOn:two.classList.contains('on'),
      order:APP_SCRIPTS.join(','),overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('100x is hidden and forged click cannot bypass research',fresh.version===36&&fresh.before===2&&fresh.after===2&&
    fresh.locked&&fresh.hidden&&fresh.twoOn&&fresh.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js'&&!fresh.overflow,fresh);

  await evalJs(`localStorage.setItem('rts_save',${JSON.stringify(raw)});'seeded'`);
  await send('Page.reload',{ignoreCache:true});
  check('v35 paid save reloads through v36 migration',await ready());
  const migrated=await evalJs(`(()=>{S.page='tech';updateUI();const saved=JSON.parse(localStorage.getItem('rts_save'));
    const name=sciName('sci_astral_engine');const row=[...document.querySelectorAll('#main .tech-science-row')].find(x=>x.querySelector('strong')?.textContent===name);
    const button=row?.querySelector('button');const speed=document.querySelector('#battle-speed [data-spd="100"]');
    return{version:saved.v,premigration:localStorage.getItem('rts_save_premigration')===${JSON.stringify(raw)},
      protected:saveProtected(),button:!!button,disabled:button?.disabled,fee:row?.textContent.includes('100000000000'),
      hidden:speed.hidden&&getComputedStyle(speed).display==='none',cap:resCap('tech'),overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('old save protected before migration; engine row shows a real unaffordable gate',migrated.version===36&&migrated.premigration&&
    !migrated.protected&&migrated.button&&migrated.disabled&&migrated.fee&&migrated.hidden&&!migrated.overflow,migrated);

  const prepared=await evalJs(`(()=>{for(const tier of [2,3,4,5])S.beastExchange.scrollUsedTiers[tier]=500;
    S.res.tech=100000000000;S.res.medal=30000000;S.page='tech';updateUI();
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="researchScience('sci_astral_engine')");
    return{cap:resCap('tech'),button:!!button,enabled:!!button&&!button.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('conditional high-scroll cap and stock make real research button payable',prepared.cap>=100000000000&&
    prepared.button&&prepared.enabled&&!prepared.overflow,prepared);
  const researched=await evalJs(`(()=>{const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="researchScience('sci_astral_engine')");
    button.click();const saved=JSON.parse(localStorage.getItem('rts_save'));
    const speed=document.querySelector('#battle-speed [data-spd="100"]');
    return{science:scienceUnlocked('sci_astral_engine'),tech:S.res.tech,medal:S.res.medal,
      savedScience:saved.sciences.includes('sci_astral_engine'),savedTech:saved.res.tech,savedMedal:saved.res.medal,
      visible:!speed.hidden&&getComputedStyle(speed).display!=='none'}})()`);
  check('UI research pays 100b/30m once and reveals 100x',researched.science&&researched.tech===0&&researched.medal===0&&
    researched.savedScience&&researched.savedTech===0&&researched.savedMedal===0&&researched.visible,researched);
  const selected=await evalJs(`(()=>{const button=document.querySelector('#battle-speed [data-spd="100"]');button.click();
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return{speed:S.battleSpeed,savedSpeed:saved.battleSpeed,on:button.classList.contains('on')}})()`);
  check('100x selection persists through real button click',selected.speed===100&&selected.savedSpeed===100&&selected.on,selected);
  const battle=await evalJs(`(()=>{const old=window.setTimeout;let delay=null;
    window.setTimeout=(fn,ms)=>{delay=ms;return 0};try{openTraining()}finally{window.setTimeout=old}
    const out={active:S.battleActive,delay,expected:CFG.battleStepDelay/100};exitTraining();return out})()`);
  check('training battle queues actual first step at 100x',battle.active&&Math.abs(battle.delay-battle.expected)<1e-9,battle);
  await send('Page.reload',{ignoreCache:true});
  check('v36 speed save reloads',await ready());
  const restored=await evalJs(`(()=>{const b=document.querySelector('#battle-speed [data-spd="100"]');
    return{speed:S.battleSpeed,science:scienceUnlocked('sci_astral_engine'),visible:!b.hidden&&getComputedStyle(b).display!=='none',
      on:b.classList.contains('on'),saved:JSON.parse(localStorage.getItem('rts_save')).battleSpeed}})()`);
  check('research entitlement and 100x selection survive reload',restored.speed===100&&restored.science&&restored.visible&&restored.on&&restored.saved===100,restored);
  for(const width of [360,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
    const layout=await evalJs(`(()=>{const top=document.getElementById('battle-top');
      return{innerWidth,documentWidth:document.documentElement.scrollWidth,topWidth:top.scrollWidth,topClient:top.clientWidth}})()`);
    check(width+'px speed row does not overflow',layout.documentWidth<=layout.innerWidth+1&&layout.topWidth<=layout.topClient+1,layout);
  }
  check('no uncaught browser errors',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,
    note:'High-scroll used counts and 100b stock are isolated UI fixtures; natural acquisition is unverified.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
}
main().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error?.stack||error);process.exitCode=2}).finally(async()=>{
  try{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({id:++seq,method:'Browser.close'}))}catch(_){}
  await sleep(800);
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  await sleep(500);
  try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300})}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',profile,error?.message||error);if(!process.exitCode)process.exitCode=3}
  process.exit(process.exitCode??0);
});
