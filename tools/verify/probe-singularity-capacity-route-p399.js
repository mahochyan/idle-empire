'use strict';
// Bounded, real-action checkpoint for the immediate 5b knowledge-cap gate.
// The later levels and scroll count are separately labelled conditional.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile=path.join(root,'docs/codex/reports/data/p397-quantum-stage100-paid-save.json');
const outputFile=path.join(root,'docs/codex/reports/data/p399-singularity-capacity-route.json');
const raw=fs.readFileSync(sourceFile,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceSha=sha(raw),env=environment({rts_save:raw}),run=env.run;
const load=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(load),load);
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  food:S.res.food,quantumKnowledge:S.eraStorage.quantumKnowledge,
  revivalLeaf:S.items.revivalLeaf,scrollUsed:S.beastExchange.scrollUsed,
  scrollStock:S.items.storageScroll,marketLevel:S.beastExchange.level})`);
const start=state();
assert.equal(start.quantumKnowledge,0);
assert.equal(start.cap,3017311895);
assert.equal(run('setPopAlloc("steel",0).ok'),true);
assert.equal(run('setPopAlloc("tech",902).ok'),true);
const rates=run(`({techPerSec:prodRate('tech'),foodPerSec:prodRate('food'),
  foodCostPerSec:totalUpkeep()+popCurrent()*CFG.popFoodCost})`);
assert.ok(rates.foodPerSec>rates.foodCostPerSec);
const cost=run("eraStorageCost('quantumKnowledge')");
assert.deepEqual(JSON.parse(JSON.stringify(cost)),{tech:500000000});
// Actual engine advances every second and applies the supplied offline ratio.
const offline=run('offlineAdvanceSec(35000,0.6)');
assert.equal(offline.elapsed,35000);
assert.equal(offline.foodClamped,false);
const beforePay=state();
assert.ok(beforePay.tech>=cost.tech);
const payment=run("upgradeEraStorage('quantumKnowledge')");
assert.equal(payment.ok,true,JSON.stringify(payment));
const afterPay=state();
assert.equal(afterPay.quantumKnowledge,1);
assert.equal(afterPay.tech,beforePay.tech-cost.tech);
assert.ok(afterPay.cap>beforePay.cap);
assert.equal(run('save().ok'),true);
const paidRaw=env.store.get('rts_save');
const reload=environment({rts_save:paidRaw});
assert.ok(['ok','migrated'].includes(reload.run('loadSaveAndApply().status')));
assert.equal(reload.run("S.eraStorage.quantumKnowledge"),1);
assert.equal(reload.run("resCap('tech')"),afterPay.cap);
// No conditional level is written back to the paid save.
const conditional=run(`(()=>{const oldLevel=S.eraStorage.quantumKnowledge,
    oldScroll=S.beastExchange.scrollUsed,rows=[];
  for(const level of [5,6,7]){
    S.eraStorage.quantumKnowledge=level;
    for(const scrollUsed of (level===5?[133,157,158]:[133])){
      S.beastExchange.scrollUsed=scrollUsed;
      rows.push({level,scrollUsed,cap:resCap('tech'),nextCost:eraStorageCost('quantumKnowledge')});
    }
  }
  S.eraStorage.quantumKnowledge=oldLevel;
  S.beastExchange.scrollUsed=oldScroll;
  return rows;
})()`);
assert.equal(conditional.find(x=>x.level===5&&x.scrollUsed===157).cap<5000000000,true);
assert.equal(conditional.find(x=>x.level===5&&x.scrollUsed===158).cap>=5000000000,true);
assert.equal(conditional.find(x=>x.level===7&&x.scrollUsed===133).cap>=5000000000,true);
assert.equal(sha(fs.readFileSync(sourceFile,'utf8')),sourceSha);
const report={source:'docs/codex/reports/data/p397-quantum-stage100-paid-save.json',
  sourceSha256:sourceSha,load,start,rates,offlineSeconds:35000,offlineRatio:0.6,
  offline,beforePay,payment,afterPay,reload:{level:1,cap:afterPay.cap},
  paidSaveSha256:sha(paidRaw),conditional,
  remaining:{level5KnowledgeCost:7000000000,
    level5AdditionalScrolls:25,nominalBeastMaterialsFor25Scrolls:5000,
    level6And7RevivalLeafCost:7800},
  note:'Only the first quantum knowledge upgrade was paid and reloaded. Remaining levels, scroll purchases, 5b research and 5m medals were not paid.'};
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:sourceSha,load,start,rates,
  offlineSeconds:35000,beforePay,payment,afterPay,
  conditional:conditional.map(({level,scrollUsed,cap})=>({level,scrollUsed,cap})),
  output:path.relative(root,outputFile)}));
