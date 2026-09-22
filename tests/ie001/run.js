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
  assert(d.v === 3 && typeof d.ts === 'number' && d.ts > 0, 'v/ts 缺失（切片9 起目标版本为 v3）');
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
  eq(e.run('S.res'), Object.assign({}, fullLegacy().res, { deed: 0 }), '资源被改动（S8c 起新增资源应只补 deed=0，既有键不得改动）');
  assert(e.run('S.townLv') === 4 && e.run('S.merit') === 37 && e.run('S.tick') === 3456, '进度字段丢失');
  eq(e.run('S.essence'), { shield_essence: 2, wind_essence: 1 }, '精魄丢失');
  assert(e.run('S._garrisonForm.front.length') === 1 && e.run('S._garrisonForm.back.length') === 1, '驻军阵容丢失');
  assert(e.run('S.upgradedUnits.infantry_t1') === true, '研究记录丢失');
  assert(e.run('S.queue.infantry.count') === 8, '训练队列丢失');
  const m = JSON.parse(e.store.get('rts_save'));
  assert(m.v === 3 && typeof m.ts === 'number' && m.res.wood === 12345.5 && m.tick === 3456, '主档升级后内容漂移');
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
  assert(bak.v === 3 && bak.res.wood === 12345.5, '备份应为导入前有效主档');
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
  assert(d.v === 3 && d.res.copper === 30 && d.res.iron === 9 && d.res.coin === 50, 'v2 新键未入档（v3 目标）');
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
  assert(m.v === 3 && m.res.copper === 0 && m.res.wood === 900, '迁移后主档错误');
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
  assert(e.run('S.res.food') !== 1000, '食物应因铸币/口粮/军粮与产出联动而变化（不断言方向与精确值）');
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

// ============ IE-008 资源科技（对齐放置时代发展科技门）用例 ============
test('V07', '学院被动产出科技点并按上限钳制（原始上限口径：显式关闭扩容开关）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.caps.expanded=false'); // 本用例验证原始上限式（扩容路径见 Y01/Y02）
  e.run('S.res.tech=10;S.buildings.academy={lv:1,state:"idle",timer:0,timerEnd:0,tier:0}');
  e.run('tick();tick();tick()');
  assert(e.run('S.res.tech') === 25, '学院产出错误(期望 5/s/级) actual=' + e.run('S.res.tech'));
  assert(e.run('resCap("tech")') === 700, 'resCap(tech)=500+200×1 错误 actual=' + e.run('resCap("tech")'));
  e.run('S.res.tech=699');e.run('tick()');
  assert(e.run('S.res.tech') === 700, '科技点上限钳制错误 actual=' + e.run('S.res.tech'));
});

test('V08', '资源科技链：研究解锁建筑、未研究拒绝、前置门控、重复拒绝（原始 3 节点口径）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.tech.longLadder=false'); // 本用例验证原始链；长阶梯由 A02 覆盖
  e.run('S.res.tech=1000;S.merit=200;S.res.wood=99999;S.res.stone=99999;S.res.food=99999');
  e.run('buildAct("mine")');
  assert(e.run('S.buildings.mine') === undefined, '未研究冶铜术竟可建矿井');
  assert(e.calls.toast.some(t => /研究/.test(t)), '拒绝提示应含研究：' + JSON.stringify(e.calls.toast));
  let r = JSON.parse(e.run('JSON.stringify(researchScience("sci_copper"))'));
  assert(r.ok === true && e.run('S.res.tech') === 990 && e.run('S.merit') === 200, '研究冶铜术失败（10科技/0战功）');
  r = JSON.parse(e.run('JSON.stringify(researchScience("sci_copper"))'));
  // 切片10 起：窗口内重复研究走幂等路径（repeat=true）——不重复扣费这一保证不变
  assert(r.ok === true && r.repeat === true, '重复研究应返回幂等结果（repeat）actual=' + JSON.stringify(r));
  assert(e.run('S.res.tech') === 990 && e.run('S.merit') === 200, '重复研究不应再扣费');
  e.run('S.res.tech=300;S.merit=100');
  r = JSON.parse(e.run('JSON.stringify(researchScience("sci_coin"))'));
  assert(r.ok === false, '货币铸造在铁未研时应被前置拒绝');
  e.run('S.res.tech=300;S.merit=100');
  r = JSON.parse(e.run('JSON.stringify(researchScience("sci_iron"))'));
  // 切片3 起 sciencesNoMerit=true：资源科技不扣战功（仅扣科技点）；开关关闭时恢复扣战功（见 X02）
  assert(r.ok === true && e.run('S.res.tech') === 220 && e.run('S.merit') === 100, '研究冶铁术失败（80科技/战功豁免）');
  e.run('S.res.tech=250;S.merit=100');
  r = JSON.parse(e.run('JSON.stringify(researchScience("sci_coin"))'));
  assert(r.ok === true && e.run('S.merit') === 100, '货币铸造研究失败（200科技/战功豁免）');
  e.run('buildAct("smelter");buildAct("market")');
  assert(e.run('S.buildings.smelter') && e.run('S.buildings.smelter.state') === 'building', '已研究后应可建冶炼厂');
  assert(e.run('S.buildings.market') && e.run('S.buildings.market.state') === 'building', '已研究后应可建市场');
});

test('V09', 'sciences 存档：v2 往返、legacy 补空、未知科技保护', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();S.sciences.push("sci_copper");save()');
  const d = JSON.parse(e.store.get('rts_save'));
  assert(Array.isArray(d.sciences) && d.sciences.includes('sci_copper'), 'sciences 未入档');
  const e2 = makeEnv({ 'rts_save': e.store.get('rts_save') });
  assert(e2.run('loadSaveAndApply().status') === 'ok' && e2.run('S.sciences.length') === 1, 'sciences 往返失败');
  const e3 = makeEnv({ 'rts_save': JSON.stringify({ res: { wood: 1, stone: 1, food: 1, tech: 0 } }) });
  const st = e3.run('loadSaveAndApply().status');
  assert(['migrated','ok'].includes(st) && Array.isArray(e3.run('S.sciences')) && e3.run('S.sciences.length') === 0, 'legacy sciences 补空失败 status=' + st);
  const bad = JSON.stringify(Object.assign({}, fullLegacy(), { v: 2, ts: 1, sciences: ['sci_nix'] }));
  const e4 = makeEnv({ 'rts_save': bad });
  assert(['corrupt','invalid'].includes(e4.run('loadSaveAndApply().status')) && e4.run('saveProtected()') === true, '未知科技应进保护');
});

// ============ 切片2 基建用例（开关骨架 + 诊断环形日志）============
test('W01', '开关骨架存在且默认关闭（零行为变化）', () => {
  const e = makeEnv();
  const sw = JSON.parse(e.run('JSON.stringify({offline:CFG.offline,idem:CFG.idem,caps:CFG.caps,upkeep:CFG.upkeep,tech:CFG.tech,passive:CFG.passive,marketMR:CFG.market.multiRate,marketDL:CFG.market.dailyLimit,diag:CFG.diag})'));
  assert(sw.offline.enabled === true && sw.offline.ratio === 0.6 && sw.offline.capSec === 86400 && sw.offline.minSec === 120, '切片11 已启用 offline（见 slice-11 报告）actual=' + JSON.stringify(sw.offline));
  assert(sw.idem.enabled === true && sw.idem.windowMs === 5000 && sw.idem.max === 200, '切片10 已启用幂等层（见 slice-10 报告）actual=' + JSON.stringify(sw.idem));
  assert(sw.caps.expanded === true && sw.upkeep.freeBand === true, '切片4 启用 caps.expanded、切片6 启用 upkeep.freeBand（见 slice-4/6 报告）');
  assert(sw.tech.occupyPop === false && sw.passive.needPop === false, 'tech.occupyPop/passive 应默认关闭');
  assert(sw.tech.sciencesNoMerit === true, '切片3 已启用 sciencesNoMerit（解死锁，见 slice-3 报告）；其余开关默认关闭');
  assert(sw.marketMR === true && sw.marketDL === 5, '切片13 已启用多汇率（见 slice-13 报告）actual=' + sw.marketMR);
  assert(sw.diag.enabled === true && sw.diag.max === 50, 'diag 配置不符');
});

test('W02', '诊断环形日志：上限 50、FIFO、结构正确、可清空', () => {
  const e = makeEnv();
  for (let i = 0; i < 60; i++) e.run(`logDiag('t${i}','m${i}')`);
  const snap = JSON.parse(e.run('JSON.stringify(diagSnapshot())'));
  assert(snap.length === 50, '环形日志应保留最近 50 条，实际=' + snap.length);
  assert(snap[0].tag === 't10' && snap[49].tag === 't59', '应为最近 50 条（FIFO）：' + snap[0].tag + '→' + snap[49].tag);
  assert(typeof snap[0].t === 'number' && typeof snap[0].msg === 'string', '条目结构不符');
  e.run('diagClear()');
  assert(JSON.parse(e.run('JSON.stringify(diagSnapshot())')).length === 0, 'diagClear 未清空');
});

test('W03', '诊断日志不入档：存档文本无 diag 且字段集不变', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();logDiag("x","y");save()');
  const raw = e.store.get('rts_save');
  assert(raw.indexOf('diag') === -1, '存档文本出现 diag（不应入档）');
  const keys = Object.keys(JSON.parse(raw)).sort().join(',');
  assert(keys === 'buildings,daily,defeated,essence,formation,garrison,garrisonForm,garrisonLog,merit,offline,ops,pool,popAlloc,queue,res,sciences,tick,townLv,townUpgrade,ts,upgradedUnits,v', '存档字段集被改变: ' + keys);
});

test('W04', 'logDiag 容错：异常入参不抛错、接口齐备', () => {
  const e = makeEnv();
  const n = e.run('(()=>{try{logDiag(null,undefined);logDiag({},[]);logDiag();return logDiag("ok","done")}catch(err){return -1}})()');
  assert(n > 0, 'logDiag 不应抛错');
  assert(e.run('typeof diagSnapshot') === 'function' && e.run('typeof diagClear') === 'function' && e.run('typeof logDiag') === 'function', '诊断接口缺失');
});

// ============ 切片3 用例（S1 解死锁：资源科技去战功 + 可达性）============
test('X01', '切片3：战功=0 可研完资源科技链（原始 3 节点口径；长阶梯见 A02）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.tech.longLadder=false;S.res.tech=1000;S.merit=0');
  const r = ['sci_copper', 'sci_iron', 'sci_coin'].map(id => JSON.parse(e.run(`JSON.stringify(researchScience("${id}"))`)));
  assert(r.every(x => x.ok), '战功=0 应可研完全链：' + JSON.stringify(r));
  assert(e.run('S.merit') === 0, '战功不应被扣除（豁免）actual=' + e.run('S.merit'));
  assert(e.run('S.res.tech') === 1000 - 10 - 80 - 200, '科技点扣除错误 actual=' + e.run('S.res.tech'));
  assert(e.run('S.sciences.length') === 3, 'sciences 应含 3 项 actual=' + e.run('S.sciences.length'));
});

test('X02', '切片3：开关关闭时恢复旧行为（战功不足拦截 + 照常扣战功；原始 3 节点口径）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.tech.longLadder=false;S.res.tech=1000;S.merit=0;CFG.tech.sciencesNoMerit=false');
  const r1 = JSON.parse(e.run('JSON.stringify(researchScience("sci_copper"))'));
  const r2 = JSON.parse(e.run('JSON.stringify(researchScience("sci_iron"))'));
  assert(r1.ok === true, 'sci_copper 本就 0 战功，应通过');
  assert(r2.ok === false, '关开关时 sci_iron 应因战功不足被拒（旧行为）');
  assert(e.calls.toast.some(t => /战功不足/.test(t)), '应出现"战功不足"提示');
  // 旧行为下战功确实被扣（对照）
  const e2 = makeEnv();
  e2.run('loadSaveAndApply();CFG.tech.longLadder=false;S.res.tech=1000;S.merit=100;CFG.tech.sciencesNoMerit=false;researchScience("sci_copper")');
  e2.run('researchScience("sci_iron")');
  assert(e2.run('S.merit') === 90, '开关关闭时应扣 10 战功 actual=' + e2.run('S.merit'));
});

test('X03', '切片3/5：可达性——前置图完整无环，且每个解锁建筑研究后可建（墙后有门）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.tech=99999;S.res.wood=99999;S.res.stone=99999;S.res.food=99999');
  const sci = JSON.parse(e.run('JSON.stringify(activeSciences())'));
  for (const [id, sc] of Object.entries(sci)) {
    if (sc.need) for (const p of sc.need) { assert(sci[p], `${id} 的前置 ${p} 不存在`); assert(p !== id, `${id} 前置自环`); }
  }
  for (const id of Object.keys(sci)) {   // 表序即拓扑序（prospect→copper→metal→iron→mint→coin）
    const r = JSON.parse(e.run(`JSON.stringify(researchScience("${id}"))`));
    assert(r.ok, `研究 ${id} 失败`);
    for (const b of (sci[id].unlocks || [])) {
      e.run(`buildAct('${b}')`);
      assert(e.run(`!!S.buildings['${b}']`) === true, `${id} 解锁的 ${b} 不可建（墙后无门）`);
    }
  }
});

// ============ 切片4 用例（S3 上限空间扩容）============
test('Y01', '切片4：开关关闭时上限与改造前逐值一致（零行为；须同时关 ownMax 以隔离切片8b）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.caps.expanded=false;CFG.ownMax.enabled=false');
  e.run("S.buildings.warehouse={lv:5,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.academy={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mine={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(e.run('storageCapacity()') === 10000 + 5 * 10000, '仓库容量应为原式 actual=' + e.run('storageCapacity()'));
  assert(e.run('resCap("tech")') === 500 + 200 * 10, '科技上限应为原式 actual=' + e.run('resCap("tech")'));
  assert(e.run('resCap("copper")') === 2000 + 500 * 1, '铜上限应为原式 actual=' + e.run('resCap("copper")'));
  assert(/需升级城镇/.test(e.run("upgradeLockReason('warehouse')")), '仓库应受原上限(城镇×5)约束');
  assert(/需升级城镇/.test(e.run("upgradeLockReason('academy')")), '学院应受原 barracks 上限(城镇×1)约束');
});

test('Y02', '切片4：开关开启后上限空间扩容（仓库/科技/被动/建筑等级；须关 ownMax 以隔离切片8b）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.ownMax.enabled=false');
  e.run("S.buildings.warehouse={lv:20,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.academy={lv:20,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mine={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.smelter={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.market={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(e.run('storageCapacity()') === 10000 + 20 * 50000, '扩容后仓库容量 actual=' + e.run('storageCapacity()'));
  assert(e.run('resCap("tech")') === 3000 + 2000 * 20, '扩容后科技上限 actual=' + e.run('resCap("tech")'));
  assert(e.run('resCap("copper")') === 8000 + 2000 * 10, '扩容后铜上限 actual=' + e.run('resCap("copper")'));
  assert(e.run('resCap("iron")') === 6000 + 1600 * 10, '扩容后铁上限 actual=' + e.run('resCap("iron")'));
  assert(e.run('resCap("coin")') === 20000 + 4000 * 0, '扩容后金币上限(铸币厂未建) actual=' + e.run('resCap("coin")'));
  // 等级上限：边界语义为 `lv >= 城镇×cap` 即锁（故 cap-1 可达、cap 锁定）
  e.run("S.buildings.warehouse={lv:19,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.academy={lv:19,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mine={lv:9,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.market={lv:9,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.lumber_mill={lv:9,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(e.run("upgradeLockReason('warehouse')") === '', '仓库 lv19 应可达');
  assert(e.run("upgradeLockReason('academy')") === '', '学院 lv19 应可达（扩容分支需短路，否则回落 barracks 被误锁）');
  assert(e.run("upgradeLockReason('mine')") === '', '矿井 lv9 应可达');
  assert(e.run("upgradeLockReason('market')") === '', '市场 lv9 应可达（utility 扩容）');
  assert(e.run("upgradeLockReason('lumber_mill')") === '', '伐木场 lv9 应可达（采集 buff 建筑扩容）');
  e.run("S.buildings.warehouse={lv:20,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mine={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.lumber_mill={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(/需升级城镇/.test(e.run("upgradeLockReason('warehouse')")), '仓库 lv20 应到扩容上限');
  assert(/需升级城镇/.test(e.run("upgradeLockReason('mine')")), '矿井 lv10 应到扩容上限');
  assert(/需升级城镇/.test(e.run("upgradeLockReason('lumber_mill')")), '伐木场 lv10 应到扩容上限');
});

test('Y03', '切片4：开→关可逆、无残留（回滚安全）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.buildings.warehouse={lv:6,state:"idle",timer:0,timerEnd:0,tier:0}');
  const on1 = e.run('storageCapacity()');
  e.run('CFG.caps.expanded=false'); const off1 = e.run('storageCapacity()');
  e.run('CFG.caps.expanded=true'); const on2 = e.run('storageCapacity()');
  e.run('CFG.caps.expanded=false'); const off2 = e.run('storageCapacity()');
  assert(off1 === off2, '关→开→关 应回到同值：' + off1 + ' vs ' + off2);
  assert(on1 === on2 && on1 > off1, '开启值应更大且稳定：on=' + on1 + ' off=' + off1);
});

// ============ 切片4b 用例（R5-①② 食物经济对齐，用户裁决）============
test('Z01', '切片4b：对齐启用时食物产出 2.25/村民/秒、铸币耗粮 1/s/级', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  e.run("S.popAlloc={wood:0,stone:0,food:10};S.buildings.farm={lv:0,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(Math.abs(e.run("prodRate('food')") - 10 * 2.25) < 1e-9, '食物产出应为 10×2.25，actual=' + e.run("prodRate('food')"));
  e.run("S.buildings.mint={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};S.res.food=1000");
  assert(e.run("effConsume('mint','food')") === 1, '铸币耗粮应为 1，actual=' + e.run("effConsume('mint','food')"));
  // 隔离验证"对齐后的耗粮"：同状态下 mint lv0 与 lv2 的单 tick 食物差应 = 1×2
  const foodWithMint = (() => { e.run('tick()'); return e.run('S.res.food') })();
  e.run("S.buildings.mint={lv:0,state:'idle',timer:0,timerEnd:0,tier:0};S.res.food=1000");
  e.run('tick()');
  const foodNoMint = e.run('S.res.food');
  assert(Math.abs((foodNoMint - foodWithMint) - 2) < 1e-6, '铸币 lv2 应比 lv0 多耗 2/s，实际差=' + (foodNoMint - foodWithMint));
});

test('Z02', '切片4b：开关关闭时回到原始数值（0.75 / 5）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.food.aligned=false');
  e.run("S.popAlloc={wood:0,stone:0,food:10};S.buildings.farm={lv:0,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(Math.abs(e.run("prodRate('food')") - 10 * 0.75) < 1e-9, '原始食物产出应为 10×0.75，actual=' + e.run("prodRate('food')"));
  assert(e.run("effConsume('mint','food')") === 5, '原始铸币耗粮应为 5，actual=' + e.run("effConsume('mint','food')"));
});

test('Z03', '切片4b：开→关→开可逆无残留，且原始配置未被改写', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  e.run("S.popAlloc={wood:0,stone:0,food:10};S.buildings.farm={lv:0,state:'idle',timer:0,timerEnd:0,tier:0}");
  const on1 = e.run("prodRate('food')"), cons1 = e.run("effConsume('mint','food')");
  e.run('CFG.food.aligned=false');
  const off1 = e.run("prodRate('food')"), consOff = e.run("effConsume('mint','food')");
  e.run('CFG.food.aligned=true');
  const on2 = e.run("prodRate('food')"), cons2 = e.run("effConsume('mint','food')");
  assert(on1 === on2 && cons1 === cons2 && off1 !== on1, '可逆性失败: on1=' + on1 + ' on2=' + on2 + ' off=' + off1);
  assert(e.run('CFG.res.food.basePerPop') === 0.75 && e.run("CFG.buildings.mint.consumes.food") === 5, '原始配置被改写（不应发生）');
});

// ============ 切片5 用例（S2 成本阶梯扩节点）============
test('A01', '切片5：开关关闭时用原始 3 节点表（10/80/200，链式前置）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.tech.longLadder=false;S.res.tech=1000;S.res.wood=9999;S.res.stone=9999;S.res.food=9999');
  const ids = JSON.parse(e.run('JSON.stringify(Object.keys(activeSciences()))'));
  assert(ids.length === 3, '原始表应为 3 节点 actual=' + ids.length);
  assert(e.run("activeSciences()['sci_copper'].cost.tech") === 10 && e.run("activeSciences()['sci_iron'].cost.tech") === 80 && e.run("activeSciences()['sci_coin'].cost.tech") === 200, '原始成本不符');
  assert(JSON.parse(e.run('JSON.stringify(researchScience("sci_iron"))')).ok === false, '原始表下未研究前置应被拒');
});

test('A02', '切片5：开关开启时用 6 节点长阶梯，且链式前置被强制', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.tech=99999;S.res.wood=9999;S.res.stone=9999;S.res.food=9999');
  const ids = JSON.parse(e.run('JSON.stringify(Object.keys(activeSciences()))'));
  assert(ids.length === 6, '长阶梯应为 6 节点 actual=' + ids.length + ':' + ids.join(','));
  const costs = ids.map(id => e.run(`activeSciences()['${id}'].cost.tech`));
  assert(JSON.stringify(costs) === JSON.stringify([100, 300, 800, 1800, 5000, 12000]), '阶梯成本不符 actual=' + JSON.stringify(costs));
  assert(JSON.parse(e.run('JSON.stringify(researchScience("sci_copper"))')).ok === false, '未研究探矿术时应拒绝冶铜术');
  for (const id of ids) assert(JSON.parse(e.run(`JSON.stringify(researchScience("${id}"))`)).ok, `按序研究 ${id} 应成功`);
  assert(e.run('S.sciences.length') === 6, '应研完 6 项 actual=' + e.run('S.sciences.length'));
  // 解锁未被削弱
  assert(e.run("S.sciences.includes('sci_copper')") && e.run("S.sciences.includes('sci_iron')") && e.run("S.sciences.includes('sci_coin')"), '解锁节点 id 应保持稳定（兼容旧档）');
});

test('A03', '切片5：开→关可逆；旧档 sciences id 在两种表下都可校验', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { v: 2, ts: 1, sciences: ['sci_copper', 'sci_iron', 'sci_coin'] })) });
  assert(['ok', 'migrated'].includes(e.run('loadSaveAndApply().status')), '旧档（3 节点 id）在长阶梯 + v3 目标下应仍可校验通过');
  e.run('CFG.tech.longLadder=false');
  assert(e.run('sciIdKnown("sci_copper")') === true, '关闭后旧 id 仍应已知');
  e.run('CFG.tech.longLadder=true');
  assert(e.run('sciIdKnown("sci_metal")') === true && e.run('sciIdKnown("sci_prospect")') === true, '长阶梯 id 应已知');
  assert(e.run('sciName("sci_metal")') === '冶金术' && e.run('sciName("sci_copper")') === '冶铜术', '节点名不符');
});

// ============ 切片6 用例（S4 免维护带 + 分段斜率）============
test('B01', '切片6：开关关闭时军粮=逐兵 upkeep 之和（原样）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.upkeep.freeBand=false;S.pool={infantry:10};S.formation={front:[],mid:[],back:[]};S._garrisonForm={front:[],mid:[],back:[]}');
  const u = e.run("CFG.units.infantry.upkeep");
  assert(Math.abs(e.run('totalUpkeep()') - 10 * u) < 1e-9, '关闭时应为 10×' + u + '，actual=' + e.run('totalUpkeep()'));
  assert(Math.abs(e.run('upkeepBandFactor(10)') - 1) < 1e-9, '关闭时倍率应为 1');
});

test('B02', '切片6：开启后免维护带内为 0、超出按 1/2/4/8 边际分段', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();S.formation={front:[],mid:[],back:[]};S._garrisonForm={front:[],mid:[],back:[]}');
  e.run("S.buildings.barracks={lv:5,state:'idle',timer:0,timerEnd:0,tier:0}");   // free = 10 + 2×5 = 20
  assert(e.run('freeBandSize()') === 20, 'freeBandSize 应为 20，actual=' + e.run('freeBandSize()'));
  const u = e.run('CFG.units.infantry.upkeep');
  const setN = n => e.run(`S.pool={infantry:${n}}`);
  setN(20); assert(e.run('totalUpkeep()') === 0, '带内 20 兵应为 0 军粮 actual=' + e.run('totalUpkeep()'));
  setN(25); assert(Math.abs(e.run('totalUpkeep()') - 5 * 1 * u) < 1e-9, '带外 5 兵应为 5×1×u actual=' + e.run('totalUpkeep()'));
  setN(40); assert(Math.abs(e.run('totalUpkeep()') - (20 * 1 + 0) * u) < 1e-9, 'n=40（带外 20）应为 20×1×u actual=' + e.run('totalUpkeep()'));
  setN(50); assert(Math.abs(e.run('totalUpkeep()') - (20 * 1 + 10 * 2) * u) < 1e-9, 'n=50（带外 30）应为 (20×1+10×2)×u actual=' + e.run('totalUpkeep()'));
  setN(120); assert(Math.abs(e.run('totalUpkeep()') - (20 * 1 + 80 * 2 + 0 * 4) * u) < 1e-9, 'n=120（带外 100）应为 (20×1+80×2)×u actual=' + e.run('totalUpkeep()'));
  setN(330); assert(Math.abs(e.run('totalUpkeep()') - (20 * 1 + 80 * 2 + 200 * 4 + 10 * 8) * u) < 1e-9, 'n=330（带外 310）边际分段 actual=' + e.run('totalUpkeep()'));
});

test('B03', '切片6：语义=小编制免费、超编分段递增罚息；开→关可逆；原始逐兵 upkeep 未改写', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();S.formation={front:[],mid:[],back:[]};S._garrisonForm={front:[],mid:[],back:[]}');
  const free = e.run('freeBandSize()');
  const u = e.run('CFG.units.infantry.upkeep');
  e.run(`S.pool={infantry:${Math.max(1, free - 1)}}`);
  const inBand = e.run('totalUpkeep()');
  e.run('CFG.upkeep.freeBand=false'); const inBandRaw = e.run('totalUpkeep()');
  assert(inBand === 0 && inBandRaw > 0, `带内应免费：on=${inBand} off=${inBandRaw}（free=${free}）`);
  e.run('CFG.upkeep.freeBand=true;S.pool={infantry:60}');
  const on1 = e.run('totalUpkeep()');
  e.run('CFG.upkeep.freeBand=false'); const off = e.run('totalUpkeep()');
  e.run('CFG.upkeep.freeBand=true'); const on2 = e.run('totalUpkeep()');
  assert(on1 === on2, '可逆性失败: on1=' + on1 + ' on2=' + on2);
  assert(on1 > off, '超编后应进入递增罚息（总军粮应高于原始逐兵和）: on=' + on1 + ' off=' + off);
  assert(Math.abs(off - 60 * u) < 1e-9, '关闭时=原始逐兵和 actual=' + off);
  assert(e.run('CFG.units.infantry.upkeep') === 0.03, '逐兵 upkeep 原始值被改写（不应发生）');
  assert(e.run('CFG.units.mage_chrono.upkeep') === 0.32, '万古之瞳 upkeep 原始值应为 0.32');
});

// ============ 切片7 用例（S5 人口结构对齐：派生式增长）============
test('C01', '切片7：人口由 S.tick 派生（基础 4；2+5×城镇 /10s；不超城镇上限）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.townLv=1;S.tick=0');
  assert(e.run('popGrowthPer10s()') === 7, '城镇1 增长应为 2+5=7，actual=' + e.run('popGrowthPer10s()'));
  assert(e.run('popCurrent()') === 4, 'tick0 人口应为基础 4，actual=' + e.run('popCurrent()'));
  e.run('S.tick=9'); assert(e.run('popCurrent()') === 4, 'tick9 应仍为 4');
  e.run('S.tick=10'); assert(e.run('popCurrent()') === 10, 'tick10 应为 min(上限10, 4+7)=10，actual=' + e.run('popCurrent()'));
  e.run('S.tick=1000'); assert(e.run('popCurrent()') === 10, '应被城镇上限 10 封顶，actual=' + e.run('popCurrent()'));
});

test('C02', '切片7：城镇4（上限40）时增长与封顶；新增分配不得超当前人口', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.townLv=4;S.tick=10');
  assert(e.run('popGrowthPer10s()') === 22, '城镇4 增长应为 2+20=22，actual=' + e.run('popGrowthPer10s()'));
  assert(e.run('popCurrent()') === 26, 'tick10 应为 4+22=26，actual=' + e.run('popCurrent()'));
  e.run('S.tick=20'); assert(e.run('popCurrent()') === 40, 'tick20 应被上限 40 封顶（4+44→40），actual=' + e.run('popCurrent()'));
  // 超当前人口的新增分配应被拒（tick10：当前 26）
  e.run('S.tick=10;S.popAlloc={wood:20,stone:4,food:2}');
  assert(e.run('popAllocTotal()') === 26 && e.run('popFree()') === 0, '分配总数应为 26、空闲 0');
  e.run("setPopAlloc('wood',21)");
  assert(e.run("S.popAlloc.wood") === 20, '超当前人口的新增分配应被拒 actual=' + e.run('S.popAlloc.wood'));
});

test('C03', '切片7：关闭开关＝原样；既有超额分配不被回收（不静默裁剪）；可逆', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });   // legacy 分配 5/4/6=15
  e.run('loadSaveAndApply();CFG.pop.growth=false');
  assert(e.run('popCurrent()') === e.run('maxPop()'), '关闭时人口应等于城镇上限');
  assert(e.run('popAllocTotal()') === 15, '关闭时既有分配应原样 (15)，actual=' + e.run('popAllocTotal()'));
  e.run('CFG.pop.growth=true');
  assert(e.run('popAllocTotal()') === 15, '开启后既有分配不得被回收（不静默裁剪），actual=' + e.run('popAllocTotal()'));
  assert(e.run('popFree()') >= 0, '空闲不得为负，actual=' + e.run('popFree()'));
  // 可逆性：用 tick=0（人口=基础 4）与关闭态（人口=城镇上限）对比，避免被上限封顶掩盖
  e.run('S.tick=0');
  const on1 = e.run('popCurrent()');
  e.run('CFG.pop.growth=false'); const off = e.run('popCurrent()');
  e.run('CFG.pop.growth=true'); const on2 = e.run('popCurrent()');
  assert(on1 === on2 && off !== on1, '可逆性失败: on1=' + on1 + ' off=' + off + ' on2=' + on2);
  assert(on1 === 4 && off === e.run('maxPop()'), 'tick0 应为 4、关闭态应为城镇上限 actual=' + on1 + '/' + off);
});

// ============ 切片8a 用例（O8 上调单位上限）============
test('D01', '切片8a：开关关闭时单位上限=原始式（步兵营 lv5 → 10+5×5=35）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.unitCapBoost.enabled=false;S.buildings.infantry_camp={lv:5,state:"idle",timer:0,timerEnd:0,tier:0}');
  assert(e.run("unitCap('infantry')") === 35, '原始上限应为 35，actual=' + e.run("unitCap('infantry')"));
  e.run('S.buildings.archer_range={lv:5,state:"idle",timer:0,timerEnd:0,tier:0}');
  assert(e.run("unitCap('archer')") === 25, '弓兵原始上限应为 10+5×3=25，actual=' + e.run("unitCap('archer')"));
});

test('D02', '切片8a：开关开启后上限上调（步兵 30+5×10=80、弓兵 30+5×6=60、骑兵 15+5×4=35、法师 5+5×2=15）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  e.run("S.buildings.infantry_camp={lv:5,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.archer_range={lv:5,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.stable={lv:5,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.mage_tower={lv:5,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(e.run("unitCap('infantry')") === 80, '步兵 actual=' + e.run("unitCap('infantry')"));
  assert(e.run("unitCap('archer')") === 60, '弓兵 actual=' + e.run("unitCap('archer')"));
  assert(e.run("unitCap('cavalry')") === 35, '骑兵 actual=' + e.run("unitCap('cavalry')"));
  assert(e.run("unitCap('mage')") === 15, '法师 actual=' + e.run("unitCap('mage')"));
});

test('D03', '切片8a：tier 门槛仍生效；开→关可逆；原始 CFG.unitCaps 未改写', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  e.run("S.buildings.infantry_camp={lv:5,state:'idle',timer:0,timerEnd:0,tier:0}");   // 建筑 tier=0
  assert(e.run("unitCap('infantry_t1')") === 0, '兵种 tier>T1 高于建筑 tier 时应为 0（门槛不可绕过）');
  const on1 = e.run("unitCap('infantry')");
  e.run('CFG.unitCapBoost.enabled=false'); const off = e.run("unitCap('infantry')");
  e.run('CFG.unitCapBoost.enabled=true'); const on2 = e.run("unitCap('infantry')");
  assert(on1 === on2 && on2 > off, '可逆性/上调失败: on1=' + on1 + ' off=' + off + ' on2=' + on2);
  assert(e.run('CFG.unitCaps.infantry.base') === 10 && e.run('CFG.unitCaps.infantry.perLv') === 5, '原始 unitCaps 被改写（不应发生）');
});

// ============ 切片8b 用例（R2=A：上限改自身 LvMax）============
test('E01', '切片8b：开关关闭时仍为"城镇×k"（仓库 lv20 锁定、lv19 可达）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.ownMax.enabled=false');
  e.run("S.buildings.warehouse={lv:19,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(e.run("upgradeLockReason('warehouse')") === '', '关闭时应 lv19 可达');
  e.run("S.buildings.warehouse={lv:20,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert(/需升级城镇/.test(e.run("upgradeLockReason('warehouse')")), '关闭时应受城镇×20 约束');
});

test('E02', '切片8b：开启后按自身 LvMax（仓库1000/训练50/学院50/生产50/采集50/功能50/营帐10）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  const chk = (k, lvOk, lvCap, capVal) => {
    e.run(`S.buildings['${k}']={lv:${lvOk},state:'idle',timer:0,timerEnd:0,tier:0}`);
    assert(e.run(`upgradeLockReason('${k}')`) === '', `${k} lv${lvOk} 应可达`);
    e.run(`S.buildings['${k}']={lv:${lvCap},state:'idle',timer:0,timerEnd:0,tier:0}`);
    const r = e.run(`upgradeLockReason('${k}')`);
    assert(r === `已达等级上限 Lv.${capVal}`, `${k} lv${lvCap} 应报上限，actual=${r}`);
  };
  chk('warehouse', 999, 1000, 1000);
  chk('infantry_camp', 49, 50, 50);
  chk('academy', 49, 50, 50);
  chk('mine', 49, 50, 50);
  chk('lumber_mill', 49, 50, 50);
  chk('market', 49, 50, 50);
  chk('barracks', 9, 10, 10);
});

test('E03', '切片8b：资源/科技/击杀门仍然生效；开→关可逆', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.wood=99999;S.res.stone=99999;S.res.food=99999');
  e.run("S.buildings.smelter={lv:0,state:'idle',timer:0,timerEnd:0,tier:0}");
  e.run("buildAct('smelter')");                                   // 需 sci_iron 未研究
  assert(e.run("bldSt('smelter').state") === 'idle' && e.run("!!S.buildings.smelter") === true, '科技门应仍在（不得绕过）');
  assert(!/需升级城镇/.test(e.run("upgradeLockReason('warehouse')")), 'ownMax 模式不应再出现城镇锁（warehouse 当前 lv0）');
  const on1 = e.run("(S.buildings.warehouse={lv:99,state:'idle',timer:0,timerEnd:0,tier:0},upgradeLockReason('warehouse'))");
  e.run('CFG.ownMax.enabled=false'); const off = e.run("upgradeLockReason('warehouse')");
  e.run('CFG.ownMax.enabled=true'); const on2 = e.run("(S.buildings.warehouse={lv:99,state:'idle',timer:0,timerEnd:0,tier:0},upgradeLockReason('warehouse'))");
  assert(on1 === '' && on2 === '' && /需升级城镇/.test(off), '可逆性失败: on1=' + on1 + ' off=' + off + ' on2=' + on2);
});

// ============ 切片9 用例（存档 v3 骨架：ops / offline / daily）============
test('F01', '切片9：v2→v3 迁移补齐三字段、版本升为 3、其余字段不动', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  const r = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  assert(['ok', 'migrated'].includes(r.status), 'v2 档应可加载 actual=' + r.status);
  assert(e.run('S.ops.length') === 0 && e.run('S.offline.pendingReport') === null && e.run('S.daily.day') === null, 'v3 字段默认值不符');
  const d = JSON.parse(e.run('JSON.stringify(serializeSave())'));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  assert(d.v === 3 && Array.isArray(d.ops) && isObj(d.offline) && isObj(d.daily), 'v3 序列化字段不符: v=' + d.v);
  assert(d.res.wood === fullLegacy().res.wood, '进度字段被改动（不应发生）');
});

test('F02', '切片9：迁移幂等（二次迁移不再补齐）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply()');
  const r2 = JSON.parse(e.run('JSON.stringify(migrateSave(JSON.parse(JSON.stringify(serializeSave()))))'));
  assert(r2.migrated === false && r2.filled.length === 0, '二次迁移应无补齐，actual=' + JSON.stringify(r2));
});

test('F03', '切片9：坏 v3 字段 → 保护模式（ops 非数组 / daily.counts 负数 / 缺字段）', () => {
  const base = { v: 3, ts: 1, res: { wood: 1, stone: 1, food: 1, tech: 0, copper: 0, iron: 0, coin: 0 }, buildings: {}, pool: {}, queue: {}, formation: { front: [], mid: [], back: [] }, townLv: 1, popAlloc: { wood: 1, stone: 0, food: 0 }, defeated: [], merit: 0, garrisonLog: [], garrison: null, tick: 0, garrisonForm: { front: [], mid: [], back: [] }, townUpgrade: null, upgradedUnits: {}, essence: {}, sciences: [] };
  const bad1 = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, base, { ops: 'x', offline: { pendingReport: null }, daily: { day: null, counts: {} } })) });
  assert(['corrupt', 'invalid'].includes(bad1.run('loadSaveAndApply().status')), 'ops 非数组应保护');
  const bad2 = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, base, { ops: [], offline: { pendingReport: null }, daily: { day: null, counts: { market: -1 } } })) });
  assert(['corrupt', 'invalid'].includes(bad2.run('loadSaveAndApply().status')), 'daily.counts 负数应保护');
  const bad3 = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, base, { ops: [], offline: { pendingReport: null } })) });
  assert(['corrupt', 'invalid'].includes(bad3.run('loadSaveAndApply().status')), '缺 daily 应保护（v3 必需字段）');
});

test('F04', '切片9：v3 往返（ops/offline/daily 内容保留）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.ops=[{key:"research:sci_iron",t:12345}];S.offline={pendingReport:{duration:3600,gains:{wood:100}}};S.daily={day:"2026-09-22",counts:{market:3}};save()');
  const text = e.store.get('rts_save');
  const e2 = makeEnv({ 'rts_save': text });
  const r = JSON.parse(e2.run('JSON.stringify(loadSaveAndApply())'));
  assert(['ok', 'migrated'].includes(r.status), 'v3 档应可加载 actual=' + r.status);
  assert(e2.run('S.ops[0].key') === 'research:sci_iron' && e2.run('S.ops[0].t') === 12345, 'ops 未保留');
  assert(e2.run('S.offline.pendingReport.duration') === 3600, 'offline.pendingReport 未保留');
  assert(e2.run('S.daily.day') === '2026-09-22' && e2.run('S.daily.counts.market') === 3, 'daily 未保留');
});

test('F05', '切片9：关闭开关＝v2 原样（无新字段、老档不受影响）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.save.v3=false;save()');
  const d = JSON.parse(e.store.get('rts_save'));
  assert(d.v === 2, '关闭时版本应为 2 actual=' + d.v);
  assert(!('ops' in d) && !('offline' in d) && !('daily' in d), '关闭时不应写入 v3 字段');
});

test('F06', '切片9：未来版本拒绝（v=4）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { v: 4, ts: 1 })) });
  const r = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  assert(r.status === 'future' || r.future === true, 'v=4 应作为未来版本拒绝 actual=' + JSON.stringify(r));
});

// ============ 切片10 用例（幂等层：研究/兵种解锁/导入/恢复）============
test('G01', '切片10：兵种研究窗口内重复 → 只扣一次；ops 记录 1 条', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();S.upgradedUnits={};S.defeated=[1,2,3,4,5,10,11,20];S.res.tech=5000;S.merit=500;S.res.wood=9999;S.res.stone=9999;S.res.food=9999');
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:1}");
  const t0 = e.run('S.res.tech');
  e.run("upgradeUnit('infantry','infantry_t1')");
  const t1 = e.run('S.res.tech');
  e.run("upgradeUnit('infantry','infantry_t1')");
  const t2 = e.run('S.res.tech');
  assert(e.run('S.upgradedUnits.infantry_t1===true') === true, '应解锁成功');
  assert(t1 === t0 - 200, '首次应扣 200 科技点，actual=' + (t0 - t1));
  assert(t2 === t1, '窗口内重复不应再扣，actual=' + (t1 - t2));
  assert(e.run('S.ops.length') === 1 && e.run("S.ops[0].key") === 'unit:infantry>infantry_t1', 'ops 应记录 1 条 actual=' + e.run('JSON.stringify(S.ops)'));
});

test('G02', '切片10：资源科技窗口内重复 → repeat 且不重复扣科技点', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.tech=1000;S.res.wood=9999;S.res.stone=9999;S.res.food=9999');
  const r1 = JSON.parse(e.run('JSON.stringify(researchScience("sci_prospect"))'));
  const t1 = e.run('S.res.tech');
  const r2 = JSON.parse(e.run('JSON.stringify(researchScience("sci_prospect"))'));
  assert(r1.ok === true && !r1.repeat, '首次应正常研究');
  assert(r2.repeat === true, '窗口内重复应返回 repeat actual=' + JSON.stringify(r2));
  assert(e.run('S.res.tech') === t1, '重复不应再扣科技点');
});

test('G03', '切片10：窗口外允许再次执行（改记录时间戳模拟过期）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.tech=1000;S.res.wood=9999;S.res.stone=9999;S.res.food=9999');
  e.run('researchScience("sci_prospect")');
  assert(JSON.parse(e.run('JSON.stringify(researchScience("sci_prospect"))')).repeat === true, '窗口内应 repeat');
  e.run('S.ops[0].t = Date.now() - 6000');   // 模拟窗口过期
  const r = JSON.parse(e.run('JSON.stringify(researchScience("sci_prospect"))'));
  assert(!r.repeat, '窗口外不应再判为重复 actual=' + JSON.stringify(r));
});

test('G04', '切片10：ops 环形上限（≤200）与窗口外清理', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  for (let i = 0; i < 260; i++) e.run(`idemMark('k${i}')`);
  assert(e.run('S.ops.length') <= 200, 'ops 应受上限约束 actual=' + e.run('S.ops.length'));
  assert(e.run('S.ops[S.ops.length-1].key') === 'k259', '应保留最新记录');
});

test('G05', '切片10：同一文本重复导入 → 幂等（不二次覆盖、PRE 不重写）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  const txt = e.run('JSON.stringify(serializeSave())');
  e.run(`commitSaveData(${JSON.stringify(txt)})`);
  const pre1 = e.store.get('rts_save_premigration');
  const master1 = e.store.get('rts_save');
  const r2 = JSON.parse(e.run(`JSON.stringify(commitSaveData(${JSON.stringify(txt)}))`));
  assert(r2.repeat === true, '第二次同文本导入应幂等 actual=' + JSON.stringify(r2));
  assert(e.store.get('rts_save_premigration') === pre1, 'PRE 不应被二次重写');
  assert(e.store.get('rts_save') === master1, '主档不应被二次覆盖');
});

// ============ 切片11 用例（离线结算：0.6× / 24h / 120s / 断粮截断 / 回拨 / 幂等）============
test('H01', '切片11：Δt=3600s → 各资源 = 净速率×3600×0.6（且不超上限）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  const rates = JSON.parse(e.run('JSON.stringify(offlineNetRates())'));
  const before = JSON.parse(e.run('JSON.stringify(S.res)'));
  const r = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert(r.ok === true && r.durationSec === 3600, '应结算 3600s actual=' + JSON.stringify(r));
  // 独立期望：木/石走 prodRate（采集），食物走 净速率；期望值不引用 offlineNetRates 自身，避免自证
  const woodGain = e.run('S.res.wood') - before.wood;
  const expWood = Math.min(e.run("prodRate('wood')") * 3600 * 0.6, e.run('resCap("wood")') - before.wood);
  const expStone = Math.min(e.run("prodRate('stone')") * 3600 * 0.6, e.run('resCap("stone")') - before.stone);
  assert(Math.abs(woodGain - expWood) < 1e-6 && expWood > 0, '木材增益不符：actual=' + woodGain + ' expect(prodRate 独立口径)=' + expWood);
  assert(Math.abs((e.run('S.res.stone') - before.stone) - expStone) < 1e-6, '石料增益不符');
  assert(Math.abs(r.gains.food - rates.food * 3600 * 0.6) < 1e-6, '食物增益不符 actual=' + r.gains.food);
  assert(Math.abs(rates.wood - e.run("prodRate('wood')")) < 1e-9, '采集资源净速率必须等于 prodRate（木）actual=' + rates.wood);
  const rep = JSON.parse(e.run('JSON.stringify(S.offline.pendingReport)'));
  assert(rep && rep.durationSec === 3600 && typeof rep.gains === 'object', '报告卡字段不符: ' + JSON.stringify(rep));
  assert(e.run('S.tick') === 3600 + 3456, 'tick 应前移 delta 保持时钟连续 actual=' + e.run('S.tick'));
});

test('H02', '切片11：起结线（119s 不结 / 120s 结）', () => {
  const mk = sec => makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - sec * 1000 })) });
  const e1 = mk(119); e1.run('loadSaveAndApply()');
  const r1 = JSON.parse(e1.run('JSON.stringify(settleOffline())'));
  assert(r1.ok === false && r1.reason === 'below-min', '119s 不应结算 actual=' + JSON.stringify(r1));
  const e2 = mk(120); e2.run('loadSaveAndApply()');
  const r2 = JSON.parse(e2.run('JSON.stringify(settleOffline())'));
  assert(r2.ok === true && r2.durationSec === 120, '120s 应结算 actual=' + JSON.stringify(r2));
});

test('H03', '切片11：24h 封顶（Δt=3 天 → 只结 86400s，标记截断）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3 * 86400 * 1000 })) });
  e.run('loadSaveAndApply()');
  const r = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert(r.durationSec === 86400 && r.truncated === true, '应截断到 86400s 并标记 actual=' + JSON.stringify(r));
});

test('H04', '切片11：时钟回拨（ts 在未来）→ 不结算、不产生负资源', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() + 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  const before = JSON.parse(e.run('JSON.stringify(S.res)'));
  const r = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert(r.ok === false && r.reason === '时钟回拨或时间戳缺失', '应拒绝结算 actual=' + JSON.stringify(r));
  const after = JSON.parse(e.run('JSON.stringify(S.res)'));
  assert(Object.keys(after).every(k => after[k] === before[k] && after[k] >= 0), '资源不应变化且不为负');
});

test('H05', '切片11：断粮截断（食物净速率为负）→ 按可支付秒数结算，食物不为负', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 7200 * 1000 })) });
  e.run('loadSaveAndApply();S.buildings.mint={lv:40,state:"idle",timer:0,timerEnd:0,tier:0};S.res.food=100');
  const net = JSON.parse(e.run('JSON.stringify(offlineNetRates())')).food;
  assert(net < 0, '构造失败：食物净速率应为负 actual=' + net);
  const r = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert(r.ok === true && r.truncated === true, '应标记截断 actual=' + JSON.stringify(r));
  assert(e.run('S.res.food') >= 0, '食物不得为负 actual=' + e.run('S.res.food'));
  const payable = Math.floor(100 / Math.abs(net));
  assert(r.durationSec === payable, '应按可支付秒数结算 actual=' + r.durationSec + ' expect=' + payable);
});

test('H06', '切片11：幂等（同一次离线只结一次；重复调用返回 repeat）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  const r1 = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  const t1 = e.run('S.res.wood');
  const r2 = JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert(r1.ok === true && r2.repeat === true, '第二次应幂等 actual=' + JSON.stringify(r2));
  assert(e.run('S.res.wood') === t1, '第二次不应再增益');
});

test('H07', '切片11：报告卡展示后可清空；关闭开关＝不结算', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  e.run('settleOffline()');
  assert(e.run('S.offline.pendingReport!==null') === true, '应有待展示报告');
  e.run('dismissOfflineReport()');
  assert(e.run('S.offline.pendingReport') === null, '清空后应为 null');
  const e2 = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e2.run('loadSaveAndApply();CFG.offline.enabled=false');
  const before = e2.run('S.res.wood');
  const r = JSON.parse(e2.run('JSON.stringify(settleOffline())'));
  assert(r.ok === false && r.reason === 'offline-disabled' && e2.run('S.res.wood') === before, '关闭开关不应结算');
});

// ============ 切片12 用例（离线推进：建筑/队列闭式 + 驻军冻结）============
test('J01', '切片12：建筑计时闭式推进（600s 工期在 3600s 离线内完成）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  e.run("S.buildings.farm={lv:0,state:'building',timer:600,timerEnd:600,tier:0}");
  e.run('settleOffline()');
  assert(e.run("bldSt('farm').state") === 'idle' && e.run("bldSt('farm').lv") === 1, '应在离线内建成 actual=' + e.run("JSON.stringify(bldSt('farm'))"));
  assert(e.run('S.offline.pendingReport.advance.advanced') === true, '报告应记录推进');
});

test('J02', '切片12：未到期建筑按 secs 扣减（9999s 工期 − 3600s = 6399）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  e.run("S.buildings.quarry={lv:0,state:'building',timer:9999,timerEnd:9999,tier:0}");
  e.run('settleOffline()');
  const dur = e.run('S.offline.pendingReport.durationSec');
  assert(e.run("bldSt('quarry').timer") === 9999 - dur && e.run("bldSt('quarry').state") === 'building', '应按实际离线时长扣减 actual=' + e.run("bldSt('quarry').timer") + ' dur=' + dur);
});

test('J03', '切片12：训练队列闭式推进（资源充足时按上限/时间预算产出，不逐 tick 模拟）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply();S.res.wood=99999;S.res.stone=99999;S.res.food=99999');
  e.run("S.buildings.infantry_camp={lv:5,state:'idle',timer:0,timerEnd:0,tier:0};S.pool={};S.queue={infantry:{count:60,timer:0,reason:''}}");
  const cap = e.run("unitCap('infantry')");
  e.run('settleOffline()');
  const n = e.run("S.pool.infantry||0");
  assert(cap >= 60 ? n === 60 : n === cap, '应按队列/上限产出 60 或上限 ' + cap + '，actual=' + n);
  assert(e.run('S.offline.pendingReport.advance.produced') === n, '报告应记录产出数');
});

test('J04', '切片12：驻军相位冻结（离线不推进 garrison；不发起战斗）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply()');
  const before = e.run('JSON.stringify(S.garrison)');
  e.run('settleOffline()');
  assert(e.run('JSON.stringify(S.garrison)') === before, '驻军状态不得被离线推进改动');
});

test('J05', '切片12：关闭 advance 开关 → 不推进（建筑/队列原样）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 3600 * 1000 })) });
  e.run('loadSaveAndApply();CFG.offline.advance=false');
  e.run("S.buildings.farm={lv:0,state:'building',timer:600,timerEnd:600,tier:0};S.pool={};S.queue={infantry:{count:60,timer:0,reason:''}}");
  e.run('settleOffline()');
  assert(e.run("bldSt('farm').timer") === 600 && e.run("S.pool.infantry||0") === 0, '关闭开关不应推进 actual=' + e.run("bldSt('farm').timer") + '/' + e.run("S.pool.infantry||0"));
});

test('J06', '切片12：与 tick 等价性抽查（同工期下：闭式推进 vs 逐秒 tick 结果一致）', () => {
  const mk = () => makeEnv({ 'rts_save': JSON.stringify(Object.assign({}, fullLegacy(), { ts: Date.now() - 300 * 1000 })) });
  const a = mk(); a.run('loadSaveAndApply()');
  a.run("S.buildings.farm={lv:0,state:'building',timer:100,timerEnd:100,tier:0}");
  a.run('offlineAdvanceSec(100)');
  const b = mk(); b.run('loadSaveAndApply()');
  b.run("S.buildings.farm={lv:0,state:'building',timer:100,timerEnd:100,tier:0}");
  for (let i = 0; i < 100; i++) b.run('advanceBuildingsBy(1)');
  assert(a.run("JSON.stringify(bldSt('farm'))") === b.run("JSON.stringify(bldSt('farm'))"), '闭式与逐秒结果不一致: ' + a.run("JSON.stringify(bldSt('farm'))") + ' vs ' + b.run("JSON.stringify(bldSt('farm'))"));
});

// ============ 切片13 用例（交易所多汇率 + 日限 + 转换损失）============
test('K01', '切片13：多汇率表存在、无套利（所有互兑往返乘积<1）；关闭开关仅原 4 条口径', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply()');
  const rates = JSON.parse(e.run('JSON.stringify(CFG.market.rates)'));
  assert(rates.length === 12, '多汇率应含 12 条（切片13 十条 + S8c 地契两条）actual=' + rates.length);
  for (const a of rates) for (const b of rates) if (a.from === b.to && a.to === b.from) assert(a.rate * b.rate < 1, a.from + '↔' + a.to + ' 存在套利: ' + (a.rate * b.rate).toFixed(3));
  e.run('CFG.market.multiRate=false');
  assert(e.run('marketDailyLimit()') === 0, '关闭开关时不应有日限');
});

test('K02', '切片13：每日上限（5 次后第 6 次被拒），失败不改资源', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.coin=9999;S.res.wood=0');
  let last = null;
  for (let i = 0; i < 5; i++) last = JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",1))'));
  assert(last.ok === true && last.remaining === 0, '第 5 次应成功且剩余 0 actual=' + JSON.stringify(last));
  const w5 = e.run('S.res.wood');
  const r6 = JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",1))'));
  assert(r6.ok === false && r6.reason === 'daily-limit', '第 6 次应被日限拒绝 actual=' + JSON.stringify(r6));
  assert(e.run('S.res.wood') === w5, '被拒时不应改动资源');
});

test('K03', '切片13：跨日重置（把 day 改为昨天 → 计数归零、可再兑换）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.coin=9999;S.res.wood=0');
  for (let i = 0; i < 5; i++) e.run('exchangeResource("coin","wood",1)');
  assert(JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",1))')).reason === 'daily-limit', '应先达到日限');
  e.run("S.daily.day='2000-01-01'");
  const r = JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",1))'));
  assert(r.ok === true && r.remaining === 4, '跨日后应重置并可兑换 actual=' + JSON.stringify(r));
  assert(e.run('S.daily.day') === e.run('localDay()'), 'day 应更新为今天');
});

test('K04', '切片13：关闭开关 → 无日限（可连续兑换 8 次）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();CFG.market.multiRate=false;S.res.coin=9999;S.res.wood=0');
  let ok = 0;
  for (let i = 0; i < 8; i++) if (JSON.parse(e.run('JSON.stringify(exchangeResource("coin","wood",1))')).ok) ok++;
  assert(ok === 8, '关闭开关时应无日限 actual=' + ok);
});

test('K05', '切片13：未知汇率拒绝且不改资源；跨资源兑换按 0.6 取整生效', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.wood=1000;S.res.stone=0');
  const r1 = JSON.parse(e.run('JSON.stringify(exchangeResource("wood","iron",5))'));
  assert(r1.ok === false && e.run('S.res.wood') === 1000, '未知汇率应拒绝且不改资源');
  const r2 = JSON.parse(e.run('JSON.stringify(exchangeResource("wood","stone",10))'));
  assert(r2.ok === true && r2.get === 6 && e.run('S.res.stone') === 6, '跨资源兑换应按 0.6 取整 actual=' + JSON.stringify(r2));
});

// ============ 切片16 用例（D1 版本号纪律自检）============
test('P01', '切片16：index.html 版本锚点/加载顺序/协议感知齐全', () => {
  const html = fs.readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
  assert(/var V='\d+'/.test(html), '索引缺少 var V=<数字> 版本锚点');
  assert(/APP_VERSION\s*=\s*V/.test(html) && /APP_SCRIPTS\s*=\s*files\.slice\(\)/.test(html), '缺少供自检读取的 APP_VERSION/APP_SCRIPTS');
  assert(/location\.protocol==='http:'/.test(html) && /'\+V\)/.test(html), '缺少协议感知的 ?v= 查询串');
  const order = ['config.js', 'levels.js', 'sprites.js', 'math.js', 'garrison.js', 'technology.js', 'ui.js'];
  const m = html.match(/var files=\[([^\]]+)\]/);
  assert(m, '缺少加载列表 var files=[...]');
  const got = m[1].split(',').map(s => s.replace(/['"]/g, '').trim());
  assert(JSON.stringify(got) === JSON.stringify(order), '加载顺序被改动：' + got.join(','));
});

// ============ S8c 用例（D2 地契：资源 + 城镇门改「地契+科技」）============
test('L01', 'S8c：地契资源存在、上限生效、旧档迁移补 0（不裁剪进度）', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  const r = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  assert(['ok', 'migrated'].includes(r.status), '旧档应可加载 actual=' + r.status);
  assert(e.run('S.res.deed') === 0, '旧档应补地契 0 actual=' + e.run('S.res.deed'));
  assert(e.run('S.res.wood') === 12345.5, '补齐不得改动既有资源');
  assert(e.run("resCap('deed')") === 999999, '地契上限不符 actual=' + e.run("resCap('deed')"));
  assert(e.run("CFG.res.deed.icon") === 'deed', '地契图标键应为 deed');
});

test('L02', 'S8c：金币→地契 兑换生效；往返无套利（0.01×80=0.8）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.res.coin=10000;S.res.deed=0');
  const r = JSON.parse(e.run('JSON.stringify(exchangeResource("coin","deed",1000))'));
  assert(r.ok === true && r.get === 10 && e.run('S.res.deed') === 10, '1000 金币应换 10 地契 actual=' + JSON.stringify(r));
  const rates = JSON.parse(e.run('JSON.stringify(CFG.market.rates)'));
  const a = rates.find(x => x.from === 'coin' && x.to === 'deed'), b = rates.find(x => x.from === 'deed' && x.to === 'coin');
  assert(a && b && a.rate * b.rate < 1, '地契往返应无套利');
});

test('L03', 'S8c：城镇升级门＝地契+科技（不足则拒绝且不扣费）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.townLv=1;S.res.deed=0;S.res.tech=0;S.defeated=[1,2,3,4,5,6,7,8,9,10]');
  assert(e.run('townCanUpgrade()') === false, '地契/科技不足时不应可升级（即使 Boss 已击杀）');
  const short2 = e.run("townGateShortfall(2)");
  assert(/地契/.test(short2), 'Lv2 应给出地契缺口 actual=' + short2);
  e.run('S.res.tech=0');
  const short3 = e.run("townGateShortfall(3)");
  assert(/地契/.test(short3) && /科技点/.test(short3), 'Lv3 应同时给出地契与科技点缺口 actual=' + short3);
  e.run('upgradeTown()');
  assert(e.run('S.townUpgrade') === null || e.run('S.townUpgrade') === undefined, '不足时不得开始升级');
  assert(e.run('S.res.deed') === 0 && e.run('S.res.tech') === 0, '不足时不得扣费');
});

test('L04', 'S8c：满足需求后升级成功且只扣一次（地契 5 + 科技 0）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.townLv=1;S.res.deed=20;S.res.tech=500;S.popAlloc={wood:1,stone:1,food:1}');
  assert(e.run('townCanUpgrade()') === true, '满足需求应可升级');
  e.run('upgradeTown()');
  assert(e.run('S.res.deed') === 15 && e.run('S.res.tech') === 500, '应只扣地契 5（Lv2 科技门槛为 0）actual=' + e.run('S.res.deed') + '/' + e.run('S.res.tech'));
  assert(e.run('S.townUpgrade') !== null, '应进入升级计时');
  e.run('advanceBuildingsBy(9999)');
  assert(e.run('S.townLv') === 2, '计时结束后应升到 Lv2 actual=' + e.run('S.townLv'));
});

test('L05', 'S8c：关闭开关 → 回到 Boss 门（原行为）；存档不含地契键', () => {
  const e = makeEnv({ 'rts_save': JSON.stringify(fullLegacy()) });
  e.run('loadSaveAndApply();CFG.townGate.useDeed=false');
  e.run('S.townLv=1;S.defeated=[]');
  assert(e.run('townCanUpgrade()') === false, '关闭开关时应回到 Boss 门');
  assert(e.run('townGateCost(2)') === null, '关闭开关时不应有地契需求');
  e.run('S.res.deed=99;save()');
  const d = JSON.parse(e.store.get('rts_save'));
  assert(!('deed' in d.res), '关闭开关时存档不应含地契键（等价性守护）');
});

test('L06', 'S8c：连续升级按表扣费（Lv2→Lv3 需 地契15+科技100）', () => {
  const e = makeEnv();
  e.run('loadSaveAndApply();S.townLv=2;S.res.deed=100;S.res.tech=1000;S.popAlloc={wood:1,stone:1,food:1}');
  assert(e.run('townCanUpgrade()') === true, 'Lv2→Lv3 应可升级');
  e.run('upgradeTown();advanceBuildingsBy(9999)');
  assert(e.run('S.townLv') === 3 && e.run('S.res.deed') === 85 && e.run('S.res.tech') === 900, '扣费不符 actual=' + e.run('S.res.deed') + '/' + e.run('S.res.tech'));
});

// —— 汇总输出 ——
for (const [st, id, name] of rows) console.log('[' + st + '] ' + id + ' — ' + name);
console.log('\nS13/S14 归属：S13 真实浏览器冒烟=browser_smoke.js（新档+legacy 迁移+游玩链路）；S14 窄屏与输入交互=browser_interact.js；实体手机/Android WebView 均未运行。');
console.log('node ' + process.version + ' | 通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
