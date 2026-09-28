'use strict';

// Only explicitly mapped workshop buildings follow the source workshop thresholds.
// Storage and unmapped buildings keep their separately verified/current cost paths.
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function close(actual,expected,label){
  assert.ok(Math.abs(actual-expected)<1e-9,`${label}: ${actual} !== ${expected}`);
}

check('映射到母本工坊的产出建筑在10／20／30／40级阈值按分段斜率计价',()=>{
  const e=environment();
    const expected=[
    [1,800],[9,2400],[10,3400],[19,12400],[20,24400],
    [29,42400],[30,86400],[39,122400],[40,250400],[49,322400]
  ];
  for(const[level,wood]of expected){
    e.run(`S.buildings.lumber_mill={lv:${level},state:'idle',timer:0,timerEnd:0,tier:0}`);
    close(e.run("upCost('lumber_mill').wood"),wood,`当前等级${level}`);
  }
});

check('运行时工坊曲线只挂在已有母本 workShop 实体映射上',()=>{
  const e=environment();
  const mapped=Object.entries(e.run('CFG.buildings'))
    .filter(([,cfg])=>cfg.upCostModel==='workshop')
    .map(([key,cfg])=>[key,cfg.workshopSourceId]);
  assert.deepEqual(mapped,[
    ['lumber_mill',260002],['quarry',260003],['farm',260001],['coal_mine',260005],
    ['mine',260007],['smelter',260008],['silver_refinery',260009],['gold_refinery',260010],
    ['steel_refinery',260011],['mint',260012],['academy',260006]
  ]);
  const expectedNeeds={
    lumber_mill:{wood:600,food:300},quarry:{stone:600,food:300},farm:{wood:400,food:200},
    coal_mine:{stone:800,food:500},mine:{wood:600,stone:1500,food:300},
    smelter:{copper:500,wood:1000,food:500},silver_refinery:{iron:500,wood:1000,food:500},
    gold_refinery:{silver:500,wood:1000,food:500},steel_refinery:{gold:500,wood:1000,food:500},
    mint:{copper:800,iron:800,food:500},academy:{wood:600,stone:600,food:300}
  };
  for(const[key,need]of Object.entries(expectedNeeds))
    assert.deepEqual(JSON.parse(JSON.stringify(e.run(`CFG.buildings['${key}'].upBase`))),need,`${key} upBase 应对应母本 Need`);
  for(const key of ['barracks','infantry_camp','arrow_tower','copper_furnace','market'])
    assert.notEqual(e.run(`CFG.buildings['${key}'].upCostModel`),'workshop',`${key} 无工坊映射`);
});

check('母本学院映射使用工坊曲线，未映射军营保留倍率费用',()=>{
  const e=environment();
  e.run("S.buildings.academy={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  close(e.run("upCost('academy').wood"),600+9*600/3+600/3*5,'学院10级木材费');
  e.run("S.buildings.barracks={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  close(e.run("upCost('barracks').wood"),Math.ceil(1800*Math.pow(1.7,10)),'营帐10级木材费');
  close(e.run("upCost('barracks').stone"),Math.ceil(1800*Math.pow(1.7,10)),'营帐10级石材费');
});

check('建筑级分母覆盖可承接母本蒸汽工厂Need/5特例',()=>{
  const e=environment();
  e.run("CFG.buildings.lumber_mill.upCostDivisor=5;S.buildings.lumber_mill={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  close(e.run("upCost('lumber_mill').wood"),2280,'Need/5蒸汽工厂10级费用');
});

check('仓储建筑继续使用已验证的独立分段仓费',()=>{
  const e=environment();
  e.run("S.buildings.iron_store={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert.equal(e.run("upCost('iron_store').iron"),640);
  e.run("S.storageMode='aligned';S.buildings.warehouse={lv:10,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert.equal(e.run("upCost('warehouse').wood"),2560);
});

check('真实未映射建筑按倍率费率扣款一次，保存失败完整回滚',()=>{
  const e=environment();
  e.run("S.townLv=10;S.buildings.barracks={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=5000;S.res.stone=5000;S.res.food=5000");
  assert.equal(e.run("buildAct('barracks').ok"),true);
  close(e.run('S.res.wood'),1940,'升级后木材');
  close(e.run('S.res.stone'),1940,'升级后石材');
  close(e.run('S.res.food'),3300,'升级后食物');
  assert.equal(e.run("bldSt('barracks').state"),'upgrading');
  const f=environment();
  f.run("S.townLv=10;S.buildings.barracks={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=5000;S.res.stone=5000;S.res.food=5000");
  assert.equal(f.run('save().ok'),true);
  const original=f.store.get('rts_save');
  f.run("const oldWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldWrite(key,value)}");
  assert.equal(f.run("buildAct('barracks').reason"),'save-failed');
  assert.equal(f.run('S.res.wood'),5000);
  assert.equal(f.run('S.res.stone'),5000);
  assert.equal(f.run('S.res.food'),5000);
  assert.equal(f.run("bldSt('barracks').lv"),1);
  assert.equal(f.run("bldSt('barracks').state"),'idle');
  assert.equal(f.store.get('rts_save'),original);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
