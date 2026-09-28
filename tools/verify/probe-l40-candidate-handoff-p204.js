'use strict';
// P204: paid L40 [7,5,3] candidate recovery and current-CFG L41 handoff.
// P202/P203 artifacts are immutable data inputs; only isolated VM L40 units change.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const p202Text=fs.readFileSync(path.join(dataDir,'p202-fourth-chapter-paid.json'),'utf8');
const p203Text=fs.readFileSync(path.join(dataDir,'p203-l40-boss-sensitivity.json'),'utf8');
const p202=JSON.parse(p202Text),p203=JSON.parse(p203Text);
const outputPath=path.join(dataDir,'p204-l40-candidate-handoff.json');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(p202.batch,'P202');
assert.equal(p203.batch,'P203');
assert.equal(sha(p202Text),p203.inputs.p202,'P203 must use this exact P202 artifact');
const inputs={p202:sha(p202Text),p203:sha(p203Text),
  levels:sha(fs.readFileSync(path.join(root,'levels.js'))),
  math:sha(fs.readFileSync(path.join(root,'math.js'))),
  config:sha(fs.readFileSync(path.join(root,'config.js'))),
  technology:sha(fs.readFileSync(path.join(root,'technology.js')))};
for(const file of ['levels','math','config','technology'])
  assert.equal(inputs[file],p203.inputs[file],`P203 ${file} baseline changed`);
const candidateUnits={infantry:[7,5,3],archer:[7,5,3],
  cavalry_t1:[7,5,3],mage_t1:[7,5]};

function boot(save,saveSha,label){
  assert.equal(sha(save),saveSha,`${label}: save SHA`);
  const run=environment({rts_save:save}).run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}: load`);
  assert.equal(run('saveProtected()'),false,`${label}: save protected`);
  run(`globalThis.__p204Timers=new Map();globalThis.__p204TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p204TimerId++;
      __p204Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p204Timers.delete(id);
    globalThis.__p204Step=()=>{const next=__p204Timers.entries().next().value;
      if(!next)return false;__p204Timers.delete(next[0]);next[1]();return true};
    globalThis.__p204Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p204Nodes.has(id))__p204Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p204Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return run;
}
function installCandidate(run){
  const before=plain(run('CFG.enemies[39]'));
  assert.equal(before.id,40);
  run(`CFG.enemies[39].units=${JSON.stringify(candidateUnits)}`);
  const after=plain(run('CFG.enemies[39]'));
  assert.deepEqual(after.units,candidateUnits);
  delete before.units;delete after.units;
  assert.deepEqual(after,before,'candidate may change only L40 roster');
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
  run(`globalThis.__p204Rng=${initial};Math.random=()=>{
    let x=__p204Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p204Rng=x>>>0;return __p204Rng/4294967296;}`);
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
    assert.equal(run('__p204Step()'),true,`${label}: callback`);
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
  installCandidate(run);
  const l40=fight(run,40,seed,targets,`${label} L40 candidate`);
  assert.deepEqual(l40.record.enemy.units,candidateUnits);
  const expected=p203.outcomes.find(o=>o.sourceSeed===profile.seed&&
    o.variant==='7-5-3'&&o.seed===seed);
  assert.ok(expected,`${label}: P203 expected result`);
  assert.deepEqual({won:l40.record.won,round:l40.record.round,
    loss:l40.record.lossTotal,callbacks:l40.record.callbacks,
    actualReward:l40.record.actualReward,essenceDelta:l40.record.essenceDelta},
  {won:expected.won,round:expected.round,loss:expected.loss,
    callbacks:expected.callbacks,actualReward:expected.actualReward,
    essenceDelta:expected.essenceDelta},`${label}: P203 candidate mismatch`);
  if(!l40.record.won)return{sourceSeed:profile.seed,seed,targets,
    sourceSaveSha256:stage.prepared.saveSha256,l40:{...l40.record,
      postSaveSha256:l40.saveSha256,postSave:l40.save},
    block:{stage:40,phase:'battle'}};
  run=l40.run;
  // Reload starts with the actual current L40 roster again; L41 remains formal CFG.
  assert.deepEqual(plain(run('CFG.enemies[39].units')),
    {infantry:[1,1,1],archer:[1,1,1],
      cavalry_t1:[1,1,1],mage_t1:[1,1]});
  const refill=recover(run,targets,`${label} L41 recovery`);
  if(!refill.ready)return{sourceSeed:profile.seed,seed,targets,
    sourceSaveSha256:stage.prepared.saveSha256,
    l40:{...l40.record,postSaveSha256:l40.saveSha256,postSave:l40.save},
    refill,block:{stage:41,phase:'paid-recovery'}};
  let prepared=reload(run,`${label} L41 refill`);
  run=prepared.run;
  const formed=form(run,targets,`${label} L41`);
  prepared=reload(run,`${label} L41 formation`);
  run=prepared.run;
  assert.equal(run('armyCount()'),73);
  assert.deepEqual(plain(run('CFG.enemies[40]')),formalL41,
    `${label}: L41 must retain formal CFG`);
  const l41=fight(run,41,seed,targets,`${label} L41 formal`);
  return{sourceSeed:profile.seed,seed,targets,
    sourceSaveSha256:stage.prepared.saveSha256,
    l40:{...l40.record,postSaveSha256:l40.saveSha256,postSave:l40.save},
    refill,formed,l41Prepared:{state:compact(run),
      saveSha256:prepared.saveSha256,save:prepared.save},
    l41:{...l41.record,postSaveSha256:l41.saveSha256,
      postSave:l41.save},
    block:l41.record.won?null:{stage:41,phase:'battle'}};
}
const profiles=p202.profiles.filter(p=>p.sourceKind==='P194'&&[1,15].includes(p.seed));
assert.equal(profiles.length,2);
const cases=profiles.flatMap(profile=>[profile.seed,14].map(seed=>route(profile,seed)));
assert.deepEqual(cases.map(c=>[c.sourceSeed,c.seed]),
  [[1,1],[1,14],[15,15],[15,14]]);
const result={batch:'P204',unit:'simulated online seconds',
  scope:'Two paid P202 L40 pre-battle saves; L40 [7,5,3] isolated roster; seeds 1/15/14; real battle, save/reload, paid training up to 7200s, formal L41.',
  inputs,candidateUnits,cases};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P204',inputs,cases:cases.map(c=>({
  sourceSeed:c.sourceSeed,seed:c.seed,
  l40:{won:c.l40.won,round:c.l40.round,loss:c.l40.lossTotal},
  refill:{ready:c.refill?.ready,seconds:c.refill?.seconds,
    minFood:c.refill?.minFood,paid:c.refill?.paid,paused:c.refill?.paused},
  l41:c.l41&&{won:c.l41.won,round:c.l41.round,loss:c.l41.lossTotal},
  block:c.block}))},null,2));
