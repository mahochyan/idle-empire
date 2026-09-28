'use strict';
// P221: reconstruct paid T1 L29 entry from P193's complete post-L21 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const source=JSON.parse(fs.readFileSync(path.join(dataDir,'p193-current-third-chapter-population.json'),'utf8'));
const historical=JSON.parse(fs.readFileSync(path.join(dataDir,'p194-current-third-chapter-population-army.json'),'utf8'));
const outputPath=path.join(dataDir,'p221-l29-t1-rebuild.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const targets={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28};
const placements=[['front','bronze_guard',15],['front','cavalry_t1',15],
  ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]];
const seeds=[1,15],flows=Array.from({length:16},(_,i)=>i+1);
const candidates=[{key:'current',mage:[13,10,6]},
  {key:'mage24',mage:[11,8,5]},
  {key:'mage21',mage:[10,7,4]},
  {key:'mage18',mage:[8,6,4]}];
assert.equal(source.batch,'P193');
assert.equal(historical.batch,'P194');
assert.equal(sha(source.finalSave),source.finalSaveSha256);
assert.equal(source.finalSaveSha256,'8f15611a09cefb9b64ca2d7d53c5cd8af1f52c375c4d1cc85fe75c48df0d5e99');
const frozenFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-l29-t1-rebuild-p221.js',
  'docs/codex/reports/data/p193-current-third-chapter-population.json',
  'docs/codex/reports/data/p194-current-third-chapter-population-army.json'];
const inputs=frozenFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const historicalDrift=historical.inputs.filter(row=>
  ['config.js','levels.js','math.js','garrison.js','technology.js'].includes(row.file))
  .map(row=>({file:row.file,then:row.sha256,now:inputs.find(x=>x.file===row.file).sha256,
    changed:row.sha256!==inputs.find(x=>x.file===row.file).sha256}));
const fixedEpoch=JSON.parse(source.finalSave).ts+1;
Date.now=()=>fixedEpoch;

function installHarness(run){
  run(`globalThis.__p221Timers=new Map();globalThis.__p221TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p221TimerId++;
      __p221Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p221Timers.delete(id);
    globalThis.__p221Step=()=>{const next=__p221Timers.entries().next().value;
      if(!next)return false;__p221Timers.delete(next[0]);next[1]();return true};
    globalThis.__p221Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p221Nodes.has(id))__p221Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p221Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installHarness(run);
  return {world,run};
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function state(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    resources:{...S.res},workers:{...S.popAlloc},merit:S.merit,
    defeated:[...S.defeated],army:armyCount(),upkeep:totalUpkeep(),
    owned:Object.fromEntries(['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
      .map(type=>[type,(S.pool[type]||0)+expeditionCount(type)+garrisonCount(type)])),
    queue:JSON.parse(JSON.stringify(S.queue)),
    formation:JSON.parse(JSON.stringify(S.formation)),
    sciences:[...S.sciences],upgradedUnits:{...S.upgradedUnits},
    farm:{...bldSt('farm')},stable:{...bldSt('stable')},
    foodRate:prodRate('food'),woodRate:prodRate('wood'),
    stoneRate:prodRate('stone'),coalRate:prodRate('coal'),
    copperRate:prodRate('copper')})`));
}
function saveReload(active,label){
  const before=state(active.run);
  assert.equal(active.run('save().ok'),true,`${label} save failed`);
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=restore(save);
  assert.deepEqual(state(next.run),before,`${label} reload changed gameplay state`);
  return {...next,save,sha256:sha(save)};
}
function seedRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p221Rng=${initial};globalThis.__p221Draws=0;
    Math.random=()=>{__p221Draws++;let x=__p221Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;
      __p221Rng=x>>>0;return __p221Rng/4294967296}`);
}
function fill(active,stage){
  const run=active.run,before=state(run),requested={},produced={},due={},paused={};
  let minFood=before.resources.food;
  for(const [type,target] of Object.entries(targets)){
    const need=Math.max(0,target-owned(run,type)-(run(`S.queue['${type}']?.count||0`)));
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'');
    const resourceBefore=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok,true,`L${stage} ${type} train failed ${JSON.stringify(action)}`);
    assert.equal(action.qty,need);
    assert.deepEqual(plain(run('({...S.res})')),resourceBefore,
      'queueing must not charge before production');
  }
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
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
      if(made<=0)continue;
      produced[type]=(produced[type]||0)+made;
      for(const [rk,cost] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        due[rk]=(due[rk]||0)+cost*made;
    }
  }
  const after=state(run);
  for(const [type,target] of Object.entries(targets))
    assert.ok(after.owned[type]<=target,`L${stage} surplus ${type}`);
  if(ready())for(const [type,need] of Object.entries(requested))
    assert.equal(produced[type]||0,need,`L${stage} ${type} production mismatch`);
  return {seconds,ready:ready(),requested,produced,due,
    paused,minFood,before,after};
}
function formation(run){
  run("clrForm('expedition')");
  for(const [row,type,count] of placements){
    const index=run(`S.formation.${row}.length`);
    assert.ok(index<run(`rowSlots('${row}')`));
    assert.ok(count<=run('regMax()'));
    assert.ok(run(`S.pool['${type}']||0`)>=count);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
      S.formation.${row}[${index}]?.count===${count}`),true);
  }
  const out=plain(run(`Object.fromEntries(['front','mid','back'].map(row=>
    [row,S.formation[row].map(u=>({type:u.type,count:u.count}))]))`));
  assert.equal(out.front.reduce((n,u)=>n+u.count,0),45);
  assert.equal(out.back.reduce((n,u)=>n+u.count,0),28);
  return out;
}
function battle(active,stage,flow,{alreadyFormed=false}={}){
  const run=active.run;
  if(!alreadyFormed)formation(run);
  const before=state(run);
  assert.equal(before.defeated.at(-1),stage-1);
  assert.equal(before.army,73);
  seedRng(run,flow,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  const initialEnemy=plain(run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
    mageGroups:B.enemyUnits.filter(u=>u.type==='mage_t1').length})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p221Step()'),true,'battle callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle did not settle');
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const enemyHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)');
  const rngDraws=run('__p221Draws');
  const settled=state(run),losses={};
  for(const [type,target] of Object.entries(targets)){
    losses[type]=target-settled.owned[type];
    assert.ok(losses[type]>=0&&losses[type]<=target);
  }
  const lossTotal=Object.values(losses).reduce((a,b)=>a+b,0);
  assert.equal(lossTotal,before.army-settled.army);
  run('exitBattle()');
  active=saveReload(active,`L${stage}/flow${flow} battle`);
  return {won,round,callbacks,initialEnemy,enemyHp,rngDraws,
    losses,lossTotal,before,after:state(active.run),postSave:active.save,
    postSaveSha256:active.sha256};
}
function route(seed){
  let active=restore(source.finalSave);
  const start=state(active.run);
  assert.equal(start.population,22);assert.equal(start.capacity,22);
  assert.equal(start.defeated.at(-1),21);assert.equal(start.army,43);
  assert.deepEqual(Object.fromEntries(['wood','stone','food','coal','copper']
    .map(k=>[k,start.workers[k]])),
    {wood:3,stone:3,food:7,coal:6,copper:3});
  const stages=[];
  for(let stage=22;stage<=28;stage++){
    const recovery=fill(active,stage);
    if(!recovery.ready){stages.push({stage,recovery,block:'training not ready in 7200 s'});break;}
    active=saveReload(active,`L${stage} pre-formation`);
    const preparedSha256=active.sha256;
    const result=battle(active,stage,seed);
    stages.push({stage,recovery,preparedSha256,
      battle:{won:result.won,round:result.round,lossTotal:result.lossTotal,
        losses:result.losses,enemyHp:result.enemyHp,rngDraws:result.rngDraws},
      postSaveSha256:result.postSaveSha256});
    active=restore(result.postSave);
    if(!result.won)break;
  }
  let l29=null;
  if(state(active.run).defeated.at(-1)===28){
    const recovery=fill(active,29);
    if(recovery.ready){
      active=saveReload(active,'L29 pre-formation');
      const preformation={save:active.save,sha256:active.sha256};
      formation(active.run);
      active=saveReload(active,'L29 battle-ready');
      l29={recovery,preformation,preparedSave:active.save,
        preparedSha256:active.sha256,preparedState:state(active.run)};
    }else l29={recovery,block:'L29 training not ready in 7200 s'};
  }
  return {seed,start,stages,l29,final:state(active.run),
    finalSave:active.world.store.get('rts_save')};
}

const routes=seeds.map(route);
const prepared=routes.filter(x=>x.l29?.preparedSave);
if(!prepared.length)throw new Error('No P193-based T1 L29 save reached; inspect P221 route stages');
function patchMage(run,candidate){
  const official=plain(run('CFG.enemies[28]'));
  assert.deepEqual(official.units.mage_t1,[13,10,6]);
  if(candidate.key!=='current')
    run(`CFG.enemies[28].units.mage_t1=${JSON.stringify(candidate.mage)}`);
  const altered=plain(run('CFG.enemies[28]'));
  assert.deepEqual({...altered,units:{...altered.units,mage_t1:official.units.mage_t1}},official);
}
const unitCosts=plain(restore(source.finalSave).run(`Object.fromEntries(
  ['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
    .map(k=>[k,CFG.units[k].cost]))`));
function bill(losses){
  const due={};
  for(const [type,count] of Object.entries(losses))
    for(const [rk,cost] of Object.entries(unitCosts[type]))
      due[rk]=(due[rk]||0)+count*cost;
  return due;
}
const trials=[];
for(const route of prepared)for(const candidate of candidates)for(const flow of flows){
  let active=restore(route.l29.preparedSave);
  patchMage(active.run,candidate);
  const result=battle(active,29,flow,{alreadyFormed:true});
  let refillActive=restore(result.postSave);
  const refill=fill(refillActive,29);
  refillActive=saveReload(refillActive,`L29/${candidate.key}/flow${flow} refill`);
  trials.push({sourceSeed:route.seed,candidate:candidate.key,flow,
    preparedSha256:route.l29.preparedSha256,
    won:result.won,round:result.round,enemyHp:result.enemyHp,
    rngDraws:result.rngDraws,initialEnemy:result.initialEnemy,
    losses:result.losses,lossTotal:result.lossTotal,
    rebuildBill:bill(result.losses),
    refill:{seconds:refill.seconds,ready:refill.ready,due:refill.due,
      paused:refill.paused,minFood:refill.minFood,
      beforeFood:refill.before.resources.food,
      afterFood:refill.after.resources.food,
      replenishedSaveSha256:refillActive.sha256},
    postSaveSha256:result.postSaveSha256});
  assert.deepEqual(refill.due,bill(result.losses));
}
const summaries=[];
for(const route of prepared)for(const candidate of candidates){
  const rows=trials.filter(x=>x.sourceSeed===route.seed&&x.candidate===candidate.key);
  summaries.push({sourceSeed:route.seed,candidate:candidate.key,
    wins:rows.filter(x=>x.won).length,
    fullLossFlows:rows.filter(x=>x.lossTotal===73).map(x=>x.flow),
    meanLoss:rows.reduce((n,x)=>n+x.lossTotal,0)/rows.length,
    minLoss:Math.min(...rows.map(x=>x.lossTotal)),
    maxLoss:Math.max(...rows.map(x=>x.lossTotal)),
    meanFoodBill:rows.reduce((n,x)=>n+(x.rebuildBill.food||0),0)/rows.length,
    maxRefillSeconds:Math.max(...rows.map(x=>x.refill.seconds)),
    heaviestRefill:rows.filter(x=>x.refill.seconds===Math.max(...rows.map(y=>y.refill.seconds)))
      .map(x=>({flow:x.flow,won:x.won,lossTotal:x.lossTotal,
        seconds:x.refill.seconds,due:x.refill.due,minFood:x.refill.minFood})),
    blockedRefills:rows.filter(x=>!x.refill.ready).map(x=>x.flow),
    minRefillFood:Math.min(...rows.map(x=>x.refill.minFood))});
}
for(const candidate of candidates)for(const flow of flows){
  const a=trials.find(x=>x.sourceSeed===1&&x.candidate===candidate.key&&x.flow===flow);
  const b=trials.find(x=>x.sourceSeed===15&&x.candidate===candidate.key&&x.flow===flow);
  if(!a||!b)continue;
  assert.deepEqual({won:a.won,round:a.round,enemyHp:a.enemyHp,
    rngDraws:a.rngDraws,losses:a.losses,initialEnemy:a.initialEnemy},
  {won:b.won,round:b.round,enemyHp:b.enemyHp,
    rngDraws:b.rngDraws,losses:b.losses,initialEnemy:b.initialEnemy},
  `T1 paid-source battle divergence ${candidate.key}/flow${flow}`);
}
const historicalComparisons=routes.map(route=>{
  const old=historical.profiles.find(x=>x.seed===route.seed)?.stages.find(x=>x.stage===29);
  assert.ok(old?.beforeSaveSha256);
  const now=route.l29?.preformation.sha256||null;
  return {seed:route.seed,historicalL29PreformationSha256:old.beforeSaveSha256,
    currentL29PreformationSha256:now,sameHash:now===old.beforeSaveSha256,
    historicalRecoverySeconds:old.recovery.seconds,
    currentRecoverySeconds:route.l29?.recovery.seconds??null};
});
for(const row of inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,
    `${row.file} changed during P221`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P221',sourceHead:head.stdout.trim(),
  sourceSaveSha256:source.finalSaveSha256,
  unit:'simulated online tick seconds, resources, soldiers',
  method:'From P193 full paid L21 22/22 save: live training queues, one-second ticks, formation modal actions, official async battle/settlement, save/reload for L22-28; then paid L29 recovery and battle-ready save. Compare official L29 mage [13,10,6] with isolated [11,8,5] on same T1 save and predeclared xorshift flows 1..16; after each battle refill via live queues/ticks for pressure. No soldier/resource injection, no offline/garrison.',
  scope:{seeds,flows,candidates,maxRecoverySeconds:7200,
    rng:'xorshift32 (flow*1009+stage*9176)>>>0',
    nodeVmOnly:true,noGarrison:true,noOffline:true,
    fixedVmNowMs:fixedEpoch,fixedStreamNotPlayerWinRate:true},
  historicalDrift,historicalComparisons,unitCosts,
  routes:routes.map(({finalSave,...r})=>r),trials,summaries,inputs};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P221',prepared:prepared.map(x=>({seed:x.seed,
  preformationSha256:x.l29.preformation.sha256,
  battleReadySha256:x.l29.preparedSha256,
  l29RecoverySeconds:x.l29.recovery.seconds})),
  summaries,output:outputPath},null,2));
