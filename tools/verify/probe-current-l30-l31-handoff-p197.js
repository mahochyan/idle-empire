'use strict';
// P197: candidate L30 [6,4,3] real settlement, paid refill, and live L31.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p195Path=path.join(__dirname,'probe-current-l30-followup-p195.js');
const p195DataPath=path.join(root,'docs/codex/reports/data/p195-current-l30-followup.json');
const outputPath=path.join(root,'docs/codex/reports/data/p197-current-l30-l31-handoff.json');
const p195Raw=fs.readFileSync(p195DataPath);
const p195=JSON.parse(p195Raw);
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P197找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P197 ${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p195.batch,'P195');
for(const item of p195.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P195输入已变化：${item.file}`);
function reuseP195(){
  let source=fs.readFileSync(p195Path,'utf8');
  source=replaceOnce(source,
    "const frontSource=sourceFor('thirdFront',1);",
    "return {restore,fight,owned,reload,state,recovery,formation31,battleFrom,sourceFor,rosters,p190,p194};\nconst frontSource=sourceFor('thirdFront',1);",
    'P195真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p195Path),{log(){},error:console.error},path.dirname(p195Path));
}
const {restore,fight,owned,reload,state,recovery,battleFrom,
  sourceFor,rosters,p190,p194}=reuseP195();
const roster=rosters.find(x=>x.id==='6-4-3');
assert.ok(roster&&!roster.current);
const targets58=p190.scope.targetsByRoute.thirdFront;
const targets73=p194.scope.targets;
function formL31(run,targets){
  run("clrForm('expedition')");
  const slots={front:run("rowSlots('front')"),
    mid:run("rowSlots('mid')"),back:run("rowSlots('back')")};
  assert.ok(slots.front>=3&&slots.back>=1);
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
  if(targets.archer_t1===28)place('back','archer_t1',15,1);
  else assert.equal(targets.archer_t1,13);
  return {slots,formation:plain(run('JSON.parse(JSON.stringify(S.formation))'))};
}
function stage31Enemy(save){
  const run=restore(save);
  const cfg=plain(run('CFG.enemies[30]'));
  assert.equal(cfg.id,31);
  const stats=plain(run(`S.selEnemy=30;S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound})`));
  return {id:cfg.id,name:cfg.name,units:cfg.units,reward:cfg.reward,stats};
}
function compareSource(row,sourceKind){
  if(sourceKind==='P190'){
    const old=p195.frontSweep.find(x=>x.combatSeed===row.combatSeed&&
      x.roster===row.roster);
    assert.ok(old&&row.combatSeed===19);
    assert.deepEqual(row.battle,old.battle,'P195的58人L30高损战斗未复现');
    assert.deepEqual(row.postBattle,old.postBattle,'P195的58人L30战后状态未复现');
  }else{
    const old=p195.p194Trials.find(x=>x.sourceSeed===row.sourceSeed&&
      x.roster===row.roster);
    assert.ok(old);
    assert.deepEqual(row.battle,old.battle,'P195的P194 L30战斗未复现');
    assert.deepEqual(row.postBattle,old.postBattle,'P195的P194 L30战后状态未复现');
  }
}
function route(source,kind,combatSeed,targets){
  const l30=battleFrom(source,combatSeed,roster,
    kind==='P194'?targets:null);
  compareSource(l30,kind);
  assert.equal(l30.battle.won,true,'P197候选L30原流已败，无法续关');
  let run=restore(l30.postSave);
  assert.deepEqual(state(run),l30.postBattle,'L30旧档重载状态不同');
  const refill=recovery(run,31,targets);
  let prepared=null,l31=null,block=null;
  if(!refill.ready){
    block=refill.block||'training-time-or-resource';
  }else{
    const saved=reload(run,`P197 ${kind}流${combatSeed} L31补兵完成`);
    run=saved.run;
    const form=formL31(run,targets);
    const ready=reload(run,`P197 ${kind}流${combatSeed} L31编队完成`);
    run=ready.run;
    const deployed=Object.fromEntries(Object.keys(targets).map(type=>
      [type,form.formation.front.concat(form.formation.mid,form.formation.back)
        .filter(x=>x.type===type).reduce((n,u)=>n+u.count,0)]));
    assert.deepEqual(deployed,targets,'L31目标兵未全部实编队');
    prepared={postRecoverySaveSha256:saved.saveSha256,
      postRecoverySave:saved.save,
      saveSha256:ready.saveSha256,save:ready.save,
      state:state(run),slots:form.slots,deployed};
    assert.deepEqual(plain(run('([...S.defeated])')),
      Array.from({length:30},(_,i)=>i+1));
    const enemy=stage31Enemy(prepared.save);
    const beforeOwned=Object.fromEntries(Object.keys(targets)
      .map(type=>[type,owned(run,type)]));
    const result=fight(run,combatSeed,31,active=>formL31(active,targets).formation);
    for(const [type,n] of Object.entries(targets))
      assert.equal(result.beforeDeployed[type],n,`L31 ${type}入场错误`);
    const after=reload(run,`P197 ${kind}流${combatSeed} L31战后`);
    const lossByType=Object.fromEntries(Object.entries(beforeOwned).map(
      ([type,n])=>[type,n-owned(after.run,type)]));
    const lossTotal=Object.values(lossByType).reduce((n,v)=>n+v,0);
    assert.equal(after.run('S.defeated.includes(31)'),result.won,
      'L31胜负与通关状态不一致');
    l31={enemy,battle:{won:result.won,round:result.round,
      callbacks:result.callbacks,beforeDeployed:result.beforeDeployed,
      lossByType,lossTotal,
      actualReward:Object.fromEntries(Object.keys(enemy.reward).map(key=>
        [key,result.after.resources[key]-result.before.resources[key]]))},
      postSaveSha256:after.saveSha256,postSave:after.save,
      postBattle:state(after.run)};
  }
  return {sourceKind:kind,sourceSeed:source.seed,combatSeed,
    sourceSaveSha256:source.saveSha256,roster:roster.id,targets,
    l30:{battle:l30.battle,postSaveSha256:l30.postSaveSha256,
      postSave:l30.postSave,postBattle:l30.postBattle},recovery:refill,
    l31Prepared:prepared,l31,block};
}
const front=route(sourceFor('thirdFront',1),'P190',19,targets58);
const grown=p194.l30Prepared.map(raw=>{
  assert.equal(sha(raw.save),raw.saveSha256,'P194 L30战前档SHA错误');
  assert.deepEqual(state(restore(raw.save)),raw.preBattle,
    'P194 L30战前档重载不同');
  return route({...raw,route:'population22Food7'},'P194',raw.seed,targets73);
});
const profiles=[front,...grown];
function numericTrace(row){
  return {sourceKind:row.sourceKind,sourceSeed:row.sourceSeed,
    combatSeed:row.combatSeed,roster:row.roster,targets:row.targets,
    l30:{battle:row.l30.battle,postBattle:row.l30.postBattle},
    recovery:row.recovery,
    l31Prepared:row.l31Prepared&&{state:row.l31Prepared.state,
      slots:row.l31Prepared.slots,deployed:row.l31Prepared.deployed},
    l31:row.l31&&{enemy:row.l31.enemy,battle:row.l31.battle,
      postBattle:row.l31.postBattle},block:row.block};
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const inputFiles=[...new Set([...p195.inputs.map(x=>x.file),
  'docs/codex/reports/data/p195-current-l30-followup.json',
  'tools/verify/probe-current-l30-l31-handoff-p197.js'])];
const artifact={batch:'P197',unit:'simulated online seconds, soldiers, resources, battle rounds',
  sourceHead:head.stdout.trim(),
  method:'From exact P190 58-army L30 paid prebattle save at combat stream19 and exact P194 22-population 73-army L30 paid saves at original streams1/15, override only L30 enemy units in isolated VM to [6,4,3], run true battle/settlement/save/reload; then train/pay per-second tick to original army target up to 7200 seconds, form and save/reload L31 prepared, fight official L31 with same fixed stream, settle and save/reload',
  scope:{l30Roster:roster,maxRecoverySeconds:7200,
    sourceConfigChanged:false,noOffline:true,noGarrison:true,
    l31ConfigOverride:false},
  p195ArtifactSha256:sha(p195Raw),profiles,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
if(prior){
  assert.equal(prior.batch,'P197');
  assert.deepEqual(profiles.map(numericTrace),prior.profiles.map(numericTrace),
    'P197复跑数值轨迹不一致');
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P197',p195ArtifactSha256:artifact.p195ArtifactSha256,
  profiles:profiles.map(x=>({sourceKind:x.sourceKind,sourceSeed:x.sourceSeed,
    combatSeed:x.combatSeed,sourceSaveSha256:x.sourceSaveSha256,
    l30Won:x.l30.battle.won,l30Loss:x.l30.battle.lossTotal,
    recoverySeconds:x.recovery.seconds,ready:x.recovery.ready,
    minFood:x.recovery.minFoodTickEnd,paid:x.recovery.dueByProduced,
    paused:x.recovery.pausedQueueSeconds,
    l31Won:x.l31?.battle.won??null,l31Round:x.l31?.battle.round??null,
    l31Loss:x.l31?.battle.lossTotal??null,block:x.block})),
  rawData:outputPath},null,2));
