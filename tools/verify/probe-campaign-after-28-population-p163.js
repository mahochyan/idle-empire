'use strict';
// P163 tests the reachable cavalry bridge from an exact P161 28-resident save.
// All player-facing actions run in the progression harness; only P102's probe
// source is patched in memory to expose a cavalry-first formation candidate.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p161DataPath='docs/codex/reports/data/p161-campaign-population-24-to-28.json';
const p161ReportPath='docs/codex/population-market-expansion-28-p161.md';
const p161ProbePath='tools/verify/probe-campaign-population-24-to-28-p161.js';
const p162DataPath='docs/codex/reports/data/p162-campaign-after-28-population-through-l20.json';
const p162ReportPath='docs/codex/population-campaign-after-28-p162.md';
const p162ProbePath='tools/verify/probe-campaign-after-28-population-p162.js';
const p102ProbePath='tools/verify/probe-population-first-clear-replenish-p102.js';
const outputPath=path.join(root,'docs/codex/reports/data/p163-campaign-cavalry-bridge.json');
const profile={activeSec:600,offlineSec:28800};
const candidateCounts=[1,5,7,10,15,19];
const entryStage=12;
const maxStage=20;
const recoveryWaitSeconds=600;

function hash(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function verifyInputs(data,label){
  for(const input of data.inputs||[])
    assert.equal(hash(input.file),input.sha256,`${label}输入SHA已变化：${input.file}`);
}
function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`${label}补丁锚点缺失`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`${label}补丁锚点不唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

const headResult=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(headResult.status,0,`读取HEAD失败：${headResult.stderr||''}`);
const head=headResult.stdout.trim();
const p161=JSON.parse(fs.readFileSync(path.join(root,p161DataPath),'utf8'));
assert.equal(p161.batch,'P161');
assert.equal(p161.sourceHead,head,'P161隔离终档必须来自当前HEAD');
verifyInputs(p161,'P161');
assert.equal(p161.results.length,2,'P161应提供两种岗位的28人口终档');
const entryRoute=p161.results[1];
assert.equal(entryRoute.status,'population-28-reached');
assert.equal(entryRoute.final.population,28);
assert.equal(entryRoute.final.capacity,28);
assert.equal(entryRoute.final.battleWins,11);
assert.equal(entryRoute.final.resources.deed,0);
assert.equal(typeof entryRoute.finalStateSave,'string');
const entrySave=JSON.parse(entryRoute.finalStateSave);
assert.equal(entrySave.population.current,28);
assert.equal(entrySave.defeated.length,11);
assert.deepEqual(entrySave.defeated,Array.from({length:11},(_,index)=>index+1));
assert.equal(entrySave.res.deed,0);
assert.deepEqual(entrySave.popAlloc,entryRoute.final.workers);
assert.equal(entrySave.pool.infantry,15);
assert.equal(entrySave.pool.archer||0,0);
assert.equal(entrySave.pool.bronze_guard||0,0);
assert.deepEqual(entrySave.formation.front.map(unit=>({type:unit.type,count:unit.count})),[
  {type:'bronze_guard',count:10},{type:'bronze_guard',count:5}
]);
assert.equal(entrySave.formation.back.reduce((n,unit)=>n+unit.count,0)+
  entrySave.formation.mid.reduce((n,unit)=>n+unit.count,0),13);
assert.equal(Number.isFinite(entrySave.ts),true,'P161来源存档缺少有效时间戳');

const p162=JSON.parse(fs.readFileSync(path.join(root,p162DataPath),'utf8'));
assert.equal(p162.batch,'P162');
assert.equal(p162.sourceHead,head);
verifyInputs(p162,'P162');
for(const result of p162.results){
  assert.equal(result.campaign.rows[0].deployed,28);
  assert.deepEqual(result.campaign.rows[0].deployedByTypeBefore,
    {infantry:0,archer:13,bronze_guard:15},'P162校正后的实际入场组成应是刀盾兵和弓手');
}

const p102Path=path.join(root,p102ProbePath);
let source=fs.readFileSync(p102Path,'utf8');
source=replaceOnce(source,'const campaignMaxStage=numericOption(\'--campaign-max-stage=\',6);\nassert.ok(campaignMaxStage>=1&&campaignMaxStage<=100,\'--campaign-max-stage须为1到100\');',
  'const campaignMaxStage=numericOption(\'--campaign-max-stage=\',6);\nassert.ok(campaignMaxStage>=1&&campaignMaxStage<=100,\'--campaign-max-stage须为1到100\');\nconst campaignStartStage=numericOption(\'--campaign-start-stage=\',1);\nassert.ok(campaignStartStage>=1&&campaignStartStage<=campaignMaxStage,\'--campaign-start-stage须在战役范围内\');',
  'campaign start option');
source=replaceOnce(source,'const raw=inputSaveStdin?fs.readFileSync(0,\'utf8\'):',
  'const raw=inputSaveStdin?process.__p163InputSave:',
  'serialized save input');
source=replaceOnce(source,
  "if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})\n        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));",
  "if(!settled?.ok||settled.durationSec<0||settled.durationSec>${sessionProfile.offlineSec})\n        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));",
  'retain food-clamped offline outcome');
source=replaceOnce(source,
  'offlineWindows.push({reason,activeOnlineSeconds:stats.activeOnlineSeconds,\n        durationSec:settled.durationSec,gains:settled.gains,before,after:snapshot()});',
  'offlineWindows.push({reason,activeOnlineSeconds:stats.activeOnlineSeconds,requestedSec:'+profile.offlineSec+',\n        durationSec:settled.durationSec,truncated:settled.truncated,report:S.offline?.pendingReport,gains:settled.gains,before,after:snapshot()});',
  'record actual offline duration');
source=replaceOnce(source,'let startSave,sourceRun;',
  'let startSave,sourceRun,inputTimestamp=null;',
  'source timestamp variable');
source=replaceOnce(source,'  const input=environment({rts_save:raw.trim()});\n  sourceRun=input.run;',
  '  const input=environment({rts_save:raw.trim()});\n  inputTimestamp=Number(JSON.parse(raw.trim()).ts);\n  assert.ok(Number.isFinite(inputTimestamp),\'外部终档时间戳非法\');\n  input.run(`Date.now=()=>${inputTimestamp};`);\n  sourceRun=input.run;',
  'source timestamp clock');
source=replaceOnce(source,'assert.equal(sourceRun(\'S.population.current\'),18);\nassert.equal(sourceRun(\'maxPop()\'),18);\nassert.equal(sourceRun(\'S.defeated.length\'),0);\nassert.equal(sourceRun(\'S.res.deed\'),0);',
  'assert.equal(sourceRun(\'S.population.current\'),28);\nassert.equal(sourceRun(\'maxPop()\'),28);\nassert.equal(sourceRun(\'S.defeated.length\'),11);\nassert.equal(sourceRun(\'S.res.deed\'),0);',
  'P161 entry assertions');
source=replaceOnce(source,'let battleStart=prepareEconomy();\nconst preparationSessionClock=battleStart.sessionClock||null;',
  'let battleStart=(()=>{\n  const e=environment({rts_save:startSave});\n  const run=e.run;\n  run(`Date.now=()=>${inputTimestamp};`);\n  assert.equal(run(\'loadSaveAndApply().status\'),\'ok\');\n  const getSessionStats=installSessionClock(run,sessionStartActive,sessionStartOffline);\n  const prepared={save:run("localStorage.getItem(\'rts_save\')"),tick:run(\'S.tick\'),resources:run(\'({...S.res})\'),\n    workers:run(\'({...S.popAlloc})\'),population:run(\'popCurrent()\'),capacity:run(\'maxPop()\'),\n    army:{infantry:run(\'S.pool.infantry||0\'),archer:run(\'S.pool.archer||0\'),bronze_guard:run(\'S.pool.bronze_guard||0\')}};\n  if(getSessionStats)prepared.sessionClock=getSessionStats();\n  return prepared;\n})();\nconst preparationSessionClock=battleStart.sessionClock||null;',
  'serialized P161 preparation');
source=replaceOnce(source,'  const e=environment({rts_save:battleStart.save});\n  const run=e.run;\n  assert.equal(run(\'loadSaveAndApply().status\'),\'ok\');',
  '  const e=environment({rts_save:battleStart.save});\n  const run=e.run;\n  run(`Date.now=()=>${inputTimestamp};`);\n  assert.equal(run(\'loadSaveAndApply().status\'),\'ok\');',
  'branch source timestamp clock');
source=replaceOnce(source,'const rosterTarget={infantry:15,archer:13,bronze_guard:15};',
  "const rosterTarget={infantry:15,archer:13,bronze_guard:15,cavalry_t1:process.__p163CavalryCount};",
  'cavalry roster target');
source=replaceOnce(source,
  "    let bronze=run('S.pool.bronze_guard||0');",
  "    let cavalry=run('S.pool.cavalry_t1||0');\n    for(let i=0;i<run(\"rowSlots('front')\")&&cavalry>0;i++){\n      const n=Math.min(run('regMax()'),cavalry);place('front','cavalry_t1',n,i);cavalry-=n;\n    }\n    let bronze=run('S.pool.bronze_guard||0');",
  'cavalry first formation');
source=replaceOnce(source,
  "      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;",
  "      if(run(`S.formation.front[${i}]`))continue;\n      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;",
  'skip occupied front slots');
const bronzeCount="bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard')";
const cavalryCount="bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard'),cavalry_t1:(S.pool.cavalry_t1||0)+expeditionCount('cavalry_t1')";
assert.ok(source.includes(bronzeCount),'P102探针缺少战斗兵种计数');
source=source.split(bronzeCount).join(cavalryCount);
const clearRewardStart=source.indexOf('  function clearReward(stage,win){');
const waitStart=source.indexOf('  function wait(seconds){',clearRewardStart);
assert.ok(clearRewardStart>=0&&waitStart>clearRewardStart,'清奖函数边界缺失');
source=source.slice(0,clearRewardStart)+
  '  function clearReward(stage,win){return {award:0,bonus:0,spent:0};}\n'+
  source.slice(waitStart);
source=replaceOnce(source,'  for(let stage=1;stage<=campaignMaxStage;stage++){',
  '  for(let stage=campaignStartStage;stage<=campaignMaxStage;stage++){',
  'campaign start loop');
source=replaceOnce(source,'  if(getSessionStats)branch.sessionClock=getSessionStats();\n  return branch;',
  '  if(getSessionStats)branch.sessionClock=getSessionStats();\n  branch.terminalSave=run("localStorage.getItem(\'rts_save\')");\n  return branch;',
  'terminal continuation save');
source=replaceOnce(source,'rows:rows.filter(r=>r.stage>=3).map(r=>({stage:r.stage,win:r.outcome.win,round:r.outcome.round,callbacks:r.callbacks,',
  'rows:rows.filter(r=>r.stage>=3).map(r=>({stage:r.stage,enemy:r.enemy,win:r.outcome.win,round:r.outcome.round,callbacks:r.callbacks,',
  'campaign enemy evidence');
source=replaceOnce(source,
  "const before=run(`({deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),",
  "const before=run(`({deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),deployedByType:Object.fromEntries(['infantry','archer','bronze_guard','cavalry_t1'].map(type=>[type,S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type===type).reduce((n,u)=>n+u.count,0)])),",
  'deployed unit attribution');
source=replaceOnce(source,
  "const outcome=run(`({win:S.defeated.includes(${stage}),round:B.round,army:armyCount(),",
  "const outcome=run(`({win:S.defeated.includes(${stage}),round:B.round,army:armyCount(),deployedByType:Object.fromEntries(['infantry','archer','bronze_guard','cavalry_t1'].map(type=>[type,S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type===type).reduce((n,u)=>n+u.count,0)])),",
  'surviving deployed unit attribution');
source=replaceOnce(source,
  'deployed:r.before.deployed,armyBefore:r.before.army,armyAfter:r.outcome.army,',
  'deployed:r.before.deployed,deployedByTypeBefore:r.before.deployedByType,deployedByTypeAfter:r.outcome.deployedByType,armyBefore:r.before.army,armyAfter:r.outcome.army,',
  'campaign deployment columns');
const setupBlock=`  const p163Setup=(()=>{
    const requested=process.__p163CavalryCount;
    const before={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      workers:run('({...S.popAlloc})'),resources:run('({...S.res})'),
      defeated:run('S.defeated.length'),infantryPool:run('S.pool.infantry||0')};
    let workforceChange=null;
    if(process.__p163MilitaryFocus){
      const previous=run('({...S.popAlloc})');
      assign(run,{wood:11,stone:5,food:12});
      workforceChange={before:previous,after:run('({...S.popAlloc})'),
        rates:{wood:run("prodRate('wood')"),stone:run("prodRate('stone')"),food:run("prodRate('food')")}};
    }
    const build=checked(run,"buildAct('stable')",'P163建造骑兵训练场');
    let buildTicks=0;
    while(run("bldSt('stable').lv<1")&&buildTicks<1000){run('tick()');buildTicks++;}
    assert.equal(run("bldSt('stable').lv"),1,'骑兵训练场未在1000个真实tick内建成');
    const buildingUpgrades=[];
    let upgradeTicks=0;
    while(run("unitCap('cavalry_t1')")<requested&&upgradeTicks<30000){
      const previousLevel=run("bldSt('stable').lv");
      const reason=run("upgradeLockReason('stable')");
      assert.equal(reason,'','骑兵训练场升至候选数量所需等级被阻挡：'+reason);
      const quote=run("({...upCost('stable')})");
      while(['wood','stone','food'].some(key=>run('S.res.'+key+'<'+quote[key]))&&upgradeTicks<30000){
        run('tick()');upgradeTicks++;
      }
      assert.ok(upgradeTicks<30000,'骑兵训练场升级付款等待超过30000个真实tick');
      const result=checked(run,"buildAct('stable')",'P163升级骑兵训练场Lv.'+(previousLevel+1));
      let wait=0;
      while(run("bldSt('stable').lv")===previousLevel&&wait<1000){run('tick()');wait++;upgradeTicks++;}
      assert.equal(run("bldSt('stable').lv"),previousLevel+1,'骑兵训练场升级未完成');
      buildingUpgrades.push({fromLevel:previousLevel,toLevel:run("bldSt('stable').lv"),quote,result,
        buildTicks:wait,resources:run('({...S.res})'),cap:run("unitCap('cavalry_t1')")});
    }
    assert.ok(upgradeTicks<30000,'骑兵训练场升级总耗时超过30000个真实tick');
    const afterBuild={building:run("({...bldSt('stable')})"),resources:run('({...S.res})'),
      cap:run("unitCap('cavalry_t1')"),levelLock:run("upgradeLockReason('stable')"),
      tierLock:run("tierUpgradeLockReason('stable')"),townLevel:run('S.townLv'),
      buildingLevelCap:run('S.townLv*CFG.buildingCaps.training')};
    assert.ok(afterBuild.cap>=requested,'真实骑兵上限'+afterBuild.cap+'不足以满足'+requested+'名候选');
    const unlock=run("unlockUnitRoot('cavalry_t1')");
    assert.equal(unlock?.ok,true,'P163真实侍从骑士解锁失败：'+JSON.stringify(unlock));
    const afterUnlock={resources:run('({...S.res})'),tech:run('S.res.tech'),merit:run('S.merit'),
      unlocked:run('S.upgradedUnits.cavalry_t1'),lock:run("trainLockReason('cavalry_t1')"),
      cap:run("unitCap('cavalry_t1')"),capLeft:run("unitCapLeft('cavalry_t1')")};
    assert.equal(afterUnlock.unlocked,true);
    assert.equal(afterUnlock.lock,'');
    assert.ok(requested<=afterUnlock.capLeft,'候选骑兵数'+requested+'超过真实上限'+afterUnlock.capLeft);
    const train=checked(run,"train('cavalry_t1',"+requested+')','P163训练侍从骑士');
    assert.equal(train.qty,requested,'训练请求被真实队列上限截断');
    let trainingTicks=0;
    while(run('(S.pool.cavalry_t1||0)<'+requested)&&trainingTicks<5000){run('tick()');trainingTicks++;}
    const completed=run('(S.pool.cavalry_t1||0)');
    const afterTraining={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      pool:completed,queue:run("S.queue.cavalry_t1?.count||0"),queueReason:run("S.queue.cavalry_t1?.reason||''"),
      resources:run('({...S.res})'),trainingBudget:{cost:run("({...CFG.units.cavalry_t1.cost})"),
        maxAffordable:run("maxUnitsByTrainingCost(CFG.units.cavalry_t1.cost)"),
        unitCap:run("unitCap('cavalry_t1')"),unitCapLeft:run("unitCapLeft('cavalry_t1')")}};
    return{requested,before,workforceChange,build,buildTicks,buildingUpgrades,upgradeTicks,afterBuild,unlock,afterUnlock,train,trainingTicks,
      afterTraining,activeSeconds:run('globalThis.__p102SessionStats.activeOnlineSeconds'),
      offlineSeconds:run('globalThis.__p102SessionStats.settledOfflineSeconds')};
  })();
`;
source=replaceOnce(source,'  const rows=[];\n  for(let stage=campaignStartStage;stage<=campaignMaxStage;stage++){',
  '  const rows=[];\n'+setupBlock+'  for(let stage=campaignStartStage;stage<=campaignMaxStage;stage++){',
  'real cavalry setup before campaign');
source=replaceOnce(source,'  for(let stage=campaignStartStage;stage<=campaignMaxStage;stage++){',
  '  for(let stage=campaignStartStage;stage<=campaignMaxStage&&p163Setup.afterTraining.pool===process.__p163CavalryCount;stage++){',
  'skip campaign when cavalry training is incomplete');
source=replaceOnce(source,'  if(getSessionStats)branch.sessionClock=getSessionStats();\n  branch.terminalSave=',
  '  branch.p163Setup=p163Setup;\n  if(getSessionStats)branch.sessionClock=getSessionStats();\n  branch.terminalSave=',
  'campaign reports cavalry setup');
const outputStart=source.indexOf('const windows=waitWindows;');
assert.ok(outputStart>=0,'探针输出段缺失');
source=source.slice(0,outputStart)+`assert.equal(waitWindows.length,1,'P163每条路线只接受一个胜后补给窗口');
const seconds=waitWindows[0];
const campaign=makeBranch('current',seconds);
console.log(JSON.stringify({batch:'P163',unit:'active online seconds; offline seconds; population; deployed soldiers; inventory; resources; campaign stages',
  campaignStartStage,campaignMaxStage,waitSecondsPerWin:seconds,recoveryWaitSeconds:${recoveryWaitSeconds},
  cavalryTarget:process.__p163CavalryCount,campaign},null,2));
`;

function runCandidate(count,seed,phase,militaryFocus=false){
  const originalDateNow=Date.now;
  const output=[];
  try{
    const fakeProcess={argv:[process.execPath,p102Path,'--input-save-stdin',
      `--session-profile=${profile.activeSec}:${profile.offlineSec}`,
      `--campaign-start-stage=${entryStage}`,`--campaign-max-stage=${maxStage}`,
      '--wait-windows=600',`--battle-seed=${seed}`,'--retry-first-loss',
      `--recovery-wait-seconds=${recoveryWaitSeconds}`],
      __p163InputSave:entryRoute.finalStateSave,__p163CavalryCount:count,
      __p163MilitaryFocus:militaryFocus};
    const capturedConsole={log:(...args)=>output.push(args.join(' ')),error:(...args)=>{throw Error(args.join(' '));}};
    const execute=new Function('require','console','__dirname','process',source);
    execute(createRequire(p102Path),capturedConsole,path.dirname(p102Path),fakeProcess);
    assert.equal(output.length,1,`P163候选${count}／种子${seed}输出条数错误`);
    const parsed=JSON.parse(output[0]);
    assert.equal(parsed.batch,'P163');
    assert.equal(parsed.campaignStartStage,entryStage);
    assert.equal(parsed.campaignMaxStage,maxStage);
    assert.equal(parsed.cavalryTarget,count);
    assert.equal(parsed.campaign.p163Setup.requested,count);
    assert.equal(parsed.campaign.p163Setup.before.tick,entryRoute.final.tick);
    assert.equal(parsed.campaign.p163Setup.before.population,28);
    assert.equal(parsed.campaign.p163Setup.before.capacity,28);
    assert.equal(parsed.campaign.p163Setup.before.defeated,11);
    assert.ok(parsed.campaign.p163Setup.afterTraining.pool<=count);
    assert.ok(parsed.campaign.p163Setup.afterTraining.trainingBudget.unitCap>=count);
    if(parsed.campaign.rows.length){
      assert.equal(parsed.campaign.rows[0].stage,entryStage);
      assert.equal(parsed.campaign.rows[0].tickBefore,parsed.campaign.p163Setup.afterTraining.tick,
        '战役必须从真实训练完成的当前tick开始');
      assert.equal(parsed.campaign.rows[0].populationBefore,parsed.campaign.p163Setup.afterTraining.population);
      assert.equal(parsed.campaign.rows[0].capacityBefore,28);
      assert.deepEqual(parsed.campaign.rows[0].deployedByTypeBefore,
        {infantry:0,archer:13,bronze_guard:count<=10?10:0,cavalry_t1:count},
        '骑兵优先占一个前排阵位，余下刀盾兵占第二个阵位，步兵仍留在预备池');
    }else assert.notEqual(parsed.campaign.p163Setup.afterTraining.pool,count,
      '没有战斗记录时应是当前资源与岗位无法完成全部候选骑兵训练');
    assert.equal(parsed.campaign.rows.every(row=>row.reward.award===0),true,
      'P163不得注入额外地契奖励');
    assert.equal(parsed.campaign.rows.every(row=>Number.isFinite(row.populationBefore)&&
      row.populationBefore>=0&&row.populationBefore<=28&&row.capacityBefore===28),true);
    const terminal=JSON.parse(parsed.campaign.terminalSave);
    assert.ok(terminal.population.current>=0&&terminal.population.current<=28);
    assert.equal(terminal.res.deed,0);
    assert.ok(parsed.campaign.sessionClock.offlineWindows.every(window=>window.durationSec>=0&&
      window.durationSec<=profile.offlineSec&&window.requestedSec===profile.offlineSec));
    assert.equal(parsed.campaign.sessionClock.settledOfflineSeconds,
      parsed.campaign.sessionClock.offlineWindows.reduce((total,window)=>total+window.durationSec,0));
    if(parsed.campaign.defeatRecovery){
      assert.equal(parsed.campaign.defeatRecovery.recoveryWaitSeconds,recoveryWaitSeconds);
      assert.equal(parsed.campaign.defeatRecovery.retry.reward.award,0);
      assert.ok(parsed.campaign.defeatRecovery.beforeRetry.army.cavalry_t1<=count,
        '败后恢复库存不得超过真实目标骑兵数');
    }
    const stage17=parsed.campaign.rows.find(row=>row.stage===17);
    const retryAt17=parsed.campaign.defeatRecovery?.stage===17
      ?parsed.campaign.defeatRecovery.retry.outcome.win===true:false;
    return{phase,count,seed,name:entryRoute.name,sourceWorkers:entryRoute.final.workers,
      inputSaveSha256:crypto.createHash('sha256').update(entryRoute.finalStateSave).digest('hex'),
      setup:parsed.campaign.p163Setup,campaign:parsed.campaign,
      passesL17FirstTry:stage17?.win===true,passesL17AfterRecovery:stage17?.win===true||retryAt17,
      trainingComplete:parsed.campaign.p163Setup.afterTraining.pool===count,
      blockedAt:parsed.campaign.blockedAt,
      wins:parsed.campaign.wins,attempted:parsed.campaign.attempted};
  }finally{
    Date.now=originalDateNow;
  }
}

const sweep=candidateCounts.map(count=>runCandidate(count,3,'seed-3-dose-sweep'));
const fullyTrained=sweep.filter(result=>result.trainingComplete);
const firstPassing=fullyTrained.find(result=>result.passesL17AfterRecovery);
const selected=firstPassing||fullyTrained[fullyTrained.length-1]||sweep[sweep.length-1];
const selectedIndex=candidateCounts.indexOf(selected.count);
const compareCount=selectedIndex>0?candidateCounts[selectedIndex-1]:
  candidateCounts[selectedIndex+1]??candidateCounts[selectedIndex];
const multiseed=[11,29].flatMap(seed=>[selected.count,compareCount]
  .filter((count,index,array)=>array.indexOf(count)===index)
  .map(count=>runCandidate(count,seed,'selected-and-adjacent-multiseed')));
const militaryFocus=runCandidate(19,3,'19-cavalry-food-focused-workforce',true);
const militaryFocusMultiseed=militaryFocus.passesL17AfterRecovery
  ?[11,29].map(seed=>runCandidate(19,seed,'19-cavalry-food-focused-workforce-multiseed',true)):[];

const inputFiles=[p161DataPath,p161ReportPath,p161ProbePath,p162DataPath,p162ReportPath,p162ProbePath,
  p102ProbePath,'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'tools/verify/probe-campaign-after-28-population-p163.js'];
const artifact={batch:'P163',unit:'simulated active online seconds; simulated offline seconds; population; soldiers; resources; campaign stages',
  method:'continue the exact serialized P161 28-resident four-food-worker ending; use real buildAct, unlockUnitRoot, train, tick, formation, battle, casualty, reward suppression for the development-only deed model, replenishment, save, and settleOffline functions; alter only the in-memory P102 probe so T1 cavalry gets first choice of existing front slots; sweep counts 1, 5, 7, 10, 15 and 19 at seed 3, then repeat the highest fully trained count (or lowest L17 passer) and adjacent lower comparison at seeds 11 and 29',
  scope:'one no-deed L1-L11 campaign ending; no injected resources, deeds, level rewards, or direct state edits; use actual stable construction, T1 unlock and queued troop costs; one 600-active-second per-win recovery window plus the existing 8-hour offline profile; population and housing remain 28; no player save or runtime, CFG, level, UI, art, or Android edits',
  sourceHead:head,sourceBatch:'P161/P162',entry:{name:entryRoute.name,tick:entryRoute.final.tick,
    population:entryRoute.final.population,capacity:entryRoute.final.capacity,workers:entryRoute.final.workers,
    resources:entryRoute.final.resources,ownedRoster:{infantry:15,archer:13,bronze_guard:15},
    actuallyDeployedRoster:{infantry:0,archer:13,bronze_guard:15},inputSaveSha256:crypto.createHash('sha256').update(entryRoute.finalStateSave).digest('hex')},
  reachableStable:{level:1,unitCapAtStart:19,
    reason:'当前CFG启用unitCapBoost，骑兵上限为base 15 + perLv 4 × stable Lv.1；stable升至T2仍需击败L20'},
  sessionProfile:profile,entryStage,maxStage,recoveryWaitSeconds,candidateCounts,
  selection:{selectedCount:selected.count,selectedPassedL17:selected.passesL17AfterRecovery,
    comparisonCount:compareCount,selectionRule:firstPassing?'lowest fully trained candidate passing L17 on first attempt or one documented recovery retry':'highest fully trained seed-3 candidate; none passed L17 after the recovery retry'},
  sweep,multiseed,militaryFocus:{policy:{wood:11,stone:5,food:12,coal:0,copper:0},
    run:militaryFocus,additionalSeeds:militaryFocusMultiseed},
  inputs:inputFiles.map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P163',selected:artifact.selection,
  seed3:sweep.map(result=>({cavalry:result.count,deployed:result.campaign.rows[0]?.deployed,
    l12:result.campaign.rows[0]?.win,l16:result.campaign.rows.find(row=>row.stage===16)?.win,
    l17FirstTry:result.passesL17FirstTry,l17AfterRecovery:result.passesL17AfterRecovery,
    l17Round:result.campaign.rows.find(row=>row.stage===17)?.round,
    firstLoss:result.blockedAt,wins:result.wins,setupActiveSeconds:result.setup.activeSeconds,
    setupOfflineSeconds:result.setup.offlineSeconds,offlineWindows:result.campaign.sessionClock?.offlineWindows?.length})),
  multiseed:multiseed.map(result=>({seed:result.seed,cavalry:result.count,
    l17FirstTry:result.passesL17FirstTry,l17AfterRecovery:result.passesL17AfterRecovery,
    l17Round:result.campaign.rows.find(row=>row.stage===17)?.round,
    firstLoss:result.blockedAt,wins:result.wins})),
  militaryFocus:{trained:militaryFocus.setup.afterTraining.pool,queue:militaryFocus.setup.afterTraining.queue,
    queueReason:militaryFocus.setup.afterTraining.queueReason,activeSeconds:militaryFocus.setup.activeSeconds,
    offlineSeconds:militaryFocus.setup.offlineSeconds,l17:militaryFocus.campaign.rows.find(row=>row.stage===17)?.win,
    firstLoss:militaryFocus.blockedAt,wins:militaryFocus.wins,
    additionalSeeds:militaryFocusMultiseed.map(result=>({seed:result.seed,l17:result.campaign.rows.find(row=>row.stage===17)?.win,
      firstLoss:result.blockedAt,wins:result.wins}))},rawData:outputPath},null,2));
