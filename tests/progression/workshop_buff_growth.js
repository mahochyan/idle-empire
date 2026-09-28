'use strict';

const assert=require('node:assert/strict');
const {environment}=require('./harness');
const e=environment();
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function near(actual,expected,label){
  assert.ok(Math.abs(actual-expected)<1e-9,`${label}: ${actual} !== ${expected}`);
}

check('11个workShop映射建筑均按母本每级10%加成',()=>{
  const actual=JSON.parse(e.run("JSON.stringify(Object.entries(CFG.buildings).filter(function(entry){return entry[1].upCostModel==='workshop'}).map(function(entry){return [entry[0],entry[1].workshopSourceId,entry[1].buffBase,entry[1].buffPerLv]}))"));
  assert.deepEqual(actual,[
    ['lumber_mill',260002,0,0.1],['quarry',260003,0,0.1],['farm',260001,0,0.1],
    ['coal_mine',260005,0,0.1],['mine',260007,0,0.1],['smelter',260008,0,0.1],
    ['silver_refinery',260009,0,0.1],['gold_refinery',260010,0,0.1],
    ['steel_refinery',260011,0,0.1],['mint',260012,0,0.1],['academy',260006,0,0.1]
  ]);
});

check('木石粮的真实岗位产出按工坊等级逐级增长10%',()=>{
  const cases=[
    {building:'lumber_mill',resource:'wood'},
    {building:'quarry',resource:'stone'},
    {building:'farm',resource:'food'}
  ];
  e.run('S.popAlloc.wood=1;S.popAlloc.stone=1;S.popAlloc.food=1');
  for(const item of cases){
    e.run("S.buildings."+item.building+"={lv:0,state:'idle',timer:0,timerEnd:0,tier:0}");
    const base=e.run("prodRate('"+item.resource+"')");
    assert.ok(base>0,`${item.resource}基础产率应为正`);
    e.run("S.buildings."+item.building+".lv=1");
    near(e.run("buildingBuff('"+item.resource+"')"),0.1,item.building+' Lv1加成');
    near(e.run("prodRate('"+item.resource+"')"),base*1.1,item.building+' Lv1岗位产率');
    e.run("S.buildings."+item.building+".lv=10");
    near(e.run("buildingBuff('"+item.resource+"')"),1,item.building+' Lv10加成');
    near(e.run("prodRate('"+item.resource+"')"),base*2,item.building+' Lv10岗位产率');
  }
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
