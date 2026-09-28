'use strict';
// 铸铜钱：研究、岗位原料、地契用途与旧存档模式均调用真实实现。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}
const saved=e=>JSON.parse(e.store.get('rts_save'));

check('新档 v32 铜钱配方，冶铜后花1200科技点解锁岗位，无铸币厂也能分配',()=>{
  const e=environment();
  assert.equal(e.run('CFG.save.schema'),24);
  assert.equal(e.run('S.currencyRecipeMode'),'copper');
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_currency')")),['sci_copper']);
  e.run('S.res.tech=1200;S.population.current=4');
  assert.equal(e.run("researchScience('sci_currency').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_copper')");
  assert.equal(e.run("researchScience('sci_currency').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run("bldSt('mint').lv"),0);
  assert.equal(e.run("setPopAlloc('coin',1).ok"),true);
  assert.equal(e.run("researchScience('sci_currency').repeat"),true);
  assert.equal(e.run('S.res.tech'),0);
});

check('一名铸铜钱工每在线秒耗铜1产钱币2；缺铜和满仓都不空扣',()=>{
  const e=environment();
  e.run("S.sciences=['sci_copper','sci_currency'];S.population.current=4;S.res.food=1000;S.res.copper=5");
  assert.equal(e.run("setPopAlloc('coin',1).ok"),true);
  assert.equal(e.run('potentialFoodCostSecond(1)'),0.4);
  e.run('tick()');
  assert.equal(e.run('S.res.copper'),4);
  assert.equal(e.run('S.res.coin'),2);
  e.run('S.res.copper=0;tick()');
  assert.equal(e.run('S.res.coin'),2);
  e.run("S.res.copper=5;S.res.coin=resCap('coin');tick()");
  assert.equal(e.run('S.res.copper'),5);
  assert.equal(e.run('S.res.coin'),e.run("resCap('coin')"));
});

check('真实岗位收入可在已有早期市场换地契，无远征、无货币铸造研究',()=>{
  const e=environment();
  e.run("S.sciences=['sci_copper','sci_currency'];S.population.current=4;S.res.food=1000;S.res.copper=100;S.buildings.market={lv:1,state:'idle'}");
  assert.equal(e.run("setPopAlloc('coin',1).ok"),true);
  e.run('for(let i=0;i<50;i++)tick()');
  assert.equal(e.run('S.res.coin'),100);
  assert.equal(e.run('S.res.copper'),50);
  assert.equal(e.run("exchangeResource('coin','deed',100).ok"),true);
  assert.equal(e.run('S.res.deed'),31);
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run("S.sciences.includes('sci_coin')"),false);
  assert.equal(saved(e).currencyRecipeMode,'copper');
});

check('v7 原始档迁移为旧食物铸币配方，合法0、已有工人和超仓币不裁剪',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.sciences=['sci_coin'];S.buildings.mint={lv:1,state:'idle'};S.population.current=10;S.popAlloc.coin=1;S.res.coin=25000;S.res.food=500;const d=serializeSave();d.v=7;delete d.currencyRecipeMode;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.currencyRecipeMode'),'legacy');
  assert.equal(e.run('S.popAlloc.coin'),1);
  assert.equal(e.run('S.res.coin'),25000);
  assert.equal(e.run('S.res.copper'),0);
  assert.equal(e.run("workerLockReason('coin')"),'');
  e.run('S.res.tech=1200');
  assert.equal(e.run("researchScience('sci_currency').reason"),'mode-mismatch');
  assert.equal(saved(e).v,32);
  assert.equal(saved(e).currencyRecipeMode,'legacy');
  assert.equal(e.run('prodRate("coin")'),0.55);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(metalConsumeMap("coin"))')),{food:5});
  assert.equal(e.run('potentialFoodCostSecond(1)'),2);
});

check('v32 无模式、非法模式与未来 v33 拒载，tick 不覆盖原文',()=>{
  const seed=environment();
  const base=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
  [d=>delete d.currencyRecipeMode,d=>{d.currencyRecipeMode='wrong'},d=>{d.v=33}].forEach((mutate,i)=>{
    const d=structuredClone(base);mutate(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),i===2?'future':'invalid');
    assert.equal(e.run('saveProtected()'),true);
    e.run('for(let j=0;j<61;j++)tick()');
    assert.equal(e.store.get('rts_save'),raw);
  });
});

check('研究写档失败回滚；迁移原文副本失败保留 v7 主档',()=>{
  const science=environment();
  science.run("S.sciences=['sci_copper'];S.res.tech=1200;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(science.run("researchScience('sci_currency').reason"),'save-failed');
  assert.equal(science.run('S.res.tech'),1200);
  assert.equal(science.run("S.sciences.includes('sci_currency')"),false);
  const seed=environment();
  const raw=seed.run("(()=>{const d=serializeSave();d.v=7;delete d.currencyRecipeMode;return JSON.stringify(d)})()");
  const migrating=environment({rts_save:raw});
  migrating.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(migrating.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(migrating.store.get('rts_save'),raw);
  assert.equal(migrating.run('saveProtected()'),true);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
