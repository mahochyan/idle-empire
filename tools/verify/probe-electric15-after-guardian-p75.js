'use strict';
// P75：守御4000、4100连续实付材料之后，真实学者岗位产知识，支付电力科研15级。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p75-guardian4100-first-win-paid.json'),'utf8');
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.killValues.godGuardian'),4200);
assert.equal(run('S.items.guardianStone'),313);
assert.equal(run('S.eraStorage.electricKnowledge'),14);
const start=run('S.tick');
const cost=run("eraStorageCost('electricKnowledge')");
assert.equal(cost.tech,30000000);
assert.equal(cost.guardianStone,300);
assert.ok(run("resCap('tech')")>=cost.tech);
const current=run('({...S.popAlloc})');
for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
assert.equal(run("setPopAlloc('food',90)")?.ok,true);
assert.equal(run("setPopAlloc('tech',36)")?.ok,true);
assert.equal(run('popAllocTotal()'),126);
const grossTech=run("prodRate('tech')");
const netFood=run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost");
assert.ok(grossTech>0&&netFood>0);
const waited=run(`(()=>{let n=0;while(S.res.tech<${cost.tech}&&n<120000){tick();n++}return{n,ready:S.res.tech>=${cost.tech}}})()`);
assert.equal(waited.ready,true);
assert.equal(run('S.tick')-start,waited.n);
const before=run("({tech:S.res.tech,stone:S.items.guardianStone,lv:S.eraStorage.electricKnowledge,cap:resCap('tech')})");
const result=run("upgradeEraStorage('electricKnowledge')");
assert.equal(result?.ok,true);
assert.equal(result.level,15);
assert.equal(before.tech-run('S.res.tech'),cost.tech);
assert.equal(before.stone-run('S.items.guardianStone'),cost.guardianStone);
assert.equal(run('S.items.guardianStone'),13);
assert.equal(run('S.eraStorage.electricKnowledge'),15);
const after=run("({tech:S.res.tech,stone:S.items.guardianStone,lv:S.eraStorage.electricKnowledge,cap:resCap('tech'),food:S.res.food,army:armyCount()})");
const second=run("upgradeEraStorage('electricKnowledge')");
assert.equal(second?.ok,false);
assert.deepEqual(run("({tech:S.res.tech,stone:S.items.guardianStone,lv:S.eraStorage.electricKnowledge,cap:resCap('tech'),food:S.res.food,army:armyCount()})"),after);
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
const check=environment({rts_save:raw});
assert.equal(check.run('loadSaveAndApply().status'),'ok');
assert.equal(check.run('S.eraStorage.electricKnowledge'),15);
assert.equal(check.run('S.items.guardianStone'),13);
assert.equal(check.run('armyCount()'),after.army);
if(finalArg)fs.writeFileSync(path.resolve(finalArg.slice('--snapshot-final='.length)),raw);
console.log(JSON.stringify({unit:'simulated online seconds; knowledge points; guardian stones; soldiers',
  sourceTick:start,finalTick:saved.tick,elapsed:saved.tick-start,waited:waited.n,
  grossTechPerSecond:grossTech,netFoodPerSecond:netFood,cost,before,after,
  finalSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  nextCost:run("eraStorageCost('electricKnowledge')"),nuclearTechCapShortfall:100000000-after.cap},null,2));
