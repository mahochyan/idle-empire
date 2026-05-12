// ==================== 建筑配置 ====================
// 独立建筑配置文件，方便调整数值

CFG.buildings = {
  lumber_mill:{name:'伐木场',buffRes:'wood',buffBase:0.15,buffPerLv:0.2, build:{wood:150,stone:80,food:50,time:4}, upBase:{wood:800,stone:500,food:300}, upCostLv:1.45},
  quarry:{name:'采石场',buffRes:'stone',buffBase:0.15,buffPerLv:0.2, build:{wood:50,stone:120,food:40,time:4}, upBase:{wood:500,stone:800,food:300}, upCostLv:1.45},
  farm:{name:'农田',buffRes:'food',buffBase:0.15,buffPerLv:0.2, build:{wood:80,stone:40,food:120,time:4}, upBase:{wood:600,stone:300,food:800}, upCostLv:1.45},
  barracks:{name:'营帐',build:{wood:300,stone:200,food:100,time:6}, upBase:{wood:2200,stone:1800,food:1000}, upCostLv:1.85},
  infantry_camp:{name:'步兵营地',trains:'infantry',unitCapBase:4,unitCapPerLv:2,build:{wood:180,stone:100,food:80,time:5},upBase:{wood:1600,stone:1000,food:800},upCostLv:1.7},
  archer_range:{name:'射手靶场',trains:'archer',unitCapBase:2,unitCapPerLv:2,build:{wood:240,stone:100,food:100,time:6},upBase:{wood:2000,stone:1000,food:1000},upCostLv:1.75},
  stable:{name:'骑兵训练场',trains:'cavalry',unitCapBase:1,unitCapPerLv:1,needBoss:1,build:{wood:220,stone:160,food:180,time:7},upBase:{wood:2000,stone:1500,food:1600},upCostLv:1.8},
  spear_crypt:{name:'长矛兵营地',trains:'spearman',unitCapBase:1,unitCapPerLv:1,needBoss:2,build:{wood:160,stone:240,food:100,time:7},upBase:{wood:1400,stone:2200,food:1000},upCostLv:1.8},
  mage_tower:{name:'法师塔',trains:'mage',unitCapBase:1,unitCapPerLv:1,needBoss:2,build:{wood:500,stone:500,food:350,time:10},upBase:{wood:3800,stone:3800,food:2800},upCostLv:1.9},
  warehouse:{name:'仓库',storageBase:5000,storagePerLv:4000,build:{wood:200,stone:200,food:100,time:5},upBase:{wood:1600,stone:1600,food:800},upCostLv:1.45}
};
