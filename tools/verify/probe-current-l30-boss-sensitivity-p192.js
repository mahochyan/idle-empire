'use strict';
// P192: isolated L30 enemy roster sensitivity from five fully paid P190 saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p190Path=path.join(__dirname,'probe-current-third-chapter-second-back-p190.js');
const p190DataPath=path.join(root,'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const outputPath=path.join(root,'docs/codex/reports/data/p192-current-l30-boss-sensitivity.json');
const p190Raw=fs.readFileSync(p190DataPath);
const p190=JSON.parse(p190Raw);
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const combatSeeds=Array.from({length:16},(_,i)=>i+1);
const rosters=[
  {id:'current-1-1-1',counts:[1,1,1],current:true},
  {id:'4-3-2',counts:[4,3,2]},
  {id:'6-4-3',counts:[6,4,3]},
  {id:'8-6-4',counts:[8,6,4]}
];
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P192找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P192的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p190.batch,'P190');
for(const input of p190.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `P190来源文件已变化：${input.file}`);
assert.equal(p190.l30Prepared.length,5,'P190必须有五份真实L30战前档');
function reuseP190(){
  let source=fs.readFileSync(p190Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute))',
    'return {restore,fight,owned,reload,state,formation};\nconst profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute))',
    'P190真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p190Path),{log(){},error:console.error},path.dirname(p190Path));
}
const {restore,fight,owned,reload,state,formation}=reuseP190();
function rosterUnits(counts){
  return{infantry:[...counts],archer:[...counts],cavalry_t1:[...counts],
    mage_t1:counts.slice(0,2)};
}
function setRoster(run,roster){
  const before=plain(run('CFG.enemies[29]'));
  assert.equal(before.id,30);
  if(!roster.current)
    run(`CFG.enemies[29].units=${JSON.stringify(rosterUnits(roster.counts))}`);
  const after=plain(run('CFG.enemies[29]'));
  assert.deepEqual(after.units,rosterUnits(roster.counts));
  delete before.units;delete after.units;
  assert.deepEqual(after,before,
    `候选${roster.id}意外改变Boss名字、倍率、奖励或掉落`);
}
function inspectEnemy(save,roster){
  const run=restore(save);
  setRoster(run,roster);
  return plain(run(`S.selEnemy=29;S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound,
      byType:B.enemyUnits.reduce((out,u)=>{
        const e=out[u.type]||{groups:0,hp:0,attackMass:0};
        e.groups++;e.hp+=u.hp;e.attackMass+=u.atk*combatAttackMass(u);
        out[u.type]=e;return out;
      },{})})`));
}
function difference(before,after){
  return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(after)])]
    .map(key=>[key,(after[key]||0)-(before[key]||0)])
    .filter(([,value])=>value>0));
}
function runBattle(source,seed,roster,targets){
  const enemyStats=inspectEnemy(source.save,roster);
  const run=restore(source.save);
  setRoster(run,roster);
  const nominalReward=plain(run('CFG.enemies[29].reward'));
  const beforeEssence=plain(run('({...S.essence})'));
  const beforeOwned=Object.fromEntries(Object.keys(targets).map(type=>
    [type,owned(run,type)]));
  const battle=fight(run,seed,30,active=>formation(active,targets));
  for(const [type,target] of Object.entries(targets))
    assert.equal(battle.beforeDeployed[type],target,
      `P192 ${source.route} seed${seed} ${roster.id} ${type}未实入场`);
  const lossByType=Object.fromEntries(Object.entries(beforeOwned).map(
    ([type,count])=>[type,count-owned(run,type)]));
  for(const [type,loss] of Object.entries(lossByType))
    assert.ok(loss>=0&&loss<=targets[type],`${type}战损越界`);
  const actualReward=Object.fromEntries(Object.keys(nominalReward).map(key=>
    [key,battle.after.resources[key]-battle.before.resources[key]]));
  const essenceDrops=difference(beforeEssence,plain(run('({...S.essence})')));
  const after=reload(run,`P192 ${source.route} seed${seed} ${roster.id}战后`);
  const postBattle=state(after.run);
  assert.equal(postBattle.checkpoint.defeated.includes(30),battle.won,
    '胜负与通关记录不一致');
  return{seed,roster:roster.id,counts:roster.counts,enemyStats,
    battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
      beforeDeployed:battle.beforeDeployed,formation:battle.formation,
      lossByType,lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
      postOwned:Object.fromEntries(Object.keys(targets).map(type=>
        [type,owned(after.run,type)])),
      nominalReward,actualReward,
      meritGain:battle.after.merit-battle.before.merit,essenceDrops},
    finalSaveSha256:after.saveSha256,postBattle};
}
function runSource(source){
  assert.equal(sha(source.save),source.saveSha256,
    `P190 ${source.route} seed${source.seed}战前SHA不符`);
  const loaded=restore(source.save);
  assert.deepEqual(state(loaded),source.preBattle,
    `P190 ${source.route} seed${source.seed}战前重载不符`);
  assert.deepEqual(plain(loaded('([...S.defeated])')),
    Array.from({length:29},(_,i)=>i+1));
  const targets=p190.scope.targetsByRoute[source.route];
  assert.ok(targets);
  const expectedArmy=Object.values(targets).reduce((n,v)=>n+v,0);
  assert.ok([58,73].includes(expectedArmy));
  const original=p190.profiles.find(p=>p.seed===source.seed&&p.route===source.route)
    ?.stages.find(s=>s.stage===30);
  assert.ok(original?.battle?.won,'P190当前L30旧实战缺失');
  assert.equal(source.saveSha256,original.beforeSaveSha256);
  const seeds=source.route==='secondBackFood7'?combatSeeds:[source.seed];
  const outcomes=seeds.flatMap(seed=>rosters.map(roster=>
    runBattle(source,seed,roster,targets)));
  const baseline=outcomes.find(o=>o.seed===source.seed&&o.roster==='current-1-1-1');
  assert.ok(baseline);
  for(const key of ['won','round','callbacks','beforeDeployed','lossByType',
    'lossTotal','nominalReward','actualReward','meritGain','essenceDrops'])
    assert.deepEqual(baseline.battle[key],original.battle[key],
      `P190 ${source.route} seed${source.seed}现行L30未复现：${key}`);
  assert.deepEqual(baseline.postBattle,original.postBattle,
    `P190 ${source.route} seed${source.seed}现行L30战后未复现`);
  for(const outcome of outcomes){
    assert.equal(outcome.enemyStats.groups,11,'L30兵团数意外变化');
    assert.equal(outcome.enemyStats.maxRound,30,'L30回合上限意外变化');
    assert.deepEqual(outcome.battle.beforeDeployed,baseline.battle.beforeDeployed,
      '同档候选我方实入场人数变化');
  }
  return{sourceSeed:source.seed,route:source.route,
    targets,sourceSaveSha256:source.saveSha256,
    sourcePreBattle:source.preBattle,
    matchedOriginalSeed:source.seed,
    combatSeeds:seeds,outcomes};
}
const sources=p190.l30Prepared.map(runSource);
function numericTrace(source){
  return{sourceSeed:source.sourceSeed,route:source.route,targets:source.targets,
    sourcePreBattle:source.sourcePreBattle,
    outcomes:source.outcomes.map(outcome=>{
      const {formation:unused,...battle}=outcome.battle;
      return{seed:outcome.seed,roster:outcome.roster,counts:outcome.counts,
        enemyStats:outcome.enemyStats,battle,postBattle:outcome.postBattle};
    })};
}
if(prior){
  assert.equal(prior.batch,'P192');
  assert.deepEqual(sources.map(numericTrace),prior.sources.map(numericTrace),
    'P192复跑数值轨迹不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const inputFiles=[...new Set([...p190.inputs.map(row=>row.file),
  'docs/codex/reports/data/p190-current-third-chapter-second-back.json',
  'tools/verify/probe-current-l30-boss-sensitivity-p192.js'])];
const artifact={batch:'P192',unit:'soldiers, resources, battle rounds; no online tick during fights',
  sourceHead:head.stdout.trim(),
  method:'Read five complete P190 genuine paid L30 prebattle saves and verify SHA/reloaded state; per save restore isolated VM, override only CFG.enemies[29].units for three eleven-group candidate rosters, keep all other Boss fields, call genuine formation, initBattleState inspection, seeded async battle, settlement, save/reload; exact current roster must reproduce P190 L30 outcome; Food7 saves additionally use battle RNG streams 1–16 with no economy replay',
  scope:{rosters,food7CombatSeeds:combatSeeds,
    matchedOriginalStreams:true,sourceConfigChanged:false,noOffline:true,
    noGarrison:true},
  p190ArtifactSha256:sha(p190Raw),
  originalL30:plain(restore(p190.l30Prepared[0].save)('CFG.enemies[29]')),
  sources,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
function brief(outcome){return{seed:outcome.seed,roster:outcome.roster,
  hp:outcome.enemyStats.totalHp,attackMass:outcome.enemyStats.attackMass,
  won:outcome.battle.won,round:outcome.battle.round,
  loss:outcome.battle.lossTotal};}
console.log(JSON.stringify({batch:'P192',p190ArtifactSha256:artifact.p190ArtifactSha256,
  sources:sources.map(source=>({seed:source.sourceSeed,route:source.route,
    sourceSaveSha256:source.sourceSaveSha256,
    matched:source.outcomes.filter(o=>o.seed===source.sourceSeed).map(brief),
    ...(source.route==='secondBackFood7'?{
      sweep:rosters.map(roster=>{
        const rows=source.outcomes.filter(o=>o.roster===roster.id);
        return{roster:roster.id,wins:rows.filter(o=>o.battle.won).length,
          losses:rows.filter(o=>!o.battle.won).length,
          lossRange:[Math.min(...rows.map(o=>o.battle.lossTotal)),
            Math.max(...rows.map(o=>o.battle.lossTotal))]};
      })}:{} )})),rawData:outputPath},null,2));
