'use strict';
// P226: current paid L29->L30 saves, isolated Boss rosters, real battle/recovery.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const outputPath=path.join(dataDir,'p226-l30-boss-sensitivity.json');
const p193=JSON.parse(fs.readFileSync(path.join(dataDir,'p193-current-third-chapter-population.json'),'utf8'));
const p221=JSON.parse(fs.readFileSync(path.join(dataDir,'p221-l29-t1-rebuild.json'),'utf8'));
const p224=JSON.parse(fs.readFileSync(path.join(dataDir,'p224-formal-l29-l31.json'),'utf8'));
const p225=JSON.parse(fs.readFileSync(path.join(dataDir,'p225-live-l29-t1-formal.json'),'utf8'));
const p195=JSON.parse(fs.readFileSync(path.join(dataDir,'p195-current-l30-followup.json'),'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const profiles={
  t1_58:{targets:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:13},
    placements:[['front','bronze_guard',15],['front','cavalry_t1',15],
      ['front','infantry_t1',15],['back','archer_t1',13]]},
  t1_73:{targets:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28},
    placements:[['front','bronze_guard',15],['front','cavalry_t1',15],
      ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]]},
  t2_73:{targets:{bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28},
    placements:[['front','infantry_t1',15],['front','cavalry_wind',15],
      ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]]}
};
profiles.t2_73_original={targets:{...profiles.t2_73.targets},
  placements:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]]};
const bossCandidates=[
  {key:'current49',regular:[6,4,3],mage:[6,4],
    duty:'formal low-pressure reward transition'},
  {key:'bridge68',regular:[8,6,4],mage:[8,6],
    duty:'P195 old-source warning boundary: 58 troops lost 3/32 fixed streams'},
  {key:'step72',regular:[9,6,4],mage:[9,6],
    duty:'small step above historical warning, below current L29 HP'},
  {key:'near80',regular:[10,7,4],mage:[10,7],
    duty:'approach current L29 opening mass under unchanged Boss multiplier'}
];
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p193-current-third-chapter-population.json',
  'docs/codex/reports/data/p221-l29-t1-rebuild.json',
  'docs/codex/reports/data/p224-formal-l29-l31.json',
  'docs/codex/reports/data/p225-live-l29-t1-formal.json',
  'docs/codex/reports/data/p195-current-l30-followup.json',
  'tools/verify/probe-l30-boss-sensitivity-p226.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(p193.batch,'P193');
assert.equal(p221.batch,'P221');
assert.equal(p224.batch,'P224');
assert.equal(p225.batch,'P225');
assert.equal(p195.batch,'P195');
assert.equal(sha(p193.finalSave),p193.finalSaveSha256);
assert.deepEqual(p224.l29Trials[0].initialEnemy,
  {groups:12,hp:111,attackMass:1071,mageGroups:3,mageHp:24});
assert.equal(p224.handoffs[0].L30.initialEnemy.hp,49);
assert.equal(p224.handoffs[0].L30.initialEnemy.attackMass,641);
assert.equal(p224.handoffs[0].L31.initialEnemy.hp,9);
assert.equal(p224.handoffs[0].L31.initialEnemy.attackMass,36);
for(const file of ['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js']){
  const current=inputs.find(x=>x.file===file).sha256;
  const frozen=p224.inputs.find(x=>x.file===file)?.sha256;
  assert.equal(current,frozen,`${file} changed since P224`);
  assert.equal(current,p225.inputs.find(x=>x.file===file)?.sha256,
    `${file} changed since P225`);
}
const fixedEpoch=p225.scope.fixedVmNowMs;
assert.equal(fixedEpoch,p221.scope.fixedVmNowMs);
Date.now=()=>fixedEpoch;

function installHarness(run){
  run(`globalThis.__p226Timers=new Map();globalThis.__p226TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p226TimerId++;
      __p226Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p226Timers.delete(id);
    globalThis.__p226Step=()=>{const next=__p226Timers.entries().next().value;
      if(!next)return false;__p226Timers.delete(next[0]);next[1]();return true};
    globalThis.__p226Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p226Nodes.has(id))__p226Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p226Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installHarness(run);
  return{world,run};
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function state(run,profile){
  const keys=Object.keys(profiles[profile].targets);
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    resources:{...S.res},workers:{...S.popAlloc},merit:S.merit,
    essence:{...S.essence},defeated:[...S.defeated],army:armyCount(),
    owned:Object.fromEntries(${JSON.stringify(keys)}.map(k=>
      [k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),
    formation:JSON.parse(JSON.stringify(S.formation)),
    foodRate:prodRate('food'),upkeep:totalUpkeep(),
    capacityRes:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
    garrisonNextCheck:S.garrison?.nextCheckTick})`));
}
function saveReload(active,profile,label){
  const before=state(active.run,profile);
  assert.equal(active.run('save().ok'),true,`${label}: save failed`);
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=restore(save);
  assert.deepEqual(state(next.run,profile),before,`${label}: reload changed state`);
  return{...next,save,sha256:sha(save),state:before};
}
function seedRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p226Rng=${initial};globalThis.__p226Draws=0;
    Math.random=()=>{__p226Draws++;let x=__p226Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;
      __p226Rng=x>>>0;return __p226Rng/4294967296}`);
}
function formation(run,profile){
  const cfg=profiles[profile];
  const before=state(run,profile);
  assert.deepEqual(before.owned,cfg.targets);
  run("clrForm('expedition')");
  const expected={front:[],mid:[],back:[]};
  for(const [row,type,count] of cfg.placements){
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
    assert.deepEqual(plain(run(`S.formation.${row}.map(u=>({type:u.type,count:u.count}))`)),
      expected[row]);
  }
  const after=state(run,profile);
  assert.deepEqual(after.owned,before.owned);
  assert.deepEqual(after.resources,before.resources);
  assert.deepEqual(after.queue,before.queue);
  assert.equal(after.army,Object.values(cfg.targets).reduce((a,b)=>a+b,0));
  return after;
}
function refill(active,profile,label){
  const run=active.run,cfg=profiles[profile],before=state(run,profile);
  const requested={},produced={},due={},paused={};
  let minFoodTickEnd=before.resources.food,minFoodAfterPayment=before.resources.food;
  for(const [type,target] of Object.entries(cfg.targets)){
    const need=Math.max(0,target-owned(run,type)-run(`S.queue['${type}']?.count||0`));
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'',`${label}/${type} locked`);
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok,true,`${label}/${type} queue rejected`);
    assert.equal(action.qty,need);
    assert.deepEqual(plain(run('({...S.res})')),pre,'queue prepaid');
  }
  run(`globalThis.__p226Paid=[];globalThis.__p226RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p226RealPay(cost,n);
      __p226Paid.push({type,count:n,cost:{...cost},foodAfter:S.res.food})}`);
  const ready=()=>Object.entries(cfg.targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const next=plain(run('S.queue'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        paused[key]=(paused[key]||0)+1;}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const payments=plain(run('__p226Paid'));
  for(const item of payments){
    minFoodAfterPayment=Math.min(minFoodAfterPayment,item.foodAfter);
    for(const [resource,cost] of Object.entries(item.cost))
      due[resource]=(due[resource]||0)+cost*item.count;
  }
  for(const [type,need] of Object.entries(requested))
    assert.equal(produced[type]||0,need,`${label}/${type} production mismatch`);
  const after=state(run,profile);
  const saved=saveReload(active,profile,`${label} refilled`);
  return{active:saved,result:{before,requested,produced,due,paused,seconds,
    minFoodTickEnd,minFoodAfterPayment,ready:ready(),after,
    saveSha256:saved.sha256,save:saved.save}};
}
function initialEnemy(run){
  return plain(run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
    shield:B.enemyUnits.reduce((n,u)=>n+(u.shield||0),0),
    mageGroups:B.enemyUnits.filter(u=>u.type==='mage_t1').length,
    enemyGroups:B.enemyUnits.map(u=>({type:u.type,row:u.row,
      hp:u.maxHp,attackMass:combatAttackMass(u),atk:u.atk,def:u.def,
      shield:u.shield||0}))})`));
}
function fight(active,profile,stage,flow,label){
  const run=active.run,cfg=profiles[profile],before=state(run,profile);
  assert.equal(before.defeated.at(-1),stage-1,`${label}: not at stage`);
  assert.deepEqual(before.owned,cfg.targets,`${label}: soldiers missing`);
  assert.equal(before.army,Object.values(cfg.targets).reduce((a,b)=>a+b,0));
  const enemy=plain(run(`(()=>{const e=CFG.enemies[${stage-1}];
    return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
      bossMult:e.bossMult||null,reward:e.reward,drops:e.drops||null,
      attackMass:e.attackMass||null}})()`));
  seedRng(run,flow,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  const initial=initialEnemy(run);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p226Step()'),true,`${label}: callback missing`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}: not settled`);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const enemyHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)');
  const draws=run('__p226Draws');
  run('exitBattle()');
  const after=state(run,profile);
  const losses=Object.fromEntries(Object.entries(cfg.targets)
    .map(([type,count])=>[type,count-after.owned[type]]));
  for(const [type,count] of Object.entries(losses))
    assert.ok(count>=0&&count<=cfg.targets[type]);
  const lossTotal=Object.values(losses).reduce((a,b)=>a+b,0);
  assert.equal(lossTotal,before.army-after.army);
  const reward=Object.fromEntries(Object.keys(enemy.reward)
    .map(k=>[k,after.resources[k]-before.resources[k]]));
  const drops=Object.fromEntries([...new Set([
    ...Object.keys(before.essence),...Object.keys(after.essence)])]
    .map(k=>[k,(after.essence[k]||0)-(before.essence[k]||0)])
    .filter(([,v])=>v>0));
  const saved=saveReload(active,profile,`${label} settled`);
  return{active:saved,result:{stage,flow,enemy,initial,won,round,callbacks,
    enemyHp,draws,losses,lossTotal,reward,drops,
    meritGain:after.merit-before.merit,before,after,
    saveSha256:saved.sha256,save:saved.save}};
}

const t2Saves=p224.handoffs.map(h=>{
  const raw=h.beforeL30.prepared.save;
  assert.equal(sha(raw),h.beforeL30.prepared.sha256);
  const profile=h.selection.plan==='original'?'t2_73_original':'t2_73';
  const loaded=restore(raw),stateNow=state(loaded.run,profile);
  assert.equal(stateNow.defeated.at(-1),29);
  assert.equal(stateNow.army,73);
  assert.deepEqual(stateNow.owned,profiles.t2_73.targets);
  return{key:`t2-${h.selection.sourceSeed}-${h.selection.plan}-${h.selection.flow}`,
    profile,source:'P224',upstream:h.selection,
    raw,sha256:sha(raw),state:stateNow};
});
const t1Saves=[];
for(const seed of [1,15]){
  const route=p221.routes.find(x=>x.seed===seed);
  assert.ok(route?.l29.preparedSave);
  assert.equal(sha(route.l29.preparedSave),route.l29.preparedSha256);
  let active=restore(route.l29.preparedSave);
  const l29=fight(active,'t1_73',29,2,`T1 source${seed} formal L29 flow2`);
  const p225row=p225.rows.find(x=>x.sourceSeed===seed&&x.flow===2);
  assert.deepEqual({won:l29.result.won,round:l29.result.round,
    enemyHp:l29.result.enemyHp,draws:l29.result.draws,
    losses:l29.result.losses,lossTotal:l29.result.lossTotal},
    {won:p225row.won,round:p225row.round,
      enemyHp:p225row.enemyHp,draws:p225row.rngDraws,
      losses:p225row.losses,lossTotal:p225row.lossTotal});
  assert.equal(l29.result.saveSha256,p225row.postSaveSha256);
  assert.equal(l29.result.won,true);
  const filled=refill(l29.active,'t1_73',`T1 source${seed} L30`);
  if(seed===1){
    const check=p225.continuations.find(x=>x.flow===2);
    assert.equal(filled.result.seconds,check.firstRefill.seconds);
    assert.deepEqual(filled.result.due,check.firstRefill.due);
    assert.equal(filled.result.saveSha256,check.firstRefill.postSaveSha256);
  }
  active=filled.active;
  formation(active.run,'t1_73');
  active=saveReload(active,'t1_73',`T1 source${seed} L30 prepared`);
  t1Saves.push({key:`t1-73-${seed}-flow2`,profile:'t1_73',source:'P221/P225',
    upstream:{sourceSeed:seed,l29Flow:2,l29Loss:l29.result.lossTotal,
      l29SaveSha256:l29.result.saveSha256,replenishment:filled.result},
    raw:active.save,sha256:active.sha256,state:active.state});
}

const t1_58Routes=[];
for(const upstreamFlow of [1,15]){
  let active=restore(p193.finalSave);
  const start=state(active.run,'t1_58');
  assert.equal(start.population,22);
  assert.equal(start.defeated.at(-1),21);
  assert.equal(start.army,43);
  const stages=[];
  for(let stage=22;stage<=28;stage++){
    const filled=refill(active,'t1_58',`T1-58 flow${upstreamFlow} L${stage}`);
    active=filled.active;
    formation(active.run,'t1_58');
    active=saveReload(active,'t1_58',`T1-58 L${stage} prepared`);
    const preparedSaveSha256=active.sha256;
    const fought=fight(active,'t1_58',stage,upstreamFlow,
      `T1-58 flow${upstreamFlow} L${stage}`);
    active=fought.active;
    stages.push({stage,replenishment:filled.result,
      preparedSaveSha256,battle:fought.result});
    if(!fought.result.won)break;
  }
  t1_58Routes.push({upstreamFlow,start,stages,lastCleared:state(active.run,'t1_58').defeated.at(-1),
    postL28Save:active.world.store.get('rts_save')});
}
const t1_58L29=[];
for(const route of t1_58Routes){
  if(route.lastCleared!==28)continue;
  let active=restore(route.postL28Save);
  const filled=refill(active,'t1_58',`T1-58 upstream${route.upstreamFlow} L29`);
  active=filled.active;
  formation(active.run,'t1_58');
  active=saveReload(active,'t1_58',`T1-58 upstream${route.upstreamFlow} L29 prepared`);
  const trials=[];
  for(let flow=1;flow<=16;flow++){
    const fought=fight(restore(active.save),'t1_58',29,flow,
      `T1-58 upstream${route.upstreamFlow} L29 flow${flow}`);
    trials.push({flow,battle:fought.result});
  }
  t1_58L29.push({upstreamFlow:route.upstreamFlow,
    recovery:filled.result,prepared:{save:active.save,sha256:active.sha256,state:active.state},
    trials});
}
const t1_58Selections=[{upstreamFlow:1,l29Flow:6},
  {upstreamFlow:15,l29Flow:9}];
const t1_58Saves=[];
for(const selected of t1_58Selections){
  const route=t1_58L29.find(x=>x.upstreamFlow===selected.upstreamFlow);
  const l29=route?.trials.find(x=>x.flow===selected.l29Flow);
  assert.ok(l29?.battle.won,`T1-58 selected L29 route is not a true victory`);
  let active=restore(l29.battle.save);
  const filled=refill(active,'t1_58',`T1-58 upstream${selected.upstreamFlow}
    L29flow${selected.l29Flow} L30`);
  active=filled.active;
  formation(active.run,'t1_58');
  active=saveReload(active,'t1_58',`T1-58 selected L30 prepared`);
  t1_58Saves.push({key:`t1-58-${selected.upstreamFlow}-l29flow${selected.l29Flow}`,
    profile:'t1_58',source:'P193 current paid route',
    upstream:{...selected,l29Loss:l29.battle.lossTotal,
      l29SaveSha256:l29.battle.saveSha256,replenishment:filled.result},
    raw:active.save,sha256:active.sha256,state:active.state});
}

const preparedSaves=[...t2Saves,...t1Saves,...t1_58Saves];
const sweepEpoch=Math.max(fixedEpoch,...preparedSaves.map(x=>JSON.parse(x.raw).ts))+1;
Date.now=()=>sweepEpoch;
function patchBoss(run,candidate){
  const formal=plain(run('CFG.enemies[29]'));
  assert.deepEqual(formal.units,{infantry:[6,4,3],archer:[6,4,3],
    cavalry_t1:[6,4,3],mage_t1:[6,4]});
  assert.deepEqual(formal.bossMult,{atk:1.4,def:1.35});
  assert.equal(formal.attackMass,undefined);
  const units={infantry:candidate.regular,archer:candidate.regular,
    cavalry_t1:candidate.regular,mage_t1:candidate.mage};
  if(candidate.key!=='current49')
    run(`CFG.enemies[29].units=${JSON.stringify(units)}`);
  const altered=plain(run('CFG.enemies[29]'));
  assert.deepEqual({...altered,units:formal.units},formal,
    'candidate changed field other than L30 unit counts');
  assert.deepEqual(altered.units,units);
  return altered;
}
const allTrials=[],postSaves=new Map();
for(const candidate of bossCandidates)for(const item of preparedSaves)
  for(let flow=1;flow<=16;flow++){
    const active=restore(item.raw);
    patchBoss(active.run,candidate);
    const fought=fight(active,item.profile,30,flow,
      `${candidate.key}/${item.key}/flow${flow}`);
    const result=fought.result;
    assert.equal(result.initial.groups,11);
    assert.equal(result.initial.shield,0);
    assert.equal(result.enemy.attackMass,null);
    const row={candidate:candidate.key,sourceKey:item.key,profile:item.profile,
      flow,preparedSha256:item.sha256,won:result.won,
      round:result.round,lossTotal:result.lossTotal,losses:result.losses,
      enemyHp:result.enemyHp,draws:result.draws,initial:result.initial,
      actualReward:result.reward,drops:result.drops,
      after:{army:result.after.army,resources:result.after.resources,
        lastCleared:result.after.defeated.at(-1)},
      postSaveSha256:result.saveSha256};
    allTrials.push(row);
    postSaves.set(`${candidate.key}/${item.key}/${flow}`,result.save);
    if(candidate.key==='current49'){
      const oldT2=p224.handoffs.find(h=>item.source==='P224'&&
        h.selection.sourceSeed===item.upstream.sourceSeed&&
        h.selection.plan===item.upstream.plan&&
        h.selection.flow===item.upstream.flow);
      if(oldT2&&flow===item.upstream.flow)
        assert.deepEqual({won:result.won,round:result.round,
          lossTotal:result.lossTotal,losses:result.losses,
          actualReward:result.reward},
          {won:oldT2.L30.won,round:oldT2.L30.round,
            lossTotal:oldT2.L30.lossTotal,losses:oldT2.L30.losses,
            actualReward:oldT2.L30.actualReward},
          `P224 current L30 mismatch ${item.key}`);
      if(item.key==='t1-73-1-flow2'&&flow===2){
        const old=p225.continuations.find(x=>x.flow===2).nextBattle;
        assert.deepEqual({won:result.won,round:result.round,lossTotal:result.lossTotal},
          {won:old.won,round:old.round,lossTotal:old.lossTotal},
          'P225 current L30 mismatch');
      }
    }
  }
assert.equal(allTrials.length,bossCandidates.length*preparedSaves.length*16);
const summaries=[];
for(const candidate of bossCandidates)for(const item of preparedSaves){
  const rows=allTrials.filter(x=>x.candidate===candidate.key&&x.sourceKey===item.key);
  const losses=rows.map(x=>x.lossTotal).sort((a,b)=>a-b);
  summaries.push({candidate:candidate.key,sourceKey:item.key,profile:item.profile,
    wins:rows.filter(x=>x.won).length,
    lossFlows:rows.filter(x=>!x.won).map(x=>x.flow),
    meanLoss:rows.reduce((n,x)=>n+x.lossTotal,0)/rows.length,
    medianLoss:(losses[7]+losses[8])/2,minLoss:losses[0],maxLoss:losses.at(-1),
    initial:{hp:rows[0].initial.hp,attackMass:rows[0].initial.attackMass}});
}
// A second paid continuation uses only wins from the independently frozen sweep.
// Keep the hardest winning stream of each representative source. This selection
// is deliberately post-hoc stress evidence, never a player win-rate estimate.
const representativeKeys=['t1-58-1-l29flow6','t1-73-1-flow2',
  't2-1-frontReverse-1','t2-1-original-11'];
const continuations=[];
for(const candidate of bossCandidates)for(const sourceKey of representativeKeys){
  const item=preparedSaves.find(x=>x.key===sourceKey);
  assert.ok(item);
  const row=allTrials.filter(x=>x.candidate===candidate.key&&
    x.sourceKey===sourceKey&&x.won)
    .sort((a,b)=>b.lossTotal-a.lossTotal||a.flow-b.flow)[0];
  assert.ok(row,`${candidate.key}/${sourceKey}: no winning stream`);
  assert.equal(sha(postSaves.get(`${candidate.key}/${sourceKey}/${row.flow}`)),
    row.postSaveSha256);
  let active=restore(postSaves.get(`${candidate.key}/${sourceKey}/${row.flow}`));
  assert.equal(state(active.run,item.profile).defeated.at(-1),30);
  const filled=refill(active,item.profile,
    `${candidate.key}/${sourceKey}/flow${row.flow} after L30`);
  active=filled.active;
  formation(active.run,item.profile);
  active=saveReload(active,item.profile,
    `${candidate.key}/${sourceKey}/flow${row.flow} L31 prepared`);
  const l31=fight(active,item.profile,31,row.flow,
    `${candidate.key}/${sourceKey}/flow${row.flow} L31`);
  continuations.push({candidate:candidate.key,sourceKey,profile:item.profile,
    flow:row.flow,l30:{won:row.won,round:row.round,
      lossTotal:row.lossTotal,losses:row.losses,
      actualReward:row.actualReward,drops:row.drops,
      after:row.after,save:postSaves.get(`${candidate.key}/${sourceKey}/${row.flow}`),
      saveSha256:row.postSaveSha256},
    recovery:filled.result,
    beforeL31:{save:active.save,sha256:active.sha256,state:active.state},
    l31:l31.result});
}

// Failed L30 attempts get no clear reward. Measure real paid recovery for one
// reachable 58-soldier route in every candidate that produced a failure.
const failureRecoveries=[];
for(const candidate of bossCandidates.filter(x=>x.key!=='current49')){
  const sourceKey='t1-58-1-l29flow6';
  const failed=allTrials.filter(x=>x.candidate===candidate.key&&
    x.sourceKey===sourceKey&&!x.won)
    .sort((a,b)=>b.enemyHp-a.enemyHp||a.flow-b.flow)[0];
  assert.ok(failed,`${candidate.key}: no T1-58 loss to recover`);
  const raw=postSaves.get(`${candidate.key}/${sourceKey}/${failed.flow}`);
  assert.equal(sha(raw),failed.postSaveSha256);
  const filled=refill(restore(raw),'t1_58',
    `${candidate.key}/${sourceKey}/flow${failed.flow} failed L30`);
  assert.equal(filled.result.after.defeated.at(-1),29);
  failureRecoveries.push({candidate:candidate.key,sourceKey,flow:failed.flow,
    failed:{lossTotal:failed.lossTotal,enemyHp:failed.enemyHp,
      actualReward:failed.actualReward,save:raw,
      saveSha256:failed.postSaveSha256},recovery:filled.result});
}

// Upstream saves can have different resources but identical military state.
// Cross-check that this did not alter the deterministic combat outcomes.
for(const candidate of bossCandidates){
  for(let flow=1;flow<=16;flow++){
    for(const profile of Object.keys(profiles)){
      const rows=allTrials.filter(x=>x.candidate===candidate.key&&
        x.flow===flow&&x.profile===profile);
      if(rows.length<2)continue;
      const combat=x=>({won:x.won,round:x.round,losses:x.losses,
        lossTotal:x.lossTotal,enemyHp:x.enemyHp,draws:x.draws});
      for(const row of rows.slice(1))
        assert.deepEqual(combat(row),combat(rows[0]),
          `${candidate.key}/${profile}/flow${flow} cross-source mismatch`);
    }
  }
}
for(const entry of inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,entry.file))),entry.sha256,
    `${entry.file} changed during probe`);
const git=(...args)=>{
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,`git ${args.join(' ')} failed`);
  return result.stdout.trim();
};
const compactFight=x=>{
  const {save,...rest}=x;return rest;
};
const compactRefill=x=>{
  const {save,...rest}=x;return rest;
};
const artifact={batch:'P226',scope:{
    line:'existing 100-level challenge campaign only',
    newDevelopmentLine:'separate design required; no conclusions transferred',
    isolation:'Only CFG.enemies[29].units changes in candidate VM; formal source files untouched',
    streamRule:'xorshift32 (flow*1009+stage*9176)>>>0, flows 1..16 per save',
    saveRule:'real loadSaveAndApply/save/reload at each checkpoint',
    recoveryRule:'real train and one-second tick; garrisonTick disabled by harness',
    selectionRule:'post-hoc hardest winning flow per representative source',
    fixedEpochMs:fixedEpoch,sweepEpochMs:sweepEpoch,
    node:process.version,platform:process.platform,architecture:process.arch},
  git:{branch:git('branch','--show-current'),head:git('rev-parse','HEAD')},
  inputs,bossCandidates,
  baseline:{formalL29:{hp:111,attackMass:1071},
    formalL30:{regular:[6,4,3],mage:[6,4],bossMult:{atk:1.4,def:1.35},
      reward:{wood:11400,stone:8640,food:7920}},
    formalL31:{hp:9,attackMass:36},
    historicalP195:'[8,6,4] on an older L29 origin lost 3/32 at T1-58; not current-source comparable'},
  t1_58Routes:t1_58Routes.map(x=>({upstreamFlow:x.upstreamFlow,
    start:x.start,lastCleared:x.lastCleared,postL28SaveSha256:sha(x.postL28Save),
    stages:x.stages.map(s=>({stage:s.stage,
      replenishment:compactRefill(s.replenishment),
      preparedSaveSha256:s.preparedSaveSha256,
      battle:compactFight(s.battle)}))})),
  t1_58L29:t1_58L29.map(x=>({upstreamFlow:x.upstreamFlow,
    recovery:compactRefill(x.recovery),preparedSaveSha256:x.prepared.sha256,
    trials:x.trials.map(t=>({flow:t.flow,...compactFight(t.battle)}))})),
  preparedSaves:preparedSaves.map(x=>({key:x.key,profile:x.profile,
    source:x.source,upstream:{...x.upstream,
      replenishment:x.upstream.replenishment?
        compactRefill(x.upstream.replenishment):undefined},
    raw:x.raw,sha256:x.sha256,state:x.state})),
  sweep:{count:allTrials.length,rows:allTrials,summaries},
  continuations,failureRecoveries};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P226',artifact:outputPath,
  artifactSha256:sha(fs.readFileSync(outputPath)),
  sweepCount:allTrials.length,summary:summaries.map(s=>({candidate:s.candidate,
    source:s.sourceKey,wins:s.wins,lossFlows:s.lossFlows,
    medianLoss:s.medianLoss,maxLoss:s.maxLoss})),
  continuations:continuations.map(c=>({candidate:c.candidate,source:c.sourceKey,
    flow:c.flow,l30Loss:c.l30.lossTotal,recoverySeconds:c.recovery.seconds,
    paidFoodLow:c.recovery.minFoodAfterPayment,
    l31Won:c.l31.won,l31Loss:c.l31.lossTotal})),
  failureRecoveries:failureRecoveries.map(c=>({candidate:c.candidate,
    flow:c.flow,l30Loss:c.failed.lossTotal,
    recoverySeconds:c.recovery.seconds,
    paidFoodLow:c.recovery.minFoodAfterPayment}))},null,2));
