'use strict';
// Continue P167's actual first-loss saves through real replenishment and a
// same-stage retry. The P167 source is only instrumented in memory so its
// historical run and player code remain unchanged.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p167Path=path.join(__dirname,'probe-current-first-clear-campaign-p167.js');
const outputPath=path.join(root,'docs/codex/reports/data/p168-current-first-clear-recovery.json');
const seeds=[1,2,3,42,12345];
const policyNames=['wood-food','food-food'];
const woodMoves=[0,1,2];
const recoveryWaits=[600,1800];
const nextWinWait=600;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P168找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P168的${label}不唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function reuseP167(){
  let source=fs.readFileSync(p167Path,'utf8');
  source=replaceOnce(source,
    'final,minFood,minStone,saveResult,finalSaveSha256:sha(stored),',
    'final,minFood,minStone,saveResult,finalStateSave:stored,finalSaveSha256:sha(stored),',
    '首败序列化存档返回点');
  source=replaceOnce(source,
    'const profiles=workerPolicies.flatMap',
    'return {runBranch,workerPolicies,seeds,prepared,snapshot,fight,queueToTarget,owned,armyByType,installBattleHarness,checked,plain};\nconst profiles=workerPolicies.flatMap',
    'P167同源路线返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p167Path),{log(){},error:console.error},path.dirname(p167Path));
}
const {runBranch,workerPolicies,snapshot,fight,queueToTarget,armyByType,
  installBattleHarness,checked,plain}=reuseP167();
const policies=policyNames.map(name=>{
  const policy=workerPolicies.find(item=>item.name===name);
  assert.ok(policy,`缺少${name}岗位策略`);
  return policy;
});

function recovery(start,seed,woodMove,waitSeconds){
  assert.ok(start.firstLoss&&start.finalStateSave,`${start.branch}缺少首败存档`);
  const e=environment({rts_save:start.finalStateSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok','首败存档不能重载');
  assert.deepEqual(snapshot(run),start.final,'首败存档重载状态与原状态不一致');
  installBattleHarness(run);
  const firstLoss=start.firstLoss;
  const atLoss=snapshot(run);
  let foodMinimum=atLoss.resources.food;
  let stoneMinimum=atLoss.resources.stone;
  const shift={from:'stone',to:'wood',count:woodMove,
    before:plain(run('({...S.popAlloc})'))};
  if(woodMove>0){
    const stoneWorkers=run('S.popAlloc.stone||0');
    const woodWorkers=run('S.popAlloc.wood||0');
    assert.ok(stoneWorkers>=woodMove,'可转调石工不足');
    checked(run,`setPopAlloc('stone',${stoneWorkers-woodMove})`,'撤下石工');
    checked(run,`setPopAlloc('wood',${woodWorkers+woodMove})`,'转为木工');
  }
  shift.after=plain(run('({...S.popAlloc})'));
  const training=queueToTarget(run,firstLoss);
  function waitTicks(seconds){
    for(let i=0;i<seconds;i++){
      run('tick()');
      foodMinimum=Math.min(foodMinimum,run('S.res.food'));
      stoneMinimum=Math.min(stoneMinimum,run('S.res.stone'));
    }
  }
  waitTicks(waitSeconds);
  const beforeRetry=snapshot(run);
  const beforeRetryOwned=armyByType(run);
  const retry=fight(run,seed,firstLoss);
  const later=[];
  if(retry.won){
    for(let stage=firstLoss+1;stage<=10;stage++){
      const queued=queueToTarget(run,stage);
      waitTicks(nextWinWait);
      const row=fight(run,seed,stage);
      later.push({stage,queued,battle:row});
      if(!row.won)break;
    }
  }
  const final=snapshot(run);
  checked(run,'save()','P168续战终档保存');
  const saved=run("localStorage.getItem('rts_save')");
  const reloaded=environment({rts_save:saved});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(snapshot(reloaded.run),final,'P168续战终档重载不一致');
  return{woodMove,waitSeconds,firstLoss,atLoss,shift,training,beforeRetry,
    beforeRetryOwned,retry,later,final,foodMinimum,stoneMinimum,
    firstLossSaveSha256:sha(start.finalStateSave),finalSaveSha256:sha(saved),
    clearedL10:final.defeated.includes(10),
    finalBlockedAt:!retry.won?firstLoss:later.find(item=>!item.battle.won)?.stage||null};
}

const profiles=[];
for(const policy of policies)for(const seed of seeds){
  const starts=[runBranch(seed,false,policy),runBranch(seed,true,policy)];
  for(const start of starts){
    assert.equal(start.final.population,20);
    assert.equal(start.final.capacity,20);
    assert.ok(start.firstLoss>=6&&start.firstLoss<=9);
    const trials=[];
    for(const woodMove of woodMoves)for(const waitSeconds of recoveryWaits)
      trials.push(recovery(start,seed,woodMove,waitSeconds));
    profiles.push({workerPolicy:policy.name,seed,branch:start.branch,
      initialWins:start.wins,firstLoss:start.firstLoss,
      initialLossOwned:start.battles.find(row=>!row.won)?.afterArmy,
      firstLossState:start.final,firstLossSaveSha256:sha(start.finalStateSave),trials});
  }
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-current-first-clear-recovery-p168.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0,`读取HEAD失败：${head.stderr||''}`);
const artifact={batch:'P168',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),method:'in-memory P167 first-loss save capture after real L1 onward battles; reload actual loss save, optionally reassign 0/1/2 stone workers to wood through setPopAlloc, queue actual replacements, wait 600/1800 online tick seconds, retry same stage with its fixed seeded battle stream; on success wait 600 and fight each next stage through L10 or first further loss; beforeRetryOwned is pool plus formations and retry.beforeDeployed is the actual battle lineup; no extra deeds or resource injection',
  scope:'two P167 job profiles (wood-food/food-food) × five fixed seeds × current L3+6 and isolated no-reward × three post-loss wood reallocations × two recovery waits; no offline/garrison, no player save or UI changes',
  policy:{policyNames,seeds,woodMoves,recoveryWaits,nextWinWait,stopAfterNextLoss:true,
    battleCallbackTime:'excluded from online tick seconds'},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P168',profiles:profiles.length,trials:profiles.reduce((n,p)=>n+p.trials.length,0),
  L10Clears:profiles.flatMap(p=>p.trials.filter(t=>t.clearedL10).map(t=>({policy:p.workerPolicy,
    seed:p.seed,branch:p.branch,woodMove:t.woodMove,waitSeconds:t.waitSeconds}))),
  byPolicy:policyNames.map(name=>({name,
    rows:profiles.filter(p=>p.workerPolicy===name).map(p=>({seed:p.seed,branch:p.branch,
      firstLoss:p.firstLoss,trials:p.trials.map(t=>({woodMove:t.woodMove,waitSeconds:t.waitSeconds,
        retryWon:t.retry.won,blockedAt:t.finalBlockedAt,clearedL10:t.clearedL10,
        beforeRetryOwned:t.beforeRetryOwned,beforeRetryDeployed:t.retry.beforeDeployed}))}))})),rawData:outputPath},null,2));
