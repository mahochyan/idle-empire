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
    tech:{name:'科技点',icon:'tech',basePerPop:0,type:'science',max:500,maxPerLv:200,desc:'学院产出，研究科技与兵种'},
    // IE-007 新增：放置类型体系（basic=村民产出/passive=建筑被动产出/currency=软通货/material=材料/science=科技点）
    copper:{name:'铜',icon:'copper',type:'passive',max:2000,maxPerLv:500,desc:'矿井产出，冶炼厂原料'},
    iron:{name:'铁',icon:'iron',type:'passive',max:1500,maxPerLv:400,desc:'冶炼厂炼铜所得，高等级消耗'},
    coin:{name:'金币',icon:'coin',type:'currency',max:5000,maxPerLv:1000,desc:'铸币厂铸造，市场兑换'},
    // S8c（用户裁决 D2「加入地契」）：新增地契资源 —— 城镇升级凭据；来源＝市场兑换（金币→地契）
    deed:{name:'地契',icon:'deed',type:'currency',max:999999,maxPerLv:0,desc:'城镇升级凭据（市场兑换所得）'}
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
  // S8c（D2 地契）：城镇升级的「地契 + 科技点」门（候选值·待推演）；仅当 CFG.townGate.useDeed 开启时生效
  // 竞品对照：村庄/小镇/城市 需 地契 5/15/30 + 科技 城镇化(450010)/城市化(450012)；我方按 10 档递进
  townGate: {
    useDeed: true,
    cost: [
      {toLv:2,  deed:5,   tech:0},
      {toLv:3,  deed:15,  tech:100},
      {toLv:4,  deed:30,  tech:300},
      {toLv:5,  deed:60,  tech:800},
      {toLv:6,  deed:100, tech:1800},
      {toLv:7,  deed:160, tech:3000},
      {toLv:8,  deed:240, tech:5000},
      {toLv:9,  deed:360, tech:8000},
      {toLv:10, deed:520, tech:12000}
    ]
  },

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
      cost:{wood:100,stone:60,food:100}, upkeep:0.2, atk:12,def:6,spd:8, passive:'法师互易伤1.3x',locked:true},
    mage_time:{name:'时序术士',race:'人类',row:'back',icon:'mage_time',tier:2,baseUnit:'mage',tag:'time',
      cost:{wood:150,stone:100,food:150}, upkeep:0.25, atk:16,def:8,spd:11, passive:'【攻击】时锁40%：命中后概率使目标跳过下回合\n时光回声30%：伤害的30%在下回合初再次释放\n【防御】时光折射20%：概率预见未来闪避攻击\n【固有】时序疾行：每回合速度+15%（可累积）\n时光倒流：击杀目标后回复30%HP',locked:true},
    mage_space:{name:'虚空术士',race:'人类',row:'back',icon:'mage_space',tier:2,baseUnit:'mage',tag:'space',
      cost:{wood:130,stone:120,food:160}, upkeep:0.25, atk:14,def:7,spd:9, passive:'【攻击】虚空溅射：对相邻1个目标造成50%溅射伤害\n穿甲：攻击忽略目标20%防御\n【防御】空间扭曲20%：被攻击时概率将伤害转移给随机敌人\n裂隙反伤15%：被攻击时反弹伤害\n【固有】虚空护盾：开场获得20%最大HP护盾',locked:true},
    mage_chrono:{name:'万古之瞳',race:'人类',row:'back',icon:'mage_chrono',tier:3,baseUnit:'mage',tag:'time',
      cost:{wood:220,stone:150,food:200}, upkeep:0.32, atk:22,def:10,spd:13, passive:'【攻击】时锁65%：命中后概率使目标跳过下回合\n时光回声50%：伤害的50%在下回合初再次释放\n【防御】时光折射30%：概率预见未来闪避攻击\n【固有】先制：每回合额外行动一次\n时序疾行：每回合速度+20%（可累积）\n时光倒流：击杀目标后回复50%HP',locked:true},
    mage_merlin:{name:'梅林贤者',race:'人类',row:'back',icon:'mage_merlin',tier:3,baseUnit:'mage',tag:'space',
      cost:{wood:180,stone:180,food:220}, upkeep:0.32, atk:20,def:9,spd:10, passive:'【攻击】虚空溅射：对相邻2个目标造成60%溅射伤害\n穿甲：攻击忽略目标35%防御\n次元打击15%：概率造成双倍伤害暴击\n【防御】空间扭曲30%：被攻击时概率将伤害转移给随机敌人\n裂隙反伤25%：被攻击时反弹伤害\n【固有】虚空护盾：开场获得30%最大HP护盾',locked:true}
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

  // 法师线特殊战斗机制（按单位key索引，支持不同Tier不同数值）
  // 时间系(时序)：时锁/时光折射/时序疾行/时光回声/先制/时光倒流
  // 空间系(虚空)：溅射/虚空护盾/伤害转移/穿甲/裂隙反伤/次元打击
  mageSpecials: {
    mage_time: {
      timeLock: { chance: 0.4 },
      temporalDodge: { chance: 0.2 },
      temporalHaste: { speedPct: 0.15 },
      temporalEcho: { dmgPct: 0.3 },
      rewind: { healPct: 0.3 }
    },
    mage_chrono: {
      timeLock: { chance: 0.65 },
      temporalDodge: { chance: 0.3 },
      temporalHaste: { speedPct: 0.2 },
      temporalEcho: { dmgPct: 0.5 },
      precognition: { extraAction: true },
      rewind: { healPct: 0.5 }
    },
    mage_space: {
      aoe: { targets: 1, dmgPct: 0.5 },
      voidShield: { hpPct: 0.2 },
      redirect: { chance: 0.2 },
      armorPierce: { defPct: 0.2 },
      riftReflect: { dmgPct: 0.15 }
    },
    mage_merlin: {
      aoe: { targets: 2, dmgPct: 0.6 },
      voidShield: { hpPct: 0.3 },
      redirect: { chance: 0.3 },
      armorPierce: { defPct: 0.35 },
      riftReflect: { dmgPct: 0.25 },
      dimensionalStrike: { critChance: 0.15 }
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
    lumber_mill:{name:'伐木场',type:'resource',buffRes:'wood',buffBase:0.20,buffPerLv:0.25, build:{wood:200,stone:100,food:40,time:4}, upBase:{wood:6000,stone:5000,food:2500}, upCostLv:1.5},
    quarry:{name:'采石场',type:'resource',buffRes:'stone',buffBase:0.20,buffPerLv:0.25, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:5000,stone:6000,food:2500}, upCostLv:1.5},
    farm:{name:'农田',type:'resource',buffRes:'food',buffBase:0.20,buffPerLv:0.25, build:{wood:80,stone:80,food:200,time:4}, upBase:{wood:5000,stone:5000,food:6000}, upCostLv:1.5},
    barracks:{name:'营帐',type:'barracks',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:1800,stone:1800,food:1000}, upCostLv:1.7},
    infantry_camp:{name:'步兵营地',type:'training',trains:'infantry',tier:0,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:500,stone:300,food:200},time:20},
        {needBossId:20, cost:{wood:2000,stone:1500,food:1000},time:45},
        {needBossId:40, cost:{wood:8000,stone:9000,food:5200},time:90},
        {needBossId:65, cost:{wood:20000,stone:20000,food:15000},time:150}
      ],build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1000,stone:1000,food:800},upCostLv:1.1},
    archer_range:{name:'弓兵营地',type:'training',trains:'archer',tier:0,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:600,stone:300,food:200},time:20},
        {needBossId:20, cost:{wood:2500,stone:1500,food:1200},time:45},
        {needBossId:40, cost:{wood:8000,stone:8000,food:5000},time:90},
        {needBossId:65, cost:{wood:13000,stone:11000,food:8000},time:150}
      ],build:{wood:240,stone:100,food:100,time:6},upBase:{wood:1000,stone:1000,food:850},upCostLv:1.1},
    stable:{name:'骑兵训练场',type:'training',trains:'cavalry',tier:1,needBoss:1,
      tierUpgrade:[
        {needBossId:5, cost:{wood:2500,stone:2000,food:2000},time:20},
        {needBossId:20, cost:{wood:8000,stone:8000,food:5000},time:45},
        {needBossId:40, cost:{wood:12000,stone:12000,food:8000},time:90}
      ],build:{wood:220,stone:160,food:180,time:7},upBase:{wood:1000,stone:1000,food:1000},upCostLv:1.12},
    mage_tower:{name:'法师塔',type:'training',trains:'mage',unitCapBase:1,unitCapPerLv:1,tier:1,needBoss:4,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:800,stone:800,food:600},time:30},
        {needBossId:20, cost:{wood:5000,stone:5000,food:3000},time:60},
        {needBossId:40, cost:{wood:9000,stone:11000,food:5000},time:120},
        {needBossId:65, cost:{wood:22000,stone:25000,food:10000},time:180}
      ],build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3000,stone:3000,food:2000},upCostLv:1.1},
    warehouse:{name:'仓库',type:'storage',storageBase:10000,storagePerLv:10000,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:3000,stone:3000,food:3000},upCostLv:1.3},
    arrow_tower:{name:'箭塔',type:'defense',desc:'城防建筑，驻军战斗中对敌人自动射击',build:{wood:400,stone:350,food:150,time:10},upBase:{wood:1500,stone:1500,food:1000},upCostLv:1.2},
    // ===== IE-007 新增：经济建筑（放置时代 矿井/冶铁厂/铸币厂/市场 对应，数值为保守起点值·待推演）=====
    mine:{name:'矿井',type:'production',needScience:'sci_copper',produces:{copper:2},desc:'被动产出铜（需研究冶铜术）',
      build:{wood:300,stone:500,food:200,time:8},upBase:{wood:2000,stone:3000,food:1500},upCostLv:1.15},
    smelter:{name:'冶炼厂',type:'production',needScience:'sci_iron',consumes:{copper:3},produces:{iron:1},desc:'消耗铜冶炼铁（需研究冶铁术；原料不足停产）',
      build:{wood:500,stone:600,food:300,time:10},upBase:{wood:3000,stone:4000,food:2500},upCostLv:1.15},
    mint:{name:'铸币厂',type:'production',needScience:'sci_coin',consumes:{food:5},produces:{coin:2},desc:'消耗食物铸造金币（需研究货币铸造；原料不足停产）',
      build:{wood:600,stone:400,food:500,time:12},upBase:{wood:3500,stone:3000,food:3000},upCostLv:1.15},
    market:{name:'市场',type:'utility',needScience:'sci_coin',desc:'金币兑换基础资源（需研究货币铸造；每日限制与多汇率由 IE-006 补齐）',
      build:{wood:400,stone:400,food:300,time:10},upBase:{wood:3000,stone:3000,food:2500},upCostLv:1.2},
    academy:{name:'学院',type:'science',produces:{tech:5},desc:'被动产出科技点（知识来源，初始即可建造）',
      build:{wood:150,stone:100,food:80,time:6},upBase:{wood:1000,stone:1000,food:800},upCostLv:1.1}
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
    resource: 1,
    production: 1,
    utility: 1
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
  },

  // ==================== 资源科技（对齐《放置时代》发展科技 45xxxx）====================
  // 对齐映射：冶铜术≈450009（铜）、冶铁术≈450011（铁）、货币铸造≈450609（货币）
  // 门控模型：纯科技门（科技点+战功），无击杀前置——对齐放置时代"资源/建筑=科技门"；战斗主线（城镇/营地tier）仍为击杀门（台账记录差异）
  sciences: {
    sci_copper:{name:'冶铜术',desc:'解锁矿井（铜矿开采）',cost:{tech:10,merit:0},unlocks:['mine']},
    sci_iron:{name:'冶铁术',desc:'解锁冶炼厂（铁冶炼）',cost:{tech:80,merit:10},need:['sci_copper'],unlocks:['smelter']},
    sci_coin:{name:'货币铸造',desc:'解锁铸币厂与市场',cost:{tech:200,merit:30},need:['sci_iron'],unlocks:['mint','market']}
  },

  // ==================== 资源科技·长阶梯（切片5 S2 · 用户"骨架拟合"指令）====================
  // 形态对齐：竞品 developScienceList 40+ 节点、跨度 200→1e13（11 个数量级）；我方节点 3→6、跨度 100→12000（≈2.1 个数量级）
  // 说明：跨度继续扩大依赖"时代内容"（皮），本轮只对齐"多步递进"的节奏形态；原始 CFG.sciences（3 节点）保留不动
  // 成本为【候选·待推演】，由 curve-sim 验证可达节奏；回滚＝CFG.tech.longLadder=false
  sciencesLong: {
    sci_prospect:{name:'探矿术',desc:'资源科技第一阶（勘矿）',cost:{tech:100,merit:0},unlocks:[]},
    sci_copper:{name:'冶铜术',desc:'解锁矿井（铜矿开采）',cost:{tech:300,merit:0},need:['sci_prospect'],unlocks:['mine']},
    sci_metal:{name:'冶金术',desc:'冶炼工艺基础',cost:{tech:800,merit:0},need:['sci_copper'],unlocks:[]},
    sci_iron:{name:'冶铁术',desc:'解锁冶炼厂（铁冶炼）',cost:{tech:1800,merit:0},need:['sci_metal'],unlocks:['smelter']},
    sci_mint:{name:'铸币术',desc:'铸造工艺基础',cost:{tech:5000,merit:0},need:['sci_iron'],unlocks:[]},
    sci_coin:{name:'货币铸造',desc:'解锁铸币厂与市场',cost:{tech:12000,merit:0},need:['sci_mint'],unlocks:['mint','market']}
  },

  // ==================== 市场（IE-007 交易所雏形）====================
  // 汇率：from 1 单位 → to rate 单位（向下取整）。往返乘积必须 <1（防套利，测试有断言）。
  // 每日次数/多汇率/刷新等机制由 IE-006 补齐，本字段为保守起点值·待推演。
  market: {
    multiRate: true,    // 切片13 已启用（C3 裁决）：多汇率 + 每日上限 + 转换损失（损失体现为买卖价差，往返乘积<1）
    dailyLimit: 5,      // 每日兑换次数上限（日界=本地 0 点，C4 裁决）
    rates: [
      {from:'coin',to:'wood',rate:8},
      {from:'coin',to:'stone',rate:6},
      {from:'wood',to:'coin',rate:0.1},
      {from:'stone',to:'coin',rate:0.14},
      // 切片13 新增（跨资源对；与既有价差共同构成"转换损失"，任一往返乘积 <1 → 无套利）
      {from:'coin',to:'food',rate:4},
      {from:'food',to:'coin',rate:0.08},
      {from:'wood',to:'stone',rate:0.6},
      {from:'stone',to:'wood',rate:0.5},
      {from:'wood',to:'food',rate:0.4},
      {from:'food',to:'wood',rate:0.2},
      // S8c（D2 地契）：金币→地契 100:1（往返 0.8 <1，无套利）
      {from:'coin',to:'deed',rate:0.01},
      {from:'deed',to:'coin',rate:80}
    ]
  },

  // ==================== 改造开关（切片2 基建 · 全部默认关闭 = 零行为变化）====================
  // 约定：每个后续切片用独立开关承载回滚；关闭时行为与改造前逐字段一致；参数级可运行时调整。
  offline: { enabled:true, ratio:0.6, capSec:86400, minSec:120, advance:true },   // 切片11 已启用：离线结算（0.6×/24h 封顶/<120s 不结）；advance 由切片12 使用；回滚＝false
  idem:    { enabled:true, windowMs:5000, max:200 },                                // 切片10 已启用：幂等层（同键 5s 内重复 → 返回既有结果、不重复扣费）；回滚＝false
  caps:    { expanded:true,   // 切片4 已启用：上限空间扩容（对齐竞品"分级线性长堆叠"）；回滚＝false
             expand: {
               warehousePerLv: 50000,      // 仓库每级容量（原始 10000，见 CFG.buildings.warehouse）
               warehouseCapPerTown: 20,    // 仓库等级上限 = 城镇等级×此值（原始 buildingCaps.warehouse=5）
               scienceCapPerTown: 20,      // 科技建筑（学院）等级上限（原始走 barracks=1）
               productionCapPerTown: 10,   // 生产建筑（矿井/冶炼/铸币）等级上限（原始走 barracks=1）
               resourceCapPerTown: 10,     // 采集 buff 建筑（伐木场/采石场/农田≈竞品工坊）等级上限（原始 buildingCaps.resource=1，文档注释原意 MAX10）
               utilityCapPerTown: 10,      // 功能建筑（市场）等级上限（原始走 barracks=1）
               res: {                      // 被动/科技资源上限（原始见 CFG.res）
                 tech:   { max: 3000,  maxPerLv: 2000 },
                 copper: { max: 8000,  maxPerLv: 2000 },
                 iron:   { max: 6000,  maxPerLv: 1600 },
                 coin:   { max: 20000, maxPerLv: 4000 }
               }
             } },
  upkeep:  { freeBand:true,   // 切片6 已启用：军粮免维护带 + 分段斜率（对齐竞品 ≤200 免维护 + 1/2/4/8 四段）；回滚＝false
             freeBase:10, freePerBarracksLv:2,        // 免维护带（我方尺度）= 10 + 2×营帐等级（竞品固定 200）
             segWidths:[20,80,200], segSlopes:[1,2,4,8] },// 超出免维护带后的三档段宽与斜率（竞品段宽 100/200/500、斜率 1/2/4/8）
  tech:    { occupyPop:false, sciencesNoMerit:true, longLadder:true },               // 切片3/5/14：科技去战功（切片3 启用）、长阶梯（切片5 启用）、科技占人口
  passive: { needPop:false },                                                       // 切片15：被动建筑人口约束
  food:    { aligned:true,   // 切片4b（用户裁决 R5-①②，2026-09-22）：食物经济对齐 —— 铸币耗粮 5→1、食物产出 0.75→2.25；回滚＝false
             res: { food: { basePerPop: 2.25 } },
             consumes: { mint: { food: 1 } } },
  pop:     { growth:true,   // 切片7 已启用（S5 人口结构对齐）：派生式人口增长；回滚＝false（回到"人口=城镇上限"）
             base:4, per10sBase:2, per10sPerTown:5 },  // 竞品：基础人口 4（表160001）、getPeopleSpeed=2+5×城镇 / 10s（@1310081+0x2710）
  unitCapBoost: { enabled:true,   // 切片8a 已启用（O8 用户批准）：上调单位上限；原始 CFG.unitCaps 保留；回滚＝false
             base:  { infantry:30, archer:30, cavalry:15, mage:5 },
             perLv: { infantry:10, archer:6,  cavalry:4,  mage:2 } },
  ownMax:  { enabled:true,   // 切片8b 已启用（R2=A 用户裁决）：建筑等级上限改"自身 LvMax"，解开"城镇等级×k"绑定；回滚＝false
             warehouse:1000, training:50, science:50, production:50, resource:50, utility:50, barracks:10 },
             // 取值对齐竞品实测：仓库 LvMax=1000（@1088772+）、工坊/学院/剧场类 LvMax=50（@1086878+）
  diag:    { enabled:true, max:50 },                                                // 切片2：诊断环形日志（仅内存）
  save:    { v3:true }                                                              // 切片9 已启用：存档 v3 骨架（ops/offline/daily）；回滚＝false（回到 v2，字段不入档）
};
