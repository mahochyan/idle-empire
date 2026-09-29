'use strict';

const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed = 0;
let failed = 0;
function check(name, run) {
  try {
    run();
    passed++;
    console.log('PASS ' + name);
  } catch (error) {
    failed++;
    console.error('FAIL ' + name + '\n' + error.stack);
  }
}

const roots = [
  {unit:'cavalry_t1', line:'cavalry', building:'stable', boss:1},
  {unit:'mage_t1', line:'mage', building:'mage_tower', boss:4}
];

function prepare(e, root, {defeated=40, building='ready'} = {}) {
  const {unit,line} = root;
  e.run(`(()=>{
    const unlock=CFG.unitUpgrades.${line}.tree.${unit}.unlock;
    S.res.wood=unlock.cost.wood+37;
    S.res.stone=unlock.cost.stone+29;
    S.res.food=unlock.cost.food+31;
    S.res.tech=unlock.needTech+11;
    S.merit=unlock.needMerit+3;
    S.defeated=CFG.enemies.slice(0,${defeated}).map(enemy=>enemy.id);
  })()`);
  if (building === 'missing') return;
  const state = building === 'building' ? {lv:0,state:'building',tier:1}
    : building === 'upgrading' ? {lv:1,state:'upgrading',tier:1}
    : building === 'tier_upgrading' ? {lv:1,state:'tier_upgrading',tier:0}
    : building === 'low-tier' ? {lv:1,state:'idle',tier:0}
    : {lv:1,state:'idle',tier:1};
  e.run(`S.buildings.${root.building}=${JSON.stringify({
    ...state,timer:building==='ready'||building==='low-tier'?0:5,
    timerEnd:building==='ready'||building==='low-tier'?0:5
  })}`);
}

function state(e) {
  return e.run('JSON.stringify({research:snapshotUnitResearch(),buildings:S.buildings,defeated:S.defeated})');
}

function captureWrites(e) {
  assert.equal(e.run('save().ok'), true, '测试前的主档应能成功保存');
  const master = e.store.get('rts_save');
  e.run(`globalThis.__rootMasterWrites=0;
    const __rootRealSetItem=localStorage.setItem;
    localStorage.setItem=(key,value)=>{
      if(key==='rts_save')__rootMasterWrites++;
      return __rootRealSetItem(key,value);
    }`);
  return master;
}

function assertRejected(root, options, expectedReason) {
  const e = environment();
  prepare(e, root, options);
  const master = captureWrites(e);
  const before = state(e);
  const result = e.run(`unlockUnitRoot('${root.unit}')`);
  assert.equal(result?.ok, false);
  assert.equal(result?.reason, expectedReason);
  assert.equal(state(e), before, '拒绝研究不得修改运行状态');
  assert.equal(e.store.get('rts_save'), master, '拒绝研究不得覆盖主档');
  assert.equal(e.run('__rootMasterWrites'), 0, '拒绝研究不得写入主档');
}

for (const root of roots) {
  check(`${root.unit}：第5关未通时拒绝并返回明确原因`, () => {
    assertRejected(root, {defeated:0}, 'need-level');
  });

  check(`${root.unit}：Boss 数不足时拒绝且不扣费不写档`, () => {
    const completed = root.boss === 1 ? 5 : (root.boss-1)*10;
    assertRejected(root, {defeated:completed}, 'need-boss');
  });

  check(`${root.unit}：训练建筑缺失时拒绝且不扣费不写档`, () => {
    assertRejected(root, {building:'missing'}, 'need-building');
  });

  check(`${root.unit}：训练建筑未完工时拒绝且不扣费不写档`, () => {
    assertRejected(root, {building:'building'}, 'need-building');
  });

  check(`${root.unit}：训练建筑升级中但已建且 tier 足够时可研究`, () => {
    const e = environment();
    prepare(e, root, {building:'upgrading'});
    captureWrites(e);
    assert.equal(e.run(`unlockUnitRoot('${root.unit}').ok`), true);
    assert.equal(e.run(`S.upgradedUnits.${root.unit}`), true);
    assert.equal(e.run('S.res.tech'), 11);
    assert.equal(e.run('__rootMasterWrites'), 1);
  });

  check(`${root.unit}：时代升级中但当前 tier 不足时仍拒绝研究`, () => {
    assertRejected(root, {building:'tier_upgrading'}, 'need-building-tier');
  });

  check(`${root.unit}：训练建筑 tier 不足时拒绝且不扣费不写档`, () => {
    assertRejected(root, {building:'low-tier'}, 'need-building-tier');
  });

  check(`${root.unit}：满足门槛后真实解锁仅支付并保存一次，重载可见`, () => {
    const e = environment();
    prepare(e, root);
    captureWrites(e);
    assert.equal(e.run(`bossDefeatedCount()>=CFG.buildings.${root.building}.needBoss`), true);
    assert.equal(e.run('checkTierLevel(1)'), '');
    const result = e.run(`unlockUnitRoot('${root.unit}')`);
    assert.equal(result?.ok, true);
    assert.equal(e.run(`S.upgradedUnits.${root.unit}`), true);
    for (const [resource, remainder] of [['wood',37],['stone',29],['food',31],['tech',11]]) {
      assert.equal(e.run(`S.res.${resource}`), remainder, `${resource} 应仅扣一次`);
    }
    assert.equal(e.run('S.merit'), 3);
    assert.equal(e.run('__rootMasterWrites'), 1, '成功研究应写主档一次');
    const after = state(e);
    e.run(`unlockUnitRoot('${root.unit}')`);
    assert.equal(state(e), after, '重复调用已拥有根兵种不得再扣费');
    assert.equal(e.run('__rootMasterWrites'), 1, '重复调用不得再次写档');
    const loaded = environment(Object.fromEntries(e.store));
    assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
    assert.equal(loaded.run(`S.upgradedUnits.${root.unit}`), true);
    assert.equal(loaded.run('S.res.tech'), 11);
    assert.equal(loaded.run('S.merit'), 3);
  });

  check(`${root.unit}：历史已拥有记录无门槛也不重复扣费或写档`, () => {
    const e = environment();
    prepare(e, root, {defeated:0,building:'missing'});
    e.run(`S.upgradedUnits.${root.unit}=true`);
    const master = captureWrites(e);
    const before = state(e);
    e.run(`unlockUnitRoot('${root.unit}')`);
    assert.equal(state(e), before);
    assert.equal(e.store.get('rts_save'), master);
    assert.equal(e.run('__rootMasterWrites'), 0);
  });

  check(`${root.unit}：主档写入失败时全额回滚且原档不变`, () => {
    const e = environment();
    prepare(e, root);
    const master = captureWrites(e);
    const before = state(e);
    e.run(`const __rootWorkingSetItem=localStorage.setItem;
      localStorage.setItem=(key,value)=>{
        if(key==='rts_save')throw new Error('simulated master write failure');
        return __rootWorkingSetItem(key,value);
      }`);
    const result = e.run(`unlockUnitRoot('${root.unit}')`);
    assert.equal(result?.ok, false);
    assert.equal(result?.reason, 'save-failed');
    assert.equal(state(e), before, '失败保存必须恢复资源与兵种记录');
    assert.equal(e.store.get('rts_save'), master, '主档写入失败后旧档应可恢复');
    assert.equal(e.run('__rootMasterWrites'), 0, '失败拦截前不得成功写主档');
  });
}

console.log(`root unlock gate: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
