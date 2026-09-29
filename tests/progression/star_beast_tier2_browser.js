'use strict';
// Real Edge replay of the paid six-star lineup and ten-star city expansion.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const paid=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p391-steam-military-six-star-paid-save.json'),'utf8');
const tier3Paid=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p393-tier3-city-star10-prebattle-paid-save.json'),'utf8');
const fixedNow=JSON.parse(paid).ts;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'star-beast-tier2-'));
const port=29000+Math.floor(Math.random()*1000);
const url=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port='+port,'--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),exceptions=[];
let ws,id=0,passed=0;
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method))},25000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
}
async function run(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){for(let i=0;i<100;i++){try{if(await run("document.readyState==='complete'&&typeof updateUI==='function'"))return true}catch(_){}await sleep(100)}return false}
function check(name,value){if(!value)throw Error('FAIL '+name);passed++;console.log('PASS '+name)}
async function replay(seed,key){return run(`(()=>{
  let rng=${seed};Math.random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296};
  const timers=new Map();let nextTimer=1;
  window.setTimeout=(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id};
  window.clearTimeout=id=>timers.delete(id);
  const before={army:armyCount(),ring:S.items.sacredRingCore};
  openMaterialDomain('${key}');
  const started=S.battleActive;let steps=0;
  while(S.battleActive&&steps<8000){const first=timers.entries().next().value;if(!first)break;timers.delete(first[0]);first[1].fn();steps++}
  const saved=JSON.parse(localStorage.getItem('rts_save'));
  return{started,active:S.battleActive,steps,result:document.getElementById('battle-result').className,
    loss:before.army-armyCount(),ringGain:S.items.sacredRingCore-before.ring,
    savedRing:saved.items.sacredRingCore,ring:S.items.sacredRingCore};
})()`)}
(async()=>{
  let target;
  for(let i=0;i<100&&!target;i++){
    try{const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=pages.find(p=>p.type==='page'&&p.url.startsWith(url))||pages.find(p=>p.type==='page')}catch(_){}
    if(!target)await sleep(100);
  }
  if(!target?.webSocketDebuggerUrl)throw Error('Edge page unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.id&&pending.has(data.id)){
    const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
    data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
  }if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  check('browser ready',await ready());
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[${fixedNow}]))}static now(){return ${fixedNow}}}})()`});
  await run(`localStorage.setItem('rts_save',${JSON.stringify(paid)})`);
  await send('Page.reload',{ignoreCache:true});
  check('paid save reload ready',await ready());
  const rebuilt=await run(`(()=>{
    const old=JSON.parse(${JSON.stringify(paid)}),groups=[...old.formation.front,...old.formation.mid];
    const front=[0,1,4,3],mid=[2,5,6,7];
    const next={front:front.map(i=>groups[i]),mid:mid.map(i=>groups[i]),back:old.formation.back};
    const before={army:armyCount(),deed:S.res.deed,ring:S.items.sacredRingCore};
    clrForm('expedition');
    for(const [row,units]of Object.entries(next))for(const [slot,u]of units.entries()){
      openFormModal('expedition',row,slot);S._formModalSel=u.type;S._formModalQty=u.count;confirmForm();
    }
    const wrote=save().ok;
    return{wrote,army:armyCount(),deployed:formSoldierCount(),deed:S.res.deed,ring:S.items.sacredRingCore,
      before,front:S.formation.front.map(u=>u.type)};
  })()`);
  check('real formation actions preserve paid inventory and deploy 626',rebuilt.wrote&&rebuilt.army===rebuilt.before.army&&rebuilt.deployed===626&&rebuilt.deed===rebuilt.before.deed&&rebuilt.ring===rebuilt.before.ring&&rebuilt.front[2]==='electro_trooper');
  const checkpoint=await run("localStorage.getItem('rts_save')");
  const tier2Injection=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('rts_save',${JSON.stringify(checkpoint)})`});
  await send('Page.reload',{ignoreCache:true});
  check('new formation persists after reload',await ready()&&await run("S.formation.front[2].type==='electro_trooper'&&formSoldierCount()===626&&S.steamMilitaryStars===6"));
  const rows=[];
  for(let seed=1;seed<=16;seed++){
    if(seed>1){
      await send('Page.reload',{ignoreCache:true});
      if(!await ready())throw Error('seed '+seed+' reload failed');
    }
    rows.push(await replay(seed,'starBeast2'));
  }
  check('real browser battle wins tier 2 in 16 fixed streams and saves each reward',rows.every(battle=>battle.started&&!battle.active&&battle.steps<8000&&battle.result==='win'&&battle.ringGain===20&&battle.savedRing===battle.ring&&battle.loss>=0));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:tier2Injection.identifier});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('rts_save',${JSON.stringify(tier3Paid)})`});
  const tier3Rows=[];
  for(let seed=1;seed<=16;seed++){
    await send('Page.reload',{ignoreCache:true});
    if(!await ready())throw Error('tier 3 seed '+seed+' reload failed');
    if(!await run('S.steamMilitaryStars===10&&formSoldierCount()===626'))throw Error('tier 3 paid checkpoint invalid '+JSON.stringify(await run('({stars:S.steamMilitaryStars,deployed:formSoldierCount(),protected:saveProtected(),city:S.settlements.city})')));
    tier3Rows.push(await replay(seed,'starBeast3'));
  }
  check('paid city expansion and ten stars win tier 3 in 16 browser streams',tier3Rows.every(battle=>battle.started&&!battle.active&&battle.steps<8000&&battle.result==='win'&&battle.ringGain===30&&battle.savedRing===battle.ring&&battle.loss>=0));
  check('zero uncaught browser exceptions',exceptions.length===0);
  console.log(`star beast paid route browser: ${passed}/${passed}`);
})().catch(error=>{console.error('BROWSER_FAIL',error.stack||error);process.exitCode=1}).finally(async()=>{
  try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(200);
});
