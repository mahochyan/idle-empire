'use strict';
// P106: compare P102's original and four-scholar early routes after matching
// the food/copper/coal stocks at the first-campaign entry through real ticks.
// Development-only orchestration; it never writes the player's localStorage.
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const probe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
function runProbe(args){
  const result=spawnSync(process.execPath,[probe,...args],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
  assert.equal(result.status,0,`P102探针失败（${args.join(' ')}）：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function campaignSummary(data){
  return {entryState:data.entryState,windows:data.results.map(window=>({
    extraSecondsPerWin:window.extraSecondsPerWin,
    branches:[['ordinary',window.current],['metal',window.frontloadedMetal],['food',window.frontloadedFood]].map(([name,branch])=>{
      const stage6=branch.rows.find(row=>row.stage===6)||null;
      const stage3=branch.rows.find(row=>row.stage===3)||null;
      return {name,wins:branch.wins,blockedAt:branch.blockedAt,
        stage6:stage6?{win:stage6.win,byTypeBefore:stage6.byTypeBefore}:null,
        stage3FoodAfterReplenishment:stage3?.replenishment.resources.food??null,
        stage3QueueRemaining:stage3?.replenishment.remainingQueue??null};
    })
  }))};
}

const baseline=runProbe([]);
const floor=Object.fromEntries(['food','coal','copper'].map(key=>[key,baseline.entryState.resources[key]]));
const matched=runProbe(['--research-workers=4',`--entry-resource-floor=${JSON.stringify(floor)}`]);
assert.deepEqual(matched.entryState.population,baseline.entryState.population);
assert.deepEqual(matched.entryState.capacity,baseline.entryState.capacity);
assert.deepEqual(matched.entryState.army,baseline.entryState.army);
assert.deepEqual(matched.entryState.workers,baseline.entryState.workers);
assert.ok(matched.entryState.preBattleHoldSeconds>0,'四学者路线应需真实在线tick补齐库存');
for(const [key,value] of Object.entries(floor))assert.ok(matched.entryState.resources[key]>=value,
  `${key}未达到基线路线战前库存`);
assert.ok(Math.abs(matched.entryState.resources.food-floor.food)<1,'粮食检查点偏离基线超过1');
assert.ok(matched.entryState.resources.coal-floor.coal<=3,'煤库存检查点偏离基线超过单tick增量');
assert.equal(matched.entryState.resources.copper,floor.copper,'铜库存应保持与基线相同');
for(let i=0;i<baseline.results.length;i++){
  for(const key of ['current','frontloadedMetal','frontloadedFood']){
    const expected=baseline.results[i][key],actual=matched.results[i][key];
    assert.equal(actual.wins,expected.wins,`库存检查后${key}胜场应复现P102基线`);
    assert.equal(actual.blockedAt,expected.blockedAt,`库存检查后${key}阻塞关应复现P102基线`);
    assert.deepEqual(actual.rows.map(row=>({stage:row.stage,win:row.win,byTypeBefore:row.byTypeBefore})),
      expected.rows.map(row=>({stage:row.stage,win:row.win,byTypeBefore:row.byTypeBefore})),
      `库存检查后${key}战斗与青铜入场数应复现P102基线`);
  }
}

console.log(JSON.stringify({batch:'P106',unit:'simulated online seconds; people; resources; soldiers',
  method:'run P102 from both routes; after identical campaign preparation, let the four-scholar route idle through real tick() until it reaches P102 baseline food/coal/copper entry stocks',
  matchedResourceFloor:floor,baseline:campaignSummary(baseline),research4Matched:campaignSummary(matched)},null,2));
