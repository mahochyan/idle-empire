'use strict';
// P187: P184's real paid cavalry L20-ready save through a 40-loss win to L21.
// Candidate L20 roster exists only in an isolated VM; player files are untouched.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p182Path=path.join(__dirname,'probe-current-l20-boss-roster-p182.js');
const p184Path=path.join(root,'docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const outputPath=path.join(root,'docs/codex/reports/data/p187-current-l20-worst-recovery.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p184=JSON.parse(fs.readFileSync(p184Path,'utf8'));
assert.equal(p184.batch,'P184');
const combatSeed=15,roster={id:'8-6-4',counts:[8,6,4]};
const targets={bronze_guard:15,cavalry_t1:15,archer_t1:13};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P187找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P187的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
for(const item of p184.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P184来源文件已变化：${item.file}`);
assert.equal(sha(p184.preparedSave),p184.scope.preparedSaveSha256,
  'P184完整实付L20战前档SHA不符');
function reuseP182WithFinalSave(){
  let source=fs.readFileSync(p182Path,'utf8');
  source=replaceOnce(source,
    'finalSaveSha256:final.saveSha256,postBattle};',
    'finalSaveSha256:final.saveSha256,finalSave:final.save,postBattle};',
    'P182实际L20胜后序列化档');
  source=replaceOnce(source,
    'if(require.main===module)main();\nmodule.exports={rosters,prepareFromL19Save,runVariant,formCavalry,recovery,main};',
    'return{runVariant,restore,recovery,formCavalry,fight,owned,reload,state};',
    'P182隔离动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p182Path),{log(){},error:console.error},path.dirname(p182Path));
}
const {runVariant,restore,recovery,formCavalry,fight,owned,reload,state}=
  reuseP182WithFinalSave();
const reference=p184.outcomes.find(x=>x.seed===combatSeed&&x.roster===roster.id);
assert.ok(reference,'P184缺少固定战斗流15／8-6-4结果');
const l20=runVariant(p184.preparedSave,combatSeed,roster);
assert.ok(l20.finalSave,'P187未捕获L20实战结算档');
for(const [actual,expected,label] of [
  [l20.battle.won,reference.won,'胜负'],
  [l20.battle.round,reference.round,'回合'],
  [l20.battle.callbacks,reference.callbacks,'回调'],
  [l20.battle.beforeDeployed,reference.deployed,'实入场'],
  [l20.battle.lossByType,reference.losses,'战损'],
  [l20.battle.postOwned,reference.survivors,'余兵'],
  [l20.battle.nominalReward,reference.nominalReward,'名义奖励'],
  [l20.battle.actualReward,reference.actualReward,'实际入账'],
  [l20.battle.meritGain,reference.meritGain,'战功'],
  [l20.battle.essenceDrops,reference.essenceDrops,'精魄']])
  assert.deepEqual(actual,expected,`P184最坏胜场${label}未复现`);
assert.equal(l20.battle.won,true);
assert.equal(l20.battle.lossTotal,40);
assert.equal(sha(l20.finalSave),l20.finalSaveSha256);
let run=restore(l20.finalSave);
assert.deepEqual(state(run),l20.postBattle,'L20真实结算档重载状态不一致');
assert.deepEqual(plain(run('([...S.defeated])')),
  Array.from({length:20},(_,i)=>i+1));
const postL20=state(run);
const l21Enemy=plain(run('CFG.enemies[20]'));
assert.equal(l21Enemy.id,21);
const refill=recovery(run,21);
const result={batch:'P187',unit:'simulated online tick seconds, resources and soldiers',
  sourceHead:'',method:'Replay P184 paid cavalry L20-ready save in isolated VM with candidate 8-6-4 and combat seed 15; reproduce the 40-loss real win and save/reload; from that actual saved state train via live queues and tick to 15 bronze/15 cavalry/13 archer; use unmodified real L21 enemy, live formation and asynchronous battle callbacks; save/reload',
  scope:{combatSeed,roster,targets,maxRecoverySeconds:7200,
    p184PreparedSaveSha256:p184.scope.preparedSaveSha256,
    l20SourceConfigOverrideOnlyInVm:true,noOffline:true,noGarrison:true},
  l20:{enemyStats:l20.enemyStats,battle:l20.battle,
    finalSaveSha256:l20.finalSaveSha256,postBattle:postL20,
    finalSave:l20.finalSave},
  l21Enemy:{id:l21Enemy.id,name:l21Enemy.name,units:l21Enemy.units,
    reward:l21Enemy.reward,boss:!!l21Enemy.boss},
  recovery:refill};
if(refill.ready){
  for(const [type,target] of Object.entries(targets))
    assert.equal(owned(run,type),target,`L21 ${type}补兵数量不符`);
  const before=reload(run,'P187 L21战前');
  run=before.run;
  const battle=fight(run,combatSeed,21,formCavalry);
  for(const [type,target] of Object.entries(targets))
    assert.equal(battle.beforeDeployed[type],target,`L21 ${type}入场人数不符`);
  assert.equal(battle.beforeDeployed.infantry_t1,0);
  const after=reload(run,'P187 L21战后');
  const losses=Object.fromEntries(Object.entries(targets).map(([type,target])=>
    [type,target-owned(after.run,type)]));
  const actualReward=Object.fromEntries(Object.keys(l21Enemy.reward).map(key=>
    [key,battle.after.resources[key]-battle.before.resources[key]]));
  result.l21={beforeSaveSha256:before.saveSha256,
    battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
      beforeDeployed:battle.beforeDeployed,formation:battle.formation,
      lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
      nominalReward:l21Enemy.reward,actualReward,
      meritGain:battle.after.merit-battle.before.merit},
    afterSaveSha256:after.saveSha256,postBattle:state(after.run)};
}else result.l21={battle:null,block:'training-time-or-resource'};
function numericTrace(data){
  const {formation,...l21Battle}=data.l21.battle||{};
  const {finalSave,...l20}=data.l20;
  return{l20:{enemyStats:l20.enemyStats,battle:{
      ...l20.battle,formation:undefined},postBattle:l20.postBattle},
    l21Enemy:data.l21Enemy,
    recovery:{seconds:data.recovery.seconds,ready:data.recovery.ready,
      requested:data.recovery.requested,produced:data.recovery.produced,
      dueByProduced:data.recovery.dueByProduced,
      pausedQueueSeconds:data.recovery.pausedQueueSeconds,
      minFoodTickEnd:data.recovery.minFoodTickEnd,
      after:data.recovery.after},
    l21:{battle:data.l21.battle?l21Battle:null,
      block:data.l21.block||null,postBattle:data.l21.postBattle}};
}
if(priorData){
  assert.equal(priorData.batch,'P187');
  assert.deepEqual(numericTrace(result),numericTrace(priorData),
    'P187复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l20-boss-roster-p182.js',
  'tools/verify/probe-current-l20-boss-seeds-p184.js',
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json',
  'tools/verify/probe-current-l20-worst-recovery-p187.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
result.sourceHead=head.stdout.trim();
result.inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P187',l20:{won:l20.battle.won,
  round:l20.battle.round,loss:l20.battle.lossTotal,
  survivors:l20.battle.postOwned,reward:l20.battle.actualReward,
  postResources:postL20.checkpoint.resources},
  recovery:{seconds:refill.seconds,ready:refill.ready,requested:refill.requested,
    produced:refill.produced,dueByProduced:refill.dueByProduced,
    pausedQueueSeconds:refill.pausedQueueSeconds,
    minFoodTickEnd:refill.minFoodTickEnd},
  l21:result.l21.battle&&{won:result.l21.battle.won,
    round:result.l21.battle.round,loss:result.l21.battle.lossTotal,
    reward:result.l21.battle.actualReward},
  block:result.l21.block||null,rawData:outputPath},null,2));
