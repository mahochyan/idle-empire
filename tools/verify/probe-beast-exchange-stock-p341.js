'use strict';
// Audit a real paid checkpoint and execute the immediately available exchange actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),r=e.run;
assert.ok(['ok','migrated'].includes(r('loadSaveAndApply().status')));
const stock=r(`({level:S.beastExchange.level,progress:S.beastExchange.progress,bone:S.res.bone,
  scrollUsed:S.beastExchange.scrollUsed,materials:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  offers:{heart:S.beastExchange.heartOffers,wild:S.beastExchange.wildOffers},
  refreshCharges:S.beastExchange.refreshCharges,refreshClock:S.beastExchange.refreshClock})`);
assert.equal(stock.level,30);assert.equal(stock.progress,165);assert.equal(stock.bone,39);
const need=r('Array.from({length:29},(_,i)=>beastExchangeProgressNeed(31+i)).reduce((a,b)=>a+b,0)');
const totalMaterial=Object.values(stock.materials).reduce((a,b)=>a+b,0);
const cheapestCost=r('Math.ceil(CFG.beastExchange.heartPerScroll*0.1)');
const hypotheticalMaxScrollTrades=Object.values(stock.materials).reduce((sum,n)=>sum+Math.floor(n/cheapestCost),0);
const boneCostAt31=r('Math.ceil(CFG.beastExchange.bonePerTrade*(5+31-1)/5)');
const perfectWyrmBoneRoute=r(`(()=>{let alert=S.killValues.wildWyrm,bone=S.res.bone,wins=0;
  while(bone<702380&&wins<10000){const encounter=materialDomainEncounter('wyrmSinew',alert);
    bone+=encounter.reward.bone;alert=encounter.nextKillValue;wins++}
  const next=materialDomainEncounter('wyrmSinew',alert);
  return{wins,alert,bone,nextEnemyHp:next.units.wild_wyrm[0],nextStatScale:next.bossMult.atk}})()`);
assert.equal(need,6960);assert.equal(totalMaterial,7581);assert.equal(cheapestCost,20);
assert.equal(hypotheticalMaxScrollTrades,376);assert.equal(boneCostAt31,70);
const upgrade=r('upgradeBeastExchange()');assert.equal(upgrade?.ok,true);assert.equal(upgrade.level,31);
const trade=r("exchangeWildMaterialForScrolls('bullHorn',1)");
assert.equal(trade?.ok,true);assert.equal(trade.cost,200);
const after=r(`({level:S.beastExchange.level,progress:S.beastExchange.progress,bone:S.res.bone,
  bullHorn:S.items.bullHorn,storageScroll:S.items.storageScroll,offers:S.beastExchange.wildOffers.bullHorn.count})`);
assert.deepEqual(JSON.parse(JSON.stringify(after)),{level:31,progress:1,bone:39,bullHorn:1346,storageScroll:1,offers:0});
const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.deepEqual(JSON.parse(JSON.stringify(reload.run(`({level:S.beastExchange.level,progress:S.beastExchange.progress,bone:S.res.bone,
  bullHorn:S.items.bullHorn,storageScroll:S.items.storageScroll,offers:S.beastExchange.wildOffers.bullHorn.count})`))),JSON.parse(JSON.stringify(after)));
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const out='docs/codex/reports/data/p341-beast-exchange-stock.json';
const report={sourceFile,sourceSha256:sha(raw),unit:'trade count, resources, online seconds',stock,
  progressRequired31To60:need,boneOnlyCost:702380,cheapestTheoreticalScrollCost:cheapestCost,
  totalMaterial,hypotheticalMaxScrollTrades,
  hypotheticalShortfallAfterAllInventory:need-hypotheticalMaxScrollTrades,
  boneCostAt31,perfectWyrmBoneRoute,upgrade,trade,after,reloaded:true,
  limits:['376 is a generous impossible-to-exceed ceiling using the current inventory alone: every trade is assumed to receive the rare 10% price, sufficient offers and no capacity issue.',
    'The perfect wyrm route only sums configured rewards while alert rises, assumes every fight wins and ignores battles, recovery, scroll sales and market goods. It is a pressure illustration, not a playable route.',
    'Inventory ceiling does not include future hunts, market goods, newly produced materials, or roster recovery.']};
fs.writeFileSync(path.join(root,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:sha(raw),progressRequired31To60:need,
  totalMaterial,hypotheticalMaxScrollTrades,hypotheticalShortfallAfterAllInventory:report.hypotheticalShortfallAfterAllInventory,
  boneCostAt31,perfectWyrmBoneRoute,upgrade,trade,after,reloaded:true,out},null,2));
