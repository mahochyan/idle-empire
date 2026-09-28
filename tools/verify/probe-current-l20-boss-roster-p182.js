'use strict';
// P182: isolate L20 roster sensitivity from P180's four genuine L19 wins.
// The only game configuration override is CFG.enemies[19].units inside each VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p180Path=path.join(__dirname,'probe-current-l18-l20-cavalry-p180.js');
const p180DataPath=path.join(root,'docs/codex/reports/data/p180-current-l18-l20-cavalry.json');
const outputPath=path.join(root,'docs/codex/reports/data/p182-current-l20-boss-roster.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p180Data=JSON.parse(fs.readFileSync(p180DataPath,'utf8'));
assert.equal(p180Data.batch,'P180');
const seeds=[1,42];
const targets={bronze_guard:15,cavalry_t1:15,archer_t1:13};
const rosters=[
  {id:'current-1-1-1',counts:[1,1,1],current:true},
  {id:'2-1-1',counts:[2,1,1]},
  {id:'3-2-1',counts:[3,2,1]},
  {id:'4-3-2',counts:[4,3,2]},
  {id:'5-4-3',counts:[5,4,3]},
  {id:'6-5-3',counts:[6,5,3]},
  {id:'6-5-4',counts:[6,5,4]},
  {id:'8-6-4',counts:[8,6,4]},
  {id:'10-7-4',counts:[10,7,4]},
  {id:'12-9-5',counts:[12,9,5]},
];
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P182找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P182的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
for(const input of p180Data.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `P180来源文件已变化：${input.file}`);
function reuseP180(){
  let source=fs.readFileSync(p180Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return {restore,owned,fight,formCavalry,state,snapshot,reload,recovery,enemy};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P180真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p180Path),{log(){},error:console.error},path.dirname(p180Path));
}
const {restore,owned,fight,formCavalry,state,reload,recovery}=reuseP180();
const originalEnemy=plain(restore(p180Data.profiles[0].stages[1].l19ContinuationSave)
  ('CFG.enemies[19]'));
assert.deepEqual(originalEnemy.units,
  {infantry:[1,1,1],archer:[1,1,1],cavalry_t1:[1,1,1]});
function rosterUnits(counts){return{infantry:[...counts],archer:[...counts],cavalry_t1:[...counts]}}
function setRoster(run,roster){
  const before=plain(run('CFG.enemies[19]'));
  assert.equal(before.id,20);
  if(!roster.current){
    run(`CFG.enemies[19].units=${JSON.stringify(rosterUnits(roster.counts))}`);
  }
  const after=plain(run('CFG.enemies[19]'));
  assert.deepEqual(after.units,rosterUnits(roster.counts));
  delete before.units;delete after.units;
  assert.deepEqual(after,before,`L20 ${roster.id}覆盖了units以外字段`);
}
function inspectEnemy(preparedSave,roster,form){
  const run=restore(preparedSave);
  setRoster(run,roster);
  form(run);
  return plain(run(`S.selEnemy=19;S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      hpWeightedAttack:B.enemyUnits.reduce((n,u)=>n+u.atk*u.hp,0),
      actualAttackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound})`));
}
function difference(before,after){
  return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(after)])]
    .map(key=>[key,(after[key]||0)-(before[key]||0)])
    .filter(([,value])=>value>0));
}
// Reusable from another probe: pass its own real L20-prepared save, live
// formation callback, and expected deployed counts. No source files change.
function runVariant(preparedSave,seed,roster,form=formCavalry,expectedDeployed=targets){
  const enemyStats=inspectEnemy(preparedSave,roster,form);
  const run=restore(preparedSave);
  setRoster(run,roster);
  const nominalReward=plain(run('CFG.enemies[19].reward'));
  const essenceBefore=plain(run('({...S.essence})'));
  const beforeOwned=Object.fromEntries(Object.keys(expectedDeployed).map(type=>
    [type,owned(run,type)]));
  const battle=fight(run,seed,20,form);
  for(const [type,target] of Object.entries(expectedDeployed))
    assert.equal(battle.beforeDeployed[type],target,`${roster.id} ${type}实入场不符`);
  if(form===formCavalry)
    assert.equal(battle.beforeDeployed.infantry_t1,0,`${roster.id}误带入民兵`);
  const losses=Object.fromEntries(Object.entries(beforeOwned).map(([type,count])=>
    [type,count-owned(run,type)]));
  for(const [type,loss] of Object.entries(losses))
    assert.ok(loss>=0&&loss<=beforeOwned[type],`${roster.id} ${type}战损异常`);
  const actualReward=Object.fromEntries(Object.keys(nominalReward).map(key=>
    [key,battle.after.resources[key]-battle.before.resources[key]]));
  const essenceDrops=difference(essenceBefore,plain(run('({...S.essence})')));
  const final=reload(run,`P182 ${roster.id} L20战后`);
  const postBattle=state(final.run);
  assert.equal(postBattle.checkpoint.defeated.includes(20),battle.won);
  return{roster:roster.id,counts:roster.counts,enemyStats,
    battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
      beforeDeployed:battle.beforeDeployed,formation:battle.formation,
      lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
      postOwned:Object.fromEntries(Object.keys(expectedDeployed).map(type=>[type,owned(final.run,type)])),
      nominalReward,actualReward,
      meritGain:battle.after.merit-battle.before.merit,essenceDrops},
    finalSaveSha256:final.saveSha256,postBattle};
}
function prepareFromL19Save(l19Save,recoveryFn=recovery){
  const run=restore(l19Save);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:19},(_,i)=>i+1));
  const refill=recoveryFn(run,20);
  if(!refill.ready)return{ready:false,recovery:refill};
  const prepared=reload(run,'P182 L20战前');
  assert.deepEqual(state(prepared.run),refill.after);
  return{ready:true,recovery:refill,preparedSave:prepared.save,
    preparedSaveSha256:prepared.saveSha256};
}
function runProfile(profile){
  const seed=profile.seed,branch=profile.branch;
  assert.ok(seeds.includes(seed));
  const l19=profile.stages.find(row=>row.stage===19);
  const p180L20=profile.stages.find(row=>row.stage===20);
  assert.ok(l19?.battle?.won&&p180L20?.battle?.won);
  const l19Save=l19.l19ContinuationSave;
  assert.equal(sha(l19Save),l19.afterSaveSha256,`P180 ${seed}/${branch} L19存档SHA`);
  assert.deepEqual(state(restore(l19Save)),l19.postBattle,
    `P180 ${seed}/${branch} L19档重载`);
  const prepared=prepareFromL19Save(l19Save);
  assert.equal(prepared.ready,true,`P182 ${seed}/${branch}补兵未到目标`);
  const refill=prepared.recovery;
  assert.deepEqual(refill.after,p180L20.recovery.after,
    `P182 ${seed}/${branch}战前补兵状态未复现P180`);
  assert.equal(refill.seconds,p180L20.recovery.seconds);
  const variants=rosters.map(roster=>runVariant(prepared.preparedSave,seed,roster));
  const baseline=variants[0];
  assert.equal(baseline.enemyStats.totalHp,9);
  assert.equal(baseline.enemyStats.hpWeightedAttack,105);
  for(const key of ['won','round','beforeDeployed','lossByType','nominalReward',
    'actualReward','meritGain','essenceDrops']){
    const oldKey=key==='actualReward'?'creditedReward':key;
    assert.deepEqual(baseline.battle[key],p180L20.battle[oldKey],
      `P182 ${seed}/${branch}现行Boss ${key}未复现P180`);
  }
  assert.deepEqual(baseline.postBattle,p180L20.postBattle,
    `P182 ${seed}/${branch}现行Boss战后重载未复现P180`);
  return{seed,branch,l19SaveSha256:l19.afterSaveSha256,
    preparedSaveSha256:prepared.preparedSaveSha256,
    recovery:{seconds:refill.seconds,requested:refill.requested,
      produced:refill.produced,pausedQueueSeconds:refill.pausedQueueSeconds,
      minFoodTickEnd:refill.minFoodTickEnd,after:refill.after},variants};
}
function main(){
const profiles=p180Data.profiles.map(runProfile);
function numericTrace(profile){
  return{seed:profile.seed,branch:profile.branch,
    recovery:profile.recovery,
    variants:profile.variants.map(v=>{
      const {formation,...battle}=v.battle;
      // Formation IDs come from Date.now() and do not change combat counts.
      return{roster:v.roster,enemyStats:v.enemyStats,
        battle,postBattle:v.postBattle};
    })};
}
if(priorData){
  assert.equal(priorData.batch,'P182');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    'P182复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-current-l11-handoff-p173.js',
  'tools/verify/probe-current-l17-cavalry-bridge-p175.js',
  'tools/verify/probe-current-l18-l20-cavalry-p180.js',
  'docs/codex/reports/data/p180-current-l18-l20-cavalry.json',
  'tools/verify/probe-current-l20-boss-roster-p182.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P182',unit:'simulated online tick seconds, soldiers and resources',
  sourceHead:head.stdout.trim(),
  method:'Restore four genuine P180 post-L19 saves; refill in live training/tick to the exact P180 pre-L20 state; save/reload; for each isolated VM preserve all L20 fields except units, set symmetric three-family three-row enemy counts; inspect initBattleState, run real seeded async battle callbacks, settle and save/reload; assert current roster exactly reproduces P180 combat and rewards',
  scope:{seeds,branches:['current-L3-plus-six','no-L3-reward'],
    targets,rosters,maxRecoverySeconds:7200,noOffline:true,noGarrison:true,
    sourceConfigChanged:false},
  originalEnemy,profiles,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P182',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,recoverySeconds:p.recovery.seconds,
  minFoodTickEnd:p.recovery.minFoodTickEnd,
  variants:p.variants.map(v=>({roster:v.roster,hp:v.enemyStats.totalHp,
    attackMass:v.enemyStats.actualAttackMass,
    won:v.battle.won,round:v.battle.round,loss:v.battle.lossTotal,
    survivors:v.battle.postOwned,merit:v.battle.meritGain,
    reward:v.battle.actualReward}))})),rawData:outputPath},null,2));
return artifact;
}
if(require.main===module)main();
module.exports={rosters,prepareFromL19Save,runVariant,formCavalry,recovery,main};
