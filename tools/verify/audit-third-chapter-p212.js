'use strict';
// P212: read-only current L27-L31 enemy panel and paid P210 route replay.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, 'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const historicPath = path.join(root, 'docs/codex/reports/data/p210-live-l29-formation.json');
const l31HistoricPath = path.join(root, 'docs/codex/reports/data/p197-current-l30-l31-handoff.json');
const outputPath = path.join(root, 'docs/codex/reports/data/p212-third-chapter-audit.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const historic = JSON.parse(fs.readFileSync(historicPath, 'utf8'));
const l31Historic = JSON.parse(fs.readFileSync(l31HistoricPath, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const targets = {bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
const maxRecoverySeconds = 7200;
const plans = [
  {key:'original', placements:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',13],['back','archer_t1',15]]},
  {key:'front-reverse', placements:[['front','infantry_t1',15],['front','cavalry_wind',15],
    ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]]},
  {key:'archers-reverse', placements:[['front','bronze_guard',15],['front','cavalry_wind',15],
    ['front','infantry_t1',15],['back','archer_t1',15],['back','archer_t1',13]]},
  {key:'wind-mid', placements:[['front','bronze_guard',15],['front','infantry_t1',15],
    ['mid','cavalry_wind',15],['back','archer_t1',13],['back','archer_t1',15]]},
  {key:'wind-back-one-archer-mid', placements:[['front','bronze_guard',15],
    ['front','infantry_t1',15],['mid','archer_t1',13],['back','cavalry_wind',15],
    ['back','archer_t1',15]]},
  {key:'wind-back-two-archers-mid', placements:[['front','bronze_guard',15],
    ['front','infantry_t1',15],['mid','archer_t1',13],['mid','archer_t1',15],
    ['back','cavalry_wind',15]]}
];
assert.equal(source.batch, 'P201');
assert.equal(historic.batch, 'P210');
const inputFiles = ['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tests/progression/cavalry_wind_semantics.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'docs/codex/reports/data/p210-live-l29-formation.json',
  'docs/codex/reports/data/p197-current-l30-l31-handoff.json',
  'tools/verify/audit-third-chapter-p212.js'];
const inputs = inputFiles.map(file => ({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(inputs.find(x=>x.file==='docs/codex/reports/data/p210-live-l29-formation.json').sha256,
  'b9dcb28e9d62b1aa45e9784246cc26050b351d6e16907c743d0c96b11b4b6100');
function sourceFor(seed) {
  const profile = source.profiles.find(p => p.seed === seed && p.route === 't2SecondBack73');
  const stage = profile?.stages.find(s => s.stage === 29);
  assert.ok(stage?.l29PreparedSave, `P201 seed ${seed} L29 完整档缺失`);
  assert.equal(sha(stage.l29PreparedSave), stage.beforeSaveSha256);
  return {seed,save:stage.l29PreparedSave,sha256:stage.beforeSaveSha256,
    oldBattle:stage.battle,enemy:stage.enemy.config};
}
function installHarness(run) {
  run(`globalThis.__p210Timers = new Map();globalThis.__p210TimerId = 1;
    globalThis.setTimeout = fn => {const id = __p210TimerId++;
      __p210Timers.set(id, fn);return id};
    globalThis.clearTimeout = id => __p210Timers.delete(id);
    globalThis.__p210Step = () => {const next = __p210Timers.entries().next().value;
      if(!next)return false;__p210Timers.delete(next[0]);next[1]();return true};
    globalThis.__p210Nodes = new Map();document.getElementById = id => {
      if(id.startsWith('ou-') || id.startsWith('eu-'))return null;
      if(!__p210Nodes.has(id))__p210Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p210Nodes.get(id)};
    globalThis.addLog = m => S.log.push(String(m));Math.random = () => 0.5;`);
}
function restore(save) {
  const world = environment({rts_save:save});
  const run = world.run;
  assert.equal(run('loadSaveAndApply().status'), 'ok');
  assert.equal(run('saveProtected()'), false);
  installHarness(run);
  return {world,run};
}
function owned(run,type) {
  return run(`(S.pool.${type}||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function formation(run) {
  return plain(run(`Object.fromEntries(['front','mid','back'].map(row=>
    [row,S.formation[row].map(u=>({type:u.type,count:u.count}))]))`));
}
function snapshot(run) {
  return plain(run(`({tick:S.tick,lastCleared:S.defeated.at(-1),
    defeated:[...S.defeated],population:popCurrent(),resources:{...S.res},
    essence:{...S.essence},merit:S.merit,army:armyCount(),
    owned:Object.fromEntries(['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
      .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),formation:Object.fromEntries(
      ['front','mid','back'].map(row=>[row,S.formation[row].map(u=>({type:u.type,count:u.count}))])),
    foodRate:prodRate('food'),upkeep:totalUpkeep(),
    rowSlots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')},
    regMax:regMax()})`));
}
function saveReload(active,label) {
  const before = snapshot(active.run);
  assert.equal(active.run('save().ok'), true, `${label}: 保存失败`);
  const save = active.world.store.get('rts_save');
  assert.equal(typeof save, 'string');
  const next = restore(save);
  assert.deepEqual(snapshot(next.run), before, `${label}: 重载后状态改变`);
  return {...next,save,sha256:sha(save)};
}
function seedRng(run,seed,stage) {
  const initial = (seed*1009+stage*9176)>>>0;
  run(`globalThis.__p210Rng=${initial};Math.random=()=>{
    let x=__p210Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p210Rng=x>>>0;return __p210Rng/4294967296}`);
}
function executePlan(run,plan) {
  const before = snapshot(run);
  assert.equal(before.lastCleared===28 || before.lastCleared===29, true);
  assert.deepEqual(before.owned, targets, '编队前实有兵数必须为 73');
  assert.equal(before.army, 73);
  run("clrForm('expedition')");
  assert.equal(run('formCnt()'), 0);
  const placed = {front:[],mid:[],back:[]};
  for(const [row,type,count] of plan.placements) {
    const idx = placed[row].length;
    assert.ok(idx < run(`rowSlots('${row}')`), `${plan.key}: ${row} ${idx} 未开放`);
    assert.ok(count <= run('regMax()'));
    assert.ok(owned(run,type) >= count);
    assert.ok(run(`poolAvail('${type}')`) >= count);
    run(`openFormModal('expedition','${row}',${idx})`);
    assert.equal(run(`document.getElementById('form-modal-content').innerHTML
      .includes('data-type="${type}"')`),true,
      `${plan.key}: ${row} 第 ${idx+1} 格未提供 ${type} 选项`);
    run(`selModalUnit({classList:{add(){}}},'${type}',poolAvail('${type}'));
      setModalQty(${count});confirmForm()`);
    placed[row].push({type,count});
    assert.deepEqual(formation(run)[row], placed[row],
      `${plan.key}: 弹窗编入未按请求执行`);
  }
  assert.deepEqual(formation(run),placed);
  const after = snapshot(run);
  assert.deepEqual(after.owned,before.owned,`${plan.key}: 不得新增或丢失士兵`);
  assert.deepEqual(after.resources,before.resources,`${plan.key}: 重排不应改变资源`);
  assert.deepEqual(after.queue,before.queue,`${plan.key}: 重排不应改变训练队列`);
  assert.equal(after.army,73);
  return {before,after,actions:['clrForm',...plan.placements.map(
    ([row,type,count])=>`openFormModal/selModalUnit/setModalQty/confirmForm ${row} ${type} ${count}`)]};
}
function fight(run,stage,seed) {
  assert.equal(run('S.defeated.at(-1)'),stage-1);
  const before = snapshot(run);
  seedRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('B.tactic.name'), '稳扎稳打', '关卡战术必须来自正式入口');
  let callbacks=0;
  while(run('S.battleActive') && callbacks<1000) {
    assert.equal(run('__p210Step()'),true,`L${stage} 异步回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage} 未结算`);
  const round=run('B.round');
  const won=run(`S.defeated.includes(${stage})`);
  const opponent=plain(run(`({remainingGroups:B.enemyUnits.filter(u=>u.alive!==false).length,
    remainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0),
    initialHp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0)})`));
  const after=snapshot(run);
  const losses=Object.fromEntries(Object.entries(targets)
    .map(([type,n])=>[type,n-after.owned[type]]));
  for(const [type,n] of Object.entries(losses))
    assert.ok(n>=0 && n<=targets[type],`${type}: 战损越界`);
  const lossTotal=Object.values(losses).reduce((a,b)=>a+b,0);
  run('exitBattle()');
  return {won,round,callbacks,opponent,losses,lossTotal,before,after};
}
function refill(run) {
  const before=snapshot(run);
  const requested={},produced={},due={},pausedQueueSeconds={};
  let minFood=before.resources.food;
  for(const [type,target] of Object.entries(targets)) {
    const have=owned(run,type),queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'',`${type}: 训练锁`);
    const resources=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok || action.qty!==need)
      return {ready:false,before,requested,seconds:0,
        block:{phase:'queue',type,action,resources:plain(run('({...S.res})'))}};
    assert.deepEqual(plain(run('({...S.res})')),resources,'排队时不应预扣资源');
    produced[type]=0;
  }
  run(`globalThis.__p210Paid=[];globalThis.__p210OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p210OriginalPay(cost,n);
      __p210Paid.push({type,count:n,cost:{...cost}})}`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!ready() && seconds<maxRecoverySeconds) {
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)) {
      if(q.count>0 && q.reason) {
        const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1;
      }
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p210Paid'));
  for(const item of paid)for(const [rk,c] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+c*item.count;
  for(const [type,count] of Object.entries(produced))
    assert.equal(paid.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count,
      `${type}: 实产与付款人数不一致`);
  const result={before,requested,produced,paid,due,seconds,minFood,
    pausedQueueSeconds,ready:ready(),after:snapshot(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`${type}: 未实产到目标`);
  else result.block={phase:'training-time-or-resource',queues:result.after.queue,
    resources:result.after.resources};
  return result;
}

const sourceCases=[sourceFor(1),sourceFor(15)];
const opening=restore(sourceCases[0].save);
const gate=plain(opening.run(`({slots:{front:rowSlots('front'),mid:rowSlots('mid'),
  back:rowSlots('back')},regMax:regMax(),windUnlocked:!!S.upgradedUnits.cavalry_wind,
  windRanged:isRanged('cavalry_wind'),tactics:CFG.tactics,
  currentTacticCode:'initBattleState() sets tkey=steady; no saved tactic action'})`));
const mageGate=plain(opening.run(`({bossIds:S.defeated.filter(id=>
  CFG.enemies.find(e=>e.id===id)?.boss),bossCount:bossDefeatedCount(),
  pageVisible:mageOk(),towerNeedBoss:CFG.buildings.mage_tower.needBoss,
  towerLv:bldSt('mage_tower').lv,towerTier:bldSt('mage_tower').tier,
  mageRootUnlocked:!!S.upgradedUnits.mage_t1,
  mageTrainLock:trainLockReason('mage_t1'),
  ironPassive:CFG.units.cavalry_iron.passive,
  ironTrainLock:trainLockReason('cavalry_iron')})`));
const mageBuildAttempt=plain(opening.run("buildAct('mage_tower')"));
assert.equal(mageGate.bossCount,2);
assert.equal(mageGate.towerNeedBoss,4);
assert.equal(mageGate.towerLv,0);
assert.equal(mageBuildAttempt.reason,'need-boss');
assert.deepEqual(gate.slots,{front:3,mid:3,back:2});
assert.equal(gate.regMax,15);
assert.equal(gate.windUnlocked,true);
assert.equal(gate.windRanged,true);
for(const sourceCase of sourceCases) {
  const loaded=restore(sourceCase.save);
  assert.equal(snapshot(loaded.run).lastCleared,28);
  assert.deepEqual(snapshot(loaded.run).owned,targets);
  const current=plain(loaded.run(`(()=>{const e=CFG.enemies[28];return{
    id:e.id,name:e.name,units:e.units,boss:!!e.boss,
    bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(current,sourceCase.enemy,'L29 敌阵须与实付源档一致');
}
const trials=[];
for(const sourceCase of sourceCases)for(const plan of plans) {
  let active=restore(sourceCase.save);
  const action=executePlan(active.run,plan);
  active=saveReload(active,`seed${sourceCase.seed} ${plan.key} L29 战前`);
  assert.deepEqual(formation(active.run),action.after.formation);
  const prepared={sha256:active.sha256,save:active.save};
  const battle=fight(active.run,29,sourceCase.seed);
  active=saveReload(active,`seed${sourceCase.seed} ${plan.key} L29 战后`);
  trials.push({seed:sourceCase.seed,plan:plan.key,actions:action.actions,
    prepared:{sha256:prepared.sha256,state:action.after},
    battle,post:{sha256:active.sha256,state:snapshot(active.run)},
    // Only victorious checkpoints are needed for paid L30 continuation.
    ...(battle.won?{postSave:active.save}:{} )});
}
function continueTrial(selected) {
  const seed=selected.seed;
  assert.equal(selected.battle.won,true);
  const plan=plans.find(p=>p.key===selected.plan);
  let active=restore(selected.postSave);
  assert.equal(snapshot(active.run).lastCleared,29);
  const recovery=refill(active.run);
  if(!recovery.ready) {
    return {seed,selected:plan.key,recovery,l30:null};
  }
  active=saveReload(active,`seed${seed} ${plan.key} L30 补兵后`);
  const forming=executePlan(active.run,plan);
  active=saveReload(active,`seed${seed} ${plan.key} L30 战前`);
  const l30Prepared={sha256:active.sha256,save:active.save,state:snapshot(active.run)};
  const l30=fight(active.run,30,seed);
  active=saveReload(active,`seed${seed} ${plan.key} L30 战后`);
  return {seed,selected:plan.key,recovery,forming:forming.after,
    l30Prepared,l30,post:{sha256:active.sha256,state:snapshot(active.run),
      save:active.save}};
}
const continuations=[];
for(const seed of [1,15]) {
  const winners=trials.filter(t=>t.seed===seed&&t.battle.won)
    .sort((a,b)=>a.battle.lossTotal-b.battle.lossTotal||
      plans.findIndex(p=>p.key===a.plan)-plans.findIndex(p=>p.key===b.plan));
  continuations.push(winners.length?continueTrial(winners[0]):
    {seed,selected:null,reason:'L29 no winning tested plan'});
}
const commonPlanContinuations=[1,15].map(seed=>{
  const previous=continuations.find(c=>c.seed===seed&&c.selected==='front-reverse');
  if(previous)return previous;
  const selected=trials.find(t=>t.seed===seed&&t.plan==='front-reverse');
  return selected?.battle.won?continueTrial(selected):
    {seed,selected:'front-reverse',reason:'L29 lost'};
});
const enemyPanel=[];
for(const stage of [27,28,29,30,31]){
  const {run}=restore(sourceCases[0].save);
  const panel=plain(run(`(()=>{
    S.selEnemy=${stage-1};S.battleEncounter=null;B.isTraining=false;
    initBattleState();const e=CFG.enemies[${stage-1}];
    return {stage:${stage},name:e.name,boss:!!e.boss,
      bossMult:e.bossMult||null,units:e.units,reward:e.reward,
      drops:e.drops||null,groups:B.enemyUnits.length,maxRound:B.maxRound,
      hp:B.enemyUnits.reduce((n,u)=>n+u.maxHp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      byType:Object.fromEntries([...new Set(B.enemyUnits.map(u=>u.type))]
        .map(k=>[k,{groups:B.enemyUnits.filter(u=>u.type===k).length,
          hp:B.enemyUnits.filter(u=>u.type===k).reduce((n,u)=>n+u.maxHp,0),
          attackMass:B.enemyUnits.filter(u=>u.type===k)
            .reduce((n,u)=>n+u.atk*combatAttackMass(u),0)}]))}
  })()`));
  enemyPanel.push(panel);
}
const trialComparison=trials.map(t=>{
  const old=historic.trials.find(x=>x.seed===t.seed&&x.plan===t.plan);
  assert.ok(old);
  return{seed:t.seed,plan:t.plan,
    preparedStateMatch:JSON.stringify(t.prepared.state)===JSON.stringify(old.prepared.state),
    battleMatch:JSON.stringify(t.battle)===JSON.stringify(old.battle),
    postStateMatch:JSON.stringify(t.post.state)===JSON.stringify(old.post.state)};
});
const continuationComparison=commonPlanContinuations.map(c=>{
  const old=historic.commonPlanContinuations.find(x=>x.seed===c.seed);
  assert.ok(old);
  return{seed:c.seed,selected:c.selected,
    recoveryMatch:JSON.stringify(c.recovery)===JSON.stringify(old.recovery),
    l30PreparedStateMatch:JSON.stringify(c.l30Prepared?.state)===
      JSON.stringify(old.l30Prepared?.state),
    l30BattleMatch:JSON.stringify(c.l30)===JSON.stringify(old.l30),
    postStateMatch:JSON.stringify(c.post?.state)===JSON.stringify(old.post?.state)};
});
const allMatch=[...trialComparison,...continuationComparison]
  .every(row=>Object.entries(row).filter(([k])=>k.endsWith('Match'))
    .every(([,v])=>v===true));
const currentL31=[];
assert.equal(l31Historic.batch,'P197');
for(const historicProfile of l31Historic.profiles) {
  const sourceSave=historicProfile.l31Prepared.save;
  assert.equal(sha(sourceSave),historicProfile.l31Prepared.saveSha256,
    'P197 L31 战前完整档 SHA 错误');
  let active=restore(sourceSave);
  const run=active.run;
  assert.equal(run('S.defeated.at(-1)'),30);
  const beforeResources=plain(run('({...S.res})'));
  const beforeOwned=Object.fromEntries(Object.keys(historicProfile.targets)
    .map(type=>[type,owned(run,type)]));
  const beforeDeployed=Object.fromEntries(Object.keys(historicProfile.targets)
    .map(type=>[type,formation(run).front.concat(formation(run).mid,formation(run).back)
      .filter(unit=>unit.type===type).reduce((sum,unit)=>sum+unit.count,0)]));
  assert.deepEqual(beforeDeployed,historicProfile.targets);
  seedRng(run,historicProfile.combatSeed,31);
  run('selEnemy(30);openBattle()');
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000) {
    assert.equal(run('__p210Step()'),true,'L31 异步回调丢失');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const afterOwned=Object.fromEntries(Object.keys(historicProfile.targets)
    .map(type=>[type,owned(run,type)]));
  const afterResources=plain(run('({...S.res})'));
  const lossByType=Object.fromEntries(Object.keys(historicProfile.targets)
    .map(type=>[type,beforeOwned[type]-afterOwned[type]]));
  const battle={won:run('S.defeated.includes(31)'),round:run('B.round'),callbacks,
    beforeDeployed,lossByType,
    lossTotal:Object.values(lossByType).reduce((sum,n)=>sum+n,0),
    actualReward:Object.fromEntries(Object.keys(historicProfile.l31.enemy.reward)
      .map(key=>[key,afterResources[key]-beforeResources[key]]))};
  run('exitBattle()');
  active=saveReload(active,`P197 ${historicProfile.sourceKind} 流${historicProfile.combatSeed} L31 战后`);
  assert.deepEqual(battle,historicProfile.l31.battle,
    '当前 L31 战果与 P197 已付旧档不同');
  const battleMatch=true;
  currentL31.push({sourceKind:historicProfile.sourceKind,
    sourceSeed:historicProfile.sourceSeed,combatSeed:historicProfile.combatSeed,
    sourceSaveSha256:historicProfile.l31Prepared.saveSha256,
    battle,battleMatch,postSaveSha256:active.sha256,postSave:active.save});
}
for(const file of ['config.js','levels.js','math.js','garrison.js'])
  assert.equal(sha(fs.readFileSync(path.join(root,file))),
    inputs.find(x=>x.file===file).sha256,`${file} 在回放时变化`);
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P212',sourceHead:head.stdout.trim(),
  scope:{source:'P201 exact paid L29 t2SecondBack73 pre-battle saves',
    seeds:[1,15],rng:'P201 xorshift32 (seed*1009+stage*9176)>>>0',
    maxRecoverySeconds,unit:'simulated online seconds',
    noResourceOrTroopInjection:true,noCombatOrConfigOverride:true,
    instrumentation:'Only DOM/timers, deterministic Math.random and payTrainingCost observation',
    tactic:'Only steady is selectable through the current formal battle entry'},
  sourceCases:sourceCases.map(({save,...rest})=>rest),gate,mageGate,
  mageBuildAttempt,plans,trials,
  continuations,commonPlanContinuations,enemyPanel,currentL31,
  historicP210:{sha256:inputs.find(x=>x.file===
    'docs/codex/reports/data/p210-live-l29-formation.json').sha256,
    allMatch,trialComparison,continuationComparison},inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P212',gate,mageGate,mageBuildAttempt,enemyPanel,
  historicP210:artifact.historicP210,
  currentL31:currentL31.map(({postSave,...rest})=>rest),
  trials:trials.map(t=>({seed:t.seed,plan:t.plan,won:t.battle.won,
    round:t.battle.round,loss:t.battle.lossTotal,opponent:t.battle.opponent,
    postFood:t.post.state.resources.food})),
  continuations:continuations.map(c=>({seed:c.seed,selected:c.selected,
    recovery:c.recovery&&{ready:c.recovery.ready,seconds:c.recovery.seconds,
      due:c.recovery.due,minFood:c.recovery.minFood,block:c.recovery.block},
    l30:c.l30&&{won:c.l30.won,round:c.l30.round,loss:c.l30.lossTotal,
      opponent:c.l30.opponent}})),
  commonPlanContinuations:commonPlanContinuations.map(c=>({seed:c.seed,
    selected:c.selected,recovery:c.recovery&&{ready:c.recovery.ready,
      seconds:c.recovery.seconds,due:c.recovery.due,minFood:c.recovery.minFood,
      block:c.recovery.block},
    l30:c.l30&&{won:c.l30.won,round:c.l30.round,loss:c.l30.lossTotal,
      opponent:c.l30.opponent}})),output:outputPath},null,2));
