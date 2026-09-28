'use strict';

// 发展科技直链回归：只调用游戏中的真实研究、人口、建造和存档函数。
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

function researchWithCurrentTech(e, id) {
  const price = e.run(`activeSciences().${id}.cost.tech`);
  e.run(`S.res.tech=${price}`);
  return e.run(`researchScience('${id}')`);
}

function failureOnMasterWrite(e) {
  e.run(`const originalEraSetItem=localStorage.setItem;
    localStorage.setItem=(key,value)=>{
      if(key==='rts_save')throw new Error('simulated master write failure');
      originalEraSetItem(key,value);
    }`);
}

check('冶铜后可直接研究城镇化，旧冶金术不再阻断主线', () => {
  const e = environment();
  assert.equal(researchWithCurrentTech(e, 'sci_prospect').ok, true);
  assert.equal(researchWithCurrentTech(e, 'sci_coal').ok, true);
  assert.equal(researchWithCurrentTech(e, 'sci_copper').ok, true);
  assert.equal(e.run("S.sciences.includes('sci_metal')"), false);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_urbanization')")), ['sci_copper']);
  assert.equal(researchWithCurrentTech(e, 'sci_urbanization').ok, true);
  assert.equal(e.run("S.sciences.includes('sci_urbanization')"), true);
  assert.equal(e.run("settlementLockReason('smallTown')"), '');
  assert.equal(e.run("upgradeSettlement('smallTown',0).ok"), true);
  assert.equal(e.run('maxPop()'), 6);
  assert.equal(e.run('S.defeated.length'), 0);
});

check('冶铁术不能绕过城镇化，旧冶金术标记也不能代替', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_metal']");
  const price = e.run('activeSciences().sci_iron.cost.tech');
  const result = researchWithCurrentTech(e, 'sci_iron');
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_iron')")), ['sci_urbanization']);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'science-prerequisite');
  assert.equal(e.run('S.res.tech'), price);
  assert.equal(e.run('S.sciences.includes("sci_iron")'), false);
  // 研究拒绝不能扣费或写主档。
  assert.equal(e.run('JSON.stringify({sciences:S.sciences,ops:S.ops})'),
    JSON.stringify({sciences:['sci_prospect','sci_coal','sci_copper','sci_metal'],ops:[]}));
  assert.equal(e.store.has('rts_save'), false);
});

check('城市化不能绕过冶铁术', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_urbanization']");
  const result = researchWithCurrentTech(e, 'sci_city');
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_city')")), ['sci_iron']);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'science-prerequisite');
  assert.equal(e.run("S.sciences.includes('sci_city')"), false);
  assert.equal(e.store.has('rts_save'), false);
});

check('新档完整研究直链由真实学者产知识、无关卡可逐项扣费解锁', () => {
  const e = environment();
  assert.equal(e.run("buildAct('academy').ok"), true);
  e.run('for(let i=0;i<20;i++)tick()');
  assert.equal(e.run("bldSt('academy').lv"), 1);
  assert.equal(e.run('popCurrent()'), 4);
  assert.equal(e.run("setPopAlloc('food',1).ok"), true);
  assert.equal(e.run("setPopAlloc('tech',3).ok"), true);
  assert.ok(e.run("prodRate('tech')") > 0);
  const ids = ['sci_prospect','sci_coal','sci_copper','sci_urbanization','sci_iron','sci_city'];
  for (const id of ids) {
    const price = e.run(`activeSciences().${id}.cost.tech`);
    const waited = e.run(`(()=>{let n=0;while(S.res.tech<${price}&&n<10000){tick();n++}return n})()`);
    assert.ok(waited < 10000, `${id} 应能以实际学者生产积累到研究费用`);
    const before = e.run('S.res.tech');
    assert.equal(e.run(`researchScience('${id}').ok`), true, `${id} 真实动作应可研究`);
    assert.equal(e.run('S.res.tech'), before-price, `${id} 应只扣一次知识`);
    assert.equal(e.run(`S.sciences.includes('${id}')`), true);
  }
  assert.equal(e.run("S.sciences.includes('sci_metal')"), false);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_city')")), ['sci_iron']);
  assert.equal(e.run('S.defeated.length'), 0);
  assert.ok(e.run('S.res.food') > 0, '学者生产期间的实际人口口粮应可持续');
  assert.equal(e.run("upgradeSettlement('smallTown',0).ok"), true);
  e.run('S.res.deed=100');
  assert.equal(e.run("upgradeSettlement('city',1).ok"), true,
    '城市扩容动作须认真实研究结果，不依赖关卡');
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.equal(loaded.run("S.sciences.includes('sci_city')"), true);
  assert.equal(loaded.run('S.settlements.smallTown'), 1);
  assert.equal(loaded.run('S.settlements.city'), 2);
});

check('新档不能研究历史冶金术，但仍认识旧科技 ID', () => {
  const e = environment();
  assert.equal(e.run("sciIdKnown('sci_metal')"), true);
  assert.equal(e.run('activeSciences().sci_metal.legacyOnly'), true);
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper']");
  const price = e.run('activeSciences().sci_metal.cost.tech');
  e.run(`S.res.tech=${price}`);
  const before = e.run('JSON.stringify({res:S.res,sciences:S.sciences,ops:S.ops})');
  const result = e.run("researchScience('sci_metal')");
  assert.equal(result.ok, false);
  assert.equal(e.run('JSON.stringify({res:S.res,sciences:S.sciences,ops:S.ops})'), before);
  assert.equal(e.store.has('rts_save'), false);
});

check('旧 v5 已研究冶金术、冶铁术及历史容量原样重载，不追缴旧前置', () => {
  const e = environment();
  e.run(`S.sciences=['sci_prospect','sci_coal','sci_copper','sci_metal','sci_iron'];
    S.settlements.smallTown=2;S.population.current=8;S.res.tech=0;S.res.deed=0`);
  assert.equal(e.run('save().ok'), true);
  const master = e.store.get('rts_save');
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.deepEqual(Array.from(loaded.run('S.sciences')),
    ['sci_prospect','sci_coal','sci_copper','sci_metal','sci_iron']);
  assert.equal(loaded.run('S.population.current'), 8);
  assert.equal(loaded.run('S.res.tech'), 0);
  assert.equal(loaded.run('S.res.deed'), 0);
  assert.equal(loaded.run('S.settlements.smallTown'), 2);
  assert.equal(loaded.store.get('rts_save'), master);
});

check('城镇化研究写档失败时知识、研究状态与幂等记录一并回滚', () => {
  const e = environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper'];S.res.tech=1400");
  assert.equal(e.run('save().ok'), true);
  const master = e.store.get('rts_save');
  const before = e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})');
  failureOnMasterWrite(e);
  assert.equal(e.run("researchScience('sci_urbanization').reason"), 'save-failed');
  assert.equal(e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})'), before);
  assert.equal(e.store.get('rts_save'), master);
});

console.log(`${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
