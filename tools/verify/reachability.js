'use strict';
// 可达性检查（切片3 证据工具）：枚举全部解锁门，判定在"纯挂机（不战斗）"下是否可达
// 依据：CFG.sciences（资源科技链）/ CFG.buildings.needScience|needBoss / technology.js 兵种研究门槛
// 用法：node tools/verify/reachability.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const ctx = { console, Date, Math, JSON, localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  document: { getElementById: () => ({ value: '', textContent: '', innerHTML: '', style: {}, classList: { add() { }, remove() { }, contains() { return false } }, setAttribute() { }, remove() { }, appendChild() { }, addEventListener() { } }), querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() { } }, appendChild() { }, setAttribute() { } }), body: { appendChild() { } } },
  window: {}, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => { }, clearInterval: () => { }, toast: () => { }, addLog: () => { }, updateUI: () => { }, pix: () => '' };
const sb = vm.createContext(ctx);
for (const f of ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const run = c => vm.runInContext(c, sb);
const CFG = run('CFG');
const noMerit = !!(CFG.tech && CFG.tech.sciencesNoMerit);

console.log('可达性检查 · 口径：纯挂机（不战斗、不推进关卡）· 开关 sciencesNoMerit=' + noMerit);
console.log('='.repeat(88));

// 1) 资源科技门
console.log('\n【资源科技门】（科技点来源=学院被动，纯挂机可达）');
let sciOk = 0, sciBad = 0;
for (const [id, sc] of Object.entries(run('activeSciences()'))) {
  const need = (sc.need || []).join(',') || '—';
  const meritRaw = (sc.cost && sc.cost.merit) || 0;
  const meritEff = noMerit ? 0 : meritRaw;
  const verdict = meritEff === 0 ? '可达（纯挂机）' : '不可达（需战功=战斗源）';
  if (meritEff === 0) sciOk++; else sciBad++;
  console.log(`  ${id.padEnd(12)} 科技点${String((sc.cost && sc.cost.tech) || 0).padStart(4)} 战功原始${String(meritRaw).padStart(3)} 生效${String(meritEff).padStart(3)} 前置[${need}] 解锁[${(sc.unlocks || []).join(',')}] → ${verdict}`);
}

// 2) 建筑门
console.log('\n【建筑门】');
const rows2 = [];
for (const [k, b] of Object.entries(CFG.buildings || {})) {
  if (b.needScience) rows2.push(`  ${k.padEnd(14)} needScience=${b.needScience} → 依赖资源科技（见上）`);
  if (b.needBoss) rows2.push(`  ${k.padEnd(14)} needBoss=${b.needBoss} → 击杀门（战斗源，纯挂机不可达）`);
}
console.log(rows2.length ? rows2.join('\n') : '  （无）');

// 3) 兵种研究门（战斗源标注）
console.log('\n【兵种研究门】（technology.js；精魄=Boss掉落/战功=战斗）');
let unitTotal = 0, unitCombat = 0;
for (const [line, tree] of Object.entries(CFG.unitUpgrades || {})) {
  const walk = t => {
    for (const [k, node] of Object.entries(t.tree || t)) {
      for (const br of (node.branches || [])) {
        unitTotal++;
        const combat = (br.needMerit || 0) > 0 || !!br.needEssence;
        if (combat) unitCombat++;
      }
      if (node.unlock) { unitTotal++; const c = (node.unlock.needMerit || 0) > 0 || !!node.unlock.needEssence; if (c) unitCombat++; }
    }
  };
  walk(tree);
}
console.log(`  分支/解锁节点合计 ${unitTotal} 个，其中需战斗资源（战功/精魄）${unitCombat} 个 → 纯挂机不可达比例 ${(unitTotal ? (unitCombat / unitTotal * 100).toFixed(0) : 0)}%`);

console.log('\n' + '='.repeat(88));
console.log(`结论：资源科技 ${sciOk}/${sciOk + sciBad} 项在纯挂机下可达${sciBad ? `（${sciBad} 项仍被战斗资源阻塞）` : '（死锁已解）'}；`);
console.log('      兵种研究仍依赖战功/精魄（战斗源）——属设计预期，不在 S1 范围（S1 仅解资源科技死锁）');
console.log('      提醒：城镇升级仍为击杀门（needBossId），故所有受城镇等级限制的上限在纯挂机下封顶（见 F3/R2）');
