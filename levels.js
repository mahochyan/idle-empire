// ==================== 关卡配置 ====================
// 独立关卡文件，方便调试敌方数值和阵容
// 共30关，第10/20/30关为Boss关，难度递增

CFG.enemies = [
  // ===== 第一章：步兵+弓兵 (L1-L9) =====
  {id:1,name:'侦察兵小队',desc:'三五步兵，不堪一击',units:{infantry:[3,2]},reward:{wood:100,stone:70,food:60}},
  {id:2,name:'步兵巡逻队',desc:'两支步兵小队合流',units:{infantry:[5,3]},reward:{wood:140,stone:100,food:85}},
  {id:3,name:'弓兵前哨',desc:'弓兵加入战场，注意后排',units:{infantry:[4,3],archer:[3,2]},reward:{wood:180,stone:130,food:110}},
  {id:4,name:'步弓混编',desc:'前后排配合，考验布阵',units:{infantry:[6,4],archer:[4,3]},reward:{wood:220,stone:160,food:140}},
  {id:5,name:'重步方阵',desc:'三队步兵呈品字推进',units:{infantry:[6,5,3]},reward:{wood:260,stone:190,food:170}},
  {id:6,name:'弓箭手阵地',desc:'弓兵数量增多，前排压力大',units:{infantry:[8,5],archer:[6,5]},reward:{wood:310,stone:230,food:200}},
  {id:7,name:'突袭营地',desc:'步弓配合默契，数量压制',units:{infantry:[9,7],archer:[8,5]},reward:{wood:360,stone:270,food:240}},
  {id:8,name:'守备队',desc:'训练有素的守备部队',units:{infantry:[10,8],archer:[10,7]},reward:{wood:420,stone:320,food:280}},
  {id:9,name:'前线指挥官',desc:'Boss前最后一道防线',units:{infantry:[12,9,6],archer:[10,8,5]},reward:{wood:490,stone:370,food:330}},

  // ===== 第10关 Boss：守关大将 =====
  {id:10,name:'守关大将',desc:'BOSS·重甲步弓，威势逼人',units:{infantry:[16,12,8],archer:[14,10,6]},boss:true,bossMult:{atk:1.30,def:1.25},reward:{wood:1200,stone:900,food:800}},

  // ===== 第二章：骑兵+矛兵加入 (L11-L19) =====
  {id:11,name:'骑兵斥候',desc:'骑兵首现，速度快冲击猛',units:{cavalry:[8,5],infantry:[6]},reward:{wood:520,stone:390,food:350}},
  {id:12,name:'骑步协同',desc:'骑兵冲锋，步兵跟进',units:{cavalry:[10,7],infantry:[8,6]},reward:{wood:560,stone:420,food:380}},
  {id:13,name:'弓骑袭扰',desc:'骑射配合，前后夹击',units:{cavalry:[10,6],infantry:[7],archer:[8,6]},reward:{wood:600,stone:450,food:410}},
  {id:14,name:'重骑突击',desc:'骑兵主力，数量压制',units:{cavalry:[14,10],infantry:[10,7],archer:[6]},reward:{wood:650,stone:490,food:440}},
  {id:15,name:'长矛兵首战',desc:'矛兵反骑，破甲克敌',units:{spearman:[8,5],cavalry:[10],infantry:[8]},reward:{wood:700,stone:530,food:480}},
  {id:16,name:'矛步方阵',desc:'矛兵结阵，步兵护翼',units:{spearman:[10,7],infantry:[10,8],archer:[6,4]},reward:{wood:760,stone:570,food:520}},
  {id:17,name:'三军会战',desc:'步骑矛三方混编',units:{infantry:[12,8],cavalry:[10,6],spearman:[8,5]},reward:{wood:820,stone:620,food:560}},
  {id:18,name:'精锐先锋',desc:'装备精良的先锋部队',units:{cavalry:[14,8],spearman:[10,7],infantry:[10],archer:[8]},reward:{wood:880,stone:670,food:600}},
  {id:19,name:'副将镇守',desc:'Boss前哨，兵力雄厚',units:{cavalry:[16,10],spearman:[12,8],infantry:[12,8],archer:[10,7]},reward:{wood:950,stone:720,food:650}},

  // ===== 第20关 Boss：骑兵统领 =====
  {id:20,name:'骑兵统领',desc:'BOSS·铁骑如潮，雷霆万钧',units:{cavalry:[20,14,8],spearman:[14,10],infantry:[14],archer:[12,8]},boss:true,bossMult:{atk:1.35,def:1.30},reward:{wood:2200,stone:1700,food:1500}},

  // ===== 第三章：全兵种混编+法师 (L21-L29) =====
  {id:21,name:'法师小队',desc:'法师首现，高伤脆皮',units:{mage:[8,5],infantry:[10,7],archer:[6]},reward:{wood:980,stone:750,food:680}},
  {id:22,name:'法步协同',desc:'法师后排输出，步兵前排抗线',units:{mage:[10,7],infantry:[14,8],archer:[8]},reward:{wood:1040,stone:790,food:720}},
  {id:23,name:'混合编队',desc:'五兵种协同作战',units:{infantry:[14,8],cavalry:[10],spearman:[10],archer:[8,6],mage:[8,5]},reward:{wood:1100,stone:840,food:760}},
  {id:24,name:'法术压制',desc:'双法师输出，前排必须顶住',units:{mage:[12,9],infantry:[16,10],spearman:[10,6]},reward:{wood:1160,stone:890,food:800}},
  {id:25,name:'重装方阵',desc:'全兵种重装推进',units:{infantry:[16,12],cavalry:[14,8],spearman:[12,8],archer:[10,8],mage:[10,6]},reward:{wood:1230,stone:940,food:850}},
  {id:26,name:'精英卫队',desc:'训练有素的精锐混编',units:{infantry:[18,12],cavalry:[16,8],spearman:[14,8],archer:[12,8],mage:[12,8]},reward:{wood:1300,stone:1000,food:900}},
  {id:27,name:'大军压境',desc:'敌兵力雄厚，全面压制',units:{infantry:[20,14],cavalry:[16,10],spearman:[14,10],archer:[14,10],mage:[12,8]},reward:{wood:1380,stone:1060,food:960}},
  {id:28,name:'钢铁防线',desc:'前排坚不可摧，寻找突破口',units:{infantry:[24,16],cavalry:[16,12],spearman:[16,10],archer:[14,8],mage:[10]},reward:{wood:1460,stone:1130,food:1020}},
  {id:29,name:'统帅近卫',desc:'Boss前的终极考验',units:{infantry:[24,16,8],cavalry:[18,12],spearman:[16,12],archer:[16,12,8],mage:[14,10]},reward:{wood:1550,stone:1200,food:1090}},

  // ===== 第30关 Boss：帝国元帅 =====
  {id:30,name:'帝国元帅',desc:'BOSS·万军之主，最终决战',units:{infantry:[28,20,12],cavalry:[22,16,8],spearman:[20,14],archer:[18,14,10],mage:[18,12,8]},boss:true,bossMult:{atk:1.45,def:1.40},reward:{wood:4000,stone:3200,food:2800}}
];
