'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('母本刷新为20分钟、五次次数，图纸按当级总权重抽取',()=>{
  assert.equal(source[290000]['exchangeShop:Interval'],1000);
  assert.equal(source[290000]['exchangeShop:Time'],1200);
  assert.equal(source[290000]['exchangeShop:InitCount'],8);
  assert.equal(source[290084]['exchangeShop:Rate'],10);
  const e=environment();
  for(const level of [1,30,40,50,60,80,90,100,300]){
    const expected=Object.values(source).reduce((sum,row)=>sum+(row['exchangeShop:ExchangeLv']<=level?(row['exchangeShop:Rate']||0):0),0);
    assert.equal(e.run(`beastOfferTotalWeight(${level})`),expected);
  }
  assert.equal(e.run('beastOfferSlots(30)'),11);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.run('S.beastExchange.refreshClock'),1200);
});

check('未上架不能兑换；刷新抽中的份数、折扣、扣费和重载一致',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;S.items.boarHeart=500;Math.random=()=>0.5');
  assert.equal(e.run('exchangeHeartsForScrolls(1).reason'),'not-offered');
  assert.equal(e.run('refreshBeastExchange().offers'),0);
  assert.equal(e.run('S.beastExchange.refreshCharges'),4);
  e.run('Math.random=()=>0');
  assert.equal(e.run('refreshBeastExchange().offers'),11);
  assert.equal(e.run('S.beastExchange.heartQuality'),10);
  assert.equal(e.run('beastHeartTradeCost()'),20);
  assert.equal(e.run('exchangeHeartsForScrolls(12).reason'),'not-offered');
  assert.equal(e.run('exchangeHeartsForScrolls(2).ok'),true);
  assert.equal(e.run('S.beastExchange.heartOffers'),9);
  assert.equal(e.run('S.items.boarHeart'),460);
  assert.equal(e.run('S.items.storageScroll'),2);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.beastExchange.heartOffers'),9);
  assert.equal(reload.run('S.beastExchange.refreshCharges'),3);
  assert.equal(reload.run('S.items.boarHeart'),460);
});

check('在线与离线秒先恢复次数，满次数后自动刷新',()=>{
  const e=environment();
  e.run('S.population.current=0;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=4;S.beastExchange.refreshClock=1;Math.random=()=>0');
  e.run('tick()');
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.run('S.beastExchange.heartOffers'),2);
  assert.equal(e.run('S.beastExchange.refreshClock'),1200);
  e.run('S.battleActive=true;tick();S.battleActive=false');
  assert.equal(e.run('S.beastExchange.refreshClock'),1199);
  const result=e.run('offlineAdvanceSec(1199,0.6,"all")');
  assert.equal(result.elapsed,1199);
  assert.equal(e.run('S.beastExchange.refreshClock'),1200);
  assert.equal(e.run('S.beastExchange.heartOffers'),11);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
});

check('离线未满次数只恢复次数，断粮秒不推进刷新',()=>{
  const e=environment();
  e.run('S.population.current=0;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=3;S.beastExchange.refreshClock=1;Math.random=()=>0');
  const paid=e.run('offlineAdvanceSec(1,0.6,"all")');
  assert.equal(paid.elapsed,1);
  assert.equal(e.run('S.beastExchange.refreshCharges'),4);
  assert.equal(e.run('S.beastExchange.refreshClock'),1200);
  assert.equal(e.run('S.beastExchange.heartOffers'),2);
  e.run('S.population.current=10;for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;S.res.food=0;S.beastExchange.refreshClock=1');
  const before=e.run('JSON.stringify(S.beastExchange)');
  const clamped=e.run('offlineAdvanceSec(1,0.6,"all")');
  assert.equal(clamped.elapsed,0);
  assert.equal(clamped.foodClamped,true);
  assert.equal(e.run('JSON.stringify(S.beastExchange)'),before);
});

check('离线刷新写档失败回滚，重试只结算一次且重载保留货位',()=>{
  const e=environment();
  e.run('S.population.current=0;S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.beastExchange.refreshCharges=5;S.beastExchange.refreshClock=1;Math.random=()=>0;save();_loadedTs=Date.now()-121000');
  const raw=e.store.get('rts_save'),before=e.run('JSON.stringify(S.beastExchange)');
  e.run("globalThis.originalSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');return originalSetItem(key,value)}");
  assert.equal(e.run('settleOffline().reason'),'save-failed');
  assert.equal(e.run('JSON.stringify(S.beastExchange)'),before);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=originalSetItem');
  assert.equal(e.run('settleOffline().ok'),true);
  assert.equal(e.run('S.beastExchange.heartOffers'),11);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  const saved=e.store.get('rts_save');
  assert.equal(JSON.parse(saved).beastExchange.heartOffers,11);
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.beastExchange.heartOffers'),11);
});

check('刷新保存失败回滚库存和次数，v32非法刷新字段拒载',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;save()');const raw=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')};Math.random=()=>0");
  assert.equal(e.run('refreshBeastExchange().reason'),'save-failed');
  assert.equal(e.run('S.beastExchange.heartOffers'),0);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.store.get('rts_save'),raw);
  for(const mutate of [d=>delete d.beastExchange.heartOffers,d=>d.beastExchange.refreshCharges=6,d=>d.beastExchange.heartQuality=42,d=>d.beastExchange.refreshClock=1201]){
    const d=JSON.parse(raw);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('v27迁移保已用图纸和兽心，先备原文；未来v33只读',()=>{
  const seed=environment();
  const raw=seed.run('(()=>{S.beastExchange.level=30;S.beastExchange.scrollUsed=5;S.items.boarHeart=25;const d=serializeSave();d.v=27;delete d.beastExchange.heartOffers;delete d.beastExchange.heartQuality;delete d.beastExchange.refreshClock;delete d.beastExchange.refreshCharges;return JSON.stringify(d)})()');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.beastExchange.scrollUsed'),5);
  assert.equal(e.run('S.items.boarHeart'),25);
  assert.equal(e.run('S.beastExchange.heartOffers'),0);
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
  const future=JSON.parse(e.store.get('rts_save'));future.v=33;
  const text=JSON.stringify(future),bad=environment({rts_save:text});
  assert.equal(bad.run('loadSaveAndApply().status'),'future');
  bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
});

console.log(`beast exchange refresh: ${passed}/7`);
