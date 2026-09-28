'use strict';
// P111: follow the existing early route through a stage-6 defeat, real troop
// replacement, and a retry; compare continuous and short-session recovery.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
function childJson(script,args,input){
  const result=spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:16*1024*1024});
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function route(args){
  const data=childJson(populationProbe,[...args,'--capture-final-save']);
  const milestone=data.milestones.find(item=>item.label==='population-18');
  assert.ok(milestone,'人口路线缺少18人检查点');
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  assert.equal(data.battleWins,0);
  assert.equal(typeof data.finalStateSave,'string');
  return{data:{...data,finalStateSave:undefined},save:data.finalStateSave};
}
function campaign(name,population,shortSession){
  const args=['--input-save-stdin','--retry-stage6-after-loss','--recovery-wait-seconds=600'];
  if(shortSession)args.push('--session-profile=600:28800',
    '--session-elapsed-active=4188','--session-elapsed-offline=172800');
  const data=childJson(campaignProbe,args,population.save);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  assert.deepEqual(data.entryState.army,{infantry:15,archer:13,bronze_guard:8});
  const zeroWait=data.results.find(item=>item.extraSecondsPerWin===0);
  assert.ok(zeroWait,'缺少零胜后等待基线');
  for(const branch of [zeroWait.current,zeroWait.frontloadedMetal,zeroWait.frontloadedFood]){
    const recovery=branch.defeatRecovery;
    assert.ok(recovery,`${name}/${branch.rewardMode}应在第6关失败后执行恢复`);
    assert.equal(recovery.firstLoss.stage,6);
    assert.equal(recovery.firstLoss.populationAfterDefeat,recovery.firstLoss.populationBefore,
      '本路线战败后村民数不得减少或越过住房上限');
    assert.equal(recovery.recoveryWaitSeconds,600);
    assert.equal(recovery.activeWaitSeconds,600,
      '失败后主动恢复应推进600秒');
    assert.ok(recovery.afterRetry.population>=recovery.firstLoss.populationAfterDefeat);
    assert.equal(recovery.trainingAttempts.length,3);
    assert.ok(recovery.trainingAttempts.every(item=>item.result.ok&&item.result.qty===item.requested),
      '失败后必须真实排入三类缺员补训');
    assert.equal(recovery.retry.outcome.win,true,'三条固定队列分支都应在恢复后通过第6关');
    for(const count of Object.values(recovery.retry.outcome.byType))assert.ok(Number.isFinite(count)&&count>=0);
    if(shortSession){
      assert.equal(branch.sessionClock.offlineWindows.length,1,'恢复等待应跨过一次8小时离线结算');
      assert.equal(branch.sessionClock.offlineWindows[0].activeOnlineSeconds,4800);
      assert.equal(branch.sessionClock.settledOfflineSeconds,230400);
    }
  }
  return data;
}
const continuousRoute=route([]);
const shortRoute=route(['--session-profile=600:28800']);
assert.equal(shortRoute.data.activeOnlineSeconds,4188);
assert.equal(shortRoute.data.settledOfflineSeconds,172800);
const continuous=campaign('continuous-online',continuousRoute,false);
const shortSession=campaign('short-session',shortRoute,true);
const recoverySummary=data=>{
  const zero=data.results.find(item=>item.extraSecondsPerWin===0);
  return Object.fromEntries([zero.current,zero.frontloadedMetal,zero.frontloadedFood].map(branch=>{
    const x=branch.defeatRecovery;
    return[branch.rewardMode,{recoveryWaitSeconds:x.recoveryWaitSeconds,activeWaitSeconds:x.activeWaitSeconds,
      firstLoss:{round:x.firstLoss.round,armyBefore:x.firstLoss.armyBefore,
        armyAfter:x.firstLoss.armyAfter,populationBefore:x.firstLoss.populationBefore,
        populationAfter:x.firstLoss.populationAfterDefeat},trainingAttempts:x.trainingAttempts,
      afterDefeat:x.afterDefeat,afterTraining:x.afterTraining,beforeRetry:x.beforeRetry,
      retry:{win:x.retry.outcome.win,round:x.retry.outcome.round,army:x.retry.outcome.byType,
        battleActiveMs:x.retry.battleActiveMs,reward:x.retry.reward},afterRetry:x.afterRetry,
      ...(branch.sessionClock?{sessionClock:{activeOnlineSeconds:branch.sessionClock.activeOnlineSeconds,
        settledOfflineSeconds:branch.sessionClock.settledOfflineSeconds,
        offlineWindows:branch.sessionClock.offlineWindows}}:{})}];
  }));
};
const artifact={batch:'P111',
  unit:'active online/offline seconds; soldiers; villagers; resources; queue counts; wins',
  method:'P101 actual zero-win 18-person save feeds P102; after the zero-replenishment stage-6 loss, request real replacement training, wait 600 online seconds, and retry the same stage with current combat, settlement, queue, tick, and optional settleOffline functions',
  scope:'fixed random 0.5; current reward, stage-3 +6 deed with metal policy, and +6 deed with food-safe policy; continuous versus 600s-online/28800s-offline cadence; no player browser save',
  recoveryWaitSeconds:600,
  routes:{continuousOnline:{population:continuousRoute.data,
      entryState:continuous.entryState,recovery:recoverySummary(continuous)},
    shortSession:{population:shortRoute.data,entryState:shortSession.entryState,
      preparationSessionClock:shortSession.preparationSessionClock,recovery:recoverySummary(shortSession)}}};
const rawPath=path.join(root,'docs/codex/reports/data/p111-population-defeat-recovery.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
const summary={};
for(const [name,value] of Object.entries(artifact.routes)){
  summary[name]=Object.fromEntries(Object.entries(value.recovery).map(([policy,result])=>[policy,
    {firstLossPopulation:result.firstLoss.populationBefore,postDefeatPopulation:result.firstLoss.populationAfter,
      retryWin:result.retry.win,retryRound:result.retry.round,armyAfterRetry:result.retry.army,
      activeOnlineSeconds:result.sessionClock?.activeOnlineSeconds??null,
      settledOfflineSeconds:result.sessionClock?.settledOfflineSeconds??null,
      offlineWindows:result.sessionClock?.offlineWindows?.length??0}]));
}
console.log(JSON.stringify({batch:'P111',summary,rawData:rawPath},null,2));
