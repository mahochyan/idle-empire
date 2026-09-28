'use strict';
// Paid P285 state, real worker actions and per-second economic engine. Market RNG is fixed;
// this is a production-only trajectory without combat, births or player operation time.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha256=crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha256,'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
run('Date.now=()=>1790496000000');
// Retain the paid 100 food workers, redirect steel workers to a small self-supporting gold chain.
for(const [key,amount] of [['steel',0],['stone',4],['coal',2],['gold',2],['goldCoin',2]]){
  const action=JSON.parse(run(`JSON.stringify(setPopAlloc('${key}',${amount}))`));
  assert.equal(action.ok,true,`${key} assignment: ${JSON.stringify(action)}`);
}
const initial=JSON.parse(run("JSON.stringify({food:S.res.food,stone:S.res.stone,coal:S.res.coal,gold:S.res.gold,goldCoin:S.res.goldCoin,pop:popCurrent(),goldCap:resCap('gold'),goldCoinCap:resCap('goldCoin'),rates:{stone:prodRate('stone'),coal:prodRate('coal'),gold:prodRate('gold'),goldCoin:prodRate('goldCoin')},upkeep:totalUpkeep()})"));
assert.equal(initial.goldCoinCap,10000);
run(`globalThis.__marketSeed=289;Math.random=()=>{let x=__marketSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__marketSeed=x>>>0;return __marketSeed/4294967296}`);
let elapsed=0,boughtBlood=0,boughtCleanser=0,firstBloodSec=null,minFood=initial.food,minStone=initial.stone,minCoal=initial.coal;
const purchases=[];
// At each refresh boundary, buy at most one 9999-coin blood dose, then the cleanser if offered.
// This isolates source-like item availability and actual production/payment. It does not credit a win.
for(let cycle=0;cycle<72&&boughtCleanser===0;cycle++){
  const advance=JSON.parse(run('JSON.stringify(offlineAdvanceSec(1200,1))'));
  assert.equal(advance.elapsed,1200,'food stopped the production-only trajectory');
  elapsed+=advance.elapsed;
  const offers=JSON.parse(run('JSON.stringify(S.marketSpecial.offers)'));
  if(offers.sacredBlood>0&&run('S.res.goldCoin')>=9999&&boughtBlood<3){
    const action=JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))"));
    assert.equal(action.ok,true);
    boughtBlood++;
    if(firstBloodSec===null)firstBloodSec=elapsed;
    purchases.push({atSec:elapsed,item:'sacredBlood',remainingGoldCoin:run('S.res.goldCoin')});
  }
  if(offers.domainCleanser>0&&run('S.items.sacredBlood')>=3){
    const action=JSON.parse(run("JSON.stringify(buyMarketSpecial('domainCleanser'))"));
    assert.equal(action.ok,true);
    boughtCleanser++;
    purchases.push({atSec:elapsed,item:'domainCleanser',remainingBlood:run('S.items.sacredBlood')});
  }
  minFood=Math.min(minFood,run('S.res.food'));
  minStone=Math.min(minStone,run('S.res.stone'));
  minCoal=Math.min(minCoal,run('S.res.coal'));
  assert(run('S.res.food')>=0&&run('S.res.stone')>=0&&run('S.res.coal')>=0);
  assert(run('S.res.goldCoin')<=10000+1e-9);
}
const terminal=JSON.parse(run("JSON.stringify({food:S.res.food,stone:S.res.stone,coal:S.res.coal,gold:S.res.gold,goldCoin:S.res.goldCoin,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,market:S.marketSpecial,alert:S.killValues.godSlaughter})"));
let battle=null;
if(boughtCleanser===1){
  const used=JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))"));
  assert.equal(used.ok,true);
  assert.equal(used.alert,4900);
  const preBattle=JSON.parse(run("JSON.stringify({core:S.items.godCore,soldiers:formSoldierCount(),alert:S.killValues.godSlaughter})"));
  run(`globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__battleSeed=1;Math.random=()=>{let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296};`);
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  battle={preBattle,callbacks,result:run("document.getElementById('battle-result').className"),
    after:JSON.parse(run("JSON.stringify({core:S.items.godCore,soldiers:formSoldierCount(),alert:S.killValues.godSlaughter,cleanser:S.items.domainCleanser})"))};
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.godCore'),battle.after.core);
  assert.equal(reload.run('S.killValues.godSlaughter'),battle.after.alert);
}
const terminalSavePath='docs/codex/reports/data/p289-gold-market-core-win-paid-save.json';
const terminalSave=e.store.get('rts_save');
const terminalSaveSha256=crypto.createHash('sha256').update(terminalSave||'').digest('hex');
const report={batch:'P289',kind:'source-weighted market draws, real paid-state worker reallocations and ratio-1 per-second production; no births/garrison or operation time; one real battle after paid use',source,sourceSha256:sha256,initial,elapsedSec:elapsed,elapsedHours:elapsed/3600,firstBloodSec,boughtBlood,boughtCleanser,purchases,min:{food:minFood,stone:minStone,coal:minCoal},terminal,battle,terminalSavePath,terminalSaveSha256};
if(boughtCleanser===1&&battle?.result==='win'){
  fs.writeFileSync(path.join(root,terminalSavePath),terminalSave);
  fs.writeFileSync(path.join(root,'docs/codex/reports/data/p289-gold-market-paid-report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));
if(boughtCleanser!==1||battle?.result!=='win')process.exitCode=1;
