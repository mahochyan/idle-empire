'use strict';
// IE-001 存档安全回归测试
// 运行：node tests/ie001/run.js   （零依赖：node:vm + 存储/DOM 替身，加载真实 config/levels/math/garrison/technology）
// 说明：updateUI/toast/addLog 以环境替身注入（被测对象是存档子系统本身，非 UI）；sprites.js/ui.js 不参与（存档逻辑不依赖二者）。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const FILES = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js']; // 真实加载顺序（去 sprites/ui，见上）

function makeEnv(initial = {}, faults = {}) {
  const store = new Map(Object.entries(initial));
  const F = { getItem: new Set(faults.getItem || []), setItem: new Set(faults.setItem || []), removeItem: new Set(faults.removeItem || []) };
  const calls = { toast: [], logs: [], ui: 0 };
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, contains: () => false }, value: '', innerHTML: '', textContent: '', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, select() {}, remove() {} });
  const ctx = {
    console, JSON, Math, Number, String, Object, Array, Boolean, Date, RegExp, Set, Map, WeakMap, isFinite, isNaN, parseInt, parseFloat, Infinity, NaN, undefined,
    setTimeout: (f, t) => setTimeout(f, t), clearTimeout: (id) => clearTimeout(id), setInterval: () => 0, clearInterval: () => {},
    localStorage: {
      getItem: (k) => { if (F.getItem.has(k)) throw new Error('read fail'); return store.has(k) ? store.get(k) : null; },
      setItem: (k, v) => { if (F.setItem.has(k)) throw new Error('quota'); store.set(k, String(v)); },
      removeItem: (k) => { if (F.removeItem.has(k)) throw new Error('security'); store.delete(k); }
    }
  };
  ctx.document = { getElementById: el, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null };
  ctx.window = {}; ctx.alert = () => {}; ctx.confirm = () => true; ctx.location = { reload() {} };
  ctx.updateUI = () => { calls.ui++; }; ctx.toast = (m) => calls.toast.push(String(m)); ctx.addLog = (m) => calls.logs.push(String(m));
  ctx.pix = () => ''; // sprites.js 替身：仅被结算面板模板字符串引用，与存档逻辑无关
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return { ctx, store, calls, run: (s) => vm.runInContext(s, ctx), setFault: (op, k) => F[op].add(k) };
}

function fullLegacy() {
  return {
    res: { wood: 12345.5, stone: 6000, food: 777, tech: 88, copper: 11, iron: 5, coin: 7 },
    buildings: { barracks: { lv: 3, state: 'idle', timer: 0, timerEnd: 0, tier: 1 }, warehouse: { lv: 5, state: 'upgrading', timer: 12, timerEnd: 12 }, lumber_mill: { lv: 2, state: 'idle', timer: 0, timerEnd: 0, tier: 0 } },
    pool: { infantry: 12, archer: 5, cavalry_t1: 3 },
    queue: { infantry: { count: 8, timer: 0, reason: '' } },
    formation: { front: [{ type: 'infantry', count: 6, id: 111 }], mid: [{ type: 'archer', count: 4, id: 222 }], back: [] },
    townLv: 4, popAlloc: { wood: 5, stone: 4, food: 6 }, defeated: [1, 2, 3, 10, 11, 20], merit: 37,
    garrisonLog: [{ time: '12:00:00', msg: '演练' }],
    garrison: { phase: 'cooldown', phaseStarted: 100, phaseUntil: 130, cooldownUntil: 0, nextCheckTick: 160, templateId: 'forest_scout', result: 'win', seed: 42 },
    tick: 3456, garrisonForm: { front: [{ type: 'infantry', count: 3, id: 333 }], mid: [], back: [{ type: 'archer', count: 2, id: 444 }] },
    townUpgrade: null, upgradedUnits: { infantry_t1: true }, essence: { shield_essence: 2, wind_essence: 1 }
  };
}
function zerosLegacy() {
  return { res: { wood: 0, stone: 0, food: 0, tech: 0, copper: 0, iron: 0, coin: 0 }, buildings: {}, pool: { infantry: 0, archer: 0 }, queue: {}, formation: { front: [], mid: [], back: [] }, townLv: 1, popAlloc: { wood: 0, stone: 0, food: 0 }, defeated: [], merit: 0, garrisonLog: [], garrison: null, tick: 0, garrisonForm: { front: [], mid: [], back: [] }, townUpgrade: null, upgradedUnits: {}, essence: {} };
}

let pass = 0, fail = 0; const rows = [];
function test(id, name, fn) { try { fn(); pass++; rows.push(['PASS', id, name]); } catch (e) { fail++; rows.push(['FAIL', id, name + ' :: ' + (e && e.message)]); } }
function assert(c, m) { if (!c) throw new Error(m || '断言失败'); }
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), (m || '') + ' 期望=' + JSON.stringify(b) + ' 实际=' + JSON.stringify(a));
const keys = (e) => [...e.store.keys()].sort();

test('S01', '新开局：无档→默认S且零写入；save 写出 v2+ts；重载一致', () => {
  const e = makeEnv();
  assert(e.run('loadSaveAndApply().status') === 'fresh', '应为 fresh');
  assert(e.store.size === 0, 'fresh 不应写任何 key');
  e.run('S.res.wood=555;S.merit=7;save()');
  const d = JSON.parse(e.store.get('rts_save'));
  assert(d.v === 2 && typeof d.ts === 'number' && d.ts > 0, 'v/ts 缺失');
  assert(d.res.wood === 555 && d.merit === 7, '内容不符');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save') });
  assert(e2.run('loadSaveAndApply().status') === 'ok', '重载应 ok');
  assert(e2.run('S.res.wood') === 555 && e2.run('S.merit') === 7, '往返不符');
});

test('S02', 'legacy 全字段：全部保留、PRE=原始文本、主档升 v2 不增不减', () => {
  const fx = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': fx });
  assert(e.run('loadSaveAndApply().status') === 'migrated', '应 migrated');
  assert(e.store.get('rts_save_premigration') === fx, 'PRE 应等于原始 legacy 文本');
  eq(e.run('S.res'), fullLegacy().res, '资源被改动');
  assert(e.run('S.townLv') === 4 && e.run('S.merit') === 37 && e.run('S.tick') === 3456, '进度字段丢失');
  eq(e.run('S.essence'), { shield_essence: 2, wind_essence: 1 }, '精魄丢失');
  assert(e.run('S._garrisonForm.front.length') === 1 && e.run('S._garrisonForm.back.length') === 1, '驻军阵容丢失');
  assert(e.run('S.upgradedUnits.infantry_t1') === true, '研究记录丢失');
  assert(e.run('S.queue.infantry.count') === 8, '训练队列丢失');
  const m = JSON.parse(e.store.get('rts_save'));
  assert(m.v === 2 && typeof m.ts === 'number' && m.res.wood === 12345.5 && m.tick === 3456, '主档升级后内容漂移');
});

test('S03', 'legacy 缺可选字段：独立默认补齐；两次加载互不串写', () => {
  const fx = JSON.stringify({ res: { wood: 900, stone: 1, food: 1, tech: 0 }, townLv: 2, defeated: [1, 10] });
  const e = makeEnv({ 'rts_save': fx });
  assert(e.run('loadSaveAndApply().status') === 'migrated', '应 migrated');
  eq(e.run('S.popAlloc'), { wood: 5, stone: 3, food: 2 }, 'popAlloc 旧口径缺省');
  assert(e.run('S.merit') === 0 && e.run('S.tick') === 0, '缺省数值不符');
  e.run('S.popAlloc.wood=99;S.defeated.push(99);S.res.wood=1');
  const e2 = makeEnv({ 'rts_save': fx });
  e2.run('loadSaveAndApply()');
  assert(e2.run('S.popAlloc.wood') === 5 && e2.run('S.defeated.length') === 2 && e2.run('S.res.wood') === 900, '默认对象被上一次会话串写');
});

test('S04', '合法 0 值往返：0 不变成缺省值', () => {
  const fx = JSON.stringify(zerosLegacy());
  const e = makeEnv({ 'rts_save': fx });
  assert(e.run('loadSaveAndApply().status') === 'migrated', '应 migrated');
  assert(e.run('S.res.wood') === 0 && e.run('S.popAlloc.wood') === 0 && e.run('S.merit') === 0, '0 被缺省值替换');
  e.run('save()');
  const m = JSON.parse(e.store.get('rts_save'));
  assert(m.res.wood === 0 && m.popAlloc.food === 0 && m.merit === 0, '0 值未往返');
});

test('S05', '重复加载/迁移/保存幂等：除 ts 外不变，PRE 不被覆盖', () => {
  const fx = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': fx });
  e.run('loadSaveAndApply()'); e.run('save()');
  const A = JSON.parse(e.store.get('rts_save')); delete A.ts;
  const preA = e.store.get('rts_save_premigration');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save'), 'rts_save_premigration': preA });
  assert(e2.run('loadSaveAndApply().status') === 'ok', '第二次加载应 ok 不再迁移');
  e2.run('save()');
  const B = JSON.parse(e2.store.get('rts_save')); delete B.ts;
  eq(B, A, '二次往返漂移');
  assert(e2.store.get('rts_save_premigration') === preA, 'PRE 被自动保存覆盖');
  assert(JSON.parse(e2.store.get('rts_save_premigration')).v === undefined, 'PRE 应保持 legacy 原文');
});

test('S06', '损坏主档：保护模式；save×3/writeSave/tick 均不能覆盖原文', () => {
  for (const bad of ['not-a-json{', 'null', '[1,2]', '{"res":5}', '{"v":1,"ts":1,"res":{"wood":-4}}']) {
    const e = makeEnv({ 'rts_save': bad });
    const st = e.run('loadSaveAndApply().status');
    assert(['corrupt', 'invalid'].includes(st), bad.slice(0, 18) + ' → status=' + st);
    assert(e.run('saveProtected()') === true, bad.slice(0, 18) + ' 应进保护');
    for (let i = 0; i < 3; i++) e.run('save()');
    e.run('writeSave("X")'); e.run('tick()'); e.run('tick()');
    assert(e.store.get('rts_save') === bad, bad.slice(0, 18) + ' 主档被覆盖！');
    eq(keys(e), ['rts_save'], '保护期不应写附属 key（' + bad.slice(0, 18) + '）');
  }
});

test('S07', '未来版本：拒绝读写回、原文可导出、不降级保存', () => {
  const fut = JSON.stringify({ v: 99, ts: 1, res: { wood: 10 } });
  const e = makeEnv({ 'rts_save': fut });
  const r = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  assert(r.status === 'future', 'status=' + r.status);
  assert(e.run('saveProtected()') === true && /高于/.test(e.run('saveProtectReason()')), '保护原因应含版本过高');
  e.run('save();save();writeSave("x")');
  assert(e.store.get('rts_save') === fut, '未来档被降级覆盖！');
  assert(e.run('exportMasterRawText()') === fut, '原文导出应等于存档');
});

test('S08a', '存储读取异常：保护模式，S 保持默认未被污染', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.setFault('getItem', 'rts_save');
  assert(e.run('loadSaveAndApply().status') === 'storage_error', '应 storage_error');
  assert(e.run('saveProtected()') === true && e.run('S.res.wood') === 300 && e.run('S.townLv') === 1, 'S 应保持初始默认');
});

test('S08b', '迁移前副本写失败：终止格式升级，主档保持 legacy 原文，本会话只读', () => {
  const fx = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': fx });
  e.setFault('setItem', 'rts_save_premigration');
  assert(e.run('loadSaveAndApply().status') === 'migrated_readonly', '应 migrated_readonly');
  assert(e.store.get('rts_save') === fx, '主档应保持 legacy 原文');
  assert(e.run('saveProtected()') === true && e.run('S.townLv') === 4, '内存可玩但应只读');
  e.run('save()');
  assert(e.store.get('rts_save') === fx, '只读会话仍写主档！');
});

test('S08c', '迁移后主档写失败（配额）：主档保持原样并转只读', () => {
  const fx = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': fx });
  e.setFault('setItem', 'rts_save');
  assert(e.run('loadSaveAndApply().status') === 'migrated_readonly', '应 migrated_readonly');
  assert(e.store.get('rts_save') === fx, '主档应保持原样');
  assert(e.store.get('rts_save_backup_1') === fx, '有效备份应已建立');
});

test('S08d', '正常游玩中主档写失败：保留旧主档+提示未保存，不虚报成功', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();save()');
  const good = e.store.get('rts_save');
  e.setFault('setItem', 'rts_save');
  e.run('S.res.stone=999;save();save()');
  assert(e.store.get('rts_save') === good, '失败仍改主档？');
  assert(e.calls.toast.some(t => /保存失败/.test(t)), '应有一次未保存警告');
});

test('S09', '导出→游玩改动→导入确认→备份先行→重载进度一致；S 不即时替换', () => {
  const fx = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': fx });
  e.run('loadSaveAndApply()');
  const exported = e.run('exportCurrentSaveText()');
  e.run('S.townLv=7;S.merit=999;S.res.wood=1'); // 模拟导入前的游玩改动
  const r = JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(exported) + '))'));
  assert(r.ok === true, r.reason);
  assert(r.summary.townLv === 4 && r.summary.levelsDefeated === 6 && r.summary.merit === 37, '摘要=' + JSON.stringify(r.summary));
  const c = JSON.parse(e.run('JSON.stringify(commitSaveData(' + JSON.stringify(r.text) + '))'));
  assert(c.ok === true, c.reason);
  const after = JSON.parse(e.store.get('rts_save')); const exp = JSON.parse(exported);
  delete after.ts; delete exp.ts;
  eq(after, exp, '导入后主档应等于导出内容');
  const bak = JSON.parse(e.store.get('rts_save_backup_1'));
  assert(bak.v === 2 && bak.res.wood === 12345.5, '备份应为导入前有效主档');
  assert(e.run('S.townLv') === 7, '运行中 S 不应被替换（等待重载）');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save') });
  e2.run('loadSaveAndApply()');
  assert(e2.run('S.townLv') === 4 && e2.run('S.merit') === 37, '重载后应为导入进度');
});

test('S10', '无效导入/取消/无效备份恢复：主档与状态分毫不动', () => {
  const good = JSON.stringify(fullLegacy());
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();save()');
  const master0 = e.store.get('rts_save');
  let r = JSON.parse(e.run('JSON.stringify(inspectSaveText("garbage{"))'));
  assert(r.ok === false, 'garbage 应被拒绝');
  r = JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(JSON.stringify({ res: { wood: 1 } })) + '))'));
  // 合法 JSON 但 legacy 且 townLv 缺失 → 补齐默认后 ok（legacy 宽容），此处只断言未提交时主档不动
  assert(e.store.get('rts_save') === master0, '仅校验不应写主档');
  r = JSON.parse(e.run('JSON.stringify(restoreBackupByText("junk"))'));
  assert(r.ok === false && /备份校验/.test(r.reason), '无效备份文本恢复应拒绝：' + r.reason);
  assert(e.store.get('rts_save') === master0 && e.run('S.townLv') === 4, '恢复失败不应改主档/S');
  // 备份槽存在但内容无效
  const e2 = makeEnv({ 'rts_save': master0, 'rts_save_backup_1': 'junk' });
  const bs = JSON.parse(e2.run('JSON.stringify(backupSlotSummaries())'));
  assert(bs[0].exists === true && bs[0].valid === false, '无效备份槽应标 invalid');
  assert(e2.run('restoreBackupByText("junk").ok') === false, '无效槽内容恢复应拒绝');
});

test('S11', '异步回写闸口：远征/训练/驻军活跃相位拒绝导入与恢复，idle 放行', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  const txt = JSON.stringify(fullLegacy());
  e.run('S.battleActive=true');
  let r = JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))'));
  assert(r.ok === false && /战斗或训练/.test(r.reason), '远征进行中应拒绝：' + r.reason);
  assert(JSON.parse(e.run('JSON.stringify(commitSaveData("x"))')).ok === false, 'commit 同样拒绝');
  e.run('S.battleActive=false;battleTimer=5');
  assert(JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))')).ok === false, 'battleTimer 链未清应拒绝');
  e.run('battleTimer=null;S.garrison.phase="battle"');
  assert(JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))')).ok === false, '驻军交战相位应拒绝');
  e.run('S.garrison.phase="idle"');
  assert(JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))')).ok === true, 'idle 应放行');
  e.run('S.garrison.phase="cooldown"');
  assert(JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))')).ok === true, 'cooldown 应放行');
});

test('S12a', '未知引用（pool.goblin）：保护并报告，原文保留，不静默裁剪', () => {
  const bad = JSON.stringify(Object.assign({}, fullLegacy(), { pool: { infantry: 3, goblin: 5 } }));
  const e = makeEnv({ 'rts_save': bad });
  const r = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  assert(r.status === 'invalid', 'status=' + r.status);
  assert((r.errors || []).some(x => /pool/.test(x)), '错误应指向 pool：' + JSON.stringify(r.errors));
  assert(e.run('saveProtected()') === true && e.store.get('rts_save') === bad, '应保护且原文原样');
  eq(keys(e), ['rts_save'], '不应产生任何附属 key 写入');
});

test('S12b', '历史超限数据（资源/兵力超当前上限）：可加载、不裁剪、可往返', () => {
  const big = JSON.stringify(Object.assign({}, fullLegacy(), {
    res: { wood: 1e15, stone: 0, food: 0, tech: 0 },
    formation: { front: [{ type: 'infantry', count: 99999, id: 1 }], mid: [], back: [] }
  }));
  const e = makeEnv({ 'rts_save': big });
  assert(e.run('loadSaveAndApply().status') === 'migrated', '超限不应阻断加载');
  assert(e.run('S.res.wood') === 1e15 && e.run('S.formation.front[0].count') === 99999, '超限数据被裁剪！');
  e.run('save()');
  const m = JSON.parse(e.store.get('rts_save'));
  assert(m.res.wood === 1e15 && m.formation.front[0].count === 99999, '保存时不应裁剪历史超限数据');
});

// ============ IE-001-R1 审查补件用例 ============
test('S08e', '读取被拒时导出接口不得谎称已取得原文', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.setFault('getItem', 'rts_save');
  assert(e.run('exportMasterRawText()') === null, '读失败应返回 null，不得返回编造内容');
});

test('S08f', '覆盖前副本已存在时：普通保存/自动保存永不触碰 PRE；备份失败即中止且不伤主档', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()'); // 迁移 → PRE=legacy 原文
  const pre0 = e.store.get('rts_save_premigration');
  e.run('S.res.wood=4321;save()');
  assert(e.store.get('rts_save_premigration') === pre0, '普通保存改写了 PRE（策略：仅迁移/导入/恢复事件写 PRE）');
  const masterBefore = e.store.get('rts_save');
  assert(JSON.parse(masterBefore).res.wood === 4321, '前置：普通保存应已生效');
  e.setFault('setItem', 'rts_save_backup_1');
  const w = JSON.parse(e.run('JSON.stringify(writeSave(exportCurrentSaveText()))'));
  assert(w.ok === false && w.stage === 'backup', '备份失败应中止并分类');
  assert(e.store.get('rts_save') === masterBefore, '备份失败后主档被覆写');
  e.run('tick();tick();'); // 事件驱动的自动保存同样走中止路径
  assert(e.store.get('rts_save') === masterBefore, '自动保存在备份失败时仍写了主档');
  assert(e.store.get('rts_save_premigration') === pre0, '失败路径动了 PRE');
});

test('S08g', '备份轮转部分失败：如实报告残留（slot2 已写/slot1 失败/主档未动），不作全有全无承诺', () => {
  const M1 = JSON.stringify(fullLegacy());
  const B1 = JSON.stringify(fullLegacy()); // 上一代有效备份
  const e = makeEnv({ 'rts_save': M1, 'rts_save_backup_1': B1 });
  e.setFault('setItem', 'rts_save_backup_1');
  const w = JSON.parse(e.run('JSON.stringify(writeSave(exportCurrentSaveText()))'));
  assert(w.ok === false, '轮转中途失败必须上报失败');
  assert(e.store.get('rts_save') === M1, '主档必须未动');
  assert(e.store.get('rts_save_backup_2') === B1, '残留：slot2 已被写入 slot1 旧内容（部分成功如实存在）');
  assert(e.store.get('rts_save_backup_1') === B1, 'slot1 保持原值');
});

test('S09f', '导入 commit 备份写失败：中止且主档/S 未动；覆盖前副本已写入属可恢复残留', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();save()');
  const master0 = e.store.get('rts_save');
  const txt = e.run('exportCurrentSaveText()');
  e.setFault('setItem', 'rts_save_backup_1'); e.setFault('setItem', 'rts_save_backup_2');
  const c = JSON.parse(e.run('JSON.stringify(commitSaveData(' + JSON.stringify(txt) + '))'));
  assert(c.ok === false && /备份/.test(c.reason), '应报备份失败中止：' + c.reason);
  assert(e.store.get('rts_save') === master0, '主档未动');
  assert(e.store.get('rts_save_premigration') === master0, '残留=覆盖前副本（先写 PRE 后写备份的顺序产物，可恢复数据非污染）');
});

test('S11b', '远征/训练真实结束路径（flee/endBattle/exitTraining 真实函数）后闸口放行且不永久误拦', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  const txt = JSON.stringify(fullLegacy());
  // 撤退路径
  e.run('S.battleActive=true;battleTimer=99;S._preForm={front:[],mid:[],back:[]};fleeBattle();');
  assert(e.run('battleTimer') === null && e.run('S.battleActive') === false, 'fleeBattle 后句柄应清空');
  assert(e.run('saveOpsBlocked()') === '', 'flee 后应放行');
  assert(JSON.parse(e.run('JSON.stringify(inspectSaveText(' + JSON.stringify(txt) + '))')).ok === true, 'flee 后 inspect 放行');
  // 战败结算路径（真实 endBattle）
  e.run('S.selEnemy=0;B.isTraining=false;B.ourUnits=[];B.enemyUnits=[];S.battleActive=true;battleTimer=77;S._preForm={front:[],mid:[],back:[]};endBattle("lose")');
  assert(e.run('battleTimer') === null && e.run('S.battleActive') === false, 'endBattle 后句柄应清空');
  assert(e.run('saveOpsBlocked()') === '', '战败结算后应放行');
  // 退出训练路径
  e.run('B.isTraining=true;S.battleActive=true;battleTimer=66;S._preForm={front:[{type:"infantry",count:5,id:9}],mid:[],back:[]};exitTraining()');
  assert(e.run('battleTimer') === null && e.run('S.battleActive') === false && e.run('S.formation.front.length') === 1, 'exitTraining 应复位并恢复预编队');
  assert(e.run('saveOpsBlocked()') === '', '退出训练后应放行');
});

test('R01', '定向重置：只删本游戏 4 键，无关哨兵 key 保留（等同用户确认路径）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()), 'rts_save_backup_1': 'x', 'rts_save_backup_2': 'x', 'rts_save_premigration': 'x', 'other_site_key': 'sentinel' });
  const r = JSON.parse(e.run('JSON.stringify(resetAllSaves())'));
  assert(r.ok === true && r.removed.length === 4, JSON.stringify(r));
  assert(e.store.get('other_site_key') === 'sentinel', '其它站点数据必须保留（原 localStorage.clear 反例）');
  assert(e.run("['rts_save','rts_save_backup_1','rts_save_backup_2','rts_save_premigration'].every(k=>localStorage.getItem(k)===null)") === true, '4 键应全删');
});

test('R02', '重置部分删除失败：ok=false + failed 清单（UI 据此不重载不虚报）', () => {
  const e = makeEnv({ 'rts_save': 'a', 'rts_save_backup_2': 'b' });
  e.setFault('removeItem', 'rts_save_backup_2');
  const r = JSON.parse(e.run('JSON.stringify(resetAllSaves())'));
  assert(r.ok === false && r.failed.includes('rts_save_backup_2'), JSON.stringify(r));
});

// ============ IE-007 资源体系用例 ============
test('V01', 'v2 新开局：copper/iron/coin 入档+重载往返', () => {
  const e = makeEnv();
  assert(e.run('loadSaveAndApply().status') === 'fresh', '应为 fresh');
  e.run('S.res.copper=30;S.res.iron=9;S.res.coin=50;save()');
  const d = JSON.parse(e.store.get('rts_save'));
  assert(d.v === 2 && d.res.copper === 30 && d.res.iron === 9 && d.res.coin === 50, 'v2 新键未入档');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save') });
  assert(e2.run('loadSaveAndApply().status') === 'ok' && e2.run('S.res.coin') === 50 && e2.run('S.res.copper') === 30, '新键往返失败');
});

test('V02', 'legacy→v2 迁移：缺键补 0、PRE=原文、幂等', () => {
  const fx = JSON.stringify({ res: { wood: 900, stone: 1, food: 1, tech: 0 }, townLv: 2, defeated: [1, 10], merit: 3 });
  const e = makeEnv({ 'rts_save': fx });
  assert(e.run('loadSaveAndApply().status') === 'migrated', '应 migrated');
  assert(e.run('S.res.copper') === 0 && e.run('S.res.iron') === 0 && e.run('S.res.coin') === 0, '新键未补默认 0');
  assert(e.store.get('rts_save_premigration') === fx, 'PRE 应等于 legacy 原文');
  const m = JSON.parse(e.store.get('rts_save'));
  assert(m.v === 2 && m.res.copper === 0 && m.res.wood === 900, '迁移后主档错误');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save') });
  assert(e2.run('loadSaveAndApply().status') === 'ok', '二次加载应 ok');
  e2.run('save()');
  assert(JSON.parse(e2.store.get('rts_save')).res.copper === 0, '二次迁移改动数据（幂等失败）');
});

test('V03', 'v2 坏新键（res.copper 非数值）→ 保护且原文保留', () => {
  const bad = JSON.stringify(Object.assign({}, fullLegacy(), { v: 2, ts: 1, res: Object.assign({}, fullLegacy().res, { copper: 'x' }) }));
  const e = makeEnv({ 'rts_save': bad });
  const st = e.run('loadSaveAndApply().status');
  assert(['corrupt', 'invalid'].includes(st), 'status=' + st);
  assert(e.run('saveProtected()') === true, '应进保护');
  e.run('save();save();tick()');
  assert(e.store.get('rts_save') === bad, '坏新键主档被覆盖！');
});

test('V04', '被动产出：矿井/冶炼/铸币按级产出、上限钳制、缺料停产不扣负', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  e.run('S.res.copper=100;S.res.food=1000;S.res.wood=1000;S.res.stone=1000');
  e.run("S.buildings.mine={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.smelter={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mint={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  e.run('tick();tick();tick()');
  assert(e.run('S.res.copper') === 103, '铜净增错误(期望 100+3×1) actual=' + e.run('S.res.copper'));
  assert(e.run('S.res.iron') === 8, '铁产出错误（fixture 基线 5+3×1）actual=' + e.run('S.res.iron'));
  assert(e.run('S.res.coin') === 13, '金币错误（fixture 基线 7+3×2）actual=' + e.run('S.res.coin'));
  assert(e.run('S.res.food') < 1000, '食物应被铸币(5/s)+口粮+军粮消耗（含经济联动，不断言精确值）');
  // 上限钳制：铜贴近上限时矿先加到 cap 再被冶炼消耗
  e.run('S.res.copper=2996');
  e.run('tick()');
  assert(e.run('S.res.copper') === 2997 && e.run('S.res.copper') <= e.run('resCap("copper")'), '上限钳制错误');
  // 缺料停产：冶炼厂 lv2 需 6 铜 > 矿井 lv1 产 2 铜 → 停产且不扣负
  e.run("S.buildings.mine={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.smelter={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};S.res.copper=1;S.res.iron=0");
  e.run('tick()');
  assert(e.run('S.res.copper') === 3, '缺料时错误扣负（期望 1+矿2，冶炼停产）');
  assert(e.run('S.res.iron') === 0, '缺料时仍产出铁');
});

test('V05', '市场兑换：汇率取整/未知项拒绝/失败不改态/无套利环', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();S.res.coin=100;S.res.wood=0;S.res.stone=0;S.res.iron=5');
  let r = JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",5))'));
  assert(r.ok && r.get === 40 && e.run('S.res.coin') === 95 && e.run('S.res.wood') === 40, '正向兑换错误');
  r = JSON.parse(e.run('JSON.stringify(exchangeResource("wood","coin",10))'));
  assert(r.ok && r.get === 1 && e.run('S.res.coin') === 96, '反向兑换错误');
  r = JSON.parse(e.run('JSON.stringify(exchangeResource("iron","coin",5))'));
  assert(r.ok === false && e.run('S.res.iron') === 5, '未知汇率应拒绝且不改态');
  const ar = JSON.parse(e.run('JSON.stringify(CFG.market.rates)'));
  for (const a of ar) for (const b of ar) if (a.to === b.from && b.to === a.from) assert(a.rate * b.rate < 1, a.from + '↔' + a.to + ' 存在套利环:' + (a.rate * b.rate));
});

test('V06', '未知资源键仍拒绝（回归 S12 语义）', () => {
  const e = makeEnv({});
  const j = JSON.stringify(Object.assign({}, fullLegacy(), { v: 2, ts: 1, res: Object.assign({}, fullLegacy().res, { cheese: 1 }) }));
  const v = JSON.parse(e.run('JSON.stringify(validateSave(' + j + '))'));
  assert(v.ok === false && v.errors.some(x => /未知资源 cheese/.test(x)), '未知键未拒绝: ' + JSON.stringify(v.errors));
});

// —— 汇总输出 ——
for (const [st, id, name] of rows) console.log('[' + st + '] ' + id + ' — ' + name);
console.log('\nS13/S14 归属：S13 真实浏览器冒烟=browser_smoke.js（新档+legacy 迁移+游玩链路）；S14 窄屏与输入交互=browser_interact.js；实体手机/Android WebView 均未运行。');
console.log('node ' + process.version + ' | 通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
