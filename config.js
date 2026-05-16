// ==================== 游戏配置 ====================
// 独立配置文件，方便数值测试和调整
const CFG = {
  tickMs: 1000,                       // 游戏主循环间隔（毫秒）
  maxUpgradeTime: 120,                // 建筑升级最大时间（秒）
  queueMultiplier: 3,                 // 训练队列上限 = 训练上限 × 此值
  popFoodCost: 0.1,                   // 每个村民每秒消耗的食物
  unitTrainTime: 0.5,                 // 所有兵种统一训练时间（秒/人）
  battleStepDelay: 840,               // 战斗回合内每步动画延迟（ms，除以 battleSpeed）
  battleRoundDelay: 525,              // 战斗回合间延迟（ms，除以 battleSpeed）
  defaultBattleSpeed: 2,              // 默认战斗倍速

  // 资源定义
  res: {
    wood:{name:'木材',icon:'wood',basePerPop:1},
    stone:{name:'石料',icon:'stone',basePerPop:1},
    food:{name:'食物',icon:'food',basePerPop:0.75},
    tech:{name:'科技点',icon:'tech',basePerPop:0}
  },

  // 精魄道具（Boss掉落，用于T2/T3兵种解锁）
  essences: {
    shield_essence:{name:'盾卫精魄',icon:'shield_essence'},
    spear_essence:{name:'矛卫精魄',icon:'spear_essence'},
    sword_essence:{name:'剑士精魄',icon:'sword_essence'},
    bow_essence:{name:'弓手精魄',icon:'bow_essence'},
    crossbow_essence:{name:'弩手精魄',icon:'crossbow_essence'},
    blade_essence:{name:'刺客精魄',icon:'blade_essence'},
    wind_essence:{name:'疾风精魄',icon:'wind_essence'},
    iron_essence:{name:'铁壁精魄',icon:'iron_essence'}
  },

  // 城镇等级（击败指定Boss关卡解锁）
  town: [
    {lv:1, name:'小村庄', maxPop:10, needBossId:0},
    {lv:2, name:'村庄',   maxPop:20, needBossId:10},
    {lv:3, name:'大村庄', maxPop:30, needBossId:20},
    {lv:4, name:'小镇',   maxPop:40, needBossId:30},
    {lv:5, name:'城镇',   maxPop:50, needBossId:40},
    {lv:6, name:'大城镇', maxPop:60, needBossId:50},
    {lv:7, name:'小城',   maxPop:70, needBossId:60},
    {lv:8, name:'城市',   maxPop:80, needBossId:70},
    {lv:9, name:'大城',   maxPop:95, needBossId:80},
    {lv:10,name:'王都',   maxPop:110,needBossId:90}
  ],

  // 兵种训练上限（公式：base + 建筑等级 × perLv）
  unitCaps: {
    infantry: {base:10, perLv:5},   // 步兵营地
    archer:   {base:10, perLv:3},   // 弓兵营地
    cavalry:  {base:5, perLv:2},   // 骑兵训练场
    mage:     {base:0, perLv:1}    // 法师塔
  },

  // 兵种
  units: {
    // 步兵升级线 T1~T3（科技树解锁）
    infantry:{name:'农民',race:'人类',row:'front',icon:'infantry_t0',
      cost:{wood:30,stone:10,food:20}, upkeep:0.03, atk:4,def:8,spd:9, passive:'基础步兵', tier:0, baseUnit:'infantry'},
    infantry_t1:{name:'民兵',race:'人类',row:'front',icon:'infantry_t1',tier:1,baseUnit:'infantry',tag:'infantry',
      cost:{wood:80,stone:40,food:60}, upkeep:0.08, atk:8,def:12,spd:10, passive:'攻击+10%', locked:true},
    infantry_shield:{name:'重盾手',race:'人类',row:'front',icon:'infantry_shield',tier:2,baseUnit:'infantry',tag:'shield',
      cost:{wood:100,stone:80,food:60}, upkeep:0.12, atk:6,def:18,spd:7, passive:'格挡20%', locked:true},
    infantry_spear:{name:'长矛扈从',race:'人类',row:'front',icon:'infantry_spear',tier:2,baseUnit:'infantry',tag:'spear',
      cost:{wood:80,stone:60,food:80}, upkeep:0.12, atk:9,def:12,spd:11, passive:'反制剑系1.3x', locked:true},
    infantry_sword:{name:'双手剑士',race:'人类',row:'front',icon:'infantry_sword',tier:2,baseUnit:'infantry',tag:'sword',
      cost:{wood:60,stone:40,food:100}, upkeep:0.12, atk:13,def:9,spd:10, passive:'破盾1.3x', locked:true},
    infantry_fortress:{name:'堡垒巨盾',race:'人类',row:'front',icon:'infantry_fortress',tier:3,baseUnit:'infantry',tag:'shield',
      cost:{wood:150,stone:120,food:80}, upkeep:0.18, atk:8,def:24,spd:7, passive:'格挡25%+每回合回复5%HP', locked:true},
    infantry_ironrose:{name:'铁玫瑰',race:'人类',row:'front',icon:'infantry_ironrose',tier:3,baseUnit:'infantry',tag:'spear',
      cost:{wood:120,stone:90,food:100}, upkeep:0.18, atk:12,def:15,spd:12, passive:'反制剑系1.5x+暴击10%', locked:true},
    infantry_bloodrose:{name:'血蔷薇',race:'人类',row:'front',icon:'infantry_bloodrose',tier:3,baseUnit:'infantry',tag:'sword',
      cost:{wood:100,stone:70,food:130}, upkeep:0.18, atk:18,def:11,spd:11, passive:'破盾1.5x+攻击+15%', locked:true},
    // 猎人升级线 T1~T3（科技树解锁）
    archer:{name:'猎人',race:'精灵',row:'back',icon:'archer_t0', tier:0, baseUnit:'archer',
      cost:{wood:80,stone:20,food:30}, upkeep:0.1, atk:8,def:8,spd:12, passive:'基础MISS20%，打骑兵MISS50%'},
    archer_t1:{name:'游侠',race:'精灵',row:'back',icon:'archer_t1',tier:1,baseUnit:'archer',tag:'archer',
      cost:{wood:120,stone:40,food:50}, upkeep:0.14, atk:12,def:10,spd:13, passive:'攻击+10%', locked:true},
    archer_silverbow:{name:'银弓猎手',race:'精灵',row:'back',icon:'archer_silverbow',tier:2,baseUnit:'archer',tag:'bow',
      cost:{wood:160,stone:50,food:80}, upkeep:0.18, atk:16,def:10,spd:14, passive:'远程精准+15%', locked:true},
    archer_crossbow:{name:'重弩手',race:'精灵',row:'back',icon:'archer_crossbow',tier:2,baseUnit:'archer',tag:'crossbow',
      cost:{wood:140,stone:100,food:80}, upkeep:0.18, atk:14,def:14,spd:9, passive:'破甲射击1.3x', locked:true},
    archer_assassin:{name:'双刃刺客',race:'精灵',row:'back',icon:'archer_assassin',tier:2,baseUnit:'archer',tag:'blade',
      cost:{wood:120,stone:60,food:100}, upkeep:0.18, atk:12,def:8,spd:17, passive:'闪避15%+暴击10%', locked:true},
    archer_longbow:{name:'不列颠长弓手',race:'精灵',row:'back',icon:'archer_longbow',tier:3,baseUnit:'archer',tag:'bow',
      cost:{wood:220,stone:80,food:120}, upkeep:0.24, atk:22,def:12,spd:14, passive:'远程精准+25%+射程压制', locked:true},
    archer_genoese:{name:'热那亚劲弩',race:'精灵',row:'back',icon:'archer_genoese',tier:3,baseUnit:'archer',tag:'crossbow',
      cost:{wood:180,stone:150,food:120}, upkeep:0.24, atk:18,def:18,spd:9, passive:'破甲射击1.5x+重装', locked:true},
    archer_shadowblade:{name:'幽影刃侍',race:'精灵',row:'back',icon:'archer_shadowblade',tier:3,baseUnit:'archer',tag:'blade',
      cost:{wood:150,stone:90,food:150}, upkeep:0.24, atk:15,def:10,spd:19, passive:'闪避20%+暴击15%', locked:true},
    
    // 骑兵升级线 （科技树解锁）
    cavalry_t1:{name:'侍从骑士',race:'兽人',row:'front',icon:'cavalry_t1',tier:1,baseUnit:'cavalry',tag:'cavalry',
      cost:{wood:120,stone:80,food:150}, upkeep:0.18, atk:15,def:18,spd:16, passive:'冲锋+10%', locked:true},
    cavalry_wind:{name:'猎风弩骑',race:'兽人',row:'front',icon:'cavalry_wind',tier:2,baseUnit:'cavalry',tag:'wind',
      cost:{wood:160,stone:100,food:180}, upkeep:0.22, atk:18,def:15,spd:18, passive:'远程射击+暴击10%', locked:true},
    cavalry_iron:{name:'重装骑士',race:'兽人',row:'front',icon:'cavalry_iron',tier:2,baseUnit:'cavalry',tag:'iron',
      cost:{wood:120,stone:160,food:150}, upkeep:0.22, atk:14,def:22,spd:12, passive:'格挡20%', locked:true},
    cavalry_dragon:{name:'破晓龙息',race:'兽人',row:'front',icon:'cavalry_dragon',tier:3,baseUnit:'cavalry',tag:'dragon',
      cost:{wood:200,stone:150,food:220}, upkeep:0.28, atk:24,def:18,spd:18, passive:'龙息1.3x+暴击15%', locked:true},
    cavalry_teutonic:{name:'条顿骑士',race:'兽人',row:'front',icon:'cavalry_teutonic',tier:3,baseUnit:'cavalry',tag:'teutonic',
      cost:{wood:180,stone:200,food:180}, upkeep:0.28, atk:18,def:26,spd:10, passive:'重甲格挡25%+反击', locked:true},
    spearman:{name:'长矛兵',race:'人类',row:'front',icon:'spearman',tier:0,baseUnit:'spearman',
      cost:{wood:30,stone:60,food:40}, upkeep:0.15, atk:7,def:10,spd:10, passive:'暴击10%',locked:true},
    // 法师升级线 T1~T3（科技树解锁，类似骑兵线）
    mage_t1:{name:'魔法学徒',race:'人类',row:'back',icon:'mage_t1',tier:1,baseUnit:'mage',tag:'mage',
      cost:{wood:100,stone:60,food:100}, upkeep:0.2, atk:12,def:6,spd:8, passive:'基础法师',locked:true},
    mage_time:{name:'时序术士',race:'人类',row:'back',icon:'mage_time',tier:2,baseUnit:'mage',tag:'time',
      cost:{wood:150,stone:100,food:150}, upkeep:0.25, atk:16,def:8,spd:11, passive:'60%时锁 敌人跳过下回合',locked:true},
    mage_space:{name:'虚空术士',race:'人类',row:'back',icon:'mage_space',tier:2,baseUnit:'mage',tag:'space',
      cost:{wood:130,stone:120,food:160}, upkeep:0.25, atk:14,def:7,spd:9, passive:'AOE溅射1目标50%伤害',locked:true},
    mage_chrono:{name:'万古之瞳',race:'人类',row:'back',icon:'mage_chrono',tier:3,baseUnit:'mage',tag:'time',
      cost:{wood:220,stone:150,food:200}, upkeep:0.32, atk:22,def:10,spd:13, passive:'85%时锁 敌人跳过下回合',locked:true},
    mage_merlin:{name:'梅林贤者',race:'人类',row:'back',icon:'mage_merlin',tier:3,baseUnit:'mage',tag:'space',
      cost:{wood:180,stone:180,food:220}, upkeep:0.32, atk:20,def:9,spd:10, passive:'AOE溅射2目标60%伤害',locked:true}
  },

  // 克制关系
  counters: {
    infantry:{archer:1.3,cavalry:1.3,infantry:1.3,mage:1.0},// 步兵
    archer:{infantry:1.3,cavalry:1.0,archer:1.3,mage:1.0},// 弓兵
    cavalry:{infantry:1.3,archer:1.5,cavalry:1.0,mage:1.0},// 骑兵
    mage:{infantry:1.3,archer:1.3,cavalry:1.3,mage:1.3}// 法师
  },

  // 命中率
  miss: {
    archer:{base:0.2,cavalry:0.5}
  },
  normalVsMage:1.3,

  // ================================================================
  // 二级克制矩阵 innerCounters（ATK tag × DEF tag，双方有tag时优先使用）
  //
  // ATK\DEF |无tag|步兵|弓兵|骑兵|大盾|长枪| 剑 | 弓 | 弩 | 刃 |疾风|铁壁|龙息|条顿
  // ---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----
  //   无tag  | 1.3 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1 | 1.1
  //   步兵   | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //   弓兵   | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //   骑兵   | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //   大盾   | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.3 | 0.7 | 1.0 | 1.0 | 1.0 | 1.0 | 0.7 | 1.0 | 0.7
  //   长枪   | 1.3 | 1.3 | 1.0 | 1.0 | 0.7 | 1.0 | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.5 | 1.0 | 1.5
  //    剑    | 1.3 | 1.3 | 1.0 | 1.0 | 1.3 | 0.7 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.7 | 1.0 | 0.7
  //    弓    | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //    弩    | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //    刃    | 1.3 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0
  //   疾风   | 1.3 | 1.2 | 1.0 | 1.2 | 1.5 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.7 | 1.0 | 0.7
  //   铁壁   | 1.5 | 1.5 | 1.0 | 1.5 | 1.5 | 0.7 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.0 | 1.0 | 1.0
  //   龙息   | 1.3 | 1.3 | 1.0 | 1.3 | 1.5 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.3 | 1.0 | 1.0 | 1.0
  //   条顿   | 1.5 | 1.5 | 1.0 | 1.5 | 1.5 | 0.7 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.0 | 1.0 | 1.0
  //
  // 结算规则（cm函数）：
  //   双方有tag → 只用上表 innerCounters
  //   仅ATK有tag → _default || fallback到counters
  //   仅DEF有tag → innerNoTagDef(0.85) × counters
  //   双方无tag → 纯counters
  // ================================================================
  innerCounters: {
    shield:{shield:1.0,spear:1.3,sword:0.7,infantry:1.0,iron:0.7,teutonic:0.7},
    spear:{shield:0.7,spear:1.0,sword:1.3,infantry:1.3,iron:1.5,teutonic:1.5},
    sword:{shield:1.3,spear:0.7,sword:1.0,infantry:1.3,iron:0.7,teutonic:0.7},
    wind:{wind:1.0,iron:0.7,teutonic:0.7,infantry:1.2,cavalry:1.2,shield:1.5,spear:1.0,sword:1.0,dragon:1.0,bow:1.0,crossbow:1.0,blade:1.0},
    iron:{wind:1.5,iron:1.0,teutonic:1.0,infantry:1.5,cavalry:1.5,shield:1.5,spear:0.7,sword:1.5,dragon:1.0,bow:1.5,crossbow:1.5,blade:1.5,_default:1.5},
    dragon:{wind:1.3,iron:1.0,teutonic:1.0,infantry:1.3,cavalry:1.3,shield:1.5,spear:1.0,sword:1.0,bow:1.0,crossbow:1.0,blade:1.0},
    teutonic:{wind:1.5,iron:1.0,teutonic:1.0,infantry:1.5,cavalry:1.5,shield:1.5,spear:0.7,sword:1.5,dragon:1.0,bow:1.5,crossbow:1.5,blade:1.5,_default:1.5},
    time:{wind:1.0,iron:0.7,teutonic:0.7,infantry:1.2,cavalry:1.2,shield:1.0,spear:1.0,sword:1.0,dragon:1.0,bow:1.0,crossbow:1.0,blade:1.0,space:1.3,_default:1.1},
    space:{wind:1.0,iron:1.5,teutonic:1.5,infantry:1.0,cavalry:1.0,shield:1.3,spear:1.3,sword:1.0,dragon:1.0,bow:1.0,crossbow:1.0,blade:1.0,time:0.7,_default:1.1},
    mage:{wind:1.0,iron:1.0,teutonic:1.0,infantry:1.0,cavalry:1.0,shield:1.0,spear:1.0,sword:1.0,_default:1.0}
  },
  // 无 tag 单位受 tag 单位攻击时的倍率（T0/T1步兵无tag，被剑矛克制）
  innerNoTagDef:0.85,

  // 猎人线特殊战斗机制（替代innerCounters）
  // bow(弓)：攻击盾兵80%被格挡无伤；攻击骑兵时50%miss
  // crossbow(弩)：攻击盾兵时穿透造成80%伤害
  // blade(刃)：攻击远程单位+60%伤害；攻击盾兵60%伤害；可在中排发动进攻
  archerSpecials: {
    bow: {
      attack: { vsShield: { block: 0.8 }, vsCavalry: { miss: 0.5 } }
    },
    crossbow: {
      attack: { vsShield: { dmgPct: 0.8 } }
    },
    blade: {
      attack: { vsRanged: { dmgPct: 1.6 }, vsShield: { dmgPct: 0.6 } },
      row: 'mid'
    }
  },

  // 法师线特殊战斗机制
  // time(时序)：攻击时概率附加时锁，目标跳过下次行动
  // space(虚空)：攻击时溅射相邻敌人
  mageSpecials: {
    time: {
      attack: { timeLockChance: 0.6 }
    },
    space: {
      attack: { aoeTargets: 1, aoeDmgPct: 0.5 }
    }
  },

  // 战术
  tactics: {
    steady:{name:'稳扎稳打',desc:'防御+15% 速度-10%',defPct:.15,atkPct:0,spdPct:-.1,backPct:0,heal:0},
    assault:{name:'全军突击',desc:'攻击+20% 防御-10%',defPct:-.1,atkPct:.2,spdPct:0,backPct:0,heal:0},
    range:{name:'远程压制',desc:'后排伤害+15% 前排防-5%',defPct:0,atkPct:0,spdPct:0,backPct:.15,heal:0},
    attrition:{name:'消耗战',desc:'每回合回复5% 速-5%',defPct:.05,atkPct:0,spdPct:-.05,backPct:0,heal:.05}
  },

  // 关卡配置见 levels.js

  // 兵种升级树见 technology.js

  // ==================== 建筑配置 ====================
  //当前仓库50级最大上限为380000
  //
  buildings: {
    lumber_mill:{name:'伐木场',buffRes:'wood',buffBase:0.20,buffPerLv:0.25, build:{wood:200,stone:100,food:40,time:4}, upBase:{wood:6000,stone:5000,food:2500}, upCostLv:1.5},
    quarry:{name:'采石场',buffRes:'stone',buffBase:0.20,buffPerLv:0.25, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:5000,stone:6000,food:2500}, upCostLv:1.5},
    farm:{name:'农田',buffRes:'food',buffBase:0.20,buffPerLv:0.25, build:{wood:80,stone:80,food:200,time:4}, upBase:{wood:5000,stone:5000,food:6000}, upCostLv:1.5},
    barracks:{name:'营帐',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:1800,stone:1800,food:1000}, upCostLv:1.7},
    infantry_camp:{name:'步兵营地',trains:'infantry',tier:0,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:500,stone:300,food:200},time:20},
        {needBossId:20, cost:{wood:2000,stone:1500,food:1000},time:45},
        {needBossId:40, cost:{wood:8000,stone:9000,food:5200},time:90},
        {needBossId:65, cost:{wood:20000,stone:20000,food:15000},time:150}
      ],build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1000,stone:1000,food:800},upCostLv:1.1},
    archer_range:{name:'弓兵营地',trains:'archer',tier:0,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:600,stone:300,food:200},time:20},
        {needBossId:20, cost:{wood:2500,stone:1500,food:1200},time:45},
        {needBossId:40, cost:{wood:8000,stone:8000,food:5000},time:90},
        {needBossId:65, cost:{wood:13000,stone:11000,food:8000},time:150}
      ],build:{wood:240,stone:100,food:100,time:6},upBase:{wood:1000,stone:1000,food:850},upCostLv:1.1},
    stable:{name:'骑兵训练场',trains:'cavalry',tier:1,needBoss:1,
      tierUpgrade:[
        {needBossId:20, cost:{wood:2500,stone:2000,food:2000},time:45},
        {needBossId:40, cost:{wood:8000,stone:8000,food:5000},time:90},
        {needBossId:65, cost:{wood:12000,stone:10000,food:7000},time:150}
      ],build:{wood:220,stone:160,food:180,time:7},upBase:{wood:1000,stone:1000,food:1000},upCostLv:1.12},
    mage_tower:{name:'法师塔',trains:'mage',unitCapBase:1,unitCapPerLv:1,tier:1,needBoss:4,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:800,stone:800,food:600},time:30},
        {needBossId:20, cost:{wood:5000,stone:5000,food:3000},time:60},
        {needBossId:40, cost:{wood:9000,stone:11000,food:5000},time:120},
        {needBossId:65, cost:{wood:22000,stone:25000,food:10000},time:180}
      ],build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3000,stone:3000,food:2000},upCostLv:1.1},
    warehouse:{name:'仓库',storageBase:10000,storagePerLv:10000,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:3000,stone:3000,food:3000},upCostLv:1.3},
    arrow_tower:{name:'箭塔',desc:'城防建筑，驻军战斗中对敌人自动射击',build:{wood:400,stone:350,food:150,time:10},upBase:{wood:1500,stone:1500,food:1000},upCostLv:1.2},
    
  },

  // 建筑升级上限倍率（基于城镇等级，修改这里即可调整所有建筑的升级限制）
  // 匹配规则见 math.js upgradeLockReason()：trains→training, storagePerLv→warehouse, buffRes→resource, 其余→barracks
  // barracks : 营帐、箭塔 — 上限 = 城镇等级 × 此值   MAX10
  // warehouse: 仓库 — 上限 = 城镇等级 × 此值        MAX50
  // training : 步兵营地/射手靶场/骑兵训练场/法师塔 — 上限 = 城镇等级 × 此值   MAX50
  // resource : 伐木场/采石场/农田 — 上限 = 城镇等级 × 此值   MAX10
  buildingCaps: {
    barracks: 1,
    warehouse: 5,
    training: 5,
    resource: 1
  },

  // 建筑升级时间（秒），不受 upCostLv 倍率影响，线性增长
  // cap1Base/cap1PerLv: cap=1 建筑（营帐/资源建筑）及城镇使用
  // otherBase/otherPerLv: 其他建筑（仓库/兵营建筑）使用
  // 公式: 时间 = base + 当前等级 * perLv
  buildingTimes: {
    cap1Base: 30,
    cap1PerLv: 10,
    otherBase: 10,
    otherPerLv: 1
  }
};
