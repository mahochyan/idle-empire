'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}

check('图书馆与工坊技术按真实研究和建筑门槛开放',()=>{
  const e=environment();
  assert.equal(e.run("buildAct('library').ok"),false);
  assert.equal(e.run("researchScience('sci_workshop').ok"),false);
  e.run("S.sciences=['sci_prospect'];S.res.tech=1000;S.res.wood=1000;S.res.stone=1000");
  assert.equal(e.run("researchScience('sci_library').ok"),true);
  assert.equal(e.run("researchScience('sci_workshop').ok"),true);
  assert.equal(e.run("buildAct('library').ok"),true);
  e.run("advanceBuildingsBy(8)");
  assert.equal(e.run("bldSt('library').lv"),1);
  assert.equal(e.run("resCap('tech')"),3200);
});

check('前五级逐级付知识并只扩大物资容量',()=>{
  const e=environment();
  e.run("S.sciences=['sci_workshop'];S.res.tech=10000");
  const basic=e.run("resCap('wood')"),coin=e.run("resCap('coin')"),deed=e.run("resCap('deed')"),steel=e.run("resCap('steel')");
  for(let i=1;i<=5;i++){
    assert.equal(e.run('storageMasteryCost().tech'),500*i);
    assert.equal(e.run('upgradeStorageMastery().ok'),true);
  }
  assert.equal(e.run('S.storageMasteryLv'),5);
  assert.equal(e.run('S.res.tech'),2500);
  assert.equal(e.run("resCap('wood')"),Math.floor(basic*1.5));
  assert.equal(e.run("resCap('steel')"),Math.floor(steel*1.5));
  assert.equal(e.run("resCap('coin')"),coin);
  assert.equal(e.run("resCap('deed')"),deed);
});

check('第六级必须同时支付知识、金属金和钢，失败不扣费',()=>{
  const e=environment();
  e.run("S.sciences=['sci_workshop'];S.storageMasteryLv=5;S.res.tech=6000;S.res.gold=5999;S.res.steel=6000");
  assert.equal(e.run('storageMasteryCost().tech'),3000);
  assert.equal(e.run('storageMasteryCost().gold'),6000);
  assert.equal(e.run('storageMasteryCost().steel'),6000);
  assert.equal(e.run('upgradeStorageMastery().reason'),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),6000);
  assert.equal(e.run('S.storageMasteryLv'),5);
  e.run('S.res.gold=6000');
  assert.equal(e.run('upgradeStorageMastery().ok'),true);
  assert.equal(e.run('S.storageMasteryLv'),6);
  assert.equal(e.run('S.res.tech'),3000);
  assert.equal(e.run('S.res.gold'),0);
  assert.equal(e.run('S.res.steel'),0);
});

check('旧v11候选迁移保留超仓资源、兵力和人口，合法0往返',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.steel=999;S.population.current=7;S.pool.infantry=4;const d=serializeSave();d.v=11;delete d.storageMasteryLv;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('S.storageMasteryLv'),0);
  assert.equal(e.run('S.res.steel'),999);
  assert.equal(e.run('S.population.current'),7);
  assert.equal(e.run('S.pool.infantry'),4);
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,34);
  e.run('save()');
  assert.equal(JSON.parse(e.store.get('rts_save')).storageMasteryLv,0);
});

check('坏v34和未来v35保护主档，不被tick覆盖',()=>{
  const seed=environment();seed.run('save()');
  const valid=JSON.parse(seed.store.get('rts_save'));
  for(const mutate of [d=>delete d.storageMasteryLv,d=>{d.storageMasteryLv=-1},d=>{d.storageMasteryLv=1.5},d=>{d.storageMasteryLv=101},d=>{d.v=35}]){
    const d=structuredClone(valid);mutate(d);const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    e.run('tick()');assert.equal(e.store.get('rts_save'),raw);
  }
});

check('储存精通写入失败回滚知识和等级',()=>{
  const e=environment();e.run("S.sciences=['sci_workshop'];S.res.tech=500;save()");
  const raw=e.store.get('rts_save');
  e.run("const priorWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');priorWrite(key,value)}");
  assert.equal(e.run('upgradeStorageMastery().reason'),'save-failed');
  assert.equal(e.run('S.res.tech'),500);
  assert.equal(e.run('S.storageMasteryLv'),0);
  assert.equal(e.store.get('rts_save'),raw);
});
console.log(`storage mastery: ${passed}/6`);
