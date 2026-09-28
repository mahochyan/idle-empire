'use strict';
// P216: read-only downstream replay of paid L20/L40 prebattle saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const p184=read('docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const p202=read('docs/codex/reports/data/p202-fourth-chapter-paid.json');
const p204=read('docs/codex/reports/data/p204-l40-candidate-handoff.json');
const p206=read('docs/codex/reports/data/p206-live-l40-l41-handoff.json');
assert.equal(p184.batch,'P184');
assert.equal(p202.batch,'P202');
assert.equal(p204.batch,'P204');
assert.equal(p206.batch,'P206');
assert.equal(sha(fs.readFileSync(path.join(dataDir,'p202-fourth-chapter-paid.json'))),
  p204.inputs.p202);
assert.equal(sha(fs.readFileSync(path.join(dataDir,'p204-l40-candidate-handoff.json'))),
  p206.inputs.p204);
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json',
  'docs/codex/reports/data/p202-fourth-chapter-paid.json',
  'docs/codex/reports/data/p204-l40-candidate-handoff.json',
  'docs/codex/reports/data/p206-live-l40-l41-handoff.json',
  'tools/verify/probe-combat-order-downstream-p216.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(inputs.find(x=>x.file==='math.js').sha256,
  '6335736ad922dd51b9f231e28cc286215074add83c74e0cc5b067baf3f449695');
assert.equal(inputs.find(x=>x.file==='garrison.js').sha256,
  'c3793840886aac466dd25ede4ffd407adf726b618dee81d13f1c6c0f8970b167');
const profile40=p202.profiles.find(p=>p.sourceKind==='P194'&&p.seed===1);
const stage40=profile40?.stages.find(s=>s.stage===40);
assert.ok(stage40?.prepared?.save);
assert.equal(sha(p184.preparedSave),p184.scope.preparedSaveSha256);
assert.equal(sha(stage40.prepared.save),stage40.prepared.saveSha256);
const sourceCases=[
  {stage:20,origin:'P184 paid 43 soldiers',save:p184.preparedSave,
    sha256:p184.scope.preparedSaveSha256,flows:[1,15]},
  {stage:40,origin:'P202 paid P194 route source seed 1',
    save:stage40.prepared.save,sha256:stage40.prepared.saveSha256,flows:[1,14]}
];
const l20Units={infantry:[8,6,4],archer:[8,6,4],cavalry_t1:[8,6,4]};
function boot(save,label){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}: load`);
  assert.equal(run('saveProtected()'),false,`${label}: protected`);
  run(`globalThis.__p216Timers=new Map();globalThis.__p216TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p216TimerId++;
      __p216Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p216Timers.delete(id);
    globalThis.__p216Step=()=>{const next=__p216Timers.entries().next().value;
      if(!next)return false;__p216Timers.delete(next[0]);next[1]();return true};
    globalThis.__p216Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p216Nodes.has(id))__p216Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p216Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return {world,run};
}
function snapshot(run){return plain(run(`({tick:S.tick,res:{...S.res},
  pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
  queue:JSON.parse(JSON.stringify(S.queue)),defeated:[...S.defeated],
  essence:{...S.essence},merit:S.merit,army:armyCount()})`))}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label}: save`);
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=boot(save,`${label}: reload`);
  assert.deepEqual(snapshot(next.run),before,`${label}: state after reload`);
  return {...next,save,sha256:sha(save)};
}
function owned(run,type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function formL20(run){
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15);
  for(const [row,type,count] of [['front','bronze_guard',15],
    ['front','cavalry_t1',15],['back','archer_t1',13]]){
    const slot=run(`S.formation.${row}.length`);
    assert.ok(slot<run(`rowSlots('${row}')`));
    assert.ok(run(`poolAvail('${type}')`)>=count);
    run(`openFormModal('expedition','${row}',${slot})`);
    assert.equal(run(`document.getElementById('form-modal-content').innerHTML
      .includes('data-type="${type}"')`),true);
    run(`selModalUnit({classList:{add(){}}},'${type}',poolAvail('${type}'));
      setModalQty(${count});confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].type`),type);
    assert.equal(run(`S.formation.${row}[${slot}].count`),count);
  }
  assert.equal(run('armyCount()'),43);
}
function assertFormal(run,stage){
  const enemy=plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(enemy.id,stage);
  if(stage===20)assert.deepEqual(enemy.units,l20Units);
  else{
    assert.deepEqual(enemy.units,p204.candidateUnits);
    for(const key of ['id','name','reward','drops'])
      assert.deepEqual(enemy[key],stage40.enemy[key]);
    assert.equal(!!enemy.boss,stage40.enemy.boss);
  }
  return {id:enemy.id,name:enemy.name,units:enemy.units,boss:!!enemy.boss};
}
function setRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p216Rng=${initial};globalThis.__p216RngDraws=0;
    Math.random=()=>{__p216RngDraws++;
      let x=__p216Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __p216Rng=x>>>0;return __p216Rng/4294967296};`);
}
function historical(stage,flow){
  if(stage===20){
    const row=p184.outcomes.find(x=>x.seed===flow&&x.roster==='8-6-4');
    assert.ok(row);
    return {artifact:'P184 (P186 formal replay)',won:row.won,
      round:row.round,lossByType:row.losses,lossTotal:row.lossTotal};
  }
  const row=p206.cases.find(x=>x.sourceSeed===1&&x.seed===flow);
  assert.ok(row?.l40);
  return {artifact:'P206 (P204 formal candidate)',won:row.l40.won,
    round:row.l40.round,lossByType:row.l40.lossByType,
    lossTotal:row.l40.lossTotal};
}
function trial(source,flow){
  const label=`L${source.stage}/flow${flow}`;
  let active=boot(source.save,label);
  assert.deepEqual(plain(active.run('([...S.defeated])')),
    Array.from({length:source.stage-1},(_,i)=>i+1));
  const loaded=snapshot(active.run);
  if(source.stage===20)formL20(active.run);
  else assert.deepEqual(plain(active.run('JSON.parse(JSON.stringify(S.formation))')),
    stage40.formation.formation);
  const formed=snapshot(active.run);
  assert.deepEqual(formed.res,loaded.res);
  assert.equal(formed.army,loaded.army);
  assert.deepEqual(formed.queue,loaded.queue);
  const formal=assertFormal(active.run,source.stage);
  active=saveReload(active,`${label}: prepared`);
  assertFormal(active.run,source.stage);
  const before=snapshot(active.run);
  const prepared={sha256:active.sha256,save:active.save,state:before};
  const types=[...new Set(Object.values(before.formation).flatMap(row=>row.map(u=>u.type)))];
  const beforeOwned=Object.fromEntries(types.map(type=>[type,owned(active.run,type)]));
  setRng(active.run,flow,source.stage);
  active.run(`selEnemy(${source.stage-1});openBattle()`);
  assert.equal(active.run('S.battleActive'),true,`${label}: started`);
  const enemyInit=plain(active.run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(active.run('S.battleActive')&&callbacks<1500){
    assert.equal(active.run('__p216Step()'),true,`${label}: callback`);
    callbacks++;
  }
  assert.equal(active.run('S.battleActive'),false,`${label}: settled`);
  const battle={won:active.run(`S.defeated.includes(${source.stage})`),
    round:active.run('B.round'),callbacks,
    enemyRemainingHp:active.run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)'),
    rngDraws:active.run('__p216RngDraws'),enemyInit};
  const losses=Object.fromEntries(types.map(type=>
    [type,beforeOwned[type]-owned(active.run,type)]));
  assert.ok(Object.values(losses).every(n=>n>=0));
  battle.lossByType=losses;
  battle.lossTotal=Object.values(losses).reduce((n,x)=>n+x,0);
  active.run('exitBattle()');
  active=saveReload(active,`${label}: settled`);
  assert.equal(active.run(`S.defeated.includes(${source.stage})`),battle.won);
  return {stage:source.stage,flow,source:source.origin,
    sourceSaveSha256:source.sha256,formal,prepared,
    battle,post:{sha256:active.sha256,save:active.save,state:snapshot(active.run)},
    historical:historical(source.stage,flow)};
}
const cases=[];
for(const source of sourceCases)for(const flow of source.flows)
  cases.push(trial(source,flow));
for(const input of inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `${input.file} changed during P216`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P216',sourceHead:head.stdout.trim(),
  scope:{stages:[20,40],flows:{20:[1,15],40:[1,14]},
    rng:'xorshift32 (flow*1009+stage*9176)>>>0',
    runtime:{node:process.version,platform:process.platform,nodeVmOnly:true},
    formalCfgOnly:true,noCombatOrConfigOverride:true,noResourceOrTroopInjection:true,
    note:'Four predefined seed replays from two distinct authentic paid saves; not a curve sweep or player win-rate estimate.'},
  sources:sourceCases.map(({save,flows,...x})=>({...x,flows})),cases,
  historicalMathSha256:{20:p184.inputs.find(x=>x.file==='math.js')?.sha256,
    40:p206.inputs.math},inputs};
const outputPath=path.join(dataDir,'p216-combat-order-downstream.json');
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P216',sourceHead:artifact.sourceHead,
  sources:artifact.sources,cases:cases.map(x=>({stage:x.stage,flow:x.flow,
    battle:x.battle,historical:x.historical,postSaveSha256:x.post.sha256})),
  historicalMathSha256:artifact.historicalMathSha256,
  currentMathSha256:inputs.find(x=>x.file==='math.js').sha256,
  output:outputPath},null,2));
