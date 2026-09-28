'use strict';
// P162 resumes the exact P161 28-resident save and tests real campaign combat/replenishment through L20.
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
const p102ProbePath='tools/verify/probe-population-first-clear-replenish-p102.js';
const outputPath=path.join(root,'docs/codex/reports/data/p162-campaign-after-28-population-through-l20.json');
const profile={activeSec:600,offlineSec:28800};
const startStage=12;
const maxStage=20;
const retryWaitSeconds=600;

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
const routes=p161.results.map(route=>{
  assert.equal(route.status,'population-28-reached',`${route.name}未到达28人口`);
  assert.equal(route.final.population,28);
  assert.equal(route.final.capacity,28);
  assert.equal(route.final.battleWins,11);
  assert.equal(route.final.resources.deed,0);
  assert.equal(typeof route.finalStateSave,'string',`${route.name}缺少序列化终档`);
  const saved=JSON.parse(route.finalStateSave);
  assert.equal(saved.population.current,28);
  assert.equal(saved.defeated.length,11);
  assert.deepEqual(saved.defeated,Array.from({length:11},(_,index)=>index+1));
  assert.equal(saved.res.deed,0);
  assert.deepEqual(saved.popAlloc,route.final.workers);
  assert.equal(Number.isFinite(saved.ts),true,`${route.name}来源存档缺少有效时间戳`);
  return{route,saved};
});

const p102Path=path.join(root,p102ProbePath);
let source=fs.readFileSync(p102Path,'utf8');
source=replaceOnce(source,'const campaignMaxStage=numericOption(\'--campaign-max-stage=\',6);\nassert.ok(campaignMaxStage>=1&&campaignMaxStage<=100,\'--campaign-max-stage须为1到100\');',
  'const campaignMaxStage=numericOption(\'--campaign-max-stage=\',6);\nassert.ok(campaignMaxStage>=1&&campaignMaxStage<=100,\'--campaign-max-stage须为1到100\');\nconst campaignStartStage=numericOption(\'--campaign-start-stage=\',1);\nassert.ok(campaignStartStage>=1&&campaignStartStage<=campaignMaxStage,\'--campaign-start-stage须在战役范围内\');',
  'campaign start option');
source=replaceOnce(source,'const raw=inputSaveStdin?fs.readFileSync(0,\'utf8\'):',
  'const raw=inputSaveStdin?process.__p162InputSave:',
  'serialized save input');
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
  "const before=run(`({deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),deployedByType:Object.fromEntries(['infantry','archer','bronze_guard'].map(type=>[type,S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type===type).reduce((n,u)=>n+u.count,0)])),",
  'deployed unit attribution');
source=replaceOnce(source,
  "const outcome=run(`({win:S.defeated.includes(${stage}),round:B.round,army:armyCount(),",
  "const outcome=run(`({win:S.defeated.includes(${stage}),round:B.round,army:armyCount(),deployedByType:Object.fromEntries(['infantry','archer','bronze_guard'].map(type=>[type,S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type===type).reduce((n,u)=>n+u.count,0)])),",
  'surviving deployed unit attribution');
source=replaceOnce(source,
  'deployed:r.before.deployed,armyBefore:r.before.army,armyAfter:r.outcome.army,',
  'deployed:r.before.deployed,deployedByTypeBefore:r.before.deployedByType,deployedByTypeAfter:r.outcome.deployedByType,armyBefore:r.before.army,armyAfter:r.outcome.army,',
  'campaign deployment columns');
const bottomStart=source.indexOf('const windows=waitWindows;');
assert.ok(bottomStart>=0,'探针输出段缺失');
source=source.slice(0,bottomStart)+`assert.equal(waitWindows.length,1,'P162每条路线只接受一个补给窗口');
const seconds=waitWindows[0];
const campaign=makeBranch('current',seconds);
console.log(JSON.stringify({batch:'P162',unit:'active online seconds; offline seconds; population; soldiers; resources; campaign stages',
  campaignStartStage,campaignMaxStage,waitSecondsPerWin:seconds,
  recoveryWaitSeconds:${retryWaitSeconds},campaign},null,2));
`;

function runRoute(route,saved){
  const originalDateNow=Date.now;
  const output=[];
  try{
    const fakeProcess={argv:[process.execPath,p102Path,'--input-save-stdin',
      `--session-profile=${profile.activeSec}:${profile.offlineSec}`,
      `--campaign-start-stage=${startStage}`,`--campaign-max-stage=${maxStage}`,
      '--wait-windows=600','--battle-random=0.5','--retry-first-loss',
      `--recovery-wait-seconds=${retryWaitSeconds}`],__p162InputSave:route.finalStateSave};
    const capturedConsole={log:(...args)=>output.push(args.join(' ')),error:(...args)=>{throw Error(args.join(' '));}};
    const execute=new Function('require','console','__dirname','process',source);
    execute(createRequire(p102Path),capturedConsole,path.dirname(p102Path),fakeProcess);
    assert.equal(output.length,1,`${route.name}探针输出条数错误`);
    const parsed=JSON.parse(output[0]);
    assert.equal(parsed.batch,'P162');
    assert.equal(parsed.campaignStartStage,startStage);
    assert.equal(parsed.campaignMaxStage,maxStage);
    const terminal=JSON.parse(parsed.campaign.terminalSave);
    assert.equal(terminal.population.current,28,`${route.name}战役期间人口意外变化`);
    assert.equal(terminal.res.deed,0,`${route.name}不应注入地契`);
    assert.ok(parsed.campaign.rows.length>0,`${route.name}未执行任何战斗`);
    assert.equal(parsed.campaign.rows[0].stage,startStage);
    assert.equal(parsed.campaign.rows[0].tickBefore,saved.tick,`${route.name}未从确切28人口终档起跑`);
    assert.equal(parsed.campaign.attempted,6,`${route.name}应逐关到达L17首败`);
    assert.equal(parsed.campaign.wins,5,`${route.name}应胜过L12至L16`);
    assert.equal(parsed.campaign.blockedAt,17,`${route.name}首个阻挡关应为L17`);
    assert.deepEqual(parsed.campaign.rows.map(row=>row.win),[true,true,true,true,true,false]);
    for(const row of parsed.campaign.rows){
      assert.equal(row.reward.award,0,`${route.name}探针不得注入额外关卡奖励`);
      assert.equal(row.populationBefore,28,`${route.name}战役中人口应保持28`);
      assert.equal(row.capacityBefore,28,`${route.name}战役中容量应保持28`);
    }
    if(parsed.campaign.defeatRecovery){
      assert.equal(parsed.campaign.defeatRecovery.recoveryWaitSeconds,retryWaitSeconds);
      assert.equal(parsed.campaign.defeatRecovery.retry.reward.award,0);
      assert.equal(parsed.campaign.defeatRecovery.retry.outcome.win,false,`${route.name}一次真实补兵重试应保留L17首败结果`);
      assert.deepEqual(parsed.campaign.defeatRecovery.beforeRetry.army,
        {infantry:15,archer:13,bronze_guard:15},`${route.name}重试前应实际补满参考编制`);
    }
    assert.equal(parsed.campaign.sessionClock.offlineWindows.length,6,`${route.name}应记录6个离线窗`);
    assert.equal(parsed.campaign.sessionClock.settledOfflineSeconds,6*profile.offlineSec,
      `${route.name}离线窗应完整结算`);
    assert.ok(parsed.campaign.sessionClock.offlineWindows.every(window=>window.durationSec===profile.offlineSec),
      `${route.name}存在不完整离线窗`);
    return parsed.campaign;
  }finally{
    Date.now=originalDateNow;
  }
}

const results=routes.map(({route,saved})=>({name:route.name,sourceWorkers:route.final.workers,
  inputSaveSha256:crypto.createHash('sha256').update(route.finalStateSave).digest('hex'),
  campaign:runRoute(route,saved)}));
const inputFiles=[p161DataPath,p161ReportPath,p161ProbePath,p102ProbePath,
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'tools/verify/probe-campaign-after-28-population-p162.js'];
const artifact={batch:'P162',unit:'simulated active online seconds; simulated offline seconds; population; troops; resources; campaign stages',
  method:'resume both exact serialized P161 28-resident endings at L12; use the real battle, settlement, reward, resource, training, tick, save, and settleOffline functions through L20 or first block; at each win queue actual replacements to the P102 reference roster; after the first defeat queue once, wait 600 active seconds with the existing 8-hour offline profile, then retry that stage once',
  scope:'two staffing variants derived from the same no-deed L1-L11 campaign; no injected deeds/resources/reward, no direct player-state edits, no player save; fixed battle random 0.5; 600 simulated active seconds per replenishment window plus 28800 simulated offline seconds; population and housing remain 28',
  sourceHead:head,sourceBatch:'P161',campaign:{startStage,maxStage,rosterTarget:{infantry:15,archer:13,bronze_guard:15},profile,
    retryWaitSeconds,battleRandom:0.5},results,
  inputs:inputFiles.map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P162',results:results.map(result=>({name:result.name,
  status:result.campaign.blockedAt?'first-loss-and-one-retry-recorded':'campaign-window-finished',
  attempted:result.campaign.attempted,wins:result.campaign.wins,blockedAt:result.campaign.blockedAt,
  stages:result.campaign.rows.map(row=>({stage:row.stage,win:row.win,round:row.round,
    population:row.populationBefore,armyBefore:row.byTypeBefore,armyAfter:row.byTypeAfter,
    replenishment:row.replenishment?{queued:row.replenishment.queuedAtStart,remaining:row.replenishment.remainingQueue,
      reasons:row.replenishment.queueReasons,resources:row.replenishment.resources}:null})),
  defeatRecovery:result.campaign.defeatRecovery?{stage:result.campaign.defeatRecovery.stage,
    waitActiveSeconds:result.campaign.defeatRecovery.activeWaitSeconds,
    afterTraining:result.campaign.defeatRecovery.afterTraining,
    beforeRetry:result.campaign.defeatRecovery.beforeRetry,
    retryWon:result.campaign.defeatRecovery.retry.outcome.win,
    retryArmy:result.campaign.defeatRecovery.retry.outcome.byType}:null,
  activeOnlineSeconds:result.campaign.sessionClock?.activeOnlineSeconds,
  offlineWindows:result.campaign.sessionClock?.offlineWindows?.length,
  offlineSeconds:result.campaign.sessionClock?.settledOfflineSeconds,
  finalPopulation:result.campaign.population,finalCapacity:result.campaign.capacity,
  finalResources:result.campaign.terminalSave?JSON.parse(result.campaign.terminalSave).res:null})),rawData:outputPath},null,2));
