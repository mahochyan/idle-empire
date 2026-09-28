'use strict';
// Real Edge/CDP smoke for the source-priced special market and domain cleanser UI.
// Research, stock and currency are injected to exercise presentation/action wiring;
// paid reachability is covered by probe-gold-market-paid-p289.js.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER');process.exit(2)}
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'domain-cleanser-browser-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../..','index.html')).href;
const browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),checks=[],exceptions=[];let ws,nextId=0,spawnError;
browser.on('error',error=>{spawnError=error});
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail})}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})}
async function evalJs(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
async function ready(){for(let i=0;i<100;i++){try{if(await evalJs("document.readyState==='complete'&&Array.isArray(window.APP_SCRIPTS)&&typeof buyMarketSpecial==='function'"))return true}catch(_){}await sleep(100)}return false}
async function optionalShot(name,action){
  if(!process.env.P289_SCREENSHOT_DIR)return;
  if(action){
    await evalJs(`(()=>{const main=document.getElementById('main'),target=[...main.querySelectorAll('button')].find(b=>b.getAttribute('onclick')===${JSON.stringify(action)});if(target)main.scrollTop+=target.getBoundingClientRect().top-main.getBoundingClientRect().top-main.clientHeight/2;window.scrollTo(0,0);return !!target})()`);
    await sleep(120);
  }
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync(process.env.P289_SCREENSHOT_DIR,{recursive:true});
  fs.writeFileSync(path.join(process.env.P289_SCREENSHOT_DIR,name+'.png'),Buffer.from(shot.data,'base64'));
}

(async()=>{
  const activePort=path.join(profile,'DevToolsActivePort');let port;
  for(let i=0;i<80;i++){await sleep(100);if(spawnError)throw spawnError;if(!fs.existsSync(activePort))continue;const candidate=Number(fs.readFileSync(activePort,'utf8').split(/\r?\n/,1)[0]);if(Number.isInteger(candidate)&&candidate>0&&candidate<=65535){port=candidate;break}}
  if(!port)throw Error('NO_OWN_CDP_PORT');
  let targets;
  for(let i=0;i<40;i++){await sleep(100);try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.some(t=>t.type==='page'))break}catch(_){}}
  const page=targets?.find(t=>t.type==='page'&&t.url===pageUrl)||targets?.find(t=>t.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.id&&pending.has(data.id)){const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result)}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('page and scripts load',await ready());
  const market=await evalJs(`(()=>{
    S.sciences=['sci_copper','sci_currency','sci_gold','sci_coin','sci_electric_age'];
    S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};
    S.marketSpecial.offers={sacredBlood:1,domainCleanser:1,emberElixir:0,aegisElixir:0};S.marketSpecial.cycles=1;S.marketSpecial.clockSec=1200;
    S.res.goldCoin=9999;S.items.sacredBlood=2;S.killValues.godSlaughter=5000;
    save();S.page='build';S._buildTab='economy';updateUI();
    const text=document.getElementById('main').textContent;
    const buy=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="buyMarketSpecialFromUI('sacredBlood')");
    return{shown:text.includes('圣域货架')&&text.includes('圣兽血剂')&&text.includes('镇域净化剂'),buyEnabled:!!buy&&!buy.disabled}
  })()`);
  check('market offers and price render at 360px',market.shown&&market.buyEnabled,market);
  await optionalShot('p289-market-360',"buyMarketSpecialFromUI('sacredBlood')");
  const bought=await evalJs(`(()=>{
    const button=code=>[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')===code);
    button("buyMarketSpecialFromUI('sacredBlood')").click();
    const cleanseButton=button("buyMarketSpecialFromUI('domainCleanser')");
    const enabled=!!cleanseButton&&!cleanseButton.disabled;
    cleanseButton?.click();
    return{enabled,goldCoin:S.res.goldCoin,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,offers:S.marketSpecial.offers}
  })()`);
  check('actual market buttons pay both legs once',bought.enabled&&bought.goldCoin===0&&bought.blood===0&&bought.cleanser===1&&bought.offers.sacredBlood===0&&bought.offers.domainCleanser===0,bought);
  const used=await evalJs(`(()=>{
    S.page='fight';updateUI();
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="useDomainCleanserFromUI('medal')");
    const enabled=!!button&&!button.disabled;
    const bloodPreview=!!button?.closest('.card')?.textContent.includes('圣兽血剂 ×3');
    const emberPreview=!!button?.closest('.card')?.textContent.includes('炽翼战剂 3%概率');
    const aegisPreview=!!button?.closest('.card')?.textContent.includes('圣盾秘剂 1.5%概率');
    button?.click();
    return{enabled,bloodPreview,emberPreview,aegisPreview,alert:S.killValues.godSlaughter,cleanser:S.items.domainCleanser,enemy:materialDomainEncounter('medal').units.slaughter_god[0]}
  })()`);
  check('core card previews blood and both rare elixirs while cleanser changes next battle',used.enabled&&used.bloodPreview&&used.emberPreview&&used.aegisPreview&&used.alert===4900&&used.cleanser===0&&used.enemy===2747,used);
  await sleep(2100); // Wait for the shared toast to disappear before inspecting the fight layout.
  await optionalShot('p289-domain-360',"useDomainCleanserFromUI('medal')");
  await send('Page.reload',{ignoreCache:true});
  check('reload completes',await ready());
  const persisted=await evalJs("(()=>({protected:saveProtected(),alert:S.killValues.godSlaughter,cleanser:S.items.domainCleanser,goldCoin:S.res.goldCoin,blood:S.items.sacredBlood}))()");
  check('paid market and cleanser state survives reload',!persisted.protected&&persisted.alert===4900&&persisted.cleanser===0&&persisted.goldCoin===0&&persisted.blood===0,persisted);
  const alloyEntry=await evalJs(`(()=>{
    const original=S.sciences;S.sciences=['sci_alloy_age','sci_god_domain'];
    S.pool.alloy_special=10;S.items.sacredBlood=1;S.page='fight';S._fightTab='expedition';updateUI();
    const card=[...document.querySelectorAll('#main .card')].find(c=>c.textContent.includes('圣兽血脉'));
    const visible=!!card&&!!card.querySelector('#bloodline-unit')&&!!card.querySelector('button[onclick="useSacredBloodFromUI()"]');
    S.sciences=original;return{visible};
  })()`);
  check('bloodline use entry exists at alloy ruin before electric age',alloyEntry.visible,alloyEntry);
  const bloodline=await evalJs(`(()=>{
    S.pool.alloy_special=10;S.items.sacredBlood=1;save();S.page='fight';S._fightTab='expedition';updateUI();
    const select=document.getElementById('bloodline-unit'),count=document.getElementById('bloodline-count');
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==='useSacredBloodFromUI()');
    const shown=!!select&&!!count&&!!button&&!button.disabled&&button.closest('.card')?.textContent.includes('圣兽血脉');
    if(select)select.value='alloy_special';if(count)count.value='1';button?.click();
    return{shown,stock:S.items.sacredBlood,uses:S.bloodline.alloy_special,hp:battleVitals('alloy_special',10,true).hp}
  })()`);
  check('bloodline card spends one potion and improves owned unit vitals',bloodline.shown&&bloodline.stock===0&&bloodline.uses===1&&Math.abs(bloodline.hp-55.55)<1e-8,bloodline);
  await sleep(2100);
  await optionalShot('p292-bloodline-360','useSacredBloodFromUI()');
  await send('Page.reload',{ignoreCache:true});
  check('bloodline reload completes',await ready());
  const bloodlineSaved=await evalJs("(()=>({protected:saveProtected(),stock:S.items.sacredBlood,uses:S.bloodline.alloy_special,hp:battleVitals('alloy_special',10,true).hp}))()");
  check('bloodline use persists after reload',!bloodlineSaved.protected&&bloodlineSaved.stock===0&&bloodlineSaved.uses===1&&Math.abs(bloodlineSaved.hp-55.55)<1e-8,bloodlineSaved);
  const emberMarket=await evalJs(`(()=>{
    S.marketSpecial.offers.emberElixir=1;S.items.sacredBlood=20;save();S.page='build';S._buildTab='economy';updateUI();
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="buyMarketSpecialFromUI('emberElixir')");
    const shown=!!button&&!button.disabled&&button.textContent.includes('炽翼战剂');button?.click();
    return{shown,blood:S.items.sacredBlood,ember:S.items.emberElixir,offers:S.marketSpecial.offers.emberElixir}
  })()`);
  check('ember elixir market button pays twenty blood once',emberMarket.shown&&emberMarket.blood===0&&emberMarket.ember===1&&emberMarket.offers===0,emberMarket);
  const emberUse=await evalJs(`(()=>{
    S.page='fight';S._fightTab='expedition';updateUI();
    const select=document.getElementById('ember-unit'),count=document.getElementById('ember-count');
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==='useEmberElixirFromUI()');
    const shown=!!select&&!!count&&!!button&&!button.disabled;
    if(select)select.value='alloy_special';if(count)count.value='1';
    const before=weaponAttack('alloy_special');button?.click();
    return{shown,stock:S.items.emberElixir,uses:S.attackInfusions.alloy_special,before,after:weaponAttack('alloy_special'),base:CFG.units.alloy_special.atk}
  })()`);
  check('ember elixir use button spends once and raises attack',emberUse.shown&&emberUse.stock===0&&emberUse.uses===1&&Math.abs(emberUse.after-emberUse.before-emberUse.base*0.1)<1e-8,emberUse);
  await sleep(2100);
  await optionalShot('p294-ember-360','useEmberElixirFromUI()');
  await send('Page.reload',{ignoreCache:true});
  check('ember elixir reload completes',await ready());
  const emberSaved=await evalJs("(()=>({protected:saveProtected(),stock:S.items.emberElixir,uses:S.attackInfusions.alloy_special,attack:weaponAttack('alloy_special')}))()");
  check('ember elixir purchase and use persist',!emberSaved.protected&&emberSaved.stock===0&&emberSaved.uses===1&&Math.abs(emberSaved.attack-emberUse.after)<1e-8,emberSaved);
  const aegisMarket=await evalJs(`(()=>{
    S.marketSpecial.offers.aegisElixir=1;S.items.emberElixir=3;save();S.page='build';S._buildTab='economy';updateUI();
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==="buyMarketSpecialFromUI('aegisElixir')");
    const shown=!!button&&!button.disabled&&button.textContent.includes('圣盾秘剂');button?.click();
    return{shown,ember:S.items.emberElixir,aegis:S.items.aegisElixir,offers:S.marketSpecial.offers.aegisElixir}
  })()`);
  check('aegis elixir market button pays three ember once',aegisMarket.shown&&aegisMarket.ember===0&&aegisMarket.aegis===1&&aegisMarket.offers===0,aegisMarket);
  const aegisUse=await evalJs(`(()=>{
    S.page='fight';S._fightTab='expedition';updateUI();
    const select=document.getElementById('aegis-unit'),count=document.getElementById('aegis-count');
    const button=[...document.querySelectorAll('#main button')].find(b=>b.getAttribute('onclick')==='useAegisElixirFromUI()');
    const shown=!!select&&!!count&&!!button&&!button.disabled;
    if(select)select.value='alloy_special';if(count)count.value='1';
    const before={atk:weaponAttack('alloy_special'),def:weaponDefense('alloy_special'),hp:battleVitals('alloy_special',10,true).hp};button?.click();
    return{shown,stock:S.items.aegisElixir,uses:S.aegisInfusions.alloy_special,before,
      after:{atk:weaponAttack('alloy_special'),def:weaponDefense('alloy_special'),hp:battleVitals('alloy_special',10,true).hp},
      base:{atk:CFG.units.alloy_special.atk,hp:CFG.units.alloy_special.hpPerSoldier}}
  })()`);
  check('aegis elixir use button spends once and raises attack, defense, life',aegisUse.shown&&aegisUse.stock===0&&aegisUse.uses===1&&
    Math.abs(aegisUse.after.atk-aegisUse.before.atk-aegisUse.base.atk*0.05)<1e-8&&aegisUse.after.def-aegisUse.before.def===1&&
    Math.abs(aegisUse.after.hp-aegisUse.before.hp-aegisUse.base.hp*0.5)<1e-8,aegisUse);
  await sleep(2100);
  await optionalShot('p295-aegis-360','useAegisElixirFromUI()');
  await send('Page.reload',{ignoreCache:true});
  check('aegis elixir reload completes',await ready());
  const aegisSaved=await evalJs("(()=>({protected:saveProtected(),stock:S.items.aegisElixir,uses:S.aegisInfusions.alloy_special,attack:weaponAttack('alloy_special'),defense:weaponDefense('alloy_special'),hp:battleVitals('alloy_special',10,true).hp}))()");
  check('aegis elixir purchase and use persist',!aegisSaved.protected&&aegisSaved.stock===0&&aegisSaved.uses===1&&
    Math.abs(aegisSaved.attack-aegisUse.after.atk)<1e-8&&aegisSaved.defense===aegisUse.after.def&&Math.abs(aegisSaved.hp-aegisUse.after.hp)<1e-8,aegisSaved);
  check('zero uncaught browser exceptions',exceptions.length===0,exceptions.slice(0,3));
  console.log(JSON.stringify({checks,exceptions,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,note:'Injected research/currency/stock verify UI wiring, not natural reachability.'},null,2));
  process.exitCode=checks.some(x=>!x.ok)?1:0;
})().catch(error=>{console.error('BROWSER_SMOKE_ERROR',error&&error.stack||error);process.exitCode=2}).finally(async()=>{
  try{if(ws?.readyState===1)ws.send(JSON.stringify({id:++nextId,method:'Browser.close'}))}catch(_){}
  await sleep(800);try{ws?.close()}catch(_){}
  if(browser.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  await sleep(500);
  try{if(path.resolve(profile).startsWith(tempRoot+path.sep)&&fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300})}catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message)}
  process.exit(process.exitCode??0);
});
