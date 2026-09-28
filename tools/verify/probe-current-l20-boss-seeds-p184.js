'use strict';
// P184: one genuine paid cavalry L20-ready save; vary battle RNG only.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const {prepareFromL19Save,runVariant,rosters}=require('./probe-current-l20-boss-roster-p182');

const root=path.resolve(__dirname,'../..');
const p180DataPath=path.join(root,'docs/codex/reports/data/p180-current-l18-l20-cavalry.json');
const p182DataPath=path.join(root,'docs/codex/reports/data/p182-current-l20-boss-roster.json');
const outputPath=path.join(root,'docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p180Data=JSON.parse(fs.readFileSync(p180DataPath,'utf8'));
const p182Data=JSON.parse(fs.readFileSync(p182DataPath,'utf8'));
assert.equal(p180Data.batch,'P180');
assert.equal(p182Data.batch,'P182');
function sha(x){return crypto.createHash('sha256').update(x).digest('hex')}
for(const item of p180Data.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P180来源已变化：${item.file}`);
for(const item of p182Data.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P182来源已变化：${item.file}`);
const source=p180Data.profiles.find(p=>p.seed===1&&p.branch==='current-L3-plus-six');
assert.ok(source,'缺少P180种子1当前第3关奖励路线');
const l19=source.stages.find(row=>row.stage===19);
const p180L20=source.stages.find(row=>row.stage===20);
assert.ok(l19?.battle?.won&&p180L20?.battle?.won);
assert.equal(sha(l19.l19ContinuationSave),l19.afterSaveSha256);
const prepared=prepareFromL19Save(l19.l19ContinuationSave);
assert.equal(prepared.ready,true,'L19实胜档未补至P180的43人L20战前状态');
assert.deepEqual(prepared.recovery.after,p180L20.recovery.after,
  '战前恢复状态与P180不一致');
assert.equal(sha(prepared.preparedSave),prepared.preparedSaveSha256,
  'P184完整L20战前档SHA不一致');
const reloaded=environment({rts_save:prepared.preparedSave}).run;
assert.equal(reloaded('loadSaveAndApply().status'),'ok',
  'P184完整L20战前档不能独立重载');
const reloadedPlain=expression=>JSON.parse(JSON.stringify(reloaded(expression)));
const expected=prepared.recovery.after;
assert.deepEqual(reloadedPlain('({...S.res})'),expected.checkpoint.resources,
  'P184战前档资源重载不一致');
assert.deepEqual(reloadedPlain('({...S.popAlloc})'),expected.checkpoint.workers,
  'P184战前档岗位重载不一致');
assert.deepEqual(reloadedPlain('({...S.queue})'),expected.checkpoint.queue,
  'P184战前档队列重载不一致');
assert.deepEqual(reloadedPlain('([...S.defeated])'),expected.checkpoint.defeated,
  'P184战前档进度重载不一致');
assert.deepEqual(reloadedPlain(`Object.fromEntries(['bronze_guard','cavalry_t1','archer_t1']
  .map(type=>[type,(S.pool[type]||0)+expeditionCount(type)+garrisonCount(type)]))`),
  {bronze_guard:15,cavalry_t1:15,archer_t1:13},
  'P184战前档实有兵力重载不一致');
assert.deepEqual(reloadedPlain('JSON.parse(JSON.stringify(S.formation))'),
  JSON.parse(prepared.preparedSave).formation,
  'P184战前档编队重载不一致');
const candidates=[
  rosters.find(x=>x.id==='8-6-4'),
  {id:'9-7-4',counts:[9,7,4]},
  rosters.find(x=>x.id==='10-7-4'),
];
assert.ok(candidates.every(Boolean));
const combatSeeds=Array.from({length:16},(_,i)=>i+1);
function outcome(seed,roster){
  const result=runVariant(prepared.preparedSave,seed,roster);
  return{seed,roster:roster.id,counts:roster.counts,
    enemyStats:result.enemyStats,
    won:result.battle.won,round:result.battle.round,
    callbacks:result.battle.callbacks,
    deployed:result.battle.beforeDeployed,
    losses:result.battle.lossByType,lossTotal:result.battle.lossTotal,
    survivors:result.battle.postOwned,
    nominalReward:result.battle.nominalReward,
    actualReward:result.battle.actualReward,
    meritGain:result.battle.meritGain,essenceDrops:result.battle.essenceDrops,
    defeated20:result.postBattle.checkpoint.defeated.includes(20),
    finalSaveSha256:result.finalSaveSha256};
}
const outcomes=candidates.flatMap(roster=>combatSeeds.map(seed=>outcome(seed,roster)));
for(const id of ['8-6-4','10-7-4']){
  const old=p182Data.profiles.find(p=>p.seed===1&&p.branch==='current-L3-plus-six')
    .variants.find(v=>v.roster===id);
  const now=outcomes.find(v=>v.roster===id&&v.seed===1);
  assert.deepEqual({won:now.won,round:now.round,losses:now.losses,
    survivors:now.survivors,actualReward:now.actualReward},
    {won:old.battle.won,round:old.battle.round,losses:old.battle.lossByType,
      survivors:old.battle.postOwned,actualReward:old.battle.actualReward},
    `种子1 ${id}未复现P182`);
}
function histogram(rows,key){
  return Object.fromEntries([...new Set(rows.map(row=>row[key]))].sort((a,b)=>a-b)
    .map(value=>[value,rows.filter(row=>row[key]===value).length]));
}
function aggregate(roster){
  const rows=outcomes.filter(row=>row.roster===roster.id);
  const wins=rows.filter(row=>row.won),losses=rows.filter(row=>!row.won);
  const casualtyCounts=rows.map(row=>row.lossTotal).sort((a,b)=>a-b);
  return{roster:roster.id,counts:roster.counts,
    enemyStats:rows[0].enemyStats,
    samples:rows.length,wins:wins.length,losses:losses.length,
    winRoundHistogram:histogram(wins,'round'),
    lossRoundHistogram:histogram(losses,'round'),
    casualtyHistogram:histogram(rows,'lossTotal'),
    casualtyMin:casualtyCounts[0],
    casualtyMedian:(casualtyCounts[7]+casualtyCounts[8])/2,
    casualtyMax:casualtyCounts.at(-1),
    winningSeeds:wins.map(row=>row.seed),losingSeeds:losses.map(row=>row.seed)};
}
const summary=candidates.map(aggregate);
function numericTrace(data){
  return data.outcomes.map(({finalSaveSha256,...row})=>row);
}
if(priorData){
  assert.equal(priorData.batch,'P184');
  assert.deepEqual(numericTrace({outcomes}),numericTrace(priorData),
    'P184相同战前档与随机流的战斗轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l18-l20-cavalry-p180.js',
  'docs/codex/reports/data/p180-current-l18-l20-cavalry.json',
  'tools/verify/probe-current-l20-boss-roster-p182.js',
  'docs/codex/reports/data/p182-current-l20-boss-roster.json',
  'tools/verify/probe-current-l20-boss-seeds-p184.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P184',unit:'soldiers, resources, combat rounds; no elapsed online ticks during fights',
  sourceHead:head.stdout.trim(),
  method:'Restore one P180 genuine paid cavalry post-L19 save and refill via live queue/tick to the exact P180 pre-L20 43-soldier state; from one serialized prebattle state run independent isolated VMs for candidate L20 rosters 8-6-4, 9-7-4, 10-7-4 with fixed battle RNG seeds 1–16; only CFG.enemies[19].units changes inside each VM; use real formation, asynchronous battle callbacks, settlement and save/reload',
  scope:{sourceSeed:source.seed,sourceBranch:source.branch,
    sourceL19SaveSha256:l19.afterSaveSha256,
    preparedSaveSha256:prepared.preparedSaveSha256,
    preparationSeconds:prepared.recovery.seconds,
    preparationMinFoodTickEnd:prepared.recovery.minFoodTickEnd,
    combatSeeds,candidates,noOffline:true,noGarrison:true,
    sourceConfigChanged:false},
  preparedSave:prepared.preparedSave,
  summary,outcomes,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P184',sourceL19SaveSha256:l19.afterSaveSha256,
  preparationSeconds:prepared.recovery.seconds,summary,rawData:outputPath},null,2));
