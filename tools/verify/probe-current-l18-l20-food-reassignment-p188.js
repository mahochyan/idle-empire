'use strict';
// P188: paid L17 old-line saves, one real worker reassignment, current L20.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p181Path=path.join(__dirname,'probe-current-l18-l20-archers-p181.js');
const p181DataPath=path.join(root,'docs/codex/reports/data/p181-current-l18-l20-archers.json');
const p178DataPath=path.join(root,'docs/codex/reports/data/p178-current-l18-l20-bridge.json');
const p182DataPath=path.join(root,'docs/codex/reports/data/p182-current-l20-boss-roster.json');
const outputPath=path.join(root,'docs/codex/reports/data/p188-current-l18-l20-food-reassignment.json');
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p181=JSON.parse(fs.readFileSync(p181DataPath,'utf8'));
const p178=JSON.parse(fs.readFileSync(p178DataPath,'utf8'));
const p182=JSON.parse(fs.readFileSync(p182DataPath,'utf8'));
const expectedCurrentLevelsSha256='f355720480b51dddafe1bb4c9c78281684125183611cb9afbf7869e8063989c5';
const seeds=[1,42];
const policies=[{id:'original',from:null},{id:'stone-to-food',from:'stone'},
  {id:'copper-to-food',from:'copper'}];
const targets={bronze_guard:15,infantry_t1:15,archer_t1:30};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P188找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P188的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p181.batch,'P181');
assert.equal(p178.batch,'P178');
assert.equal(p182.batch,'P182');
const oldLevels=p181.inputs.find(item=>item.file==='levels.js');
assert.ok(oldLevels,'P181缺少旧关卡SHA');
assert.notEqual(oldLevels.sha256,expectedCurrentLevelsSha256,
  '第20关变化未被识别');
assert.equal(sha(fs.readFileSync(path.join(root,'levels.js'))),
  expectedCurrentLevelsSha256,'当前levels.js不等于已复核的L20版');
for(const artifact of [p181,p178,p182])for(const input of artifact.inputs){
  if(input.file==='levels.js')continue; // Only this file changed; exact new SHA locked above.
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `${artifact.batch}来源文件已变化：${input.file}`);
}
function reuseP181(){
  let source=fs.readFileSync(p181Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return {buildSourceL16,trainingTrial,restore,owned,fight,place,state,snapshot,reload,recovery,formArchers,enemy};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P181真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p181Path),{log(){},error:console.error},path.dirname(p181Path));
}
const {buildSourceL16,trainingTrial,restore,owned,fight,state,reload,
  recovery,formArchers,enemy}=reuseP181();
function currentEnemies(run){
  const all=[17,18,19,20].map(stage=>enemy(run,stage));
  assert.equal(all[0].totalPeople,63);
  for(const i of [1,2]){
    const {name:unusedNow,...now}=all[i];
    const {name:unusedOld,...old}=p181.stageConfigs[i-1];
    assert.deepEqual(now,old,`L${all[i].id}敌阵与P181旧档不一致`);
  }
  assert.deepEqual(all[3].composition,
    {infantry:[8,6,4],archer:[8,6,4],cavalry_t1:[8,6,4]},
    '当前L20必须是三系各8-6-4');
  assert.equal(all[3].groups,9);
  assert.equal(all[3].totalPeople,54);
  assert.deepEqual(all[3].bossMult,{atk:1.35,def:1.3});
  const actual=plain(run('CFG.enemies[19]'));
  const historic=plain(p182.originalEnemy);
  for(const item of [actual,historic]){
    delete item.name;delete item.desc;delete item.units;
  }
  assert.deepEqual(actual,historic,
    'L20敌阵人数以外的Boss数值、奖励或掉落发生变化');
  return all;
}
function rates(run){
  return plain(run(`({wood:prodRate('wood'),stone:prodRate('stone'),
    food:prodRate('food'),coal:prodRate('coal'),copper:prodRate('copper'),
    armyUpkeep:totalUpkeep(),populationCost:popCurrent()*CFG.popFoodCost,
    foodNetBeforeTraining:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost,
    metalRecipeMode:S.metalRecipeMode})`));
}
function allocate(run,policy){
  const before=state(run),beforeRates=rates(run),actions=[];
  if(policy.from){
    assert.equal(before.checkpoint.population,19,'调岗应取19人口无奖档');
    assert.equal(before.checkpoint.workers.food,4,'原档粮工应为4');
    assert.equal(run('popFree()'),0,'来源档意外有空闲人口');
    const from=policy.from;
    const old=before.checkpoint.workers[from];
    assert.ok(old>0,`${from}没有可调出的工人`);
    const r1=plain(run(`setPopAlloc('${from}',${old-1})`));
    assert.deepEqual(r1,{ok:true},`${from}退岗失败`);
    actions.push({resource:from,from:old,to:old-1,result:r1,
      saved:!!run("localStorage.getItem('rts_save')")});
    assert.equal(run('popFree()'),1,'退岗未释放1名人口');
    const r2=plain(run('setPopAlloc(\'food\',5)'));
    assert.deepEqual(r2,{ok:true},'粮工入岗失败');
    actions.push({resource:'food',from:4,to:5,result:r2,
      saved:!!run("localStorage.getItem('rts_save')")});
    assert.equal(run('popFree()'),0,'调岗后应重新分配全部人口');
  }
  const after=state(run),afterRates=rates(run);
  assert.deepEqual(after.checkpoint.resources,before.checkpoint.resources,
    '调岗本身不应增加资源');
  assert.equal(after.checkpoint.tick,before.checkpoint.tick,
    '调岗本身不应推进时间');
  assert.deepEqual(after.checkpoint.defeated,before.checkpoint.defeated,
    '调岗本身不应改变通关');
  const saved=reload(run,`P188 ${policy.id}岗位重载`);
  assert.deepEqual(state(saved.run),after,'岗位存档重载改变状态');
  return{run:saved.run,actions,beforeWorkers:before.checkpoint.workers,
    afterWorkers:after.checkpoint.workers,beforeRates,afterRates,
    rateDelta:Object.fromEntries(Object.keys(beforeRates).filter(key=>
      typeof beforeRates[key]==='number').map(key=>
      [key,afterRates[key]-beforeRates[key]])),
    afterState:after,saveSha256:saved.saveSha256};
}
function difference(before,after){
  return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(after)])]
    .map(key=>[key,(after[key]||0)-(before[key]||0)])
    .filter(([,value])=>value>0));
}
function trial(l17Save,seed,branch,policy,stageConfigs){
  let run=restore(l17Save);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:17},(_,i)=>i+1));
  const assigned=allocate(run,policy);
  run=assigned.run;
  const {run:unusedAssignedRun,...assignment}=assigned;
  const stages=[];
  let minFoodTickEnd=run('S.res.food');
  for(let stage=18;stage<=20;stage++){
    const beforeStage=state(run),stageEnemy=enemy(run,stage);
    const refill=recovery(run,stage,targets);
    minFoodTickEnd=Math.min(minFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){
      stages.push({stage,enemy:stageEnemy,recovery:refill,
        block:'training-time-or-resource',battle:null});
      break;
    }
    const beforeBattle=reload(run,`P188 ${policy.id} L${stage}战前`);
    run=beforeBattle.run;
    const nominalReward=plain(run(`CFG.enemies[${stage-1}].reward`));
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,r=>formArchers(r,30));
    for(const [type,target] of Object.entries(targets))
      assert.equal(battle.beforeDeployed[type],target,
        `L${stage} ${type}实入场不符`);
    assert.equal(battle.beforeDeployed.cavalry_t1,0,'误编骑兵');
    const lossByType=Object.fromEntries(Object.entries(targets).map(
      ([type,target])=>[type,target-owned(run,type)]));
    for(const [type,loss] of Object.entries(lossByType))
      assert.ok(loss>=0&&loss<=targets[type]);
    const creditedReward=Object.fromEntries(Object.keys(nominalReward).map(key=>
      [key,battle.after.resources[key]-battle.before.resources[key]]));
    const essenceDrops=difference(essenceBefore,plain(run('({...S.essence})')));
    const afterBattle=reload(run,`P188 ${policy.id} L${stage}战后`);
    stages.push({stage,enemy:stageEnemy,beforeStage,recovery:refill,
      beforeBattleSaveSha256:beforeBattle.saveSha256,
      battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
        beforeDeployed:battle.beforeDeployed,formation:battle.formation,
        lossByType,lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
        nominalReward,creditedReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterBattleSaveSha256:afterBattle.saveSha256,
      postBattle:state(afterBattle.run)});
    run=afterBattle.run;
    if(!battle.won)break;
  }
  return{seed,branch,policy:policy.id,
    sourceL17SaveSha256:sha(l17Save),assignment,
    stageConfigs,stages,minFoodTickEnd,final:state(run)};
}
const sourceSaves=[],profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const source=buildSourceL16(seed,disableReward);
  const l17=trainingTrial(source.l16Save,seed,'old-line');
  assert.equal(l17.block,undefined,'同源L17训练被阻断');
  assert.equal(l17.battle.won,true,'同源L17未胜');
  assert.ok(l17.finalSave);
  assert.equal(sha(l17.finalSave),l17.finalSaveSha256);
  const old=p181.profiles.find(p=>p.seed===seed&&
    p.branch===source.source.branch&&p.archerTarget===30);
  const p178Old=p178.profiles.find(p=>p.seed===seed&&
    p.branch===source.source.branch);
  assert.ok(old&&p178Old,'缺少P181/P178同源分支');
  assert.deepEqual(l17.after,old.sourceL17,'P181 L17终档状态不一致');
  assert.deepEqual(l17.after,p178Old.postL17,'P178 L17终档状态不一致');
  const stageConfigs=currentEnemies(restore(l17.finalSave));
  sourceSaves.push({seed,branch:source.source.branch,
    l17Save:l17.finalSave,l17SaveSha256:l17.finalSaveSha256,
    state:l17.after});
  for(const policy of policies.filter(p=>!p.from||disableReward))
    profiles.push(trial(l17.finalSave,seed,source.source.branch,policy,stageConfigs));
}
// Unchanged staffing must reproduce all P181 L18/L19 outcomes. Current L20
// intentionally differs and is checked against the exact current levels SHA.
for(const profile of profiles.filter(p=>p.policy==='original')){
  const old=p181.profiles.find(p=>p.seed===profile.seed&&
    p.branch===profile.branch&&p.archerTarget===30);
  for(const now of profile.stages.filter(s=>s.stage<=19)){
    const previous=old.stages.find(s=>s.stage===now.stage);
    assert.ok(previous,`P181缺少L${now.stage}对照`);
    assert.equal(now.recovery.seconds,previous.recovery.seconds);
    assert.equal(now.recovery.ready,previous.recovery.ready);
    assert.deepEqual(now.recovery.produced,previous.recovery.produced);
    assert.deepEqual(now.recovery.paidByActual,previous.recovery.paidByActual);
    assert.deepEqual(now.recovery.pausedQueueSeconds,
      previous.recovery.pausedQueueSeconds);
    assert.equal(now.recovery.minFoodTickEnd,previous.recovery.minFoodTickEnd);
    assert.equal(now.battle?.won,previous.battle?.won);
    if(now.battle){
      assert.equal(now.battle.round,previous.battle.round);
      assert.deepEqual(now.battle.lossByType,previous.battle.lossByType);
    }
  }
}
function numericTrace(p){
  return{seed:p.seed,branch:p.branch,policy:p.policy,
    assignment:{afterWorkers:p.assignment.afterWorkers,
      beforeRates:p.assignment.beforeRates,afterRates:p.assignment.afterRates,
      rateDelta:p.assignment.rateDelta,afterState:p.assignment.afterState},
    stages:p.stages.map(s=>({stage:s.stage,
      recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
        produced:s.recovery.produced,paidByActual:s.recovery.paidByActual,
        pausedQueueSeconds:s.recovery.pausedQueueSeconds,
        minFoodTickEnd:s.recovery.minFoodTickEnd,after:s.recovery.after},
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        beforeDeployed:s.battle.beforeDeployed,lossByType:s.battle.lossByType,
        creditedReward:s.battle.creditedReward},
      block:s.block||null,postBattle:s.postBattle})),
    minFoodTickEnd:p.minFoodTickEnd,final:p.final};
}
if(prior){
  assert.equal(prior.batch,'P188');
  assert.deepEqual(profiles.map(numericTrace),prior.profiles.map(numericTrace),
    'P188复跑数值轨迹不一致');
}
const inputFiles=[...new Set([
  ...p181.inputs.map(row=>row.file),
  'docs/codex/reports/data/p181-current-l18-l20-archers.json',
  'docs/codex/reports/data/p182-current-l20-boss-roster.json',
  'tools/verify/probe-current-l18-l20-food-reassignment-p188.js'])];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P188',unit:'online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'Rebuild four genuine P181/P178 old-line L17 wins; from each save replay unchanged staffing, and on no-L3-reward branch move one stone or copper worker to food through setPopAlloc, saving/reloading; use actual train/payTrainingCost and per-second tick up to 7200 seconds per stage, real formation, asynchronous combat and save/reload for current L18–L20; no injected resources, soldiers or victories',
  scope:{seeds,branches:['current-L3-plus-six','no-L3-reward'],
    policies,archerTarget:30,targets,maxRecoverySeconds:7200,
    noOffline:true,noGarrison:true,sourceConfigChanged:false},
  oldLevelsSha256:oldLevels.sha256,
  allowedCurrentLevelsSha256:expectedCurrentLevelsSha256,
  originalL20:p182.originalEnemy,
  currentL20:plain(restore(sourceSaves[0].l17Save)('CFG.enemies[19]')),
  sourceSaves,profiles,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P188',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,policy:p.policy,
  workers:p.assignment.afterWorkers,
  rateDelta:p.assignment.rateDelta,
  stages:p.stages.map(s=>({stage:s.stage,seconds:s.recovery.seconds,
    ready:s.recovery.ready,produced:s.recovery.produced,
    paid:s.recovery.paidByActual,
    paused:s.recovery.pausedQueueSeconds,
    minFood:s.recovery.minFoodTickEnd,
    preResources:s.beforeStage?.checkpoint.resources,
    afterRecovery:s.recovery.after.checkpoint.resources,
    won:s.battle?.won,round:s.battle?.round,
    loss:s.battle?.lossTotal,block:s.block||null})),
  minFood:p.minFoodTickEnd})),rawData:outputPath},null,2));
