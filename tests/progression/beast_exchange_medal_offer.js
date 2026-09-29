'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本290017为60级、兽骨300兑勋章1200、刷新权重20',()=>{
  const entry=source[290017],e=environment(),cfg=e.run('CFG.beastExchange.medalOfferTrade');
  assert.deepEqual(entry['exchangeShop:Need'],[160008,300]);
  assert.deepEqual(entry['exchangeShop:Get'],[160010,1200]);
  assert.equal(entry['exchangeShop:ExchangeLv'],60);
  assert.equal(entry['exchangeShop:Rate'],20);
  assert.equal(cfg.sourceId,290017);assert.equal(cfg.level,60);
  assert.equal(cfg.weight,20);assert.equal(cfg.boneCost,300);assert.equal(cfg.medalGain,1200);
  assert.equal(e.run('beastOfferTotalWeight(60)'),680);
});

check('60级才可能抽中货位，刷新替换旧货位并统计真实上架数',()=>{
  const e=environment();
  e.run('S.beastExchange.level=59;Math.random=()=>130.5/570');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.medalOffers'),0);
  e.run('S.beastExchange.level=60;Math.random=()=>130.5/680');
  const first=e.run('refreshBeastExchange()');
  assert.equal(first.ok,true);assert.equal(first.offers,14);
  assert.equal(e.run('S.beastExchange.medalOffers'),14);
  e.run('Math.random=()=>200.5/680');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.medalOffers'),0);
});

check('真实兑换扣兽骨、货位并加勋章；每日市场次数不被占用',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.beastExchange.medalOffers=2;S.res.bone=600;S.res.medal=944;S.daily.counts.market=5');
  const action=e.run('exchangeOfferedBonesForMedals(2)');
  assert.equal(action.ok,true);assert.equal(action.boneCost,600);assert.equal(action.medalGain,2400);
  assert.equal(e.run('S.res.bone'),0);assert.equal(e.run('S.res.medal'),3344);
  assert.equal(e.run('S.beastExchange.medalOffers'),0);
  assert.equal(e.run('S.beastExchange.progress'),2);
  assert.equal(e.run('S.daily.counts.market'),5);
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'not-offered');
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.medal'),3344);
  assert.equal(reload.run('S.beastExchange.medalOffers'),0);
});

check('动作函数守住级别、数量、上架、兽骨和勋章上限',()=>{
  const e=environment();
  for(const count of [0,-1,1.5,NaN,Infinity])assert.equal(e.run(`exchangeOfferedBonesForMedals(${count}).reason`),'invalid-quantity');
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'level');
  e.run('S.beastExchange.level=60');
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'not-offered');
  e.run('S.beastExchange.medalOffers=1');
  assert.equal(e.run('exchangeOfferedBonesForMedals(2).reason'),'not-offered');
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'insufficient-bone');
  e.run("S.res.bone=300;S.res.medal=resCap('medal')-600");
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'capacity');
  assert.equal(e.run('S.res.bone'),300);assert.equal(e.run('S.beastExchange.medalOffers'),1);
});

check('v32旧档候选补零、原文保护；坏值和未来版拒载不覆盖',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));delete old.beastExchange.medalOffers;
  old.res.medal=944;old.beastExchange.level=30;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.medal'),944);assert.equal(e.run('S.beastExchange.medalOffers'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>d.beastExchange.medalOffers=-1,d=>d.beastExchange.medalOffers=15,
    d=>d.beastExchange.medalOffers=1,d=>d.v=36]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===36?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
  const p338=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json'),'utf8');
  const live=environment({rts_save:p338});
  assert.equal(live.run('loadSaveAndApply().status'),'migrated');
  assert.equal(live.store.get('rts_save_premigration'),p338);
  assert.equal(live.run('S.beastExchange.level'),30);
  assert.equal(live.run('S.beastExchange.medalOffers'),0);
  assert.equal(live.run('S.res.medal'),944);
});

check('迁移前原文备份失败保持主档和运行状态只读',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));delete old.beastExchange.medalOffers;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.store.get('rts_save'),raw);
  assert.equal(e.run('S.beastExchange.medalOffers'),0);
  assert.equal(e.run('save().ok'),false);
});

check('刷新写盘失败时原货位和次数不丢失',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.beastExchange.medalOffers=1;save()');
  const raw=e.store.get('rts_save'),charges=e.run('S.beastExchange.refreshCharges');
  e.run("Math.random=()=>130.5/680;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('refreshBeastExchange().reason'),'save-failed');
  assert.equal(e.run('S.beastExchange.medalOffers'),1);
  assert.equal(e.run('S.beastExchange.refreshCharges'),charges);
  assert.equal(e.store.get('rts_save'),raw);
});

check('主档写失败时资源、上架数和交易进度完整回滚',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.beastExchange.medalOffers=1;S.res.bone=300;S.res.medal=944;save()');
  const raw=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('exchangeOfferedBonesForMedals(1).reason'),'save-failed');
  assert.equal(e.run('S.res.bone'),300);assert.equal(e.run('S.res.medal'),944);
  assert.equal(e.run('S.beastExchange.medalOffers'),1);
  assert.equal(e.run('S.beastExchange.progress'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
