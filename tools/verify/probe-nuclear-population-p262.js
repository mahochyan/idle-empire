'use strict';
// P262: grow the paid P80 nuclear checkpoint through real market, housing, birth and jobs.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p80-pop214-paid.json';
const outputFile='docs/codex/reports/data/p262-nuclear-pop1002-paid-save.json';
const reportFile='docs/codex/reports/data/p262-nuclear-pop1002-paid.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
assert.equal(run('popCurrent()'),214);
assert.equal(run('S.settlements.city'),50);
assert.ok(run('S.res.medal')>=800000);
assert.equal(run('S.sciences.includes("sci_nuclear_age")'),false);
const start=run("({tick:S.tick,pop:popCurrent(),capacity:maxPop(),city:S.settlements.city,stone:S.res.stone,food:S.res.food,techCap:resCap('tech'),coinCap:resCap('coin'),medal:S.res.medal,army:armyCount(),defeated:S.defeated.length})");
const targetCity=247,initialFoodWorkers=run('S.popAlloc.food');
assert.equal(run("setPopAlloc('tech',0)")?.ok,true);
const foodPerWorker=run("CFG.food.res.food.basePerPop*(1+buildingBuff('food'))");
const openingFood=Math.ceil((run('totalUpkeep()')+run('popCurrent()')*run('CFG.popFoodCost')+20)/foodPerWorker);
assert.ok(openingFood<214);
assert.equal(run(`setPopAlloc('food',${openingFood})`)?.ok,true);
assert.equal(run(`setPopAlloc('stone',${214-openingFood})`)?.ok,true);
const startNet=run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost");
assert.ok(startNet>0,`starting food net ${startNet}`);
let waited=0,marketActions=0,cityActions=0,deedsBought=0,stoneSold=0,minFood=start.food;
const stages=[];
function waitFor(condition,max=100000){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${condition})&&n<${max}){tick();n++;if(S.res.food<min)min=S.res.food}return{seconds:n,reached:!!(${condition}),minFood:min}})()`);
  assert.equal(r.reached,true,`wait ${condition} failed`);
  waited+=r.seconds;minFood=Math.min(minFood,r.minFood);
  return r.seconds;
}
while(run('S.settlements.city')<targetCity){
  const oldCity=run('S.settlements.city');
  const batch=Math.min(10,targetCity-oldCity);
  let need=run(`(()=>{let n=0;for(let lv=${oldCity};lv<${oldCity+batch};lv++)n+=settlementCostAt('city',lv);return n})()`);
  assert.ok(Number.isSafeInteger(need)&&need>0);
  const batchCost=need;
  while(need>0){
    const qty=Math.min(300,need);
    const rate=run("CFG.market.rates.find(r=>r.from==='stone'&&r.to==='coin'&&r.early).rate");
    const roughStone=Math.ceil(Math.max(0,qty*100-run('S.res.coin'))/rate)+10;
    assert.ok(roughStone<run("resCap('stone')"));
    waitFor(`S.res.stone>=${roughStone}`,100000);
    const quote=run(`previewDeedPurchase('stone',${qty})`);
    assert.equal(quote.ok,true,`market quote ${JSON.stringify(quote)}`);
    assert.ok(quote.coinCost<=run("resCap('coin')"));
    assert.ok(quote.sourceCost<=run("resCap('stone')"));
    waitFor(`S.res.stone>=${quote.sourceCost}`,100000);
    const oldStone=run('S.res.stone');
    const result=run(`buyDeedsWithResource('stone',${qty},${quote.sourceCost},${quote.startingDeed})`);
    assert.equal(result?.ok,true,`market ${JSON.stringify(result)}`);
    assert.ok(Math.abs(oldStone-run('S.res.stone')-quote.sourceCost)<1e-6);
    stoneSold+=quote.sourceCost;deedsBought+=qty;marketActions++;need-=qty;
  }
  const oldDeed=run('S.res.deed'),oldPop=run('popCurrent()');
  assert.ok(oldDeed>=batchCost);
  const grown=run(`upgradeSettlementBatch('city',${batch},${oldCity},${oldDeed})`);
  assert.equal(grown?.ok,true,`city ${oldCity} ${JSON.stringify(grown)}`);
  assert.equal(oldDeed-run('S.res.deed'),batchCost);
  cityActions++;
  waitFor('popCurrent()===maxPop()',10000);
  assert.equal(run('popCurrent()'),oldPop+batch*4);
  let food=run('S.popAlloc.food');
  const available=run('popCurrent()')-run('popAllocTotal()');
  for(let n=0;n<available;n++){
    const net=run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost");
    if(net>=20)break;
    food++;
    assert.equal(run(`setPopAlloc('food',${food})`)?.ok,true);
  }
  assert.equal(run(`setPopAlloc('stone',${run('popCurrent()')-food})`)?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>=20);
  assert.ok(run('S.res.food')>0);
  stages.push({city:run('S.settlements.city'),population:run('popCurrent()'),tick:run('S.tick'),stoneWorkers:run('S.popAlloc.stone'),foodWorkers:food,batchDeeds:batchCost,coinCap:run("resCap('coin')")});
}
assert.equal(run('popCurrent()'),1002);
assert.equal(run('maxPop()'),1002);
assert.equal(run('S.settlements.city'),targetCity);
assert.equal(run('S.res.medal'),start.medal);
assert.equal(run('S.defeated.length'),start.defeated);
assert.equal(run('armyCount()'),start.army);
assert.equal(run('S.sciences.includes("sci_nuclear_age")'),false);
assert.equal(run('save().ok'),true);
const final=e.store.get('rts_save'),saved=JSON.parse(final);
const reloaded=environment({rts_save:final});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run('popCurrent()'),1002);
assert.equal(reloaded.run('S.settlements.city'),targetCity);
assert.equal(reloaded.run('S.res.medal'),start.medal);
fs.writeFileSync(path.join(root,outputFile),final,'utf8');
const report={batch:'P262',unit:'simulated online seconds and resource units',sourceFile,sourceSha256:sha(raw),outputFile,outputSha256:sha(final),
  head:'406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d',start,finish:{tick:saved.tick,pop:saved.population.current,capacity:reloaded.run('maxPop()'),city:saved.settlements.city,
    stone:saved.res.stone,food:saved.res.food,techCap:reloaded.run("resCap('tech')"),stoneCap:reloaded.run("resCap('stone')"),woodCap:reloaded.run("resCap('wood')"),
    medal:saved.res.medal,foodWorkers:saved.popAlloc.food,stoneWorkers:saved.popAlloc.stone,netFood:reloaded.run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")},
  elapsedOnlineSeconds:saved.tick-start.tick,waitedSeconds:waited,minFood,actions:{market:marketActions,cityBatch:cityActions,foodWorkerIncrease:saved.popAlloc.food-initialFoodWorkers},
  payments:{deedsBought,stoneSold},stages};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({start:report.start,finish:report.finish,elapsedOnlineSeconds:report.elapsedOnlineSeconds,minFood,actions:report.actions,payments:report.payments,outputSha256:report.outputSha256}));
