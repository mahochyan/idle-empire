'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputFile='docs/codex/reports/data/p250-iron-point-l15-save.json';
const raw=fs.readFileSync(path.join(root,inputFile),'utf8');
const inputSha256=crypto.createHash('sha256').update(raw).digest('hex');
const snapshot='JSON.stringify({res:S.res,development:S.development,pool:S.pool,queue:S.queue,buildings:S.buildings,townLv:S.townLv,townUpgrade:S.townUpgrade,tick:S.tick})';
function arm(useCache){
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'ok');
  if(!useCache)e.run('var originalDevelopmentSecond=productionAndDevelopmentSecond;productionAndDevelopmentSecond=function(ratio,foodRule,allow){return originalDevelopmentSecond(ratio,foodRule,allow,null)}');
  const started=performance.now();
  const receipt=e.run('offlineAdvanceSec(3600,0.6)');
  const elapsedMs=performance.now()-started;
  assert.equal(receipt.elapsed,3600);
  return{receipt,snapshot:e.run(snapshot),elapsedMs};
}
const uncached=arm(false),cached=arm(true);
assert.equal(cached.snapshot,uncached.snapshot);

const day=environment({rts_save:raw});
assert.equal(day.run('loadSaveAndApply().status'),'ok');
day.run('_loadedTs=Date.now()-86400000');
const started=performance.now();
const dayReceipt=day.run('settleOffline()');
const dayElapsedMs=performance.now()-started;
assert.equal(dayReceipt.ok,true);
assert.equal(dayReceipt.durationSec,86400);
assert.equal(day.run('settleOffline().repeat'),true);
const persisted=day.store.get('rts_save');
const reloaded=environment({rts_save:persisted});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run(snapshot),day.run(snapshot));
const result={batch:'P267',inputFile,inputSha256,unit:'simulated offline seconds; wall-clock milliseconds',
  comparison:{durationSec:3600,uncachedMs:uncached.elapsedMs,cachedMs:cached.elapsedMs,equivalent:true,receipt:cached.receipt},
  day:{durationSec:86400,elapsedMs:dayElapsedMs,receipt:dayReceipt,iron:day.run('S.res.iron'),ironCap:day.run('resCap("iron")'),pointClock:day.run('S.development.border.collection.elapsedSec'),reloaded:true}};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p267-offline-cache.json'),JSON.stringify(result,null,2),'utf8');
console.log(JSON.stringify(result));
