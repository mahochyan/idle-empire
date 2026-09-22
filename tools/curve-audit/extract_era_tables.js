'use strict';
// 只读提取脚本（curve-audit 阶段1）：从解包文本按 16 进制键抽取原始表项与公式原文
// 用法：node tools/curve-audit/extract_era_tables.js ；不写文件、不执行游戏代码
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');

// 取 0x<hex>: 起始的条目原文（括号配对），返回 {off, text}
function entry(decId) {
  const key = '0x' + decId.toString(16) + ':{';
  const off = t.indexOf(key);
  if (off < 0) return { off: -1, text: '' };
  let i = off + key.length - 1, depth = 0, inStr = false, q = '';
  for (let p = i; p < Math.min(t.length, i + 4000); p++) {
    const c = t[p];
    if (inStr) { if (c === q && t[p - 1] !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { off, text: t.slice(off, p + 1) }; }
  }
  return { off, text: t.slice(off, off + 400) + '…(未闭合)' };
}
const pick = (s, re) => { const m = s.match(re); return m ? m[1] : '—'; };
function show(decId, label) {
  const e = entry(decId);
  if (e.off < 0) return console.log(`  ${decId} ${label}: [未找到键]`);
  const name = pick(e.text, /'Name':\s*"([^"]+)"/) !== '—' ? pick(e.text, /'Name':\s*"([^"]+)"/) : pick(e.text, /'Name':\s*'([^']+)'/);
  const max = pick(e.text, /'Max':\s*(0x[0-9a-f]+|\d+)/);
  const lim = pick(e.text, /'LimitID':\s*(0x[0-9a-f]+|\d+)/);
  const wk = pick(e.text, /'WorkerID':\s*(0x[0-9a-f]+|\d+)/);
  const farm = pick(e.text, /'FarmID':\s*(0x[0-9a-f]+|\d+)/);
  const iv = pick(e.text, /'Interval':\s*(0x[0-9a-f]+|\d+)/);
  const get = pick(e.text, /'Get':\s*(\[[^\]]*\])/);
  const need = pick(e.text, /'Need':\s*(\[[^\]]{0,60}\])/);
  const sci = pick(e.text, /'ScienceID':\s*(0x[0-9a-f]+|\d+)/);
  const dec = v => v === '—' ? '—' : (/^0x/.test(v) ? `${parseInt(v, 16)}(=${v})` : v);
  console.log(`  ${decId} ${label} @${e.off} Name=${name} Max=${dec(max)} LimitID=${dec(lim)} WorkerID=${dec(wk)} FarmID=${dec(farm)} Interval=${dec(iv)} ScienceID=${dec(sci)}`);
  if (get !== '—') console.log(`      Get=${get}`);
  if (need !== '—') console.log(`      Need=${need}`);
}

console.log('文件:', F, '大小:', t.length, 'B');
console.log('\n=== A. 基础资源 150001-150010（原始 Max/LimitID/WorkerID/FarmID）===');
for (let i = 150001; i <= 150010; i++) show(i, '资源');
console.log('\n=== B. 人口/软通货 160001-160010 ===');
for (let i = 160001; i <= 160010; i++) show(i, '通货');
console.log('\n=== C. 工人 350001-350015（Interval/Get/Need/ScienceID）===');
for (let i = 350001; i <= 350015; i++) show(i, '工人');
console.log('\n=== D. 城镇 360001-360003 ===');
for (let i = 360001; i <= 360003; i++) show(i, '城镇');
console.log('\n=== E. 知识解锁科技 450004 / 铜 450009 / 铁 450011 / 钢 450017 / 货币 450609 ===');
for (const id of [450004, 450009, 450011, 450013, 450015, 450017, 450609]) show(id, '发展科技');

// 公式原文切片
console.log('\n=== F. 人口公式原文（getPeopleMax / getPeopleSpeed）===');
for (const fn of ['getPeopleMax', 'getPeopleSpeed']) {
  const i = t.indexOf(`'${fn}'`);
  const j = t.indexOf(`"${fn}"`);
  const p = i >= 0 ? i : j;
  console.log(`--- ${fn} @${p} ---`);
  console.log(t.slice(p, p + 520).replace(/\s+/g, ' '));
  console.log('');
}
console.log('=== G. 工坊升级费 addWorkShopLv 原文（分段斜率）===');
const aw = t.indexOf("'addWorkShopLv'");
console.log(t.slice(aw, aw + 700).replace(/\s+/g, ' '));
console.log('\n=== H. 幸福度分段 happlyPerHandle 原文 ===');
const hp = t.indexOf('"happlyPerHandle"');
console.log(t.slice(hp, hp + 900).replace(/\s+/g, ' '));
