'use strict';
// P147: test whether P146's temporary third-food-worker result survives when
// stone, coal and copper start empty or below their P145 stage-4 caps.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputPath=path.join(root,'docs/codex/reports/data/p145-short-session-food-budget.json');
const outputPath=path.join(root,'docs/codex/reports/data/p147-short-session-food-low-stock.json');
const p145=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const startSave=p145.diagnostic?.startSave;
assert.equal(typeof startSave,'string','P145缺少战后结算前的隔离save()检查点');
const baselineFood=p145.diagnostic.before.resources.food;

function summarizeScenario({stockRatio,transferFrom=null,targetFoodWorkers=2}){
  const env=environment({rts_save:startSave});
  const run=env.run;
  const loaded=run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(loaded.status),'P145隔离检查点无法重载');
  assert.equal(run('popCurrent()'),19);
  assert.equal(run('maxPop()'),19);
  const caps=run(`({stone:resCap('stone'),coal:resCap('coal'),copper:resCap('copper')})`);
  const startingStocks={
    stone:Math.floor(caps.stone*stockRatio),
    coal:Math.floor(caps.coal*stockRatio),
    copper:Math.floor(caps.copper*stockRatio)
  };
  run(`Object.assign(S.res,${JSON.stringify(startingStocks)})`);
  if(transferFrom){
    const oldFood=run('S.popAlloc.food||0');
    const oldSource=run(`S.popAlloc['${transferFrom}']||0`);
    const move=targetFoodWorkers-oldFood;
    assert.ok(move>0&&oldSource>=move,'非法粮工转岗候选');
    assert.equal(run(`setPopAlloc('${transferFrom}',${oldSource-move})`)?.ok,true,
      `${transferFrom}岗位减员失败`);
    assert.equal(run(`setPopAlloc('food',${targetFoodWorkers})`)?.ok,true,'粮工增员失败');
  }
  const startTs=run('_loadedTs');
  assert.ok(Number.isSafeInteger(startTs),'检查点缺少安全整数时间戳');
  const before=run(`JSON.parse(JSON.stringify({tick:S.tick,food:S.res.food,workers:S.popAlloc,
    population:popCurrent(),capacity:maxPop(),army:S.pool,queue:S.queue,resources:S.res}))`);
  assert.equal(before.food,baselineFood,'情景不得改变出发粮食库存');
  assert.equal(before.workers.food,targetFoodWorkers);
  assert.equal(Object.values(before.workers).reduce((sum,n)=>sum+n,0),19,
    '岗位转移不得增减人口');
  run(`Date.now=()=>${startTs+28800*1000}`);
  const settled=run('settleOffline()');
  assert.equal(settled.ok,true,'真实settleOffline失败：'+JSON.stringify(settled));
  const after=run(`JSON.parse(JSON.stringify({tick:S.tick,food:S.res.food,workers:S.popAlloc,
    population:popCurrent(),capacity:maxPop(),army:S.pool,queue:S.queue,resources:S.res,
    report:S.offline.pendingReport}))`);
  return{stockRatio,startingStocks,transferFrom,targetFoodWorkers,requestedSeconds:28800,
    durationSec:settled.durationSec,truncated:settled.truncated,gains:settled.gains,before,after};
}

const scenarios=[];
for(const stockRatio of [0,0.1,0.5]){
  scenarios.push(summarizeScenario({stockRatio,targetFoodWorkers:2}));
  for(const targetFoodWorkers of [3,4]){
    for(const transferFrom of ['stone','coal','copper']){
      scenarios.push(summarizeScenario({stockRatio,transferFrom,targetFoodWorkers}));
    }
  }
}
for(const scenario of scenarios){
  if(scenario.targetFoodWorkers===2){
    assert.equal(scenario.durationSec,p145.diagnostic.settled.durationSec,
      `${scenario.stockRatio}矿物库存的2粮工对照未复现P145`);
    assert.equal(scenario.truncated,true,'2粮工对照应保持当前粮食截断');
    assert.equal(scenario.after.queue.bronze_guard.count,2);
  }else{
    assert.equal(scenario.durationSec,28800,
      `${scenario.stockRatio}矿物库存、${scenario.transferFrom}转粮的候选未完成8小时`);
    assert.equal(scenario.truncated,false);
    assert.equal(scenario.after.queue.bronze_guard.count,0);
    assert.equal(scenario.after.army.bronze_guard,9);
    assert.equal(scenario.after.food,3000);
  }
}

const inputs=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p145-short-session-food-budget.json',
  'tools/verify/probe-short-session-food-low-stock-p147.js'
];
const artifact={batch:'P147',unit:'mineral starting stock; food workers; offline seconds; food and metal gains; queue; army',
  method:'reload the exact P145 pre-offline save into a fresh isolated harness for each case; set stone/coal/copper to 0%, 10% or 50% of their real caps, optionally transfer workers using real setPopAlloc, then call real settleOffline for 28800 seconds',
  scope:'P145 stage-4 post-win 19/19 checkpoint; same starting food, army, training queue and 8-hour horizon; compares 2 food workers against 3/4 workers transferred from stone, coal or copper; no player browser save',
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  baselineFood,scenarioCount:scenarios.length,scenarios,
  inputs:inputs.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P147',scenarios:scenarios.map(x=>({stockRatio:x.stockRatio,
  startingStocks:x.startingStocks,foodWorkers:x.targetFoodWorkers,transferFrom:x.transferFrom,
  durationSec:x.durationSec,truncated:x.truncated,foodEnd:x.after.food,
  foodGain:x.gains.food,stoneEnd:x.after.resources.stone,coalEnd:x.after.resources.coal,
  copperEnd:x.after.resources.copper,bronzeEnd:x.after.army.bronze_guard||0,
  bronzeQueueEnd:x.after.queue.bronze_guard?.count??0})),rawData:outputPath},null,2));
