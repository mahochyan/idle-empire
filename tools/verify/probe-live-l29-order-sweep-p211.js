'use strict';
// P211: two paid P201 L29 source saves, 16 fixed RNG streams, two legal orders.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const outputPath=path.join(root,'docs/codex/reports/data/p211-live-l29-order-sweep.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
const orderPlans={
  original:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]],
  frontReverse:[['front','infantry_t1',15],['front','cavalry_wind',15],
    ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]]
};
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tests/progression/cavalry_wind_semantics.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'tools/verify/probe-live-l29-order-sweep-p211.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P201');
function sourceCase(sourceSeed){
  const profile=source.profiles.find(p=>p.seed===sourceSeed&&p.route==='t2SecondBack73');
  const stage=profile?.stages.find(s=>s.stage===29);
  assert.ok(stage?.l29PreparedSave);
  assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
  return {sourceSeed,save:stage.l29PreparedSave,sha256:stage.beforeSaveSha256,
    enemy:stage.enemy.config};
}
const sourceCases=[sourceCase(1),sourceCase(15)];
function installHarness(run){
  run(`globalThis.__p211Timers=new Map();globalThis.__p211TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p211TimerId++;
      __p211Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p211Timers.delete(id);
    globalThis.__p211Step=()=>{const next=__p211Timers.entries().next().value;
      if(!next)return false;__p211Timers.delete(next[0]);next[1]();return true};
    globalThis.__p211Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p211Nodes.has(id))__p211Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p211Nodes.get(id)};
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
function owned(run,type){
  return run(`(S.pool.${type}||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function formation(run){
  return plain(run(`Object.fromEntries(['front','mid','back'].map(row=>
    [row,S.formation[row].map(u=>({type:u.type,count:u.count}))]))`));
}
function snapshot(run){
  return plain(run(`({tick:S.tick,lastCleared:S.defeated.at(-1),
    resources:{...S.res},merit:S.merit,essence:{...S.essence},
    army:armyCount(),owned:Object.fromEntries(
      ['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
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
function formByActions(run,planKey){
  const before=snapshot(run),placements=orderPlans[planKey];
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
    assert.deepEqual(formation(run)[row],expected[row]);
  }
  const after=snapshot(run);
  assert.deepEqual(after.formation,expected);
  assert.deepEqual(after.owned,before.owned);
  assert.deepEqual(after.resources,before.resources);
  assert.deepEqual(after.queue,before.queue);
  assert.equal(after.army,73);
  return {before,after};
}
function seedRng(run,flow,stage){
  const initial=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p211Rng=${initial};
    globalThis.__p211RngStats={draws:0,sortTieDraws:0,sortTieIndices:[]};
    Math.random=()=>{
      const stats=__p211RngStats;
      stats.draws++;
      if((new Error().stack||'').includes('sortFn')){
        stats.sortTieDraws++;
        if(stats.sortTieIndices.length<12)stats.sortTieIndices.push(stats.draws);
      }
      let x=__p211Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __p211Rng=x>>>0;return __p211Rng/4294967296};`);
}
function battleInit(run){
  return plain(run(`({tactic:B.tactic.name,
    our:B.ourUnits.map(u=>({type:u.type,row:u.row,count:u.initialCount,
      hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,tag:u.tag})),
    enemy:B.enemyUnits.map(u=>({type:u.type,row:u.row,count:u.initialCount,
      hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,tag:u.tag}))})`));
}
function firstRoundLog(run){
  const msgs=plain(run('B.msgs.map(x=>x.m)'));
  const end=msgs.findIndex(x=>x.includes('回合1结束'));
  const first=msgs.slice(0,end<0?msgs.length:end);
  const attacks=first.filter(x=>/^\[(我方|敌方)\]/.test(x));
  return {attackMessages:attacks.slice(0,24),
    actorOrder:attacks.map(x=>x.match(/^\[(我方|敌方)\]([^→]+) →/)?.[2]?.trim()||null)
      .slice(0,24),
    fullLogSha256:sha(JSON.stringify(msgs)),messageCount:msgs.length};
}
function fight(run,flow){
  assert.equal(run('S.defeated.at(-1)'),28);
  const before=snapshot(run);
  seedRng(run,flow,29);
  run('selEnemy(28);openBattle()');
  assert.equal(run('S.battleActive'),true);
  const initial=battleInit(run);
  assert.equal(initial.tactic,'稳扎稳打');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p211Step()'),true,'async battle callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run('S.defeated.includes(29)');
  const round=run('B.round');
  const opponent=plain(run(`({remainingGroups:B.enemyUnits.filter(u=>u.alive!==false).length,
    remainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)})`));
  const rng=plain(run('__p211RngStats'));
  const firstRound=firstRoundLog(run);
  const after=snapshot(run);
  const losses=Object.fromEntries(Object.entries(targets)
    .map(([type,count])=>[type,count-after.owned[type]]));
  for(const [type,count] of Object.entries(losses))
    assert.ok(count>=0&&count<=targets[type]);
  const lossTotal=Object.values(losses).reduce((a,b)=>a+b,0);
  run('exitBattle()');
  return {won,round,callbacks,opponent,rng,firstRound,
    losses,lossTotal,initial,before,after};
}
function refill(run){
  const before=snapshot(run),requested={},produced={},due={},paused={};
  let minFood=before.resources.food;
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'');
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)
      return {ready:false,before,requested,seconds:0,
        block:{phase:'queue',type,action,resources:plain(run('({...S.res})'))}};
    assert.deepEqual(plain(run('({...S.res})')),pre);
    produced[type]=0;
  }
  run(`globalThis.__p211Paid=[];globalThis.__p211OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p211OriginalPay(cost,n);
      __p211Paid.push({type,count:n,cost:{...cost}})}`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    const next=plain(run('S.queue'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;paused[key]=(paused[key]||0)+1;}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p211Paid'));
  for(const item of paid)for(const [rk,c] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+c*item.count;
  for(const [type,count] of Object.entries(produced))
    assert.equal(paid.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count);
  const result={before,requested,produced,due,seconds,minFood,
    paused,ready:ready(),after:snapshot(run)};
  if(result.ready)for(const [type,count] of Object.entries(requested))
    assert.equal(produced[type]||0,count);
  else result.block={phase:'training-time-or-resource',queues:result.after.queue,
    resources:result.after.resources};
  return result;
}

const sourceFacts=sourceCases.map(item=>{
  const active=restore(item.save),state=snapshot(active.run);
  assert.equal(state.lastCleared,28);
  assert.deepEqual(state.owned,targets);
  const enemy=plain(active.run(`(()=>{const e=CFG.enemies[28];return{
    id:e.id,name:e.name,units:e.units,boss:!!e.boss,
    bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(enemy,item.enemy);
  return {sourceSeed:item.sourceSeed,sha256:item.sha256,state};
});
const trials=[];
for(const item of sourceCases)for(let flow=1;flow<=16;flow++)
  for(const plan of Object.keys(orderPlans)){
    let active=restore(item.save);
    const action=formByActions(active.run,plan);
    active=saveReload(active,`source${item.sourceSeed}/flow${flow}/${plan} prepared`);
    const preparedSha256=active.sha256;
    const result=fight(active.run,flow);
    active=saveReload(active,`source${item.sourceSeed}/flow${flow}/${plan} settled`);
    trials.push({sourceSeed:item.sourceSeed,flow,plan,
      prepared:{sha256:preparedSha256,state:action.after},
      battle:result,post:{sha256:active.sha256,state:snapshot(active.run),
        save:active.save}});
  }
for(const flow of Array.from({length:16},(_,i)=>i+1))
  for(const plan of Object.keys(orderPlans)){
    const first=trials.find(t=>t.sourceSeed===1&&t.flow===flow&&t.plan===plan);
    const second=trials.find(t=>t.sourceSeed===15&&t.flow===flow&&t.plan===plan);
    assert.deepEqual(first.battle.initial,second.battle.initial,
      `source battle initialization differs at flow${flow}/${plan}`);
    assert.deepEqual({won:first.battle.won,round:first.battle.round,
      opponent:first.battle.opponent,losses:first.battle.losses,
      rng:first.battle.rng,firstRound:first.battle.firstRound.actorOrder},
      {won:second.battle.won,round:second.battle.round,
        opponent:second.battle.opponent,losses:second.battle.losses,
        rng:second.battle.rng,firstRound:second.battle.firstRound.actorOrder},
      `source crosscheck differs at flow${flow}/${plan}`);
  }
const representative=trials.filter(t=>t.sourceSeed===1);
const paired=Array.from({length:16},(_,i)=>{
  const flow=i+1;
  const original=representative.find(t=>t.flow===flow&&t.plan==='original');
  const reverse=representative.find(t=>t.flow===flow&&t.plan==='frontReverse');
  return {flow,original:{won:original.battle.won,loss:original.battle.lossTotal,
    enemyHp:original.battle.opponent.remainingHp},
    frontReverse:{won:reverse.battle.won,loss:reverse.battle.lossTotal,
      enemyHp:reverse.battle.opponent.remainingHp}};
});
const reverseDefeats=representative.filter(t=>t.plan==='frontReverse'&&!t.battle.won)
  .sort((a,b)=>b.battle.lossTotal-a.battle.lossTotal||
    b.battle.opponent.remainingHp-a.battle.opponent.remainingHp||a.flow-b.flow);
let recovery=null;
if(reverseDefeats.length){
  const selected=reverseDefeats[0];
  let active=restore(selected.post.save);
  assert.deepEqual(snapshot(active.run),selected.post.state);
  const replenishment=refill(active.run);
  const result={sourceSeed:selected.sourceSeed,flow:selected.flow,
    selection:'greatest losses, then greatest enemy HP, then lowest flow',
    failedPostSaveSha256:selected.post.sha256,replenishment};
  if(replenishment.ready){
    active=saveReload(active,'worst reverse defeat replenished');
    const action=formByActions(active.run,'frontReverse');
    active=saveReload(active,'worst reverse defeat retry prepared');
    const retryPrepared={sha256:active.sha256,save:active.save,state:action.after};
    const battle=fight(active.run,selected.flow);
    active=saveReload(active,'worst reverse defeat retry settled');
    Object.assign(result,{retryPrepared,battle,
      post:{sha256:active.sha256,save:active.save,state:snapshot(active.run)}});
  }
  recovery=result;
}
for(const item of inputs.filter(x=>['math.js','levels.js','config.js'].includes(x.file)))
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `${item.file} changed during probe`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P211',sourceHead:head.stdout.trim(),
  scope:{source:'P201 t2SecondBack73 two paid L29 complete saves',
    fixedFlows:'1..16',uniqueRngStreams:16,sourceCrosschecks:2,
    totalBattleTrials:trials.length,stage:29,
    rng:'xorshift32 (flow*1009+29*9176)>>>0',
    noCombatOrConfigOverride:true,noResourceOrTroopInjection:true,
    note:'Two source saves have identical battle initialization after live 73-unit formation; do not count them as independent streams.'},
  sourceFacts,orderPlans,paired,trials,recovery,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P211',sourceFacts:sourceFacts.map(x=>({sourceSeed:x.sourceSeed,
  sha256:x.sha256,food:x.state.resources.food})),paired,
  summary:Object.fromEntries(Object.keys(orderPlans).map(plan=>[plan,{
    wins:representative.filter(t=>t.plan===plan&&t.battle.won).length,
    losses:representative.filter(t=>t.plan===plan&&!t.battle.won).length}])),
  tieSamples:representative.filter(t=>[1,15].includes(t.flow)).map(t=>({
    flow:t.flow,plan:t.plan,rng:t.battle.rng,
    actorOrder:t.battle.firstRound.actorOrder.slice(0,12)})),
  recovery:recovery&&{flow:recovery.flow,ready:recovery.replenishment.ready,
    seconds:recovery.replenishment.seconds,due:recovery.replenishment.due,
    minFood:recovery.replenishment.minFood,
    retry:recovery.battle&&{won:recovery.battle.won,
      loss:recovery.battle.lossTotal,enemyHp:recovery.battle.opponent.remainingHp}},
  output:outputPath},null,2));
