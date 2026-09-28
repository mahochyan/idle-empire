'use strict';
// 猎风弩骑的技能回归：用实付关卡存档初始化 B，再调用远征和驻军的真实函数。
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {environment} = require('./harness');
const p201 = require('../../docs/codex/reports/data/p201-live-cavalry-third-chapter.json');

const profile = p201.profiles.find(x => x.seed === 1 && x.route === 't2SecondBack73');
const stage = profile?.stages.find(x => x.stage === 29);
assert.ok(stage?.l29PreparedSave, '缺少 P201 实付第 29 关战前档');
assert.equal(crypto.createHash('sha256').update(stage.l29PreparedSave).digest('hex'),
  stage.beforeSaveSha256, 'P201 战前档内容与记录的 SHA 不同');

const world = environment({rts_save:stage.l29PreparedSave});
const run = world.run;
assert.equal(run('loadSaveAndApply().status'), 'migrated');
assert.equal(world.store.get('rts_save_premigration'),stage.l29PreparedSave);
const migratedRaw=world.store.get('rts_save');
run(`globalThis.__windTimers = new Map();globalThis.__windTimerId = 1;
  globalThis.setTimeout = fn => {const id = __windTimerId++;__windTimers.set(id, fn);return id};
  globalThis.clearTimeout = id => __windTimers.delete(id);
  globalThis.__windNodes = new Map();document.getElementById = id => {
    if(id.startsWith('ou-') || id.startsWith('eu-')) return null;
    if(!__windNodes.has(id)) __windNodes.set(id, {style:{},innerHTML:'',
      textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
      toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __windNodes.get(id)};
  globalThis.addLog = m => S.log.push(String(m));`);
run('selEnemy(28);openBattle()');
assert.equal(run('S.battleActive'), true);

run(`globalThis.__wind = B.ourUnits.find(u => u.type === 'cavalry_wind');
  globalThis.__archer = B.ourUnits.find(u => u.type === 'archer_t1');
  globalThis.__old = {...__wind, type:'cavalry_t1', tag:CFG.units.cavalry_t1.tag};
  globalThis.__front = B.enemyUnits.find(u => u.row === 'front' && u.hp > 0);
  globalThis.__back = B.enemyUnits.find(u => u.row === 'back' && u.hp > 0);
  globalThis.__enemies = [__front, __back];
  globalThis.__sample = (fn, value) => {
    const previous = Math.random;let calls = 0;
    Math.random = () => {
      const roll = Array.isArray(value) ? value[calls] : value;
      calls++;return roll};
    try {return {result:fn(),calls}} finally {Math.random = previous}
  };
  globalThis.__garrisonCrit = (actor, value) => {
    const previous = finalizeCombatDamage;let crit = null;
    finalizeCombatDamage = (unit, raw, isCrit) => {
      crit = isCrit;return previous(unit, raw, isCrit)};
    try {
      const sample = __sample(() => calcGarrisonDmg(
        {...actor, damageRemainder:0}, __front), value);
      return {crit,calls:sample.calls,damage:sample.result};
    } finally {finalizeCombatDamage = previous}
  };
  globalThis.__garrisonLoop = value => {
    const originalForm = S._garrisonForm;
    const originalRounds = CFG.garrisonInvade.maxRounds;
    const originalRandom = Math.random;
    const originalTarget = getGarrisonTarget;
    const originalFinalize = finalizeCombatDamage;
    const rows = [],crits = [];
    try {
      // 只把实付档已有的 8 名猎风临时编入驻军；战斗和敌军仍由正式函数构造。
      S._garrisonForm = {front:[{...S.formation.front.find(
        u => u.type === 'cavalry_wind')}],mid:[],back:[]};
      CFG.garrisonInvade.maxRounds = 1;
      Math.random = () => value;
      getGarrisonTarget = (actor, foes) => {
        const target = originalTarget(actor, foes);
        if(actor.type === 'cavalry_wind') rows.push({
          row:target?.row ?? null,originRow:target?.originRow ?? null});
        return target};
      finalizeCombatDamage = (actor, raw, isCrit) => {
        if(actor.type === 'cavalry_wind') crits.push(isCrit);
        return originalFinalize(actor, raw, isCrit)};
      const result = resolveGarrisonBattle({units:{infantry:[100],archer:[100]}});
      return {rows,crits,rounds:result.rounds,
        windCount:result.ourUnits.filter(u => u.type === 'cavalry_wind').length,
        enemyRows:result.enemyUnits.map(u => u.originRow)};
    } finally {
      if(originalForm === undefined) delete S._garrisonForm;
      else S._garrisonForm = originalForm;
      CFG.garrisonInvade.maxRounds = originalRounds;
      Math.random = originalRandom;
      getGarrisonTarget = originalTarget;
      finalizeCombatDamage = originalFinalize;
    }
  };`);
assert.equal(run('!!(__wind && __archer && __front && __back)'), true,
  '战前档必须同时包含猎风、游侠、敌方前排与后排');
assert.equal(run('__wind.tag'), 'wind');
assert.equal(run('__wind.row'), 'front');
assert.equal(run('S.res.silver'), 0, '用真实 0 资源档检验只读战斗函数');
const beforeS = run('JSON.stringify(S)');

const checks = [];
function check(name, action) {
  try {action();checks.push({name,ok:true});console.log(`PASS ${name}`)}
  catch (error) {checks.push({name,ok:false});console.error(`FAIL ${name}: ${error.message}`)}
}
function target(helper, actor, value) {
  return run(`__sample(() => ${helper}(${actor}, __enemies)?.row ?? null,
    ${JSON.stringify(value)})`);
}
function expeditionCrit(actor, value) {
  return run(`__sample(() => calcDmg({...${actor}, damageRemainder:0},
    __front, true).crit, ${JSON.stringify(value)})`);
}
function garrisonCrit(actor, value) {
  return run(`__garrisonCrit(${actor}, ${JSON.stringify(value)})`);
}
function expectSample(actual, rowOrCrit, calls) {
  assert.equal(actual.result, rowOrCrit);
  assert.equal(actual.calls, calls);
}

check('兵种射程标记：猎风远程，旧骑兵近战，游侠远程', () => {
  assert.equal(run("isRanged('cavalry_wind')"), true);
  assert.equal(run("isRanged('cavalry_t1')"), false);
  assert.equal(run("isRanged('archer_t1')"), true);
});
for (const helper of ['getTarget', 'getGarrisonTarget']) {
  check(`${helper}：猎风在 0.99 可命中后排`, () =>
    expectSample(target(helper, '__wind', 0.99), 'back', 2));
  check(`${helper}：猎风在 0 仍受前排 60% 阻挡`, () =>
    expectSample(target(helper, '__wind', 0), 'front', 2));
  check(`${helper}：旧骑兵与游侠选敌和随机调用不变`, () => {
    expectSample(target(helper, '__old', 0.99), 'front', 1);
    expectSample(target(helper, '__archer', 0.99), 'back', 2);
    expectSample(target(helper, '{...__old,row:"mid"}', 0.99), null, 0);
  });
}
check('远征：猎风在 0 暴击，在 0.99 不暴击', () => {
  expectSample(expeditionCrit('__wind', 0), true, 3);
  expectSample(expeditionCrit('__wind', 0.99), false, 3);
});
check('远征：猎风暴击阈值恰为 10%', () => {
  expectSample(expeditionCrit('__wind', [0.5, 0.099, 0.5]), true, 3);
  expectSample(expeditionCrit('__wind', [0.5, 0.1, 0.5]), false, 3);
});
check('远征：旧骑兵不暴击，长矛暴击路径不变', () => {
  expectSample(expeditionCrit('__old', 0), false, 2);
  expectSample(expeditionCrit('{...__wind,tag:"spear"}', 0), true, 3);
});
check('驻军：猎风在 0 暴击，在 0.99 不暴击', () => {
  const low = garrisonCrit('__wind', 0);
  const high = garrisonCrit('__wind', 0.99);
  assert.equal(low.crit, true);assert.equal(low.calls, 3);
  assert.equal(high.crit, false);assert.equal(high.calls, 3);
  assert.ok(Number.isFinite(low.damage) && Number.isFinite(high.damage));
});
check('驻军：猎风暴击阈值恰为 10%', () => {
  const below = garrisonCrit('__wind', [0.5, 0.099, 0.5]);
  const at = garrisonCrit('__wind', [0.5, 0.1, 0.5]);
  assert.equal(below.crit, true);assert.equal(below.calls, 3);
  assert.equal(at.crit, false);assert.equal(at.calls, 3);
});
check('驻军：旧骑兵不暴击，长矛暴击路径不变', () => {
  const old = garrisonCrit('__old', 0);
  const spear = garrisonCrit('{...__wind,tag:"spear"}', 0);
  assert.equal(old.crit, false);assert.equal(old.calls, 2);
  assert.equal(spear.crit, true);assert.equal(spear.calls, 3);
});
check('驻军主循环：实付猎风分别命中前后排并在 0 暴击', () => {
  const back = run('__garrisonLoop(0.99)');
  const front = run('__garrisonLoop(0)');
  assert.ok(back.rounds >= 1 && front.rounds >= 1);
  assert.equal(back.windCount, 1);assert.equal(front.windCount, 1);
  assert.deepEqual(Array.from(back.enemyRows), ['front', 'back']);
  // 驻军会把缺少中排时的原后排前移到 mid；仍需锁定其后排来源。
  assert.equal(back.rows[0].row, 'mid');
  assert.equal(back.rows[0].originRow, 'back');
  assert.equal(back.crits[0], false);
  assert.equal(front.rows[0].row, 'front');
  assert.equal(front.rows[0].originRow, 'front');
  assert.equal(front.crits[0], true);
});
check('只读调用保留 0 资源、S 与迁移后主存档原文', () => {
  assert.equal(run('S.res.silver'), 0);
  assert.equal(run('JSON.stringify(S)'), beforeS);
  assert.equal(world.store.get('rts_save'), migratedRaw);
});

const failed = checks.filter(x => !x.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exitCode = 1;
