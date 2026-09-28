'use strict';
// P198: direct current-CFG replay of P197's L30 victory and paid L31 handoff.
// Historical probes are data only; this file never overrides CFG or runs them.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const files={190:'p190-current-third-chapter-second-back.json',
  192:'p192-current-l30-boss-sensitivity.json',
  194:'p194-current-third-chapter-population-army.json',
  195:'p195-current-l30-followup.json',
  197:'p197-current-l30-l31-handoff.json'};
const raw=Object.fromEntries(Object.entries(files).map(([key,file])=>
  [key,fs.readFileSync(path.join(dataDir,file),'utf8')]));
const p190=JSON.parse(raw[190]),p192=JSON.parse(raw[192]);
const p194=JSON.parse(raw[194]),p195=JSON.parse(raw[195]);
const p197=JSON.parse(raw[197]);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
for(const [batch,data] of [[190,p190],[192,p192],[194,p194],[195,p195],[197,p197]])
  assert.equal(data.batch,`P${batch}`);
assert.equal(sha(raw[190]),p195.p190ArtifactSha256);
assert.equal(sha(raw[192]),p195.p192ArtifactSha256);
assert.equal(sha(raw[194]),p195.p194ArtifactSha256);
assert.equal(sha(raw[195]),p197.p195ArtifactSha256);
const boss={...p192.originalL30,units:{infantry:[6,4,3],archer:[6,4,3],
  cavalry_t1:[6,4,3],mage_t1:[6,4]}};
function installBrowserHarness(run){
  run(`globalThis.__p198Timers=new Map();globalThis.__p198TimerId=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__p198TimerId++;
      __p198Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p198Timers.delete(id);
    globalThis.__p198Step=()=>{const first=__p198Timers.entries().next().value;
      if(!first)return false;__p198Timers.delete(first[0]);first[1]();return true};
    globalThis.__p198Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p198Nodes.has(id))__p198Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p198Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function load(save,expectedSha,label){
  assert.equal(sha(save),expectedSha,`${label}旧档SHA错误`);
  const run=environment({rts_save:save}).run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}载入失败`);
  assert.deepEqual(plain(run('CFG.enemies[29]')),boss,
    `${label}当前实际L30配置不等于P197隔离候选`);
  installBrowserHarness(run);
  return run;
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+
    garrisonCount('${type}')`);
}
function checkpoint(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    resources:{...S.res},merit:S.merit,workers:{...S.popAlloc},
    warehouse:{...S.buildings.warehouse},barracks:{...S.buildings.barracks},
    infantryCamp:{...S.buildings.infantry_camp},
    archerRange:{...S.buildings.archer_range},storageMode:S.storageMode,
    caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
    regMax:regMax(),frontSlots:rowSlots('front'),midSlots:rowSlots('mid'),
    backSlots:rowSlots('back'),sciences:[...S.sciences],
    upgradedUnits:{...S.upgradedUnits},queue:JSON.parse(JSON.stringify(S.queue)),
    defeated:[...S.defeated]})`));
}
function compact(run){
  const s=checkpoint(run);
  return{tick:s.tick,resources:s.resources,merit:s.merit,workers:s.workers,
    warehouse:s.warehouse,barracks:s.barracks,infantryCamp:s.infantryCamp,
    archerRange:s.archerRange,caps:s.caps,regMax:s.regMax,
    frontSlots:s.frontSlots,
    owned:Object.fromEntries(['bronze_guard','infantry','archer',
      'infantry_t1','archer_t1'].map(type=>[type,owned(run,type)])),
    queue:s.queue};
}
function state(run){
  return{checkpoint:checkpoint(run),compact:compact(run),
    population:run('popCurrent()'),capacity:run('maxPop()'),
    stable:plain(run("({...bldSt('stable')})")),
    upgradedCavalry:run('!!S.upgradedUnits.cavalry_t1'),
    cavalryOwned:owned(run,'cavalry_t1'),
    cavalryCap:run("unitCap('cavalry_t1')"),
    cavalryLock:run("trainLockReason('cavalry_t1')"),
    unitRoot:plain(run('CFG.unitUpgrades.cavalry.tree.cavalry_t1.unlock')),
    army:run('armyCount()'),upkeepPerSecond:run('totalUpkeep()')};
}
function snapshot(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    growthClock:S.population.growthClock,workers:{...S.popAlloc},
    resources:{...S.res},army:armyCount(),upkeepPerSecond:totalUpkeep(),
    pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    queue:JSON.parse(JSON.stringify(S.queue)),defeated:[...S.defeated],
    settlements:{...S.settlements}})`));
}
function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}保存失败`);
  const save=run("localStorage.getItem('rts_save')");
  const next=load(save,sha(save),`${label}重载`);
  assert.deepEqual(state(next),state(run),`${label}状态重载不一致`);
  assert.deepEqual(snapshot(next),snapshot(run),`${label}编队重载不一致`);
  return{run:next,saveSha256:sha(save),save};
}
function place(run,row,type,count,index){
  assert.ok(run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
    S.formation.${row}[${index}]?.count===${count}`),true);
}
function form(run,targets,stage){
  run("clrForm('expedition')");
  const slots={front:run("rowSlots('front')"),
    mid:run("rowSlots('mid')"),back:run("rowSlots('back')")};
  if(stage===30){assert.equal(slots.front,3);assert.equal(slots.back,2)}
  else{assert.ok(slots.front>=3);assert.ok(slots.back>=1)}
  assert.equal(run('regMax()'),15);
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'front','infantry_t1',15,2);
  place(run,'back','archer_t1',13,0);
  if(targets.archer_t1===28)place(run,'back','archer_t1',15,1);
  else assert.equal(targets.archer_t1,13);
  const formation=plain(run('JSON.parse(JSON.stringify(S.formation))'));
  const deployed=Object.fromEntries(Object.keys(targets).map(type=>
    [type,formation.front.concat(formation.mid,formation.back)
      .filter(x=>x.type===type).reduce((n,x)=>n+x.count,0)]));
  assert.deepEqual(deployed,targets,`L${stage}真实编队人数不符`);
  return{slots,formation,deployed};
}
function battleRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p198Rng=${initial};Math.random=()=>{
    let x=__p198Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p198Rng=x>>>0;return __p198Rng/4294967296;}`);
}
function battle(run,stage,seed,targets,label){
  assert.equal(run('S.defeated.length'),stage-1,`${label}跳关`);
  const beforeOwned=Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)]));
  const beforeRes=plain(run('({...S.res})'));
  const deployed=form(run,targets,stage).deployed;
  battleRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`${label}开战失败`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p198Step()'),true,`${label}异步回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}未结算`);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round');
  const afterRes=plain(run('({...S.res})'));
  run('exitBattle()');
  const after=reload(run,label);
  const lossByType=Object.fromEntries(Object.entries(beforeOwned)
    .map(([type,count])=>[type,count-owned(after.run,type)]));
  const reward=plain(run(`CFG.enemies[${stage-1}].reward`));
  const actualReward=Object.fromEntries(Object.keys(reward)
    .map(key=>[key,afterRes[key]-beforeRes[key]]));
  const battle={won,round,callbacks,beforeDeployed:deployed,lossByType,
    lossTotal:Object.values(lossByType).reduce((n,v)=>n+v,0),
    [stage===30?'resourceDelta':'actualReward']:actualReward};
  return{run:after.run,battle,postBattle:state(after.run),
    saveSha256:after.saveSha256,save:after.save};
}
function foodEconomy(run){
  return plain(run(`({foodOutput:prodRate('food'),
    populationFood:popCurrent()*(CFG.popFoodCost??0.1),
    armyUpkeep:totalUpkeep(),
    netFood:prodRate('food')-popCurrent()*(CFG.popFoodCost??0.1)-totalUpkeep(),
    rates:{wood:prodRate('wood'),stone:prodRate('stone'),
      food:prodRate('food'),coal:prodRate('coal'),copper:prodRate('copper')},
    workers:{...S.popAlloc},army:armyCount(),food:S.res.food})`));
}
function recovery(run,stage,targets){
  const before=state(run),requested={},produced={},dueByProduced={},pausedQueueSeconds={};
  const economyBefore=foodEconomy(run);
  let minFoodTickEnd=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)
      return{before,seconds:0,ready:false,requested,produced,dueByProduced,
        pausedQueueSeconds,minFoodTickEnd,after:state(run),economyBefore,
        economyAfter:foodEconomy(run),block:{type,action,
          lock:run(`trainLockReason('${type}')`),
          cap:run(`unitCap('${type}')`),owned:have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),pre,
      `L${stage}排队不应提前扣资源`);
    produced[type]=0;
  }
  function ready(){return Object.entries(targets)
    .every(([type,n])=>owned(run,type)>=n)}
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`L${stage}未知队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,c] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        dueByProduced[rk]=(dueByProduced[rk]||0)+made*c;
    }
  }
  const result={before,seconds,ready:ready(),requested,produced,dueByProduced,
    pausedQueueSeconds,minFoodTickEnd,after:state(run),economyBefore,
    economyAfter:foodEconomy(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type}实产不符`);
  return result;
}
function stage31Enemy(save,saveSha){
  const run=load(save,saveSha,'L31敌阵检视');
  const cfg=plain(run('CFG.enemies[30]'));
  assert.equal(cfg.id,31);
  const stats=plain(run(`S.selEnemy=30;S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound})`));
  return{id:cfg.id,name:cfg.name,units:cfg.units,reward:cfg.reward,stats};
}
function route(source,expected,targets){
  const label=`${expected.sourceKind}流${expected.combatSeed}`;
  const run=load(source.save,source.saveSha256,`${label}旧L30战前档`);
  assert.deepEqual(state(run),source.preBattle,`${label}旧档状态变化`);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:29},(_,i)=>i+1));
  const l30=battle(run,30,expected.combatSeed,targets,`${label} L30`);
  assert.deepEqual(l30.battle,expected.l30.battle,`${label} L30战斗不符`);
  assert.deepEqual(l30.postBattle,expected.l30.postBattle,
    `${label} L30战后存档不符`);
  assert.equal(l30.battle.won,true);
  const refill=recovery(l30.run,31,targets);
  assert.deepEqual(refill,expected.recovery,`${label}真实补兵/粮/费用不符`);
  assert.equal(refill.ready,true,`${label}7200秒补兵未完成`);
  let active=reload(l30.run,`${label} L31补兵完成`).run;
  const placed=form(active,targets,31);
  const prepared=reload(active,`${label} L31编队完成`);
  active=prepared.run;
  assert.deepEqual(state(active),expected.l31Prepared.state,
    `${label} L31战前存档不符`);
  assert.deepEqual(placed.slots,expected.l31Prepared.slots,
    `${label} L31阵位不符`);
  assert.deepEqual(placed.deployed,expected.l31Prepared.deployed,
    `${label} L31实入场不符`);
  assert.deepEqual(plain(active('([...S.defeated])')),
    Array.from({length:30},(_,i)=>i+1));
  const enemy=stage31Enemy(prepared.save,prepared.saveSha256);
  assert.deepEqual(enemy,expected.l31.enemy,`${label} L31敌阵不符`);
  const l31=battle(active,31,expected.combatSeed,targets,`${label} L31`);
  assert.deepEqual(l31.battle,expected.l31.battle,`${label} L31战斗不符`);
  assert.deepEqual(l31.postBattle,expected.l31.postBattle,
    `${label} L31战后重载状态不符`);
  assert.equal(l31.battle.won,true);
  return{sourceKind:expected.sourceKind,seed:expected.combatSeed,
    sourceSaveSha256:source.saveSha256,
    l30:{won:l30.battle.won,round:l30.battle.round,
      loss:l30.battle.lossTotal,postSaveSha256:l30.saveSha256},
    recovery:{seconds:refill.seconds,foodMin:refill.minFoodTickEnd,
      paid:refill.dueByProduced,paused:refill.pausedQueueSeconds},
    l31:{won:l31.battle.won,round:l31.battle.round,
      loss:l31.battle.lossTotal,postSaveSha256:l31.saveSha256}};
}
assert.equal(p197.profiles.length,3);
const source58=p190.l30Prepared.find(x=>x.route==='thirdFront'&&x.seed===1);
assert.ok(source58);
const source73=p194.l30Prepared;
assert.equal(source73.length,2);
const results=p197.profiles.map(expected=>{
  const source=expected.sourceKind==='P190'?source58:
    source73.find(x=>x.seed===expected.combatSeed);
  assert.ok(source);
  assert.equal(source.saveSha256,expected.sourceSaveSha256);
  const targets=expected.sourceKind==='P190'?
    p190.scope.targetsByRoute.thirdFront:p194.scope.targets;
  assert.deepEqual(targets,expected.targets);
  return route(source,expected,targets);
});
assert.deepEqual(results.map(x=>[x.sourceKind,x.seed]),
  [['P190',19],['P194',1],['P194',15]]);
console.log(JSON.stringify({batch:'P198',formalRoster:boss.units,
  matchedP197:true,profiles:results,
  sourceArtifactSha256:Object.fromEntries(Object.entries(raw)
    .map(([key,value])=>[`p${key}`,sha(value)]))},null,2));
