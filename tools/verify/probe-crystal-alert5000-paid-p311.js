'use strict';
// Restore the actual P310 win losses, then compare paid direct battle and paid market cleanse at alert 5000.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p310-crystal-alert4900-win-save.json',rosterSource='p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),rosterRaw=fs.readFileSync(path.join(data,rosterSource),'utf8');
assert.equal(sha(raw),'e29f79e1dfc160418b05a7465bbe08f0c2c63b9d2728a95ce07fa8af8bd5f21a');
assert.equal(sha(rosterRaw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const original=JSON.parse(raw),target=JSON.parse(rosterRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${original.ts}+(S.tick-${original.tick})*1000}};
  globalThis.__productionRng=311;Math.random=()=>{let x=__productionRng;x^=x<<13;x^=x>>>17;x^=x<<5;__productionRng=x>>>0;return __productionRng/4294967296};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){
    const before=Object.fromEntries(trainingCostKeys(cost).map(key=>[key,S.res[key]]));
    const result=__originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const charged=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(charged-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+charged;
    }
    return result;
  };`);
const snap=()=>run("({tick:S.tick,alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,tech:S.res.tech,food:S.res.food,stone:S.res.stone,coal:S.res.coal,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})");
const initial=snap();
assert.equal(initial.alert,5000);assert.equal(initial.army,555);assert.equal(initial.deployed,510);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',resource='training'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=result.n;allocationSeconds[resource]=(allocationSeconds[resource]||0)+result.n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000,'false',resource).done,resource+' fill timeout');
}
function fillProcessed(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  let cycles=0;
  while(val(resource)<targetValue&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetValue}`,7000,stop,resource);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){
  if(val(resource)>=targetValue)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue);
}
run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
const losses={},paidTraining={};
for(const [unit,wanted] of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000,'false','training').done,unit+' training');
}
for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' form');
});
const recovered=snap();assert.equal(recovered.army,671);assert.equal(recovered.deployed,626);
assert.equal(recovered.alert,5000);assert.equal(recovered.crystal,initial.crystal);
assert.equal(recovered.medal,initial.medal);assert.equal(recovered.cleanser,initial.cleanser);
assert.equal(assertAmount(losses),116);assert.ok(minFood>0);
function assertAmount(object){return Object.values(object).reduce((a,b)=>a+b,0)}
const actualTraining=run('({...__actualTraining})');
for(const [key,amount] of Object.entries(paidTraining))assert.ok(Math.abs(amount-actualTraining[key])<1e-6,key+' actual training debit');
assert.equal(run('save().ok'),true);
const restoredRaw=e.store.get('rts_save'),restoredName='p311-crystal-alert5000-recovered-save.json';
const reload=environment({rts_save:restoredRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),626);assert.equal(reload.run('S.killValues.godRevival'),5000);
function battle(seed,alert=5000,captureSave=false,beforeBattle=null){
  const trial=environment({rts_save:restoredRaw}),r=trial.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(restoredRaw).ts}+(S.tick-${recovered.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  if(alert!==5000)r(`S.killValues.godRevival=${alert}`); // conditional control only; no trial is saved
  const preparation=beforeBattle?beforeBattle(trial,r):null;
  const effectiveAlert=r('S.killValues.godRevival');
  r("openMaterialDomain('godCrystal')");assert.equal(r('S.battleActive'),true);
  const enemy=r("({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})");
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r("({alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood,enemyHp:B.enemyUnits[0].hp})");
  r('exitBattle()');
  return{seed,alert:effectiveAlert,enemy,callbacks,result,after,preparation,...(captureSave?{saveText:trial.store.get('rts_save')}:{} )};
}
const control=battle(89,4900),trials=[];
assert.equal(control.result,'win');
for(let seed=1;seed<=128;seed++)trials.push(battle(seed));
const wins=trials.filter(x=>x.result==='win');
assert.equal(wins.length,0);
const directLoss=battle(1,5000,true);
assert.equal(directLoss.result,'lose');
assert.equal(directLoss.after.army,45);
assert.equal(directLoss.after.deployed,0);
assert.equal(directLoss.after.crystal,recovered.crystal);
assert.equal(directLoss.after.medal,recovered.medal);
assert.ok(typeof directLoss.saveText==='string');
const directSave=JSON.parse(directLoss.saveText),directName='p311-crystal-alert5000-direct-loss-save.json';
assert.equal(directSave.killValues.godRevival,5000);
const directReload=environment({rts_save:directLoss.saveText});
assert.equal(directReload.run('loadSaveAndApply().status'),'ok');
assert.equal(directReload.run('armyCount()'),45);
function buyCleanserAndUse(trial,r){
  r('globalThis.__rng=291');
  const before=r("({blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,alert:S.killValues.godRevival,offers:S.marketSpecial.offers.domainCleanser,cycles:S.marketSpecial.cycles,food:S.res.food,coal:S.res.coal,steel:S.res.steel})");
  let marketSeconds=0,refreshes=0,marketMinFood=before.food;
  while(r('S.marketSpecial.offers.domainCleanser')<1&&marketSeconds<300000){
    const moved=r('offlineAdvanceSec(1200,1)');assert.equal(moved.elapsed,1200);
    marketSeconds+=1200;refreshes++;
    marketMinFood=Math.min(marketMinFood,r('S.res.food'));
    assert.ok(marketMinFood>0,'market food depleted');
  }
  assert.ok(r('S.marketSpecial.offers.domainCleanser')>=1,'paid market offer');
  const bought=r("buyMarketSpecial('domainCleanser')");assert.equal(bought?.ok,true,JSON.stringify(bought));
  const cleansed=r("useDomainCleanser('godCrystal')");assert.equal(cleansed?.ok,true,JSON.stringify(cleansed));
  assert.equal(cleansed.alert,4900);
  const after=r("({blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,alert:S.killValues.godRevival,offers:S.marketSpecial.offers.domainCleanser,cycles:S.marketSpecial.cycles,food:S.res.food,coal:S.res.coal,steel:S.res.steel})");
  assert.equal(after.blood,before.blood-3);assert.equal(after.cleanser,before.cleanser);
  r('globalThis.__rng=89');
  return{marketSeconds,refreshes,marketMinFood,before,bought,cleansed,after};
}
const marketWin=battle(89,5000,true,buyCleanserAndUse);
assert.equal(marketWin.alert,4900);
assert.equal(marketWin.result,'win');
assert.equal(marketWin.after.alert,5000);
assert.equal(marketWin.after.crystal,recovered.crystal+58);
assert.equal(marketWin.after.medal,recovered.medal+2352);
assert.equal(marketWin.after.blood,recovered.blood);
assert.ok(typeof marketWin.saveText==='string');
const marketSave=JSON.parse(marketWin.saveText),marketName='p311-crystal-alert5000-cleanse-win-save.json';
assert.equal(marketSave.items.domainCleanser,0);
const marketReload=environment({rts_save:marketWin.saveText});
assert.equal(marketReload.run('loadSaveAndApply().status'),'ok');
assert.equal(marketReload.run('armyCount()'),marketWin.after.army);
assert.equal(marketReload.run('formSoldierCount()'),marketWin.after.deployed);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,rosterSource),'utf8')),sha(rosterRaw));
fs.writeFileSync(path.join(data,restoredName),restoredRaw);
fs.writeFileSync(path.join(data,directName),directLoss.saveText);
fs.writeFileSync(path.join(data,marketName),marketWin.saveText);
const report={batch:'P311',kind:'paid replenishment from P310, direct 5000 loss versus paid market cleanse and 4900 win',
  unit:'resource units, soldier counts, simulated online seconds; market wait uses ratio-1 offlineAdvanceSec(1200,1); 128 fixed seeds do not estimate player odds',
  source,sourceSha256:sha(raw),rosterSource,rosterSourceSha256:sha(rosterRaw),productionSeed:311,initial,losses,paidTraining,actualTraining,onlineSeconds,allocationSeconds,minFood,recovered,
  restoredSave:restoredName,restoredSaveSha256:sha(restoredRaw),control,trials,winSeeds:wins.map(x=>x.seed),
  directLoss:{seed:directLoss.seed,enemy:directLoss.enemy,after:directLoss.after,callbacks:directLoss.callbacks,save:directName,saveSha256:sha(directLoss.saveText)},
  marketWin:{seed:marketWin.seed,enemy:marketWin.enemy,after:marketWin.after,callbacks:marketWin.callbacks,preparation:marketWin.preparation,save:marketName,saveSha256:sha(marketWin.saveText)},
  limitations:['Seed 89 at 4900 without cleanse is a condition-only battle control.',
    'The 128 direct trials branch independently from the paid full roster; only the selected direct loss is saved.',
    'Market seed 291 and battle seed 89 were chosen fixed streams, not natural continuous randomness.',
    'Ratio-1 offline market simulation seconds are not wall-clock online play time or a median purchase wait.']};
const out='p311-crystal-alert5000-paid-comparison.json';
fs.writeFileSync(path.join(data,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({initial,losses,paidTraining,actualTraining,onlineSeconds,minFood,recovered,control,
  trialCount:trials.length,wins:wins.length,
  closestLosses:trials.filter(x=>x.result!=='win').sort((a,b)=>a.after.enemyHp-b.after.enemyHp).slice(0,5).map(x=>({seed:x.seed,enemyHp:x.after.enemyHp,army:x.after.army})),
  restoredSave:restoredName,restoredSaveSha256:report.restoredSaveSha256,directLoss:report.directLoss,marketWin:report.marketWin,report:out},null,2));
