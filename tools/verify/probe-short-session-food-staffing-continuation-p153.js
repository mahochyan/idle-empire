'use strict';
// P153 continues the P151 four-scholar short-session branches through stage 11
// after stage 10 wins and another recovery window. All P102 edits are temp copies.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const outputPath=path.join(root,'docs/codex/reports/data/p153-short-session-food-staffing-continuation.json');
const sources=['stone','coal','copper'];

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
  assert.notEqual(first,-1,`P153无法定位${label}插桩点`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P153发现多个${label}插桩点`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

const population=childJson(populationProbe,[
  '--research-priority','--research-workers=4','--session-profile=600:28800','--capture-final-save'
]);
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
    `    const g=globalThis;g.__p153FoodSource=${JSON.stringify(foodSource)};g.__p153FoodStaffing=[];`,
    '    g.__p102RawTick=tick;'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,sessionNeedle,sessionReplacement,'粮工策略初始化');

  const staffingNeedle='      const saved=save();';
  const staffingReplacement=[
    '      const foodBefore=S.popAlloc.food||0;',
    '      if(foodBefore<3){',
    '        const source=g.__p153FoodSource;',
    '        const move=3-foodBefore;',
    '        const sourceBefore=S.popAlloc[source]||0;',
    "        if(sourceBefore<move)throw Error('P153粮工候选来源不足：'+source);",
    '        const removed=setPopAlloc(source,sourceBefore-move);',
    "        if(!removed?.ok)throw Error('P153粮工候选撤岗失败：'+JSON.stringify(removed));",
    "        const added=setPopAlloc('food',foodBefore+move);",
    "        if(!added?.ok)throw Error('P153粮工候选增岗失败：'+JSON.stringify(added));",
    '        g.__p153FoodStaffing.push({stage:S.defeated.length+1,reason,activeOnlineSeconds:stats.activeOnlineSeconds,',
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
    '  run(`globalThis.__p153RewardMode=${JSON.stringify(rewardMode)}`);'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,modeNeedle,modeReplacement,'奖励分支标识');

  const cutoffNeedle=[
    'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})',
    "        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));"
  ].join('\n');
  const cutoffReplacement=[
    'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec}){',
    '        const diagnostic={rewardMode:g.__p153RewardMode,stage:S.defeated.length+1,reason,requestedSeconds:${sessionProfile.offlineSec},settled,',
    '          before,after:snapshot(),workers:{...S.popAlloc},army:{count:armyCount(),upkeep:totalUpkeep()},',
    '          queue:JSON.parse(JSON.stringify(S.queue)),staffing:JSON.parse(JSON.stringify(g.__p153FoodStaffing))};',
    "        throw Error('P153_CUTOFF:'+JSON.stringify(diagnostic));",
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
    "  branch.foodStaffingChanges=run('JSON.parse(JSON.stringify(globalThis.__p153FoodStaffing||[]))');",
    '  return branch;'
  ].join('\n');
  instrumented=replaceExactlyOnce(instrumented,returnNeedle,returnReplacement,'败后后续关与粮工轨迹输出');
  return instrumented;
}

function runSource(foodSource){
  const tempPath=path.join(__dirname,`.p153-p102-${process.pid}.js`);
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
      assert.equal(branch.postRetryContinuation?.outcome?.win,true,
        `${foodSource}/${branch.rewardMode}的L10应胜利后才继续到L11`);
      assert.equal(branch.postStage10Continuation?.stage,11,
        `${foodSource}/${branch.rewardMode}的L10胜后应实际接战L11`);
    }
    const metal=branches.find(x=>x.rewardMode==='frontloaded-metal');
    assert.equal(metal.foodStaffingChanges.length,1,
      `${foodSource}金属分支应在首次离线前把2粮工增至3粮工`);
    assert.deepEqual({stage:metal.foodStaffingChanges[0].stage,activeOnlineSeconds:metal.foodStaffingChanges[0].activeOnlineSeconds,
      source:metal.foodStaffingChanges[0].source,foodWorkersBefore:metal.foodStaffingChanges[0].foodWorkersBefore,
      foodWorkersAfter:metal.foodStaffingChanges[0].foodWorkersAfter},
      {stage:4,activeOnlineSeconds:4800,source:foodSource,foodWorkersBefore:2,foodWorkersAfter:3});
    assert.equal(branches.find(x=>x.rewardMode==='current').foodStaffingChanges.length,0,
      '当前岗位基线在军备准备阶段已有3粮工');
    assert.equal(branches.find(x=>x.rewardMode==='frontloaded-food').foodStaffingChanges.length,0,
      '粮食奖励分支原有4粮工，不应重复调岗');
    return{foodSource,status:'stage-11-captured',campaignMaxStage:data.campaignMaxStage||11,
      entry:data.entryState,branches:branches.map(branch=>({rewardMode:branch.rewardMode,wins:branch.wins,
        blockedAt:branch.blockedAt,foodStaffingChanges:branch.foodStaffingChanges,
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
  const match=combined.match(/P153_CUTOFF:(\{[^\r\n]+\})/);
  assert.ok(match,`P102粮工路线异常退出，无法识别结算结果；exit=${result.status}; ${combined}`);
  const diagnostic=JSON.parse(match[1]);
  assert.equal(diagnostic.settled.truncated,true,'截断路径应记录真实食物不足结算');
  assert.ok(diagnostic.settled.durationSec>0&&diagnostic.settled.durationSec<28800);
  return{foodSource,status:'cutoff',diagnostic};
}

const routes=sources.map(runSource);
for(const route of routes){
  if(route.status==='stage-11-captured'){
    for(const branch of route.branches){
      if(branch.rewardMode==='frontloaded-metal'&&branch.offlineWindows.length>0)
        assert.ok(branch.foodStaffingChanges.length>0,
          `${route.foodSource}/frontloaded-metal应在离线前从2粮工调至3粮工`);
    }
  }else{
    assert.ok(route.diagnostic.staffing.length>0,
      `${route.foodSource}来源的截断前应已应用粮工候选`);
  }
}

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'tools/verify/probe-population-early-18.js','tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-short-session-food-staffing-continuation-p153.js'
];
const artifact={batch:'P153',unit:'active/offline seconds; food workers; resources; troop queues; campaign wins; defeat recovery; stage-11 entry',
  method:'four-scholar zero-win population route saved and loaded by the current P102 campaign harness; an ephemeral P102 copy uses real setPopAlloc to keep at least three food workers immediately before every pending offline settlement; source job is varied across stone, coal and copper; after first-loss retry succeeds, queue to roster target, wait 600 active seconds with the same offline profile and attempt stage 10; after that win, queue to target, wait another 600 active seconds and attempt stage 11',
  scope:'600 active seconds followed by 28800 offline seconds; P102 600-second-per-win profile; stage-3 first-clear deed remains a development-only candidate branch; fixed battle random 0.5; isolated saves only; no player browser save',
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  populationEntry:{activeOnlineSeconds:population.activeOnlineSeconds,settledOfflineSeconds:population.settledOfflineSeconds,
    population:population.milestones.find(x=>x.label==='population-18').population,
    capacity:population.milestones.find(x=>x.label==='population-18').capacity},
  policy:'after the first offline boundary, retain three food workers by transferring from the specified source; branches that already have four food workers remain unchanged',
  routes,
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P153',routes:routes.map(route=>({foodSource:route.foodSource,status:route.status,
  cutoff:route.diagnostic?{rewardMode:route.diagnostic.rewardMode,stage:route.diagnostic.stage,
    requestedSeconds:route.diagnostic.requestedSeconds,actualSeconds:route.diagnostic.settled.durationSec,
    staffing:route.diagnostic.staffing}:null,
  branches:route.branches?.map(branch=>({rewardMode:branch.rewardMode,wins:branch.wins,
    blockedAt:branch.blockedAt,offlineWindows:branch.offlineWindows.length,
    staffingChanges:branch.foodStaffingChanges.length,
    retryWon:branch.defeatRecovery?.retryWon??null,stage10Win:branch.postRetryContinuation?.outcome?.win??null,
    stage10Roster:branch.postRetryContinuation?.armyBefore??null,stage11Win:branch.postStage10Continuation?.outcome?.win??null,
    stage11Roster:branch.postStage10Continuation?.armyBefore??null}))})),rawData:outputPath},null,2));
