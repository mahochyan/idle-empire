'use strict';
// P206: direct formal-CFG replay of P204's paid L40-to-L41 handoff.
// P202/P204 are data inputs. This script never changes CFG or grants resources.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const p202Text=fs.readFileSync(path.join(dataDir,'p202-fourth-chapter-paid.json'),'utf8');
const p204Text=fs.readFileSync(path.join(dataDir,'p204-l40-candidate-handoff.json'),'utf8');
const p202=JSON.parse(p202Text),p204=JSON.parse(p204Text);
const outputPath=path.join(dataDir,'p206-live-l40-l41-handoff.json');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(p202.batch,'P202');
assert.equal(p204.batch,'P204');
assert.equal(sha(p202Text),p204.inputs.p202,'P204 must use this exact P202 artifact');
const inputs={p202:sha(p202Text),p204:sha(p204Text),
  levels:sha(fs.readFileSync(path.join(root,'levels.js'))),
  math:sha(fs.readFileSync(path.join(root,'math.js'))),
  config:sha(fs.readFileSync(path.join(root,'config.js'))),
  technology:sha(fs.readFileSync(path.join(root,'technology.js')))};
for(const file of ['math','config','technology'])
  assert.equal(inputs[file],p204.inputs[file],`P204 ${file} baseline changed`);
assert.equal(inputs.levels,
  '01f3d5caa2124e236b96c93c31090bf4e015c0b826a9f6662b56240960585c25',
  'formal L40 levels.js SHA changed');
const candidateUnits=p204.candidateUnits;
assert.deepEqual(candidateUnits,{infantry:[7,5,3],archer:[7,5,3],
  cavalry_t1:[7,5,3],mage_t1:[7,5]});

function boot(save,saveSha,label){
  assert.equal(sha(save),saveSha,`${label}: save SHA`);
  const run=environment({rts_save:save}).run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}: load`);
  assert.equal(run('saveProtected()'),false,`${label}: save protected`);
  run(`globalThis.__p206Timers=new Map();globalThis.__p206TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p206TimerId++;
      __p206Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p206Timers.delete(id);
    globalThis.__p206Step=()=>{const next=__p206Timers.entries().next().value;
      if(!next)return false;__p206Timers.delete(next[0]);next[1]();return true};
    globalThis.__p206Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p206Nodes.has(id))__p206Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p206Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return run;
}
function verifyFormalBoss(run,profile){
  const current=plain(run('CFG.enemies[39]'));
  const historical=profile.stages.find(s=>s.stage===40).enemy;
  assert.equal(current.id,40);
  assert.deepEqual(current.units,candidateUnits,'formal L40 roster');
  for(const key of ['id','name','reward','drops'])
    assert.deepEqual(current[key],historical[key],`formal L40 ${key}`);
  assert.equal(!!current.boss,historical.boss);
  return current;
}
function owned(run,type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function checkpoint(run){return plain(run(`({tick:S.tick,resources:{...S.res},
  pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue)),
  formation:JSON.parse(JSON.stringify(S.formation)),defeated:[...S.defeated],
  essence:{...S.essence},merit:S.merit,workers:{...S.popAlloc},
  population:JSON.parse(JSON.stringify(S.population)),
  settlements:JSON.parse(JSON.stringify(S.settlements)),
  buildings:JSON.parse(JSON.stringify(S.buildings)),
  sciences:[...S.sciences],upgradedUnits:{...S.upgradedUnits},
  army:armyCount(),upkeepPerSecond:totalUpkeep(),
  caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
  slots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')},
  regMax:regMax()})`))}
function compact(run){const s=checkpoint(run);return{
  tick:s.tick,resources:s.resources,merit:s.merit,workers:s.workers,
  army:s.army,upkeepPerSecond:s.upkeepPerSecond,caps:s.caps,
  slots:s.slots,regMax:s.regMax,population:run('popCurrent()'),
  capacity:run('maxPop()'),defeatedCount:s.defeated.length,
  owned:Object.fromEntries(['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
    .map(type=>[type,owned(run,type)])),queue:s.queue};}
function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}: save`);
  const save=run("localStorage.getItem('rts_save')");
  const next=boot(save,sha(save),`${label}: reload`);
  assert.deepEqual(checkpoint(next),checkpoint(run),`${label}: persisted state`);
  return{run:next,save,saveSha256:sha(save)};
}
function setRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p206Rng=${initial};Math.random=()=>{
    let x=__p206Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p206Rng=x>>>0;return __p206Rng/4294967296;}`);
}
function fight(run,stage,seed,targets,label){
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:stage-1},(_,i)=>i+1),`${label}: sequential wins`);
  const before=compact(run),preOwned=Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)]));
  const beforeRes=plain(run('({...S.res})')),
    beforeEssence=plain(run('({...S.essence})'));
  setRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`${label}: open`);
  const enemy=plain(run(`({id:B.enemyCfg.id,name:B.enemyCfg.name,
    units:B.enemyCfg.units,boss:!!B.enemyCfg.boss,
    groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
    reward:B.enemyCfg.reward})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p206Step()'),true,`${label}: callback`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}: settled`);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const afterRes=plain(run('({...S.res})')),
    afterEssence=plain(run('({...S.essence})'));
  run('exitBattle()');
  const loaded=reload(run,label);
  const lossByType=Object.fromEntries(Object.entries(preOwned)
    .map(([type,n])=>[type,n-owned(loaded.run,type)]));
  assert.ok(Object.values(lossByType).every(n=>n>=0));
  const actualReward=Object.fromEntries(Object.keys(enemy.reward)
    .map(key=>[key,afterRes[key]-beforeRes[key]]));
  const essenceDelta=Object.fromEntries(Object.keys(afterEssence)
    .filter(key=>afterEssence[key]!==beforeEssence[key])
    .map(key=>[key,afterEssence[key]-(beforeEssence[key]||0)]));
  if(!won){assert.ok(Object.values(actualReward).every(n=>n===0));
    assert.deepEqual(essenceDelta,{});}
  return{run:loaded.run,record:{before,enemy,won,round,callbacks,
    lossByType,lossTotal:Object.values(lossByType).reduce((n,v)=>n+v,0),
    actualReward,essenceDelta,post:compact(loaded.run)},
    save:loaded.save,saveSha256:loaded.saveSha256};
}
function economy(run){return plain(run(`({foodOutput:prodRate('food'),
  populationFood:popCurrent()*(CFG.popFoodCost??0.1),
  upkeep:totalUpkeep(),
  netFood:prodRate('food')-popCurrent()*(CFG.popFoodCost??0.1)-totalUpkeep(),
  rates:{wood:prodRate('wood'),stone:prodRate('stone'),food:prodRate('food'),
    coal:prodRate('coal'),copper:prodRate('copper')},
  army:armyCount(),food:S.res.food})`));}
function recover(run,targets,label){
  const before=compact(run),requested={},produced={},paid={},paused={};
  const economyBefore=economy(run);
  let minFood=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const resources=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)return{ready:false,seconds:0,before,
      requested,produced,paid,paused,minFood,economyBefore,
      economyAfter:economy(run),after:compact(run),
      block:{type,action,lock:run(`trainLockReason('${type}')`),
        cap:run(`unitCap('${type}')`),have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),resources,
      `${label}: queue must not prepay`);
    produced[type]=0;
  }
  const ready=()=>Object.entries(targets).every(([type,n])=>owned(run,type)>=n);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const k=`${type}: ${q.reason}`;
        paused[k]=(paused[k]||0)+1;}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`${label}: unexpected queue`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,cost] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        paid[rk]=(paid[rk]||0)+made*cost;
    }
  }
  const result={ready:ready(),seconds,before,requested,produced,paid,
    paused,minFood,economyBefore,economyAfter:economy(run),after:compact(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`${label}: actual paid production`);
  else result.block={reason:'7200-second-recovery-limit',queue:plain(run('S.queue')),
    deficits:Object.fromEntries(Object.entries(targets).map(([type,n])=>
      [type,Math.max(0,n-owned(run,type))]))};
  return result;
}
function place(run,row,type,count,index){
  assert.ok(run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
    S.formation.${row}[${index}]?.count===${count}`),true);
}
function form(run,targets,label){
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15,`${label}: regiment cap`);
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'front','infantry_t1',15,2);
  place(run,'back','archer_t1',13,0);
  place(run,'back','archer_t1',15,1);
  const deployed=plain(run(`Object.fromEntries(['bronze_guard','cavalry_t1',
    'infantry_t1','archer_t1'].map(type=>[type,['front','mid','back']
    .flatMap(row=>S.formation[row]).filter(u=>u.type===type)
    .reduce((n,u)=>n+u.count,0)]))`));
  assert.deepEqual(deployed,targets,`${label}: deployed counts`);
  return{deployed,formation:plain(run('S.formation'))};
}
function withoutSavedText(record,saveKey,shaKey){
  const result={...record};
  delete result[saveKey];delete result[shaKey];
  return result;
}
function formationWithoutIds(form){
  return Object.fromEntries(['front','mid','back'].map(row=>
    [row,form[row].map(u=>({type:u.type,count:u.count}))]));
}
function route(profile,seed){
  const stage=profile.stages.find(s=>s.stage===40);
  assert.ok(stage?.prepared?.save,'P202 L40 source missing');
  const label=`P202来源${profile.seed}／战斗流${seed}`;
  let run=boot(stage.prepared.save,stage.prepared.saveSha256,label);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:39},(_,i)=>i+1),`${label}: old wins`);
  const targets={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28};
  assert.deepEqual(profile.targets,targets);
  assert.deepEqual(Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)])),targets,`${label}: old paid army`);
  const formalL41=plain(run('CFG.enemies[40]'));
  assert.equal(formalL41.id,41);
  verifyFormalBoss(run,profile);
  const expected=p204.cases.find(c=>c.sourceSeed===profile.seed&&c.seed===seed);
  assert.ok(expected,`${label}: P204 expected route`);
  assert.equal(stage.prepared.saveSha256,expected.sourceSaveSha256);
  const l40=fight(run,40,seed,targets,`${label} L40 formal`);
  assert.deepEqual(l40.record.enemy.units,candidateUnits);
  assert.deepEqual(l40.record,
    withoutSavedText(expected.l40,'postSave','postSaveSha256'),
    `${label}: formal L40 differs from P204 candidate`);
  assert.equal(l40.record.won,true);
  run=l40.run;
  verifyFormalBoss(run,profile);
  const refill=recover(run,targets,`${label} L41 recovery`);
  assert.deepEqual(refill,expected.refill,
    `${label}: formal paid recovery differs from P204`);
  assert.equal(refill.ready,true);
  let prepared=reload(run,`${label} L41 refill`);
  run=prepared.run;
  const formed=form(run,targets,`${label} L41`);
  assert.deepEqual(formed.deployed,expected.formed.deployed);
  assert.deepEqual(formationWithoutIds(formed.formation),
    formationWithoutIds(expected.formed.formation));
  prepared=reload(run,`${label} L41 formation`);
  run=prepared.run;
  assert.equal(run('armyCount()'),73);
  assert.deepEqual(plain(run('CFG.enemies[40]')),formalL41,
    `${label}: L41 must retain formal CFG`);
  assert.equal(sha(expected.l41Prepared.save),
    expected.l41Prepared.saveSha256,`${label}: P204 L41 prepared save SHA`);
  const oldPrepared=boot(expected.l41Prepared.save,
    expected.l41Prepared.saveSha256,`${label}: P204 L41 prepared`);
  const preparedState=compact(run);
  assert.deepEqual(preparedState,compact(oldPrepared),
    `${label}: L41 prepared save differs from P204`);
  const l41=fight(run,41,seed,targets,`${label} L41 formal`);
  assert.deepEqual(l41.record,
    withoutSavedText(expected.l41,'postSave','postSaveSha256'),
    `${label}: formal L41 differs from P204`);
  assert.equal(l41.record.won,true);
  return{sourceSeed:profile.seed,seed,targets,
    sourceSaveSha256:stage.prepared.saveSha256,
    l40:{...l40.record,postSaveSha256:l40.saveSha256,postSave:l40.save},
    refill,formed,l41Prepared:{state:preparedState,
      saveSha256:prepared.saveSha256,save:prepared.save},
    l41:{...l41.record,postSaveSha256:l41.saveSha256,
      postSave:l41.save},
    matchedP204:true,block:null};
}
function legacyLoad(caseRecord,stage,save,saveSha){
  const label=`legacy ${caseRecord.sourceSeed}/${caseRecord.seed} after L${stage}`;
  const original=JSON.parse(save);
  const run=boot(save,saveSha,label);
  assert.equal(run('S.defeated.includes(40)'),true,`${label}: L40 completion`);
  assert.deepEqual(plain(run('S.res')),original.res,`${label}: resources`);
  assert.deepEqual(plain(run('S.essence')),original.essence,`${label}: essence`);
  assert.deepEqual(plain(run('S.defeated')),original.defeated,`${label}: wins`);
  assert.deepEqual(plain(run('S.formation')),original.formation,
    `${label}: formation`);
  const reloaded=reload(run,label);
  return{sourceSeed:caseRecord.sourceSeed,seed:caseRecord.seed,
    origin:'P204 isolated candidate artifact',
    completedStage:stage,sourceSaveSha256:saveSha,
    defeatedCount:reloaded.run('S.defeated.length'),
    army:reloaded.run('armyCount()'),resources:plain(reloaded.run('S.res')),
    essence:plain(reloaded.run('S.essence'))};
}
function priorFormalWin(profile){
  const stage=profile.stages.find(s=>s.stage===40);
  assert.ok(stage?.prepared?.save&&stage.battle?.won,
    `P202 source ${profile.seed}: old formal L40 evidence`);
  const label=`P202旧正式L40来源${profile.seed}`;
  let run=boot(stage.prepared.save,stage.prepared.saveSha256,label);
  const formal=verifyFormalBoss(run,profile);
  const oldUnits=stage.enemy.units;
  assert.deepEqual(oldUnits,{infantry:[1,1,1],archer:[1,1,1],
    cavalry_t1:[1,1,1],mage_t1:[1,1]},`${label}: original roster`);
  // Historical replay only: restore the previous official L40 roster in this VM.
  run(`CFG.enemies[39].units=${JSON.stringify(oldUnits)}`);
  const original=plain(run('CFG.enemies[39]'));
  assert.deepEqual(original.units,oldUnits);
  const unchanged={...original},current={...formal};
  delete unchanged.units;delete current.units;
  assert.deepEqual(unchanged,current,`${label}: no other CFG field changed`);
  const targets=profile.targets;
  const fought=fight(run,40,profile.seed,targets,`${label}: old roster battle`);
  const expected=stage.battle;
  assert.equal(expected.winner,null,`${label}: P202 winner marker`);
  for(const key of ['won','round','callbacks','lossByType',
    'lossTotal','actualReward','essenceDelta','post'])
    assert.deepEqual(fought.record[key],expected[key],
      `${label}: P202 historical ${key}`);
  assert.equal(fought.record.enemy.hp,stage.enemy.stats.totalHp);
  assert.equal(fought.record.enemy.attackMass,stage.enemy.stats.attackMass);
  assert.equal(fought.record.enemy.groups,stage.enemy.stats.groups);
  const historicalSave=JSON.parse(fought.save);
  run=boot(fought.save,fought.saveSha256,`${label}: load under formal L40`);
  verifyFormalBoss(run,profile);
  assert.equal(run('S.defeated.filter(id=>id===40).length'),1,
    `${label}: no duplicated L40 win`);
  assert.deepEqual(plain(run('S.res')),historicalSave.res,
    `${label}: resources preserved`);
  assert.deepEqual(plain(run('S.essence')),historicalSave.essence,
    `${label}: essence preserved`);
  assert.deepEqual(plain(run('S.defeated')),historicalSave.defeated,
    `${label}: victories preserved`);
  assert.deepEqual(plain(run('S.pool')),historicalSave.pool,
    `${label}: soldiers preserved`);
  assert.deepEqual(plain(run('S.formation')),historicalSave.formation,
    `${label}: formation preserved`);
  assert.equal(run('S.merit'),historicalSave.merit,
    `${label}: merit preserved`);
  const loaded=compact(run);
  const roundtrip=reload(run,`${label}: formal save roundtrip`);
  assert.deepEqual(compact(roundtrip.run),loaded,
    `${label}: formal roundtrip unchanged`);
  return{sourceKind:'P202 previous official L40 roster',seed:profile.seed,
    sourcePreBattleSha256:stage.prepared.saveSha256,
    oldUnits,oldBattle:{...fought.record,
      postSaveSha256:fought.saveSha256,postSave:fought.save},
    expectedP202BattleSha256:expected.postSaveSha256,
    loadedUnderFormal:{state:loaded,
      roundtripSaveSha256:roundtrip.saveSha256},
    matchedP202:true};
}
const profiles=p202.profiles.filter(p=>p.sourceKind==='P194'&&[1,15].includes(p.seed));
assert.equal(profiles.length,2);
const cases=profiles.flatMap(profile=>[profile.seed,14].map(seed=>route(profile,seed)));
assert.deepEqual(cases.map(c=>[c.sourceSeed,c.seed]),
  [[1,1],[1,14],[15,15],[15,14]]);
const candidateArtifactSaves=p204.cases.flatMap(c=>[
  legacyLoad(c,40,c.l40.postSave,c.l40.postSaveSha256),
  legacyLoad(c,41,c.l41.postSave,c.l41.postSaveSha256)]);
assert.equal(candidateArtifactSaves.length,8);
const priorFormalWins=profiles.map(priorFormalWin);
assert.equal(priorFormalWins.length,2);
const result={batch:'P206',unit:'simulated online seconds',
  scope:'Current formal L40 CFG direct replay from two paid P202 pre-battle saves; 4 P204 streams and paid L41 handoff. Separate historical old-roster VM replay creates two actual prior-official L40 win saves and loads them under current CFG. 8 P204 isolated-candidate saves also load.',
  inputs,formalUnits:candidateUnits,cases,candidateArtifactSaves,priorFormalWins};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P206',inputs,
  candidateArtifactsLoaded:candidateArtifactSaves.length,
  priorFormalWins:priorFormalWins.map(x=>({seed:x.seed,
    matchedP202:x.matchedP202,won:x.oldBattle.won,
    loss:x.oldBattle.lossTotal,armyOnFormalLoad:x.loadedUnderFormal.state.army})),
  matchedP204:cases.every(c=>c.matchedP204),cases:cases.map(c=>({
  sourceSeed:c.sourceSeed,seed:c.seed,
  l40:{won:c.l40.won,round:c.l40.round,loss:c.l40.lossTotal},
  refill:{ready:c.refill?.ready,seconds:c.refill?.seconds,
    minFood:c.refill?.minFood,paid:c.refill?.paid,paused:c.refill?.paused},
  l41:c.l41&&{won:c.l41.won,round:c.l41.round,loss:c.l41.lossTotal},
  block:c.block}))},null,2));
