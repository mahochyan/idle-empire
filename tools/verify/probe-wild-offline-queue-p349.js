'use strict';
// Candidate: queue the next roster after battle, work steel during a
// four-hour offline window, and measure the remaining online repair.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const maxBattles=Number(process.argv[2]||3);
assert.ok(Number.isSafeInteger(maxBattles)&&maxBattles>=2&&maxBattles<=3,'bounded 2-3 battle probe');
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
const p347=JSON.parse(fs.readFileSync(path.join(root,data+'p347-wild-short-session-4h.json'),'utf8'));
assert.equal(p347.sourceSha256,sha(sourceText));
assert.equal(p347.rosterSha256,sha(rosterText));
const rounds=[],offlineWindows=[];
function queueAtLogout(){
  const before=state(),beforeStock=stock(),requested={};
  assert.equal(before.queueCount,0);
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  for(const [uk,wanted] of Object.entries(targetByType)){
    const missing=Math.max(0,wanted-run('poolAvail('+JSON.stringify(uk)+')'));
    if(!missing)continue;
    const action=run('train('+JSON.stringify(uk)+','+missing+')');
    assert.equal(action?.ok,true,uk+' queued');
    assert.equal(action.qty,missing,uk+' queue capacity');
    requested[uk]=missing;
  }
  assert.equal(JSON.stringify(stock()),JSON.stringify(beforeStock),'joining the queue does not debit resources');
  assign('steel');
  assert.equal(run('save().ok'),true,'logout checkpoint');
  const after=state(),queue=queueState();
  assert.equal(after.queueCount,Object.values(requested).reduce((a,b)=>a+b,0));
  assert.equal(JSON.parse(env.store.get('rts_save')).ts,after.timeMs);
  return{before,beforeStock,requested,after,afterStock:stock(),queue,allocation:run('({...S.popAlloc})')};
}
function cancelUnfinished(){
  const before=queueState(),cancelled={},beforeStock=stock(),beforeArmy=state().army;
  for(const [uk,q] of Object.entries(before)){
    const action=run('dismissN('+JSON.stringify(uk)+','+q.count+')');
    assert.equal(action?.ok,true,uk+' cancel paused queue');
    assert.equal(action.cancelled,q.count);
    assert.equal(action.dismissed,0);
    cancelled[uk]=action.cancelled;
  }
  assert.equal(state().queueCount,0);
  assert.equal(state().army,beforeArmy,'cancelling unproduced soldiers keeps the real roster');
  assert.equal(JSON.stringify(stock()),JSON.stringify(beforeStock),'cancelling unpaid queue has no resource refund');
  return{before,cancelled,beforeStock,afterStock:stock(),beforeArmy,afterArmy:state().army};
}
function expectedPassiveReward(before,seconds){
  const cfg=JSON.parse(run('JSON.stringify(CFG.beastExchange.offlineReward)'));
  const tier=Math.min(cfg.maxTier,Math.floor((before.level-cfg.levelOffset)/cfg.levelsPerTier));
  const maxPopulation=run('maxPop()');
  const mult=1+cfg.populationBonus*Math.floor(maxPopulation/cfg.populationStep);
  const gain={};
  for(const rk of ['bone','medal','deed']){
    const cap=run('resCap('+JSON.stringify(rk)+')');
    const offered=seconds>=cfg.minSeconds&&tier>0?Math.floor(cfg.rates[rk]*seconds*tier*mult):0;
    gain[rk]=before[rk]<cap?Math.min(cap,before[rk]+offered)-before[rk]:0;
  }
  return{tier,maxPopulation,mult,gain};
}
function settleQueuedWindow(logout,session){
  const before=state(),beforeStock=stock(),beforeQueue=queueState();
  assert.equal(before.queueCount,logout.after.queueCount);
  assert.equal(JSON.parse(env.store.get('rts_save')).ts,before.timeMs);
  const beforeBuy=run('__marketPurchases.length');
  const paidBefore=JSON.parse(run('JSON.stringify(__trainingByPhase.offline)'));
  run('__clockMs+='+intervalSeconds*1000+";__phase='offline'");
  assert.equal(run('loadSaveAndApply().status'),'ok','reload queued save');
  const settlement=run('settleOffline()');
  run("__phase='online'");
  assert.equal(settlement?.ok,true);
  assert.equal(settlement.durationSec,intervalSeconds);
  offlineSeconds+=settlement.durationSec;
  const after=state(),afterStock=stock(),afterQueue=queueState();
  const blockedBy=run('Object.fromEntries(Object.entries(S.queue).filter(([,q])=>q?.count>0).map(([uk])=>[uk,Object.entries(CFG.units[uk].cost).filter(([rk,amount])=>CFG.res[rk]&&S.res[rk]<amount).map(([rk])=>rk)]))');
  const producedByUnit=Object.fromEntries(Object.entries(logout.requested).map(([uk,count])=>[uk,count-(afterQueue[uk]?.count||0)]).filter(([,count])=>count>0));
  const paidAfter=JSON.parse(run('JSON.stringify(__trainingByPhase.offline)'));
  const offlineTrainingPaid={};
  for(const rk of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)])){
    const delta=(paidAfter[rk]||0)-(paidBefore[rk]||0);
    if(delta)offlineTrainingPaid[rk]=delta;
  }
  assert.equal(after.tick-before.tick,intervalSeconds);
  assert.equal(before.queueCount-after.queueCount,run('S.offline.pendingReport.advance.produced'),'queue decrement equals actual offline production');
  assert.equal(Object.values(producedByUnit).reduce((a,b)=>a+b,0),before.queueCount-after.queueCount);
  assert.equal(after.army-before.army,before.queueCount-after.queueCount,'soldiers are added once');
  assert.equal(run('__marketPurchases.length'),beforeBuy,'no automatic offer purchase');
  assert.equal(after.level,before.level);
  assert.equal(after.progress,before.progress);
  const passive=expectedPassiveReward(before,intervalSeconds);
  for(const rk of ['bone','medal','deed']){
    assert.equal(after[rk]-before[rk],passive.gain[rk],rk+' passive reward');
    assert.equal(settlement.gains[rk]||0,passive.gain[rk],rk+' report gain');
  }
  assert.ok(afterStock.food>0,'food remains payable');
  minFood=Math.min(minFood,afterStock.food);
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok','settled save reload');
  assert.equal(reload.run('S.tick'),after.tick);
  assert.equal(reload.run('S.res.bone'),after.bone);
  assert.equal(reload.run('S.res.medal'),after.medal);
  assert.equal(reload.run('S.res.deed'),after.deed);
  assert.equal(reload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),after.queueCount);
  assert.equal(reload.run('S.offline.pendingReport.durationSec'),intervalSeconds);
  const beforeClaim=run('__marketPurchases.length');
  run('__claimOffers()');
  const claim={before:after,after:state(),purchases:run('__marketPurchases.length')-beforeClaim};
  const cancellation=cancelUnfinished();
  return{session,logout,before,beforeStock,beforeQueue,settlement,after,afterStock,afterQueue,blockedBy,producedByUnit,
    offlineTrainingPaid,passive,persistedSha256:sha(saved),claim,cancellation};
}
let pendingLogout=null;
for(let n=0;n<maxBattles;n++){
  let window=null;
  if(n>0){
    window=settleQueuedWindow(pendingLogout,n+1);
    offlineWindows.push(window);
  }
  const restoration=restoreRoster();
  if(n===0){
    assert.equal(restoration.seconds,p347.rounds[0].restoration.seconds,'same initial paid repair as P347');
    assert.equal(restoration.after.army,p347.rounds[0].restoration.after.army);
  }
  const battle=fight();
  assert.equal(battle.after.queueCount,0);
  if(n===0){
    assert.equal(battle.result,p347.rounds[0].battle.result,'same initial battle RNG');
    assert.equal(battle.after.army,p347.rounds[0].battle.after.army);
  }
  const logout=n+1<maxBattles?queueAtLogout():null;
  rounds.push({battleNumber:n+1,restoration,battle,logout,
    p347OnlineRepairSeconds:p347.rounds[n].restoration.seconds,
    firstWindowComparable:n===1});
  if(logout)pendingLogout=logout;
  console.error(JSON.stringify({battle:n+1,repairOnlineSeconds:restoration.seconds,
    p347RepairOnlineSeconds:p347.rounds[n].restoration.seconds,
    offlineProduced:window?window.before.queueCount-window.after.queueCount:0,
    queuedAfterOffline:window?window.after.queueCount:0,result:battle.result}));
}
const final=state(),finalStock=stock(),finalText=env.store.get('rts_save');
assert.equal(final.queueCount,0,'last battle is not followed by another queue');
assert.ok(Object.values(finalStock).every(x=>Number.isFinite(x)&&x>=0));
const finalReload=environment({rts_save:finalText});
assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('S.tick'),final.tick);
assert.equal(finalReload.run('S.res.bone'),final.bone);
assert.equal(finalReload.run('S.res.medal'),final.medal);
assert.equal(finalReload.run('S.res.deed'),final.deed);
const finalFile=data+'p349-wild-offline-queue-'+maxBattles+'battle-save.json';
const reportFile=data+'p349-wild-offline-queue-'+maxBattles+'battle.json';
fs.writeFileSync(path.join(root,finalFile),finalText,'utf8');
const report={batch:'P349',kind:'four-hour offline steel/food job and paid queue candidate',
  codeHashes,sourceFile,sourceSha256:sha(sourceText),rosterFile,rosterSha256:sha(rosterText),rngStart:prior.final.rng,
  p347BaselineFile:data+'p347-wild-short-session-4h.json',intervalSeconds,maxBattles,
  initial,initialStock,initialClaim,rounds,offlineWindows,final,finalStock,
  onlineSeconds,offlineSeconds,minFood,phases,
  actualTraining:run('({...__actualTraining})'),trainingByPhase:run('({...__trainingByPhase})'),
  marketPurchases:run('([...__marketPurchases])'),marketEvents:run('([...__marketEvents])'),
  rngDraws:run('({...__rngDraws})'),finalFile,finalSha256:sha(finalText),
  limits:['Selected P342 late-game paid roster, not a fresh-account or general-player sample.',
    'One fixed logout policy: queue missing target soldiers, allocate 100 food and 902 steel workers; production inputs are not automatically reassigned while offline.',
    'At login, inspect queue count and pause reason, then cancel any unfinished orders with the real dismissN action before following the P347 online repair routine.',
    'Resources are charged on actual soldier production, not on queue placement; this probe records paid totals by online/offline phase.',
    'Only the first offline window starts from the same battle and casualties as P347. Later combat RNG and losses can diverge.',
    'P348 passive bone/medal/deed reward is verified from the current config and settled seconds. It does not train soldiers or guarantee a short active session.',
    'VM localStorage, DOM and timers are not browser/Android verification.']};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(sourceText));
assert.equal(sha(fs.readFileSync(path.join(root,rosterFile),'utf8')),sha(rosterText));
console.log(JSON.stringify({maxBattles,onlineSeconds,offlineSeconds,
  firstComparable:{p347:p347.rounds[1].restoration.seconds,candidate:rounds[1].restoration.seconds,
    offlineProduced:offlineWindows[0].before.queueCount-offlineWindows[0].after.queueCount,
    queuedAfterOffline:offlineWindows[0].after.queueCount},
  windows:offlineWindows.map(w=>({produced:w.before.queueCount-w.after.queueCount,
    producedByUnit:w.producedByUnit,pending:w.after.queueCount,reasons:w.afterQueue,blockedBy:w.blockedBy,offlineTrainingPaid:w.offlineTrainingPaid,
    passive:w.passive.gain,foodBefore:w.beforeStock.food,foodAfter:w.afterStock.food})),
  final,trainingByPhase:report.trainingByPhase,reportFile,finalFile,finalSha256:report.finalSha256},null,2));
