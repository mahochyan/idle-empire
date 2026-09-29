'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}

check('蒸汽三条仓储科技的前置、等级费用和材料门',()=>{
  const e=environment();
  assert.equal(e.run("upgradeEraStorage('steamKnowledge').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_steam_age');S.res.tech=300000");
  assert.deepEqual(JSON.parse(e.run("JSON.stringify(eraStorageCost('steamKnowledge'))")),{tech:300000});
  assert.equal(e.run("upgradeEraStorage('steamKnowledge').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.eraStorage.steamKnowledge'),1);
  e.run('S.eraStorage.steamKnowledge=5;S.res.tech=1800000');
  assert.deepEqual(JSON.parse(e.run("JSON.stringify(eraStorageCost('steamKnowledge'))")),{tech:1800000,godCrystal:60});
  assert.equal(e.run("upgradeEraStorage('steamKnowledge').reason"),'insufficient-items');
  assert.equal(e.run('S.res.tech'),1800000);
  assert.equal(e.run('S.eraStorage.steamKnowledge'),5);
});

check('基础、金属、知识容量只受对应研究影响，逐段取整且不缩旧超仓',()=>{
  const e=environment();
  e.run('S.storageMasteryLv=5;S.eraStorage.steamBasic=2;S.eraStorage.steamMetal=3;S.eraStorage.steamKnowledge=4');
  for(const [rk,lv]of[['wood',2],['stone',2],['food',2],['coal',2],['copper',3],['iron',3],['silver',3],['gold',3],['steel',3],['tech',4]]){
    const boosted=e.run(`resCap('${rk}')`);
    e.run(`S.eraStorage.steamBasic=0;S.eraStorage.steamMetal=0;S.eraStorage.steamKnowledge=0`);
    const base=e.run(`resCap('${rk}')`);
    assert.equal(boosted,Math.floor(base*(1+lv*0.1)),rk);
    e.run('S.eraStorage.steamBasic=2;S.eraStorage.steamMetal=3;S.eraStorage.steamKnowledge=4');
  }
  const coinCap=e.run("resCap('coin')");
  e.run('S.eraStorage.steamBasic=0;S.eraStorage.steamMetal=0;S.eraStorage.steamKnowledge=0');
  assert.equal(e.run("resCap('coin')"),coinCap);
  e.run('S.res.steel=123456');
  assert.equal(e.run('S.res.steel'),123456);
});

check('双物资升级只扣一次；保存失败恢复等级、资源和道具',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_steam_age');S.eraStorage.steamMetal=5;S.res.tech=3000000;S.items.godCrystal=30;save()");
  const raw=e.store.get('rts_save');
  e.run("const oldEraWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldEraWrite(k,v)}");
  assert.equal(e.run("upgradeEraStorage('steamMetal').reason"),'save-failed');
  assert.equal(e.run('S.eraStorage.steamMetal'),5);
  assert.equal(e.run('S.res.tech'),3000000);
  assert.equal(e.run('S.items.godCrystal'),30);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=oldEraWrite');
  assert.equal(e.run("upgradeEraStorage('steamMetal').ok"),true);
  assert.equal(e.run('S.eraStorage.steamMetal'),6);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.items.godCrystal'),0);
});

check('v12迁移保留超仓与旧进度，v35字段严格验证，未来档保护',()=>{
  const seed=environment();
  seed.run('S.res.steel=100001;S.population.current=27;save()');
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=12;delete old.eraStorage;delete old.items;delete old.killValues;
  const text=JSON.stringify(old);
  const migrated=environment({rts_save:text});
  assert.equal(migrated.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migrated.run('S.res.steel'),100001);
  assert.equal(migrated.run('S.population.current'),27);
  assert.equal(migrated.run('S.eraStorage.steamKnowledge'),0);
  assert.equal(migrated.run('S.items.godCrystal'),0);
  assert.equal(migrated.store.get('rts_save_premigration'),text);
  for(const mutate of [d=>delete d.eraStorage,d=>d.eraStorage.steamBasic=-1,d=>d.items.godCrystal=Infinity,d=>d.v=36]){
    const bad=JSON.parse(migrated.store.get('rts_save'));mutate(bad);
    const raw=JSON.stringify(bad),x=environment({rts_save:raw});
    assert.equal(x.run('loadSaveAndApply().status'),bad.v===36?'future':'invalid');
    assert.equal(x.run('saveProtected()'),true);
    x.run('tick();save()');
    assert.equal(x.store.get('rts_save'),raw);
  }
});
check('v12迁移前原文保护副本写失败时主档保持原样且进入只读',()=>{
  const seed=environment();seed.run('S.res.steel=20000;save()');
  const d=JSON.parse(seed.store.get('rts_save'));d.v=12;delete d.eraStorage;delete d.items;
  const raw=JSON.stringify(d),e=environment({rts_save:raw});
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.store.get('rts_save'),raw);
  assert.equal(e.run('S.res.steel'),0);
});
console.log(`steam storage: ${passed}/5`);
