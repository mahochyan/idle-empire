'use strict';
// 只读提取脚本 v3：人口公式 + 发展科技知识阶梯 + 军粮分段 + 我方对照
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
const dec = v => v == null ? '—' : (/^0x/.test(v) ? String(parseInt(v, 16)) : v);
function entry(decId) {
  const key = '0x' + decId.toString(16) + ':{';
  const off = t.indexOf(key);
  if (off < 0) return null;
  let depth = 0, inStr = false, q = '';
  for (let p = off + key.length - 1; p < Math.min(t.length, off + 5000); p++) {
    const c = t[p];
    if (inStr) { if (c === q && t[p - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return { off, text: t.slice(off, p + 1) }; }
  }
  return { off, text: t.slice(off, off + 400) };
}
const pick = (s, re) => { const m = s.match(re); return m ? m[1] : null; };

console.log('文件:', F, '大小:', t.length, 'B\n');
console.log('=== F. 人口上限 / 增长 公式定义原文 ===');
for (const fn of ['getPeopleMax', 'getPeopleSpeed']) {
  const p = t.indexOf('"' + fn + '",function');
  console.log(`--- ${fn} @${p} ---`);
  console.log(p < 0 ? '  [未命中]' : '  ' + t.slice(p, p + 900).replace(/\s+/g, ' '));
  console.log('');
}
console.log('=== K2. 军粮分段完整原文（@1315400 起 500 字）===');
console.log(t.slice(1315400, 1315900).replace(/\s+/g, ' '));
console.log('');
console.log('=== L2. 发展科技知识阶梯（developScienceList 全量逐条）===');
const lp = t.indexOf("developScienceList':[");
const arr = t.slice(lp + 20, lp + 20 + 4000);
const ids = (arr.match(/0x[0-9a-f]+/g) || []).map(h => parseInt(h, 16)).slice(0, 40);
let n = 0;
for (const id of ids) {
  const e = entry(id); if (!e) continue;
  const name = pick(e.text, /'Name':\s*"([^"]+)"/) || pick(e.text, /'Name':\s*'([^']+)'/);
  const need = pick(e.text, /'Need':\s*(\[[^\]]{0,80}\])/);
  const lim = pick(e.text, /'LimitID':\s*(0x[0-9a-f]+)/);
  console.log(`  ${id} ${name} @${e.off} Need=${need} LimitID=${dec(lim)}`);
  n++;
}
console.log(`  （共列出 ${n} 条，developScienceList 区 @${lp}）`);
console.log('\n=== M. 资源科学 46xxxx 抽样（460028 上限科技 / 460021 全局乘区）===');
for (const id of [460002, 460021, 460028]) {
  const e = entry(id); if (!e) { console.log(`  ${id}: [未找到]`); continue; }
  const name = pick(e.text, /'Name':\s*"([^"]+)"/) || pick(e.text, /'Name':\s*'([^']+)'/);
  console.log(`  ${id} ${name} @${e.off} Get=${pick(e.text, /'Get':\s*(\[[^\]]{0,60}\])/)} Need=${pick(e.text, /'Need':\s*(\[[^\]]{0,60}\])/)}`);
}
