'use strict';
// 只读：查清《放置时代》"进度门"由什么构成（回答 R2：城镇/上限/内容分别由什么解锁）
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
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

console.log('=== 1) 城镇（人口上限来源）表项：需什么 ===');
for (const id of [360001, 360002, 360003]) {
  const e = entry(id); if (!e) continue;
  const name = pick(e.text, /'Name':\s*"([^"]+)"/) || pick(e.text, /'Name':\s*'([^']+)'/);
  console.log(`  ${id} ${name} @${e.off} Get=${pick(e.text, /'Get':\s*(\[[^\]]{0,40}\])/)} Need=${pick(e.text, /'Need':\s*(\[[^\]]{0,40}\])/)} LimitID=${pick(e.text, /'LimitID':\s*(0x[0-9a-f]+|\d+)/)}`);
}

console.log('\n=== 2) 地契（160009 = 0x27109）的产出/消耗点 ===');
let p = 0, hits = [];
while ((p = t.indexOf('0x27109', p)) !== -1 && hits.length < 12) { hits.push(p); p += 7; }
for (const h of hits) console.log(`  @${h}: ` + t.slice(Math.max(0, h - 110), h + 90).replace(/\s+/g, ' '));

console.log('\n=== 3) 建筑升级/建造的条件（工坊 addWorkShopLv 关键判定）===');
const aw = t.indexOf("'addWorkShopLv','value'");
console.log('  ' + t.slice(aw, aw + 300).replace(/\s+/g, ' '));
for (const anchor of ["'upWorkShop'", "'levelUp'", "'LvMax'", "'NeedLv'"]) {
  const i = t.indexOf(anchor);
  console.log(`  [${anchor}] @${i} ${i < 0 ? '' : t.slice(i, i + 160).replace(/\s+/g, ' ')}`);
}

console.log('\n=== 4) 关卡/进度 是否作为建筑或科技的门（搜索关卡计数判定）===');
for (const a of ['GuanQia', 'guanqia', 'PassLevel', 'LevelID', 'clearLevel', 'jiesuo', 'UnlockLevel', 'needLevel', 'LevelNum']) {
  const i = t.indexOf(a);
  console.log(`  [${a}] ${i < 0 ? '0 命中' : '@' + i + ' ' + t.slice(i, i + 120).replace(/\s+/g, ' ')}`);
}

console.log('\n=== 5) 科技表里是否出现"击杀/关卡"类前置（抽查 Need 字段形态）===');
const lp = t.indexOf("developScienceList':[");
const ids = (t.slice(lp + 20, lp + 20 + 1200).match(/0x[0-9a-f]+/g) || []).slice(0, 12).map(h => parseInt(h, 16));
for (const id of ids) {
  const e = entry(id); if (!e) continue;
  const nm = pick(e.text, /'Name':\s*"([^"]+)"/) || pick(e.text, /'Name':\s*'([^']+)'/);
  const need = pick(e.text, /'Need':\s*(\[[^\]]{0,60}\])/);
  const keys = (e.text.match(/'[A-Za-z]+':/g) || []).map(s => s.slice(1, -2));
  console.log(`  ${id} ${nm} Need=${need} 字段=[${Array.from(new Set(keys)).join(',')}]`);
}

console.log('\n=== 6) 我方的城镇门对照（代码事实）===');
const R = path.join('E:', 'AIprogram', 'idlgame');
const cfg = fs.readFileSync(path.join(R, 'config.js'), 'utf8');
const town = cfg.slice(cfg.indexOf('town:'), cfg.indexOf('town:') + 700).split('\n').slice(0, 12).join('\n');
console.log(town);
