'use strict';
// P196: replay genuine pre-L30 saves against the actual, unmodified CFG.
// P190/P192/P194/P195 are historical artifacts: never rerun their old-level
// input-SHA gates or overwrite their isolation results during this check.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const raw=Object.fromEntries([190,192,194,195].map(batch=>[
  batch,fs.readFileSync(path.join(dataDir,({
    190:'p190-current-third-chapter-second-back.json',
    192:'p192-current-l30-boss-sensitivity.json',
    194:'p194-current-third-chapter-population-army.json',
    195:'p195-current-l30-followup.json'
  })[batch]),'utf8')]));
const p190=JSON.parse(raw[190]),p192=JSON.parse(raw[192]);
const p194=JSON.parse(raw[194]),p195=JSON.parse(raw[195]);
const roster={infantry:[6,4,3],archer:[6,4,3],
  cavalry_t1:[6,4,3],mage_t1:[6,4]};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
for(const [batch,data] of [[190,p190],[192,p192],[194,p194],[195,p195]])
  assert.equal(data.batch,`P${batch}`);
assert.equal(sha(raw[190]),p195.p190ArtifactSha256,'P190历史JSON已变化');
assert.equal(sha(raw[192]),p195.p192ArtifactSha256,'P192历史JSON已变化');
assert.equal(sha(raw[194]),p195.p194ArtifactSha256,'P194历史JSON已变化');
assert.equal(sha(raw[190]),p192.p190ArtifactSha256,'P192来源P190不一致');
const expectedBoss={...p192.originalL30,units:roster};
function checkBoss(run){
  assert.deepEqual(plain(run('CFG.enemies[29]')),expectedBoss,
    '当前L30配置未仅将敌阵改为[6,4,3]（法师[6,4]）');
}
function installBrowserHarness(run){
  // Only DOM and timer callbacks are emulated. Combat and settlement are real.
  run(`globalThis.__p196Timers=new Map();globalThis.__p196TimerId=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__p196TimerId++;
      __p196Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p196Timers.delete(id);
    globalThis.__p196Step=()=>{const first=__p196Timers.entries().next().value;
      if(!first)return false;__p196Timers.delete(first[0]);first[1]();return true};
    globalThis.__p196Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p196Nodes.has(id))__p196Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p196Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function load(save,expectedSha,label){
  assert.equal(sha(save),expectedSha,`${label}原始rts_save SHA不符`);
  const run=environment({rts_save:save}).run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}载入失败`);
  checkBoss(run);
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
  return{run:next,saveSha256:sha(save)};
}
function place(run,row,type,count,index){
  assert.ok(count>0&&run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count,`${type}兵池不足`);
  run(`openFormModal('expedition','${row}',${index});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
    S.formation.${row}[${index}]?.count===${count}`),true);
}
function formation(run,targets){
  run("clrForm('expedition')");
  assert.equal(run("rowSlots('front')"),3);
  assert.equal(run("rowSlots('back')"),2);
  assert.equal(run('regMax()'),15);
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'front','infantry_t1',15,2);
  place(run,'back','archer_t1',13,0);
  if(targets.archer_t1===28)place(run,'back','archer_t1',15,1);
  const result={};
  for(const row of ['front','mid','back'])for(const unit of plain(run(`S.formation.${row}`)))
    result[unit.type]=(result[unit.type]||0)+unit.count;
  assert.deepEqual(result,targets,'第30关真实编队入场与来源档目标不符');
  return result;
}
function battleRng(run,seed){
  const initial=(seed*1009+30*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p196Rng=${initial};Math.random=()=>{
    let x=__p196Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p196Rng=x>>>0;return __p196Rng/4294967296;}`);
}
function essenceGain(before,after){
  return Object.fromEntries([...new Set([...Object.keys(before),...Object.keys(after)])]
    .map(key=>[key,(after[key]||0)-(before[key]||0)])
    .filter(([,value])=>value>0));
}
function fight(source,seed,targets,expected,label){
  const run=load(source.save,source.saveSha256,label);
  assert.deepEqual(state(run),source.preBattle,`${label}旧档当前重载状态变化`);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:29},(_,i)=>i+1),`${label}不是第30关前旧档`);
  for(const [type,count] of Object.entries(targets))
    assert.equal(owned(run,type),count,`${label} ${type}旧档人数变化`);
  const beforeDeployed=formation(run,targets);
  const beforeOwned=Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)]));
  const beforeRes=plain(run('({...S.res})'));
  const beforeMerit=run('S.merit');
  const beforeEssence=plain(run('({...S.essence})'));
  const nominalReward=plain(run('CFG.enemies[29].reward'));
  battleRng(run,seed);
  run('selEnemy(29);openBattle()');
  assert.equal(run('S.battleActive'),true,`${label}未开始真实战斗`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p196Step()'),true,`${label}异步回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}未真实结算`);
  const won=run('S.defeated.includes(30)'),round=run('B.round');
  const afterRes=plain(run('({...S.res})'));
  const meritGain=run('S.merit')-beforeMerit;
  const essenceDrops=essenceGain(beforeEssence,plain(run('({...S.essence})')));
  const actualReward=Object.fromEntries(Object.keys(nominalReward)
    .map(key=>[key,afterRes[key]-beforeRes[key]]));
  run('exitBattle()');
  const reloaded=reload(run,label);
  const lossByType=Object.fromEntries(Object.entries(beforeOwned)
    .map(([type,count])=>[type,count-owned(reloaded.run,type)]));
  const battle={won,round,callbacks,beforeDeployed,lossByType,
    lossTotal:Object.values(lossByType).reduce((sum,n)=>sum+n,0),
    resourceDelta:actualReward};
  for(const key of ['won','round','callbacks','beforeDeployed',
    'lossByType','lossTotal','resourceDelta'])
    assert.deepEqual(battle[key],expected.battle[key],`${label}实战不符：${key}`);
  assert.deepEqual(state(reloaded.run),expected.postBattle,
    `${label}战后真实重载状态与隔离候选不符`);
  assert.equal(won,true,`${label}应是可达胜档`);
  return{source:label,seed,won,round,callbacks,lossTotal:battle.lossTotal,
    actualReward,meritGain,essenceDrops,
    postSaveSha256:reloaded.saveSha256};
}

const p190Front=p190.l30Prepared.find(x=>x.route==='thirdFront'&&x.seed===1);
assert.ok(p190Front,'P190缺少58人真实战前档');
assert.deepEqual(p190.scope.targetsByRoute.thirdFront,
  {bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:13});
assert.equal(sha(p190Front.save),p190Front.saveSha256);
assert.equal(p195.frontSweep.filter(x=>x.roster==='6-4-3').length,32);
const front=p195.frontSweep.filter(x=>x.roster==='6-4-3').map(expected=>{
  assert.equal(expected.route,'thirdFront');
  assert.equal(expected.sourceSaveSha256,p190Front.saveSha256);
  return fight(p190Front,expected.combatSeed,
    p190.scope.targetsByRoute.thirdFront,expected,
    `P190 58人流${expected.combatSeed}`);
});
assert.deepEqual(front.map(x=>x.seed),Array.from({length:32},(_,i)=>i+1));
assert.equal(front.find(x=>x.seed===19).lossTotal,42,'58人高损流19未复现');
const isolatedFront=p192.sources.find(x=>x.route==='thirdFront'&&x.sourceSeed===1)
  ?.outcomes.find(x=>x.seed===1&&x.roster==='6-4-3');
assert.ok(isolatedFront&&isolatedFront.battle.won);
const frontOne=front.find(x=>x.seed===1);
for(const key of ['meritGain','essenceDrops'])
  assert.deepEqual(frontOne[key],isolatedFront.battle[key],
    `P192 58人流1${key}不符`);
assert.deepEqual(frontOne.actualReward,isolatedFront.battle.actualReward,
  'P192 58人流1实入账不符');

assert.equal(p194.l30Prepared.length,2,'P194需有两份22人口战前档');
const population=p194.l30Prepared.map(source=>{
  assert.equal(sha(source.save),source.saveSha256);
  const expected=p195.p194Trials.find(x=>x.sourceSeed===source.seed&&
    x.roster==='6-4-3');
  assert.ok(expected,`P195缺少22人口流${source.seed}隔离候选`);
  assert.equal(expected.sourceSaveSha256,source.saveSha256);
  return fight(source,source.seed,p194.scope.targets,expected,
    `P194 22人口73人流${source.seed}`);
});
assert.deepEqual(population.map(x=>x.seed),[1,15]);

const oldWin=p195.replenishments.find(x=>x.sourceSeed===1&&
  x.combatSeed===1&&x.roster==='current-1-1-1');
assert.ok(oldWin?.l30?.postSave,'P195缺少改动前真实L30完整胜档');
const oldRun=load(oldWin.l30.postSave,oldWin.l30.postSaveSha256,
  'P195改动前L30胜档');
assert.deepEqual(state(oldRun),oldWin.l30.postBattle,
  '改动前L30胜档在正式配置下状态变化');
assert.equal(oldRun('S.defeated.includes(30)'),true,'旧L30胜场丢失');
assert.deepEqual(plain(oldRun('({...S.essence})')),
  JSON.parse(oldWin.l30.postSave).essence,'旧档精魄变化');
reload(oldRun,'P195改动前L30胜档再次保存');

console.log(JSON.stringify({batch:'P196',roster,checks:front.length+population.length,
  front:{checked:front.length,wins:front.filter(x=>x.won).length,
    lossMin:Math.min(...front.map(x=>x.lossTotal)),
    lossMax:Math.max(...front.map(x=>x.lossTotal)),
    highLossSeed19:front.find(x=>x.seed===19)},
  population,oldVictoryLoaded:true,
  sourceArtifactSha256:{p190:sha(raw[190]),p192:sha(raw[192]),
    p194:sha(raw[194]),p195:sha(raw[195])}},null,2));
