// ==================== 游戏配置 ====================
// 独立配置文件，方便数值测试和调整
const CFG = {
  tickMs: 1000,                       // 游戏主循环间隔（毫秒）
  maxUpgradeTime: 120,                // 建筑升级最大时间（秒）
  workshopCostCurve: {                // 仅用于显式映射到母本 workShop 的建筑；未映射项保留各自费用路径
    baseDivisor: 3,
    breaks: [10,20,30,40],
    slopes: [1,5,10,20,40]
  },
  storageCostBreaks: [10,300,600],    // 母本仓库当前等级的升费斜率切换点；每仓的费用基数/步长仍由建筑配置决定
  queueMultiplier: 3,                 // 训练队列上限 = 训练上限 × 此值
  popFoodCost: 0.1,                   // 每个村民每秒消耗的食物
  unitTrainTime: 0.5,                 // 所有兵种统一训练时间（秒/人）
  battleStepDelay: 840,               // 战斗回合内每步动画延迟（ms，除以 battleSpeed）
  battleRoundDelay: 525,              // 战斗回合间延迟（ms，除以 battleSpeed）
  defaultBattleSpeed: 2,              // 默认战斗倍速

  // 发展线边疆采集点：唯一激活点每满一周期发放；离线沿同一时钟并按离线系数折算产量。
  developmentCollection: {
    periodSec:60,
    maxLevel:500,
    yieldPerLevel:{copper:2,iron:1}
  },

  // 拓境远征首个低警戒入口；铜钱采用母本静态基数，暂不叠警戒奖励倍率。
  developmentBorder: {
    copper:{key:'borderCopper',site:'copper',name:'边疆铜脉哨站',needScience:'sci_copper',developmentBorder:true,
      boss:false,units:{infantry:[5,4],archer:[2]},alertPerWin:20,levelPerWin:1,reward:{coin:400},researchReward:{merit:2}},
    iron:{key:'borderIron',site:'iron',name:'边疆铁脉关隘',needScience:'sci_iron',developmentBorder:true,
      boss:false,units:{infantry:[6,5],archer:[3,2]},alertPerWin:20,levelPerWin:1,reward:{goldCoin:50},researchReward:{merit:3}}
  },

  // 外域村/镇/城承担地契与战备勋章回流；按母本层级相对比例试价，科技开放而不绑主线或区域刷胜次。
  developmentOuter: {
    village:{key:'outerVillage',region:'village',name:'外域军屯村寨',needScience:'sci_bronze_age',developmentOuter:true,
      boss:false,units:{infantry:[6,4,3],archer:[6,4,3],cavalry_t1:[4,3]},alertPerWin:20,reward:{deed:12,medal:5},
      researchReward:{merit:5,essenceCycles:[['shield_essence','spear_essence','sword_essence']]}},
    town:{key:'outerTown',region:'town',name:'外域工造军镇',needScience:'sci_iron_age',developmentOuter:true,
      boss:false,units:{infantry:[9,6,4],archer:[9,6,4],cavalry_t1:[6,5,3]},alertPerWin:20,reward:{deed:20,medal:7},
      researchReward:{merit:7,essenceCycles:[['bow_essence','crossbow_essence','blade_essence'],['wind_essence','iron_essence']]}},
    city:{key:'outerCity',region:'city',name:'外域铸银城塞',needScience:'sci_silver_age',developmentOuter:true,
      boss:false,units:{infantry:[11,8,5],archer:[11,8,5],cavalry_t1:[8,6,4],silver_heavy:[2]},
      alertPerWin:20,reward:{deed:32,medal:10},researchReward:{merit:10}},
    capital:{key:'outerCapital',region:'capital',name:'外域铸金王都',needScience:'sci_gold_age',developmentOuter:true,
      boss:true,units:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],
        silver_heavy:[4,3],gold_cavalry:[4,3]},alertPerWin:20,reward:{deed:40,medal:20},researchReward:{merit:15}}
  },
  // 母本 winBigWar：村/镇/城每万次基础10次血剂；王都血剂、攻击药各50次，随战前收益系数增长。
  developmentOuterRare:{getPer:40,bloodBase:{village:10,town:10,city:10,capital:50},
    emberBase:{capital:50},capitalBloodCap:1000,capitalEmberCap:100},

  // 资源定义
  res: {
    // 岗位基础产率（每人每秒）；完整曲线仍需合并乘区、维护、容量与实际覆盖值校准。
    wood:{name:'木材',icon:'wood',basePerPop:3,desc:'对齐竞品伐木工人 3/s/人'},
    stone:{name:'石料',icon:'stone',basePerPop:2,desc:'对齐竞品矿工 2/s/人'},
    food:{name:'食物',icon:'food',basePerPop:5,desc:'对齐竞品牧民 5/s/人'},
    tech:{name:'科技点',icon:'tech',basePerPop:1,workerBuilding:'academy',type:'science',max:500,maxPerLv:200,desc:'学者产出科技点，占用人口'},
    coal:{name:'煤',icon:'coal',type:'material',basePerPop:1,science:'sci_coal',max:600,maxPerLv:0,desc:'研究煤炭开采后开放煤工；煤井只提高产率'},
    copper:{name:'铜',icon:'copper',type:'passive',basePerPop:1,workerBuilding:'mine',max:2000,maxPerLv:500,desc:'旧配方由矿井开放；煤链档研究后开放'},
    iron:{name:'铁',icon:'iron',type:'passive',basePerPop:0.5,workerBuilding:'smelter',max:1500,maxPerLv:400,consumes:{copper:3},desc:'旧配方每人每秒耗铜3；煤链档消耗石料与煤'},
    silver:{name:'银',icon:'silver',type:'material',basePerPop:1/3,max:300,maxPerLv:0,consumes:{stone:2,coal:1},desc:'冶银技术后开放；平均每工每在线秒耗石料／矿石2、煤1，产银1/3'},
    gold:{name:'金',icon:'gold',type:'material',basePerPop:1/4,max:300,maxPerLv:0,consumes:{stone:2,coal:1},desc:'冶金技术后开放；金属金不同于钱币，每工每4秒平均耗矿石8、煤4，产金1'},
    steel:{name:'钢',icon:'steel',type:'material',basePerPop:1/4,max:300,maxPerLv:0,consumes:{iron:1,stone:1,coal:1},desc:'冶钢技术后开放；每工每4秒耗铁、矿石、煤各4，产钢1'},
    coin:{name:'钱币',icon:'coin',type:'currency',basePerPop:0.5,workerBuilding:'mint',max:5000,maxPerLv:1000,consumes:{food:5},desc:'新档研究铸币技术后可用铜铸币；旧档保留原食物铸币配方'},
    silverCoin:{name:'银两',icon:'silverCoin',type:'currency',basePerPop:2/3,max:10000,maxPerLv:0,consumes:{silver:1/3},desc:'冶银与铸币研究后开放；平均每工每在线秒耗银1/3、产银两2/3'},
    // 母本350015每4秒耗金属金1、产金币2；160006基础仓10000。金属金与金铸币独立。
    goldCoin:{name:'金铸币',icon:'coin',type:'currency',basePerPop:1/2,max:10000,maxPerLv:0,consumes:{gold:1/4},desc:'金属金与铸币技术后开放；每工每在线秒耗金属金1/4、产金铸币1/2'},
    deed:{name:'地契',icon:'deed',type:'currency',max:999999,maxPerLv:0,desc:'聚落扩容凭据（新档初始30，后续由市场补给）'},
    medal:{name:'战备勋章',icon:'medal',type:'currency',max:100000000000,maxPerLv:0,desc:'军备与高阶科技研究通用勋章；与既有战功分开记录'},
    bone:{name:'兽骨',icon:'bone',type:'material',max:10000000000,maxPerLv:0,desc:'郊野兽群战斗所得，可在边贸行兑换勋章'},
    hide:{name:'兽皮',icon:'bone',type:'material',max:9999,maxPerLv:0,desc:'郊野兽群战斗所得，可在边贸行换取基础物资'}
  },

  // 新档煤矿冶炼：石料兼作矿石；旧档的铜无原料／铁耗铜3、原仓容留在 CFG.res 与 CFG.caps.expand。
  metalChain: {
    modeNames:{coal:'煤矿冶炼',legacy:'旧配方'},
    baseStorage:600,
    storagePerLv:200,
    stores:{coal:'coal_store',copper:'copper_store',iron:'iron_store'},
    recipes:{copper:{stone:2,coal:2},iron:{stone:2,coal:1}}
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

  // 聚落可重复扩容：旧 townLv 仅保留历史进度与兼容容量，不再作为新扩容动作。
  settlements: {
    village:   {name:'村庄',  popPerLv:1, deedBase:5,  initialLv:0},
    smallTown: {name:'小镇',  popPerLv:2, deedBase:15, initialLv:0, needScience:'sci_urbanization'},
    city:      {name:'城市',  popPerLv:4, deedBase:30, initialLv:1, needScience:'sci_city'}
  },

  // 兵种训练上限（公式：base + 建筑等级 × perLv）
  unitCaps: {
    infantry: {base:10, perLv:5},   // 步兵营地
    archer:   {base:10, perLv:3},   // 弓兵营地
    cavalry:  {base:5, perLv:2},   // 骑兵训练场
    mage:     {base:0, perLv:1},   // 法师塔
    arcane_mage:{base:5,perLv:2}, // 奥术师：独立招募与编队上限
    bronze_guard: {base:10, perLv:5}, // 青铜工坊：独立于旧盾兵升级线
    iron_spearman: {base:10, perLv:5}, // 铁匠铺：独立于旧矛兵升级线
    silver_heavy: {base:10, perLv:5},
    gold_cavalry: {base:5, perLv:3},
    alloy_special: {base:5, perLv:3},
    armored_trooper: {base:5, perLv:3},
    electro_trooper: {base:5, perLv:3},
    star_trooper: {base:5, perLv:3},
    quantum_trooper: {base:5, perLv:3}
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
    // 母本370001基础兵单兵HP100作我方1生命参照；时代军种按同表HP比例配置战斗临时生命，存档仍只记人数。
    // 放置时代青铜/铁器招募的独立消费口；使用我方战斗属性和像素素材，旧兵种/旧队列费用不追改。
    bronze_guard:{name:'青铜刀盾兵',race:'人类',row:'front',icon:'bronze_guard',tier:0,baseUnit:'bronze_guard',combatBase:'infantry',tag:'shield',
      cost:{food:300,copper:100}, upkeep:0.12, hpPerSoldier:2, atk:7,def:16,spd:8, passive:'青铜盾阵',locked:true},
    iron_spearman:{name:'铁器长枪兵',race:'人类',row:'front',icon:'iron_spearman',tier:0,baseUnit:'iron_spearman',combatBase:'infantry',tag:'spear',
      cost:{food:500,iron:100}, upkeep:0.16, hpPerSoldier:1.5, atk:11,def:13,spd:10, passive:'铁枪突刺',locked:true},
    silver_heavy:{name:'白银重甲兵',race:'人类',row:'front',icon:'silver_heavy',tier:0,baseUnit:'silver_heavy',combatBase:'infantry',tag:'shield',
      cost:{food:800,silver:100}, upkeep:0.2, hpPerSoldier:3, atk:15,def:18,spd:7, passive:'白银重甲',locked:true},
    gold_cavalry:{name:'黄金重骑兵',race:'人类',row:'front',icon:'gold_cavalry',tier:0,baseUnit:'gold_cavalry',combatBase:'cavalry',tag:'cavalry',
      cost:{food:1000,gold:100}, upkeep:0.25, hpPerSoldier:3.5, atk:24,def:16,spd:12, passive:'重骑冲锋',locked:true},
    alloy_special:{name:'合金特种兵',race:'人类',row:'front',icon:'alloy_special',tier:0,baseUnit:'alloy_special',combatBase:'infantry',tag:'infantry',
      cost:{food:1500,steel:100}, upkeep:0.3, hpPerSoldier:5.5, atk:32,def:18,spd:11, passive:'特种突击',locked:true},
    armored_trooper:{name:'蒸汽装甲兵',race:'人类',row:'front',icon:'armored_trooper',tier:0,baseUnit:'armored_trooper',combatBase:'infantry',tag:'iron',
      cost:{copper:2000,iron:2000,steel:2000}, upkeep:0.4, hpPerSoldier:6.5, atk:35,def:22,spd:7, passive:'装甲推进',locked:true},
    // 电磁兵单兵耗铜／铁／钢各8000；战斗属性与兵坊为我方兵团模型适配。
    electro_trooper:{name:'电磁兵',race:'人类',row:'front',icon:'electro_trooper',tier:0,baseUnit:'electro_trooper',combatBase:'infantry',tag:'iron',
      cost:{copper:8000,iron:8000,steel:8000}, upkeep:0.5, hpPerSoldier:2.8, atk:55,def:18,spd:9, passive:'电磁火力',locked:true},
    // 母本 370009 兵种 400/40/0、三金属各 8000；生命按当前单兵/100 口径，防御沿我方兵团模型适配。
    star_trooper:{name:'星际先遣兵',race:'人类',row:'front',icon:'star_trooper',tier:0,baseUnit:'star_trooper',combatBase:'infantry',tag:'iron',needScience:'sci_nuclear_age',
      cost:{copper:8000,iron:8000,steel:8000}, upkeep:0.5, hpPerSoldier:4, atk:40,def:18,spd:8, passive:'星际部署',locked:true},
    // 母本 370010 未来战士 750/35/0、三金属各8000；生命按我方单兵/100口径，防御沿用兵团适配值。
    quantum_trooper:{name:'星界构装卫士',race:'人类',row:'front',icon:'quantum_trooper',tier:0,baseUnit:'quantum_trooper',combatBase:'infantry',tag:'iron',needScience:'sci_quantum_age',trainTime:10,
      cost:{copper:8000,iron:8000,steel:8000},upkeep:0.5,hpPerSoldier:7.5,atk:35,def:18,spd:8,passive:'重甲前卫',locked:true},
    // 母本370015：300生命/30攻击/每人100勋章/3.5秒；生命沿单兵/100口径，防御沿我方兵团量纲适配。
    arcane_mage:{name:'奥术师',race:'人类',row:'back',icon:'arcane_mage',tier:0,baseUnit:'arcane_mage',combatBase:'mage',tag:'space',needScience:'sci_arcane_mage',trainTime:3.5,
      cost:{medal:100},upkeep:0.3,hpPerSoldier:3,atk:30,def:6,spd:10,passive:'奥术弹幕',locked:true},
    soul_wraith:{name:'遗境英魂',race:'英魂',row:'front',icon:'soul_wraith',tier:2,baseUnit:'soul_wraith',combatBase:'infantry',tag:'space',
      cost:{},upkeep:0,atk:4,def:22,spd:8,passive:'英魂威压',locked:true,enemyOnly:true},
    // 遗迹敌方专用战斗模板；内部 ID 沿用旧键以兼容存档，不挂训练建筑。
    god_crystal_guard:{name:'守卫机兵',race:'机巧',row:'front',icon:'god_crystal_guard',tier:2,baseUnit:'god_crystal_guard',combatBase:'infantry',tag:'shield',
      cost:{},upkeep:0,atk:3,def:22,spd:8,passive:'遗迹守卫',locked:true,enemyOnly:true},
    // 电力后的三类材料机体挑战保留单体HP与独立出手规模；相对母本对应敌人属性比例适配，不是属性直抄。
    phantom_god:{name:'光学拟态机',race:'高阶机体',row:'front',icon:'phantom_god',tier:2,baseUnit:'phantom_god',combatBase:'infantry',tag:'space',
      cost:{},upkeep:0,atk:2,def:18,spd:11,passive:'光学迷彩',locked:true,enemyOnly:true},
    guardian_god:{name:'重装防卫机',race:'高阶机体',row:'front',icon:'guardian_god',tier:2,baseUnit:'guardian_god',combatBase:'infantry',tag:'shield',
      cost:{},upkeep:0,atk:1,def:36,spd:7,passive:'重装护盾',locked:true,enemyOnly:true},
    // 母本540001相对旧540011的生命/攻/防比例，按本项目单体Boss战斗模型暂定适配。
    slaughter_god:{name:'战术演算机',race:'高阶机体',row:'front',icon:'slaughter_god',tier:2,baseUnit:'slaughter_god',combatBase:'infantry',tag:'infantry',
      cost:{},upkeep:0,atk:3,def:22,spd:8,passive:'战术压制',locked:true,enemyOnly:true},
    // 母本540041自愈之神的90,000/400/130相对守御之神80,000/250/200映射为我方单体规模；只适配技能1受击自愈。
    revival_god:{name:'复苏圣像',race:'神祇',row:'front',icon:'revival_god',tier:2,baseUnit:'revival_god',combatBase:'infantry',tag:'shield',
      cost:{},upkeep:0,atk:2,def:23,spd:8,passive:'圣辉自愈',locked:true,enemyOnly:true,
      onHitRecovery:{triggerAttackDefRatio:3,healAttackPct:0.4,defPerHit:1,extraDefPerAttack:200}},
    silence_god:{name:'缄默之神',race:'神祇',row:'front',icon:'silence_god',tier:2,baseUnit:'silence_god',combatBase:'infantry',tag:'shield',
      cost:{},upkeep:0,atk:2,def:27,spd:8,passive:'缄默神域',locked:true,enemyOnly:true},
    trial_guard_easy:{name:'圣域守卫',race:'神裔',row:'front',icon:'trial_guard_easy',tier:2,baseUnit:'trial_guard_easy',combatBase:'infantry',tag:'shield',
      cost:{},upkeep:0,atk:2,def:4,spd:8,passive:'试炼守卫',locked:true,enemyOnly:true},
    trial_guard_perfect:{name:'幻影守卫',race:'神裔',row:'front',icon:'trial_guard_perfect',tier:2,baseUnit:'trial_guard_perfect',combatBase:'infantry',tag:'space',
      cost:{},upkeep:0,atk:2,def:4,spd:10,passive:'试炼守卫',locked:true,enemyOnly:true},
    trial_guard_extreme:{name:'修罗守卫',race:'神裔',row:'front',icon:'trial_guard_extreme',tier:2,baseUnit:'trial_guard_extreme',combatBase:'infantry',tag:'infantry',
      cost:{},upkeep:0,atk:2,def:4,spd:11,passive:'试炼守卫',locked:true,enemyOnly:true},
    wild_boar:{name:'野猪群',race:'兽类',row:'front',icon:'wild_boar',tier:0,baseUnit:'wild_boar',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:2,def:0,spd:8,passive:'郊野冲撞',locked:true,enemyOnly:true},
    wild_bull:{name:'蛮牛群',race:'兽类',row:'front',icon:'wild_bull',tier:0,baseUnit:'wild_bull',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:3,def:0,spd:7,passive:'蛮牛冲撞',locked:true,enemyOnly:true},
    wild_snake:{name:'毒蛇群',race:'兽类',row:'front',icon:'wild_snake',tier:0,baseUnit:'wild_snake',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:2,def:0,spd:11,passive:'毒牙',locked:true,enemyOnly:true},
    wild_tiger:{name:'霜纹虎群',race:'兽类',row:'front',icon:'wild_tiger',tier:0,baseUnit:'wild_tiger',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:4,def:0,spd:10,passive:'猛扑',locked:true,enemyOnly:true},
    wild_turtle:{name:'铁甲龟群',race:'兽类',row:'front',icon:'wild_turtle',tier:0,baseUnit:'wild_turtle',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:2,def:4,spd:5,passive:'甲壳',locked:true,enemyOnly:true},
    wild_wyrm:{name:'铁脊蜥龙群',race:'兽类',row:'front',icon:'wild_wyrm',tier:0,baseUnit:'wild_wyrm',combatBase:'infantry',tag:'beast',
      cost:{},upkeep:0,atk:8,def:0,spd:9,passive:'龙筋之力',locked:true,enemyOnly:true},
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
    lumber_mill:{name:'伐木场',type:'resource',buffRes:'wood',buffBase:0,buffPerLv:0.1,workshopSourceId:260002,upCostModel:'workshop', build:{wood:200,stone:100,food:40,time:4}, upBase:{wood:600,food:300}, upCostLv:1.5},
    quarry:{name:'采石场',type:'resource',buffRes:'stone',buffBase:0,buffPerLv:0.1,workshopSourceId:260003,upCostModel:'workshop', build:{wood:50,stone:120,food:40,time:4}, upBase:{stone:600,food:300}, upCostLv:1.5},
    farm:{name:'农田',type:'resource',buffRes:'food',buffBase:0,buffPerLv:0.1,workshopSourceId:260001,upCostModel:'workshop', build:{wood:80,stone:80,food:200,time:4}, upBase:{wood:400,food:200}, upCostLv:1.5},
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
    stable:{name:'骑兵训练场',type:'training',trains:'cavalry',tier:1,needBoss:1,needDevelopmentTier:1,
      tierUpgrade:[
        {needBossId:5, cost:{wood:2500,stone:2000,food:2000},time:20},
        {needBossId:20, cost:{wood:8000,stone:8000,food:5000},time:45},
        {needBossId:40, cost:{wood:12000,stone:12000,food:8000},time:90}
      ],build:{wood:220,stone:160,food:180,time:7},upBase:{wood:1000,stone:1000,food:1000},upCostLv:1.12},
    mage_tower:{name:'法师塔',type:'training',trains:'mage',trainsExtra:['arcane_mage'],unitCapBase:1,unitCapPerLv:1,tier:1,needBoss:4,needDevelopmentTier:2,
      tierUpgrade:[
        {needBossId:5,  cost:{wood:800,stone:800,food:600},time:30},
        {needBossId:20, cost:{wood:5000,stone:5000,food:3000},time:60},
        {needBossId:40, cost:{wood:9000,stone:11000,food:5000},time:120},
        {needBossId:65, cost:{wood:22000,stone:25000,food:10000},time:180}
      ],build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3000,stone:3000,food:2000},upCostLv:1.1},
    warehouse:{name:'仓库',type:'storage',storageBase:10000,storagePerLv:10000,needScience:'sci_wood_store',legacyStorageBypassScience:true,
      build:{wood:200,stone:200,food:100,time:5},upBase:{wood:3000,stone:3000,food:3000},upCostLv:1.3,
      alignedBuild:{wood:800,stone:0,food:0,time:5},alignedUpBase:{wood:800,stone:0,food:0},alignedStorageCostStep:5},
    library:{name:'图书馆',type:'storage',storageFor:'tech',storagePerLv:200,needScience:'sci_library',storageCostStep:5,desc:'研究图书馆后建造；每级知识容量+200',
      build:{wood:600,stone:600,time:8},upBase:{wood:600,stone:600},upCostLv:1},
    stone_store:{name:'石仓库',type:'storage',storageFor:'stone',storagePerLv:800,needScience:'sci_stone_store',storageCostStep:5,desc:'完工每级木容量+1200、石+800、煤+400；麻布尚未映射',
      build:{stone:1600,time:8},upBase:{stone:1600},upCostLv:1},
    institute:{name:'研究院',type:'storage',storageFor:'tech',storagePerLv:400,needScience:'sci_institute',storageCostStep:5,desc:'每级知识容量+400',
      build:{wood:1800,stone:1800,time:8},upBase:{wood:1800,stone:1800},upCostLv:1},
    large_granary:{name:'大粮仓',type:'storage',storageFor:'food',storagePerLv:2000,needScience:'sci_large_granary',storageCostStep:5,desc:'研究大粮仓后建造；每级增加食物上限2000',
      build:{wood:1800,stone:0,food:600,time:8},upBase:{wood:1800,stone:0,food:600},upCostLv:1.2},
    arrow_tower:{name:'箭塔',type:'defense',desc:'城防建筑，驻军战斗中对敌人自动射击',build:{wood:400,stone:350,food:150,time:10},upBase:{wood:1500,stone:1500,food:1000},upCostLv:1.2},
    coal_store:{name:'煤仓',type:'storage',storageFor:'coal',storagePerLv:200,needScience:'sci_coal',desc:'已完工每级增加煤容量200',
      build:{wood:160,stone:140,food:80,time:6},upBase:{wood:400,stone:350,food:250},upCostLv:1},
    copper_store:{name:'铜仓',type:'storage',storageFor:'copper',storagePerLv:200,needScience:'sci_copper',desc:'已完工每级增加铜容量200',
      build:{wood:200,stone:160,food:100,time:7},upBase:{wood:500,stone:450,food:300},upCostLv:1},
    iron_store:{name:'铁仓',type:'storage',storageFor:'iron',storagePerLv:200,needScience:'sci_iron_warehouse',grandfatherBuiltScience:true,storageCostStep:5,desc:'铁仓研究后开放；首级消耗铁200，已完工每级增加基础铁容量200、基础钢容量50，旧档已建仓继续可用',
      build:{wood:0,stone:0,food:0,iron:200,time:8},upBase:{wood:0,stone:0,food:0,iron:200},upCostLv:1},
    silver_store:{name:'小银库',type:'storage',storageFor:'silver',storagePerLv:100,needScience:'sci_silver_store',storageCostStep:5,desc:'完工后每级增加银容量100',
      build:{silver:150,time:8},upBase:{silver:150},upCostLv:1},
    gold_store:{name:'小金库',type:'storage',storageFor:'gold',storagePerLv:100,needScience:'sci_gold_store',storageCostStep:5,desc:'完工后每级增加金属金容量100',
      build:{gold:150,time:8},upBase:{gold:150},upCostLv:1},
    steel_store:{name:'钢仓库',type:'storage',storageFor:'steel',storagePerLv:100,needScience:'sci_steel_store',storageCostStep:5,desc:'首级铁200＋钢200；每级钢容量+100、铜铁容量各+200',
      build:{iron:200,steel:200,time:8},upBase:{iron:200,steel:200},upCostLv:1},
    // ===== S8c 占人口制：被动建筑→解锁轨+加成器（对齐竞品：建筑=解锁轨道+工坊加成，产出由分配人口驱动）=====
    coal_mine:{name:'煤井',type:'production',needScience:'sci_coal',buffRes:'coal',buffBase:0,buffPerLv:0.1,workshopSourceId:260005,upCostModel:'workshop',desc:'煤工岗位由研究开放；煤井每级煤产+10%',
      build:{wood:200,stone:200,food:100,time:7},upBase:{stone:800,food:500},upCostLv:1.15},
    mine:{name:'矿井',type:'production',needScience:'sci_copper',buffRes:'copper',buffBase:0,buffPerLv:0.1,workshopSourceId:260007,upCostModel:'workshop',desc:'旧配方开放铜工；煤链档只提高铜产率，每级+10%',
      build:{wood:300,stone:500,food:200,time:8},upBase:{wood:600,stone:1500,food:300},upCostLv:1.15},
    copper_furnace:{name:'冶铜炉',type:'production',needScience:'sci_copper_furnace',buffRes:'copper',buffBase:0,buffPerLv:0.1,desc:'青铜时代后的铜工增效建筑，每级+10%',
      build:{wood:600,stone:1500,food:300,time:10},upBase:{wood:600,stone:1500,food:300},upCostLv:1.15},
    smelter:{name:'冶炼厂',type:'production',needScience:'sci_iron',buffRes:'iron',buffBase:0,buffPerLv:0.1,workshopSourceId:260008,upCostModel:'workshop',desc:'旧配方开放铁工；煤链档只提高铁产率，每级+10%',
      build:{wood:500,stone:600,food:300,time:10},upBase:{copper:500,wood:1000,food:500},upCostLv:1.15},
    bronze_workshop:{name:'青铜工坊',type:'training',trains:'bronze_guard',tier:0,needScience:'sci_bronze_age',
      desc:'研究青铜时代后建造，训练青铜刀盾兵时逐人消耗食物与铜',
      build:{wood:400,stone:400,food:200,time:8},upBase:{wood:1000,stone:1000,food:800},upCostLv:1.1},
    iron_forge:{name:'铁匠铺',type:'training',trains:'iron_spearman',tier:0,needScience:'sci_iron_age',
      desc:'研究铁器时代后建造，训练铁器长枪兵时逐人消耗食物与铁',
      build:{wood:600,stone:600,food:300,time:10},upBase:{wood:1300,stone:1300,food:1000},upCostLv:1.1},
    silver_armory:{name:'白银兵坊',type:'training',trains:'silver_heavy',tier:0,needScience:'sci_silver_age',
      desc:'白银时代后建造；重甲兵逐人消耗食物800与银100',
      build:{wood:600,stone:600,food:400,time:10},upBase:{wood:1400,stone:1400,food:1100},upCostLv:1.1},
    gold_armory:{name:'黄金马厩',type:'training',trains:'gold_cavalry',tier:0,needScience:'sci_gold_age',
      desc:'黄金时代后建造；重骑兵逐人消耗食物1000与金属金100',
      build:{wood:800,stone:700,food:500,time:12},upBase:{wood:1600,stone:1400,food:1200},upCostLv:1.1},
    alloy_armory:{name:'合金兵坊',type:'training',trains:'alloy_special',tier:0,needScience:'sci_alloy_age',
      desc:'合金时代后建造；特种兵逐人消耗食物1500与钢100',
      build:{wood:1000,stone:900,food:600,time:12},upBase:{wood:2000,stone:1800,food:1500},upCostLv:1.1},
    steam_armory:{name:'蒸汽兵坊',type:'training',trains:'armored_trooper',tier:0,needScience:'sci_steam_age',
      desc:'蒸汽时代后建造；装甲兵逐人消耗铜、铁、钢各2000',
      build:{wood:1600,stone:1400,food:800,time:12},upBase:{wood:3200,stone:2800,food:1600},upCostLv:1.1},
    electric_armory:{name:'电磁兵坊',type:'training',trains:'electro_trooper',trainsExtra:['star_trooper','quantum_trooper'],tier:0,needScience:'sci_electric_age',
      desc:'电力时代后建造；星核时代兼训先遣兵，量子时代兼训构装卫士，逐人消耗铜、铁、钢各8000',
      build:{wood:2500,stone:2200,food:1200,time:12},upBase:{wood:4000,stone:3500,food:2200},upCostLv:1.1},
    silver_refinery:{name:'冶银厂',type:'production',needScience:'sci_silver_refinery',buffRes:'silver',buffBase:0,buffPerLv:0.1,workshopSourceId:260009,upCostModel:'workshop',desc:'每级冶银工产率+10%',
      build:{iron:500,wood:1000,food:500,time:10},upBase:{iron:500,wood:1000,food:500},upCostLv:1.15},
    gold_refinery:{name:'冶金厂',type:'production',needScience:'sci_gold_refinery',buffRes:'gold',buffBase:0,buffPerLv:0.1,workshopSourceId:260010,upCostModel:'workshop',desc:'每级冶金工产率+10%；首级需要银500',
      build:{silver:500,wood:1000,food:500,time:10},upBase:{silver:500,wood:1000,food:500},upCostLv:1.15},
    steel_refinery:{name:'冶钢厂',type:'production',needScience:'sci_steel_refinery',buffRes:'steel',buffBase:0,buffPerLv:0.1,workshopSourceId:260011,upCostModel:'workshop',desc:'每级冶钢工产率+10%；首级需要金属金500',
      build:{gold:500,wood:1000,food:500,time:10},upBase:{gold:500,wood:1000,food:500},upCostLv:1.15},
    mint:{name:'铸币厂',type:'production',needScience:'sci_coin',buffRes:'coin',buffBase:0,buffPerLv:0.1,workshopSourceId:260012,upCostModel:'workshop',desc:'货币铸造后建造，每级钱币岗位产率+10%；新档铸铜钱岗位由铸币技术开放',
      build:{wood:600,stone:400,food:500,time:12},upBase:{copper:800,iron:800,food:500},upCostLv:1.15},
    market:{name:'市场',type:'utility',needScience:'sci_copper',desc:'冶铜术后开放基础资源出售与地契购买；高级兑换需货币铸造',
      build:{wood:400,stone:400,food:300,time:10},upBase:{wood:3000,stone:3000,food:2500},upCostLv:1.2},
    academy:{name:'学院',type:'science',buffRes:'tech',buffBase:0,buffPerLv:0.1,workshopSourceId:260006,upCostModel:'workshop',desc:'初始可建，开放学者岗位；分配村民后产出科技点，每级效率+10%',
      build:{wood:150,stone:100,food:80,time:6},upBase:{wood:600,stone:600,food:300},upCostLv:1.1}
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

  // 兵营时代晋升与兵种研究可由拓境远征首胜开启；历史帝国战线胜场仍有效。
  // 两条路径共用原有资源、建筑、科技与精魄费用，不发放免费兵力。
  unitTierDevelopment: {
    1:{stage:5,track:'border',key:'copper'},
    2:{stage:20,track:'outer',key:'town'},
    3:{stage:40,track:'outer',key:'city'},
    4:{stage:65,track:'outer',key:'capital'}
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
  // 对齐映射：冶铜术≈450009、冶铁术≈450011、城市化≈450012、冶银技术≈450013、铸币技术≈450609；旧「货币铸造」保留我方后续建筑门。
  // 门控模型：纯科技门（科技点+战功），无击杀前置——对齐放置时代"资源/建筑=科技门"；战斗主线（城镇/营地tier）仍为击杀门（台账记录差异）
  sciences: {
    sci_wood_store:{name:'木石仓储',desc:'开放仓库建造，扩充木材和石材容量',cost:{tech:400,merit:0},unlocks:['warehouse'],storageMode:'aligned'},
    sci_library:{name:'图书馆',desc:'开放图书馆，每级知识容量+200',cost:{tech:200,merit:0},unlocks:['library']},
    sci_workshop:{name:'工坊技术',desc:'开放储存精通研究',cost:{tech:400,merit:0},need:['sci_library'],unlocks:[]},
    sci_coal:{name:'煤炭开采',desc:'开放煤工、煤井与煤仓',cost:{tech:5,merit:0},unlocks:['coal_mine','coal_store']},
    sci_copper:{name:'冶铜术',desc:'煤链档开放铜工；解锁矿井、铜仓与基础市场',cost:{tech:10,merit:0},unlocks:['mine','market','copper_store']},
    sci_currency:{name:'铸币技术',desc:'开放铸铜钱岗位，每人每秒消耗铜1、产钱币2',cost:{tech:1200,merit:0},need:['sci_copper'],unlocks:[],currencyMode:'copper'},
    sci_bronze_age:{name:'青铜时代',desc:'解锁青铜工坊与青铜刀盾兵',cost:{tech:1200,merit:0},need:['sci_copper'],unlocks:['bronze_workshop','bronze_guard']},
    sci_copper_furnace:{name:'冶铜炉',desc:'开放冶铜炉，继续提高铜工效率',cost:{tech:1000,merit:0},need:['sci_bronze_age'],unlocks:['copper_furnace']},
    sci_stone_store:{name:'石仓库',desc:'开放石仓库，扩木石煤仓容',cost:{tech:800,merit:0},need:['sci_copper_furnace'],unlocks:['stone_store']},
    sci_institute:{name:'研究院',desc:'开放研究院，每级知识容量+400',cost:{tech:1000,merit:0},need:['sci_stone_store'],unlocks:['institute']},
    sci_iron:{name:'冶铁术',desc:'煤链档开放铁工；解锁冶炼厂与铁仓',cost:{tech:80,merit:10},need:['sci_copper'],unlocks:['smelter','iron_store']},
    sci_iron_age:{name:'铁器时代',desc:'解锁铁匠铺与铁器长枪兵',cost:{tech:2500,merit:0},need:['sci_iron'],unlocks:['iron_forge','iron_spearman']},
    sci_city:{name:'城市化',desc:'开放城市扩建',cost:{tech:2200,merit:0},need:['sci_iron'],unlocks:['city']},
    sci_silver:{name:'冶银技术',desc:'开放冶银工与银两产业',cost:{tech:3200,merit:0},need:['sci_city'],unlocks:[]},
    sci_silver_store:{name:'小银库',desc:'开放小银库，银容量每级+100',cost:{tech:2000,merit:0},need:['sci_silver'],unlocks:['silver_store']},
    sci_silver_refinery:{name:'冶银厂',desc:'开放冶银厂，冶银工每级增产10%',cost:{tech:3000,merit:0},need:['sci_silver_store'],unlocks:['silver_refinery']},
    sci_silver_age:{name:'白银时代',desc:'开放白银重甲兵',cost:{tech:4000,merit:0},need:['sci_silver'],unlocks:['silver_armory','silver_heavy']},
    sci_gold:{name:'冶金技术',desc:'开放冶金工岗位，矿石8＋煤4→金属金1／4秒',cost:{tech:6000,merit:0},need:['sci_silver_age'],unlocks:[]},
    sci_gold_store:{name:'小金库',desc:'开放小金库，金属金容量每级+100',cost:{tech:3000,merit:0},need:['sci_gold'],unlocks:['gold_store']},
    sci_gold_refinery:{name:'冶金厂',desc:'开放冶金厂，每级冶金工产率+10%',cost:{tech:5000,merit:0},need:['sci_gold_store'],unlocks:['gold_refinery']},
    sci_gold_age:{name:'黄金时代',desc:'开放黄金重骑兵',cost:{tech:7000,merit:0},need:['sci_gold'],unlocks:['gold_armory','gold_cavalry']},
    sci_steel:{name:'冶钢技术',desc:'开放冶钢工，铁矿石煤各4→钢1／4秒',cost:{tech:9000,merit:0},need:['sci_gold_age'],unlocks:[]},
    sci_steel_store:{name:'钢仓库',desc:'开放钢仓库，扩钢及铜铁容量',cost:{tech:4000,merit:0},need:['sci_steel'],unlocks:['steel_store']},
    sci_steel_refinery:{name:'冶钢厂',desc:'开放冶钢厂，每级冶钢工产率+10%',cost:{tech:8000,merit:0},need:['sci_steel_store'],unlocks:['steel_refinery']},
    sci_alloy_age:{name:'合金时代',desc:'开放合金特种兵',cost:{tech:10000,merit:0},need:['sci_steel'],unlocks:['alloy_armory','alloy_special']},
    sci_god_domain:{name:'遗迹勘探',desc:'开放机巧遗迹挑战；须单次支付知识50000和钢5000',cost:{tech:50000,steel:5000,merit:0},need:['sci_alloy_age'],unlocks:[]},
    sci_steam_age:{name:'蒸汽时代',desc:'开放蒸汽兵坊与装甲兵；须单次支付知识100000和钢10000',cost:{tech:100000,steel:10000,merit:0},need:['sci_alloy_age'],unlocks:['steam_armory','armored_trooper']},
    sci_steam_military:{name:'蒸汽军制',desc:'开放军团整编；一次支付知识150000。整编星级提高出战攻击与生命，同时压缩军队规模',cost:{tech:150000,merit:0},need:['sci_steam_age'],unlocks:[]},
    sci_electric_age:{name:'电力时代',desc:'开放电磁兵坊与电磁兵；须单次支付知识5000000和钢1000000',cost:{tech:5000000,steel:1000000,merit:0},need:['sci_steam_age'],unlocks:['electric_armory','electro_trooper']},
    sci_arcane_mage:{name:'奥术师',desc:'解锁奥术师；支付知识8000000和战备勋章100000',cost:{tech:8000000,medal:100000,merit:0},need:['sci_electric_age'],unlocks:['arcane_mage']},
    sci_astral_lord:{name:'星界领主',desc:'开启英魂升阶；支付知识10000000和战备勋章200000',cost:{tech:10000000,medal:200000,merit:0},need:['sci_arcane_mage'],unlocks:[]},
    sci_soul_realm:{name:'英魂遗境',desc:'开放英魂遗境材料战；支付知识20000000和战备勋章300000',cost:{tech:20000000,medal:300000,merit:0},need:['sci_astral_lord'],unlocks:[]},
    sci_nuclear_age:{name:'星核时代',desc:'开放星际先遣兵；须单次支付知识100000000和战备勋章800000',cost:{tech:100000000,medal:800000,merit:0},need:['sci_electric_age'],unlocks:['star_trooper']},
    sci_star_beast_domain:{name:'星界兽域',desc:'开放星界异兽挑战与星石材料；须单次支付知识200000000和战备勋章1000000',cost:{tech:200000000,medal:1000000,merit:0},need:['sci_nuclear_age'],unlocks:[]},
    sci_star_array:{name:'星辉圣阵',desc:'开放星辉圣阵槽位与秘典知识仓刻印；须单次支付知识300000000和战备勋章2000000',cost:{tech:300000000,medal:2000000,merit:0},need:['sci_star_beast_domain'],unlocks:[]},
    sci_quantum_age:{name:'星界量子时代',desc:'开放星界仓储、生产科技与星界构装卫士；须单次支付知识3000000000和战备勋章3000000',cost:{tech:3000000000,medal:3000000,merit:0},need:['sci_nuclear_age'],unlocks:['quantum_trooper']},
    sci_astral_armament:{name:'星界圣痕兵装',desc:'开放逐兵种的圣痕攻击与生命强化；一次支付知识5000000000和战备勋章5000000',cost:{tech:5000000000,medal:5000000,merit:0},need:['sci_quantum_age'],unlocks:[]},
    sci_astral_engine:{name:'星界时序引擎',desc:'开放战斗100倍速并保存所选倍速；一次支付知识100000000000和战备勋章30000000',cost:{tech:100000000000,medal:30000000,merit:0},need:['sci_astral_armament'],unlocks:[]},
    sci_coin:{name:'货币铸造',desc:'解锁铸币厂与高级兑换',cost:{tech:200,merit:30},need:['sci_iron'],unlocks:['mint']}
  },

  // ==================== 资源科技·长阶梯（切片5 S2 · 用户"骨架拟合"指令）====================
  // 形态对齐：竞品 developScienceList 40+ 节点、跨度 200→1e13（11 个数量级）；我方长阶梯现为27个可研究节点、跨度100→12000，另保留1个历史节点。
  // 说明：跨度继续扩大依赖后续时代内容；短表保留原资源节点费用，并为新档加煤与木石仓储入口
  // 成本为【候选·待推演】，由 curve-sim 验证可达节奏；回滚＝CFG.tech.longLadder=false
  sciencesLong: {
    sci_prospect:{name:'探矿术',desc:'资源科技第一阶（勘矿）',cost:{tech:100,merit:0},unlocks:[]},
    sci_library:{name:'图书馆',desc:'开放图书馆，每级知识容量+200',cost:{tech:200,merit:0},need:['sci_prospect'],unlocks:['library']},
    sci_workshop:{name:'工坊技术',desc:'开放储存精通研究',cost:{tech:400,merit:0},need:['sci_library'],unlocks:[]},
    sci_wood_store:{name:'木石仓储',desc:'开放仓库建造，木材每级+600、石材每级+400',cost:{tech:400,merit:0},need:['sci_prospect'],unlocks:['warehouse'],storageMode:'aligned'},
    sci_coal:{name:'煤炭开采',desc:'开放煤工、煤井与煤仓',cost:{tech:200,merit:0},need:['sci_prospect'],unlocks:['coal_mine','coal_store']},
    sci_copper:{name:'冶铜术',desc:'煤链档开放铜工；解锁矿井、铜仓与基础市场',cost:{tech:300,merit:0},need:['sci_coal'],unlocks:['mine','market','copper_store']},
    sci_currency:{name:'铸币技术',desc:'开放铸铜钱岗位，每人每秒消耗铜1、产钱币2',cost:{tech:1200,merit:0},need:['sci_copper'],unlocks:[],currencyMode:'copper'},
    sci_large_granary:{name:'大粮仓',desc:'开放大粮仓建造，增加食物容量',cost:{tech:800,merit:0},need:['sci_copper'],unlocks:['large_granary']},
    sci_bronze_age:{name:'青铜时代',desc:'解锁青铜工坊与青铜刀盾兵',cost:{tech:1200,merit:0},need:['sci_large_granary'],unlocks:['bronze_workshop','bronze_guard']},
    sci_copper_furnace:{name:'冶铜炉',desc:'青铜时代后开放冶铜炉，每级铜工效率+10%',cost:{tech:1000,merit:0},need:['sci_bronze_age'],unlocks:['copper_furnace']},
    sci_stone_store:{name:'石仓库',desc:'冶铜炉后开放石仓库，扩木石煤仓容',cost:{tech:800,merit:0},need:['sci_copper_furnace'],unlocks:['stone_store']},
    sci_institute:{name:'研究院',desc:'石仓库后开放研究院，每级知识容量+400',cost:{tech:1000,merit:0},need:['sci_stone_store'],unlocks:['institute']},
    // 早期直链按母本 450009→450010→450011；旧冶金术 ID 仅保留给已研究存档。
    sci_metal:{name:'冶金术',desc:'旧研究记录，现已退出发展主线',cost:{tech:800,merit:0},need:['sci_copper'],unlocks:[],legacyOnly:true},
    sci_urbanization:{name:'城镇化',desc:'开放小镇扩建（发展科技 450010）',cost:{tech:1400,merit:0},need:['sci_copper'],unlocks:['smallTown']},
    sci_birth_policy:{name:'鼓励生育',desc:'开放小镇「育」政策，每个已配置政策位使人口每10在线秒多增长5人',cost:{tech:1000,merit:0},need:['sci_urbanization'],unlocks:[]},
    sci_iron:{name:'冶铁术',desc:'煤链档开放铁工；解锁冶炼厂',cost:{tech:1800,merit:0},need:['sci_urbanization'],unlocks:['smelter']},
    sci_iron_warehouse:{name:'铁仓库',desc:'开放铁仓建造，增加铁容量',cost:{tech:1000,merit:0},need:['sci_iron'],unlocks:['iron_store']},
    sci_iron_age:{name:'铁器时代',desc:'解锁铁匠铺与铁器长枪兵',cost:{tech:2500,merit:0},need:['sci_iron_warehouse'],unlocks:['iron_forge','iron_spearman']},
    sci_city:{name:'城市化',desc:'开放城市扩建（发展科技 450012）',cost:{tech:2200,merit:0},need:['sci_iron'],unlocks:['city']},
    sci_silver:{name:'冶银技术',desc:'城市化后开放冶银工（矿石6＋煤3→银1／3秒）',cost:{tech:3200,merit:0},need:['sci_city'],unlocks:[]},
    sci_silver_store:{name:'小银库',desc:'开放小银库，银容量每级+100',cost:{tech:2000,merit:0},need:['sci_silver'],unlocks:['silver_store']},
    sci_silver_refinery:{name:'冶银厂',desc:'开放冶银厂，冶银工每级增产10%',cost:{tech:3000,merit:0},need:['sci_silver_store'],unlocks:['silver_refinery']},
    sci_silver_age:{name:'白银时代',desc:'开放白银重甲兵',cost:{tech:4000,merit:0},need:['sci_silver'],unlocks:['silver_armory','silver_heavy']},
    sci_gold:{name:'冶金技术',desc:'白银时代后开放冶金工（矿石8＋煤4→金属金1／4秒）',cost:{tech:6000,merit:0},need:['sci_silver_age'],unlocks:[]},
    sci_gold_store:{name:'小金库',desc:'开放小金库，金属金容量每级+100',cost:{tech:3000,merit:0},need:['sci_gold'],unlocks:['gold_store']},
    sci_gold_refinery:{name:'冶金厂',desc:'开放冶金厂，每级冶金工产率+10%',cost:{tech:5000,merit:0},need:['sci_gold_store'],unlocks:['gold_refinery']},
    sci_gold_age:{name:'黄金时代',desc:'开放黄金重骑兵',cost:{tech:7000,merit:0},need:['sci_gold'],unlocks:['gold_armory','gold_cavalry']},
    sci_steel:{name:'冶钢技术',desc:'黄金时代后开放冶钢工（铁、矿石、煤各4→钢1／4秒）',cost:{tech:9000,merit:0},need:['sci_gold_age'],unlocks:[]},
    sci_steel_store:{name:'钢仓库',desc:'开放钢仓库，扩钢及铜铁容量',cost:{tech:4000,merit:0},need:['sci_steel'],unlocks:['steel_store']},
    sci_steel_refinery:{name:'冶钢厂',desc:'开放冶钢厂，每级冶钢工产率+10%',cost:{tech:8000,merit:0},need:['sci_steel_store'],unlocks:['steel_refinery']},
    sci_alloy_age:{name:'合金时代',desc:'开放合金特种兵',cost:{tech:10000,merit:0},need:['sci_steel'],unlocks:['alloy_armory','alloy_special']},
    sci_god_domain:{name:'遗迹勘探',desc:'开放机巧遗迹挑战；一次支付知识50000与钢5000',cost:{tech:50000,steel:5000,merit:0},need:['sci_alloy_age'],unlocks:[]},
    sci_steam_age:{name:'蒸汽时代',desc:'开放装甲兵；一次支付知识100000与钢10000',cost:{tech:100000,steel:10000,merit:0},need:['sci_alloy_age'],unlocks:['steam_armory','armored_trooper']},
    sci_steam_military:{name:'蒸汽军制',desc:'开放军团整编；一次支付知识150000。整编星级提高出战攻击与生命，同时压缩军队规模',cost:{tech:150000,merit:0},need:['sci_steam_age'],unlocks:[]},
    sci_electric_age:{name:'电力时代',desc:'开放电磁兵；一次支付知识5000000与钢1000000',cost:{tech:5000000,steel:1000000,merit:0},need:['sci_steam_age'],unlocks:['electric_armory','electro_trooper']},
    sci_arcane_mage:{name:'奥术师',desc:'解锁奥术师；一次支付知识8000000与战备勋章100000',cost:{tech:8000000,medal:100000,merit:0},need:['sci_electric_age'],unlocks:['arcane_mage']},
    sci_astral_lord:{name:'星界领主',desc:'开启英魂升阶；一次支付知识10000000与战备勋章200000',cost:{tech:10000000,medal:200000,merit:0},need:['sci_arcane_mage'],unlocks:[]},
    sci_soul_realm:{name:'英魂遗境',desc:'开放英魂遗境材料战；一次支付知识20000000与战备勋章300000',cost:{tech:20000000,medal:300000,merit:0},need:['sci_astral_lord'],unlocks:[]},
    sci_nuclear_age:{name:'星核时代',desc:'开放星际先遣兵；一次支付知识100000000与战备勋章800000',cost:{tech:100000000,medal:800000,merit:0},need:['sci_electric_age'],unlocks:['star_trooper']},
    sci_star_beast_domain:{name:'星界兽域',desc:'开放星界异兽挑战与星石材料；一次支付知识200000000与战备勋章1000000',cost:{tech:200000000,medal:1000000,merit:0},need:['sci_nuclear_age'],unlocks:[]},
    sci_star_array:{name:'星辉圣阵',desc:'开放星辉圣阵槽位与秘典知识仓刻印；一次支付知识300000000与战备勋章2000000',cost:{tech:300000000,medal:2000000,merit:0},need:['sci_star_beast_domain'],unlocks:[]},
    sci_quantum_age:{name:'星界量子时代',desc:'开放星界仓储、生产科技与星界构装卫士；一次支付知识3000000000与战备勋章3000000',cost:{tech:3000000000,medal:3000000,merit:0},need:['sci_nuclear_age'],unlocks:['quantum_trooper']},
    sci_astral_armament:{name:'星界圣痕兵装',desc:'开放逐兵种的圣痕攻击与生命强化；一次支付知识5000000000与战备勋章5000000',cost:{tech:5000000000,medal:5000000,merit:0},need:['sci_quantum_age'],unlocks:[]},
    sci_astral_engine:{name:'星界时序引擎',desc:'开放战斗100倍速并保存所选倍速；一次支付知识100000000000与战备勋章30000000',cost:{tech:100000000000,medal:30000000,merit:0},need:['sci_astral_armament'],unlocks:[]},
    sci_mint:{name:'铸币术',desc:'铸造工艺基础',cost:{tech:5000,merit:0},need:['sci_iron'],unlocks:[]},
    sci_coin:{name:'货币铸造',desc:'解锁铸币厂与高级兑换',cost:{tech:12000,merit:0},need:['sci_mint'],unlocks:['mint']}
  },

  // ==================== 市场（IE-007 交易所雏形）====================
  // 汇率：from 1 单位 → to rate 单位（向下取整）。往返乘积必须 <1（防套利，测试有断言）。
  // 每日次数/多汇率/刷新等机制由 IE-006 补齐，本字段为保守起点值·待推演。
  market: {
    multiRate: true,    // 切片13 已启用（C3 裁决）：多汇率 + 每日上限 + 转换损失（损失体现为买卖价差，往返乘积<1）
    dailyLimit: 5,      // 每日兑换次数上限（日界=本地 0 点，C4 裁决）
    // 母本380000：每1200秒10次带放回抽取；33种货品权重和2625，380009/380049/380019/380029权重20/10/10/10。
    // 其余货品归入other；电力时代开放本项目的永久战剂与净化链入口。
    special:{needScience:'sci_electric_age',refreshSec:1200,slots:10,totalWeight:2625,
      weights:{sacredBlood:20,domainCleanser:10,emberElixir:10,aegisElixir:10},
      goods:{sacredBlood:{costKey:'goldCoin',cost:9999},domainCleanser:{costKey:'sacredBlood',cost:3},
        emberElixir:{costKey:'sacredBlood',cost:20},aegisElixir:{costKey:'emberElixir',cost:3}}},
    rates: [
      {from:'coin',to:'wood',rate:8},
      {from:'coin',to:'stone',rate:6},
      {from:'wood',to:'coin',rate:0.1,early:true},
      {from:'stone',to:'coin',rate:0.14,early:true},
      // 切片13 新增（跨资源对；与既有价差共同构成"转换损失"，任一往返乘积 <1 → 无套利）
      {from:'coin',to:'food',rate:4},
      {from:'food',to:'coin',rate:0.08,early:true},
      {from:'wood',to:'stone',rate:0.6},
      {from:'stone',to:'wood',rate:0.5},
      {from:'wood',to:'food',rate:0.4},
      {from:'food',to:'wood',rate:0.2},
      // S8c（D2 地契）：金币→地契 100:1（往返 0.8 <1，无套利）
      {from:'coin',to:'deed',rate:0.01,early:true},
      {from:'silverCoin',to:'deed',rate:0.005,early:true,needScience:'sci_silver'},
      // 母本市场380023：银两200换勋章10；沿用本项目高级市场每日次数。
      {from:'silverCoin',to:'medal',rate:0.05,needScience:'sci_electric_age'},
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
  steamMilitary:{needScience:'sci_steam_military',maxStars:50,attackHpPerStar:0.1,baseFieldSize:5,
    firstStarFieldNeed:210,fieldNeedPerStar:10,fieldLossPerFiveStars:50},
  passive: { needPop:false },                                                       // 切片15：被动建筑人口约束
  food:    { aligned:true,   // 切片4b（用户裁决 R5-①②，2026-09-22）：食物经济对齐 —— 铸币耗粮 5→1、食物产出 0.75→2.25；回滚＝false
             res: { food: { basePerPop: 2.25 } },
             consumes: { mint: { food: 1 } } },
  pop:     { initial:0, initialAlloc:{wood:0,stone:0,food:0}, per10sBase:2,birthPolicyPer10s:5,
             legacyBase:4, legacyPer10sBase:2, legacyPer10sPerTown:5 },
  currency:{copperPerWorkerPerSec:2,copperPerWorkerCost:1},
  unitCapBoost: { enabled:true,   // 切片8a 已启用（O8 用户批准）：上调单位上限；原始 CFG.unitCaps 保留；回滚＝false
             base:  { infantry:30, archer:30, cavalry:15, mage:5 },
             perLv: { infantry:10, archer:6,  cavalry:4,  mage:2 } },
  ownMax:  { enabled:true,   // 切片8b 已启用（R2=A 用户裁决）：建筑等级上限改"自身 LvMax"，解开"城镇等级×k"绑定；回滚＝false
             warehouse:1000, training:50, science:50, production:50, resource:50, utility:50, barracks:10 },
             // 取值对齐竞品实测：仓库 LvMax=1000（@1088772+）、工坊/学院/剧场类 LvMax=50（@1086878+）
  diag:    { enabled:true, max:50 },                                                // 切片2：诊断环形日志（仅内存）
  basicStorage:{wood:{base:1800,warehousePerLv:600},stone:{base:1200,warehousePerLv:400},food:{base:3000,warehousePerLv:0}},
  storageMastery:{needScience:'sci_workshop',maxLevel:100,perLevel:0.1,earlyLevels:5,earlyCost:{tech:500},laterCost:{tech:500,gold:1000,steel:1000}},
  // 母本460007：科研精通每级学者产出+5%，第6级起另付勋章10×目标等级。
  scholarMastery:{name:'科研精通',needScience:'sci_workshop',maxLevel:20,perLevel:0.05,techBase:500,lateMedalBase:10},
  // 母本460013：冶钢精通每级冶钢工产出+5%，第6级起另付勋章30×目标等级。
  steelMastery:{name:'冶钢精通',needScience:'sci_steel',maxLevel:20,perLevel:0.05,techBase:1500,lateMedalBase:30},
  // 母本 370002～370010 各关联 340xxx/341xxx/342xxx：三维分别按材料投入1000次升一星。
  // 母本每星+1 HP按当前兵团口径100:1换算；攻、防加值1:1。370001轻步兵与我方农民不是同兵种，暂不映射。
  armsUp:{
    bronze_guard:{name:'青铜盾兵装',needScience:'sci_bronze_age',material:'copper',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    iron_spearman:{name:'铁枪兵装',needScience:'sci_iron_age',material:'iron',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    silver_heavy:{name:'白银重甲兵装',needScience:'sci_silver_age',material:'silver',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    gold_cavalry:{name:'黄金骑具',needScience:'sci_gold_age',material:'gold',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    alloy_special:{name:'合金特种兵装',needScience:'sci_alloy_age',material:'steel',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    armored_trooper:{name:'蒸汽装甲兵装',needScience:'sci_steam_age',material:'steel',stepCost:1000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    electro_trooper:{name:'电磁兵装',needScience:'sci_electric_age',material:'steel',stepCost:4000,stepsPerStar:1000,
      stats:{atk:{name:'火力校准',perStar:1},hp:{name:'装甲调校',perStar:0.01},def:{name:'防护调校',perStar:1}}},
    star_trooper:{name:'星际先遣兵装',needScience:'sci_nuclear_age',material:'steel',stepCost:4000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}},
    quantum_trooper:{name:'星界构装兵装',needScience:'sci_quantum_age',material:'steel',stepCost:4000,stepsPerStar:1000,
      stats:{atk:{name:'攻击精炼',perStar:1},hp:{name:'体魄精炼',perStar:0.01},def:{name:'防护精炼',perStar:1}}}
  },
  // 母本兵装成长的阶段奖励：攻击每10星加基础攻击20%，生命每100星加基础生命20%。
  armsUpMilestones:{atk:{everyStars:10,basePct:0.2},hp:{everyStars:100,basePct:0.2}},
  // 参考源 450224 的逐兵种 HP/ATK 入口；百分比与单次材料费是我方聚合战斗口径的适配值。
  quantumArmament:{needScience:'sci_astral_armament',units:['bronze_guard','iron_spearman','silver_heavy','gold_cavalry','alloy_special','armored_trooper','electro_trooper','star_trooper','quantum_trooper'],
    maxLevel:10,atkPerLevel:0.05,hpPerLevel:0.05,steelPerLevel:8000,starOriginStonePerLevel:10},
  // 母本470061/071研发、230061/071锻造：先研发、累计投入20次得首件，后续各投入12/14次升级。
  weaponForge:{
    alloySword:{name:'合金剑',unit:'alloy_special',stat:'atk',needScience:'sci_alloy_age',researchCost:{tech:5000,medal:80},stepCost:{steel:200},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:5,perLevelAtk:4},
    alloyArmor:{name:'合金甲',unit:'alloy_special',stat:'def',needScience:'sci_alloy_age',needWeapon:'alloySword',researchCost:{tech:5000,medal:80},stepCost:{steel:200},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialDef:10,perLevelDef:10},
    armored:{name:'蒸汽装甲枪',unit:'armored_trooper',needScience:'sci_steam_age',researchCost:{tech:20000,medal:1000},stepCost:{iron:10000,steel:500},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:6,perLevelAtk:4},
    // 母本470062→063→064；470063的Unlocked误指230062，这里依名称与230063的LimitID接迫击炮。
    gatling:{name:'蒸汽加特林',unit:'armored_trooper',stat:'atk',needScience:'sci_steam_age',needWeapon:'armored',researchCost:{tech:80000,medal:5000},stepCost:{steel:2000,godCore:2},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:9,perLevelAtk:1,skill:'sweep'},
    mortar:{name:'蒸汽迫击炮',unit:'armored_trooper',stat:'atk',needScience:'sci_steam_age',needWeapon:'gatling',researchCost:{tech:150000,medal:8000},stepCost:{steel:3000,godCore:2},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:9,perLevelAtk:1,skill:'bombard'},
    steamArmor:{name:'蒸汽甲',unit:'armored_trooper',stat:'def',needScience:'sci_steam_age',needWeapon:'mortar',researchCost:{tech:40000,medal:2000},stepCost:{steel:20000},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialDef:10,perLevelDef:10},
    electro:{name:'电磁枪',unit:'electro_trooper',needScience:'sci_electric_age',researchCost:{tech:200000,medal:10000},stepCost:{iron:100000,steel:5000},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:7,perLevelAtk:5},
    // 母本470072→073→074：技能枪逐次制造消耗内部材料键 godCore（玩家显示名“高能核心”），前置研究不可跳过。
    electroRifle:{name:'电磁步枪',unit:'electro_trooper',stat:'atk',needScience:'sci_electric_age',needWeapon:'electro',researchCost:{tech:2000000,medal:50000},stepCost:{steel:10000,godCore:4},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:10,perLevelAtk:1,skill:'rapid'},
    electroSniper:{name:'狙击枪',unit:'electro_trooper',stat:'atk',needScience:'sci_electric_age',needWeapon:'electroRifle',researchCost:{tech:2500000,medal:70000},stepCost:{steel:10000,godCore:4},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:10,perLevelAtk:1,skill:'snipe'},
    electroArmor:{name:'电磁甲',unit:'electro_trooper',stat:'def',needScience:'sci_electric_age',needWeapon:'electroSniper',researchCost:{tech:300000,medal:15000},stepCost:{steel:200000},maxLevel:3,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialDef:10,perLevelDef:10},
    // 母本470075/076、220072/073：机巧阶段的进阶护甲；20级后每次锻造改付内部材料键 godCore 10。
    energyArmor:{name:'能源甲',unit:'electro_trooper',stat:'def',needScience:'sci_electric_age',needWeapon:'electroArmor',researchCost:{tech:3000000,medal:80000},stepCost:{godCore:4},lateStepCost:{godCore:10},lateFromLevel:20,maxLevel:40,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialDef:5,perLevelDef:5,skill:'energy'},
    nanoArmor:{name:'纳米甲',unit:'electro_trooper',stat:'def',needScience:'sci_electric_age',needWeapon:'energyArmor',researchCost:{tech:3500000,medal:100000},stepCost:{godCore:4},lateStepCost:{godCore:10},lateFromLevel:20,maxLevel:40,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialDef:5,perLevelDef:5,skill:'nano'},
    // 母本470081→082／230082→083；机器外形随星界主题命名。异兽附伤仅在目标明确标记源530001–009时启用。
    starFighter:{name:'星界战机',unit:'star_trooper',stat:'atk',needScience:'sci_nuclear_age',researchCost:{tech:100000000,medal:1000000},stepCost:{steel:10000,godCore:8},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:10,perLevelAtk:1,skill:'starFighter'},
    starMissile:{name:'星陨飞弹',unit:'star_trooper',stat:'atk',needScience:'sci_nuclear_age',needWeapon:'starFighter',researchCost:{tech:100000000,medal:1000000},stepCost:{steel:10000,godCore:8},maxLevel:20,firstSteps:20,nextStepBase:10,nextStepPerLevel:2,initialAtk:10,perLevelAtk:1,skill:'starMissile'}
  },
  // 母本首击效果在逐兵量纲；本项目将出战兵团聚合，并把源攻击伤害按10:1攻、100:1生命再乘0.1。
  starWeaponSkills:{fighter:{attackPct:1.35,defBreak:30,hpStep:10,damagePerHpStep:0.3,defPerHpStep:20,beastCurrentHpPct:0.18,beastCapAtk:30,sourceHpScale:0.1},
    missile:{minEnemyCount:1001,maxTargets:1000,readyHpPct:0.5,attackPct:0.07,sourceHpScale:0.1,hpStep:10,damagePerHpStep:0.3,defStep:30,defBase:1}},
  eraMaterials:{
    godCrystal:{name:'遗迹晶核',max:1000000,source:'机巧遗迹·守卫机兵战斗胜利'},
    guardianStone:{name:'防护模块',max:1000000,source:'重装防卫机挑战胜利'},
    revivalLeaf:{name:'圣愈叶',max:1000000,source:'复苏圣域·复苏圣像挑战胜利'},
    trialFruit:{name:'圣域异果',max:1000000,source:'缄默神域·缄默之神挑战胜利'},
    phantomFlower:{name:'相位晶簇',max:1000000,source:'光学拟态机挑战胜利'},
    godCore:{name:'高能核心',max:1000000,source:'战术演算机挑战胜利'},
    boarHeart:{name:'兽心',max:1000000,source:'郊野猎场·野猪群战斗胜利'},
    bullHorn:{name:'蛮牛角',max:1000000,source:'郊野猎场·蛮牛群战斗胜利'},
    snakeGall:{name:'毒蛇胆',max:1000000,source:'郊野猎场·毒蛇群战斗胜利'},
    tigerPelt:{name:'霜纹虎皮',max:1000000,source:'郊野猎场·霜纹虎群战斗胜利'},
    turtleShell:{name:'铁甲龟壳',max:1000000,source:'郊野猎场·铁甲龟群战斗胜利'},
    wyrmSinew:{name:'铁脊蜥龙筋',max:1000000,source:'郊野猎场·铁脊蜥龙群战斗胜利'},
    storageScroll:{name:'机巧拓仓图纸Ⅰ',max:1000,source:'边贸行30级六类郊野材料兑换'},
    storageScroll2:{name:'星图密卷Ⅱ',max:1000,source:'边贸行30级消耗机巧拓仓图纸Ⅰ兑换'},
    storageScroll3:{name:'圣界密卷Ⅲ',max:1000,source:'边贸行40级消耗机巧拓仓图纸Ⅰ兑换'},
    storageScroll4:{name:'遗神密卷Ⅳ',max:1000,source:'边贸行50级消耗机巧拓仓图纸Ⅰ兑换'},
    storageScroll5:{name:'渊海密卷Ⅴ',max:1000,source:'边贸行60级消耗机巧拓仓图纸Ⅰ兑换'},
    sacredBlood:{name:'圣兽血剂',max:300000,source:'神域材料战胜利或市场金铸币购买；母本麒麟凝血丹180001的主题名'},
    domainCleanser:{name:'镇域净化剂',max:20000,source:'市场以3份圣兽血剂兑换；消耗后降低指定神域警戒值100'},
    emberElixir:{name:'炽翼战剂',max:5000,source:'神域胜利稀有掉落或市场以20份圣兽血剂兑换；母本朱雀造化丹180002的主题名'},
    aegisElixir:{name:'圣盾秘剂',max:5000,source:'神域胜利稀有掉落或市场以3份炽翼战剂兑换；母本玄武清虚丹180003的主题名'},
    soulStone:{name:'英魂铭石',max:500000,source:'英魂遗境战斗胜利；边贸行60级战剂或秘剂兑换'},
    starOriginStone:{name:'星辉原石',max:20000000,source:'星界兽域·异兽战斗胜利，用于圣阵槽位升级'},
    illusionStone:{name:'幻相石',max:20000000,source:'星界兽域·异兽战斗胜利，用于圣阵知识属性刻印'},
    sacredRingCore:{name:'圣环核石',max:20000000,source:'星界兽域·异兽战斗胜利，用于圣阵开槽'}
  },
  // 母本 320000／170021–170023 的我方首版：只开放已实装的知识仓属性，刻印为定向操作。
  starArray:{unit:'star_trooper',needScience:'sci_star_array',slots:20,maxLevel:10,
    openCostPerIndex:1000,attuneCostPerIndex:100,upgradeCostPerIndexLevel:20,
    awakeningLevel:20,starScale:[[50,0.6],[100,0.8],[150,1],[200,1.2],[250,1.4],[300,1.6]]},
  // 源 530001–530009：九阶星兽每日各可胜一次，三种圣阵材料同额掉落。
  // P389 已付档敏感性校准：源单兵生命换为本项目聚合生命 /170；源攻击、防御各 /100。
  // 六队同时出手，聚合生命每损失约 1/6 时减少一条活跃队列。
  starBeast:{needScience:'sci_star_beast_domain',unit:'wild_wyrm',count:1200,activeQueues:6,
    hpDivisor:170,atkDivisor:100,defDivisor:100,alertStep:1000,hpGrowth:1.2,atkDefGrowth:1.1,
    rewardGrowthPerStep:0.2,freeCalmsPerDay:3,calmAmount:1000,
    tiers:[
      {tier:1,hp:30000,atk:3000,def:500,reward:10,alert:100},
      {tier:2,hp:50000,atk:3000,def:600,reward:20,alert:150},
      {tier:3,hp:80000,atk:3000,def:700,reward:30,alert:200},
      {tier:4,hp:100000,atk:3000,def:700,reward:50,alert:250},
      {tier:5,hp:120000,atk:3000,def:800,reward:70,alert:300},
      {tier:6,hp:150000,atk:3000,def:800,reward:100,alert:350},
      {tier:7,hp:200000,atk:3000,def:900,reward:140,alert:400},
      {tier:8,hp:250000,atk:3000,def:900,reward:190,alert:450},
      {tier:9,hp:300000,atk:5000,def:1000,reward:250,alert:500}
    ]},
  // 母本 winGodWar 每胜保底凝血丹1；本次胜利后的警戒值跨2001/4001/6001时分别升至2/3/4。
  godBloodRewardTiers:[[2001,2],[4001,3],[6001,4]],
  // 母本180001：指定兵种每服用1枚基础HP永久+1%，基础上限300次；我方100:1生命口径用小数生命保留增量。
  bloodline:{item:'sacredBlood',hpPerUse:0.01,limitPerUnit:300},
  // 母本180002：每份永久增加指定兵种基础ATK的10%，基础上限30；神域胜后警戒分档随机掉落。
  emberElixir:{item:'emberElixir',atkPerUse:0.1,limitPerUnit:30,dropChanceTiers:[[2001,200],[4001,300],[6001,400]],baseDropChance:100},
  // 母本180003：每份指定兵种基础DEF+1、基础ATK/HP各+5%，上限30；神域胜后警戒分档随机掉落。
  aegisElixir:{item:'aegisElixir',defPerUse:1,atkPerUse:0.05,hpPerUse:0.05,limitPerUnit:30,
    dropChanceTiers:[[2001,100],[4001,150],[6001,200]],baseDropChance:50},
  godDomain:{key:'godCrystal',name:'机巧遗迹·守卫机兵',needScience:'sci_god_domain',boss:true,bossMult:{atk:1,def:1},units:{god_crystal_guard:[40]},reward:{godCrystal:1},bonusReward:{medal:40},bonusItemReward:{sacredBlood:1},killValuePerWin:100,
    monsterTiers:[[500,1.2],[800,1.4],[1000,1.6],[1500,1.8],[2000,3],[3000,4],[3500,5],[4000,6],[4500,7],[5000,10],[6000,20],[7000,30],[8000,40],[9000,50],[10000,60],[10400,70],[10700,80],[11000,90],[11400,100],[11700,120],[12000,140],[12400,160],[12700,180],[13000,5000]],
    rewardTiers:[[500,1.1],[800,1.2],[1000,1.5],[1500,1.8],[2000,2.5],[3000,3],[4000,3.5],[6000,4],[7000,4.5],[8000,5],[10500,6],[11000,7],[12000,8]]},
  godDomains:{
    phantomFlower:{key:'phantomFlower',name:'光学拟态机',needScience:'sci_electric_age',killValueKey:'godPhantom',boss:true,
      units:{phantom_god:[47]},reward:{phantomFlower:2},bonusReward:{medal:40},bonusItemReward:{sacredBlood:1},killValuePerWin:100},
    guardianStone:{key:'guardianStone',name:'重装防卫机',needScience:'sci_electric_age',killValueKey:'godGuardian',boss:true,
      units:{guardian_god:[53]},reward:{guardianStone:2},bonusReward:{medal:40},bonusItemReward:{sacredBlood:1},killValuePerWin:100},
    revivalLeaf:{key:'revivalLeaf',name:'复苏圣域·复苏圣像',needScience:'sci_nuclear_age',killValueKey:'godRebirth',boss:true,
      units:{revival_god:[60]},reward:{revivalLeaf:2},bonusItemReward:{sacredBlood:1},killValuePerWin:100},
    trialFruit:{key:'trialFruit',name:'缄默神域·缄默之神',needScience:'sci_nuclear_age',killValueKey:'godSilence',boss:true,
      units:{silence_god:[40]},reward:{trialFruit:2},bonusItemReward:{sacredBlood:1},killValuePerWin:100},
    medal:{key:'medal',name:'战术演算机',needScience:'sci_electric_age',killValueKey:'godSlaughter',boss:true,resourceReward:true,
      units:{slaughter_god:[47]},reward:{medal:40},bonusItemReward:{godCore:1,sacredBlood:1},killValuePerWin:100},
    soulStone:{key:'soulStone',name:'英魂遗境·遗境英魂',needScience:'sci_soul_realm',killValueKey:'soulRealm',boss:true,soulRealm:true,noCleanser:true,
      units:{soul_wraith:[100]},reward:{soulStone:1},killValuePerWin:100}
  },
  soulRank:{item:'soulStone',needScience:'sci_astral_lord',maxRank:5,starsPerRank:10,stonePerStar:100,rankUpMultiplier:10},
  soulRealm:{slots:9,activeQueues:6,growth:{alertStep:1000,hp:1.4,atk:1.2,def:1.2,count:1.3},tiers:[
    {id:540199,min:0,max:3000,weight:1000,hp:5000,atk:800,def:300,count:400,stone:1,alert:100,name:'残缺英魂'},
    {id:540299,min:0,max:5000,weight:700,hp:8000,atk:1000,def:500,count:500,stone:2,alert:150,name:'普通英魂'},
    {id:540399,min:2000,max:7000,weight:500,hp:10000,atk:1300,def:1000,count:550,stone:3,alert:200,name:'精英英魂'},
    {id:540499,min:4000,max:8500,weight:300,hp:20000,atk:2000,def:1300,count:650,stone:5,alert:250,name:'史诗英魂'},
    {id:540599,min:5000,max:12000,weight:100,hp:30000,atk:3000,def:2000,count:750,stone:7,alert:300,name:'传说英魂'},
    {id:540699,min:6000,max:1000000,weight:30,hp:60000,atk:3000,def:3000,count:900,stone:15,alert:300,name:'神话英魂'}
  ]},
  // 母本 GodGameLv 独立于 ArmsUP/ArmySeaList：胜利升1阶，星数按阶段与难度累积。
  awakening:{unit:'star_trooper',maxLevel:20,fruit:'trialFruit',globalStatPerStar:0.002,
    reference:{armyGodPer:2.1,guardCount:50,guardAtk:30,guardHp:200,guardDef:5,hpDivisor:10,atkDivisor:10},
    // 母本逐兵触发；我方合并兵团按星际兵存活人数／守卫现有Boss出手规模逐次掷骰。
    combatSkills:{starDefBreak:{chancePctPerStar:0.6,entryAtkPct:0.1},
      starTrueHit:{chancePctPerStar:0.3,entryDefPct:10},
      // 母本370009第三技：仅首位星际兵100星后可触发，群体生命压至入场90%、防御至少削4%。
      starJudgement:{minStars:100,chancePctPerStar:0.7,firstTeamId:0,readyHpPct:0.99,
        remainingHpPct:0.9,baseDefPct:0.04,extraDefPctPerHpStep:0.02,hpStep:2000,maxDefPct:0.2,
        sourceHpPerLocalHp:100},
      // 源攻击已÷10、我方单兵生命约÷100；附伤再×0.1，保持源攻/我血的量纲比例。
      easyGuardTrueHit:{chance:0.3,attackPct:0.3,localHpScale:0.1},
      // 540091–093 首次防御的神力／神体；压制仅作用于本场临时属性。
      trialGuardDefense:{types:['trial_guard_easy','trial_guard_perfect','trial_guard_extreme'],
        statCapMultiplier:3,defenseCapGuardAtkPct:0.4,attackFloorPct:0.7,defenseFloorPct:0.1,
        alliesAttackPerThousand:0.02,floorMaxAttack:100000000}},
    trials:{easy:{name:'简单',stars:1,unit:'trial_guard_easy'},perfect:{name:'完美',stars:2,unit:'trial_guard_perfect'},extreme:{name:'极限',stars:3,unit:'trial_guard_extreme'}}},
  // 母本550001普通品质野猪：兽骨15、胜后警戒值+10；我方兵团HP=人数，10人/攻击2是本地战斗适配。
  wildHunt:{key:'bone',name:'郊野猎场·野猪群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'boarHeart',killValueKey:'wildBoar',killValuePerWin:10,
    units:{wild_boar:[10]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25},
  // 母本550011/021/031/041/051的普通品质猎场；中档群体数量映到我方兵团HP，基础攻击按现行战斗公式适配。
  wildHunts:{
    bullHorn:{key:'bullHorn',name:'郊野猎场·蛮牛群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'bullHorn',killValueKey:'wildBull',killValuePerWin:10,
      units:{wild_bull:[12]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25},
    snakeGall:{key:'snakeGall',name:'郊野猎场·毒蛇群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'snakeGall',killValueKey:'wildSnake',killValuePerWin:10,
      units:{wild_snake:[30]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25},
    tigerPelt:{key:'tigerPelt',name:'郊野猎场·霜纹虎群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'tigerPelt',killValueKey:'wildTiger',killValuePerWin:10,
      units:{wild_tiger:[14]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25},
    turtleShell:{key:'turtleShell',name:'郊野猎场·铁甲龟群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'turtleShell',killValueKey:'wildTurtle',killValuePerWin:10,
      units:{wild_turtle:[8]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25},
    wyrmSinew:{key:'wyrmSinew',name:'郊野猎场·铁脊蜥龙群',boss:false,resourceReward:true,wildHunt:true,primaryReward:'bone',dropItem:'wyrmSinew',killValueKey:'wildWyrm',killValuePerWin:10,
      units:{wild_wyrm:[6]},reward:{bone:15,hide:2},heartChanceBase:60,heartChancePerKill:1/200,heartMaxReward:25}
  },
  // 母本290015交换所Lv0：兽骨10→勋章20，成功率100%；独立于市场每日次数。
  beastExchange:{name:'边贸行',bonePerTrade:10,medalPerTrade:20,maxLevel:300,firstProgress:20,progressStep:5,
    // 母本兽皮货位各权重1；麻布290031–033尚无本项目资源轨，权重仍留在总池中。
    hideTrades:{
      290001:{weight:1,cost:10,get:'food',amount:1000},290002:{weight:1,cost:20,get:'food',amount:2200},290003:{weight:1,cost:50,get:'food',amount:6000},
      290011:{weight:1,cost:10,get:'wood',amount:600},290012:{weight:1,cost:20,get:'wood',amount:1320},290013:{weight:1,cost:50,get:'wood',amount:3600},
      290021:{weight:1,cost:10,get:'stone',amount:400},290022:{weight:1,cost:20,get:'stone',amount:880},290023:{weight:1,cost:50,get:'stone',amount:2400},
      290041:{weight:1,cost:10,get:'coal',amount:400},290042:{weight:1,cost:20,get:'coal',amount:880},290043:{weight:1,cost:50,get:'coal',amount:2400}},
    scrollLevel:30,heartPerScroll:200,scrollCapacityPerUse:0.01,scrollUseLimit:500,
    // 母本290080–083：按当轮货位品质折价消耗Ⅰ阶图纸，不叠交易所等级加价。
    highScrollTrades:{
      2:{level:30,weight:20,firstScrollCost:3,capacityPerUse:0.015,useLimit:500},
      3:{level:40,weight:10,firstScrollCost:4,capacityPerUse:0.02,useLimit:500},
      4:{level:50,weight:10,firstScrollCost:5,capacityPerUse:0.025,useLimit:500},
      5:{level:60,weight:10,firstScrollCost:6,capacityPerUse:0.03,useLimit:500}
    },
    // 母本290017：60级货位，兽骨300换勋章1200，权重20；既有常驻兽骨兑换保持兼容。
    medalOfferTrade:{sourceId:290017,level:60,weight:20,boneCost:300,medalGain:1200},
    // 母本交易所290098/290099：60级解锁，丹药10份换英魂石4/12枚，各占30权重。
    soulTradeLevel:60,soulTrades:{
      emberElixir:{sourceId:290098,weight:30,cost:10,stones:4},
      aegisElixir:{sourceId:290099,weight:30,cost:10,stones:12}},
    refreshSeconds:1200,maxRefreshCharges:5,baseOfferSlots:8,slotsPerLevels:10,maxOfferSlots:14,heartOfferWeight:10,
    // 母本交易所离线被动给付：满15分钟、Lv25起，按等级和住房容量发骨、勋章、地契。
    offlineReward:{minSeconds:900,levelOffset:15,levelsPerTier:10,maxTier:30,populationStep:1000,populationBonus:0.05,rates:{bone:2,medal:0.5,deed:0.3}},
    scrollMaterials:['boarHeart','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'],
    // 母本交易所各等级商品总权重；仅投影已接入的图纸、铭石与60级勋章货位，其余商品保留在权重池。
    offerTotalWeights:[[0,265],[30,445],[40,515],[50,570],[60,680],[80,688],[90,693],[100,698]]},
  eraStorage:{
    steamBasic:{name:'蒸汽基础仓库',needScience:'sci_steam_age',maxLevel:100,perLevel:0.1,group:'basic',techBase:500000,lateCrystalBase:5},
    steamMetal:{name:'蒸汽金属仓库',needScience:'sci_steam_age',maxLevel:100,perLevel:0.1,group:'metal',techBase:500000,lateCrystalBase:5},
    steamKnowledge:{name:'蒸汽科研技术',needScience:'sci_steam_age',maxLevel:100,perLevel:0.1,group:'knowledge',techBase:300000,lateCrystalBase:10},
    electricBasic:{name:'电力基础仓库',needScience:'sci_electric_age',maxLevel:100,perLevel:0.1,group:'basic',techBase:3000000,lateMaterial:'guardianStone',lateMaterialBase:10},
    electricMetal:{name:'电力金属仓库',needScience:'sci_electric_age',maxLevel:100,perLevel:0.1,group:'metal',techBase:3000000,lateMaterial:'guardianStone',lateMaterialBase:10},
    electricKnowledge:{name:'电力科研技术',needScience:'sci_electric_age',maxLevel:100,perLevel:0.1,group:'knowledge',techBase:2000000,lateMaterial:'guardianStone',lateMaterialBase:20},
    electricProduction:{name:'电力生产技术',needScience:'sci_electric_age',maxLevel:100,perLevel:0.1,group:'production',techBase:1000000,lateMaterial:'phantomFlower',lateMaterialBase:30},
    nuclearBasic:{name:'星核基础仓储',needScience:'sci_nuclear_age',maxLevel:100,perLevel:0.1,group:'basic',techBase:30000000,lateMaterial:'godCrystal',lateMaterialBase:50},
    nuclearMetal:{name:'星核金属仓储',needScience:'sci_nuclear_age',maxLevel:100,perLevel:0.1,group:'metal',techBase:30000000,lateMaterial:'guardianStone',lateMaterialBase:50},
    nuclearKnowledge:{name:'星核秘典研究',needScience:'sci_nuclear_age',maxLevel:100,perLevel:0.1,group:'knowledge',techBase:20000000,lateMaterial:'revivalLeaf',lateMaterialBase:100},
    nuclearProduction:{name:'星核生产技术',needScience:'sci_nuclear_age',maxLevel:100,perLevel:0.1,group:'production',techBase:10000000,lateMaterial:'phantomFlower',lateMaterialBase:150},
    quantumBasic:{name:'界域基础仓储',needScience:'sci_quantum_age',maxLevel:100,perLevel:0.1,group:'basic',techBase:500000000,lateMaterial:'godCrystal',lateMaterialBase:300},
    quantumMetal:{name:'界域金属仓储',needScience:'sci_quantum_age',maxLevel:100,perLevel:0.1,group:'metal',techBase:500000000,lateMaterial:'guardianStone',lateMaterialBase:300},
    quantumKnowledge:{name:'星界秘典研究',needScience:'sci_quantum_age',maxLevel:100,perLevel:0.1,group:'knowledge',techBase:500000000,lateMaterial:'revivalLeaf',lateMaterialBase:600},
    quantumProduction:{name:'位面工坊技术',needScience:'sci_quantum_age',maxLevel:100,perLevel:0.1,group:'production',techBase:1000000000,lateMaterial:'phantomFlower',lateMaterialBase:1000}
  },
  save:    { schema:24 }                                                            // v24 电磁步枪→狙击枪→电磁甲装备链
};
