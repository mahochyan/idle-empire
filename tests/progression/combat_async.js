'use strict';
// Regression probes for asynchronous combat and the save boundary. The file
// loads the real game scripts through the existing VM harness, then replaces
// only browser timers/DOM and the UI log sink with deterministic test doubles.
const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (err) { failed++; console.error('FAIL ' + name + '\n' + err.stack); }
}

function battleEnvironment() {
  const e = environment();
  e.run(`
    globalThis.__timers = new Map();
    globalThis.__timerHistory = new Map();
    globalThis.__nextTimerId = 1;
    globalThis.setTimeout = (fn, delay) => {
      const id = __nextTimerId++;
      const item = {fn, delay};
      __timers.set(id, item);
      __timerHistory.set(id, item);
      return id;
    };
    globalThis.clearTimeout = id => __timers.delete(id);
    globalThis.__fireTimer = id => {
      const item = __timers.get(id);
      if (!item) throw new Error('Timer missing: ' + id);
      __timers.delete(id);
      item.fn();
    };
    globalThis.__fireStaleTimer = id => {
      const item = __timerHistory.get(id);
      if (!item) throw new Error('Timer missing from history: ' + id);
      item.fn(); // Models an already-delivered callback after clearTimeout.
    };
    globalThis.__nodes = new Map();
    document.getElementById = id => {
      // The visible battle cards are absent in this DOM double, so visual
      // effects do not create extra timers. State and settlement remain real.
      if (id.startsWith('ou-') || id.startsWith('eu-')) return null;
      if (!__nodes.has(id)) __nodes.set(id, {
        style:{}, innerHTML:'', textContent:'', scrollHeight:0, scrollTop:0,
        classList:{add(){}, remove(){}, toggle(){}, contains(){return false}},
        setAttribute(){}, appendChild(){}, remove(){}
      });
      return __nodes.get(id);
    };
    globalThis.addLog = message => S.log.push(String(message));
    S.selEnemy = 0;
    S.formation = {front:[{type:'infantry', count:12, id:101}], mid:[], back:[]};
  `);
  return e;
}

check('逃跑后快速重开：旧攻击定时回调不得写进新战斗', () => {
  const e = battleEnvironment();
  e.run('openBattle()');
  const firstRound = e.run('battleTimer');
  e.run(`__fireTimer(${firstRound})`); // battleTurn schedules a per-action timeout
  const oldAction = e.run('Array.from(__timers.keys())[0]');
  assert.ok(Number.isInteger(oldAction), '旧战斗应有待执行的行动回调');

  e.run('fleeBattle(); openBattle()');
  const newBattleMessages = e.run('B.msgs.length');
  assert.equal(e.run('S.battleActive'), true);
  e.run(`__fireStaleTimer(${oldAction})`);
  assert.equal(e.run('B.msgs.length'), newBattleMessages,
    '旧战斗的行动回调污染了新战斗的消息或结算');
});

for (const reopen of ['retryBattle', 'nextBattle']) {
  check(`${reopen} 延迟重开：导入成功后旧回调不得再启动战斗`, () => {
    const e = battleEnvironment();
    e.run('openBattle(); endBattle("win")');
    e.run(`${reopen}()`);
    const pendingReopen = e.run('Array.from(__timers.entries()).find(([, t]) => t.delay === 150)?.[0]');
    assert.ok(Number.isInteger(pendingReopen), '应有 150ms 延迟重开回调');
    assert.equal(e.run('S.battleActive'), false);

    // Either a save-operation guard must reject import while the callback is
    // pending, or a successful import must cancel that stale callback.
    const importResult = e.run('commitSaveData(exportCurrentSaveText())');
    if (importResult.ok) {
      e.run(`__fireTimer(${pendingReopen})`);
      assert.equal(e.run('S.battleActive'), false,
        '导入已成功，但先前排定的重开回调仍启动了战斗');
    } else {
      assert.match(importResult.reason, /战斗|训练/,
        '导入只能由待执行的战斗回调闸口拒绝');
    }
  });
}

for (const outcome of ['win', 'lose']) {
  check(`${outcome} 结算：调用 save 时胜败日志已进入状态`, () => {
    const e = battleEnvironment();
    e.run(`
      const actualSave = save;
      globalThis.__logAtSave = null;
      save = function() {
        __logAtSave = S.log.at(-1) || null;
        return actualSave();
      };
    `);
    e.run('openBattle()');
    e.run(`endBattle('${outcome}')`);
    const liveLog = e.run('S.log.at(-1)');
    assert.match(liveLog, outcome === 'win' ? /战胜/ : /败于/);
    assert.equal(e.run('__logAtSave'), liveLog,
      '胜败日志在 save() 调用之后才进入 S.log');
  });
}

console.log(`${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
