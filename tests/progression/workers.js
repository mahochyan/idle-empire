'use strict';
// 开局岗位与存档回归：加载真实实现，不复制生产/研究公式。
const assert = require('node:assert/strict');
const {environment} = require('./harness');
let failed=0, passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
test('新档保存后可重新加载，所有岗位合法',()=>{
  const e=environment();e.run('save()');
  assert.ok(e.run('popAllocTotal()<=popCurrent()'));
  const r=environment(Object.fromEntries(e.store));
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('saveProtected()'),false);
});
test('学院与加工建筑上限按类型，不依赖旧被动产出字段',()=>{
  const e=environment();
  e.run('CFG.ownMax.science=60;CFG.ownMax.production=70');
  assert.equal(e.run("ownMaxFor('academy')"),60);
  assert.equal(e.run("ownMaxFor('mine')"),70);
  e.run("CFG.ownMax.enabled=false;S.buildings.academy={lv:19,state:'idle'}");
  assert.equal(e.run("upgradeLockReason('academy')"),'');
});
test('新工种非零数值与合法0往返保留，历史超额分配不裁剪',()=>{
  const e=environment();e.run('S.popAlloc={...S.popAlloc,wood:0,stone:0,food:0,coal:0,copper:40,iron:30,silver:0,gold:0,steel:0,coin:20,silverCoin:0,tech:10};save()');
  const r=environment(Object.fromEntries(e.store));
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('JSON.stringify(S.popAlloc)'),e.run('JSON.stringify(S.popAlloc)'));
});
test('未知岗位或坏数字仍拒收',()=>{
  const e=environment();
  for(const change of ['d.popAlloc.goblin=1','d.popAlloc.deed=1','d.popAlloc.tech=-1','d.popAlloc.tech=NaN'])
    assert.equal(e.run(`(()=>{const d=serializeSave();d.popAlloc={wood:0,coal:0};${change};return validateSave(d).ok})()`),false);
});
test('动作入口拒绝非法岗位、非有限数与未开放岗位',()=>{
  const e=environment();e.run('S.popAlloc={wood:0,stone:0,food:0,coal:0};S.tick=10');
  const before=e.run('JSON.stringify(S.popAlloc)');
  for(const call of ["setPopAlloc('goblin',1)","setPopAlloc('deed',1)","setPopAlloc('wood',NaN)","setPopAlloc('wood',Infinity)","setPopAlloc('tech',1)"]){
    e.run(call);assert.equal(e.run('JSON.stringify(S.popAlloc)'),before,call);
  }
});
test('旧档锁定工人允许撤回，不能新增',()=>{
  const e=environment();e.run('S.popAlloc={wood:0,stone:0,food:0,coal:0,tech:2};S.tick=10');
  e.run("setPopAlloc('tech',3)");assert.equal(e.run('S.popAlloc.tech'),2);
  e.run("setPopAlloc('tech',1)");assert.equal(e.run('S.popAlloc.tech'),1);
});
test('基础采集无需建筑，配置产率0不被缺省替换',()=>{
  const e=environment();
  e.run('for(let i=0;i<10;i++)tick();setPopAlloc("wood",1);setPopAlloc("food",1)');
  assert.ok(e.run("prodRate('wood')")>0);
  assert.ok(e.run("prodRate('food')")>0);
  e.run('CFG.res.wood.basePerPop=0');assert.equal(e.run("prodRate('wood')"),0);
});
test('新档无需赠送科技或金属：建学院→研究煤铜→派煤铜工→采铜→重载',()=>{
  const e=environment();assert.equal(e.run('S.res.tech'),0);
  e.run("buildAct('academy')");assert.equal(e.run("bldSt('academy').state"),'building');
  e.run('for(let i=0;i<20;i++)tick()');
  assert.equal(e.run("bldSt('academy').lv"),1);
  e.run("setPopAlloc('wood',1);setPopAlloc('stone',1);setPopAlloc('food',1);setPopAlloc('tech',1)");
  assert.equal(e.run('S.popAlloc.tech'),1);
  e.run('for(let i=0;i<100;i++)tick()');
  e.run("researchScience('sci_prospect')");assert.equal(e.run("scienceUnlocked('sci_prospect')"),true);
  const once=e.run('S.res.tech');e.run("researchScience('sci_prospect')");assert.equal(e.run('S.res.tech'),once);
  e.run("for(let i=0;i<300;i++)tick();researchScience('sci_coal')");
  assert.equal(e.run("scienceUnlocked('sci_coal')"),true);
  e.run("while(S.res.tech<activeSciences().sci_copper.cost.tech)tick();researchScience('sci_copper');buildAct('mine')");
  assert.equal(e.run("bldSt('mine').state"),'building');
  e.run('for(let i=0;i<10;i++)tick()');
  e.run("setPopAlloc('wood',0);setPopAlloc('food',0);setPopAlloc('tech',0);setPopAlloc('coal',2);setPopAlloc('copper',1);tick();save()");
  assert.ok(e.run('S.res.copper')>0);
  const r=environment(Object.fromEntries(e.store));assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('S.popAlloc.tech'),0);assert.equal(r.run('S.popAlloc.coal'),2);assert.equal(r.run('S.popAlloc.copper'),1);
});
console.log(`${passed} passed / ${failed} failed`);
process.exitCode=failed?1:0;
