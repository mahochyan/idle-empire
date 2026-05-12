// ==================== 游戏配置 ====================
// 独立配置文件，方便数值测试和调整
const CFG = {
  tickMs: 1000,
  campBase: 0,
  maxRows: {front:1, mid:1, back:1},
  battleTimeoutMs: 10*60*1000,
  initRegMax: 10,
  chapterResourceLevels: 10,
  maxUpgradeTime: 120,

  // 资源定义
  res: {
    wood:{name:'木材',icon:'wood',basePerPop:0.5},
    stone:{name:'石料',icon:'stone',basePerPop:0.5},
    food:{name:'食物',icon:'food',basePerPop:0.5}
  },

  // 城镇等级
  town: [
    {lv:1,name:'小村庄',maxPop:10, needBoss:0},
    {lv:2,name:'村庄',maxPop:18, needBoss:1},
    {lv:3,name:'大村庄',maxPop:28, needBoss:2},
    {lv:4,name:'小镇',maxPop:42, needBoss:3},
    {lv:5,name:'城镇',maxPop:60, needBoss:5},
    {lv:6,name:'大城镇',maxPop:80, needBoss:7},
    {lv:7,name:'小城',maxPop:105, needBoss:10},
    {lv:8,name:'城市',maxPop:140, needBoss:13}
  ],

  // 兵种
  units: {
    infantry:{name:'步兵',race:'人类',row:'front',icon:'infantry',
      cost:{wood:50,stone:20,food:40}, upkeep:0.05, trainTime:1, atk:6,def:10,spd:10, passive:'攻击+10%'},
    archer:{name:'弓兵',race:'精灵',row:'back',icon:'archer',
      cost:{wood:80,stone:20,food:30}, upkeep:0.1, trainTime:1, atk:8,def:8,spd:12, passive:'基础MISS20%，打骑兵MISS50%'},
    cavalry:{name:'骑兵',race:'兽人',row:'front',icon:'cavalry',
      cost:{wood:40,stone:30,food:80}, upkeep:0.15, trainTime:1, atk:10,def:15,spd:14, passive:'闪避10%'},
    spearman:{name:'长矛兵',race:'人类',row:'front',icon:'spearman',
      cost:{wood:30,stone:60,food:40}, upkeep:0.15, trainTime:1, atk:7,def:10,spd:10, passive:'暴击10%'},
    mage:{name:'法师',race:'亡灵',row:'back',icon:'mage',
      cost:{wood:80,stone:60,food:80}, upkeep:0.3, trainTime:1, atk:15,def:8,spd:8, passive:'互易伤1.3x',locked:true}
  },

  // 克制关系
  counters: {
    infantry:{spearman:1.3,archer:1.3,cavalry:1.3,infantry:1.3,mage:1.0},// 步兵
    archer:{infantry:1.3,spearman:1.3,cavalry:1.0,archer:1.3,mage:1.0},// 弓兵
    cavalry:{infantry:1.3,archer:1.5,spearman:0.7,cavalry:1.0,mage:1.0},// 骑兵
    spearman:{cavalry:1.5,infantry:1.0,archer:1.0,spearman:1.0,mage:1.0},// 长矛兵
    mage:{infantry:1.3,archer:1.3,cavalry:1.3,spearman:1.3,mage:1.3}// 法师
  },

  // 命中率
  miss: {
    archer:{base:0.2,cavalry:0.5}
  },
  normalVsMage:1.3,

  // 战术
  tactics: {
    steady:{name:'稳扎稳打',desc:'防御+15% 速度-10%',defPct:.15,atkPct:0,spdPct:-.1,backPct:0,heal:0},
    assault:{name:'全军突击',desc:'攻击+20% 防御-10%',defPct:-.1,atkPct:.2,spdPct:0,backPct:0,heal:0},
    range:{name:'远程压制',desc:'后排伤害+15% 前排防-5%',defPct:0,atkPct:0,spdPct:0,backPct:.15,heal:0},
    attrition:{name:'消耗战',desc:'每回合回复5% 速-5%',defPct:.05,atkPct:0,spdPct:-.05,backPct:0,heal:.05}
  },

  // 关卡配置见 levels.js

  // ==================== 建筑配置 ====================
  buildings: {
    lumber_mill:{name:'伐木场',buffRes:'wood',buffBase:0.15,buffPerLv:0.2, build:{wood:200,stone:100,food:40,time:4}, upBase:{wood:6000,stone:5000,food:3000}, upCostLv:2},
    quarry:{name:'采石场',buffRes:'stone',buffBase:0.15,buffPerLv:0.2, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:5000,stone:6000,food:3000}, upCostLv:2},
    farm:{name:'农田',buffRes:'food',buffBase:0.15,buffPerLv:0.2, build:{wood:80,stone:80,food:200,time:4}, upBase:{wood:5000,stone:5000,food:8000}, upCostLv:2},
    barracks:{name:'营帐',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:2200,stone:1800,food:1000}, upCostLv:1.85},
    infantry_camp:{name:'步兵营地',trains:'infantry',unitCapBase:4,unitCapPerLv:2,build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1000,stone:1000,food:800},upCostLv:1.1},
    archer_range:{name:'射手靶场',trains:'archer',unitCapBase:2,unitCapPerLv:2,build:{wood:240,stone:100,food:100,time:6},upBase:{wood:1000,stone:1000,food:850},upCostLv:1.1},
    stable:{name:'骑兵训练场',trains:'cavalry',unitCapBase:1,unitCapPerLv:1,needBoss:1,build:{wood:220,stone:160,food:180,time:7},upBase:{wood:1500,stone:1500,food:1000},upCostLv:1.2},
    spear_crypt:{name:'长矛兵营地',trains:'spearman',unitCapBase:1,unitCapPerLv:1,needBoss:2,build:{wood:160,stone:240,food:100,time:7},upBase:{wood:1500,stone:2000,food:1000},upCostLv:1.2},
    mage_tower:{name:'法师塔',trains:'mage',unitCapBase:1,unitCapPerLv:1,needBoss:2,build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3000,stone:3000,food:2000},upCostLv:1.3},
    warehouse:{name:'仓库',storageBase:5000,storagePerLv:2500,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:1000,stone:1000,food:1000},upCostLv:1.3}
  },

  // 建筑升级上限倍率（基于城镇等级，修改这里即可调整所有建筑的升级限制）
  // barracks: 营帐上限 = 城镇等级 × 此值
  // warehouse: 仓库上限 = 城镇等级 × 此值
  // training: 兵营建筑上限（步兵/弓兵/骑兵/矛兵/法师）= 城镇等级 × 此值
  // resource: 资源建筑上限（伐木场/采石场/农田）= 城镇等级 × 此值（同时受章节 Boss 限制）
  buildingCaps: {
    barracks: 1,
    warehouse: 5,
    training: 10,
    resource: 1
  },

  // 建筑升级时间（秒），不受 upCostLv 倍率影响，线性增长
  // cap1Base/cap1PerLv: cap=1 建筑（营帐/资源建筑）及城镇使用
  // otherBase/otherPerLv: 其他建筑（仓库/兵营建筑）使用
  // 公式: 时间 = base + 当前等级 * perLv
  buildingTimes: {
    cap1Base: 90,
    cap1PerLv: 60,
    otherBase: 10,
    otherPerLv: 1
  }
};
