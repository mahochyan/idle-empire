'use strict';
// 煤→铜→铁回归：通过现有 VM 工具加载真实 config/math/garrison/technology。
// node tests/progression/metal_chain.js
const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
function approx(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8,
    `${label}: expected ${expected}, received ${actual}`);
}
function json(e, expression) { return JSON.parse(e.run(`JSON.stringify(${expression})`)); }
function advanceUntil(e, condition, maxSeconds = 20000) {
  const elapsed = e.run(`(()=>{let n=0;while(!(${condition})&&n<${maxSeconds}){tick();n++}return n})()`);
  assert.equal(e.run(condition), true, `未在 ${maxSeconds} 在线秒内达到：${condition}`);
  return elapsed;
}
function unlockedCoalFixture() {
  const e = environment();
  e.run("S.metalRecipeMode='coal';S.sciences=['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron'];S.population.current=4;S.res.stone=0;S.res.coal=0;S.res.copper=0;S.res.iron=0;S.res.food=100");
  return e;
}
function oldSave(version, progress) {
  const e = environment();
  if (progress) e.run("S.res.copper=702;S.res.iron=803;S.popAlloc.copper=2;S.popAlloc.iron=1;S.sciences=['sci_prospect','sci_copper','sci_metal','sci_iron'];S.buildings.mine={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.smelter={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  const d = json(e, 'serializeSave()');
  if (version === 0) delete d.v;
  else d.v = version;
  delete d.metalRecipeMode;
  delete d.storageMode;
  delete d.res.coal;
  delete d.popAlloc.coal;
  if (version < 4) { delete d.settlements; delete d.population; delete d.res.deed; }
  if (version < 3) { delete d.ops; delete d.offline; delete d.daily; }
  if (version === 0) delete d.ts;
  return JSON.stringify(d);
}
function withWriteFailure(e, blockedKey) {
  e.run(`(()=>{const original=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key===${JSON.stringify(blockedKey)})throw new Error('quota');original(key,value)}})()`);
}

check('新档默认煤链与 v36 必需字段，零值往返不被缺省替换', () => {
  const e = environment();
  assert.equal(json(e, 'serializeSave()').v, 36);
  assert.equal(e.run('CFG.save.schema'), 24);
  assert.equal(e.run('S.metalRecipeMode'), 'coal');
  assert.equal(e.run('S.res.coal'), 0);
  assert.equal(e.run('S.popAlloc.coal'), 0);
  assert.equal(e.run('save().ok'), true);
  const saved = JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v, 36);
  assert.equal(saved.metalRecipeMode, 'coal');
  assert.equal(saved.res.coal, 0);
  assert.equal(saved.popAlloc.coal, 0);
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.equal(loaded.run('S.metalRecipeMode'), 'coal');
  assert.equal(loaded.run('S.res.coal'), 0);
  assert.equal(loaded.run('S.popAlloc.coal'), 0);
});

check('零战斗：新档真实建学院、长科研、派煤铜铁工后得到铜和铁', () => {
  const e = environment();
  assert.equal(e.run('S.population.current'), 0);
  assert.equal(e.run('maxPop()'), 4);
  assert.equal(e.run('S.defeated.length'), 0);
  e.run("buildAct('academy')");
  assert.equal(e.run("bldSt('academy').state"), 'building');
  advanceUntil(e, 'S.population.current===4&&bldSt("academy").lv===1', 30);
  for (const rk of ['wood','stone','food','tech'])
    assert.equal(e.run(`setPopAlloc('${rk}',1).ok`), true, `派遣 ${rk}`);
  for (const id of ['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron']) {
    const required = e.run(`activeSciences()['${id}'].cost.tech`);
    assert.ok(Number.isFinite(required) && required > 0, `${id} 必须存在于实际科技表`);
    while (e.run("resCap('tech')") < required) {
      const cost = json(e, "upCost('academy')");
      advanceUntil(e, `S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}&&S.res.food>=${cost.food}`);
      e.run("buildAct('academy')");
      assert.equal(e.run("bldSt('academy').state"), 'upgrading');
      advanceUntil(e, "bldSt('academy').state==='idle'", 300);
    }
    advanceUntil(e, `S.res.tech>=${required}`);
    const before = e.run('S.res.tech');
    assert.equal(e.run(`researchScience('${id}').ok`), true, `研究 ${id}`);
    assert.equal(e.run(`scienceUnlocked('${id}')`), true);
    approx(e.run('S.res.tech'), before - required, `${id} 单次扣费`);
  }
  assert.equal(e.run('S.defeated.length'), 0);
  assert.equal(e.run('S.res.coal'), 0);
  assert.equal(e.run('S.res.copper'), 0);
  assert.equal(e.run('S.res.iron'), 0);
  for (const rk of ['wood','food','tech']) assert.equal(e.run(`setPopAlloc('${rk}',0).ok`), true);
  assert.equal(e.run("setPopAlloc('coal',2).ok"), true);
  assert.equal(e.run("setPopAlloc('copper',1).ok"), true);
  e.run('tick()');
  assert.ok(e.run('S.res.copper') > 0, '未直接赠铜时第一笔铜应可由石煤生产');
  const copper = e.run('S.res.copper');
  assert.equal(e.run("setPopAlloc('copper',0).ok"), true);
  assert.equal(e.run("setPopAlloc('coal',1).ok"), true);
  assert.equal(e.run("setPopAlloc('iron',1).ok"), true);
  e.run('tick()');
  assert.ok(e.run('S.res.iron') > 0, '未直接赠铁时第一笔铁应可由石煤生产');
  assert.equal(e.run('S.res.copper'), copper, '新铁链不得吃铜');
  assert.equal(e.run('S.defeated.length'), 0);
});

check('岗位动作门：新模式研究先于煤铜铁岗位，工坊不再是前置', () => {
  const e = environment();
  e.run('S.population.current=4');
  assert.equal(e.run("setPopAlloc('coal',1).ok"), false);
  assert.equal(e.run('S.popAlloc.coal'), 0);
  e.run("S.sciences.push('sci_coal')");
  assert.equal(e.run("setPopAlloc('coal',1).ok"), true);
  assert.equal(e.run("bldSt('coal_mine').lv"), 0);
  assert.equal(e.run("setPopAlloc('copper',1).ok"), false);
  e.run("S.sciences.push('sci_copper')");
  assert.equal(e.run("setPopAlloc('copper',1).ok"), true);
  assert.equal(e.run("bldSt('mine').lv"), 0);
  assert.equal(e.run("setPopAlloc('iron',1).ok"), false);
  e.run("S.sciences.push('sci_iron')");
  assert.equal(e.run("setPopAlloc('iron',1).ok"), true);
  assert.equal(e.run("bldSt('smelter').lv"), 0);
});

check('一在线秒：石煤先采，再冶铜，真实输入与输出各自守恒', () => {
  const e = unlockedCoalFixture();
  e.run('S.popAlloc={stone:1,coal:2,copper:1};S.res=productionSecond()');
  approx(e.run('S.res.stone'), 0, '石净流');
  approx(e.run('S.res.coal'), 0, '煤净流');
  approx(e.run('S.res.copper'), 1, '铜产出');
  approx(e.run('S.res.iron'), 0, '铁未开工');
});

check('一在线秒：铁耗石2煤1而不耗铜，产出 0.5', () => {
  const e = unlockedCoalFixture();
  e.run('S.popAlloc={stone:1,coal:1,iron:1};S.res.copper=31;S.res=productionSecond()');
  approx(e.run('S.res.stone'), 0, '石净流');
  approx(e.run('S.res.coal'), 0, '煤净流');
  approx(e.run('S.res.iron'), 0.5, '铁产出');
  approx(e.run('S.res.copper'), 31, '铜不得被铁消耗');
});

check('缺石、缺煤、未足一秒原料均整条停工，不扣另一种原料', () => {
  for (const [stone, coal] of [[0, 20], [20, 0], [1, 20], [20, 1]]) {
    const e = unlockedCoalFixture();
    e.run(`S.popAlloc={copper:1};S.res.stone=${stone};S.res.coal=${coal};S.res=productionSecond()`);
    approx(e.run('S.res.copper'), 0, `铜停工 ${stone}/${coal}`);
    approx(e.run('S.res.stone'), stone, `石不误扣 ${stone}/${coal}`);
    approx(e.run('S.res.coal'), coal, `煤不误扣 ${stone}/${coal}`);
  }
});

check('成品满仓停料；半格剩余按实存产量同比扣料；历史超仓不裁剪', () => {
  const e = unlockedCoalFixture();
  e.run("S.popAlloc={copper:1};S.res.stone=20;S.res.coal=20;S.res.copper=resCap('copper');S.res=productionSecond()");
  assert.equal(e.run('S.res.copper'), 600);
  assert.equal(e.run('S.res.stone'), 20);
  assert.equal(e.run('S.res.coal'), 20);
  e.run("S.res.copper=599.5;S.res=productionSecond()");
  approx(e.run('S.res.copper'), 600, '半格铜入仓');
  approx(e.run('S.res.stone'), 19, '半格仅扣石1');
  approx(e.run('S.res.coal'), 19, '半格仅扣煤1');
  e.run("S.res.copper=607;S.res=productionSecond()");
  approx(e.run('S.res.copper'), 607, '历史超仓保留');
  approx(e.run('S.res.stone'), 19, '超仓不扣石');
  approx(e.run('S.res.coal'), 19, '超仓不扣煤');
});

check('离线 0.6 倍每秒同倍率缩放原料和成品，结算重复不发奖', () => {
  const e = unlockedCoalFixture();
  e.run('S.popAlloc={stone:1,coal:2,copper:1}');
  const first = json(e, 'offlineAdvanceSec(1,0.6)');
  assert.equal(first.elapsed, 1);
  approx(e.run('S.res.stone'), 0, '离线石净流');
  approx(e.run('S.res.coal'), 0, '离线煤净流');
  approx(e.run('S.res.copper'), 0.6, '离线铜产出');
  e.run('S.res.food=1000;save();_loadedTs=Date.now()-121000');
  const settled = json(e, 'settleOffline()');
  assert.equal(settled.ok, true);
  const before = e.run('JSON.stringify(S.res)');
  assert.equal(e.run('settleOffline().repeat'), true);
  assert.equal(e.run('JSON.stringify(S.res)'), before);
});

check('18 人已扩容目标状态：真实口粮与生产同秒结算后石煤粮净增、铁币产出', () => {
  // 这是扩容完成后的岗位预算验证；从新档买齐地契的时长需另作完整曲线推演。
  const e = unlockedCoalFixture();
  e.run("S.currencyRecipeMode='legacy';S.settlements.village=14;S.population.current=18;S.sciences.push('sci_mint','sci_coin');S.buildings.academy={lv:1,state:'idle'};S.buildings.mint={lv:1,state:'idle'};S.popAlloc={wood:1,stone:3,food:2,tech:1,coal:4,copper:1,iron:1,coin:1};S.res.food=100");
  assert.equal(e.run('maxPop()'), 18);
  assert.equal(e.run('popAllocTotal()'), 14);
  const before = json(e, 'S.res');
  e.run('S.res=productionSecond()');
  approx(e.run('S.res.stone') - before.stone, 2, '石净产');
  approx(e.run('S.res.coal') - before.coal, 1, '煤净产');
  approx(e.run('S.res.food') - before.food, 1.7, '粮净产含人口口粮及铸币耗粮');
  assert.ok(e.run('S.res.iron') > before.iron);
  assert.ok(e.run('S.res.coin') > before.coin);
});

check('煤铜铁分别有 600 基础容量，已完成的各自专仓独立扩 200', () => {
  const e = unlockedCoalFixture();
  for (const rk of ['coal','copper','iron']) assert.equal(e.run(`resCap('${rk}')`), 600);
  e.run("S.buildings.coal_store={lv:0,state:'building',timer:3,timerEnd:3};S.buildings.warehouse={lv:7,state:'idle'};S.buildings.mine={lv:4,state:'idle'};S.buildings.smelter={lv:4,state:'idle'}");
  for (const rk of ['coal','copper','iron']) assert.equal(e.run(`resCap('${rk}')`), 600, `${rk} 不受通用仓和工坊影响`);
  e.run("S.buildings.coal_store={lv:1,state:'idle'}");
  assert.equal(e.run("resCap('coal')"), 800);
  assert.equal(e.run("resCap('copper')"), 600);
  assert.equal(e.run("resCap('iron')"), 600);
  e.run("S.buildings.coal_store.state='upgrading';S.buildings.copper_store={lv:1,state:'idle'};S.buildings.iron_store={lv:1,state:'idle'}");
  for (const rk of ['coal','copper','iron']) assert.equal(e.run(`resCap('${rk}')`), 800, `${rk} 已完成等级扩容`);
  for (const bk of ['coal_store','copper_store','iron_store'])
    for (const rk of ['wood','stone','food'])
      assert.ok(e.run(`CFG.buildings.${bk}.build.${rk}<resCap('${rk}')`), `${bk} 首级 ${rk} 费用不能先要专仓`);
});

check('旧配方研究与生产保持原建筑门、铜无料、铁每工耗铜3及旧仓容', () => {
  const e = unlockedCoalFixture();
  e.run("S.metalRecipeMode='legacy';S.res.stone=0;S.res.coal=0;S.res.copper=10;S.res.iron=0;S.popAlloc={copper:1,iron:1}");
  assert.notEqual(e.run("workerLockReason('copper')"), '', '旧配方铜岗位仍需要矿井');
  e.run("S.buildings.mine={lv:1,state:'idle'};S.buildings.smelter={lv:1,state:'idle'}");
  assert.equal(e.run("workerLockReason('copper')"), '');
  assert.equal(e.run("workerLockReason('iron')"), '');
  assert.equal(e.run("resCap('copper')"), 10000);
  assert.equal(e.run("resCap('iron')"), 7600);
  const copperRate = e.run("prodRate('copper')"), ironRate = e.run("prodRate('iron')");
  e.run('S.res=productionSecond()');
  approx(e.run('S.res.copper'), 10 + copperRate - 3, '旧配方铜净流');
  approx(e.run('S.res.iron'), ironRate, '旧配方铁产出');
  assert.equal(e.run('S.res.coal'), 0);
  assert.equal(e.run('S.res.stone'), 0);
});

for (const version of [0,2,3,4]) check(`v${version} 旧档有金属进度时迁为 legacy，保留原值及迁移前副本`, () => {
  const raw = oldSave(version, true);
  const e = environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'), 'migrated');
  assert.equal(e.store.get('rts_save_premigration'), raw);
  assert.equal(e.run('S.metalRecipeMode'), 'legacy');
  assert.equal(e.run('S.res.copper'), 702);
  assert.equal(e.run('S.res.iron'), 803);
  assert.equal(e.run('S.popAlloc.copper'), 2);
  assert.equal(e.run('S.popAlloc.iron'), 1);
  assert.equal(e.run("scienceUnlocked('sci_copper')"), true);
  assert.equal(e.run('S.res.coal'), 0);
  assert.equal(e.run('S.popAlloc.coal'), 0);
  const written = JSON.parse(e.store.get('rts_save'));
  assert.equal(written.v, 36);
  assert.equal(written.metalRecipeMode, 'legacy');
  assert.equal(written.res.copper, 702);
  assert.equal(written.res.iron, 803);
});

for (const version of [0,2,3,4]) check(`v${version} 无金属进度旧档迁为 coal，不赠资源`, () => {
  const raw = oldSave(version, false);
  const e = environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'), 'migrated');
  assert.equal(e.run('S.metalRecipeMode'), 'coal');
  assert.equal(e.run('S.res.coal'), 0);
  assert.equal(e.run('S.res.copper'), 0);
  assert.equal(e.run('S.res.iron'), 0);
  assert.equal(e.run('S.popAlloc.coal'), 0);
  assert.equal(e.store.get('rts_save_premigration'), raw);
});

check('v36 缺字段、非法模式拒载，v37 未来档原文保护且可导出', () => {
  const seed = environment(), valid = json(seed, 'serializeSave()');
  assert.equal(valid.v, 36);
  for (const mutate of [
    d => { delete d.res.coal; },
    d => { delete d.popAlloc.coal; },
    d => { delete d.metalRecipeMode; },
    d => { d.metalRecipeMode = 'unknown'; },
    d => { d.res.coal = -1; },
    d => { d.popAlloc.coal = NaN; }
  ]) {
    const d = structuredClone(valid); mutate(d);
    const raw = JSON.stringify(d), e = environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'), 'invalid');
    assert.equal(e.run('saveProtected()'), true);
    e.run('tick();save()');
    assert.equal(e.store.get('rts_save'), raw);
  }
  const future = {...valid, v:37};
  const raw = JSON.stringify(future), e = environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'), 'future');
  assert.equal(e.run('saveProtected()'), true);
  e.run('tick();save()');
  assert.equal(e.store.get('rts_save'), raw);
  assert.equal(e.run('exportMasterRawText()'), raw);
});

check('迁移前副本、轮转备份、主档任一写失败均不应用候选或覆盖主档', () => {
  const raw = oldSave(4, true);
  for (const key of ['rts_save_premigration','rts_save_backup_1','rts_save']) {
    const e = environment({rts_save:raw});
    withWriteFailure(e, key);
    assert.equal(e.run('loadSaveAndApply().status'), 'migrated_readonly', key);
    assert.equal(e.run('saveProtected()'), true, key);
    assert.equal(e.store.get('rts_save'), raw, key);
    assert.equal(e.run('S.res.copper'), 0, `${key} 失败前不得应用候选`);
    assert.equal(e.run('S.metalRecipeMode'), 'coal', `${key} 失败前不得切换模式`);
  }
});

check('煤研究动作主档写失败：科技费、研究记录与幂等标记全部回滚', () => {
  const e = environment();
  e.run("S.sciences.push('sci_prospect');S.res.tech=500;save()");
  const master = e.store.get('rts_save');
  const before = e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})');
  withWriteFailure(e, 'rts_save');
  assert.equal(e.run("researchScience('sci_coal').reason"), 'save-failed');
  assert.equal(e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})'), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('煤仓建造动作主档写失败：已付木石粮和新建筑全部回滚', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal'];save()");
  const master = e.store.get('rts_save');
  const before = e.run('JSON.stringify({res:S.res,buildings:S.buildings})');
  withWriteFailure(e, 'rts_save');
  assert.equal(e.run("buildAct('coal_store').reason"), 'save-failed');
  assert.equal(e.run('JSON.stringify({res:S.res,buildings:S.buildings})'), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('煤岗位分配动作主档写失败：分工与旧主档不变', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal'];S.population.current=4;save()");
  const master = e.store.get('rts_save');
  const before = e.run('JSON.stringify(S.popAlloc)');
  withWriteFailure(e, 'rts_save');
  assert.equal(e.run("setPopAlloc('coal',1).reason"), 'save-failed');
  assert.equal(e.run('JSON.stringify(S.popAlloc)'), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('v5 有煤与历史超仓可导出、导入、恢复并往返；导入仅在重载后应用', () => {
  const e = environment();
  e.run("S.res.coal=1007;S.res.copper=812;S.res.iron=922;S.popAlloc.coal=2;S.population.current=4;save()");
  const source = e.store.get('rts_save');
  assert.equal(e.run('inspectSaveText(exportCurrentSaveText()).ok'), true);
  const target = environment();
  assert.equal(target.run(`commitSaveData(${JSON.stringify(source)}).ok`), true);
  assert.equal(target.run('loadSaveAndApply().status'), 'ok');
  assert.equal(target.run('S.res.coal'), 1007);
  assert.equal(target.run('S.res.copper'), 812);
  assert.equal(target.run('S.res.iron'), 922);
  assert.equal(target.run('S.popAlloc.coal'), 2);
  target.run('S.res.coal=0;save()');
  assert.equal(target.run(`restoreBackupByText(${JSON.stringify(source)}).ok`), true);
  const restored = environment(Object.fromEntries(target.store));
  assert.equal(restored.run('loadSaveAndApply().status'), 'ok');
  assert.equal(restored.run('S.res.coal'), 1007);
  assert.equal(restored.run('S.popAlloc.coal'), 2);
});

check('旧配方切换前需煤研究，失败不改库存或模式，成功一次且超仓不裁剪', () => {
  const raw = oldSave(4, true), e = environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'), 'migrated');
  assert.equal(e.run('S.metalRecipeMode'), 'legacy');
  assert.equal(e.run('switchMetalRecipeMode().ok'), false);
  assert.equal(e.run('S.metalRecipeMode'), 'legacy');
  e.run("S.sciences.push('sci_coal')");
  const before = e.run('JSON.stringify(S.res)');
  const persisted = e.store.get('rts_save');
  withWriteFailure(e, 'rts_save');
  assert.equal(e.run('switchMetalRecipeMode().ok'), false);
  assert.equal(e.run('S.metalRecipeMode'), 'legacy');
  assert.equal(e.run('JSON.stringify(S.res)'), before);
  assert.equal(e.store.get('rts_save'), persisted);
  const good = environment(Object.fromEntries(e.store));
  assert.equal(good.run('loadSaveAndApply().status'), 'ok');
  good.run("S.sciences.push('sci_coal')");
  assert.equal(good.run('switchMetalRecipeMode().ok'), true);
  assert.equal(good.run('S.metalRecipeMode'), 'coal');
  assert.equal(good.run('S.res.copper'), 702);
  assert.equal(good.run('S.res.iron'), 803);
  assert.equal(JSON.parse(good.store.get('rts_save')).metalRecipeMode, 'coal');
  assert.equal(good.run('switchMetalRecipeMode().ok'), false, '不得重复或反向切换');
});

check('驻军与远征零煤铁奖励不裁剪既有超专仓库存', () => {
  const e = unlockedCoalFixture();
  e.run("S.res.coal=resCap('coal')+7;S.res.iron=resCap('iron')+9;applyGarrisonResult({name:'煤链测试',reward:{wood:1},merit:0},{outcome:'win',ourUnits:[],rounds:1,ourLeft:1,enemyLeft:0,towerShots:0,towerDmg:0})");
  assert.equal(e.run('S.res.coal'), 607);
  assert.equal(e.run('S.res.iron'), 609);
  e.run("S.selEnemy=0;S.formation={front:[],mid:[],back:[]};S._preForm={front:[],mid:[],back:[]};B.ourUnits=[];B.isTraining=false;CFG.enemies[0].reward={wood:1};endBattle('win')");
  assert.equal(e.run('S.res.coal'), 607);
  assert.equal(e.run('S.res.iron'), 609);
});

console.log(`${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
