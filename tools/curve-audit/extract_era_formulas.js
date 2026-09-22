'use strict';
// 只读提取脚本 v2（curve-audit 阶段1）：公式原文 + 工坊/仓库/军粮/研究树锚点
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
const show = (label, anchor, len) => {
  const p = t.indexOf(anchor);
  console.log(`--- ${label} | 锚点 "${anchor}" @${p} ---`);
  if (p < 0) { console.log('  [未命中]'); return; }
  console.log('  ' + t.slice(p, p + (len || 900)).replace(/\s+/g, ' '));
  console.log('');
};
function entry(decId) {
  const key = '0x' + decId.toString(16) + ':{';
  const off = t.indexOf(key);
  if (off < 0) return null;
  let depth = 0, inStr = false, q = '';
  for (let p = off + key.length - 1; p < Math.min(t.length, off + 4000); p++) {
    const c = t[p];
    if (inStr) { if (c === q && t[p - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return { off, text: t.slice(off, p + 1) }; }
  }
  return { off, text: t.slice(off, off + 400) };
}
const pick = (s, re) => { const m = s.match(re); return m ? m[1] : '—'; };
const dec = v => v === '—' ? '—' : (/^0x/.test(v) ? `${parseInt(v, 16)}` : v);
function tbl(decId, label) {
  const e = entry(decId); if (!e) return console.log(`  ${decId} ${label}: [未找到键]`);
  const name = pick(e.text, /'Name':\s*"([^"]+)"/) !== '—' ? pick(e.text, /'Name':\s*"([^"]+)"/) : pick(e.text, /'Name':\s*'([^']+)'/);
  console.log(`  ${decId} ${label} @${e.off} Name=${name} LvMax=${dec(pick(e.text, /'LvMax':\s*(0x[0-9a-f]+|\d+)/))} Get=${pick(e.text, /'Get':\s*(\[[^\]]{0,70}\])/)} Need=${pick(e.text, /'Need':\s*(\[[^\]]{0,50}\])/)} LimitID=${dec(pick(e.text, /'LimitID':\s*(0x[0-9a-f]+|\d+)/))}`);
}

console.log('文件:', F, '大小:', t.length, 'B\n');
console.log('=== F. 人口上限/增长公式定义原文 ===');
show('getPeopleMax 定义', "'getPeopleMax','value'", 1000);
show('getPeopleSpeed 定义', "'getPeopleSpeed','value'", 700);
console.log('=== G. 幸福度分段 happlyPerHandle 原文 ===');
show('happlyPerHandle', '"happlyPerHandle"', 1000);
console.log('=== H. 工坊升级费分段斜率 addWorkShopLv 原文 ===');
show('addWorkShopLv', "'addWorkShopLv','value'", 1700);
console.log('=== I. 工坊表 260001-260006（每级加成 Get）===');
for (const id of [260001, 260002, 260003, 260006, 260012, 260013]) tbl(id, '工坊');
console.log('\n=== J. 仓库 270001/270003/270005 ===');
for (const id of [270001, 270003, 270005]) tbl(id, '仓库');
console.log('\n=== K. 军粮/口粮锚点 ===');
for (const a of ["'getArmyFood'", '"getArmyFood"', "'ArmyFood'", "armyFood", "0x12c+0x2*", "0x1f4+0x4*"]) show('军粮候选锚点', a, 300);
console.log('=== L. 研究树与里程碑倍率 ===');
show('developScienceList 区', "developScienceList", 500);
for (const a of ['0xd05', '0x3333', '3333']) show('×3333 里程碑候选', a, 200);
