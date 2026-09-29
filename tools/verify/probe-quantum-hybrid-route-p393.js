'use strict';
// From the immutable P390 paid save: price conditional scroll/storage combinations,
// then pay one actually offered scroll through the existing game actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source=path.join(root,'docs/codex/reports/data/p390-star-array-entry-paid-save.json');
const raw=fs.readFileSync(source,'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(raw),'aa54851f4e4a12848f56cb4b98ccd0eb52e2c62a4fdc066325f037a0ba37c25a');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply()').status,'migrated');
assert.equal(env.store.get('rts_save_premigration'),raw);
const start=run(`({tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  scrollUsed:S.beastExchange.scrollUsed,scrollStock:S.items.storageScroll,
  scrollLimit:CFG.beastExchange.scrollUseLimit,exchangeLevel:S.beastExchange.level,
  refreshCharges:S.beastExchange.refreshCharges,refreshSeconds:CFG.beastExchange.refreshSeconds,
  offerSlots:beastOfferSlots(S.beastExchange.level),offerWeight:CFG.beastExchange.scrollMaterials.length*CFG.beastExchange.heartOfferWeight,
  totalWeight:beastOfferTotalWeight(S.beastExchange.level),
  levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge},
  materials:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,revivalLeaf:S.items.revivalLeaf},
  wildStocks:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  currentOffers:{boarHeart:S.beastExchange.heartOffers,...Object.fromEntries(Object.entries(S.beastExchange.wildOffers).map(([k,v])=>[k,v.count]))},
  knowledgePercent:starArrayKnowledgePercent(),nextEraCosts:Object.fromEntries(['steamKnowledge','electricKnowledge','nuclearKnowledge'].map(k=>[k,eraStorageCost(k)])),
  currentRewards:Object.fromEntries(['godCrystal','guardianStone','revivalLeaf'].map(k=>[k,materialDomainEncounter(k).reward[k]]))})`);
assert.equal(start.knowledgePercent,0);
assert.equal(start.scrollUsed,130);
assert.equal(start.scrollLimit,500);
const base=run(`S.eraStorage.steamKnowledge=0;S.eraStorage.electricKnowledge=0;
  S.eraStorage.nuclearKnowledge=0;S.beastExchange.scrollUsed=0;resCap('tech')`);
const cfg=run(`({steam:CFG.eraStorage.steamKnowledge,electric:CFG.eraStorage.electricKnowledge,
  nuclear:CFG.eraStorage.nuclearKnowledge,scroll:CFG.beastExchange.scrollCapacityPerUse})`);
const sum=(from,to)=>to<from?0:(from+to)*(to-from+1)/2;
function capacity(s,e,n,scrolls){
  let cap=base;
  for(const level of [s,e,n])cap=Math.floor(cap*(1+level*0.1));
  return Math.floor(cap*(1+scrolls*cfg.scroll));
}
assert.equal(capacity(start.levels.steam,start.levels.electric,start.levels.nuclear,start.scrollUsed),start.cap);
function candidate(s,e,n,u){
  return{scrollUsed:u,extraScrolls:u-start.scrollUsed,
    levels:{steam:s,electric:e,nuclear:n},cap:capacity(s,e,n,u),
    extraTech:cfg.steam.techBase*sum(start.levels.steam+1,s)+
      cfg.electric.techBase*sum(start.levels.electric+1,e)+
      cfg.nuclear.techBase*sum(start.levels.nuclear+1,n),
    extraMaterials:{godCrystal:cfg.steam.lateCrystalBase*sum(start.levels.steam+1,s),
      guardianStone:cfg.electric.lateMaterialBase*sum(start.levels.electric+1,e),
      revivalLeaf:cfg.nuclear.lateMaterialBase*sum(start.levels.nuclear+1,n)}};
}
const target=run('activeSciences().sci_quantum_age.cost.tech');
const checkpoints=[];
for(const u of [130,200,300,400,500]){
  let best=null,passing=0;
  for(let s=start.levels.steam;s<=cfg.steam.maxLevel;s++)
    for(let e=start.levels.electric;e<=cfg.electric.maxLevel;e++)
      for(let n=start.levels.nuclear;n<=cfg.nuclear.maxLevel;n++){
        if(capacity(s,e,n,u)<target)continue;
        passing++;
        const c=candidate(s,e,n,u);
        if(!best||c.extraTech<best.extraTech)best=c;
      }
  assert.ok(best);
  checkpoints.push({...best,passing});
}
// Verify the actual capacity implementation in a separate VM, without a saved payment.
const verify=environment({rts_save:raw});
assert.equal(verify.run('loadSaveAndApply()').status,'migrated');
for(const c of checkpoints){
  const {steam,electric,nuclear}=c.levels;
  assert.equal(verify.run(`S.eraStorage.steamKnowledge=${steam};S.eraStorage.electricKnowledge=${electric};
    S.eraStorage.nuclearKnowledge=${nuclear};S.beastExchange.scrollUsed=${c.scrollUsed};resCap('tech')`),c.cap);
}
const scrollOnlyAtLimit=capacity(start.levels.steam,start.levels.electric,start.levels.nuclear,start.scrollLimit);
assert.equal(verify.run(`S.eraStorage.steamKnowledge=${start.levels.steam};
  S.eraStorage.electricKnowledge=${start.levels.electric};S.eraStorage.nuclearKnowledge=${start.levels.nuclear};
  S.beastExchange.scrollUsed=${start.scrollLimit};resCap('tech')`),scrollOnlyAtLimit);
assert.ok(scrollOnlyAtLimit<target);
// The P390 save has one currently offered wyrm trade, with sufficient real stock.
const paid=environment({rts_save:raw}),act=paid.run;
act(`globalThis.__clockMs=${JSON.parse(raw).ts};globalThis.__RealDate=Date;
  globalThis.Date=class extends __RealDate {
    constructor(...args){super(...(args.length?args:[__clockMs]))}
    static now(){return __clockMs}
  }`);
assert.equal(act('loadSaveAndApply()').status,'migrated');
const cost=act("beastScrollTradeCost('wyrmSinew')");
assert.equal(act("beastScrollOfferCount('wyrmSinew')"),1);
assert.ok(act('S.items.wyrmSinew')>=cost);
const before=act(`({cap:resCap('tech'),sinew:S.items.wyrmSinew,scrollStock:S.items.storageScroll,
  scrollUsed:S.beastExchange.scrollUsed,tech:S.res.tech,medal:S.res.medal})`);
const trade=act("exchangeWildMaterialForScrolls('wyrmSinew',1)");
assert.equal(trade.ok,true);
const use=act('useStorageScroll(1)');
assert.equal(use.ok,true);
const after=act(`({cap:resCap('tech'),sinew:S.items.wyrmSinew,scrollStock:S.items.storageScroll,
  scrollUsed:S.beastExchange.scrollUsed,tech:S.res.tech,medal:S.res.medal})`);
assert.equal(after.sinew,before.sinew-cost);
assert.equal(after.scrollUsed,before.scrollUsed+1);
assert.equal(after.scrollStock,before.scrollStock);
assert.equal(after.tech,before.tech);
assert.equal(after.medal,before.medal);
assert.ok(after.cap>before.cap);
const paidRaw=paid.store.get('rts_save');
const reload=environment({rts_save:paidRaw});
assert.equal(reload.run('loadSaveAndApply()').status,'ok');
assert.equal(reload.run("resCap('tech')"),after.cap);
assert.equal(reload.run('S.beastExchange.scrollUsed'),after.scrollUsed);
assert.equal(hash(fs.readFileSync(source,'utf8')),hash(raw));
// One normal eight-hour offline window establishes the independent medal source.
const medalEnv=environment({rts_save:raw}),medalRun=medalEnv.run;
medalRun(`globalThis.__clockMs=${JSON.parse(raw).ts};globalThis.__RealDate=Date;
  globalThis.Date=class extends __RealDate {
    constructor(...args){super(...(args.length?args:[__clockMs]))}
    static now(){return __clockMs}
  }`);
assert.equal(medalRun('loadSaveAndApply()').status,'migrated');
const medalBefore=medalRun(`({medal:S.res.medal,food:S.res.food,tech:S.res.tech,tick:S.tick})`);
medalRun('__clockMs+=28800000');
const offlineResult=medalRun('settleOffline()');
assert.equal(offlineResult.ok,true,JSON.stringify(offlineResult));
const medalAfter=medalRun(`({medal:S.res.medal,food:S.res.food,tech:S.res.tech,tick:S.tick})`);
assert.ok(medalAfter.medal>medalBefore.medal);
let extraMedalWindows=0;
if(process.argv.includes('--full-medal')){
  while(medalRun('S.res.medal')<3000000&&extraMedalWindows<30){
    medalRun('__clockMs+=28800000');
    const result=medalRun('settleOffline()');
    assert.equal(result.ok,true,JSON.stringify(result));
    extraMedalWindows++;
  }
  assert.ok(medalRun('S.res.medal')>=3000000,'medal offline route did not reach quantum cost');
}
const medalFinal=medalRun(`({medal:S.res.medal,food:S.res.food,tech:S.res.tech,tick:S.tick})`);
const medalReload=environment({rts_save:medalEnv.store.get('rts_save')});
assert.equal(medalReload.run('loadSaveAndApply()').status,'ok');
assert.equal(medalReload.run('S.res.medal'),medalFinal.medal);
console.log(JSON.stringify({source:path.relative(root,source).replaceAll('\\','/'),sourceSha256:hash(raw),
  scope:'Conditional cost search plus one actually paid initial scroll; no storage upgrades, domain wins, quantum payment or other scrolls credited.',
  start,base,target,scrollOnlyAtLimit,checkpoints,paidFirstScroll:{cost,trade,use,before,after,reloaded:true,paidSaveSha256:hash(paidRaw)},
  paidOfflineMedalWindow:{before:medalBefore,after:medalAfter,elapsedSeconds:medalAfter.tick-medalBefore.tick,
    gain:medalAfter.medal-medalBefore.medal,additionalEightHourWindows:extraMedalWindows,
    final:medalFinal,reloaded:true},
  scrollMarket:{minimumAdditionalWildMaterialsIfAllQuality10:Math.max(0,(start.scrollLimit-start.scrollUsed)*20-Object.values(start.wildStocks).reduce((a,b)=>a+b,0)),
    allFullQualityCost:(start.scrollLimit-start.scrollUsed)*200,
    expectedAllScrollOffersPerRefresh:start.offerSlots*start.offerWeight/start.totalWeight,
    note:'Material bound is across all six types and ignores offer mismatch. Expected refresh throughput assumes independent uniform rolls and every offer affordable.'}},null,2));
