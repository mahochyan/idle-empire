'use strict';
// P219: continue authentic P215 L29 victory saves through paid L30/L31.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p215-live-l29-order-sweep.json');
const outputPath=path.join(root,'docs/codex/reports/data/p219-current-l29-l31-handoff.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
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
  {sourceSeed:1,flow:1,plan:'frontReverse',reason:'P214 Edge verified low-loss win'},
  {sourceSeed:15,flow:15,plan:'frontReverse',reason:'P214 Edge verified high-loss win, second paid source'},
  {sourceSeed:1,flow:4,plan:'frontReverse',reason:'P215 highest-loss reverse-order win'},
  {sourceSeed:1,flow:15,plan:'original',reason:'P215 highest-loss original-order win'}
];
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p215-live-l29-order-sweep.json',
  'tools/verify/probe-current-l29-l31-handoff-p219.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P215');
for(const file of inputFiles.slice(0,6))
  assert.equal(inputs.find(x=>x.file===file).sha256,
    source.inputs.find(x=>x.file===file)?.sha256,`${file} no longer matches P215`);
function installHarness(run){
  run(`globalThis.__p219Timers=new Map();globalThis.__p219NextTimer=1;
    globalThis.setTimeout=fn=>{const id=__p219NextTimer++;
      __p219Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p219Timers.delete(id);
    globalThis.__p219Step=()=>{const next=__p219Timers.entries().next().value;
      if(!next)return false;__p219Timers.delete(next[0]);next[1]();return true};
    globalThis.__p219Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p219Nodes.has(id))__p219Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p219Nodes.get(id)};
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
  run(`globalThis.__p219Paid=[];globalThis.__p219FoodAfterPaymentMin=S.res.food;
    globalThis.__p219RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p219RealPay(cost,n);
      __p219Paid.push({type,count:n,cost:{...cost},foodAfter:S.res.food});
      __p219FoodAfterPaymentMin=Math.min(__p219FoodAfterPaymentMin,S.res.food)}`);
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
  const payments=plain(run('__p219Paid'));
  const due={};
  for(const item of payments)for(const [rk,n] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+item.count*n;
  for(const [type,count] of Object.entries(produced))
    assert.equal(payments.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count);
  const result={before,requested,produced,due,seconds,paused,
    minFoodTickEnd,minFoodAfterPayment:run('__p219FoodAfterPaymentMin'),
    ready:ready(),after:snapshot(run)};
  if(result.ready){
    for(const [type,count] of Object.entries(requested))
      assert.equal(produced[type]||0,count);
  }else result.block={queue:result.after.queue,resources:result.after.resources};
  return result;
}
function seedRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p219Rng=${initial};globalThis.__p219Draws=0;
    Math.random=()=>{__p219Draws++;let x=__p219Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;__p219Rng=x>>>0;
      return __p219Rng/4294967296}`);
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
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p219Step()'),true,`${label}: async callback missing`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}: battle did not settle`);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const opponent=plain(run(`({remainingGroups:B.enemyUnits.filter(u=>u.alive!==false).length,
    remainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)})`));
  const draws=run('__p219Draws');
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
  return{active:settled,result:{stage,flow,enemy,won,round,callbacks,draws,
    opponent,losses,lossTotal:Object.values(losses).reduce((n,v)=>n+v,0),
    nominalReward:enemy.reward,actualReward,meritGain:after.merit-before.merit,
    essenceDrops,before,after,saveSha256:settled.sha256,save:settled.save}};
}
function continueTrial(selection){
  const sourceTrial=source.trials.find(t=>t.sourceSeed===selection.sourceSeed&&
    t.flow===selection.flow&&t.plan===selection.plan);
  assert.ok(sourceTrial?.battle.won,`${JSON.stringify(selection)} lacks L29 win`);
  assert.equal(sha(sourceTrial.post.save),sourceTrial.post.sha256);
  let active=restore(sourceTrial.post.save);
  const sourceState=snapshot(active.run);
  assert.equal(sourceState.lastCleared,29);
  assert.equal(sourceState.army,73-sourceTrial.battle.lossTotal);
  assert.deepEqual(sourceState.resources,sourceTrial.post.state.resources);
  assert.deepEqual(sourceState.owned,sourceTrial.post.state.owned);
  assert.deepEqual(sourceState.queue,sourceTrial.post.state.queue);
  const result={selection,sourceL29:{saveSha256:sourceTrial.post.sha256,
    victory:{round:sourceTrial.battle.round,loss:sourceTrial.battle.lossTotal,
      resources:sourceState.resources,army:sourceState.army},save:sourceTrial.post.save}};
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
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const trials=selections.map(continueTrial);
const output={batch:'P219',sourceHead:head.stdout.trim(),
  scope:{source:'P215 real paid L29 victory saves',selections,
    stages:[30,31],rng:'xorshift32 (flow*1009+stage*9176)>>>0',
    recoverySecondsMax:7200,nodeVmOnly:true,formalCfgOnly:true,
    noResourceOrTroopInjection:true},
  inputs,trials};
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(trials.map(t=>({selection:t.selection,
  l29Loss:t.sourceL29.victory.loss,
  l30Recovery:t.beforeL30?.replenishment.seconds,
  l30Ready:t.beforeL30?.replenishment.ready,
  l30:t.L30&&{won:t.L30.won,loss:t.L30.lossTotal,round:t.L30.round},
  l31Recovery:t.beforeL31?.replenishment.seconds,
  l31Ready:t.beforeL31?.replenishment.ready,
  l31:t.L31&&{won:t.L31.won,loss:t.L31.lossTotal,round:t.L31.round},
  blockedAt:t.blockedAt||null})),null,2));
