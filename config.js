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
      cost:{wood:50,stone:20,food:40}, upkeep:0.1, trainTime:1, atk:6,def:10,spd:10, passive:'攻击+10%'},
    archer:{name:'弓兵',race:'精灵',row:'back',icon:'archer',
      cost:{wood:80,stone:20,food:30}, upkeep:0.2, trainTime:1, atk:8,def:8,spd:12, passive:'基础MISS20%，打骑兵MISS50%'},
    cavalry:{name:'骑兵',race:'兽人',row:'front',icon:'cavalry',
      cost:{wood:40,stone:30,food:80}, upkeep:0.2, trainTime:1, atk:10,def:15,spd:14, passive:'闪避10%'},
    spearman:{name:'长矛兵',race:'人类',row:'front',icon:'spearman',
      cost:{wood:30,stone:60,food:40}, upkeep:0.1, trainTime:1, atk:7,def:10,spd:10, passive:'暴击10%'},
    mage:{name:'法师',race:'亡灵',row:'back',icon:'mage',
      cost:{wood:80,stone:60,food:80}, upkeep:0.4, trainTime:1, atk:15,def:8,spd:8, passive:'互易伤1.3x',locked:true}
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
};
