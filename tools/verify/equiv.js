'use strict';
// 切片2 证据脚本：开关关闭时"零行为变化"客观对拍
// 做法：从 git HEAD 取出改动前的 config.js / math.js 到临时目录（旧版），与工作区当前版本（新版）在
//       相同输入下执行相同操作序列，比较存档文本（剔除 ts 时间戳）。
// 用法：node tools/verify/equiv.js
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv2-'));
const OTHERS = ['levels.js', 'garrison.js', 'technology.js'];

function loadEnv(dir) {
  const store = new Map();
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, classList: { add() { }, remove() { }, contains() { return false } }, setAttribute() { }, remove() { }, appendChild() { }, addEventListener() { } });
  const ctx = {
    console, Date, Math, JSON,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    document: { getElementById: el, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null },
    window: {}, setTimeout: () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { },
    updateUI: () => { }, toast: () => { }, addLog: () => { }, pix: () => ''
  };
  const sb = vm.createContext(ctx);
  for (const f of ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: f });
  }
  return { run: code => vm.runInContext(code, sb), store };
}

// 1) 准备"旧版"目录：config/math 取 git HEAD，其余取工作区
for (const f of OTHERS) fs.copyFileSync(path.join(ROOT, f), path.join(TMP, f));
for (const f of ['config.js', 'math.js']) {
  const old = execFileSync('git', ['show', 'HEAD:' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(TMP, f), old);
}
console.log('旧版来源: git HEAD:config.js + git HEAD:math.js →', TMP);
console.log('新版来源: 工作区', ROOT);

// 2) 固定输入：一份 legacy 存档 + 固定操作序列
const FIX = JSON.stringify({
  res: { wood: 12345.5, stone: 6000, food: 777, tech: 88, copper: 11, iron: 5, coin: 7 },
  buildings: { barracks: { lv: 3, state: 'idle', timer: 0, timerEnd: 0, tier: 1 }, warehouse: { lv: 5, state: 'upgrading', timer: 12, timerEnd: 12 }, lumber_mill: { lv: 2, state: 'idle', timer: 0, timerEnd: 0, tier: 0 } },
  pool: { infantry: 12, archer: 5, cavalry_t1: 3 }, queue: { infantry: { count: 8, timer: 0, reason: '' } },
  formation: { front: [{ type: 'infantry', count: 6, id: 111 }], mid: [{ type: 'archer', count: 4, id: 222 }], back: [] },
  townLv: 4, popAlloc: { wood: 5, stone: 4, food: 6 }, defeated: [1, 2, 3, 10, 11, 20], merit: 37,
  garrisonLog: [{ time: '12:00:00', msg: '演练' }],
  garrison: { phase: 'cooldown', phaseStarted: 100, phaseUntil: 130, cooldownUntil: 0, nextCheckTick: 160, templateId: 'forest_scout', result: 'win', seed: 42 },
  tick: 3456, garrisonForm: { front: [{ type: 'infantry', count: 3, id: 333 }], mid: [], back: [{ type: 'archer', count: 2, id: 444 }] },
  townUpgrade: null, upgradedUnits: { infantry_t1: true }, essence: { shield_essence: 2, wind_essence: 1 }
});
// 强制把"新版的全部改造开关"关闭后再对拍：证明开关层完整隔离（等价于改造前行为）
const OFF = [
  'if(CFG.tech)CFG.tech.sciencesNoMerit=false;',
  'if(CFG.tech)CFG.tech.longLadder=false;',
  'if(CFG.tech)CFG.tech.occupyPop=false;',
  'if(CFG.caps)CFG.caps.expanded=false;',
  'if(CFG.offline)CFG.offline.enabled=false;',
  'if(CFG.idem)CFG.idem.enabled=false;',
  'if(CFG.upkeep)CFG.upkeep.freeBand=false;',
  'if(CFG.passive)CFG.passive.needPop=false;',
  'if(CFG.market)CFG.market.multiRate=false;',
  'if(CFG.food)CFG.food.aligned=false;',
  'if(CFG.pop)CFG.pop.growth=false;',
  'if(CFG.unitCapBoost)CFG.unitCapBoost.enabled=false;',
  'if(CFG.ownMax)CFG.ownMax.enabled=false;',
  'if(CFG.save)CFG.save.v3=false;',
  'if(CFG.townGate)CFG.townGate.useDeed=false;'
].join('');
const SEQ = "loadSaveAndApply();" + OFF + "S.garrison={phase:'idle',phaseStarted:0,phaseUntil:0,cooldownUntil:0,nextCheckTick:999999999,templateId:null,result:null,seed:1};for(var i=0;i<300;i++){tick();}save();";

function runCase(dir, label) {
  const e = loadEnv(dir);
  e.store.set('rts_save', FIX);
  e.run(SEQ);
  const raw = e.store.get('rts_save');
  const obj = JSON.parse(raw); delete obj.ts;
  return { label, text: JSON.stringify(obj), keys: Object.keys(obj).sort().join(',') };
}

const a = runCase(TMP, '旧版(HEAD)');
const b = runCase(ROOT, '新版(工作区)');
console.log('\n字段集一致:', a.keys === b.keys ? '✅ 相同' : '❌ 不同');
if (a.keys !== b.keys) { console.log('  旧:', a.keys); console.log('  新:', b.keys); }
console.log('存档内容(剔 ts)一致:', a.text === b.text ? '✅ 逐字节相同' : '❌ 存在差异');
if (a.text !== b.text) {
  let i = 0; while (i < a.text.length && a.text[i] === b.text[i]) i++;
  console.log('  首个差异位置', i, '\n  旧:', a.text.slice(Math.max(0, i - 40), i + 80), '\n  新:', b.text.slice(Math.max(0, i - 40), i + 80));
}
console.log('\n结论: ' + ((a.keys === b.keys && a.text === b.text) ? '开关默认关闭时零行为变化 ✅' : '存在行为差异 ❌'));
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
process.exit(a.keys === b.keys && a.text === b.text ? 0 : 1);
