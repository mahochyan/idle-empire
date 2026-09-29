'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('母本30级兑换与卷轴属性有对应数据',()=>{
  assert.deepEqual(source[290084]['exchangeShop:Need'],[170001,200]);
  assert.deepEqual(source[290084]['exchangeShop:Get'],[180016,1]);
  assert.equal(source[290084]['exchangeShop:ExchangeLv'],30);
  assert.equal(source[180016]['itemPill:LimitNum'],500);
  const e=environment();
  assert.equal(e.run('S.beastExchange.level'),1);
  assert.equal(e.run('S.items.boarHeart'),0);
  assert.equal(e.run('S.items.storageScroll'),0);
  assert.equal(e.run('materialDomainEncounter("bone",0).heartChance'),60);
});

check('批量交易经验封顶，逐级升级需要实付兽骨',()=>{
  const e=environment();
  e.run('S.res.bone=150000');
  assert.equal(e.run('exchangeBonesForMedals(21).ok'),true);
  assert.equal(e.run('S.beastExchange.progress'),20);
  assert.equal(e.run('upgradeBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.level'),2);
  assert.equal(e.run('S.beastExchange.progress'),0);
  assert.equal(e.run('exchangeHeartsForScrolls(1).reason'),'level');
  let paid=21,bonePaid=210,medalEarned=420;
  for(let lv=2;lv<30;lv++){
    const need=e.run('beastExchangeProgressNeed(S.beastExchange.level)');
    const boneCost=e.run('beastBoneTradeCost()'),medalGain=e.run('beastBoneTradeReward()');
    assert.equal(e.run(`exchangeBonesForMedals(${need}).ok`),true);
    paid+=need;bonePaid+=need*boneCost;medalEarned+=need*medalGain;
    assert.equal(e.run('upgradeBeastExchange().ok'),true);
  }
  assert.equal(e.run('S.beastExchange.level'),30);
  assert.equal(paid,2611);
  assert.equal(bonePaid,119490);
  assert.equal(e.run('S.res.bone'),150000-bonePaid);
  assert.equal(e.run('S.res.medal'),medalEarned);
  assert.equal(e.run('upgradeBeastExchange().reason'),'progress');
});

check('兽心兑换、使用次数、仓容加成与重载一致',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;S.beastExchange.heartOffers=2;S.items.boarHeart=400');
  const before=e.run('resCap("tech")');
  assert.equal(e.run('exchangeHeartsForScrolls(2).ok'),true);
  assert.equal(e.run('S.items.boarHeart'),0);
  assert.equal(e.run('S.items.storageScroll'),2);
  assert.equal(e.run('useStorageScroll(2).ok'),true);
  assert.equal(e.run('S.beastExchange.scrollUsed'),2);
  assert.equal(e.run('resCap("tech")'),Math.floor(before*1.02));
  assert.equal(e.run('S.items.storageScroll'),0);
  const saved=JSON.parse(e.store.get('rts_save'));
  1332;
  const reload=environment({rts_save:JSON.stringify(saved)});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.beastExchange.scrollUsed'),2);
  assert.equal(reload.run('resCap("tech")'),Math.floor(before*1.02));
  assert.equal(reload.run('resCap("medal")'),e.run('resCap("medal")'));
});

check('保存失败不扣费、不升级、不消耗卷轴',()=>{
  const e=environment();
  e.run('S.res.bone=100;S.beastExchange.progress=20;S.items.boarHeart=200;S.items.storageScroll=1;S.beastExchange.level=30;S.beastExchange.heartOffers=1;save()');
  const raw=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('exchangeBonesForMedals(1).reason'),'save-failed');
  assert.equal(e.run('exchangeHeartsForScrolls(1).reason'),'save-failed');
  assert.equal(e.run('useStorageScroll(1).reason'),'save-failed');
  assert.equal(e.run('S.res.bone'),100);
  assert.equal(e.run('S.items.boarHeart'),200);
  assert.equal(e.run('S.items.storageScroll'),1);
  assert.equal(e.run('S.beastExchange.scrollUsed'),0);
  assert.equal(e.store.get('rts_save'),raw);
  const u=environment();u.run('S.beastExchange.progress=20;save()');
  const prior=u.store.get('rts_save');
  u.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(u.run('upgradeBeastExchange().reason'),'save-failed');
  assert.equal(u.run('S.beastExchange.level'),1);
  assert.equal(u.run('S.beastExchange.progress'),20);
  assert.equal(u.store.get('rts_save'),prior);
});

check('v26独立迁移保旧库存和合法0，v32坏字段及未来版本只读',()=>{
  const seed=environment();
  const raw=seed.run('(()=>{S.res.bone=999999;S.items.godCore=7;const d=serializeSave();d.v=26;delete d.items.boarHeart;delete d.items.storageScroll;delete d.beastExchange;return JSON.stringify(d)})()');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.bone'),999999);
  assert.equal(e.run('S.items.godCore'),7);
  assert.equal(e.run('S.items.boarHeart'),0);
  assert.equal(e.run('S.beastExchange.scrollUsed'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>delete d.items.boarHeart,d=>d.items.storageScroll=-1,d=>delete d.beastExchange,d=>d.beastExchange.scrollUsed=501,d=>d.v=35]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

console.log(`beast exchange scroll: ${passed}/5`);
