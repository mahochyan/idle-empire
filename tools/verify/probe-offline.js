'use strict';
// 复现探针：为什么浏览器 L2 场景里只有食物入账？（只读，不改游戏文件）
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
function makeEnv(saveText) {
  const store = new Map(); if (saveText) store.set('rts_save', saveText);
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, classList: { add() { }, remove() { }, contains() { return false } }, setAttribute() { }, remove() { }, appendChild() { }, addEventListener() { } });
  const ctx = { console, Date, Math, JSON, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    document: { getElementById: el, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null }, window: {},
    setTimeout: () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { }, updateUI: () => { }, toast: () => { }, addLog: () => { }, pix: () => '' };
  const sb = vm.createContext(ctx);
  for (const f of ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return { run: c => vm.runInContext(c, sb), store };
}
// 模拟浏览器 L2 场景：迁移后的 legacy 档（无建筑）+ 1 小时前 ts + wood=1000
const save = { v: 3, ts: Date.now() - 3600 * 1000, res: { wood: 1000, stone: 2, food: 1000, tech: 0, copper: 0, iron: 0, coin: 0 }, buildings: {}, pool: {}, queue: {}, formation: { front: [], mid: [], back: [] }, townLv: 2, popAlloc: { wood: 2, stone: 1, food: 1 }, defeated: [1, 10], merit: 5, garrisonLog: [], garrison: null, tick: 66, garrisonForm: { front: [], mid: [], back: [] }, townUpgrade: null, upgradedUnits: {}, essence: {}, sciences: [], ops: [], offline: { pendingReport: null }, daily: { day: null, counts: {} } };
const e = makeEnv(JSON.stringify(save));
console.log('load:', JSON.stringify(e.run('JSON.stringify(loadSaveAndApply())')));
console.log('popAlloc:', e.run('JSON.stringify(S.popAlloc)'), '| maxPop:', e.run('maxPop()'), '| popCurrent:', e.run('popCurrent()'));
console.log('prodRate wood/stone/food:', e.run("prodRate('wood')"), e.run("prodRate('stone')"), e.run("prodRate('food')"));
console.log('resCap wood/stone/food:', e.run("resCap('wood')"), e.run("resCap('stone')"), e.run("resCap('food')"));
console.log('offlineNetRates:', e.run('JSON.stringify(offlineNetRates())'));
const r = e.run('JSON.stringify(settleOffline())');
console.log('settle:', r);
console.log('S.res:', e.run('JSON.stringify(S.res)'));
console.log('pendingReport:', e.run('JSON.stringify(S.offline.pendingReport)'));
