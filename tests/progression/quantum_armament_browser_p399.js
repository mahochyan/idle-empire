'use strict';
// Real Edge/CDP smoke in a unique temporary profile. The conditional stock
// injected after a genuine v33 load is not evidence of natural 5b reachability.
const {spawn,spawnSync}=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'../..');
const raw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p397-quantum-stage100-paid-save.json'),'utf8');
const rawHash=crypto.createHash('sha256').update(raw).digest('hex');
if(rawHash!=='ba8602a98d0d927c96cabb2d2074807c9b0ec46183aae4534e5486055c6125c4')throw Error('P397 source changed');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Microsoft Edge unavailable');process.exit(2)}
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'quantum-armament-p399-'));
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
    try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof upgradeQuantumArmament==='function'"))return true}catch(_){}
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
  check('fresh v35 app loads',await ready());
  const fresh=await evalJs(`(()=>{S.page='tech';updateUI();save();const main=document.getElementById('main');
    return{version:JSON.parse(localStorage.getItem('rts_save')).v,lockedCard:main.textContent.includes('星界圣痕兵装'),
      rankCard:[...main.querySelectorAll('h3')].some(h=>h.textContent.includes('星界圣痕兵装')),
      order:APP_SCRIPTS.join(','),overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('fresh tech and upgrade cards are hidden with no 360px overflow',fresh.version===34&&!fresh.lockedCard&&!fresh.rankCard&&!fresh.overflow&&
    fresh.order==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js',fresh);

  await evalJs(`localStorage.setItem('rts_save',${JSON.stringify(raw)});'seeded'`);
  await send('Page.reload',{ignoreCache:true});
  check('paid v33 save reloads through v35 migration',await ready());
  const migrated=await evalJs(`(()=>{S.page='tech';updateUI();const main=document.getElementById('main');
    const saved=JSON.parse(localStorage.getItem('rts_save'));
    return{version:saved.v,premigration:localStorage.getItem('rts_save_premigration'),protected:saveProtected(),
      scienceButton:[...main.querySelectorAll('button')].some(b=>b.getAttribute('onclick')==="researchScience('sci_astral_armament')"),
      armamentCard:[...main.querySelectorAll('h3')].some(h=>h.textContent.includes('星界圣痕兵装'))}})()`);
  check('v33 original survives migration and researched card stays hidden',migrated.version===34&&migrated.premigration===raw&&!migrated.protected&&migrated.scienceButton&&!migrated.armamentCard,
    {...migrated,premigration:migrated.premigration===raw?'exact':'mismatch'});

  const before=await evalJs(`(()=>{S.eraStorage.quantumKnowledge=5;S.beastExchange.scrollUsed=158;
    S.res.tech=5000000000;S.res.medal=5000000;S.res.steel=Math.max(S.res.steel,16000);
    S.items.starOriginStone=Math.max(S.items.starOriginStone,20);S.page='tech';updateUI();
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="researchScience('sci_astral_armament')");
    return{cap:resCap('tech'),tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,stone:S.items.starOriginStone,
      visible:!!button,enabled:!!button&&!button.disabled,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('conditional 5b stock exposes enabled research button',before.cap>=5000000000&&before.visible&&before.enabled&&!before.overflow,before);
  const researched=await evalJs(`(()=>{const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="researchScience('sci_astral_armament')");button.click();
    const main=document.getElementById('main'),saved=JSON.parse(localStorage.getItem('rts_save'));
    return{science:scienceUnlocked('sci_astral_armament'),tech:S.res.tech,medal:S.res.medal,
      savedScience:saved.sciences.includes('sci_astral_armament'),savedTech:saved.res.tech,savedMedal:saved.res.medal,
      card:[...main.querySelectorAll('h3')].some(h=>h.textContent.includes('星界圣痕兵装'))}})()`);
  check('real research button deducts once and reveals upgrade card',researched.science&&researched.tech===0&&researched.medal===0&&
    researched.savedScience&&researched.savedTech===0&&researched.savedMedal===0&&researched.card,researched);
  const upgraded=await evalJs(`(()=>{for(const stat of ['atk','hp']){
      const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="upgradeQuantumArmament('star_trooper','"+stat+"')");
      if(!button||button.disabled)return{buttonMissing:stat};button.click();
    }const saved=JSON.parse(localStorage.getItem('rts_save'));
    return{atk:S.quantumArmament.star_trooper.atk,hp:S.quantumArmament.star_trooper.hp,
      savedAtk:saved.quantumArmament.star_trooper.atk,savedHp:saved.quantumArmament.star_trooper.hp,
      steel:S.res.steel,stone:S.items.starOriginStone,overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
  check('real two upgrade buttons pay steel and origin stones and persist ranks',upgraded.atk===1&&upgraded.hp===1&&
    upgraded.savedAtk===1&&upgraded.savedHp===1&&upgraded.steel===before.steel-16000&&upgraded.stone===before.stone-20&&!upgraded.overflow,upgraded);
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  const narrow=await evalJs(`(()=>{S.page='tech';updateUI();const main=document.getElementById('main');
    return{innerWidth,docWidth:document.documentElement.scrollWidth,mainClient:main.clientWidth,mainScroll:main.scrollWidth,
      card:[...main.querySelectorAll('h3')].some(h=>h.textContent.includes('星界圣痕兵装'))}})()`);
  check('320px technology page has no horizontal overflow',narrow.card&&narrow.docWidth<=narrow.innerWidth+1&&narrow.mainScroll<=narrow.mainClient+1,narrow);
  check('no uncaught browser exceptions or console errors',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,
    note:'Research stock/capacity were injected into an isolated Edge profile; this test does not prove natural reachability.'},null,2));
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
