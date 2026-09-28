'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('电力四项科技的前置、首五级知识费及第六级材料费',()=>{
  const e=environment();
  for(const [key,base,material,materialBase] of [
    ['electricBasic',3000000,'guardianStone',10],['electricMetal',3000000,'guardianStone',10],
    ['electricKnowledge',2000000,'guardianStone',20],['electricProduction',1000000,'phantomFlower',30]
  ]){
    assert.equal(e.run(`CFG.eraStorage.${key}.needScience`),'sci_electric_age');
    assert.equal(e.run(`upgradeEraStorage('${key}').reason`),'science-prerequisite');
    assert.deepEqual(JSON.parse(e.run(`JSON.stringify(eraStorageCost('${key}'))`)),{tech:base});
    e.run(`S.eraStorage.${key}=4`);
    assert.deepEqual(JSON.parse(e.run(`JSON.stringify(eraStorageCost('${key}'))`)),{tech:base*5});
    e.run(`S.eraStorage.${key}=5`);
    assert.deepEqual(JSON.parse(e.run(`JSON.stringify(eraStorageCost('${key}'))`)),{tech:base*6,[material]:materialBase*6});
    e.run(`S.eraStorage.${key}=0`);
  }
});

check('电力升级实际扣款、材料缺失不扣费、写档失败全回滚',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_electric_age');S.res.tech=3000000;save()");
  const first=e.run("upgradeEraStorage('electricBasic')");
  assert.equal(first.ok,true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.eraStorage.electricBasic'),1);
  e.run('S.eraStorage.electricBasic=5;S.res.tech=18000000');
  assert.equal(e.run("upgradeEraStorage('electricBasic').reason"),'insufficient-items');
  assert.equal(e.run('S.res.tech'),18000000);
  e.run('S.items.guardianStone=60;save()');
  const raw=e.store.get('rts_save');
  e.run("const originalElectricStorageWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalElectricStorageWrite(k,v)}");
  assert.equal(e.run("upgradeEraStorage('electricBasic').reason"),'save-failed');
  assert.equal(e.run('S.eraStorage.electricBasic'),5);
  assert.equal(e.run('S.res.tech'),18000000);
  assert.equal(e.run('S.items.guardianStone'),60);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=originalElectricStorageWrite');
  assert.equal(e.run("upgradeEraStorage('electricBasic').ok"),true);
  assert.equal(e.run('S.eraStorage.electricBasic'),6);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.items.guardianStone'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).eraStorage.electricBasic,6);
  e.run('S.eraStorage.electricProduction=5;S.res.tech=6000000;S.items.phantomFlower=179');
  assert.equal(e.run("upgradeEraStorage('electricProduction').reason"),'insufficient-items');
  assert.equal(e.run('S.res.tech'),6000000);
  e.run('S.items.phantomFlower=180');
  assert.equal(e.run("upgradeEraStorage('electricProduction').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.items.phantomFlower'),0);
  assert.equal(e.run('S.eraStorage.electricProduction'),6);
});

check('电力容量按基础/金属/知识分组接在蒸汽后逐段取整，旧超仓不裁剪',()=>{
  const e=environment();
  e.run('S.storageMasteryLv=3;S.eraStorage.steamBasic=1;S.eraStorage.steamMetal=2;S.eraStorage.steamKnowledge=3');
  const before=Object.fromEntries(['wood','stone','food','coal','copper','iron','silver','gold','steel','tech','coin','silverCoin'].map(rk=>[rk,e.run(`resCap('${rk}')`)]));
  e.run('S.eraStorage.electricBasic=2;S.eraStorage.electricMetal=3;S.eraStorage.electricKnowledge=4');
  for(const rk of ['wood','stone','food','coal'])assert.equal(e.run(`resCap('${rk}')`),Math.floor(before[rk]*1.2),rk);
  for(const rk of ['copper','iron','silver','gold','steel'])assert.equal(e.run(`resCap('${rk}')`),Math.floor(before[rk]*1.3),rk);
  assert.equal(e.run("resCap('tech')"),Math.floor(before.tech*1.4));
  assert.equal(e.run("resCap('coin')"),before.coin);
  assert.equal(e.run("resCap('silverCoin')"),before.silverCoin);
  e.run('S.res.steel=123456789;save()');
  assert.equal(e.run('S.res.steel'),123456789);
  assert.equal(JSON.parse(e.store.get('rts_save')).res.steel,123456789);
});

check('电力生产科技通过真实产率和tick增幅非货币岗位，货币不增幅',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_currency');S.popAlloc.wood=2;S.popAlloc.coin=1;S.popAlloc.stone=0;S.popAlloc.food=0");
  const wood=e.run("prodRate('wood')"),coin=e.run("prodRate('coin')");
  e.run('S.eraStorage.electricProduction=1');
  assert.ok(Math.abs(e.run("prodRate('wood')")-wood*1.1)<1e-9);
  assert.equal(e.run("prodRate('coin')"),coin);
  const start=e.run('S.res.wood');
  assert.ok(Math.abs(e.run('productionSecond(0.6,true).wood')-start-wood*1.1*0.6)<1e-9);
  e.run('tick()');
  assert.ok(Math.abs(e.run('S.res.wood')-start-wood*1.1)<1e-9);
  e.run('save()');
  const reloaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.eraStorage.electricProduction'),1);
});

check('v14迁移补零并保留主档/超仓/旧研究，损坏v32与未来v33不写回',()=>{
  const seed=environment();
  seed.run("S.eraStorage.steamKnowledge=6;S.items.godCrystal=2;S.res.steel=1234567;S.sciences.push('sci_electric_age');save()");
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=14;
  for(const key of ['electricBasic','electricMetal','electricKnowledge','electricProduction'])delete old.eraStorage[key];
  for(const key of ['guardianStone','phantomFlower'])delete old.items[key];
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.eraStorage.steamKnowledge'),6);
  assert.equal(e.run('S.items.godCrystal'),2);
  assert.equal(e.run('S.res.steel'),1234567);
  assert.equal(e.run("S.sciences.includes('sci_electric_age')"),true);
  assert.equal(e.run('S.eraStorage.electricKnowledge'),0);
  assert.equal(e.run('S.items.guardianStone'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
  for(const mutate of [d=>delete d.eraStorage.electricBasic,d=>{d.eraStorage.electricBasic=-1},d=>delete d.items.phantomFlower,d=>{d.items.guardianStone=Infinity},d=>{d.v=33}]){
    const bad=JSON.parse(e.store.get('rts_save'));mutate(bad);
    const text=JSON.stringify(bad),x=environment({rts_save:text});
    assert.notEqual(x.run('loadSaveAndApply().status'),'ok');
    x.run('tick()');
    assert.equal(x.store.get('rts_save'),text);
  }
  const protectedEnv=environment({rts_save:raw});
  protectedEnv.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(protectedEnv.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(protectedEnv.store.get('rts_save'),raw);
});

console.log(`electric technology: ${passed}/5`);
