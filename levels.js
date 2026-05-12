// ==================== 关卡配置 ====================
// 独立关卡文件，方便调试敌方数值和阵容
// 规则：每排最多3个单位，总计不超过9个（3×3上限）

CFG.enemies = [
  // === 第一章：仅步兵+弓兵 (0 Boss，玩家约15-30人) ===
  {id:1,name:'侦察兵小队',desc:'步兵试探，教学关',units:{infantry:[5,3]},reward:{wood:120,stone:90,food:80}},
  {id:2,name:'弓兵巡逻队',desc:'步弓混编，考验前后排',units:{infantry:[5,4],archer:[4,3]},reward:{wood:200,stone:150,food:130}},
  {id:3,name:'步兵方阵',desc:'重步兵推进',units:{infantry:[7,6,4]},reward:{wood:280,stone:200,food:180}},
  {id:99,name:'守关校尉',desc:'BOSS·步弓混编重兵',units:{infantry:[10,8,6],archer:[7,5]},boss:true,bossMult:{atk:1.3,def:1.25},reward:{wood:800,stone:600,food:500}},

  // === 第二章：解锁骑兵 (1 Boss，玩家约30-40人) ===
  {id:4,name:'骑兵侦察队',desc:'骑兵出现，步兵前排抵御',units:{cavalry:[8,6],infantry:[8]},reward:{wood:350,stone:280,food:230}},
  {id:5,name:'骑步混编',desc:'骑兵冲击后排，布好前排',units:{cavalry:[10,8],infantry:[9],archer:[6,5]},reward:{wood:450,stone:350,food:300}},
  {id:98,name:'骑兵统领',desc:'BOSS·骑兵主力，枪兵克制',units:{cavalry:[14,12],infantry:[12],archer:[10,8,6]},boss:true,bossMult:{atk:1.35,def:1.3},reward:{wood:1000,stone:800,food:700}},

  // === 第三章：解锁枪兵+法师 (2 Boss，玩家约40-50人) ===
  {id:6,name:'长矛兵方阵',desc:'长矛兵出现，反骑破甲',units:{spearman:[10,8],infantry:[8],archer:[6]},reward:{wood:550,stone:480,food:400}},
  {id:7,name:'法师小队',desc:'法师高伤脆皮，骑兵切后',units:{mage:[8,6],infantry:[9,7],spearman:[7]},reward:{wood:650,stone:550,food:480}},
  {id:97,name:'混编将军',desc:'BOSS·多兵种协同破阵',units:{infantry:[14],archer:[12,10],cavalry:[12],spearman:[12],mage:[10]},boss:true,bossMult:{atk:1.4,def:1.35},reward:{wood:1300,stone:1100,food:950}}
];
