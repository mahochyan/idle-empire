// ==================== 关卡配置 ====================
// 100关，10章×10关，每10关一个Boss，难度递增

CFG.enemies = [
  // ===== 第一章：步兵+弓兵 (L1-L10) =====
  {id:1,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[4,3]},reward:{"wood":100,"stone":70,"food":60}},
  {id:2,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[5,4]},reward:{"wood":108,"stone":75,"food":64}},
  {id:3,name:'弓兵哨位',desc:'几名弓手躲在暗处',units:{"infantry":[6,5]},reward:{"wood":116,"stone":81,"food":69}},
  {id:4,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[7,5,3],"archer":[7,5,3]},reward:{"wood":125,"stone":88,"food":75}},
  {id:5,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[8,6,4],"archer":[8,6,4]},reward:{"wood":136,"stone":95,"food":81}},
  {id:6,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":146,"stone":102,"food":88}},
  {id:7,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":158,"stone":111,"food":95}},
  {id:8,name:'弓兵哨位',desc:'密集的箭雨即将来袭',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":171,"stone":119,"food":102}},
  {id:9,name:'弓兵哨位',desc:'密集的箭雨即将来袭',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":185,"stone":129,"food":111}},
  // ===== 第10关 Boss =====
  {id:10,name:'守关大将',desc:'BOSS·重甲步弓，威势逼人',units:{"infantry":[1,1,1],"archer":[1,1,1]},boss:true,bossMult:{"atk":1.3,"def":1.25},reward:{"wood":1200,"stone":840,"food":720},drops:{"shield_essence":{"prob":0.5,"count":1},"spear_essence":{"prob":0.5,"count":1},"sword_essence":{"prob":0.5,"count":1}}},

  // ===== 第二章：骑兵加入 (L11-L20) =====
  {id:11,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[4,3]},reward:{"wood":500,"stone":375,"food":340}},
  {id:12,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[5,4]},reward:{"wood":530,"stone":397,"food":360}},
  {id:13,name:'弓兵哨位',desc:'几名弓手躲在暗处',units:{"infantry":[6,5]},reward:{"wood":561,"stone":421,"food":382}},
  {id:14,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[7,5,3],"archer":[7,5,3]},reward:{"wood":595,"stone":446,"food":404}},
  {id:15,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[8,6,4],"archer":[8,6,4]},reward:{"wood":631,"stone":473,"food":429}},
  {id:16,name:'骑兵斥候',desc:'重骑兵发起冲锋',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":669,"stone":501,"food":454}},
  {id:17,name:'骑兵斥候',desc:'重骑兵发起冲锋',units:{"infantry":[10,7,4],"archer":[10,7,4],"cavalry":[10,7,4]},reward:{"wood":709,"stone":531,"food":482}},
  {id:18,name:'骑兵斥候',desc:'铁骑踏破防线',units:{"infantry":[11,8,5],"archer":[11,8,5],"cavalry":[11,8,5]},reward:{"wood":751,"stone":563,"food":511}},
  {id:19,name:'骑兵斥候',desc:'铁骑踏破防线',units:{"infantry":[12,9,5],"archer":[12,9,5],"cavalry":[12,9,5]},reward:{"wood":796,"stone":597,"food":541}},
  // ===== 第20关 Boss =====
  {id:20,name:'骑兵统领',desc:'BOSS·铁骑如潮，雷霆万钧',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1]},boss:true,bossMult:{"atk":1.35,"def":1.3},reward:{"wood":6000,"stone":4500,"food":4080},drops:{"bow_essence":{"prob":0.55,"count":1},"crossbow_essence":{"prob":0.55,"count":1},"blade_essence":{"prob":0.55,"count":1}}},

  // ===== 第三章：法师登场 (L21-L30) =====
  {id:21,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[5,4]},reward:{"wood":950,"stone":720,"food":660}},
  {id:22,name:'步兵小队',desc:'零散的步兵正在巡逻',units:{"infantry":[6,5]},reward:{"wood":997,"stone":756,"food":693}},
  {id:23,name:'弓兵哨位',desc:'几名弓手躲在暗处',units:{"infantry":[7,5]},reward:{"wood":1047,"stone":793,"food":727}},
  {id:24,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[8,6,4],"archer":[8,6,4]},reward:{"wood":1099,"stone":833,"food":764}},
  {id:25,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":1154,"stone":875,"food":802}},
  {id:26,name:'骑兵斥候',desc:'重骑兵发起冲锋',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":1212,"stone":918,"food":842}},
  {id:27,name:'骑兵斥候',desc:'重骑兵发起冲锋',units:{"infantry":[11,8,5],"archer":[11,8,5],"cavalry":[11,8,5]},reward:{"wood":1273,"stone":964,"food":884}},
  {id:28,name:'骑兵斥候',desc:'铁骑踏破防线',units:{"infantry":[12,9,5],"archer":[12,9,5],"cavalry":[12,9,5]},reward:{"wood":1336,"stone":1013,"food":928}},
  {id:29,name:'学徒结社',desc:'强大的魔法能量涌动',units:{"infantry":[13,10,6],"archer":[13,10,6],"cavalry":[13,10,6],"mage":[13,10,6]},reward:{"wood":1403,"stone":1063,"food":975}},
  // ===== 第30关 Boss =====
  {id:30,name:'帝国元帅',desc:'BOSS·万军之主',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.4,"def":1.35},reward:{"wood":11400,"stone":8640,"food":7920},drops:{"shield_essence":{"prob":0.6,"count":1},"spear_essence":{"prob":0.6,"count":1},"sword_essence":{"prob":0.6,"count":1}}},

  // ===== 第四章：全兵混编 (L31-L40) =====
  {id:31,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[5,4]},reward:{"wood":1550,"stone":1180,"food":1000}},
  {id:32,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[6,5]},reward:{"wood":1627,"stone":1239,"food":1050}},
  {id:33,name:'长弓阵地',desc:'几名弓手躲在暗处',units:{"infantry":[7,5]},reward:{"wood":1708,"stone":1300,"food":1102}},
  {id:34,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[8,6,4],"archer":[8,6,4]},reward:{"wood":1794,"stone":1365,"food":1157}},
  {id:35,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":1884,"stone":1434,"food":1215}},
  {id:36,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":1978,"stone":1506,"food":1276}},
  {id:37,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[11,8,5],"archer":[11,8,5],"cavalry":[11,8,5]},reward:{"wood":2077,"stone":1581,"food":1340}},
  {id:38,name:'重骑突击',desc:'铁骑踏破防线',units:{"infantry":[12,9,5],"archer":[12,9,5],"cavalry":[12,9,5]},reward:{"wood":2181,"stone":1660,"food":1407}},
  {id:39,name:'秘法团',desc:'强大的魔法能量涌动',units:{"infantry":[13,10,6],"archer":[13,10,6],"cavalry":[13,10,6],"mage":[13,10,6]},reward:{"wood":2290,"stone":1743,"food":1477}},
  // ===== 第40关 Boss =====
  {id:40,name:'深渊领主',desc:'BOSS·深渊裂隙的恐怖存在',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.45,"def":1.38},reward:{"wood":18600,"stone":14160,"food":12000},drops:{"bow_essence":{"prob":0.65,"count":2},"crossbow_essence":{"prob":0.65,"count":2},"blade_essence":{"prob":0.65,"count":2}}},

  // ===== 第五章：重装推进 (L41-L50) =====
  {id:41,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[6,5]},reward:{"wood":2300,"stone":1750,"food":1500}},
  {id:42,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[7,5]},reward:{"wood":2392,"stone":1820,"food":1560}},
  {id:43,name:'长弓阵地',desc:'几名弓手躲在暗处',units:{"infantry":[8,6]},reward:{"wood":2487,"stone":1892,"food":1622}},
  {id:44,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":2587,"stone":1968,"food":1687}},
  {id:45,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":2690,"stone":2047,"food":1754}},
  {id:46,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":2798,"stone":2129,"food":1824}},
  {id:47,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[12,9,5],"archer":[12,9,5],"cavalry":[12,9,5]},reward:{"wood":2910,"stone":2214,"food":1897}},
  {id:48,name:'重骑突击',desc:'铁骑踏破防线',units:{"infantry":[13,10,6],"archer":[13,10,6],"cavalry":[13,10,6]},reward:{"wood":3026,"stone":2302,"food":1973}},
  {id:49,name:'秘法团',desc:'强大的魔法能量涌动',units:{"infantry":[14,10,6],"archer":[14,10,6],"cavalry":[14,10,6],"mage":[14,10,6]},reward:{"wood":3147,"stone":2394,"food":2052}},
  // ===== 第50关 Boss =====
  {id:50,name:'钢铁巨人',desc:'BOSS·全身覆甲，刀枪不入',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.5,"def":1.42},reward:{"wood":27600,"stone":21000,"food":18000},drops:{"shield_essence":{"prob":0.7,"count":2},"spear_essence":{"prob":0.7,"count":2},"sword_essence":{"prob":0.7,"count":2}}},

  // ===== 第六章：精英卫队 (L51-L60) =====
  {id:51,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[7,5]},reward:{"wood":3200,"stone":2450,"food":2100}},
  {id:52,name:'重步卫队',desc:'零散的步兵正在巡逻',units:{"infantry":[8,6]},reward:{"wood":3328,"stone":2548,"food":2184}},
  {id:53,name:'长弓阵地',desc:'几名弓手躲在暗处',units:{"infantry":[9,7]},reward:{"wood":3461,"stone":2649,"food":2271}},
  {id:54,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":3599,"stone":2755,"food":2362}},
  {id:55,name:'长弓阵地',desc:'弓兵占据了有利地形',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":3743,"stone":2866,"food":2456}},
  {id:56,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":3893,"stone":2980,"food":2554}},
  {id:57,name:'重骑突击',desc:'重骑兵发起冲锋',units:{"infantry":[13,10,6],"archer":[13,10,6],"cavalry":[13,10,6]},reward:{"wood":4049,"stone":3100,"food":2657}},
  {id:58,name:'重骑突击',desc:'铁骑踏破防线',units:{"infantry":[14,10,6],"archer":[14,10,6],"cavalry":[14,10,6]},reward:{"wood":4210,"stone":3224,"food":2763}},
  {id:59,name:'秘法团',desc:'强大的魔法能量涌动',units:{"infantry":[15,11,6],"archer":[15,11,6],"cavalry":[15,11,6],"mage":[15,11,6]},reward:{"wood":4379,"stone":3352,"food":2873}},
  // ===== 第60关 Boss =====
  {id:60,name:'暗影将军',desc:'BOSS·夜幕中的暗杀大师',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.55,"def":1.45},reward:{"wood":38400,"stone":29400,"food":25200},drops:{"bow_essence":{"prob":0.75,"count":2},"crossbow_essence":{"prob":0.75,"count":2},"blade_essence":{"prob":0.75,"count":2}}},

  // ===== 第七章：军团对垒 (L61-L70) =====
  {id:61,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[7,5]},reward:{"wood":4300,"stone":3300,"food":2800}},
  {id:62,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[8,6]},reward:{"wood":4472,"stone":3432,"food":2912}},
  {id:63,name:'神射营',desc:'几名弓手躲在暗处',units:{"infantry":[9,7]},reward:{"wood":4650,"stone":3569,"food":3028}},
  {id:64,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[10,7,4],"archer":[10,7,4]},reward:{"wood":4836,"stone":3712,"food":3149}},
  {id:65,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":5030,"stone":3860,"food":3275}},
  {id:66,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":5231,"stone":4014,"food":3406}},
  {id:67,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[13,10,6],"archer":[13,10,6],"cavalry":[13,10,6]},reward:{"wood":5440,"stone":4175,"food":3542}},
  {id:68,name:'铁骑队',desc:'铁骑踏破防线',units:{"infantry":[14,10,6],"archer":[14,10,6],"cavalry":[14,10,6]},reward:{"wood":5658,"stone":4342,"food":3684}},
  {id:69,name:'大法师塔',desc:'强大的魔法能量涌动',units:{"infantry":[15,11,6],"archer":[15,11,6],"cavalry":[15,11,6],"mage":[15,11,6]},reward:{"wood":5884,"stone":4516,"food":3831}},
  // ===== 第70关 Boss =====
  {id:70,name:'亡灵统帅',desc:'BOSS·率领亡灵大军的统帅',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.6,"def":1.48},reward:{"wood":51600,"stone":39600,"food":33600},drops:{"shield_essence":{"prob":0.8,"count":3},"spear_essence":{"prob":0.8,"count":3},"sword_essence":{"prob":0.8,"count":3}}},

  // ===== 第八章：精锐之师 (L71-L80) =====
  {id:71,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[8,6]},reward:{"wood":5600,"stone":4300,"food":3600}},
  {id:72,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[9,7]},reward:{"wood":5768,"stone":4429,"food":3708}},
  {id:73,name:'神射营',desc:'几名弓手躲在暗处',units:{"infantry":[10,7]},reward:{"wood":5941,"stone":4561,"food":3819}},
  {id:74,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":6119,"stone":4698,"food":3933}},
  {id:75,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":6302,"stone":4839,"food":4051}},
  {id:76,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[13,10,6],"archer":[13,10,6]},reward:{"wood":6491,"stone":4984,"food":4173}},
  {id:77,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[14,10,6],"archer":[14,10,6],"cavalry":[14,10,6]},reward:{"wood":6686,"stone":5134,"food":4298}},
  {id:78,name:'铁骑队',desc:'铁骑踏破防线',units:{"infantry":[15,11,6],"archer":[15,11,6],"cavalry":[15,11,6]},reward:{"wood":6887,"stone":5288,"food":4427}},
  {id:79,name:'大法师塔',desc:'强大的魔法能量涌动',units:{"infantry":[16,12,7],"archer":[16,12,7],"cavalry":[16,12,7],"mage":[16,12,7]},reward:{"wood":7093,"stone":5447,"food":4560}},
  // ===== 第80关 Boss =====
  {id:80,name:'炎龙骑士',desc:'BOSS·驾驭炎龙的传奇骑士',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.65,"def":1.52},reward:{"wood":67200,"stone":51600,"food":43200},drops:{"bow_essence":{"prob":0.8500000000000001,"count":3},"crossbow_essence":{"prob":0.8500000000000001,"count":3},"blade_essence":{"prob":0.8500000000000001,"count":3}}},

  // ===== 第九章：帝国主力 (L81-L90) =====
  {id:81,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[8,6]},reward:{"wood":7200,"stone":5500,"food":4600}},
  {id:82,name:'精锐步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[9,7]},reward:{"wood":7416,"stone":5665,"food":4738}},
  {id:83,name:'神射营',desc:'几名弓手躲在暗处',units:{"infantry":[10,7]},reward:{"wood":7638,"stone":5834,"food":4880}},
  {id:84,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[11,8,5],"archer":[11,8,5]},reward:{"wood":7867,"stone":6009,"food":5026}},
  {id:85,name:'神射营',desc:'弓兵占据了有利地形',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":8103,"stone":6190,"food":5177}},
  {id:86,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[13,10,6],"archer":[13,10,6]},reward:{"wood":8346,"stone":6376,"food":5332}},
  {id:87,name:'铁骑队',desc:'重骑兵发起冲锋',units:{"infantry":[14,10,6],"archer":[14,10,6],"cavalry":[14,10,6]},reward:{"wood":8597,"stone":6567,"food":5492}},
  {id:88,name:'铁骑队',desc:'铁骑踏破防线',units:{"infantry":[15,11,6],"archer":[15,11,6],"cavalry":[15,11,6]},reward:{"wood":8855,"stone":6764,"food":5657}},
  {id:89,name:'大法师塔',desc:'强大的魔法能量涌动',units:{"infantry":[16,12,7],"archer":[16,12,7],"cavalry":[16,12,7],"mage":[16,12,7]},reward:{"wood":9120,"stone":6967,"food":5827}},
  // ===== 第90关 Boss =====
  {id:90,name:'皇家禁卫长',desc:'BOSS·帝国最强的禁卫统领',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.7,"def":1.55},reward:{"wood":86400,"stone":66000,"food":55200},drops:{"shield_essence":{"prob":0.9,"count":3},"spear_essence":{"prob":0.9,"count":3},"sword_essence":{"prob":0.9,"count":3}}},

  // ===== 第十章：最终战役 (L91-L100) =====
  {id:91,name:'皇家步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[9,7]},reward:{"wood":9000,"stone":7000,"food":5800}},
  {id:92,name:'皇家步兵',desc:'零散的步兵正在巡逻',units:{"infantry":[10,7]},reward:{"wood":9270,"stone":7210,"food":5974}},
  {id:93,name:'鹰眼射手',desc:'几名弓手躲在暗处',units:{"infantry":[11,8]},reward:{"wood":9548,"stone":7426,"food":6153}},
  {id:94,name:'鹰眼射手',desc:'弓兵占据了有利地形',units:{"infantry":[12,9,5],"archer":[12,9,5]},reward:{"wood":9834,"stone":7649,"food":6337}},
  {id:95,name:'鹰眼射手',desc:'弓兵占据了有利地形',units:{"infantry":[13,10,6],"archer":[13,10,6]},reward:{"wood":10129,"stone":7878,"food":6527}},
  {id:96,name:'圣殿骑士',desc:'重骑兵发起冲锋',units:{"infantry":[14,10,6],"archer":[14,10,6]},reward:{"wood":10433,"stone":8114,"food":6723}},
  {id:97,name:'圣殿骑士',desc:'重骑兵发起冲锋',units:{"infantry":[15,11,6],"archer":[15,11,6],"cavalry":[15,11,6]},reward:{"wood":10746,"stone":8358,"food":6925}},
  {id:98,name:'圣殿骑士',desc:'铁骑踏破防线',units:{"infantry":[16,12,7],"archer":[16,12,7],"cavalry":[16,12,7]},reward:{"wood":11068,"stone":8609,"food":7133}},
  {id:99,name:'奥术议会',desc:'强大的魔法能量涌动',units:{"infantry":[17,12,7],"archer":[17,12,7],"cavalry":[17,12,7],"mage":[17,12,7]},reward:{"wood":11400,"stone":8867,"food":7347}},
  // ===== 第100关 Boss =====
  {id:100,name:'万古之王',desc:'BOSS·传说中一统天下的远古帝王',units:{"infantry":[1,1,1],"archer":[1,1,1],"cavalry":[1,1,1],"mage":[1,1]},boss:true,bossMult:{"atk":1.8,"def":1.6},reward:{"wood":108000,"stone":84000,"food":69600},drops:{"shield_essence":{"prob":0.95,"count":4},"spear_essence":{"prob":0.95,"count":4},"sword_essence":{"prob":0.95,"count":4},"bow_essence":{"prob":0.95,"count":4},"crossbow_essence":{"prob":0.95,"count":4},"blade_essence":{"prob":0.95,"count":4},"wind_essence":{"prob":0.95,"count":4},"iron_essence":{"prob":0.95,"count":4}}},
];
