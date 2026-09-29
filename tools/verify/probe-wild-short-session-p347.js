'use strict';
// Replay short sessions: paid online replenishment, battle, save, true offline
// settlement, reload, and a player-initiated market check-in at each login.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const intervalHours=Number(process.argv[2]||4),maxBattles=Number(process.argv[3]||30);
assert.ok([1,4,8].includes(intervalHours),'supported check-in intervals: 1, 4, 8 hours');
assert.ok(Number.isSafeInteger(maxBattles)&&maxBattles>=1&&maxBattles<=30);
const intervalSeconds=intervalHours*3600;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
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
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid}return result};`);
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
const state=()=>run('({timeMs:Date.now(),tick:S.tick,army:armyCount(),deployed:formSoldierCount(),queueCount:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),bone:S.res.bone,hide:S.res.hide,alert:S.killValues.wildWyrm,level:S.beastExchange.level,progress:S.beastExchange.progress,charges:S.beastExchange.refreshCharges,clock:S.beastExchange.refreshClock,scroll:S.items.storageScroll,rng:__rng})');
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
const rounds=[],offlineWindows=[],loginClaims=[];
for(let n=0;n<maxBattles;n++){
  if(n>0){
    // The previous battle ended with an actual save. Reopen that raw save after
    // an elapsed wall-clock interval, settle it once, then inspect persisted state.
    const before=state(),beforeStock=stock(),beforeAlloc=run('({...S.popAlloc})');
    assert.equal(before.queueCount,0,'no soldiers are queued at logout under the current policy');
    const rawBefore=env.store.get('rts_save');
    assert.equal(JSON.parse(rawBefore).ts,before.timeMs,'offline starts at last saved wall time');
    const beforeOffers=run('JSON.stringify(S.beastExchange)');
    const beforeItems=run('JSON.stringify(S.items)');
    const beforeMedal=run('S.res.medal'),beforeDeed=run('S.res.deed');
    const beforePurchases=run('__marketPurchases.length'),beforeRolls=run("__marketEvents.filter(x=>x.kind==='offer-roll'&&x.phase==='offline').length");
    const beforeDraws=run('({...__rngDraws})');
    run(`__clockMs+=${intervalSeconds*1000};__phase='offline'`);
    assert.equal(run('loadSaveAndApply().status'),'ok','reopening the battle save');
    const settlement=run('settleOffline()');
    run("__phase='online'");
    assert.equal(settlement?.ok,true,'offline settlement');
    assert.equal(settlement.durationSec,intervalSeconds,'offline elapsed seconds');
    offlineSeconds+=settlement.durationSec;
    const afterSettlement=state(),afterSettlementStock=stock();
    assert.equal(afterSettlement.tick-before.tick,intervalSeconds,'only accepted offline seconds advance tick');
    assert.equal(afterSettlement.queueCount,0,'no delayed recruitment during the offline window');
    assert.equal(run('__marketPurchases.length'),beforePurchases,'offline never auto-buys offers');
    assert.equal(afterSettlement.level,before.level,'offline does not grant market experience');
    assert.equal(afterSettlement.progress,before.progress,'offline does not grant market experience');
    assert.equal(afterSettlement.bone,before.bone,'current implementation has no passive bone reward');
    assert.equal(run('S.res.medal'),beforeMedal,'current implementation has no passive medal reward');
    assert.equal(run('S.res.deed'),beforeDeed,'current implementation has no passive deed reward');
    assert.equal(run('JSON.stringify(S.items)'),beforeItems,'offline does not trade inventory');
    const persisted=env.store.get('rts_save'),reload=environment({rts_save:persisted});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok','reloading the settled save');
    assert.equal(reload.run('S.tick'),afterSettlement.tick);
    assert.equal(reload.run('S.beastExchange.refreshClock'),afterSettlement.clock);
    assert.equal(reload.run('S.beastExchange.refreshCharges'),afterSettlement.charges);
    assert.equal(reload.run('S.beastExchange.progress'),afterSettlement.progress);
    assert.equal(reload.run('S.offline.pendingReport.durationSec'),intervalSeconds);
    const afterRolls=run("__marketEvents.filter(x=>x.kind==='offer-roll'&&x.phase==='offline').length");
    const afterDraws=run('({...__rngDraws})');
    const purchasesStart=run('__marketPurchases.length');
    run('__claimOffers()');
    const afterClaim=state(),afterClaimStock=stock();
    const claim={session:n+1,atMs:afterClaim.timeMs,purchases:run('__marketPurchases.length')-purchasesStart,before:afterSettlement,after:afterClaim};
    loginClaims.push(claim);
    offlineWindows.push({session:n+1,intervalSeconds,meetsMother900SecondThreshold:intervalSeconds>=900,
      before,beforeStock,beforeAlloc,beforeOffers,settlement,afterSettlement,afterSettlementStock,
      offlineRolls:afterRolls-beforeRolls,offlineRngDraws:afterDraws.offline-beforeDraws.offline,
      beforeRng:before.rng,afterRng:afterSettlement.rng,persistedSha256:sha(persisted),claim,afterClaimStock});
    assert.ok(afterSettlementStock.food>0,'offline food stayed payable');
    minFood=Math.min(minFood,afterSettlementStock.food);
  }
  const restoration=restoreRoster(),battle=fight();
  assert.equal(battle.after.queueCount,0,'all paid recruitment was finished before battle');
  rounds.push({restoration,battle});
  console.error(JSON.stringify({round:n+1,onlineSeconds,offlineSeconds,trained:Object.values(restoration.losses).reduce((a,b)=>a+b,0),result:battle.result,casualties:restoration.after.army-battle.after.army,bone:battle.after.bone,hide:battle.after.hide,alert:battle.after.alert}));
}
const beforeFinalClaim=state();
run(`(()=>{const purchasesBefore=__marketPurchases.length;__claimOffers();
  __marketEvents.push({tick:S.tick,kind:'final-session-check-in',charges:S.beastExchange.refreshCharges,
    purchases:__marketPurchases.length-purchasesBefore})})()`);
const beforeStoredRefreshes=state();
for(let i=0;i<beforeStoredRefreshes.charges;i++){
  const refresh=run("__phase='manual';refreshBeastExchange()");assert.equal(refresh?.ok,true);
  run(`__marketEvents.push({tick:S.tick,kind:'stored-manual',charges:S.beastExchange.refreshCharges});__claimOffers();__phase='online'`);
}
const beforeBones=state(),boneActions=[];
while(state().level<run('CFG.beastExchange.maxLevel')){
  const before=state(),trades=Math.min(Math.floor(before.bone/run('beastBoneTradeCost()')),
    run('beastExchangeProgressNeed(S.beastExchange.level)')-before.progress);
  if(trades<1)break;
  const action=run(`exchangeBonesForMedals(${trades})`);assert.equal(action?.ok,true);
  boneActions.push({before,trades,action,after:state()});
  if(state().progress===run('beastExchangeProgressNeed(S.beastExchange.level)'))assert.equal(run('upgradeBeastExchange()')?.ok,true);
}
assert.equal(run('save().ok'),true);
const final=state(),finalStock=stock(),finalText=env.store.get('rts_save');
assert.equal(final.queueCount,0,'last battle is not followed by a new training queue');
assert.ok(Object.values(finalStock).every(x=>Number.isFinite(x)&&x>=0));
const finalReload=environment({rts_save:finalText});assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('S.res.bone'),final.bone);assert.equal(finalReload.run('S.res.hide'),final.hide);
assert.equal(finalReload.run('S.killValues.wildWyrm'),final.alert);
const finalFile=data+`p347-wild-short-session-${intervalHours}h-save.json`,reportFile=data+`p347-wild-short-session-${intervalHours}h.json`;
fs.writeFileSync(path.join(root,finalFile),finalText,'utf8');
const marketEvents=run('([...__marketEvents])'),marketPurchases=run('([...__marketPurchases])'),marketUpgrades=run('([...__marketUpgrades])');
assert.ok(marketEvents.length>0);
assert.equal(offlineWindows.length,maxBattles-1);
assert.equal(offlineSeconds,(maxBattles-1)*intervalSeconds);
assert.equal(loginClaims.length,maxBattles-1);
assert.equal(marketEvents.filter(x=>x.kind==='offer-roll'&&x.phase==='manual').length,beforeStoredRefreshes.charges);
const baseline=JSON.parse(fs.readFileSync(path.join(root,data+'p343-wild-paid-recovery.json'),'utf8'));
const paired=[];
for(let i=0;i<rounds.length;i++){
  paired.push(rounds[i].battle.result===baseline.rounds[i]?.battle.result&&
    rounds[i].battle.after.deployed===baseline.rounds[i]?.battle.after.deployed&&
    rounds[i].battle.after.alert===baseline.rounds[i]?.battle.after.alert);
}
const actualTraining=run('({...__actualTraining})');
const rngDraws=run('({...__rngDraws})');
const offerRollsByPhase=Object.fromEntries(['online','offline','manual'].map(phase=>[phase,marketEvents.filter(x=>x.kind==='offer-roll'&&x.phase===phase).length]));
const report={batch:'P347',kind:'real offline intervals between paid battle sessions, with manual check-in purchases',intervalHours,intervalSeconds,
  pairedBattles:paired.filter(Boolean).length,pairedFlags:paired,
  sourceFile,sourceSha256:sha(sourceText),rosterFile,rosterSha256:sha(rosterText),rngStart:prior.final.rng,
  unit:'simulated wall-clock milliseconds, online and offline seconds, resource quantities, soldiers, bone and hide',
  initial,initialStock,initialClaim,rounds,offlineWindows,loginClaims,final,finalStock,
  onlineSeconds,offlineSeconds,phases,minFood,actualTraining,maxBattles,rngDraws,offerRollsByPhase,
  marketEvents,marketPurchases,marketUpgrades,beforeFinalClaim,beforeStoredRefreshes,beforeBones,boneActions,finalFile,finalSha256:sha(finalText),
  limits:['The input is a selected historically paid late-game checkpoint, not a fresh player population or random win-rate sample.',
    'Every loss is replenished to the historical 626-deployed roster using actual production, costs, training and formation actions.',
    'There are 30 battle sessions and 29 true offline windows. Wall time advances by one second for each online tick, and by the configured interval while away; battle animation wall time is treated as zero.',
    'At each login the player checks and purchases the then-current affordable offers. At the end they check once more and spend stored manual refresh charges; no automatic purchase occurs during offline settlement.',
    'The shared deterministic RNG continues across simulated save reloads so the scenarios are reproducible. Offline offer rolls alter later combat RNG; pairedBattles is descriptive and not a causal combat estimate.',
    'The mother-game audit records a Lv25 passive offline exchange reward for windows at least 900 seconds. The current player code has no equivalent; this replay does not inject such bone, medal, or deed rewards.',
    'VM localStorage/DOM/timers verify actual action functions and save reload but do not substitute for Edge or Android browser validation.',
    'The bounded battle horizon cannot establish level-60 reachability or long-term profit.']};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(sourceText));
assert.equal(sha(fs.readFileSync(path.join(root,rosterFile),'utf8')),sha(rosterText));
console.log(JSON.stringify({intervalHours,initial,initialClaim,pairedBattles:report.pairedBattles,wins:rounds.filter(x=>x.battle.result==='win').length,
  offlineWindows:offlineWindows.length,onlineSeconds,offlineSeconds,minFood,rngDraws,offerRollsByPhase,
  marketPurchases:marketPurchases.length,marketByKind:Object.fromEntries([...new Set(marketPurchases.map(x=>x.kind))].map(k=>[k,marketPurchases.filter(x=>x.kind===k).length])),
  marketUpgrades,beforeFinalClaim,beforeStoredRefreshes,beforeBones,boneActions,final,finalStock,actualTraining,reportFile,finalFile,finalSha256:report.finalSha256},null,2));
