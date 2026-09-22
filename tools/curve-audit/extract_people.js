'use strict';
// 只读：打印人口三处定义原文（上限/增长/增长定时器）
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
const at = (off, len, label) => { console.log(`--- ${label} @${off} ---`); console.log('  ' + t.slice(off, off + len).replace(/\s+/g, ' ')); console.log(''); };
at(1310369, 1000, 'getPeopleMax 定义（人口上限）');
at(1310081, 700, 'getPeopleSpeed 定义（人口增长速率）');
at(1790274, 700, 'addPeople 定义 + 10s 定时器（0x2710）');
at(1840800, 500, 'deathPeople 定时器（粮尽死亡）');
