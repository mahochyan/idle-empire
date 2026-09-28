'use strict';
// P183: L20-only enemy roster sensitivity on four genuine P181 L19 saves.
// The source game configuration is never edited; each variant has its own VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p181Path=path.join(__dirname,'probe-current-l18-l20-archers-p181.js');
const p181DataPath=path.join(root,'docs/codex/reports/data/p181-current-l18-l20-archers.json');
const p182DataPath=path.join(root,'docs/codex/reports/data/p182-current-l20-boss-roster.json');
const outputPath=path.join(root,'docs/codex/reports/data/p183-current-l20-archer-roster.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p181Data=JSON.parse(fs.readFileSync(p181DataPath,'utf8'));
const p182Data=JSON.parse(fs.readFileSync(p182DataPath,'utf8'));
const p182=require('./probe-current-l20-boss-roster-p182');
const seeds=[1,42],archerTargets=[30,36];
const rosters=[
  {id:'current-1-1-1',counts:[1,1,1],current:true},
  {id:'8-6-4',counts:[8,6,4]},
  {id:'9-7-4',counts:[9,7,4]},
  {id:'10-7-4',counts:[10,7,4]}
];
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P183找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P183的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p181Data.batch,'P181');
assert.equal(p182Data.batch,'P182');
for(const artifact of [p181Data,p182Data])for(const input of artifact.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `${artifact.batch}来源文件已变化：${input.file}`);
function reuseP181(){
  let source=fs.readFileSync(p181Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return {restore,owned,fight,place,state,snapshot,reload,recovery,formArchers};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P181真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p181Path),{log(){},error:console.error},path.dirname(p181Path));
}
const {restore,state,recovery,formArchers}=reuseP181();
function runProfile(source){
  assert.equal(source.branch,'current-L3-plus-six');
  assert.ok(seeds.includes(source.seed));
  assert.ok(archerTargets.includes(source.archerTarget));
  const l19=source.stages.find(row=>row.stage===19);
  const oldL20=source.stages.find(row=>row.stage===20);
  assert.ok(l19?.battle?.won&&oldL20?.battle?.won,'P181来源未过L19/L20');
  const l19Save=l19.l19ContinuationSave;
  assert.equal(sha(l19Save),l19.l19ContinuationSaveSha256,'P181 L19续档SHA');
  assert.deepEqual(state(restore(l19Save)),l19.l19ContinuationState,
    'P181 L19续档完整重载状态');
  const targets={bronze_guard:15,infantry_t1:15,archer_t1:source.archerTarget};
  const prepared=p182.prepareFromL19Save(l19Save,
    (run,stage)=>recovery(run,stage,targets));
  assert.equal(prepared.ready,true,'P183 L20实付补兵未完成');
  assert.equal(sha(prepared.preparedSave),prepared.preparedSaveSha256,
    'P183 L20战前完整续档SHA');
  assert.deepEqual(state(restore(prepared.preparedSave)),prepared.recovery.after,
    'P183 L20战前完整续档重载');
  assert.equal(prepared.recovery.seconds,oldL20.recovery.seconds,
    'P181同档L20补兵秒数未复现');
  assert.deepEqual(prepared.recovery.after,oldL20.recovery.after,
    'P181同档L20补兵状态未复现');
  assert.deepEqual(prepared.recovery.paidByActual,
    oldL20.recovery.paidByActual,'P181同档训练实际扣费未复现');
  const form=run=>formArchers(run,source.archerTarget);
  const variants=rosters.map(roster=>p182.runVariant(
    prepared.preparedSave,source.seed,roster,form,targets));
  const baseline=variants[0];
  assert.equal(baseline.enemyStats.totalHp,9);
  for(const key of ['won','round','beforeDeployed','lossByType',
    'nominalReward','meritGain','essenceDrops'])
    assert.deepEqual(baseline.battle[key],oldL20.battle[key],
      `P183当前Boss未复现P181：${key}`);
  assert.deepEqual(baseline.battle.actualReward,
    oldL20.battle.creditedReward,'P183当前Boss实收未复现P181');
  assert.deepEqual(baseline.postBattle,oldL20.postBattle,
    'P183当前Boss战后重载未复现P181');
  for(const variant of variants){
    assert.equal(variant.enemyStats.groups,9,'L20敌兵团数意外变化');
    assert.equal(variant.enemyStats.maxRound,30,'L20回合上限意外变化');
    assert.deepEqual(variant.battle.beforeDeployed,baseline.battle.beforeDeployed,
      '候选阵容使用了不同我方实入场兵力');
    assert.equal(variant.postBattle.checkpoint.defeated.includes(20),
      variant.battle.won,'L20胜负与击败记录不一致');
  }
  return{seed:source.seed,branch:source.branch,archerTarget:source.archerTarget,
    sourceL19SaveSha256:l19.l19ContinuationSaveSha256,
    preparedSave:prepared.preparedSave,
    preparedSaveSha256:prepared.preparedSaveSha256,
    recovery:{seconds:prepared.recovery.seconds,
      requested:prepared.recovery.requested,
      produced:prepared.recovery.produced,
      paidByActual:prepared.recovery.paidByActual,
      pausedQueueSeconds:prepared.recovery.pausedQueueSeconds,
      minFoodTickEnd:prepared.recovery.minFoodTickEnd,
      after:prepared.recovery.after},variants};
}
const sourceProfiles=p181Data.profiles.filter(p=>p.branch==='current-L3-plus-six');
assert.equal(sourceProfiles.length,4,'P181有奖L19续档必须为四份');
const profiles=sourceProfiles.map(runProfile);
function numericTrace(profile){
  return{seed:profile.seed,archerTarget:profile.archerTarget,
    recovery:profile.recovery,
    variants:profile.variants.map(variant=>{
      const {formation,...battle}=variant.battle;
      return{roster:variant.roster,counts:variant.counts,
        enemyStats:variant.enemyStats,battle,postBattle:variant.postBattle};
    })};
}
if(priorData){
  assert.equal(priorData.batch,'P183');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    'P183复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l18-l20-archers-p181.js',
  'docs/codex/reports/data/p181-current-l18-l20-archers.json',
  'tools/verify/probe-current-l20-boss-roster-p182.js',
  'docs/codex/reports/data/p182-current-l20-boss-roster.json',
  'tools/verify/probe-current-l20-archer-roster-p183.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P183',unit:'simulated online tick seconds, people and resources',
  sourceHead:head.stdout.trim(),
  method:'Restore four genuine P181 paid old-line L19 wins; replay live L20 training and per-second tick to exactly reproduce each P181 pre-L20 state; save/reload; independently replace only CFG.enemies[19].units in each isolated VM with current and 8-6-4, 9-7-4, 10-7-4 three-family rosters; inspect initBattleState, run real seeded asynchronous battle, settle and reload; assert current roster exactly reproduces P181 outcome',
  scope:{seeds,branch:'current-L3-plus-six',archerTargets,
    rosters,sourceConfigChanged:false,noOffline:true,noGarrison:true},
  originalEnemy:p182Data.originalEnemy,profiles,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P183',profiles:profiles.map(p=>({seed:p.seed,
  archerTarget:p.archerTarget,sourceL19SaveSha256:p.sourceL19SaveSha256,
  preparedSaveSha256:p.preparedSaveSha256,
  recoverySeconds:p.recovery.seconds,minFoodTickEnd:p.recovery.minFoodTickEnd,
  variants:p.variants.map(v=>({roster:v.roster,hp:v.enemyStats.totalHp,
    attackMass:v.enemyStats.actualAttackMass,won:v.battle.won,
    round:v.battle.round,loss:v.battle.lossTotal,
    survivors:v.battle.postOwned,merit:v.battle.meritGain,
    reward:v.battle.actualReward}))})),rawData:outputPath},null,2));
