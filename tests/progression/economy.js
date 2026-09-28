'use strict';
const assert = require('node:assert/strict');
const {environment} = require('./harness');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+': '+e.message)}}
const fixture = () => {
  const e=environment();
  e.run('S.metalRecipeMode="legacy";S.currencyRecipeMode="legacy";S.popAlloc={wood:1,stone:0,food:2,tech:1,coal:0,copper:1,iron:1,coin:1};S.buildings.academy={lv:1,state:"idle"};S.buildings.mine={lv:1,state:"idle"};S.buildings.smelter={lv:1,state:"idle"};S.buildings.mint={lv:1,state:"idle"};S.res={wood:0,stone:0,food:100,coal:0,copper:5,iron:0,coin:0,tech:0,deed:0}');
  return e;
};
test('未解锁或缺料的岗位不扣料也不产出',()=>{
  const e=fixture();e.run('S.buildings.smelter={lv:0,state:"idle"};S.buildings.mint={lv:0,state:"idle"};tick()');
  assert.equal(e.run('S.res.iron'),0);assert.equal(e.run('S.res.coin'),0);
  assert.ok(e.run('S.res.copper')>=5);
  e.run('S.buildings.smelter={lv:1,state:"idle"};S.res.copper=0;S.popAlloc.copper=0;tick()');
  assert.equal(e.run('S.res.iron'),0);assert.equal(e.run('S.res.copper'),0);
});
test('加工消耗真实人口岗位，满仓停料且历史超上限不裁剪',()=>{
  const e=fixture();e.run('tick()');
  assert.ok(e.run('S.res.iron')>0);assert.ok(e.run('S.res.coin')>0);
  e.run('S.res.iron=resCap("iron")+7;S.res.copper=10;S.popAlloc.copper=0;tick()');
  assert.equal(e.run('S.res.iron'),e.run('resCap("iron")+7'));
  assert.equal(e.run('S.res.copper'),10);
});
test('离线逐步推进生产：学院完工后才产知识，未完工部分没有收益',()=>{
  const e=environment();e.run('S.popAlloc={wood:0,stone:0,food:1,tech:1};S.buildings.academy={lv:0,state:"building",timer:3,timerEnd:3};S.res.food=1000;save();_loadedTs=Date.now()-121000');
  const before=e.run('S.res.tech');
  const r=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(r.ok,true);assert.equal(r.durationSec,121);
  assert.equal(e.run('bldSt("academy").lv'),1);
  assert.ok(e.run('S.res.tech')>before);
  assert.ok(e.run('S.res.tech')<e.run('121*prodRate("tech")*CFG.offline.ratio'));
});
test('离线原料枯竭后加工暂停，来源恢复后可再生产',()=>{
  const e=fixture();e.run('S.popAlloc.copper=0;S.res.copper=3;save();_loadedTs=Date.now()-121000');
  const r=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(r.ok,true);assert.equal(r.durationSec,121);
  assert.ok(e.run('S.res.iron')>0);
  assert.ok(e.run('S.res.copper')>=0);
  assert.ok(e.run('S.res.iron')<e.run('121*prodRate("iron")*CFG.offline.ratio'));
});
test('离线断粮只推进可支付时段，刷新不重复入账',()=>{
  const e=environment();e.run('for(let i=0;i<10;i++)tick();setPopAlloc("wood",1);S.res.food=1;save();_loadedTs=Date.now()-3600000');
  const r=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(r.ok,true);assert.ok(r.durationSec<3600);assert.equal(r.truncated,true);
  assert.ok(e.run('S.res.food')>=0);
  const before=e.run('JSON.stringify(S.res)');
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.run('JSON.stringify(S.res)'),before);
});
test('铸币耗粮使用已启用的食物配置，关闭开关后按原始配置回退',()=>{
  const e=environment();e.run('S.currencyRecipeMode="legacy";S.population.current=1;S.popAlloc={wood:0,stone:0,food:0,coin:1};S.buildings.mint={lv:1,state:"idle"};S.res.food=100;tick()');
  assert.ok(Math.abs(e.run('S.res.food')-98.9)<1e-9);
  e.run('CFG.food.aligned=false;S.res.food=100;tick()');
  assert.ok(Math.abs(e.run('S.res.food')-94.9)<1e-9);
});
test('闲置与已分配村民同额耗粮，在线和离线均按实际人口结算',()=>{
  const idle=environment(),assigned=environment(),offline=environment();
  for(const e of[idle,assigned,offline])e.run('S.population.current=8;S.population.legacyBonus=4;S.res.food=100');
  assigned.run('S.popAlloc.wood=8');offline.run('S.popAlloc.wood=8');
  idle.run('tick()');assigned.run('tick()');
  assert.ok(Math.abs(idle.run('S.res.food')-99.2)<1e-9);
  assert.ok(Math.abs(assigned.run('S.res.food')-99.2)<1e-9);
  const result=JSON.parse(offline.run('JSON.stringify(offlineAdvanceSec(10,0.6))'));
  assert.equal(result.elapsed,10);
  assert.ok(Math.abs(offline.run('S.res.food')-95.2)<1e-9);
});
test('离线与在线共享逐秒资源规则，原料枯竭时结果一致',()=>{
  const setup='S.metalRecipeMode="legacy";S.currencyRecipeMode="legacy";S.popAlloc={wood:0,stone:0,food:1,coal:0,copper:0,iron:1,coin:1};S.buildings.smelter={lv:1,state:"idle"};S.buildings.mint={lv:1,state:"idle"};S.res={wood:0,stone:0,food:100,coal:0,copper:4,iron:0,coin:0,tech:0,deed:0}';
  const online=environment(),offline=environment();online.run(setup);offline.run(setup);
  for(let i=0;i<5;i++)online.run('tick()');
  offline.run('offlineAdvanceSec(5,1)');
  assert.equal(offline.run('JSON.stringify(S.res)'),online.run('JSON.stringify(S.res)'));
});
test('离线长窗口只在状态变化时重算岗位产率与仓容',()=>{
  const e=environment();
  e.run('S.res.food=1000;S.population.current=0;S.popAlloc={wood:1};var offlineRateCalls=0,offlineCapCalls=0;var originalOfflineRate=prodRate,originalOfflineCap=resCap;prodRate=function(rk){offlineRateCalls++;return originalOfflineRate(rk)};resCap=function(rk){offlineCapCalls++;return originalOfflineCap(rk)};offlineAdvanceSec(600,0.6)');
  const resourceCount=e.run('Object.keys(CFG.res).length');
  assert.ok(e.run('offlineRateCalls')<=resourceCount*2);
  assert.ok(e.run('offlineCapCalls')<=resourceCount*2);
});
test('建筑同秒完工后离线缓存刷新，产率和仓容与在线推进一致',()=>{
  const setup='S.population.current=0;S.popAlloc={wood:1,tech:1};S.res.food=1000;S.res.wood=resCap("wood");S.buildings.warehouse={lv:0,state:"building",timer:1,timerEnd:1};S.buildings.academy={lv:0,state:"building",timer:1,timerEnd:1}';
  const online=environment(),offline=environment();online.run(setup);offline.run(setup);
  const initialWood=offline.run('S.res.wood');
  online.run('tick();tick()');offline.run('offlineAdvanceSec(2,1)');
  assert.equal(offline.run('JSON.stringify(S.res)'),online.run('JSON.stringify(S.res)'));
  assert.equal(offline.run('S.buildings.warehouse.lv'),1);
  assert.equal(offline.run('S.buildings.academy.lv'),1);
  assert.ok(offline.run('S.res.wood')>initialWood);
  assert.ok(offline.run('S.res.tech')>0);
});
test('离线写入失败不保留半程内存状态，也不覆盖主档',()=>{
  const e=environment();e.run('S.buildings.infantry_camp={lv:5,state:"idle"};S.queue={infantry:{count:2,timer:0,reason:""}};S.res.wood=1000;S.res.stone=1000;S.res.food=1000;save();_loadedTs=Date.now()-121000');
  const saved=e.store.get('rts_save'),before=e.run('JSON.stringify({res:S.res,pool:S.pool,queue:S.queue,tick:S.tick,ops:S.ops})');
  e.run('const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==="rts_save")throw new Error("quota");originalSet(key,value)}');
  const result=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(result.ok,false);assert.equal(result.reason,'save-failed');
  assert.equal(e.store.get('rts_save'),saved);
  assert.equal(e.run('JSON.stringify({res:S.res,pool:S.pool,queue:S.queue,tick:S.tick,ops:S.ops})'),before);
  assert.equal(e.run('_offlineSettledFor'),null);
});
test('断粮未计入的那一秒必须回退新兵、队列与扣费',()=>{
  const e=environment();
  e.run('CFG.upkeep.freeBand=false;CFG.units.infantry.upkeep=10;S.popAlloc={wood:0,stone:0,food:0,tech:1};S.buildings.academy={lv:0,state:"building",timer:1,timerEnd:1};S.buildings.infantry_camp={lv:5,state:"idle"};S.queue={infantry:{count:1,timer:0,reason:""}};S.res.wood=100;S.res.stone=100;S.res.food=21;save();_loadedTs=Date.now()-121000');
  const before=e.run('JSON.stringify({res:S.res,buildings:S.buildings,pool:S.pool,queue:S.queue,tick:S.tick})');
  const result=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(result.ok,true);assert.equal(result.durationSec,0);assert.equal(result.truncated,true);
  assert.equal(e.run('JSON.stringify({res:S.res,buildings:S.buildings,pool:S.pool,queue:S.queue,tick:S.tick})'),before);
});
test('同页多次后台恢复从最近成功保存时刻续算，重复调用不重复入账',()=>{
  const e=environment();
  e.run('const NativeDate=Date;let fakeNow=1700000000000;Date=class extends NativeDate{static now(){return fakeNow}};for(let i=0;i<10;i++)tick();setPopAlloc("wood",1);save()');
  e.run('fakeNow+=121000');
  const first=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(first.durationSec,121);
  const woodAfterFirst=e.run('S.res.wood');
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.run('S.res.wood'),woodAfterFirst);
  e.run('fakeNow+=60000;save()');
  assert.equal(e.run('_loadedTs'),e.run('fakeNow'));
  e.run('fakeNow+=121000');
  const second=JSON.parse(e.run('JSON.stringify(settleOffline())'));
  assert.equal(second.durationSec,121);
  assert.ok(e.run('S.res.wood')>woodAfterFirst);
  const after=e.run('S.res.wood');
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.run('S.res.wood'),after);
  const persistedTs=JSON.parse(e.store.get('rts_save')).ts;
  const reload=environment({'rts_save':e.store.get('rts_save')});
  reload.run('const NativeDate=Date;Date=class extends NativeDate{static now(){return '+(persistedTs+1000)+'}};loadSaveAndApply()');
  const loadedWood=reload.run('S.res.wood');
  assert.equal(reload.run('settleOffline().reason'),'below-min');
  assert.equal(reload.run('S.res.wood'),loadedWood);
});
console.log(`${pass} passed / ${fail} failed`);process.exitCode=fail?1:0;
