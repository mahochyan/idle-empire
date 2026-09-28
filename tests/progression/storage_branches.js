'use strict';

// 母本早期军备的并行仓储研究门；调用游戏真实研究、建造、生产和存档路径。
const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
function setTech(e, amount) { e.run(`S.res.tech=${amount}`); }
function state(e) { return e.run('JSON.stringify({res:S.res,sciences:S.sciences,buildings:S.buildings,ops:S.ops})'); }

check('青铜与铁器分别以大粮仓、铁仓研究为直接前置', () => {
  const e = environment();
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_large_granary')")), ['sci_copper']);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_bronze_age')")), ['sci_large_granary']);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_iron_warehouse')")), ['sci_iron']);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_iron_age')")), ['sci_iron_warehouse']);
  assert.equal(e.run('activeSciences().sci_large_granary.cost.tech'), 800);
  assert.equal(e.run('activeSciences().sci_iron_warehouse.cost.tech'), 1000);
  assert.equal(e.run('activeSciences().sci_bronze_age.cost.tech'), 1200);
  assert.equal(e.run('activeSciences().sci_iron_age.cost.tech'), 2500);
});

check('新档冶铜后不能越过大粮仓研究；解锁后才可研究青铜并造仓', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper']");
  setTech(e, 1200);
  const before = state(e);
  assert.equal(e.run("researchScience('sci_bronze_age').reason"), 'science-prerequisite');
  assert.equal(state(e), before);
  assert.equal(e.store.has('rts_save'), false);
  assert.equal(e.run("buildAct('large_granary').reason"), 'need-science');
  assert.equal(e.run("researchScience('sci_large_granary').ok"), true);
  assert.equal(e.run('S.res.tech'), 400);
  setTech(e, 1200);
  assert.equal(e.run("researchScience('sci_bronze_age').ok"), true);
  assert.equal(e.run('S.res.tech'), 0);
  assert.equal(e.run('S.defeated.length'), 0);
});

check('冶铁后铁仓科技挡住铁仓建造与铁器时代，青铜支线并非前置', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron']");
  setTech(e, 2500);
  assert.equal(e.run("researchScience('sci_iron_age').reason"), 'science-prerequisite');
  assert.equal(e.run("buildAct('iron_store').reason"), 'need-science');
  setTech(e, 1000);
  assert.equal(e.run("researchScience('sci_iron_warehouse').ok"), true);
  setTech(e, 2500);
  assert.equal(e.run("researchScience('sci_iron_age').ok"), true);
  assert.equal(e.run("S.sciences.includes('sci_bronze_age')"), false);
  assert.equal(e.run('S.defeated.length'), 0);
});

check('大粮仓只有完工才增加食物上限，在线满仓与刷新同一口径', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_large_granary'];S.res.wood=3000;S.res.food=9000");
  const oldCap = e.run("resCap('food')");
  assert.equal(oldCap, e.run("storageCapacity('food')"));
  assert.equal(e.run("buildAct('large_granary').ok"), true);
  assert.equal(e.run("resCap('food')"), oldCap);
  e.run('for(let i=0;i<30;i++)tick()');
  assert.equal(e.run("bldSt('large_granary').lv"), 1);
  assert.equal(e.run("resCap('food')"), oldCap + 2000);
  e.run("S.population.current=4;S.popAlloc.food=1;S.res.food=resCap('food')-1;S.res=productionSecond()");
  assert.equal(e.run('S.res.food'), oldCap + 2000, '生产实际入库不得越过新上限');
  e.run("S.pool.infantry=1;S.res.food=storageCapacity('food')+1;refundUnitsByLine('infantry_camp',0)");
  assert.equal(e.run('S.res.food'), oldCap + 1 + e.run('CFG.units.infantry.cost.food'),
    '退兵粮食应按大粮仓容量入库');
  e.run("S.res.food=resCap('food')+7;save()");
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.equal(loaded.run('S.res.food'), oldCap + 2007, '历史超仓食物应保留');
  assert.equal(loaded.run("resCap('food')"), oldCap + 2000);
});

check('铁仓首级须付铁200，升级按仓库费用递增且失败不扣材料', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron','sci_iron_warehouse'];S.res.iron=199");
  assert.equal(e.run('CFG.buildings.iron_store.build.iron'), 200);
  const before = state(e);
  assert.equal(e.run("buildAct('iron_store').reason"), 'resources');
  assert.equal(state(e), before);
  assert.equal(e.store.has('rts_save'), false);
  e.run('S.res.iron=200');
  assert.equal(e.run("buildAct('iron_store').ok"), true);
  assert.equal(e.run('S.res.iron'), 0);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("bldSt('iron_store').lv"), 1);
  assert.equal(e.run("upCost('iron_store').iron"), 240);
  assert.equal(e.run("upCost('large_granary').wood"), 2160);
});

check('铁仓扣铁后主档写失败，库存与建筑进度恢复', () => {
  const e = environment();
  e.run("S.sciences=['sci_iron_warehouse'];S.res.iron=250");
  assert.equal(e.run('save().ok'), true);
  const original = e.store.get('rts_save'), before = state(e);
  e.run("const originalIronWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw new Error('quota');originalIronWrite(key,value)}");
  assert.equal(e.run("buildAct('iron_store').reason"), 'save-failed');
  assert.equal(state(e), before);
  assert.equal(e.store.get('rts_save'), original);
});

check('旧 v5 已研究军备、已建铁仓即使没有新支线也原样保留并可升级', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron','sci_bronze_age','sci_iron_age'];S.buildings.iron_store={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.tech=0;S.res.deed=0;S.res.iron=900;S.res.wood=5000;S.res.stone=5000;S.res.food=5000");
  assert.equal(e.run('save().ok'), true);
  const original = e.store.get('rts_save');
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.equal(loaded.store.get('rts_save'), original);
  assert.equal(loaded.run("S.sciences.includes('sci_bronze_age')"), true);
  assert.equal(loaded.run("S.sciences.includes('sci_iron_age')"), true);
  assert.equal(loaded.run("S.sciences.includes('sci_large_granary')"), false);
  assert.equal(loaded.run("S.sciences.includes('sci_iron_warehouse')"), false);
  assert.equal(loaded.run('S.res.tech'), 0);
  assert.equal(loaded.run('S.res.deed'), 0);
  assert.equal(loaded.run('S.res.iron'), 900);
  assert.equal(loaded.run("buildAct('iron_store').ok"), true);
});

check('新仓储研究写主档失败，知识与研究标记全部回滚', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper'];S.res.tech=800");
  assert.equal(e.run('save().ok'), true);
  const original = e.store.get('rts_save'), before = state(e);
  e.run("const oldStorageSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw new Error('quota');oldStorageSetItem(key,value)}");
  assert.equal(e.run("researchScience('sci_large_granary').reason"), 'save-failed');
  assert.equal(state(e), before);
  assert.equal(e.store.get('rts_save'), original);
});

console.log(`${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
