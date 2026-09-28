'use strict';

// 高等级仓库费用直接调用当前游戏的 upCost/buildAct，核对参考游戏的分段斜率。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}

check('机械期仓库在10／300／600级切换费用斜率',()=>{
  const e=environment();
  for(const [level,cost] of [[1,240],[9,560],[10,640],[299,23760],[300,35480],[599,71360],[600,95120],[999,158960]]){
    e.run(`S.buildings.iron_store={lv:${level},state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.steel_store={lv:${level},state:'idle',timer:0,timerEnd:0,tier:0}`);
    assert.equal(e.run("upCost('iron_store').iron"),cost,`铁仓当前等级${level}`);
    assert.equal(e.run("upCost('steel_store').steel"),cost,`钢仓当前等级${level}`);
  }
});

check('木石仓在对齐仓储模式下使用同一分段曲线',()=>{
  const e=environment();
  e.run("S.storageMode='aligned'");
  for(const [level,cost] of [[9,2240],[10,2560],[300,141920],[600,380480]]){
    e.run(`S.buildings.warehouse={lv:${level},state:'idle',timer:0,timerEnd:0,tier:0}`);
    assert.equal(e.run("upCost('warehouse').wood"),cost,`木石仓当前等级${level}`);
  }
});

check('真实建造动作按分段费用扣一次且写档失败回滚',()=>{
  const e=environment();
  e.run("S.sciences=['sci_iron_warehouse'];S.townLv=10;S.buildings.iron_store={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.res.iron=640");
  assert.equal(e.run("buildAct('iron_store').ok"),true);
  assert.equal(e.run('S.res.iron'),0);
  assert.equal(e.run("bldSt('iron_store').state"),'upgrading');
  assert.equal(JSON.parse(e.store.get('rts_save')).res.iron,0);
  const f=environment();
  f.run("S.sciences=['sci_iron_warehouse'];S.townLv=10;S.buildings.iron_store={lv:10,state:'idle',timer:0,timerEnd:0,tier:0};S.res.iron=640");
  assert.equal(f.run('save().ok'),true);
  const original=f.store.get('rts_save');
  f.run("const oldWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldWrite(key,value)}");
  assert.equal(f.run("buildAct('iron_store').reason"),'save-failed');
  assert.equal(f.run('S.res.iron'),640);
  assert.equal(f.run("bldSt('iron_store').lv"),10);
  assert.equal(f.run("bldSt('iron_store').state"),'idle');
  assert.equal(f.store.get('rts_save'),original);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
