'use strict';
// P195: real L30 save combat-stream sensitivity and paid L31 replenishment.
// Only enemy units change in isolated VMs. Game files and source saves stay intact.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p190Path=path.join(__dirname,'probe-current-third-chapter-second-back-p190.js');
const p190DataPath=path.join(root,'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const p192DataPath=path.join(root,'docs/codex/reports/data/p192-current-l30-boss-sensitivity.json');
const p194DataPath=path.join(root,'docs/codex/reports/data/p194-current-third-chapter-population-army.json');
const outputPath=path.join(root,'docs/codex/reports/data/p195-current-l30-followup.json');
const p190Raw=fs.readFileSync(p190DataPath);
const p192Raw=fs.readFileSync(p192DataPath);
const p194Raw=fs.readFileSync(p194DataPath);
const p190=JSON.parse(p190Raw),p192=JSON.parse(p192Raw);
const p194=JSON.parse(p194Raw);
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const combatSeeds=Array.from({length:32},(_,i)=>i+1);
const refillSeeds=[1,9,15];
const rosters=[
  {id:'current-1-1-1',counts:[1,1,1],current:true},
  {id:'6-4-3',counts:[6,4,3]},
  {id:'8-6-4',counts:[8,6,4]}
];
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P195找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P195 ${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p190.batch,'P190');
assert.equal(p192.batch,'P192');
assert.equal(p194.batch,'P194');
for(const item of p190.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P190输入已变化：${item.file}`);
for(const item of p192.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P192输入已变化：${item.file}`);
for(const item of p194.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P194输入已变化：${item.file}`);
assert.equal(sha(p190Raw),p192.p190ArtifactSha256,'P192锁定的P190来源已变化');
assert.equal(p194.sourceSaveSha256,
  '8f15611a09cefb9b64ca2d7d53c5cd8af1f52c375c4d1cc85fe75c48df0d5e99',
  'P194所用22人口真实来源档SHA已变化');
assert.equal(p194.l30Prepared.length,2,'P194需提供两份完整L30战前档');

function reuseP190(){
  let source=fs.readFileSync(p190Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute))',
    'return {restore,fight,owned,reload,state,recovery,formation,foodEconomy};\nconst profiles=[];\nfor(const seed of seeds)for(const routeName of Object.keys(targetsByRoute))',
    'P190真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p190Path),{log(){},error:console.error},path.dirname(p190Path));
}
const {restore,fight,owned,reload,state,recovery,formation,foodEconomy}=reuseP190();
function sourceFor(route,seed){
  const source=p190.l30Prepared.find(x=>x.route===route&&x.seed===seed);
  assert.ok(source,`P190缺少${route}流${seed}的完整L30战前档`);
  assert.equal(sha(source.save),source.saveSha256,'P190战前档SHA错误');
  assert.deepEqual(state(restore(source.save)),source.preBattle,
    'P190战前档当前重载状态变化');
  assert.deepEqual(plain(restore(source.save)('([...S.defeated])')),
    Array.from({length:29},(_,i)=>i+1));
  const fromP192=p192.sources.find(x=>x.route===route&&x.sourceSeed===seed);
  assert.ok(fromP192&&fromP192.sourceSaveSha256===source.saveSha256,
    'P192来源档SHA不一致');
  return source;
}
function rosterUnits(counts){
  return {infantry:[...counts],archer:[...counts],cavalry_t1:[...counts],
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
  assert.deepEqual(after,before,'候选修改了第30关非敌阵字段');
}
function formation31(run,targets){
  run("clrForm('expedition')");
  const slots={front:run("rowSlots('front')"),
    mid:run("rowSlots('mid')"),back:run("rowSlots('back')")};
  assert.ok(slots.front>=3&&slots.back>=2,'L31缺少原阵型位置');
  assert.equal(run('regMax()'),15);
  function place(row,type,count,index){
    assert.ok(run(`rowSlots('${row}')`)>index);
    assert.ok(run(`S.pool['${type}']||0`)>=count);
    run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),true);
  }
  place('front','bronze_guard',15,0);
  place('front','cavalry_t1',15,1);
  place('front','infantry_t1',15,2);
  place('back','archer_t1',13,0);
  assert.equal(targets.archer_t1,28);
  place('back','archer_t1',15,1);
  return {slots,formation:plain(run('JSON.parse(JSON.stringify(S.formation))'))};
}
function battleFrom(source,seed,roster,targetsOverride=null){
  const targets=targetsOverride||p190.scope.targetsByRoute[source.route];
  assert.ok(targets);
  const run=restore(source.save);
  setRoster(run,roster);
  const beforeOwned=Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)]));
  const battle=fight(run,seed,30,active=>formation(active,targets));
  for(const [type,target] of Object.entries(targets))
    assert.equal(battle.beforeDeployed[type],target,
      `${source.route} 流${seed} ${roster.id} ${type}真实入场错误`);
  const saved=reload(run,`P195 ${source.route}流${seed} ${roster.id} L30战后`);
  const lossByType=Object.fromEntries(Object.entries(beforeOwned).map(
    ([type,n])=>[type,n-owned(saved.run,type)]));
  const lossTotal=Object.values(lossByType).reduce((n,v)=>n+v,0);
  for(const [type,n] of Object.entries(lossByType))
    assert.ok(n>=0&&n<=targets[type],`${type}战损越界`);
  const won=saved.run('S.defeated.includes(30)');
  assert.equal(won,battle.won,'L30战果与战后通关记录不同');
  return {sourceSeed:source.seed,route:source.route,combatSeed:seed,
    roster:roster.id,sourceSaveSha256:source.saveSha256,
    battle:{won,round:battle.round,callbacks:battle.callbacks,
      beforeDeployed:battle.beforeDeployed,lossByType,lossTotal,
      resourceDelta:Object.fromEntries(['wood','stone','food'].map(key=>
        [key,battle.after.resources[key]-battle.before.resources[key]]))},
    postBattle:state(saved.run),postSaveSha256:saved.saveSha256,
    postSave:saved.save};
}
function p192Match(row){
  const source=p192.sources.find(x=>x.sourceSeed===row.sourceSeed&&x.route===row.route);
  const old=source?.outcomes.find(x=>x.seed===row.combatSeed&&x.roster===row.roster);
  if(!old)return;
  for(const key of ['won','round','callbacks','beforeDeployed','lossByType','lossTotal'])
    assert.deepEqual(row.battle[key],old.battle[key],
      `P192已有L30实战不复现：${row.route}流${row.combatSeed} ${row.roster} ${key}`);
  assert.deepEqual(row.postBattle,old.postBattle,'P192已有L30战后重载状态不符');
}
const frontSource=sourceFor('thirdFront',1);
const frontSweep=combatSeeds.flatMap(seed=>rosters.map(roster=>{
  const row=battleFrom(frontSource,seed,roster);
  p192Match(row);
  // Keep only the digest and the post-save state in the broad sweep.
  delete row.postSave;
  return row;
}));
const frontSummary=rosters.map(roster=>{
  const rows=frontSweep.filter(x=>x.roster===roster.id);
  const wins=rows.filter(x=>x.battle.won).length;
  const losses=rows.map(x=>x.battle.lossTotal).sort((a,b)=>a-b);
  return {roster:roster.id,wins,defeats:rows.length-wins,
    lossRange:[losses[0],losses.at(-1)],
    lossMedian:(losses[15]+losses[16])/2,
    failedSeeds:rows.filter(x=>!x.battle.won).map(x=>x.combatSeed)};
});

const p194Trials=p194.l30Prepared.flatMap(raw=>{
  assert.equal(sha(raw.save),raw.saveSha256,'P194 L30完整战前档SHA错误');
  assert.deepEqual(state(restore(raw.save)),raw.preBattle,
    'P194 L30战前档当前重载状态变化');
  assert.deepEqual(plain(restore(raw.save)('([...S.defeated])')),
    Array.from({length:29},(_,i)=>i+1));
  const source={...raw,route:'population22Food7'};
  const rows=rosters.map(roster=>{
    const row=battleFrom(source,raw.seed,roster,p194.scope.targets);
    delete row.postSave;
    return row;
  });
  const baseline=rows.find(x=>x.roster==='current-1-1-1');
  const original=p194.profiles.find(x=>x.seed===raw.seed)?.stages
    .find(x=>x.stage===30);
  assert.ok(original?.battle?.won,'P194原流L30实战缺失');
  for(const key of ['won','round','callbacks','beforeDeployed',
    'lossByType','lossTotal'])
    assert.deepEqual(baseline.battle[key],original.battle[key],
      `P194流${raw.seed} L30现行战果未复现：${key}`);
  assert.deepEqual(baseline.battle.resourceDelta,original.battle.actualReward,
    `P194流${raw.seed} L30实收资源未复现`);
  assert.deepEqual(baseline.postBattle,original.postBattle,
    `P194流${raw.seed} L30战后重载状态未复现`);
  return rows;
});

const food7Sources=[sourceFor('secondBackFood7',1),sourceFor('secondBackFood7',15)];
const replenishments=[];
for(const source of food7Sources)for(const seed of refillSeeds)for(const roster of rosters){
  const row=battleFrom(source,seed,roster);
  p192Match(row);
  if(!row.battle.won){
    replenishments.push({sourceSeed:source.seed,route:source.route,
      combatSeed:seed,roster:roster.id,sourceSaveSha256:source.saveSha256,
      l30:{battle:row.battle,postSaveSha256:row.postSaveSha256,
        postBattle:row.postBattle},
      recovery:null,l31Prepared:null,block:'L30 defeat'});
    continue;
  }
  let run=restore(row.postSave);
  assert.deepEqual(state(run),row.postBattle,'L30结算存档进入L31时重载不同');
  const targets=p190.scope.targetsByRoute[source.route];
  const refill=recovery(run,31,targets);
  const refillState=state(run);
  let prepared=null,block=null;
  if(refill.ready){
    const saved=reload(run,`P195 L31补兵完成 ${source.seed}/${seed}/${roster.id}`);
    run=saved.run;
    const placed=formation31(run,targets);
    const after=reload(run,`P195 L31编队完成 ${source.seed}/${seed}/${roster.id}`);
    assert.deepEqual(plain(after.run('([...S.defeated])')),
      Array.from({length:30},(_,i)=>i+1));
    const deployed=Object.fromEntries(Object.keys(targets).map(type=>
      [type,placed.formation.front.concat(placed.formation.mid,placed.formation.back)
        .filter(x=>x.type===type).reduce((n,x)=>n+x.count,0)]));
    assert.deepEqual(deployed,targets,'L31准备档编队没有完整入场');
    prepared={saveSha256:after.saveSha256,save:after.save,
      state:state(after.run),deployed,slots:placed.slots};
  }else block=refill.block||'training-time-or-resource';
  replenishments.push({sourceSeed:source.seed,route:source.route,
    combatSeed:seed,roster:roster.id,sourceSaveSha256:source.saveSha256,
    l30:{battle:row.battle,postSaveSha256:row.postSaveSha256,
      postBattle:row.postBattle,
      ...(source.seed===1&&seed===1&&roster.current?
        {postSave:row.postSave}:{})},
    recovery:refill,l31Prepared:prepared,block});
}
const oldL30Clear=replenishments.find(x=>x.sourceSeed===1&&x.combatSeed===1&&
  x.roster==='current-1-1-1');
assert.ok(oldL30Clear?.l30.postSave,'缺少现行L30真实获胜旧存档');
assert.equal(sha(oldL30Clear.l30.postSave),oldL30Clear.l30.postSaveSha256,
  '现行L30真实获胜旧存档SHA错误');
assert.deepEqual(state(restore(oldL30Clear.l30.postSave)),oldL30Clear.l30.postBattle,
  '现行L30真实获胜旧存档重载状态不符');
function numericTrace(artifact){
  return {frontSummary:artifact.frontSummary,
    frontSweep:artifact.frontSweep.map(x=>({combatSeed:x.combatSeed,
      roster:x.roster,battle:x.battle,postBattle:x.postBattle})),
    replenishments:artifact.replenishments.map(x=>({sourceSeed:x.sourceSeed,
      combatSeed:x.combatSeed,roster:x.roster,l30:{battle:x.l30.battle,
        postBattle:x.l30.postBattle},recovery:x.recovery,
      l31Prepared:x.l31Prepared&&{state:x.l31Prepared.state,
        deployed:x.l31Prepared.deployed,slots:x.l31Prepared.slots},block:x.block}))};
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const inputFiles=[...new Set([...p192.inputs.map(x=>x.file),
  ...p194.inputs.map(x=>x.file),
  'docs/codex/reports/data/p192-current-l30-boss-sensitivity.json',
  'docs/codex/reports/data/p194-current-third-chapter-population-army.json',
  'tools/verify/probe-current-l30-followup-p195.js'])];
const artifact={batch:'P195',unit:'simulated online seconds, soldiers, resources, battle rounds',
  sourceHead:head.stdout.trim(),
  method:'Read exact P190 genuine paid L30 saves and P194 22-resident genuine paid L30 saves, verify P192/P194 artifacts and inputs; only override CFG.enemies[29].units in isolated VM; run real formation, seeded async battle, settlement and save/reload for front 58-soldier streams 1–32 and P194 original streams; then run P190 Food7 73-soldier L30 streams 1/9/15 and real train/per-second tick/pay/formation/save/reload up to L31 prepared or 7200 seconds',
  scope:{frontCombatSeeds:combatSeeds,refillCombatSeeds:refillSeeds,
    p194OriginalCombatSeeds:p194.scope.seeds,
    rosters,maxRecoverySeconds:7200,sourceConfigChanged:false,
    noOffline:true,noGarrison:true,noL31Battle:true},
  p190ArtifactSha256:sha(p190Raw),p192ArtifactSha256:sha(p192Raw),
  p194ArtifactSha256:sha(p194Raw),
  sourceSaves:[frontSource,...food7Sources].map(x=>({route:x.route,seed:x.seed,
    saveSha256:x.saveSha256})).concat(p194.l30Prepared.map(x=>({
      route:'population22Food7',seed:x.seed,saveSha256:x.saveSha256}))),
  frontSummary,frontSweep,p194Trials,replenishments,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
if(prior){
  assert.equal(prior.batch,'P195');
  assert.deepEqual(numericTrace(artifact),numericTrace(prior),
    'P195复跑数值轨迹不一致');
  if(prior.p194Trials)assert.deepEqual(
    p194Trials.map(x=>({sourceSeed:x.sourceSeed,roster:x.roster,
      battle:x.battle,postBattle:x.postBattle})),
    prior.p194Trials.map(x=>({sourceSeed:x.sourceSeed,roster:x.roster,
      battle:x.battle,postBattle:x.postBattle})),
    'P195的P194实战复跑数值轨迹不一致');
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P195',p190ArtifactSha256:artifact.p190ArtifactSha256,
  p192ArtifactSha256:artifact.p192ArtifactSha256,
  p194ArtifactSha256:artifact.p194ArtifactSha256,frontSummary,
  p194Trials:p194Trials.map(x=>({seed:x.sourceSeed,roster:x.roster,
    won:x.battle.won,round:x.battle.round,loss:x.battle.lossTotal})),
  replenishments:replenishments.map(x=>({sourceSeed:x.sourceSeed,
    combatSeed:x.combatSeed,roster:x.roster,won:x.l30.battle.won,
    l30Loss:x.l30.battle.lossTotal,recoverySeconds:x.recovery?.seconds??null,
    ready:x.recovery?.ready??false,foodMin:x.recovery?.minFoodTickEnd??null,
    paid:x.recovery?.dueByProduced??null,block:x.block})),
  rawData:outputPath},null,2));
