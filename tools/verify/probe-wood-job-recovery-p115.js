'use strict';
// P115: measure whether a small coal-to-wood job transfer clears the archer
// replacement queue after the deterministic high-pressure P114 first defeat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const cases=[
  {woodFrom:'coal',woodWorkers:1,waitSeconds:155},
  {woodFrom:'coal',woodWorkers:1,waitSeconds:156},
  {woodFrom:'coal',woodWorkers:1,waitSeconds:157},
  {woodFrom:'coal',woodWorkers:1,waitSeconds:158},
  {woodFrom:'coal',woodWorkers:2,waitSeconds:79},
  {woodFrom:'coal',woodWorkers:3,waitSeconds:53},
  {woodFrom:'stone',woodWorkers:1,waitSeconds:158},
  {woodFrom:'stone',woodWorkers:1,waitSeconds:600}
];

function runCase({woodFrom,woodWorkers,waitSeconds}){
  const args=[campaignProbe,'--battle-random=0.9','--retry-first-loss',
    '--recovery-wait-seconds='+waitSeconds,'--recovery-wood-workers='+woodWorkers,
    '--recovery-wood-from='+woodFrom];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  const data=JSON.parse(result.stdout);
  assert.equal(data.battleRandom,0.9);
  const baseline=data.results.find(window=>window.extraSecondsPerWin===0);
  assert.ok(baseline,'缺少0秒每胜等待基线');
  return{woodFrom,woodWorkers,waitSeconds,branches:['current','frontloadedMetal','frontloadedFood'].map(key=>{
    const branch=baseline[key];
    const recovery=branch.defeatRecovery;
    assert.ok(recovery,'高压剖面应触发首次败战恢复');
    assert.equal(recovery.activeWaitSeconds,waitSeconds);
    assert.equal(recovery.recoveryWorkforceChange.count,woodWorkers);
    assert.equal(recovery.recoveryWorkforceChange.from,woodFrom);
    assert.equal(recovery.recoveryWorkforceChange.before[woodFrom]-
      recovery.recoveryWorkforceChange.after[woodFrom],woodWorkers);
    assert.equal(recovery.recoveryWorkforceChange.after.wood-
      recovery.recoveryWorkforceChange.before.wood,woodWorkers);
    return{rewardMode:branch.rewardMode,firstLoss:recovery.firstLoss,
      recoveryWorkforceChange:recovery.recoveryWorkforceChange,
      trainingAttempts:recovery.trainingAttempts.map(item=>({type:item.type,requested:item.requested,
        ok:item.result.ok,qty:item.result.qty})),
      beforeRetry:{army:recovery.beforeRetry.army,queue:recovery.beforeRetry.queue,
        queueReasons:recovery.beforeRetry.queueReasons,resources:recovery.beforeRetry.resources,
        trainingBudget:recovery.beforeRetry.trainingBudget},
      retry:{win:recovery.retry.outcome.win,round:recovery.retry.outcome.round,
        army:recovery.retry.outcome.byType}};
  })};
}

const casesRun=cases.map(runCase);
const artifact={batch:'P115',
  unit:'coal and wood workers; simulated recovery seconds; replacement counts; resources; same-stage retry outcome',
  method:'P102 actual first-loss route with constant Math.random=0.9; move the stated number of existing coal workers to wood after defeat; queue replacement units; tick the real economy and training queue; retry the same stage',
  scope:'one 18-person early-route economy and three reward/role branches; deterministic stress profile only, not a win-rate sample; test exact wood-cost boundary for six base archers',
  cases:casesRun};
const rawPath=path.join(root,'docs/codex/reports/data/p115-wood-job-recovery.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P115',cases:casesRun.map(item=>({woodFrom:item.woodFrom,
  woodWorkers:item.woodWorkers,waitSeconds:item.waitSeconds,branches:item.branches.map(branch=>({rewardMode:branch.rewardMode,
    beforeRetryArmy:branch.beforeRetry.army,archerQueue:branch.beforeRetry.queue.archer,
    wood:branch.beforeRetry.resources.wood,archerAffordable:branch.beforeRetry.trainingBudget.archer.maxAffordable,
    retryWin:branch.retry.win,retryArmy:branch.retry.army}))})),rawData:rawPath},null,2));
