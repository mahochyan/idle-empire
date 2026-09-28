'use strict';
// P194: pay for the 73-soldier campaign from P193's genuine 22-resident save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p190ProbePath=path.join(__dirname,'probe-current-third-chapter-second-back-p190.js');
const p190DataPath=path.join(root,'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const p193DataPath=path.join(root,'docs/codex/reports/data/p193-current-third-chapter-population.json');
const outputPath=path.join(root,'docs/codex/reports/data/p194-current-third-chapter-population-army.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p190=JSON.parse(fs.readFileSync(p190DataPath,'utf8'));
const p193=JSON.parse(fs.readFileSync(p193DataPath,'utf8'));
const seeds=[1,15],targets={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28};
const maxStage=30,maxRecoverySeconds=7200;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P194找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P194的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p190.batch,'P190');assert.equal(p193.batch,'P193');
for(const item of [...p190.inputs,...p193.inputs])
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P190/P193输入已变：${item.file}`);
assert.equal(sha(p193.finalSave),p193.finalSaveSha256,
  'P193 22人口完整终档SHA不符');
assert.equal(p193.sourceSaveSha256,p190.sourceSaveSha256,
  'P190/P193并非同一真实L21起点');
// Reuse P190's actual game-action helpers in memory. Exit before its own
// profiles/artifact writer, leaving both P190 source and data untouched.
let source=fs.readFileSync(p190ProbePath,'utf8');
source=replaceOnce(source,
  'const profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute)){',
  'return{restore,fight,owned,reload,state,snapshot,enemyStats,recovery,formation,foodEconomy};\nconst profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute)){',
  'P190动作返回点');
const {restore,fight,owned,reload,state,snapshot,enemyStats,recovery,formation,
  foodEconomy}=new Function('require','console','__dirname',source)(
    createRequire(p190ProbePath),{log(){},error:console.error},path.dirname(p190ProbePath));
const startRun=restore(p193.finalSave);
const start=state(startRun),startEconomy=foodEconomy(startRun);
assert.equal(start.population,22);assert.equal(start.capacity,22);
assert.equal(start.checkpoint.defeated.at(-1),21);
assert.equal(start.checkpoint.resources.wood,492);
assert.equal(start.checkpoint.resources.deed,0);
assert.deepEqual(Object.fromEntries(['wood','stone','food','coal','copper']
  .map(k=>[k,start.checkpoint.workers[k]])),
  {wood:3,stone:3,food:7,coal:6,copper:3});
assert.equal(start.army,43);
assert.equal(startRun("rowSlots('back')"),2);
assert.ok(startRun("unitCap('archer_t1')")>=28);
assert.equal(startRun("trainLockReason('archer_t1')"),'');
function route(seed){
  let run=restore(p193.finalSave),minimumFoodTickEnd=run('S.res.food');
  assert.deepEqual(state(run),start);
  const stages=[];
  for(let stage=22;stage<=maxStage;stage++){
    const enemy=enemyStats(run("localStorage.getItem('rts_save')"),stage);
    const refill=recovery(run,stage,targets);
    minimumFoodTickEnd=Math.min(minimumFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){
      stages.push({stage,enemy,recovery:refill,battle:null,
        block:refill.block||'training-time-or-resource'});
      break;
    }
    const before=reload(run,`P194种子${seed} L${stage}战前`);
    run=before.run;
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,active=>formation(active,targets));
    for(const [type,target] of Object.entries(targets))
      assert.equal(battle.beforeDeployed[type],target,
        `P194种子${seed} L${stage} ${type}真实入场不符`);
    const after=reload(run,`P194种子${seed} L${stage}战后`);
    const losses=Object.fromEntries(Object.entries(targets).map(([type,target])=>
      [type,target-owned(after.run,type)]));
    const actualReward=Object.fromEntries(Object.keys(enemy.config.reward).map(key=>
      [key,battle.after.resources[key]-battle.before.resources[key]]));
    const essenceAfter=plain(after.run('({...S.essence})'));
    const essenceDrops=Object.fromEntries([...new Set([
      ...Object.keys(essenceBefore),...Object.keys(essenceAfter)])]
      .map(key=>[key,(essenceAfter[key]||0)-(essenceBefore[key]||0)])
      .filter(([,n])=>n>0));
    stages.push({stage,enemy,recovery:refill,
      beforeSaveSha256:before.saveSha256,
      ...(stage===30?{l30PreparedSave:before.save}:{}),
      battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
        formation:battle.formation,beforeDeployed:battle.beforeDeployed,
        lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
        nominalReward:enemy.config.reward,actualReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterSaveSha256:after.saveSha256,postBattle:state(after.run)});
    run=after.run;
    if(!battle.won)break;
  }
  const totals={recoverySeconds:stages.reduce((n,s)=>n+s.recovery.seconds,0),
    trainingDueByProduced:{},minimumFoodTickEnd,
    lastCleared:run('S.defeated.at(-1)'),
    firstBlockedStage:stages.find(s=>s.block||!s.battle?.won)?.stage||null};
  for(const stage of stages)for(const [key,value] of Object.entries(
    stage.recovery.dueByProduced||{}))
    totals.trainingDueByProduced[key]=(totals.trainingDueByProduced[key]||0)+value;
  return{seed,targets,stages,totals,final:state(run),
    finalSaveSha256:sha(run("localStorage.getItem('rts_save')"))};
}
const profiles=seeds.map(route);
const p190Comparison=profiles.map(profile=>{
  const previous=p190.profiles.find(p=>p.seed===profile.seed&&p.route==='secondBackFood7');
  assert.ok(previous,`P190缺少种子${profile.seed}煤转粮73人档`);
  for(const current of profile.stages.filter(s=>s.battle)){
    const prior=previous.stages.find(s=>s.stage===current.stage);
    assert.ok(prior?.battle,`P190缺少种子${profile.seed} L${current.stage}战斗`);
    assert.deepEqual(
      {won:current.battle.won,round:current.battle.round,
        lossByType:current.battle.lossByType},
      {won:prior.battle.won,round:prior.battle.round,
        lossByType:prior.battle.lossByType},
      `P194种子${profile.seed} L${current.stage}固定流战果与P190同编队不一致`);
  }
  return{seed:profile.seed,
    p190LastCleared:previous.totals.lastCleared,
    p194LastCleared:profile.totals.lastCleared,
    p190RecoverySeconds:previous.totals.recoverySeconds,
    p194RecoverySeconds:profile.totals.recoverySeconds,
    battles:profile.stages.filter(s=>s.battle).map(s=>{
      const prior=previous.stages.find(x=>x.stage===s.stage);
      return{stage:s.stage,won:s.battle.won,round:s.battle.round,
        lossTotal:s.battle.lossTotal,
        p190Won:prior?.battle?.won??null,
        p190Round:prior?.battle?.round??null,
        p190LossTotal:prior?.battle?.lossTotal??null};
    })};
});
const l30Prepared=profiles.flatMap(p=>p.stages
  .filter(s=>s.stage===30&&s.l30PreparedSave)
  .map(s=>({seed:p.seed,saveSha256:s.beforeSaveSha256,
    save:s.l30PreparedSave,enemy:s.enemy,battle:s.battle,
    preBattle:state(restore(s.l30PreparedSave))})));
for(const item of l30Prepared)
  assert.equal(sha(item.save),item.saveSha256,
    `P194种子${item.seed} L30战前档SHA不符`);
function numericTrace(p){
  return{seed:p.seed,targets:p.targets,totals:p.totals,final:p.final,
    stages:p.stages.map(s=>({stage:s.stage,enemy:s.enemy,
      recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
        requested:s.recovery.requested,produced:s.recovery.produced,
        dueByProduced:s.recovery.dueByProduced,
        pausedQueueSeconds:s.recovery.pausedQueueSeconds,
        minFoodTickEnd:s.recovery.minFoodTickEnd,after:s.recovery.after,
        economyBefore:s.recovery.economyBefore,
        economyAfter:s.recovery.economyAfter,
        block:s.recovery.block||null},
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        callbacks:s.battle.callbacks,beforeDeployed:s.battle.beforeDeployed,
        lossByType:s.battle.lossByType,lossTotal:s.battle.lossTotal,
        nominalReward:s.battle.nominalReward,actualReward:s.battle.actualReward,
        meritGain:s.battle.meritGain,essenceDrops:s.battle.essenceDrops},
      postBattle:s.postBattle,block:s.block||null}))};
}
if(priorData){
  assert.equal(priorData.batch,'P194');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    'P194复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-third-chapter-second-back-p190.js',
  'docs/codex/reports/data/p190-current-third-chapter-second-back.json',
  'docs/codex/reports/data/p193-current-third-chapter-population.json',
  'tools/verify/probe-current-third-chapter-population-army-p194.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P194',unit:'simulated online tick seconds, resources and soldiers',
  sourceHead:head.stdout.trim(),sourceSaveSha256:p193.finalSaveSha256,
  method:'Load P193 exact real 22-resident/7-food-worker post-trade save, retaining wood/stone/coal/copper allocations, pay/train to 73 soldiers via live queue and second ticks before each L22-L30 battle, true formation and async battle/settlement/save/reload, stop first loss or 7200-second per-stage training block; no offline, garrison or resource/soldier injection',
  scope:{seeds,targets,maxStage,maxRecoverySeconds,noOffline:true,
    noGarrison:true,sourcePopulation:22,sourceWorkers:start.checkpoint.workers},
  start,startEconomy,profiles,p190Comparison,l30Prepared,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P194',sourceSaveSha256:artifact.sourceSaveSha256,
  start:{population:start.population,capacity:start.capacity,
    resources:start.checkpoint.resources,workers:start.checkpoint.workers,
    army:start.army,foodNet:startEconomy.netFood},
  profiles:profiles.map(p=>({seed:p.seed,totals:p.totals,
    stages:p.stages.map(s=>({stage:s.stage,recoverySeconds:s.recovery.seconds,
      foodMin:s.recovery.minFoodTickEnd,ready:s.recovery.ready,
      won:s.battle?.won,round:s.battle?.round,loss:s.battle?.lossTotal,
      block:s.block||null}))})),
  comparison:p190Comparison.map(p=>({seed:p.seed,
    p190RecoverySeconds:p.p190RecoverySeconds,
    p194RecoverySeconds:p.p194RecoverySeconds,
    p190LastCleared:p.p190LastCleared,p194LastCleared:p.p194LastCleared})),
  l30Prepared:l30Prepared.map(x=>({seed:x.seed,saveSha256:x.saveSha256,
    won:x.battle.won,round:x.battle.round})),rawData:outputPath},null,2));
