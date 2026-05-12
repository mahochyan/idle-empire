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

  // 建筑
  buildings: {
    lumber_mill:{name:'伐木场',buffRes:'wood',buffBase:0.15,buffPerLv:0.2, build:{wood:150,stone:80,food:50,time:4}, upBase:{wood:800,stone:500,food:300}, upCostLv:1.45},
    quarry:{name:'采石场',buffRes:'stone',buffBase:0.15,buffPerLv:0.2, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:500,stone:800,food:300}, upCostLv:1.45},
    farm:{name:'农田',buffRes:'food',buffBase:0.15,buffPerLv:0.2, build:{wood:80,stone:40,food:120,time:4}, upBase:{wood:600,stone:300,food:800}, upCostLv:1.45},
    barracks:{name:'营帐',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:2200,stone:1800,food:1000}, upCostLv:1.85},
    infantry_camp:{name:'步兵营地',trains:'infantry',unitCap:[0,4,6,8,10,12,14,16,18,20],build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1600,stone:1000,food:800},upCostLv:1.7},
    archer_range:{name:'射手靶场',trains:'archer',unitCap:[0,3,5,7,9,11,13,15,17,19],build:{wood:240,stone:100,food:100,time:6},upBase:{wood:2000,stone:1000,food:1000},upCostLv:1.75},
    stable:{name:'骑兵训练场',trains:'cavalry',unitCap:[0,2,3,4,5,6,7,8,9,10],needBoss:1,build:{wood:220,stone:160,food:180,time:7},upBase:{wood:2000,stone:1500,food:1600},upCostLv:1.8},
    spear_crypt:{name:'长矛兵营地',trains:'spearman',unitCap:[0,2,3,4,5,6,7,8,9,10],needBoss:2,build:{wood:160,stone:240,food:100,time:7},upBase:{wood:1400,stone:2200,food:1000},upCostLv:1.8},
    mage_tower:{name:'法师塔',trains:'mage',unitCap:[0,2,3,4,5,6,7,8,9,10],needBoss:2,build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3800,stone:3800,food:2800},upCostLv:1.9},
    warehouse:{name:'仓库',storageBase:5000,storagePerLv:4000,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:1600,stone:1600,food:800},upCostLv:1.45}
  },

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

  // 敌人配置
  enemies: [
    // === 第一章：仅步兵+弓兵 (0 Boss) ===
    {id:1,name:'侦察兵小队',desc:'步兵试探，教学关',units:{infantry:[5,3]},reward:{wood:120,stone:90,food:80}},
    {id:2,name:'弓兵巡逻队',desc:'步弓混编，考验前后排',units:{infantry:[5,4],archer:[4,3]},reward:{wood:200,stone:150,food:130}},
    {id:3,name:'步兵方阵',desc:'重步兵推进',units:{infantry:[7,6,4]},reward:{wood:280,stone:200,food:180}},
    {id:99,name:'守关校尉',desc:'BOSS·步弓混编重兵',units:{infantry:[10,8,6],archer:[7,5]},boss:true,bossMult:{atk:1.3,def:1.25},reward:{wood:800,stone:600,food:500}},
    // === 第二章：解锁骑兵 (1 Boss) ===
    {id:4,name:'骑兵侦察队',desc:'骑兵出现，步兵前排抵御',units:{cavalry:[8,6],infantry:[8]},reward:{wood:350,stone:280,food:230}},
    {id:5,name:'骑步混编',desc:'骑兵冲击后排，布好前排',units:{cavalry:[10,8],infantry:[9],archer:[6,5]},reward:{wood:450,stone:350,food:300}},
    {id:98,name:'骑兵统领',desc:'BOSS·骑兵主力，枪兵克制',units:{cavalry:[14,12],infantry:[12],archer:[10,8,6]},boss:true,bossMult:{atk:1.35,def:1.3},reward:{wood:1000,stone:800,food:700}},
    // === 第三章：解锁枪兵+法师 (2 Boss) ===
    {id:6,name:'长矛兵方阵',desc:'长矛兵出现，反骑破甲',units:{spearman:[10,8],infantry:[8],archer:[6]},reward:{wood:550,stone:480,food:400}},
    {id:7,name:'法师小队',desc:'法师高伤脆皮，骑兵切后',units:{mage:[8,6],infantry:[9,7],spearman:[7]},reward:{wood:650,stone:550,food:480}},
    {id:97,name:'混编将军',desc:'BOSS·多兵种协同破阵',units:{infantry:[14],archer:[12,10],cavalry:[12],spearman:[12],mage:[10]},boss:true,bossMult:{atk:1.4,def:1.35},reward:{wood:1300,stone:1100,food:950}}
  ]};
