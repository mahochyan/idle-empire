'use strict';
// P224: formal L29 mage-wave replay from paid P201 saves, then paid L30/L31.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const comparisonPath=path.join(root,'docs/codex/reports/data/p218-l29-mage-sensitivity.json');
const priorHandoffPath=path.join(root,'docs/codex/reports/data/p219-current-l29-l31-handoff.json');
const outputPath=path.join(root,'docs/codex/reports/data/p224-formal-l29-l31.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const comparison=JSON.parse(fs.readFileSync(comparisonPath,'utf8'));
const priorHandoff=JSON.parse(fs.readFileSync(priorHandoffPath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
const plans={
  frontReverse:[['front','infantry_t1',15],['front','cavalry_wind',15],
    ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]],
  original:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]]
};
const selections=[
  {sourceSeed:1,flow:1,plan:'frontReverse',reason:'low-loss formal win'},
  {sourceSeed:15,flow:15,plan:'frontReverse',reason:'second paid source and middle-loss formal win'},
  {sourceSeed:1,flow:8,plan:'frontReverse',reason:'P218 candidate rescued prior full loss; highest reverse-order loss'},
  {sourceSeed:1,flow:11,plan:'original',reason:'high-loss formal original-order win'}
];
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'docs/codex/reports/data/p218-l29-mage-sensitivity.json',
  'docs/codex/reports/data/p219-current-l29-l31-handoff.json',
  'tools/verify/probe-formal-l29-l31-p224.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P201');
assert.equal(comparison.batch,'P218');
assert.equal(priorHandoff.batch,'P219');
for(const file of ['config.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js'])
  assert.equal(inputs.find(x=>x.file===file).sha256,
    comparison.inputs.find(x=>x.file===file)?.sha256,`${file} no longer matches P218`);
assert.notEqual(inputs.find(x=>x.file==='levels.js').sha256,
  comparison.inputs.find(x=>x.file==='levels.js')?.sha256,
  'P224 should read the changed formal levels.js, not P218 old config');
function sourceCase(sourceSeed){
  const profile=source.profiles.find(p=>p.seed===sourceSeed&&p.route==='t2SecondBack73');
  const stage=profile?.stages.find(s=>s.stage===29);
  assert.ok(stage?.l29PreparedSave);
  assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
  return{sourceSeed,save:stage.l29PreparedSave,
    sha256:stage.beforeSaveSha256,oldEnemy:stage.enemy.config};
}
const sourceCases=[sourceCase(1),sourceCase(15)];
assert.deepEqual(sourceCases.map(x=>({sourceSeed:x.sourceSeed,sha256:x.sha256})),
  comparison.sources);
const fixedEpoch=Math.max(...sourceCases.map(x=>JSON.parse(x.save).ts))+1;
Date.now=()=>fixedEpoch;
function installHarness(run){
  run(`globalThis.__p224Timers=new Map();globalThis.__p224NextTimer=1;
    globalThis.setTimeout=fn=>{const id=__p224NextTimer++;
      __p224Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p224Timers.delete(id);
    globalThis.__p224Step=()=>{const next=__p224Timers.entries().next().value;
      if(!next)return false;__p224Timers.delete(next[0]);next[1]();return true};
    globalThis.__p224Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p224Nodes.has(id))__p224Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p224Nodes.get(id)};
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
function snapshot(run){
  return plain(run(`({tick:S.tick,lastCleared:S.defeated.at(-1),
    resources:{...S.res},merit:S.merit,essence:{...S.essence},
    army:armyCount(),owned:Object.fromEntries(
      ['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
        .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),workers:{...S.popAlloc},
    formation:Object.fromEntries(['front','mid','back'].map(row=>
      [row,S.formation[row].map(u=>({type:u.type,count:u.count}))])),
    foodRate:prodRate('food'),upkeep:totalUpkeep(),
    capacity:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')}})`));
}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label}: save failed`);
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=restore(save);
  assert.deepEqual(snapshot(next.run),before,`${label}: reload changed state`);
  return{...next,save,sha256:sha(save),state:before};
}
function formByActions(run,plan){
  const before=snapshot(run),placements=plans[plan];
  assert.ok(placements);
  assert.deepEqual(before.owned,targets);
  assert.equal(before.army,73);
  run("clrForm('expedition')");
  const expected={front:[],mid:[],back:[]};
  for(const [row,type,count] of placements){
    const idx=expected[row].length;
    assert.ok(idx<run(`rowSlots('${row}')`));
    assert.ok(count<=run('regMax()'));
    assert.ok(run(`poolAvail('${type}')`)>=count);
    run(`openFormModal('expedition','${row}',${idx})`);
    assert.equal(run(`document.getElementById('form-modal-content').innerHTML
      .includes('data-type="${type}"')`),true);
    run(`selModalUnit({classList:{add(){}}},'${type}',poolAvail('${type}'));
      setModalQty(${count});confirmForm()`);
    expected[row].push({type,count});
    assert.deepEqual(snapshot(run).formation[row],expected[row]);
  }
  const after=snapshot(run);
  assert.deepEqual(after.formation,expected);
  assert.deepEqual(after.owned,before.owned);
  assert.deepEqual(after.resources,before.resources);
  assert.deepEqual(after.queue,before.queue);
  return after;
}
function refill(run,label){
  const before=snapshot(run),requested={},produced={},paused={};
  let minFoodTickEnd=before.resources.food;
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'');
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok,true,`${label}: ${type} queue rejected`);
    assert.equal(action.qty,need);
    assert.deepEqual(plain(run('({...S.res})')),pre,'queue charged resources early');
    produced[type]=0;
  }
  run(`globalThis.__p224Paid=[];globalThis.__p224FoodAfterPaymentMin=S.res.food;
    globalThis.__p224RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p224RealPay(cost,n);
      __p224Paid.push({type,count:n,cost:{...cost},foodAfter:S.res.food});
      __p224FoodAfterPaymentMin=Math.min(__p224FoodAfterPaymentMin,S.res.food)}`);
  const ready=()=>Object.entries(targets).every(([type,n])=>owned(run,type)>=n);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const next=plain(run('S.queue'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        paused[key]=(paused[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const payments=plain(run('__p224Paid'));
  const due={};
  for(const item of payments)for(const [rk,n] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+item.count*n;
  for(const [type,count] of Object.entries(produced))
    assert.equal(payments.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count);
  const result={before,requested,produced,due,seconds,paused,
    minFoodTickEnd,minFoodAfterPayment:run('__p224FoodAfterPaymentMin'),
    ready:ready(),after:snapshot(run)};
  if(result.ready){
    for(const [type,count] of Object.entries(requested))
      assert.equal(produced[type]||0,count);
  }else result.block={queue:result.after.queue,resources:result.after.resources};
  return result;
}
function seedRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p224Rng=${initial};globalThis.__p224Draws=0;
    Math.random=()=>{__p224Draws++;let x=__p224Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;__p224Rng=x>>>0;
      return __p224Rng/4294967296}`);
}
function battle(active,stage,flow,label){
  const run=active.run,before=snapshot(run);
  assert.equal(before.lastCleared,stage-1,`${label}: not at next stage`);
  assert.deepEqual(before.owned,targets);
  const enemy=plain(run(`(()=>{const e=CFG.enemies[${stage-1}];return{
    id:e.id,name:e.name,units:e.units,boss:!!e.boss,
    bossMult:e.bossMult||null,reward:e.reward}})()`));
  seedRng(run,flow,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`${label}: battle did not start`);
  const initialEnemy=plain(run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
    mageGroups:B.enemyUnits.filter(u=>u.type==='mage_t1').length,
    mageHp:B.enemyUnits.filter(u=>u.type==='mage_t1')
      .reduce((n,u)=>n+(u.maxHp||0),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p224Step()'),true,`${label}: async callback missing`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}: battle did not settle`);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const opponent=plain(run(`({remainingGroups:B.enemyUnits.filter(u=>u.alive!==false).length,
    remainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)})`));
  const draws=run('__p224Draws');
  run('exitBattle()');
  const after=snapshot(run);
  const losses=Object.fromEntries(Object.entries(targets)
    .map(([type,count])=>[type,count-after.owned[type]]));
  for(const [type,count] of Object.entries(losses))
    assert.ok(count>=0&&count<=targets[type]);
  const actualReward=Object.fromEntries(Object.keys(enemy.reward)
    .map(key=>[key,after.resources[key]-before.resources[key]]));
  const essenceDrops=Object.fromEntries([...new Set([
    ...Object.keys(before.essence),...Object.keys(after.essence)])]
    .map(key=>[key,(after.essence[key]||0)-(before.essence[key]||0)])
    .filter(([,count])=>count>0));
  const settled=saveReload(active,label);
  return{active:settled,result:{stage,flow,enemy,initialEnemy,won,round,callbacks,draws,
    opponent,losses,lossTotal:Object.values(losses).reduce((n,v)=>n+v,0),
    nominalReward:enemy.reward,actualReward,meritGain:after.merit-before.merit,
    essenceDrops,before,after,saveSha256:settled.sha256,save:settled.save}};
}
const officialL29=plain(restore(sourceCases[0].save).run(`(()=>{const e=CFG.enemies[28];
  return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
    bossMult:e.bossMult||null,reward:e.reward}})()`));
assert.equal(officialL29.id,29);
assert.equal(officialL29.name,'帝国军校学徒');
assert.deepEqual(officialL29.units.mage_t1,[11,8,5]);
for(const item of sourceCases){
  const old=item.oldEnemy;
  assert.deepEqual({...officialL29,name:old.name,
    units:{...officialL29.units,mage_t1:old.units.mage_t1}},old,
  'formal L29 changed fields beyond name and mage wave');
  assert.equal(sha(item.save),item.sha256);
  const state=snapshot(restore(item.save).run);
  assert.equal(state.lastCleared,28);
  assert.deepEqual(state.owned,targets);
}
const prepared=[];
for(const item of sourceCases)for(const plan of Object.keys(plans)){
  let active=restore(item.save);
  const state=formByActions(active.run,plan);
  active=saveReload(active,`source${item.sourceSeed}/${plan} L29 prepared`);
  prepared.push({sourceSeed:item.sourceSeed,plan,
    sha256:active.sha256,save:active.save,state});
}
const l29Trials=[];
const selectedL29=new Map();
for(const item of prepared)for(let flow=1;flow<=16;flow++){
  let active=restore(item.save);
  const fought=battle(active,29,flow,`source${item.sourceSeed}/${item.plan}/flow${flow} L29`);
  const result=fought.result;
  const expected=comparison.trials.find(x=>x.candidate==='mage24'&&
    x.sourceSeed===item.sourceSeed&&x.plan===item.plan&&x.flow===flow);
  assert.ok(expected);
  assert.deepEqual({won:result.won,round:result.round,
    enemyHp:result.opponent.remainingHp,losses:result.losses,
    lossTotal:result.lossTotal,rngDraws:result.draws},
    {won:expected.won,round:expected.round,
      enemyHp:expected.enemyHp,losses:expected.losses,
      lossTotal:expected.lossTotal,rngDraws:expected.rngDraws},
    `P218 candidate differs from formal ${item.sourceSeed}/${item.plan}/${flow}`);
  assert.deepEqual({groups:result.initialEnemy.groups,hp:result.initialEnemy.hp,
    attackMass:result.initialEnemy.attackMass,
    mageGroups:result.initialEnemy.mageGroups,mageHp:result.initialEnemy.mageHp},
    {groups:12,hp:111,attackMass:1071,mageGroups:3,mageHp:24});
  l29Trials.push({sourceSeed:item.sourceSeed,plan:item.plan,flow,
    preparedSha256:item.sha256,won:result.won,round:result.round,
    lossTotal:result.lossTotal,losses:result.losses,
    enemyHp:result.opponent.remainingHp,draws:result.draws,
    initialEnemy:result.initialEnemy,
    actualReward:result.actualReward,postSaveSha256:result.saveSha256});
  const selection=selections.find(x=>x.sourceSeed===item.sourceSeed&&
    x.plan===item.plan&&x.flow===flow);
  if(selection)selectedL29.set(`${item.sourceSeed}/${item.plan}/${flow}`,result);
}
assert.equal(l29Trials.length,64);
for(const plan of Object.keys(plans))for(let flow=1;flow<=16;flow++){
  const a=l29Trials.find(x=>x.sourceSeed===1&&x.plan===plan&&x.flow===flow);
  const b=l29Trials.find(x=>x.sourceSeed===15&&x.plan===plan&&x.flow===flow);
  assert.deepEqual({won:a.won,round:a.round,losses:a.losses,
    enemyHp:a.enemyHp,draws:a.draws},
    {won:b.won,round:b.round,losses:b.losses,
      enemyHp:b.enemyHp,draws:b.draws},
    `two paid sources differ for ${plan}/${flow}`);
}
function continueTrial(selection){
  const sourceTrial=selectedL29.get(
    `${selection.sourceSeed}/${selection.plan}/${selection.flow}`);
  assert.ok(sourceTrial?.won,`${JSON.stringify(selection)} lacks formal L29 win`);
  assert.equal(sha(sourceTrial.save),sourceTrial.saveSha256);
  let active=restore(sourceTrial.save);
  const sourceState=snapshot(active.run);
  assert.equal(sourceState.lastCleared,29);
  assert.equal(sourceState.army,73-sourceTrial.lossTotal);
  assert.deepEqual(sourceState.resources,sourceTrial.after.resources);
  assert.deepEqual(sourceState.owned,sourceTrial.after.owned);
  assert.deepEqual(sourceState.queue,sourceTrial.after.queue);
  const result={selection,sourceL29:{saveSha256:sourceTrial.saveSha256,
    victory:{round:sourceTrial.round,loss:sourceTrial.lossTotal,
      resources:sourceState.resources,army:sourceState.army},save:sourceTrial.save}};
  for(const stage of [30,31]){
    const replenishment=refill(active.run,`L${stage} replenishment`);
    result[`beforeL${stage}`]={replenishment};
    if(!replenishment.ready){result.blockedAt=`L${stage} replenishment`;break}
    active=saveReload(active,`L${stage} replenished`);
    result[`beforeL${stage}`].replenishedSaveSha256=active.sha256;
    result[`beforeL${stage}`].replenishedSave=active.save;
    const formation=formByActions(active.run,selection.plan);
    active=saveReload(active,`L${stage} prepared`);
    result[`beforeL${stage}`].prepared={state:formation,sha256:active.sha256,save:active.save};
    const fought=battle(active,stage,selection.flow,`L${stage} settled`);
    active=fought.active;
    result[`L${stage}`]=fought.result;
    if(!fought.result.won){result.blockedAt=`L${stage} battle`;break}
  }
  return result;
}
const trials=selections.map(continueTrial);
for(const trial of trials){
  assert.equal(trial.beforeL30?.replenishment.ready,true);
  assert.equal(trial.L30?.won,true);
  assert.equal(trial.beforeL31?.replenishment.ready,true);
  assert.equal(trial.L31?.won,true);
  for(const stage of [30,31]){
    const current=trial[`L${stage}`].enemy;
    const prior=priorHandoff.trials[0][`L${stage}`].enemy;
    assert.deepEqual(current,prior,`L${stage} formal enemy changed versus P219`);
  }
}
for(const input of inputs.filter(x=>['config.js','levels.js','math.js',
  'garrison.js','technology.js'].includes(x.file)))
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `${input.file} changed during probe`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const output={batch:'P224',sourceHead:head.stdout.trim(),
  scope:{source:'P201 two paid complete L29 prebattle saves',
    comparison:'P218 isolated mage24 candidate [11,8,5]',
    l29Flows:'1..16',l29Battles:l29Trials.length,
    l30L31Selections:selections,
    rng:'xorshift32 (flow*1009+stage*9176)>>>0',
    recoverySecondsMax:7200,nodeVmOnly:true,formalCfgOnly:true,
    noCfgOverride:true,noResourceOrTroopInjection:true,
    fixedVmNowMs:fixedEpoch},
  inputs,sources:sourceCases.map(({save,...item})=>item),officialL29,
  prepared:prepared.map(({save,...item})=>item),
  l29Trials,handoffs:trials};
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({batch:'P224',officialL29,
  l29Summary:Object.fromEntries(Object.keys(plans).map(plan=>{
    const rows=l29Trials.filter(x=>x.sourceSeed===1&&x.plan===plan);
    return[plan,{wins:rows.filter(x=>x.won).length,
      fullLossFlows:rows.filter(x=>x.lossTotal===73).map(x=>x.flow),
      meanLoss:rows.reduce((n,x)=>n+x.lossTotal,0)/rows.length}]})),
  handoffs:trials.map(t=>({selection:t.selection,
    l29Loss:t.sourceL29.victory.loss,
    l30Recovery:t.beforeL30?.replenishment.seconds,
    l30MinFoodAfterPayment:t.beforeL30?.replenishment.minFoodAfterPayment,
    l30MinFoodTickEnd:t.beforeL30?.replenishment.minFoodTickEnd,
    l30Due:t.beforeL30?.replenishment.due,
    l30:{won:t.L30.won,loss:t.L30.lossTotal,round:t.L30.round,
      actualReward:t.L30.actualReward},
    l31Recovery:t.beforeL31?.replenishment.seconds,
    l31:{won:t.L31.won,loss:t.L31.lossTotal,round:t.L31.round}})),
  output:outputPath},null,2));
