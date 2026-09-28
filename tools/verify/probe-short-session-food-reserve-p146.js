'use strict';
// P146: replay the P145 stage-4 save through real settleOffline, first varying
// only departure food stock, then varying jobs through real setPopAlloc actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputPath=path.join(root,'docs/codex/reports/data/p145-short-session-food-budget.json');
const outputPath=path.join(root,'docs/codex/reports/data/p146-short-session-food-reserve.json');
const p145=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const startSave=p145.diagnostic?.startSave;
assert.equal(typeof startSave,'string','P145缺少战后结算前的隔离save()检查点');
const baselineFood=p145.diagnostic.before.resources.food;
const foodCapacity=p145.diagnostic.foodCap;
assert.ok(Number.isFinite(baselineFood)&&Number.isFinite(foodCapacity)&&foodCapacity>=baselineFood);

function settleScenario({foodStock,transferFrom=null,targetFoodWorkers=null}){
  const env=environment({rts_save:startSave});
  const run=env.run;
  const loaded=run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(loaded.status),'P145隔离检查点无法重载');
  assert.equal(run('popCurrent()'),19);
  assert.equal(run('maxPop()'),19);
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
  assert.ok(foodStock>=0&&foodStock<=foodCapacity,'测试库存超出真实粮仓范围');
  const before=run(`(()=>{S.res.food=${foodStock};return{tick:S.tick,food:S.res.food,workers:{...S.popAlloc},
    population:popCurrent(),capacity:maxPop(),army:{infantry:S.pool.infantry||0,archer:S.pool.archer||0,
      bronze_guard:S.pool.bronze_guard||0},queue:JSON.parse(JSON.stringify(S.queue)),resources:{...S.res}}})()`);
  run(`Date.now=()=>${startTs+28800*1000}`);
  const settled=run('settleOffline()');
  const after=run(`JSON.parse(JSON.stringify({tick:S.tick,food:S.res.food,resources:S.res,
    queue:S.queue,army:S.pool,report:S.offline.pendingReport}))`);
  assert.equal(settled.ok,true,'真实settleOffline失败：'+JSON.stringify(settled));
  return{startFood:foodStock,addedFood:foodStock-baselineFood,transferFrom,targetFoodWorkers,
    requestedSeconds:28800,
    durationSec:settled.durationSec,truncated:settled.truncated,gains:settled.gains,
    before,after};
}

const stocks=[...new Set([baselineFood,300,600,900,1200,1800,2400,foodCapacity]
  .map(value=>Math.min(foodCapacity,Math.max(baselineFood,value))))].sort((a,b)=>a-b);
const scenarios=stocks.map(foodStock=>settleScenario({foodStock}));
assert.equal(scenarios[0].durationSec,p145.diagnostic.settled.durationSec,
  '原始战后库存应复现P145离线推进时长');
assert.equal(scenarios[0].gains.food,p145.diagnostic.settled.gains.food,
  '原始战后库存应复现P145食物变化');
const laborScenarios=[];
for(const transferFrom of ['stone','coal','copper'])for(const targetFoodWorkers of [3,4]){
  laborScenarios.push(settleScenario({foodStock:baselineFood,transferFrom,targetFoodWorkers}));
}
assert.ok(scenarios.every(x=>x.durationSec<28800),
  '本批测试的任一粮食库存单独调整都不应被记为通过');
for(const scenario of laborScenarios){
  assert.equal(scenario.before.population,19);
  assert.equal(scenario.before.capacity,19);
  assert.equal(scenario.before.workers.food,scenario.targetFoodWorkers);
  assert.equal(Object.values(scenario.before.workers).reduce((sum,n)=>sum+n,0),19,
    '调岗前后岗位总数必须保持人口不变');
  assert.equal(scenario.durationSec,28800,
    `${scenario.transferFrom}->${scenario.targetFoodWorkers}粮工未完成8小时离线`);
  assert.equal(scenario.truncated,false);
  assert.equal(scenario.after.resources.food,foodCapacity);
  assert.equal(scenario.after.queue.bronze_guard.count,0);
  assert.equal(scenario.after.army.bronze_guard,9);
}

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p145-short-session-food-budget.json',
  'tools/verify/probe-short-session-food-reserve-p146.js'
];
const artifact={batch:'P146',unit:'initial food stock; offline seconds; food gains; people; jobs; queue; army',
  method:'reload the exact P145 pre-offline save into a fresh isolated harness per scenario; stock scenarios change only departure food, job scenarios use real setPopAlloc to transfer workers; all call real settleOffline() for 28800 seconds',
  scope:'P145 stage-4 post-win checkpoint; fixed 19/19 population, army, queue, offline ratio and time horizon; job scenarios compare 3/4 food workers moved from stone, coal or copper; no player browser save',
  sourceHead:require('node:child_process').spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  foodCapacity,baselineFood,scenarios,laborScenarios,
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
const summarize=x=>({startFood:x.startFood,addedFood:x.addedFood,transferFrom:x.transferFrom,
  targetFoodWorkers:x.targetFoodWorkers,durationSec:x.durationSec,
    truncated:x.truncated,gainFood:x.gains.food,endingFood:x.after.food,
    endingQueue:x.after.queue.bronze_guard?.count??0});
console.log(JSON.stringify({batch:'P146',foodCapacity,baselineFood,
  stockScenarios:scenarios.map(summarize),laborScenarios:laborScenarios.map(summarize),rawData:outputPath},null,2));
