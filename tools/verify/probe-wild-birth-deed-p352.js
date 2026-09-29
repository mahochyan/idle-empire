'use strict';
// P352: spend the first genuine offline deed reward on housing, birth policy,
// and workers before replaying a second paid four-hour recruitment window.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const policySlots=Number(process.argv[2]||1);
assert.ok([1,5].includes(policySlots),'compare one or five original small-town birth slots');
const workerMode=process.argv[3]||'all';
assert.ok(['all','base'].includes(workerMode),'use all 1122 or leave the newest 120 idle in the second window');
const intervalSeconds=4*3600;
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
const p349=JSON.parse(fs.readFileSync(path.join(root,data+'p349-wild-offline-queue-3battle.json'),'utf8'));
const p350=JSON.parse(fs.readFileSync(path.join(root,data+'p350-wild-material-strategies.json'),'utf8'));
const population=()=>run('({current:popCurrent(),capacity:maxPop(),free:popFree(),growthClock:S.population.growthClock,birthPolicies:birthPolicyCount(),growthPer10:popGrowthPer10s(),settlements:{...S.settlements},alloc:{...S.popAlloc},tech:S.res.tech,deed:S.res.deed})');
const ledger=()=>run('({...__trainingByPhase.offline})');
function queueMissing(){
  const before=state(),beforeStock=stock(),requested={};
  assert.equal(before.queueCount,0);
  run("clrForm('expedition')");
  for(const[uk,wanted]of Object.entries(targetByType)){
    const missing=Math.max(0,wanted-run('poolAvail('+JSON.stringify(uk)+')'));
    if(!missing)continue;
    const action=run('train('+JSON.stringify(uk)+','+missing+')');
    assert.equal(action?.ok,true,uk+' queue');
    assert.equal(action.qty,missing);
    requested[uk]=missing;
  }
  assert.equal(JSON.stringify(stock()),JSON.stringify(beforeStock),'queue placement is unpaid');
  assert.equal(state().queueCount,Object.values(requested).reduce((a,b)=>a+b,0));
  return{before,beforeStock,requested,queued:state(),queue:queueState()};
}
function allocate(values){
  for(const[rk,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)
    assert.equal(run('setPopAlloc('+JSON.stringify(rk)+',0)')?.ok,true,rk);
  for(const[rk,n]of Object.entries(values))
    assert.equal(run('setPopAlloc('+JSON.stringify(rk)+','+n+')')?.ok,true,rk);
  assert.equal(run('popAllocTotal()'),Object.values(values).reduce((a,b)=>a+b,0));
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'food net positive');
  return run('({...S.popAlloc})');
}
function settleWindow(label){
  const before=state(),beforeStock=stock(),beforePop=population(),beforeQueue=queueState(),beforeLedger=ledger();
  const raw=env.store.get('rts_save');
  assert.equal(JSON.parse(raw).ts,before.timeMs);
  const beforePurchases=run('__marketPurchases.length');
  run("__clockMs+=14400000;__phase='offline'");
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const result=run('settleOffline()');
  run("__phase='online'");
  assert.equal(result?.ok,true);assert.equal(result.durationSec,intervalSeconds);
  offlineSeconds+=result.durationSec;
  const after=state(),afterStock=stock(),afterPop=population(),afterQueue=queueState(),afterLedger=ledger();
  const produced=before.queueCount-after.queueCount;
  assert.equal(after.tick-before.tick,intervalSeconds);
  assert.equal(after.army-before.army,produced);
  assert.equal(run('S.offline.pendingReport.advance.produced'),produced);
  assert.equal(run('__marketPurchases.length'),beforePurchases,'offline never auto-trades');
  assert.equal(afterPop.current,beforePop.current,'offline never births population');
  assert.equal(after.level,before.level);assert.equal(after.progress,before.progress);
  for(const[rk,expected]of Object.entries({bone:30240,medal:7560,deed:4536})){
    assert.equal(after[rk]-before[rk],expected,rk+' paid Lv31 reward');
    assert.equal(result.gains[rk],expected,rk+' pending report');
  }
  const paid={};
  for(const rk of new Set([...Object.keys(beforeLedger),...Object.keys(afterLedger)])){
    const diff=(afterLedger[rk]||0)-(beforeLedger[rk]||0);
    if(diff)paid[rk]=diff;
  }
  minFood=Math.min(minFood,afterStock.food);assert.ok(afterStock.food>0);
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.tick'),after.tick);
  assert.equal(reload.run('S.population.current'),afterPop.current);
  assert.equal(reload.run('S.res.deed'),after.deed);
  assert.equal(reload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),after.queueCount);
  return{label,before,beforeStock,beforePop,beforeQueue,beforeSaveSha256:sha(raw),
    result,after,afterStock,afterPop,afterQueue,produced,trainingPaid:paid,saveSha256:sha(saved)};
}
function cancelUnfinished(){
  const before=queueState(),cancelled={};
  for(const[uk,q]of Object.entries(before)){
    const action=run('dismissN('+JSON.stringify(uk)+','+q.count+')');
    assert.equal(action?.ok,true);assert.equal(action.cancelled,q.count);assert.equal(action.dismissed,0);
    cancelled[uk]=q.count;
  }
  assert.equal(state().queueCount,0);
  return cancelled;
}

const firstRepair=restoreRoster(),firstBattle=fight();
assert.equal(firstRepair.seconds,1609);
assert.equal(firstBattle.result,'win');assert.equal(firstBattle.after.army,293);
assert.equal(firstBattle.after.deployed,247);
assert.equal(firstBattle.after.rng,p349.rounds[0].battle.after.rng);
const firstQueue=queueMissing();assert.equal(firstQueue.queued.queueCount,379);
const firstAllocation=allocate({food:100,steel:902});
assert.equal(run('save().ok'),true);
const firstWindow=settleWindow('first-4h-before-housing');
assert.equal(firstWindow.produced,56);
assert.equal(firstWindow.after.queueCount,323);
assert.equal(firstWindow.after.deed,4536);
assert.equal(firstWindow.afterPop.capacity,1002);
assert.equal(firstWindow.saveSha256,p349.offlineWindows[0].persistedSha256);
run('__claimOffers()');
const firstCancelled=cancelUnfinished();

const beforeDevelopment=population(),researchCost=run('activeSciences().sci_birth_policy.cost.tech');
assert.equal(run("scienceUnlocked('sci_birth_policy')"),false);
const research=run("researchScience('sci_birth_policy')");
assert.equal(research?.ok,true);
assert.equal(run("scienceUnlocked('sci_birth_policy')"),true);
assert.equal(beforeDevelopment.tech-run('S.res.tech'),researchCost);
// Select the largest legal capacity gain, then the cheapest mix for that gain.
// Costs are read from the shipped settlementCostAt() action formula.
const expansionCosts=run(`Object.fromEntries(Object.keys(CFG.settlements).map(key=>{
  const levels=[0],start=S.settlements[key];
  for(let n=1;n<=1000;n++){
    const cost=levels.at(-1)+settlementCostAt(key,start+n-1);
    if(cost>S.res.deed)break;
    levels.push(cost);
  }
  return[key,levels];
}))`);
let bestExpansion={gain:-1,cost:Infinity};
for(let village=0;village<expansionCosts.village.length;village++)
for(let smallTown=0;smallTown<expansionCosts.smallTown.length;smallTown++)
for(let city=0;city<expansionCosts.city.length;city++){
  const cost=expansionCosts.village[village]+expansionCosts.smallTown[smallTown]+expansionCosts.city[city];
  const gain=village+2*smallTown+4*city;
  if(cost<=beforeDevelopment.deed&&(gain>bestExpansion.gain||gain===bestExpansion.gain&&cost<bestExpansion.cost))
    bestExpansion={village,smallTown,city,gain,cost};
}
assert.deepEqual(bestExpansion,{village:54,smallTown:33,city:0,gain:120,cost:4490});
const villagePlan=run("settlementBatchPreview('village',54,4)");
assert.equal(villagePlan?.ok,true);assert.equal(villagePlan.cost,1917);
const villageAction=run("upgradeSettlementBatch('village',54,4,4536)");
assert.equal(villageAction?.ok,true);assert.equal(villageAction.cost,villagePlan.cost);
const townPlan=run("settlementBatchPreview('smallTown',33,5)");
assert.equal(townPlan?.ok,true);assert.equal(townPlan.cost,2573);
const townAction=run("upgradeSettlementBatch('smallTown',33,5,2619)");
assert.equal(townAction?.ok,true);assert.equal(townAction.cost,townPlan.cost);
assert.equal(run('S.res.deed'),46);assert.equal(run('maxPop()'),1122);
const policyActions=[];
for(let slot=0;slot<policySlots;slot++){
  const action=run("setSmallTownPolicy("+slot+",'birth')");
  assert.equal(action?.ok,true,'real birth policy slot '+slot);
  policyActions.push(action);
}
assert.equal(run('birthPolicyCount()'),policySlots);
assert.equal(run('popGrowthPer10s()'),2+5*policySlots);
const afterDevelopment=population();
assert.equal(afterDevelopment.current,1002);assert.equal(afterDevelopment.capacity,1122);
assign('coal');phases.birth=0;
const birthAdvance=advanceUntil('popCurrent()===maxPop()',600,'false','birth');
assert.equal(birthAdvance.done,true);
assert.equal(birthAdvance.n,Math.ceil(120/(2+5*policySlots))*10);
assert.equal(population().current,1122);assert.equal(population().free,120);
const beforeNewWorkerStock=stock();
assert.equal(run("setPopAlloc('copper',120)")?.ok,true);
const newWorkerAllocation=population();
assert.equal(run('popAllocTotal()'),1122);
const workerTrial=advanceUntil('S.tick>='+run('S.tick+10'),10,'false','birth');
assert.equal(workerTrial.n,10);assert.equal(workerTrial.done,true);
const afterNewWorkerStock=stock();
assert.ok(afterNewWorkerStock.copper>beforeNewWorkerStock.copper,'new copper workers must actually produce');
const beforeSecondRepair=onlineSeconds,secondRepair=restoreRoster();
const secondRepairSeconds=onlineSeconds-beforeSecondRepair;
assert.equal(secondRepair.seconds,secondRepairSeconds);
const secondBattle=fight();
assert.equal(secondBattle.before.deployed,626);
assert.equal(secondBattle.result,p349.rounds[1].battle.result);
assert.equal(secondBattle.after.rng,p349.rounds[1].battle.after.rng);
assert.equal(secondBattle.after.army,p349.rounds[1].battle.after.army);
assert.equal(secondBattle.after.alert,p349.rounds[1].battle.after.alert);
const secondQueue=queueMissing();
assert.equal(JSON.stringify(secondQueue.requested),JSON.stringify(p349.offlineWindows[1].logout.requested),
  'same second-battle casualties and queue composition');
const secondAllocation=allocate(workerMode==='all'
  ?{food:100,copper:330,iron:330,steel:302,gold:60}
  :{food:100,copper:300,iron:300,steel:302});
assert.equal(run('popAllocTotal()'),workerMode==='all'?1122:1002);
assert.equal(run('save().ok'),true);
const secondLogoutSave=env.store.get('rts_save');
const secondLogoutReload=environment({rts_save:secondLogoutSave});
assert.equal(secondLogoutReload.run('loadSaveAndApply().status'),'ok');
assert.equal(secondLogoutReload.run('S.population.current'),1122);
assert.equal(secondLogoutReload.run('S.res.deed'),46);
assert.equal(secondLogoutReload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),626);
const secondWindow=settleWindow('second-4h-after-housing');
assert.equal(secondWindow.beforePop.capacity,1122);
assert.equal(secondWindow.beforePop.current,1122);
assert.equal(secondWindow.before.queueCount,Object.values(secondQueue.requested).reduce((a,b)=>a+b,0));
assert.equal(secondWindow.before.queueCount,p349.offlineWindows[1].before.queueCount);
assert.equal(secondWindow.after.deed,4582);
const finalSave=env.store.get('rts_save');
assert.equal(JSON.parse(finalSave).v,32);
const report={batch:'P352',date:'2026-09-29',policySlots,workerMode,
  unit:'online and offline seconds, resource quantities and soldiers',
  codeHashes,sourceFile,sourceSha256:sha(sourceText),rosterFile,rosterSha256:sha(rosterText),
  firstRepairSeconds:firstRepair.seconds,firstBattle:{result:firstBattle.result,after:firstBattle.after,saveSha256:firstBattle.saveSha256},
  firstQueue,firstAllocation,firstWindow,firstCancelled,
  development:{beforeDevelopment,researchCost,research,bestExpansion,villagePlan,villageAction,townPlan,townAction,
    policyActions,afterDevelopment,birthSeconds:birthAdvance.n,workerTrialSeconds:workerTrial.n,
    newWorkerAllocation,beforeNewWorkerStock,afterNewWorkerStock},
  secondRepair,secondRepairSeconds,secondBattle:{result:secondBattle.result,after:secondBattle.after,saveSha256:secondBattle.saveSha256},
  secondQueue,secondAllocation,secondLogoutSaveSha256:sha(secondLogoutSave),secondWindow,
  firstWindowToSecondLogoutActiveSeconds:birthAdvance.n+workerTrial.n+secondRepairSeconds,
  reference:{p349FirstProduced:p349.offlineWindows[0].before.queueCount-p349.offlineWindows[0].after.queueCount,
    p349SecondRepairSeconds:p349.rounds[1].restoration.seconds,
    p349SecondProduced:p349.offlineWindows[1].before.queueCount-p349.offlineWindows[1].after.queueCount,
    p350BestFirstWindow:p350.outcomes.at(-1).settlement.produced,
    p350BestFirstActiveSeconds:p350.outcomes.at(-1).totalActiveSeconds},
  onlineSeconds,offlineSeconds,minFood,phases,rngDraws:run('({...__rngDraws})'),
  final:{state:state(),population:population(),stock:stock(),queue:queueState()},
  finalSaveSha256:sha(finalSave),
  limits:['One selected paid late-game save and only two four-hour offline windows, not a fresh-save or long-run result.',
    'Only the specified number of original small-town policy slots were configured; the added slots were not stacked.',
    'The same first P349 window is reproduced before the housing decision, but subsequent online ticks can change market RNG and battle casualties.',
    'Housing, science and policy actions are instantaneous in game rules; birth and all resource production consume actual tick seconds.',
    'There is no automatic offline reassignment, free population, injected resources, or automatic market purchase.',
    'VM localStorage, DOM and timers are not browser or Android validation.']};
const suffix=(policySlots===1?'birth-deed-optimal':'birth-deed-five-policy-optimal')+
  (workerMode==='base'?'-base-workers':'')+'-two-window';
const reportFile=data+'p352-'+suffix+'.json',saveFile=data+'p352-'+suffix+'-save.json';
const secondLogoutFile=data+'p352-'+suffix+'-second-logout-save.json';
report.secondLogoutFile=secondLogoutFile;
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,saveFile),finalSave);
fs.writeFileSync(path.join(root,secondLogoutFile),secondLogoutSave);
console.log(JSON.stringify({reportFile,saveFile,secondLogoutFile,secondLogoutSaveSha256:report.secondLogoutSaveSha256,
  policySlots,workerMode,firstRepairSeconds:firstRepair.seconds,firstProduced:firstWindow.produced,
  development:report.development,secondRepairSeconds,secondBattle:report.secondBattle,
  secondQueued:secondWindow.before.queueCount,secondProduced:secondWindow.produced,
  secondRemaining:secondWindow.after.queueCount,secondStock:secondWindow.afterStock,
  activeSeconds:report.firstWindowToSecondLogoutActiveSeconds,references:report.reference,
  final:report.final,onlineSeconds,offlineSeconds,minFood,finalSaveSha256:report.finalSaveSha256},null,2));
