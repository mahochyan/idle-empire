'use strict';
// P148 isolates queue reservation from resource payment using a real saved
// checkpoint and the current train()/processQueue() implementations.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p145Path=path.join(root,'docs/codex/reports/data/p145-short-session-food-budget.json');
const outputPath=path.join(root,'docs/codex/reports/data/p148-training-queue-affordability.json');
const p145=JSON.parse(fs.readFileSync(p145Path,'utf8'));
const startSave=p145.diagnostic?.startSave;
assert.equal(typeof startSave,'string','P145缺少隔离的第4关战后save检查点');

const unitTypes=['infantry','archer','bronze_guard'];
function runScenario(unitType){
  const env=environment({rts_save:startSave});
  const run=env.run;
  const loaded=run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(loaded.status),'P145隔离检查点无法重载');
  const cost=run(`({...CFG.units['${unitType}'].cost})`);
  const costKeys=run(`trainingCostKeys(CFG.units['${unitType}'].cost)`);
  assert.ok(costKeys.length>0,`${unitType}没有可测试的资源费用`);
  assert.ok(costKeys.every(key=>cost[key]>0),`${unitType}应有正数训练费用`);
  const originalFormationCount=run(`expeditionCount('${unitType}')`);
  run(`(()=>{S.queue={};S.pool['${unitType}']=0;
    for(const row of ['front','mid','back'])S.formation[row]=S.formation[row].filter(u=>u.type!=='${unitType}');
    for(const key of ${JSON.stringify(costKeys)})S.res[key]=0;})()`);
  const initial=run(`JSON.parse(JSON.stringify({resources:S.res,capacity:unitCapLeft('${unitType}'),
    lock:trainLockReason('${unitType}'),queue:S.queue['${unitType}']||null,
    pool:S.pool['${unitType}']||0,formation:expeditionCount('${unitType}'),
    garrison:garrisonCount('${unitType}')}))`);
  assert.equal(initial.lock,'',`${unitType}在P145检查点应已满足建筑/科技门槛`);
  assert.equal(initial.formation,0,'检查点应已退出出战编队');
  assert.equal(initial.garrison,0,'检查点不应占用驻军槽位');
  assert.ok(initial.capacity>0,`${unitType}没有可生产上限`);

  // Isolate one unit order in the test harness. Clear that unit from the
  // fixture roster and set only its training resources to zero; no browser
  // save is loaded or written.
  const beforeQueue=run(`(()=>{S.queue={};S.pool['${unitType}']=0;
    for(const key of ${JSON.stringify(costKeys)})S.res[key]=0;
    return{resources:{...S.res},pool:S.pool['${unitType}'],capacity:unitCapLeft('${unitType}')};})()`);
  const queued=run(`train('${unitType}',1)`);
  assert.equal(queued?.ok,true,`${unitType}无训练资源时应可调用真实train()排队：${JSON.stringify(queued)}`);
  const afterQueue=run(`JSON.parse(JSON.stringify({resources:S.res,queue:S.queue['${unitType}'],pool:S.pool['${unitType}']}))`);
  const savedAfterQueue=run(`JSON.parse(localStorage.getItem('rts_save'))`);
  for(const key of costKeys)assert.equal(afterQueue.resources[key],beforeQueue.resources[key],`${unitType}入队不应提前扣${key}`);
  assert.equal(afterQueue.queue.count,1);
  assert.equal(afterQueue.pool,0);
  assert.equal(savedAfterQueue.queue[unitType].count,1,`${unitType}真实train()应保存队列`);
  for(const key of costKeys)assert.equal(savedAfterQueue.res[key],beforeQueue.resources[key],`${unitType}入队存档不应提前扣${key}`);

  const blocked=run('processQueue()');
  assert.equal(blocked?.ok,true,'真实processQueue应可运行');
  const afterBlocked=run(`JSON.parse(JSON.stringify({resources:S.res,queue:S.queue['${unitType}'],
    pool:S.pool['${unitType}']}))`);
  assert.equal(afterBlocked.queue.count,1,`${unitType}资源为0时不应产出`);
  assert.equal(afterBlocked.queue.reason,'资源不足，暂停生产',`${unitType}应给出资源暂停原因`);
  assert.equal(afterBlocked.pool,0);

  for(const key of costKeys)run(`S.res['${key}']=CFG.units['${unitType}'].cost['${key}']`);
  const produced=run('processQueue()');
  assert.equal(produced?.ok,true,'补足单兵费用后真实processQueue应可运行');
  const afterProduction=run(`JSON.parse(JSON.stringify({resources:S.res,queue:S.queue['${unitType}'],
    pool:S.pool['${unitType}']}))`);
  assert.equal(afterProduction.pool,1,`${unitType}补足费用后应实际产出1人`);
  assert.equal(afterProduction.queue.count,0,`${unitType}产出后队列应减少1人`);
  for(const key of costKeys)assert.equal(afterProduction.resources[key],0,`${unitType}产出时应扣除${key}费用`);
  const savedAfterProduction=run(`JSON.parse(localStorage.getItem('rts_save'))`);
  assert.equal(savedAfterProduction.queue[unitType].count,0,`${unitType}产出后真实队列存档应减少1人`);
  assert.equal(savedAfterProduction.pool[unitType],1,`${unitType}产出后真实兵池存档应增加1人`);
  for(const key of costKeys)assert.equal(savedAfterProduction.res[key],0,`${unitType}产出后真实存档应扣除${key}`);

  return{unitType,cost,costKeys,startingCheckpoint:{lock:initial.lock,capacity:initial.capacity,
    originalFormationCount},
    zeroResourceQueue:{before:beforeQueue,trainResult:queued,after:afterQueue},
    zeroResourceProduction:{processResult:blocked,after:afterBlocked},
    afterExactCostProvision:{processResult:produced,after:afterProduction}};
}

const scenarios=unitTypes.map(runScenario);
assert.equal(scenarios.length,3);
const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p145-short-session-food-budget.json',
  'tools/verify/probe-training-queue-affordability-p148.js'
];
const artifact={batch:'P148',unit:'resource units; queued soldiers; produced soldiers',
  method:'load the exact isolated P145 stage-4 post-victory save separately for each base troop; in the harness clear test queues and the tested unit from the roster, set only that troop\'s actual training-cost resources to zero, call real train() and processQueue(), then supply exactly one unit cost and call processQueue() again; verify the real harness save at queue and production boundaries',
  scope:'infantry, archer and bronze_guard queue semantics at a 19/19 stage-4 checkpoint; validates queue reservation separately from production affordability; no browser save',
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  scenarios,
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P148',scenarios:scenarios.map(s=>({unitType:s.unitType,cost:s.cost,
  zeroResourceQueueAccepted:s.zeroResourceQueue.trainResult.ok,
  resourcesAfterQueue:Object.fromEntries(s.costKeys.map(key=>[key,s.zeroResourceQueue.after.resources[key]])),
  blockedReason:s.zeroResourceProduction.after.queue.reason,
  producedAfterExactCost:s.afterExactCostProvision.after.pool,
  remainingQueue:s.afterExactCostProvision.after.queue.count,
  resourcesAfterProduction:Object.fromEntries(s.costKeys.map(key=>[key,s.afterExactCostProvision.after.resources[key]]))})),rawData:outputPath},null,2));
