// P350: real paid first battle, one four-hour offline queue, and the full
// online preparation plus post-login repair bill for each player action policy.
function runScenario(policy){
'use strict';
// The first battle and restore helpers are frozen from P349. They call the
// shipped game functions inside the existing deterministic VM harness.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const codeHashes={
  config:sha(fs.readFileSync(path.join(root,'config.js'))),
  math:sha(fs.readFileSync(path.join(root,'math.js')))
};
assert.equal(codeHashes.config,'8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675','P348 config baseline');
assert.equal(codeHashes.math,'dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95','P348 math baseline');
const sourceFile=data+'p342-hide-paid-seed1-save.json';
const sourceText=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(sourceText),'ca734f8b6dfa88dc22a0ec7a7367800fb4422a27b55c594444e08b27fc6806e8');
const prior=JSON.parse(fs.readFileSync(path.join(root,data+'p342-hide-paid-seed1.json'),'utf8'));
assert.equal(prior.saveSha256,sha(sourceText));
assert.equal(prior.final.rng,1696915948);
const origin=JSON.parse(sourceText);
const rosterFile=data+'p329-soul-refreshed-save.json';
const rosterText=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterText),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const formation=JSON.parse(rosterText).formation,targetByType={};
for(const row of Object.values(formation))for(const u of row)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);
const env=environment({rts_save:sourceText}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__clockMs=${origin.ts};globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return __clockMs}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__phase='online';globalThis.__rngDraws={online:0,offline:0,combat:0,manual:0};
  globalThis.__rng=${prior.final.rng};Math.random=()=>{__rngDraws[__phase]++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};globalThis.__trainingByPhase={online:{},offline:{}};
  const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;
      const ledger=__trainingByPhase[__phase]||(__trainingByPhase[__phase]={});
      ledger[key]=(ledger[key]||0)+paid}return result};`);
run(`globalThis.__marketEvents=[];globalThis.__marketPurchases=[];globalThis.__marketUpgrades=[];
  const __originalRollBeastHeartOffers=rollBeastHeartOffers;
  rollBeastHeartOffers=function(){__marketEvents.push({tick:S.tick,timeMs:Date.now(),kind:'offer-roll',phase:__phase});
    return __originalRollBeastHeartOffers()};
  globalThis.__claimOffers=()=>{
    const buy=(kind,key,fn)=>{const before={level:S.beastExchange.level,progress:S.beastExchange.progress,bone:S.res.bone,hide:S.res.hide};
      const action=fn();if(!action?.ok)throw Error('market purchase failed '+kind+':'+key+' '+JSON.stringify(action));
      __marketPurchases.push({tick:S.tick,timeMs:Date.now(),kind,key,before,action,after:{level:S.beastExchange.level,progress:S.beastExchange.progress,bone:S.res.bone,hide:S.res.hide}});
      if(S.beastExchange.progress>=beastExchangeProgressNeed(S.beastExchange.level)&&S.beastExchange.level<CFG.beastExchange.maxLevel){
        const upgrade=upgradeBeastExchange();if(!upgrade?.ok)throw Error('market level-up failed');
        __marketUpgrades.push({tick:S.tick,level:upgrade.level});}
    };
    for(const [id,offer] of Object.entries(S.beastExchange.hideOffers))while(offer.count>0){
      const trade=CFG.beastExchange.hideTrades[id],cost=beastHideTradeCost(id),gain=beastHideTradeReward(id);
      if(S.res.hide<cost||S.res[trade.get]+gain>resCap(trade.get))break;
      buy('hide',Number(id),()=>exchangeHideForResource(Number(id),1));
    }
    for(const [key,offer] of Object.entries(S.beastExchange.wildOffers))while(offer.count>0){
      if(S.items[key]<beastScrollTradeCost(key)||S.items.storageScroll>=CFG.eraMaterials.storageScroll.max)break;
      buy('wild',key,()=>exchangeWildMaterialForScrolls(key,1));
    }
    while(S.beastExchange.heartOffers>0){
      if(S.items.boarHeart<beastHeartTradeCost()||S.items.storageScroll>=CFG.eraMaterials.storageScroll.max)break;
      buy('heart','boarHeart',()=>exchangeHeartsForScrolls(1));
    }
  };`);
const state=()=>run('({timeMs:Date.now(),tick:S.tick,army:armyCount(),deployed:formSoldierCount(),queueCount:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),bone:S.res.bone,medal:S.res.medal,deed:S.res.deed,hide:S.res.hide,alert:S.killValues.wildWyrm,level:S.beastExchange.level,progress:S.beastExchange.progress,charges:S.beastExchange.refreshCharges,clock:S.beastExchange.refreshClock,scroll:S.items.storageScroll,rng:__rng})');
const queueState=()=>run('Object.fromEntries(Object.entries(S.queue).filter(([,q])=>q?.count>0).map(([uk,q])=>[uk,{count:q.count,timer:q.timer,reason:q.reason||""}]))');
const stock=()=>run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]]))");
const initial=state(),initialStock=stock();
assert.equal(run('maxPop()'),1002);
assert.equal(initial.army,498);assert.equal(initial.deployed,452);
assert.equal(initial.bone,705);assert.equal(initial.hide,18);assert.equal(initial.alert,3920);
assert.equal(initial.progress,1);assert.equal(initial.scroll,0);
run('__claimOffers()');
const initialClaim=state();
const phases={wood:0,stone:0,coal:0,iron:0,steel:0,copper:0,gold:0,food:0,tech:0};
let onlineSeconds=0,offlineSeconds=0,minFood=initialStock.food;
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food')assert.equal(run("setPopAlloc('food',999)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food must stay positive');
}
function advanceUntil(expression,max,stop='false',resource='tech'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    __clockMs+=1000;tick();n++;min=Math.min(min,S.res.food);
  }return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=x.n;phases[resource]+=x.n;minFood=Math.min(minFood,x.min);
  assert.ok(x.min>0,'food depleted');return x;
}
function fillBasic(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),resource+' target exceeds cap');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${target}`,15000,'false',resource).done,resource+' fill timeout');
}
function fillProcessed(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),resource+' target exceeds cap');
  let cycles=0;
  while(val(resource)<target&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${target}`,7000,stop,resource);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=target,resource+' fill exhausted');
}
function fill(resource,target){
  if(val(resource)>=target)return;
  if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,target);
  else fillBasic(resource,target);
}
function restoreRoster(){
  const before=state(),beforeStock=stock(),paymentStart=run('({...__actualTraining})'),losses={},expected={};
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  for(const[unit,wanted]of Object.entries(targetByType)){
    const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));losses[unit]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');assert.equal(run(`train('${unit}',${short})`)?.ok,true,unit+' training');
    assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','tech').done,unit+' training timeout');
  }
  for(const[row,groups]of Object.entries(formation))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const paymentEnd=run('({...__actualTraining})'),actual={};
  for(const[k,n]of Object.entries(expected)){
    actual[k]=(paymentEnd[k]||0)-(paymentStart[k]||0);assert.ok(Math.abs(n-actual[k])<1e-6,k+' payment');
  }
  const after=state(),afterStock=stock();
  assert.equal(after.army,672);assert.equal(after.deployed,626);
  assert.equal(after.alert,before.alert);
  return{before,beforeStock,losses,expected,actual,after,afterStock,seconds:after.tick-before.tick};
}
function fight(){
  const before=state();assert.equal(before.deployed,626);
  run("__phase='combat';openMaterialDomain('wyrmSinew')");assert.equal(run('S.battleActive'),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after=state(),enemyHp=run('B.enemyUnits[0].hp');
  if(result==='win'){
    assert.ok(after.bone>before.bone);assert.ok(after.hide>before.hide);
    assert.equal(after.alert,before.alert+10);
  }else{
    assert.equal(after.bone,before.bone);assert.equal(after.hide,before.hide);
    assert.equal(after.alert,before.alert);
  }
  assert.equal(after.army,before.army-(before.deployed-after.deployed));
  run("exitBattle();__phase='online'");
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('armyCount()'),after.army);
  assert.equal(reload.run('S.res.bone'),after.bone);
  assert.equal(reload.run('S.res.hide'),after.hide);
  assert.equal(reload.run('S.killValues.wildWyrm'),after.alert);
  return{before,enemy,result,enemyHp,after,callbacks,saveSha256:sha(saved)};
}
const firstRepair=restoreRoster(),battle=fight();
assert.equal(firstRepair.seconds,1609,'P349 same paid first repair');
assert.equal(battle.result,'win');
assert.equal(battle.after.army,293,'P349 same paid first battle');
assert.equal(battle.after.deployed,247);
const battleStock=stock(),startOnline=onlineSeconds;
run("clrForm('expedition')");
assert.equal(run('formSoldierCount()'),0);
const requested={},totalCost={};
for(const [uk,wanted] of Object.entries(targetByType)){
  const missing=Math.max(0,wanted-run('poolAvail('+JSON.stringify(uk)+')'));
  if(!missing)continue;
  requested[uk]=missing;
  for(const [rk,per] of Object.entries(run('({...CFG.units['+JSON.stringify(uk)+'].cost})')))
    totalCost[rk]=(totalCost[rk]||0)+per*missing;
}
assert.equal(Object.values(requested).reduce((a,b)=>a+b,0),379);
const caps=Object.fromEntries(Object.keys(totalCost).map(rk=>[rk,cap(rk)]));
if(policy==='copper-gold-prestock'){
  fill('copper',totalCost.copper);
  fill('gold',totalCost.gold);
}else if(policy==='full-prestock'||policy==='full-prestock-iron-steel'){
  // Steel production consumes iron; filling iron last preserves the payable
  // inventory instead of confusing cumulative output with current stock.
  for(const rk of ['steel','copper','iron','gold','food'])fill(rk,Math.min(totalCost[rk],caps[rk]));
}else assert.ok(['baseline-steel','ore-split'].includes(policy));
const preparationSeconds=onlineSeconds-startOnline;
const preparedStock=stock(),beforeQueue=state(),paidBefore=JSON.parse(run('JSON.stringify(__trainingByPhase.offline)'));
for(const [uk,missing] of Object.entries(requested)){
  const action=run('train('+JSON.stringify(uk)+','+missing+')');
  assert.equal(action?.ok,true,uk+' queued');
  assert.equal(action.qty,missing,uk+' queue capacity');
}
assert.deepEqual(stock(),preparedStock,'queue placement is unpaid');
if(policy==='ore-split'||policy==='full-prestock-iron-steel'){
  for(const [rk,n] of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run('setPopAlloc('+JSON.stringify(rk)+',0)')?.ok,true);
  const offlineWorkers=policy==='ore-split'
    ?{food:100,copper:300,iron:300,steel:302}
    :{food:100,iron:450,steel:452};
  for(const [rk,n] of Object.entries(offlineWorkers))
    assert.equal(run('setPopAlloc('+JSON.stringify(rk)+','+n+')')?.ok,true,rk);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}else assign('steel');
const logout=state(),logoutStock=stock(),allocation=run('({...S.popAlloc})');
assert.equal(logout.queueCount,379);
assert.equal(run('save().ok'),true);
const logoutSave=env.store.get('rts_save');
assert.equal(JSON.parse(logoutSave).ts,logout.timeMs);
run("__clockMs+=14400000;__phase='offline'");
assert.equal(run('loadSaveAndApply().status'),'ok');
const settlement=run('settleOffline()');
run("__phase='online'");
assert.equal(settlement?.ok,true);
assert.equal(settlement.durationSec,14400);
assert.equal(run('S.tick')-logout.tick,14400);
const arrival=state(),arrivalStock=stock(),arrivalQueue=queueState();
const produced=logout.queueCount-arrival.queueCount;
assert.equal(arrival.army-logout.army,produced);
assert.equal(run('S.offline.pendingReport.advance.produced'),produced);
const paidAfter=JSON.parse(run('JSON.stringify(__trainingByPhase.offline)'));
const offlineTrainingPaid={};
for(const rk of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)])){
  const delta=(paidAfter[rk]||0)-(paidBefore[rk]||0);
  if(delta)offlineTrainingPaid[rk]=delta;
}
const settledSave=env.store.get('rts_save');
const reload=environment({rts_save:settledSave});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.tick'),arrival.tick);
assert.equal(reload.run('armyCount()'),arrival.army);
assert.equal(reload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),arrival.queueCount);
for(const [uk,q] of Object.entries(arrivalQueue)){
  const action=run('dismissN('+JSON.stringify(uk)+','+q.count+')');
  assert.equal(action?.ok,true);
  assert.equal(action.cancelled,q.count);
  assert.equal(action.dismissed,0);
}
assert.equal(state().queueCount,0);
const beforeRepair=onlineSeconds;
const finalRepair=restoreRoster();
const repairSeconds=onlineSeconds-beforeRepair;
assert.equal(finalRepair.seconds,repairSeconds);
assert.equal(run('save().ok'),true);
const final=state(),finalStock=stock(),finalSave=env.store.get('rts_save');
const finalReload=environment({rts_save:finalSave});
assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('S.tick'),final.tick);
assert.equal(finalReload.run('formSoldierCount()'),626);
assert.equal(finalReload.run('armyCount()'),672);
assert.ok(Object.values(finalStock).every(n=>Number.isFinite(n)&&n>=0));
assert.equal(run('maxPop()'),1002);
return{policy,codeHashes,sourceSha256:sha(sourceText),rosterSha256:sha(rosterText),
  firstRepairSeconds:firstRepair.seconds,battle:{result:battle.result,armyAfter:battle.after.army,casualties:379,
    saveSha256:battle.saveSha256},battleStock,requested,totalCost,caps,
  preparationSeconds,preparedStock,beforeQueue,logout,logoutStock,allocation,logoutSaveSha256:sha(logoutSave),
  settlement:{durationSec:settlement.durationSec,gains:settlement.gains,produced},
  arrival,arrivalStock,arrivalQueue,offlineTrainingPaid,settledSaveSha256:sha(settledSave),
  repairSeconds,totalActiveSeconds:preparationSeconds+repairSeconds,
  finalRepair,final,finalStock,finalSaveSha256:sha(finalSave),minFood,phases};
}

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const policies=['baseline-steel','ore-split','copper-gold-prestock','full-prestock','full-prestock-iron-steel'];
const outcomes=policies.map(policy=>{const result=runScenario(policy);
  console.error(JSON.stringify({policy,preparationSeconds:result.preparationSeconds,
    offlineProduced:result.settlement.produced,repairSeconds:result.repairSeconds,
    totalActiveSeconds:result.totalActiveSeconds}));return result});
const reference=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p349-wild-offline-queue-2battle.json'),'utf8'));
assert.equal(outcomes[0].settlement.produced,reference.offlineWindows[0].before.queueCount-reference.offlineWindows[0].after.queueCount);
assert.equal(outcomes[0].repairSeconds,reference.rounds[1].restoration.seconds);
for(const result of outcomes){
  assert.equal(result.settlement.gains.bone,30240);
  assert.equal(result.settlement.gains.medal,7560);
  assert.equal(result.settlement.gains.deed,4536);
  assert.equal(result.final.army,672);
  assert.equal(result.final.deployed,626);
}
assert.equal(outcomes.at(-1).settlement.produced,379);
assert.equal(outcomes.at(-1).arrival.queueCount,0);
assert.equal(outcomes.at(-1).repairSeconds,0);
const report={batch:'P350',date:'2026-09-29',unit:'seconds',reference:{p349RepairSeconds:reference.rounds[1].restoration.seconds,
  p347NoQueueRepairSeconds:2968},outcomes,
  limits:['One P342 late-game save and deterministic first battle; not a fresh-save or retention estimate.',
    'Every candidate pays actual preparation and repair time through the shipped tick, worker, train, queue and settleOffline paths.',
    'Only one fixed worker allocation can run during the offline window; no automated mid-window reassignment is assumed.',
    'The game does not provide automatic replenishment from the P348 bone/medal/deed grant to copper, iron or steel.',
    'VM localStorage, DOM and timers do not prove browser/Android behavior.']};
const file=path.join(root,'docs/codex/reports/data/p350-wild-material-strategies.json');
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({reportFile:file,comparison:outcomes.map(x=>({policy:x.policy,
  prepared:x.preparationSeconds,produced:x.settlement.produced,repair:x.repairSeconds,
  active:x.totalActiveSeconds,queue:x.arrival.queueCount,stock:x.arrivalStock}))},null,2));
