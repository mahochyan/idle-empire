'use strict';
// 只读：打印《放置时代》工坊升级费 addWorkShopLv 的完整原文（含分段斜率判定）
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
const p = t.indexOf("'addWorkShopLv','value'");
console.log('锚点 @' + p);
const seg = t.slice(p, p + 2400).replace(/\s+/g, ' ');
console.log(seg);
console.log('\n--- 斜率字面量出现情况（5/10/20/40 = 0x5/0xa/0x14/0x28）---');
for (const [name, hex] of [['5', '0x5'], ['10', '0xa'], ['20', '0x14'], ['40', '0x28']]) {
  const re = new RegExp(hex.replace('0x', '0x') + '\\b', 'g');
  const n = (seg.match(re) || []).length;
  console.log(`  ${name} (${hex})：${n} 次`);
}
