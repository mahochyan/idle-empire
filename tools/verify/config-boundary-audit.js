'use strict';
// 只读审计：逻辑层里的数值字面量分布（用于 D2「数值配置化边界表」）
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['math.js', 'technology.js', 'garrison.js', 'ui.js'];
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
const interesting = new Map();
for (const f of FILES) {
  const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const re = /(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g;
  let m;
  const counts = new Map();
  while ((m = re.exec(src)) !== null) {
    const v = m[1];
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  console.log(`\n=== ${f}（去注释/字符串后的数值字面量，共 ${counts.size} 种）===`);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log('  高频：' + list.map(([v, c]) => `${v}×${c}`).join('  '));
  // 阈值类候选：>=10 且 <=100000，且不是明显的 0/1/2 小索引
  const th = [...counts.entries()].filter(([v]) => { const n = parseFloat(v); return n >= 10 && n <= 100000; }).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  console.log('  阈值类候选：' + th.map(([v, c]) => `${v}×${c}`).join('  '));
}
console.log('\n注：本审计只读，不改任何文件；用于人工判断"哪些数值应进 config.js"。');
