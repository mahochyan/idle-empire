'use strict';
// P114: deterministic combat-random sensitivity for early campaign losses and recovery.
// Constant Math.random values are stress profiles, not seeds or win-rate samples.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const randomProfiles=[0.1,0.5,0.9];

function childJson(value,recoveryWaitSeconds=600){
  const args=[campaignProbe,`--battle-random=${value}`,
    '--retry-first-loss',`--recovery-wait-seconds=${recoveryWaitSeconds}`];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function summarizeBranch(branch){
  const rows=branch.rows.map(row=>({stage:row.stage,win:row.win,round:row.round,
    deployed:row.deployed,armyBefore:row.armyBefore,armyAfter:row.armyAfter,
    byTypeBefore:row.byTypeBefore,byTypeAfter:row.byTypeAfter,
    casualties:Object.fromEntries(Object.keys(row.byTypeBefore).map(type=>
      [type,row.byTypeBefore[type]-row.byTypeAfter[type]])),
    replenishment:row.replenishment?{beforeQueue:row.replenishment.beforeQueue,
      afterArmy:row.replenishment.afterArmy,queuedAtStart:row.replenishment.queuedAtStart,
      remainingQueue:row.replenishment.remainingQueue,
      resources:row.replenishment.resources}:null}));
  const recovery=branch.defeatRecovery||null;
  if(recovery){
    assert.equal(recovery.activeWaitSeconds,recovery.recoveryWaitSeconds,
      '败后恢复实耗秒数必须等于请求等待');
    assert.equal(recovery.firstLoss.populationBefore,recovery.firstLoss.populationAfterDefeat,
      '战斗失败不得减少居民');
    assert.equal(recovery.stage,recovery.firstLoss.stage,'重试阶段必须与首次失败阶段一致');
  }
  return{rewardMode:branch.rewardMode,extraSecondsPerWin:branch.extraSecondsPerWin,
    attempted:branch.attempted,wins:branch.wins,blockedAt:branch.blockedAt,
    rows,recovery:recovery?{stage:recovery.stage,recoveryWaitSeconds:recovery.recoveryWaitSeconds,
      activeWaitSeconds:recovery.activeWaitSeconds,
      firstLoss:recovery.firstLoss,afterDefeat:recovery.afterDefeat,
      trainingAttempts:recovery.trainingAttempts.map(item=>({type:item.type,
        requested:item.requested,ok:item.result.ok,qty:item.result.qty,reason:item.result.reason||null})),
      afterTraining:recovery.afterTraining,beforeRetry:recovery.beforeRetry,
      retry:{win:recovery.retry.outcome.win,round:recovery.retry.outcome.round,
        army:recovery.retry.outcome.byType,callbacks:recovery.retry.callbacks},
      afterRetry:recovery.afterRetry}:null};
}

const profiles=randomProfiles.map(value=>{
  const data=childJson(value);
  assert.equal(data.battleRandom,value);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  assert.ok(data.results.length===4,'应保留0／60／180／600秒每胜四档');
  const results=data.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
    current:summarizeBranch(window.current),
    frontloadedMetal:summarizeBranch(window.frontloadedMetal),
    frontloadedFood:summarizeBranch(window.frontloadedFood)}));
  return{constantRandomValue:value,semantics:'deterministic constant stress profile; not a seed or probability sample',
    entryState:{tick:data.entryState.tick,population:data.entryState.population,
      capacity:data.entryState.capacity,army:data.entryState.army,resources:data.entryState.resources},
    results};
});

const hardProfileRecoverySweep=[1800,3600,7200].map(recoveryWaitSeconds=>{
  const data=childJson(0.9,recoveryWaitSeconds);
  assert.equal(data.battleRandom,0.9);
  return{constantRandomValue:0.9,recoveryWaitSeconds,
    results:data.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
      current:summarizeBranch(window.current),
      frontloadedMetal:summarizeBranch(window.frontloadedMetal),
      frontloadedFood:summarizeBranch(window.frontloadedFood)}))};
});

const artifact={batch:'P114',
  unit:'combat random profile; stage wins/rounds/casualties; replacement queue; simulated recovery seconds; retry result',
  method:'P102 actual route preparation, training, battle, post-battle settlement, and first-loss same-stage retry; constant Math.random stress value and recovery wait are explicit developer-harness variables',
  scope:'fresh zero-win early population route; current reward and two +6 deed sensitivity branches; each-win waits 0/60/180/600; values 0.1/0.5/0.9 are not representative probability samples; the 0.9 stress profile also checks 1800/3600/7200-second recovery',
  profiles,hardProfileRecoverySweep};
const rawPath=path.join(root,'docs/codex/reports/data/p114-combat-rng-recovery.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P114',profiles:profiles.map(profile=>({
  constantRandomValue:profile.constantRandomValue,
  windows:profile.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
    branches:[window.current,window.frontloadedMetal,window.frontloadedFood].map(branch=>({
      rewardMode:branch.rewardMode,wins:branch.wins,blockedAt:branch.blockedAt,
      firstLoss:branch.recovery?.stage||branch.rows.find(row=>!row.win)?.stage||null,
      losses:branch.rows.map(row=>({stage:row.stage,win:row.win,casualties:row.casualties})),
      retryWin:branch.recovery?.retry.win??null,retryArmy:branch.recovery?.retry.army??null}))}))})),
  hardProfileRecoverySweep:hardProfileRecoverySweep.map(profile=>({
    recoveryWaitSeconds:profile.recoveryWaitSeconds,
    outcomes:profile.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
      branches:[window.current,window.frontloadedMetal,window.frontloadedFood].map(branch=>({
        rewardMode:branch.rewardMode,blockedAt:branch.blockedAt,
        retryWin:branch.recovery?.retry.win??null,
        retryArmy:branch.recovery?.retry.army??null,
        remainingQueue:branch.recovery?.beforeRetry.queue??null,
        queueReasons:branch.recovery?.beforeRetry.queueReasons??null,
        resources:branch.recovery?.beforeRetry.resources??null}))}))})),
  rawData:rawPath},null,2));
