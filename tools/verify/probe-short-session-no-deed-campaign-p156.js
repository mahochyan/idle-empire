'use strict';
// P156 replays the P154 sequential-expansion campaign with P102 deed injection
// disabled, then compares it with P154's base-candidate branch. All edits are temp copies.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const outputPath=path.join(root,'docs/codex/reports/data/p156-short-session-no-deed-campaign.json');
const p154DataPath=path.join(root,'docs/codex/reports/data/p154-short-session-food-staffing-continuation.json');
// P151/P153 varied all three source jobs; this control keeps the P154 population route and current jobs.
const sources=['stone'];

function child(script,args,input){
  return spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:40*1024*1024});
}
function childJson(script,args,input){
  const result=child(script,args,input);
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function replaceExactlyOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P156无法定位${label}插桩点`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P156发现多个${label}插桩点`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

const population=childJson(populationProbe,[
  '--session-profile=600:28800','--capture-final-save'
]);
assert.equal(population.route,'sequential-expansion','P156应使用非科研优先人口路线');
assert.equal(population.battleWins,0,'四学者人口入口必须是零胜场');
assert.equal(population.milestones.find(x=>x.label==='population-18')?.population,18);
assert.equal(typeof population.finalStateSave,'string','四学者路线缺少真实save终档');

function instrumentCampaign(foodSource){
  let instrumented=fs.readFileSync(campaignProbe,'utf8');
  const sessionNeedle=[
    '  run(`(()=>{',
    '    const g=globalThis;',
    '    g.__p102RawTick=tick;'
  ].join('\n');
  const sessionReplacement=[
    '  run(`(()=>{',
    `    const g=globalThis;g.__p156FoodSource=${JSON.stringify(foodSource)};g.__p156FoodStaffing=[];`,
    '    g.__p102RawTick=tick;'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,sessionNeedle,sessionReplacement,'粮工策略初始化');

  const staffingNeedle='      const saved=save();';
  const staffingReplacement=[
    '      const foodBefore=S.popAlloc.food||0;',
    '      if(foodBefore<3){',
    '        const source=g.__p156FoodSource;',
    '        const move=3-foodBefore;',
    '        const sourceBefore=S.popAlloc[source]||0;',
    "        if(sourceBefore<move)throw Error('P156粮工候选来源不足：'+source);",
    '        const removed=setPopAlloc(source,sourceBefore-move);',
    "        if(!removed?.ok)throw Error('P156粮工候选撤岗失败：'+JSON.stringify(removed));",
    "        const added=setPopAlloc('food',foodBefore+move);",
    "        if(!added?.ok)throw Error('P156粮工候选增岗失败：'+JSON.stringify(added));",
    '        g.__p156FoodStaffing.push({stage:S.defeated.length+1,reason,activeOnlineSeconds:stats.activeOnlineSeconds,',
    '          source,sourceWorkersBefore:sourceBefore,sourceWorkersAfter:S.popAlloc[source],',
    '          foodWorkersBefore:foodBefore,foodWorkersAfter:S.popAlloc.food,resources:{...S.res},',
    "          queue:Object.fromEntries(['infantry','archer','bronze_guard'].map(k=>[k,S.queue[k]?.count||0]))});",
    '      }',
    staffingNeedle
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,staffingNeedle,staffingReplacement,'离线前真实粮工调岗');

  const modeNeedle=[
    'function makeBranch(rewardMode,extraSecondsPerWin){',
    '  const e=environment({rts_save:battleStart.save});',
    '  const run=e.run;'
  ].join('\n');
  const modeReplacement=[
    'function makeBranch(rewardMode,extraSecondsPerWin){',
    '  const e=environment({rts_save:battleStart.save});',
    '  const run=e.run;',
    '  run(`globalThis.__p156RewardMode=${JSON.stringify(rewardMode)};globalThis.__p156DeedBalances=[]`);'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,modeNeedle,modeReplacement,'奖励分支标识');

  instrumented=replaceExactlyOnce(instrumented,
    '    if(!win)return {award:0,bonus:0,spent:0};',
    [
      '    if(!win){',
      "      const remaining=run('S.res.deed');",
      '      run(`globalThis.__p156DeedBalances.push({stage:${stage},win:false,deed:${remaining}})`);',
      '      return {award:0,bonus:0,spent:0,remaining};',
      '    }'
    ].join('\n'),
    '记录无奖励战败后的地契余额');
  instrumented=replaceExactlyOnce(instrumented,
    '    const baseAward=Math.ceil(stage/10);',
    '    const baseAward=0;',
    '关闭基础首通地契注入');
  instrumented=replaceExactlyOnce(instrumented,
    "    const bonus=rewardMode.startsWith('frontloaded')&&stage===3?6:0;",
    '    const bonus=0;',
    '关闭额外首通地契注入');
  instrumented=replaceExactlyOnce(instrumented,
    '    return {award:baseAward+bonus,bonus,spent};',
    [
      "    const remaining=run('S.res.deed');",
      '    run(`globalThis.__p156DeedBalances.push({stage:${stage},win:true,deed:${remaining}})`);',
      '    return {award:baseAward+bonus,bonus,spent,remaining};'
    ].join('\n'),
    '记录无地契分支余额');
  instrumented=replaceExactlyOnce(instrumented,
    "if(stage===3&&fought.outcome.win&&rewardMode.startsWith('frontloaded')){",
    "if(false&&stage===3&&fought.outcome.win&&rewardMode.startsWith('frontloaded')){",
    '关闭仅适用于额外地契分支的岗位改配');
  instrumented=replaceExactlyOnce(instrumented,
    "if(stage3?.win){\n      assert.equal(stage3.reward.spent,9,'第3关+6须在真实扩容动作中支付9地契');",
    "if(stage3?.win){\n      assert.equal(stage3.reward.spent,0,'无地契分支不得支付候选扩容费用');",
    '校准候选奖励断言');
  instrumented=replaceExactlyOnce(instrumented,
    "  if(currentStage3?.win){\n    assert.equal(frontloaded.rows.find(row=>row.stage===3)?.workforceChange?.rates?.copper,4);\n    assert.ok(foodSafe.rows.find(row=>row.stage===3)?.workforceChange?.rates?.food>\n      frontloaded.rows.find(row=>row.stage===3)?.workforceChange?.rates?.food);\n    if(woodSafe)assert.ok(woodSafe.rows.find(row=>row.stage===3)?.workforceChange?.rates?.wood>0);\n  }",
    "  if(currentStage3?.win){\n    assert.equal(frontloaded.rows.find(row=>row.stage===3)?.workforceChange,null);\n    assert.equal(foodSafe.rows.find(row=>row.stage===3)?.workforceChange,null);\n  }",
    '移除候选岗位收益断言');

  const cutoffNeedle=[
    'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})',
    "        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));"
  ].join('\n');
  const cutoffReplacement=[
    'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec}){',
    '        const diagnostic={rewardMode:g.__p156RewardMode,stage:S.defeated.length+1,reason,requestedSeconds:${sessionProfile.offlineSec},settled,',
    '          before,after:snapshot(),workers:{...S.popAlloc},army:{count:armyCount(),upkeep:totalUpkeep()},',
    '          queue:JSON.parse(JSON.stringify(S.queue)),staffing:JSON.parse(JSON.stringify(g.__p156FoodStaffing))};',
    "        throw Error('P156_CUTOFF:'+JSON.stringify(diagnostic));",
    '      }'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,cutoffNeedle,cutoffReplacement,'离线截断诊断');

  const returnNeedle='  if(getSessionStats)branch.sessionClock=getSessionStats();\n  return branch;';
  const returnReplacement=[
    '  if(branch.defeatRecovery?.retry?.outcome?.win&&branch.defeatRecovery.stage<campaignMaxStage){',
    '    const nextStage=branch.defeatRecovery.stage+1;',
    '    queueToTarget();',
    "    const queuedBeforeWait=run('JSON.parse(JSON.stringify(S.queue))');",
    '    wait(extraSecondsPerWin);',
    '    const beforeNextStage=recoverySnapshot();',
    '    const next=battle(nextStage);',
    '    const nextReward=clearReward(nextStage,next.outcome.win);',
    '    branch.postRetryContinuation={stage:nextStage,waitSeconds:extraSecondsPerWin,queuedBeforeWait,',
    '      beforeNextStage,outcome:next.outcome,armyBefore:next.before.byType,armyAfter:next.outcome.byType,',
    '      deployed:next.before.deployed,enemy:next.enemy,reward:nextReward,',
    "      activeOnlineSeconds:getSessionStats?run('globalThis.__p102SessionStats.activeOnlineSeconds'):run('S.tick')};",
    '  }',
    '  if(branch.postRetryContinuation?.outcome?.win&&branch.postRetryContinuation.stage<campaignMaxStage){',
    '    const nextStage=branch.postRetryContinuation.stage+1;',
    '    queueToTarget();',
    "    const queuedAfterStage10=run('JSON.parse(JSON.stringify(S.queue))');",
    '    wait(extraSecondsPerWin);',
    '    const beforeStage11=recoverySnapshot();',
    '    const next=battle(nextStage);',
    '    const nextReward=clearReward(nextStage,next.outcome.win);',
    '    branch.postStage10Continuation={stage:nextStage,waitSeconds:extraSecondsPerWin,queuedAfterStage10,',
    '      beforeStage11,outcome:next.outcome,armyBefore:next.before.byType,armyAfter:next.outcome.byType,',
    '      deployed:next.before.deployed,enemy:next.enemy,reward:nextReward,',
    "      activeOnlineSeconds:getSessionStats?run('globalThis.__p102SessionStats.activeOnlineSeconds'):run('S.tick')};",
    '  }',
    '  if(getSessionStats)branch.sessionClock=getSessionStats();',
    "  branch.foodStaffingChanges=run('JSON.parse(JSON.stringify(globalThis.__p156FoodStaffing||[]))');",
    "  branch.deedBalances=run('JSON.parse(JSON.stringify(globalThis.__p156DeedBalances||[]))');",
    '  return branch;'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,returnNeedle,returnReplacement,'败后后续关与粮工轨迹输出');
  return instrumented;
}

function runSource(foodSource){
  const tempPath=path.join(__dirname,`.p156-p102-${process.pid}.js`);
  const expectedTempPath=path.resolve(root,'tools/verify',path.basename(tempPath));
  assert.equal(path.resolve(tempPath),expectedTempPath,'临时P102副本必须位于开发验证目录');
  let result;
  try{
    fs.writeFileSync(tempPath,instrumentCampaign(foodSource),'utf8');
    result=child(tempPath,[
      '--input-save-stdin','--session-profile=600:28800',
      `--session-elapsed-active=${population.activeOnlineSeconds}`,
      `--session-elapsed-offline=${population.settledOfflineSeconds}`,
      '--campaign-max-stage=11','--wait-windows=600','--retry-first-loss','--recovery-wait-seconds=600'
    ],population.finalStateSave);
  }finally{
    if(fs.existsSync(tempPath))fs.unlinkSync(tempPath);
  }
  if(result.status===0){
    const data=JSON.parse(result.stdout);
    assert.equal(data.batch,'P102');
    assert.deepEqual(data.sessionProfile,{activeSec:600,offlineSec:28800});
    assert.equal(data.results.length,1);
    const window=data.results[0];
    const branches=[window.current,window.frontloadedMetal,window.frontloadedFood];
    for(const branch of branches){
      assert.ok(branch.foodStaffingChanges,'P102分支缺少离线粮工轨迹');
      assert.deepEqual(branch.deedBalances.map(x=>[x.stage,x.win,x.deed]),[
        [1,true,0],[2,true,0],[3,true,0],[4,true,0],[5,true,0],[6,true,0],[7,true,0],[8,true,0],
        [9,false,0],[9,true,0],[10,true,0],[11,true,0]
      ],`${foodSource}/${branch.rewardMode}每次胜负结算后地契都应保持0`);
      for(const offline of branch.sessionClock.offlineWindows)
        assert.equal(offline.durationSec,28800,'成功分支的离线窗必须完整结算');
      assert.equal(branch.sessionClock.offlineWindows.length,9,
        `${foodSource}/${branch.rewardMode}应在L9重试、L10恢复后完整结算第9个8小时离线窗`);
      assert.ok(branch.sessionClock.offlineWindows.every(x=>x.after.resources.food===3000),
        `${foodSource}/${branch.rewardMode}每个离线窗终粮应回到3000上限`);
      assert.equal(branch.wins,8,`${foodSource}/${branch.rewardMode}应在首败前赢8关`);
      assert.equal(branch.blockedAt,9,`${foodSource}/${branch.rewardMode}应由第9关触发首败`);
      assert.equal(branch.defeatRecovery?.stage,9,`${foodSource}/${branch.rewardMode}应重试第9关`);
      assert.equal(branch.defeatRecovery?.retry.outcome.win,true,
        `${foodSource}/${branch.rewardMode}的600秒补训后应赢回第9关`);
      assert.equal(branch.postRetryContinuation?.stage,10,
        `${foodSource}/${branch.rewardMode}的L9重试获胜后应实际接战L10`);
      if(branch.postRetryContinuation?.outcome?.win)
        assert.equal(branch.postStage10Continuation?.stage,11,
          `${foodSource}/${branch.rewardMode}的L10胜后应实际接战L11`);
      for(const row of branch.rows)
        assert.equal(row.reward.remaining,0,`${foodSource}/${branch.rewardMode}第${row.stage}关后地契应保持0`);
      if(branch.defeatRecovery?.retry?.outcome?.win)
        assert.equal(branch.defeatRecovery.retry.reward.remaining,0,
          `${foodSource}/${branch.rewardMode}第9关重试后地契应保持0`);
      if(branch.postRetryContinuation?.outcome?.win)
        assert.equal(branch.postRetryContinuation.reward.remaining,0,
          `${foodSource}/${branch.rewardMode}第10关后地契应保持0`);
      if(branch.postStage10Continuation?.outcome?.win)
        assert.equal(branch.postStage10Continuation.reward.remaining,0,
          `${foodSource}/${branch.rewardMode}第11关后地契应保持0`);
    }
    const metal=branches.find(x=>x.rewardMode==='frontloaded-metal');
    assert.equal(metal.foodStaffingChanges.length,0,
      `${foodSource}无地契控制应沿用3粮工的当前岗位组合`);
    assert.equal(branches.find(x=>x.rewardMode==='current').foodStaffingChanges.length,0,
      '无地契控制的当前岗位分支在军备准备阶段已有3粮工');
    assert.equal(branches.find(x=>x.rewardMode==='frontloaded-food').foodStaffingChanges.length,0,
      '无地契控制关闭奖励岗位改配');
    const normalize=branch=>{const {rewardMode,...rest}=branch;return rest;};
    assert.deepEqual(normalize(branches[1]),normalize(branches[0]),
      '关闭奖励后金属测试别名必须与当前岗位无地契路线一致');
    assert.deepEqual(normalize(branches[2]),normalize(branches[0]),
      '关闭奖励后粮食测试别名必须与当前岗位无地契路线一致');
    const furthestStage=branches[0].postStage10Continuation?.stage||branches[0].postRetryContinuation?.stage||9;
    return{status:`through-stage-${furthestStage}`,furthestStage,campaignMaxStage:data.campaignMaxStage||11,
      entry:data.entryState,branches:branches.map(branch=>({rewardMode:branch.rewardMode,wins:branch.wins,
        blockedAt:branch.blockedAt,foodStaffingChanges:branch.foodStaffingChanges,
        deedBalancesAfterEachBattle:branch.deedBalances,
        deedBalancesAfterWins:[...branch.rows.map(row=>({stage:row.stage,won:row.win,
          deed:row.reward.remaining})),
          ...(branch.defeatRecovery? [{stage:branch.defeatRecovery.stage,phase:'retry',
            won:branch.defeatRecovery.retry.outcome.win,deed:branch.defeatRecovery.retry.reward.remaining}]:[]),
          ...(branch.postRetryContinuation? [{stage:branch.postRetryContinuation.stage,phase:'continuation',
            won:branch.postRetryContinuation.outcome.win,deed:branch.postRetryContinuation.reward.remaining}]:[]),
          ...(branch.postStage10Continuation? [{stage:branch.postStage10Continuation.stage,phase:'continuation',
            won:branch.postStage10Continuation.outcome.win,deed:branch.postStage10Continuation.reward.remaining}]:[])],
        offlineWindows:branch.sessionClock.offlineWindows.map(x=>({reason:x.reason,
          activeOnlineSeconds:x.activeOnlineSeconds,durationSec:x.durationSec,before:x.before,after:x.after})),
        defeatRecovery:branch.defeatRecovery?{stage:branch.defeatRecovery.stage,
          recoveryWaitSeconds:branch.defeatRecovery.recoveryWaitSeconds,
          retryWon:branch.defeatRecovery.retry.outcome.win,
          foodStaffingChanges:branch.foodStaffingChanges}:null,
        postRetryContinuation:branch.postRetryContinuation,
        postStage10Continuation:branch.postStage10Continuation,
        rows:branch.rows.map(row=>({stage:row.stage,win:row.win,round:row.round,
          armyBefore:row.byTypeBefore,armyAfter:row.byTypeAfter,
          replenishment:row.replenishment}))}))};
  }
  const combined=String(result.stderr||'')+'\n'+String(result.stdout||'');
  const match=combined.match(/P156_CUTOFF:(\{[^\r\n]+\})/);
  assert.ok(match,`P102粮工路线异常退出，无法识别结算结果；exit=${result.status}; ${combined}`);
  const diagnostic=JSON.parse(match[1]);
  assert.equal(diagnostic.settled.truncated,true,'截断路径应记录真实食物不足结算');
  assert.ok(diagnostic.settled.durationSec>0&&diagnostic.settled.durationSec<28800);
  return{status:'cutoff',diagnostic};
}

const routes=sources.map(runSource);
for(const route of routes){
  if(route.status.startsWith('through-stage-')){
    for(const branch of route.branches){
      assert.equal(branch.foodStaffingChanges.length,0,
        `${route.foodSource}/${branch.rewardMode}无地契控制不应改变岗位`);
    }
  }else{
    assert.ok(route.diagnostic,'无法识别的无地契路线结果');
  }
}

const p154Data=JSON.parse(fs.readFileSync(p154DataPath,'utf8'));
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
assert.equal(p154Data.sourceHead,head,'P154基线必须来自相同HEAD');
for(const input of p154Data.inputs){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,input.file))).digest('hex');
  assert.equal(actual,input.sha256,`P154基线输入已变化：${input.file}`);
}
const candidateRoute=p154Data.routes.find(route=>route.foodSource==='stone');
const candidate=candidateRoute?.branches.find(branch=>branch.rewardMode==='current');
const controlRoute=routes[0];
const control=controlRoute?.branches.find(branch=>branch.rewardMode==='current');
assert.ok(candidate&&control,'缺少同源的候选奖励／无地契岗位分支');
assert.deepEqual(controlRoute.entry,candidateRoute.entry,'P154与P156必须从相同人口／战役入口开始');
assert.deepEqual(control.rows,candidate.rows,
  '基础候选尚未兑换住房前，两条路线从L3至L9首次战败的军队/补给轨迹应相同');
assert.equal(control.defeatRecovery?.retryWon,candidate.defeatRecovery?.retryWon,
  'L9重试结果应在奖励结算前一致');
const p154BeforeStage10=candidate.postRetryContinuation?.beforeNextStage;
const p156BeforeStage10=control.postRetryContinuation?.beforeNextStage;
assert.ok(p154BeforeStage10&&p156BeforeStage10,'缺少L10前恢复检查点');
assert.equal(p154BeforeStage10.tick,p156BeforeStage10.tick,'L10前两路累计tick应相同');
assert.deepEqual(p154BeforeStage10.resources,p156BeforeStage10.resources,
  'L10前候选与无地契两路可比资源应相同');
assert.deepEqual(p154BeforeStage10.army,p156BeforeStage10.army,
  'L10前候选与无地契两路编队应相同');
assert.deepEqual(candidate.postRetryContinuation?.outcome,control.postRetryContinuation?.outcome,
  '固定随机流下候选与无地契L10结果应相同');
assert.deepEqual(candidate.postStage10Continuation?.outcome,control.postStage10Continuation?.outcome,
  '固定随机流下候选与无地契L11结果应相同');
const comparison={
  p154InputHashesVerified:true,
  sharedEntry:controlRoute.entry,
  beforeRewardDivergence:{
    candidateAndNoDeedRowsEqualThroughFirstL9Loss:true,
    candidateL9RetryWon:candidate.defeatRecovery.retryWon,
    noDeedL9RetryWon:control.defeatRecovery.retryWon
  },
  beforeStage10:{
    candidate:{tick:p154BeforeStage10.tick,population:p154BeforeStage10.population,
      capacity:p154BeforeStage10.capacity,deed:p154BeforeStage10.resources.deed,
      army:p154BeforeStage10.army,resources:p154BeforeStage10.resources},
    noDeed:{tick:p156BeforeStage10.tick,population:p156BeforeStage10.population,
      capacity:p156BeforeStage10.capacity,deed:p156BeforeStage10.resources.deed,
      army:p156BeforeStage10.army,resources:p156BeforeStage10.resources}
  },
  stage10:{candidate:candidate.postRetryContinuation?.outcome||null,
    noDeed:control.postRetryContinuation?.outcome||null},
  stage11:{candidate:candidate.postStage10Continuation?.outcome||null,
    noDeed:control.postStage10Continuation?.outcome||null}
};

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p154-short-session-food-staffing-continuation.json',
  'tools/verify/probe-population-early-18.js','tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-short-session-no-deed-campaign-p156.js'
];
const artifact={batch:'P156',unit:'active/offline seconds; population strategy; food workers; resources; troop queues; campaign wins; defeat recovery; stage-11 entry',
  method:'replay the P154 sequential-expansion zero-win population save through the real P102 preparation, training, battle, settlement and offline functions; in an ephemeral P102 copy disable both base and frontloaded deed injection and the extra-reward role change; keep current worker allocation; compare against the P154 current-job candidate-reward branch whose input hashes and HEAD are checked',
  scope:'600 active seconds followed by 28800 offline seconds; fixed random 0.5; no deed reward at any victory in the control; P102 reward-mode aliases must converge to the same result; isolated saves only; no player browser save',
  sourceHead:head,
  populationEntry:{route:population.route,activeOnlineSeconds:population.activeOnlineSeconds,settledOfflineSeconds:population.settledOfflineSeconds,
    population:population.milestones.find(x=>x.label==='population-18').population,
    capacity:population.milestones.find(x=>x.label==='population-18').capacity},
  policy:'use the P154 current-job allocation (3 food workers); no reward-only reallocation and no worker transfer expected',
  comparison,
  routes,
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P156',comparison:{p154InputHashesVerified:comparison.p154InputHashesVerified,
  beforeStage10:{candidate:{population:comparison.beforeStage10.candidate.population,
    capacity:comparison.beforeStage10.candidate.capacity,deed:comparison.beforeStage10.candidate.deed},
    noDeed:{population:comparison.beforeStage10.noDeed.population,
      capacity:comparison.beforeStage10.noDeed.capacity,deed:comparison.beforeStage10.noDeed.deed}},
  stage10:{candidateWin:comparison.stage10.candidate?.win,noDeedWin:comparison.stage10.noDeed?.win},
  stage11:{candidateWin:comparison.stage11.candidate?.win,noDeedWin:comparison.stage11.noDeed?.win}},
  routes:routes.map(route=>({status:route.status,
  cutoff:route.diagnostic?{rewardMode:route.diagnostic.rewardMode,stage:route.diagnostic.stage,
    requestedSeconds:route.diagnostic.requestedSeconds,actualSeconds:route.diagnostic.settled.durationSec,
    staffing:route.diagnostic.staffing}:null,
  branches:route.branches?.map(branch=>({rewardMode:branch.rewardMode,wins:branch.wins,
    blockedAt:branch.blockedAt,offlineWindows:branch.offlineWindows.length,
    staffingChanges:branch.foodStaffingChanges.length,
    retryWon:branch.defeatRecovery?.retryWon??null,stage10Win:branch.postRetryContinuation?.outcome?.win??null,
    stage10Roster:branch.postRetryContinuation?.armyBefore??null,stage11Win:branch.postStage10Continuation?.outcome?.win??null,
    stage11Roster:branch.postStage10Continuation?.armyBefore??null}))})),rawData:outputPath},null,2));
