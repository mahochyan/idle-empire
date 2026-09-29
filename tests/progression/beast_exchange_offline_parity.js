'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0;
function check(name,fn){
  fn();
  passed++;
  console.log('PASS '+name);
}
const marketSnapshot=e=>e.run('JSON.stringify({beast:S.beastExchange,special:S.marketSpecial,draws:globalThis.__draws,seed:globalThis.__seed})');
const marketSetup=`
  S.population.current=0;
  for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;
  S.res.food=0;
  S.sciences=['sci_copper','sci_currency','sci_gold','sci_electric_age'];
  S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};
  S.beastExchange.level=60;
  S.beastExchange.heartOffers=2;
  S.beastExchange.refreshCharges=4;
  S.beastExchange.refreshClock=1200;
  S.marketSpecial.cycles=1;
  S.marketSpecial.clockSec=1200;
  globalThis.__seed=123456789;
  globalThis.__draws=0;
  Math.random=()=>{__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;__draws++;return __seed/4294967296};
`;

check('1199/1200/2400秒边界：在线与离线两市场货位及随机流一致',()=>{
  const online=environment(),offline=environment();
  online.run(marketSetup);offline.run(marketSetup);
  online.run('for(let i=0;i<1199;i++)tick()');
  assert.equal(offline.run('offlineAdvanceSec(1199,1,"all").elapsed'),1199);
  assert.equal(online.run('S.beastExchange.refreshClock'),1);
  assert.equal(online.run('S.beastExchange.refreshCharges'),4);
  assert.equal(online.run('S.marketSpecial.clockSec'),1);
  assert.equal(marketSnapshot(offline),marketSnapshot(online));

  online.run('tick()');
  assert.equal(offline.run('offlineAdvanceSec(1,1,"all").elapsed'),1);
  assert.equal(online.run('S.beastExchange.refreshClock'),1200);
  assert.equal(online.run('S.beastExchange.refreshCharges'),5);
  assert.equal(online.run('S.beastExchange.heartOffers'),2);
  assert.equal(online.run('S.marketSpecial.cycles'),2);
  assert.equal(online.run('globalThis.__draws'),10);
  assert.equal(marketSnapshot(offline),marketSnapshot(online));

  online.run('for(let i=0;i<1200;i++)tick()');
  assert.equal(offline.run('offlineAdvanceSec(1200,1,"all").elapsed'),1200);
  assert.equal(online.run('S.beastExchange.refreshClock'),1200);
  assert.equal(online.run('S.beastExchange.refreshCharges'),5);
  assert.equal(online.run('S.marketSpecial.cycles'),3);
  assert.ok(online.run('globalThis.__draws')>20);
  assert.equal(marketSnapshot(offline),marketSnapshot(online));
});

check('离线可支付一秒后断粮：未支付秒不刷新也不消耗随机流',()=>{
  const e=environment();
  e.run('S.population.current=10;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=0.7;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=5;S.beastExchange.refreshClock=2;globalThis.__draws=0;Math.random=()=>{__draws++;return 0}');
  const result=e.run('offlineAdvanceSec(3,0.6,"all")');
  assert.equal(result.elapsed,1);
  assert.equal(result.foodClamped,true);
  assert.equal(e.run('S.tick'),1);
  assert.equal(e.run('S.beastExchange.refreshClock'),1);
  assert.equal(e.run('S.beastExchange.heartOffers'),2);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.run('globalThis.__draws'),0);
});

check('25小时离线按24小时封顶：72次轮换且不自动购买，重载与重复结算不变',()=>{
  const e=environment();
  e.run('S.population.current=0;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=0;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=5;S.beastExchange.refreshClock=1200;globalThis.__draws=0;Math.random=()=>{__draws++;return 0};save();_loadedTs=Date.now()-25*3600*1000');
  const result=e.run('settleOffline()');
  assert.equal(result.ok,true);
  assert.equal(result.durationSec,86400);
  assert.equal(result.truncated,true);
  assert.equal(e.run('S.tick'),86400);
  assert.equal(e.run('S.beastExchange.refreshClock'),1200);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.run('S.beastExchange.heartOffers'),11);
  assert.equal(e.run('globalThis.__draws'),72*11*4);
  assert.equal(e.run('S.items.storageScroll'),0);
  assert.equal(e.run('S.beastExchange.progress'),0);
  const saved=e.store.get('rts_save');
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.run('globalThis.__draws'),72*11*4);
  assert.equal(e.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.beastExchange.heartOffers'),11);
  assert.equal(reload.run('S.beastExchange.refreshClock'),1200);
});

check('备份写入失败先回滚离线货位与时钟，原主档可重试',()=>{
  const e=environment();
  e.run('S.population.current=0;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=0;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=5;S.beastExchange.refreshClock=1;Math.random=()=>0;save();_loadedTs=Date.now()-121000');
  const beforeState=e.run('JSON.stringify({beast:S.beastExchange,tick:S.tick,ops:S.ops,offline:S.offline})');
  const beforeRaw=e.store.get('rts_save');
  e.run("globalThis.originalSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save_backup_1')throw Error('quota');return originalSetItem(key,value)}");
  const failure=e.run('settleOffline()');
  assert.equal(failure.reason,'save-failed');
  assert.equal(failure.stage,'backup');
  assert.equal(e.run('JSON.stringify({beast:S.beastExchange,tick:S.tick,ops:S.ops,offline:S.offline})'),beforeState);
  assert.equal(e.store.get('rts_save'),beforeRaw);
  e.run('localStorage.setItem=originalSetItem');
  assert.equal(e.run('settleOffline().ok'),true);
  assert.equal(e.run('S.beastExchange.heartOffers'),11);
});

console.log(`beast exchange offline parity: ${passed}/4`);
