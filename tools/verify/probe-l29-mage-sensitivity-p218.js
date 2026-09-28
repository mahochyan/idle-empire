'use strict';
// P218: isolated L29 enemy mage-wave sensitivity on two paid P201 prebattle saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const outputPath=path.join(root,'docs/codex/reports/data/p218-l29-mage-sensitivity.json');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const baselinePath=path.join(root,'docs/codex/reports/data/p215-live-l29-order-sweep.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
const plans={
  original:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]],
  frontReverse:[['front','infantry_t1',15],['front','cavalry_wind',15],
    ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]]
};
// All candidates retain three mage groups except the formal unchanged control.
const candidates=[
  {key:'current',mage:[13,10,6],description:'formal L29 unchanged'},
  {key:'mage26',mage:[12,9,5],description:'same each-group size as L28'},
  {key:'mage24',mage:[11,8,5],description:'one-step lighter first mage wave'},
  {key:'mage21',mage:[10,7,4],description:'three-group middle reduction'},
  {key:'mage18',mage:[8,6,4],description:'three-group lower-bound probe'}
];
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'docs/codex/reports/data/p215-live-l29-order-sweep.json',
  'tools/verify/probe-l29-mage-sensitivity-p218.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P201');
assert.equal(baseline.batch,'P215');
assert.equal(baseline.inputs.find(x=>x.file==='math.js')?.sha256,
  inputs.find(x=>x.file==='math.js').sha256,'P215 battle engine is stale');
assert.equal(baseline.inputs.find(x=>x.file==='levels.js')?.sha256,
  inputs.find(x=>x.file==='levels.js').sha256,'P215 levels are stale');
assert.equal(baseline.inputs.find(x=>x.file==='config.js')?.sha256,
  inputs.find(x=>x.file==='config.js').sha256,'P215 config is stale');

function sourceCase(sourceSeed){
  const profile=source.profiles.find(p=>p.seed===sourceSeed&&p.route==='t2SecondBack73');
  const stage=profile?.stages.find(s=>s.stage===29);
  assert.ok(stage?.l29PreparedSave);
  assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
  return {sourceSeed,save:stage.l29PreparedSave,sha256:stage.beforeSaveSha256};
}
const sources=[sourceCase(1),sourceCase(15)];
assert.deepEqual(sources.map(x=>({sourceSeed:x.sourceSeed,sha256:x.sha256})),
  baseline.sourceFacts.map(x=>({sourceSeed:x.sourceSeed,sha256:x.sha256})));
// Keep save timestamps and formation IDs reproducible. This is only the VM clock;
// online time still advances solely through explicit tick() calls in refill().
const fixedEpoch=Math.max(...sources.map(x=>JSON.parse(x.save).ts))+1;
Date.now=()=>fixedEpoch;

function installHarness(run){
  run(`globalThis.__p218Timers=new Map();globalThis.__p218TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p218TimerId++;
      __p218Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p218Timers.delete(id);
    globalThis.__p218Step=()=>{const next=__p218Timers.entries().next().value;
      if(!next)return false;__p218Timers.delete(next[0]);next[1]();return true};
    globalThis.__p218Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p218Nodes.has(id))__p218Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p218Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save){
  const world=environment({rts_save:save});
  const run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installHarness(run);
  return {world,run};
}
function snapshot(run){
  return plain(run(`({tick:S.tick,lastCleared:S.defeated.at(-1),
    resources:{...S.res},merit:S.merit,army:armyCount(),
    owned:Object.fromEntries(['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
      .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),formation:Object.fromEntries(
      ['front','mid','back'].map(row=>[row,S.formation[row]
        .map(u=>({type:u.type,count:u.count}))])),
    foodRate:prodRate('food'),upkeep:totalUpkeep()})`));
}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label}: save failed`);
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=restore(save);
  assert.deepEqual(snapshot(next.run),before,`${label}: reload changed state`);
  return {...next,save,sha256:sha(save)};
}
function formation(run){
  return plain(run(`Object.fromEntries(['front','mid','back'].map(row=>
    [row,S.formation[row].map(u=>({type:u.type,count:u.count}))]))`));
}
function formByActions(run,planKey){
  const before=snapshot(run),placements=plans[planKey];
  assert.deepEqual(before.owned,targets);
  assert.equal(before.army,73);
  assert.equal(before.lastCleared,28);
  run("clrForm('expedition')");
  const expected={front:[],mid:[],back:[]};
  for(const [row,type,count] of placements){
    const index=expected[row].length;
    assert.ok(index<run(`rowSlots('${row}')`));
    assert.ok(count<=run('regMax()'));
    assert.ok(run(`poolAvail('${type}')`)>=count);
    run(`openFormModal('expedition','${row}',${index})`);
    assert.equal(run(`document.getElementById('form-modal-content').innerHTML
      .includes('data-type="${type}"')`),true);
    run(`selModalUnit({classList:{add(){}}},'${type}',poolAvail('${type}'));
      setModalQty(${count});confirmForm()`);
    expected[row].push({type,count});
    assert.deepEqual(formation(run)[row],expected[row]);
  }
  const after=snapshot(run);
  assert.deepEqual(after.formation,expected);
  assert.deepEqual(after.owned,before.owned);
  assert.deepEqual(after.resources,before.resources);
  assert.deepEqual(after.queue,before.queue);
  return after;
}
const prepared=[];
for(const item of sources)for(const plan of Object.keys(plans)){
  let active=restore(item.save);
  const state=formByActions(active.run,plan);
  active=saveReload(active,`source${item.sourceSeed}/${plan} prepared`);
  prepared.push({sourceSeed:item.sourceSeed,plan,save:active.save,
    sha256:active.sha256,state});
}

function patchOnlyMage(run,candidate){
  const official=plain(run('CFG.enemies[28]'));
  assert.deepEqual(official.units.mage_t1,[13,10,6]);
  if(candidate.key!=='current')
    run(`CFG.enemies[28].units.mage_t1=${JSON.stringify(candidate.mage)}`);
  const candidateEnemy=plain(run('CFG.enemies[28]'));
  assert.deepEqual({...candidateEnemy,units:{...candidateEnemy.units,mage_t1:official.units.mage_t1}},official,
    'candidate changed field other than mage_t1 counts');
  assert.deepEqual(candidateEnemy.units.mage_t1,candidate.mage);
  return {official,candidateEnemy};
}
function seedRng(run,flow){
  const initial=(flow*1009+29*9176)>>>0;
  run(`globalThis.__p218Rng=${initial};globalThis.__p218Draws=0;
    Math.random=()=>{__p218Draws++;let x=__p218Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;
      __p218Rng=x>>>0;return __p218Rng/4294967296}`);
}
function initialEnemy(run){
  return plain(run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((s,u)=>s+(u.maxHp||0),0),
    attackMass:B.enemyUnits.reduce((s,u)=>s+u.atk*combatAttackMass(u),0),
    mageGroups:B.enemyUnits.filter(u=>u.type==='mage_t1').length,
    mageHp:B.enemyUnits.filter(u=>u.type==='mage_t1')
      .reduce((s,u)=>s+(u.maxHp||0),0),
    mageAttackMass:B.enemyUnits.filter(u=>u.type==='mage_t1')
      .reduce((s,u)=>s+u.atk*combatAttackMass(u),0)})`));
}
function fight(active,flow){
  const run=active.run;
  const before=snapshot(run);
  assert.equal(before.lastCleared,28);
  assert.deepEqual(before.owned,targets);
  seedRng(run,flow);
  run('selEnemy(28);openBattle()');
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('B.tactic.name'),'稳扎稳打');
  const enemy=initialEnemy(run);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p218Step()'),true,'async battle callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle did not settle');
  const won=run('S.defeated.includes(29)');
  const round=run('B.round');
  const enemyHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)');
  const rngDraws=run('__p218Draws');
  const after=snapshot(run);
  const losses=Object.fromEntries(Object.entries(targets)
    .map(([type,count])=>[type,count-after.owned[type]]));
  for(const [type,count] of Object.entries(losses))
    assert.ok(count>=0&&count<=targets[type]);
  const lossTotal=Object.values(losses).reduce((a,b)=>a+b,0);
  assert.equal(lossTotal,before.army-after.army);
  run('exitBattle()');
  active=saveReload(active,`flow${flow} settled`);
  return {won,round,callbacks,enemyHp,rngDraws,initialEnemy:enemy,
    losses,lossTotal,before,after,postSave:active.save,
    postSaveSha256:active.sha256};
}
function staticPanel(stage,candidate=null){
  const active=restore(sources[0].save),run=active.run;
  if(candidate)patchOnlyMage(run,candidate);
  run(`B.isTraining=false;S.battleEncounter=null;S.selEnemy=${stage-1};initBattleState()`);
  return {stage,enemy:plain(run(`({id:CFG.enemies[${stage-1}].id,
    name:CFG.enemies[${stage-1}].name,
    units:CFG.enemies[${stage-1}].units,
    boss:!!CFG.enemies[${stage-1}].boss,
    reward:CFG.enemies[${stage-1}].reward})`)),...initialEnemy(run)};
}
const staticContext={l28:staticPanel(28),l30:staticPanel(30),l31:staticPanel(31),
  candidates:candidates.map(candidate=>({key:candidate.key,...staticPanel(29,candidate)}))};
assert.equal(staticContext.l28.hp,78);
assert.equal(staticContext.l28.attackMass,702);
assert.equal(staticContext.l30.hp,49);
assert.equal(staticContext.l30.attackMass,641);
assert.equal(staticContext.l31.hp,9);
assert.equal(staticContext.l31.attackMass,36);
assert.equal(staticContext.candidates[0].hp,116);
assert.equal(staticContext.candidates[0].attackMass,1131);

const trialResults=[];
const recoverySaves=new Map();
for(const candidate of candidates)for(const preparedCase of prepared)
  for(let flow=1;flow<=16;flow++){
    let active=restore(preparedCase.save);
    patchOnlyMage(active.run,candidate);
    const battle=fight(active,flow);
    const trial={candidate:candidate.key,sourceSeed:preparedCase.sourceSeed,
      plan:preparedCase.plan,flow,preparedSha256:preparedCase.sha256,
      won:battle.won,round:battle.round,enemyHp:battle.enemyHp,
      rngDraws:battle.rngDraws,losses:battle.losses,lossTotal:battle.lossTotal,
      initialEnemy:battle.initialEnemy,postSaveSha256:battle.postSaveSha256,
      after:{resources:battle.after.resources,army:battle.after.army,
        lastCleared:battle.after.lastCleared}};
    trialResults.push(trial);
    if(preparedCase.sourceSeed===1&&preparedCase.plan==='frontReverse'&&flow===8)
      recoverySaves.set(candidate.key,battle.postSave);
  }
for(const candidate of candidates)for(const plan of Object.keys(plans))
  for(let flow=1;flow<=16;flow++){
    const a=trialResults.find(x=>x.candidate===candidate.key&&x.plan===plan&&
      x.flow===flow&&x.sourceSeed===1);
    const b=trialResults.find(x=>x.candidate===candidate.key&&x.plan===plan&&
      x.flow===flow&&x.sourceSeed===15);
    assert.deepEqual({won:a.won,round:a.round,enemyHp:a.enemyHp,
      losses:a.losses,initialEnemy:a.initialEnemy,rngDraws:a.rngDraws},
    {won:b.won,round:b.round,enemyHp:b.enemyHp,
      losses:b.losses,initialEnemy:b.initialEnemy,rngDraws:b.rngDraws},
    `paid-source crosscheck differs: ${candidate.key}/${plan}/${flow}`);
  }
for(const row of baseline.paired)for(const plan of Object.keys(plans)){
  const actual=trialResults.find(x=>x.candidate==='current'&&x.sourceSeed===1&&
    x.plan===plan&&x.flow===row.flow);
  assert.deepEqual({won:actual.won,loss:actual.lossTotal,enemyHp:actual.enemyHp},
    row[plan],`P215 baseline mismatch: ${plan}/${row.flow}`);
}

function refill(save){
  let active=restore(save);
  const run=active.run,before=snapshot(run),requested={},produced={},due={},paused={};
  let minFood=before.resources.food;
  for(const [type,target] of Object.entries(targets)){
    const have=before.owned[type],queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'');
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok,true);
    assert.equal(action.qty,need);
    produced[type]=0;
  }
  run(`globalThis.__p218Paid=[];globalThis.__p218OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p218OriginalPay(cost,n);
      __p218Paid.push({type,count:n,cost:{...cost}})}`);
  const ready=()=>Object.entries(targets).every(([type,target])=>
    run(`(S.pool.${type}||0)+expeditionCount('${type}')+garrisonCount('${type}')`)>=target);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    const next=plain(run('S.queue'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        paused[key]=(paused[key]||0)+1;}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p218Paid'));
  for(const item of paid)for(const [rk,cost] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+cost*item.count;
  assert.equal(ready(),true,'selected flow 8 did not refill in 7200 simulated seconds');
  for(const [type,count] of Object.entries(requested))
    assert.equal(produced[type]||0,count);
  active=saveReload(active,'flow8 recovery');
  return {requested,produced,due,paused,seconds,minFood,
    before:{food:before.resources.food,army:before.army},
    after:{food:snapshot(active.run).resources.food,army:snapshot(active.run).army},
    replenishedSaveSha256:active.sha256};
}
const recoveries=candidates.map(candidate=>({candidate:candidate.key,sourceSeed:1,
  plan:'frontReverse',flow:8,...refill(recoverySaves.get(candidate.key))}));
assert.equal(recoveries[0].seconds,baseline.recovery.replenishment.seconds);
assert.deepEqual(recoveries[0].due,baseline.recovery.replenishment.due);

const unitCosts=plain(restore(sources[0].save).run(`Object.fromEntries(
  ['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
    .map(k=>[k,CFG.units[k].cost]))`));
function dueFor(losses){
  const due={};
  for(const [type,count] of Object.entries(losses))
    for(const [resource,cost] of Object.entries(unitCosts[type]))
      due[resource]=(due[resource]||0)+count*cost;
  return due;
}
for(const trial of trialResults)trial.rebuildBill=dueFor(trial.losses);
const summaries=candidates.map(candidate=>{
  const byPlan={};
  for(const plan of Object.keys(plans)){
    const rows=trialResults.filter(x=>x.candidate===candidate.key&&
      x.sourceSeed===1&&x.plan===plan);
    const losses=rows.map(x=>x.lossTotal).sort((a,b)=>a-b);
    byPlan[plan]={wins:rows.filter(x=>x.won).length,
      fullLossFlows:rows.filter(x=>x.lossTotal===73).map(x=>x.flow),
      meanLoss:Number((losses.reduce((a,b)=>a+b,0)/losses.length).toFixed(3)),
      medianLoss:(losses[7]+losses[8])/2,
      minLoss:losses[0],maxLoss:losses.at(-1),
      totalFoodBill:rows.reduce((n,x)=>n+(x.rebuildBill.food||0),0),
      meanFoodBill:rows.reduce((n,x)=>n+(x.rebuildBill.food||0),0)/rows.length};
  }
  return {candidate:candidate.key,mage:candidate.mage,
    pressure:staticContext.candidates.find(x=>x.key===candidate.key),
    byPlan,flow8Recovery:recoveries.find(x=>x.candidate===candidate.key)};
});
for(const item of inputs.filter(x=>['config.js','levels.js','math.js','garrison.js'].includes(x.file)))
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `${item.file} changed during probe`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P218',sourceHead:head.stdout.trim(),
  scope:{source:'P201 t2SecondBack73 two complete paid L29 prebattle saves',
    baseline:'P215 current post-sort 16 flows',fixedFlows:'1..16',
    rng:'xorshift32 (flow*1009+29*9176)>>>0',
    uniqueStreams:16,sourceCrosschecks:2,trialCount:trialResults.length,
    runtime:{node:process.version,platform:process.platform,nodeVmOnly:true,
      fixedVmNowMs:fixedEpoch},
    mutation:'Only CFG.enemies[28].units.mage_t1 in each isolated VM; no official source or rts_save schema edit.',
    fixedStreamNotPlayerWinRate:true},
  candidates,inputs,sources:sources.map(({save,...fact})=>fact),
  prepared:prepared.map(({save,...fact})=>fact),staticContext,
  unitCosts,summaries,recoveries,trials:trialResults};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P218',trials:trialResults.length,
  summaries:summaries.map(x=>({candidate:x.candidate,mage:x.mage,
    hp:x.pressure.hp,attackMass:x.pressure.attackMass,
    byPlan:x.byPlan,flow8Recovery:{seconds:x.flow8Recovery.seconds,
      due:x.flow8Recovery.due,minFood:x.flow8Recovery.minFood}})),
  output:outputPath},null,2));
