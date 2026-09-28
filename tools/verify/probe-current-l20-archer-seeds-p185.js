'use strict';
// P185: 16 battle RNG streams from one genuine P183 L20 prebattle save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p181Path=path.join(__dirname,'probe-current-l18-l20-archers-p181.js');
const p183Path=path.join(root,'docs/codex/reports/data/p183-current-l20-archer-roster.json');
const outputPath=path.join(root,'docs/codex/reports/data/p185-current-l20-archer-seeds.json');
const p182=require('./probe-current-l20-boss-roster-p182');
const p183=JSON.parse(fs.readFileSync(p183Path,'utf8'));
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const seeds=Array.from({length:16},(_,i)=>i+1);
const roster={id:'8-6-4',counts:[8,6,4]};
const targets={bronze_guard:15,infantry_t1:15,archer_t1:30};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P185找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P185的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p183.batch,'P183');
for(const input of p183.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `P183来源文件已变化：${input.file}`);
const source=p183.profiles.find(p=>p.seed===1&&p.archerTarget===30&&
  p.branch==='current-L3-plus-six');
assert.ok(source&&source.preparedSave,'P183缺少指定实付L20战前档');
assert.equal(sha(source.preparedSave),source.preparedSaveSha256,
  'P183实付L20战前档SHA');
function reuseP181(){
  let text=fs.readFileSync(p181Path,'utf8');
  text=replaceOnce(text,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return {restore,state,formArchers};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P181真实编队动作返回点');
  return new Function('require','console','__dirname',text)(
    createRequire(p181Path),{log(){},error:console.error},path.dirname(p181Path));
}
const {restore,state,formArchers}=reuseP181();
assert.deepEqual(state(restore(source.preparedSave)),source.recovery.after,
  'P183战前档重载状态');
const original=source.variants.find(v=>v.roster===roster.id);
assert.ok(original,'P183缺少8-6-4对照');
const form=run=>formArchers(run,30);
const results=seeds.map(seed=>{
  const run=p182.runVariant(source.preparedSave,seed,roster,form,targets);
  assert.deepEqual(run.battle.beforeDeployed,
    {bronze_guard:15,infantry_t1:15,archer_t1:30,cavalry_t1:0},
    `随机流${seed}出战兵力不同`);
  assert.equal(run.enemyStats.groups,9);
  assert.equal(run.enemyStats.totalHp,54);
  assert.equal(run.enemyStats.actualAttackMass,630);
  assert.equal(run.postBattle.checkpoint.defeated.includes(20),run.battle.won);
  if(seed===1){
    const {formation:unused,...battle}=run.battle;
    const {formation:oldFormation,...oldBattle}=original.battle;
    assert.deepEqual(battle,oldBattle,'随机流1未复现P183实战');
    assert.deepEqual(run.postBattle,original.postBattle,
      '随机流1未复现P183战后重载');
  }
  return{seed,rngInitial:(seed*1009+20*9176)>>>0,...run};
});
function numericTrace(row){
  const {formation,...battle}=row.battle;
  return{seed:row.seed,rngInitial:row.rngInitial,roster:row.roster,
    enemyStats:row.enemyStats,battle,postBattle:row.postBattle};
}
if(prior){
  assert.equal(prior.batch,'P185');
  assert.deepEqual(results.map(numericTrace),prior.results.map(numericTrace),
    'P185复跑数值轨迹不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l18-l20-archers-p181.js',
  'tools/verify/probe-current-l20-boss-roster-p182.js',
  'tools/verify/probe-current-l20-archer-roster-p183.js',
  'docs/codex/reports/data/p183-current-l20-archer-roster.json',
  'tools/verify/probe-current-l20-archer-seeds-p185.js'];
const artifact={batch:'P185',unit:'battle rounds and soldiers',
  sourceHead:head.stdout.trim(),
  method:'Read one fully paid P183 seed-1/30-archer post-recovery L20 rts_save, validate SHA and loaded state; for each battle RNG seed 1–16 restore the same save in an independent VM, override only CFG.enemies[19].units to three families each 8-6-4, use genuine formation and asynchronous battle/settlement/save/reload; no retraining or economy replay',
  scope:{sourceBranch:source.branch,sourceSeed:source.seed,archerTarget:30,
    battleSeeds:seeds,roster,noRetraining:true,sourceConfigChanged:false},
  sourceL19SaveSha256:source.sourceL19SaveSha256,
  sourcePreparedSaveSha256:source.preparedSaveSha256,
  sourcePreparedState:source.recovery.after,results,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
const wins=results.filter(r=>r.battle.won),losses=results.filter(r=>!r.battle.won);
console.log(JSON.stringify({batch:'P185',sourcePreparedSaveSha256:source.preparedSaveSha256,
  battleSeeds:seeds,wins:wins.length,defeats:losses.length,
  results:results.map(r=>({seed:r.seed,won:r.battle.won,round:r.battle.round,
    loss:r.battle.lossTotal,lossByType:r.battle.lossByType,
    survivors:r.battle.postOwned})),rawData:outputPath},null,2));
