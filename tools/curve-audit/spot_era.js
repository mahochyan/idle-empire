'use strict';
// 只读抽查脚本（curve-audit 阶段1）：对《放置时代》解包文本的关键锚点做本次独立复验
// 用法：node tools/curve-audit/spot_era.js ；不写任何文件、不执行游戏代码
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
console.log('文件:', F);
console.log('大小:', t.length, 'B（单行反混淆，从未执行）');
console.log('');

// 锚点分组：[锚点, 说明, 所属线]
const GROUPS = {
  '资源线-函数': [['getResourceSpeed', '产出净速率合成'], ['freshResourceMax', '基础资源上限'], ['freshCoinMax', '货币上限'], ['addWorkShopLv', '工坊升级费'], ['getOfflineResource', '离线结算']],
  '资源线-数值': [['0xbb8', '3000 粮食基础Max'], ['0x708', '1800 木材'], ['0x4b0', '1200 矿石'], ['0x258', '600 麻布/煤/铜/铁'], ['0x12c', '300 银/金/钢/知识'], ['0x2710', '10000 货币Max / 10s定时器'], ['0x15180', '86400 秒=24h 离线上限'], ['0x1d4c0', '120000ms=2min 校时']],
  '人口线': [['getPeopleMax', '人口上限'], ['getPeopleSpeed', '人口增长速率'], ['deathPeople', '粮尽死亡'], ['happlyPerHandle', '幸福度分段系数'], ['0x9c4', '2500 军粮阶梯基数'], ['0x4b', '75 广告每日上限']],
  '科技线': [['developScience', '发展科技(时代树)'], ['resourceScience', '资源科学'], ['warScience', '战争/研发链'], ['ScienceList', '已研科技表'], ['LimitID', '科技门控字段'], ['0x6ddd4', '450004 知识解锁科技'], ['0x6ddd9', '450009 铜解锁科技'], ['0x6dddb', '450011 铁解锁科技'], ['0x6dde1', '450017 钢解锁科技'], ['0x6e031', '450609 货币解锁科技']],
  '倍率(含付费/离线)': [['VIP004', 'VIP 产出×2'], ['VIP005', 'VIP 产出×4'], ['VIP006', 'VIP 产出×8'], ['AdvSpeed', '广告产出倍率'], ['0.6', '离线结算系数(0.6)']]
};

let total = 0, hit = 0;
for (const [g, list] of Object.entries(GROUPS)) {
  console.log('=== ' + g + ' ===');
  for (const [anchor, desc] of list) {
    const idx = [];
    let p = 0;
    while ((p = t.indexOf(anchor, p)) !== -1) { idx.push(p); p += anchor.length; if (idx.length > 999) break; }
    total++;
    if (idx.length) { hit++; const c = t.slice(Math.max(0, idx[0] - 30), idx[0] + anchor.length + 30).replace(/\s+/g, ' '); console.log(`[命中 ${String(idx.length).padStart(4)}] ${anchor}  (${desc})  @${idx[0]}  上下文: …${c}…`); }
    else console.log(`[0 命中] ${anchor}  (${desc})`);
  }
  console.log('');
}
console.log(`锚点合计 ${total}，命中 ${hit}，零命中 ${total - hit}`);
