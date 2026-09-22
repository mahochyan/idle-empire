'use strict';
// 只读：定位人口二公式的定义点（打印全部候选出现点的上下文）
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
for (const fn of ['getPeopleMax', 'getPeopleSpeed']) {
  console.log('=== ' + fn + ' 全部出现点（最多 8）===');
  let p = 0, n = 0;
  while ((p = t.indexOf(fn, p)) !== -1 && n < 8) {
    const ctx = t.slice(p, p + 120).replace(/\s+/g, ' ');
    console.log(`  @${p}  ${ctx}`);
    p += fn.length; n++;
  }
  console.log('');
}
console.log('=== 人口相关字面量候选（StartValue / 人口增长相关）===');
for (const a of ['StartValue', "'People'", '"People"', 'PeopleList', 'getPeopleAdd', 'addPeople']) {
  const p = t.indexOf(a);
  console.log(`  ${a} @${p}  ${p < 0 ? '[未命中]' : t.slice(p, p + 140).replace(/\s+/g, ' ')}`);
}
