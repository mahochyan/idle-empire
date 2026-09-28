'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('母本科研精通每级5%、上限20，前五级知识、第六级起加勋章',()=>{
  const ref=source.ents[460007];
  assert.equal(ref['resourceScience:LvMax'],20);
  assert.deepEqual(ref['resourceScience:Need'],[160003,500]);
  assert.deepEqual(ref['resourceScience:Need2'],[[160003,500],[160010,10]]);
  assert.deepEqual(ref['resourceScience:Get'],[350006,5]);
  const e=environment();
  assert.equal(e.run('CFG.scholarMastery.maxLevel'),20);
  assert.equal(e.run('scholarMasteryCost(0).tech'),500);
  assert.equal(e.run('scholarMasteryCost(4).medal'),undefined);
  assert.equal(e.run('scholarMasteryCost(5).medal'),60);
  assert.equal(e.run('scholarMasteryCost(20)'),null);
});

check('实际付款先检查工坊、逐级扣知识；第六级缺勋章时不改状态',()=>{
  const e=environment();
  e.run('S.res.tech=20000;S.res.medal=59');
  assert.equal(e.run('upgradeScholarMastery().reason'),'science-prerequisite');
  assert.equal(e.run('S.res.tech'),20000);
  e.run("S.sciences=['sci_workshop']");
  for(let level=1;level<=5;level++){
    assert.equal(e.run('upgradeScholarMastery().ok'),true);
    assert.equal(e.run('S.scholarMasteryLv'),level);
  }
  assert.equal(e.run('S.res.tech'),12500);
  assert.equal(e.run('upgradeScholarMastery().reason'),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),12500);
  e.run('S.res.medal=60');
  assert.equal(e.run('upgradeScholarMastery().ok'),true);
  assert.equal(e.run('S.scholarMasteryLv'),6);
  assert.equal(e.run('S.res.tech'),9500);
  assert.equal(e.run('S.res.medal'),0);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,32);
  assert.equal(saved.scholarMasteryLv,6);
  assert.equal(saved.res.tech,9500);
  assert.equal(saved.res.medal,0);
  assert.equal(e.run('upgradeScholarMastery().reason'),'insufficient-resources');
});

check('学者生产走真实产出函数，其他岗位和货币不受科研精通影响',()=>{
  const e=environment();
  e.run("S.sciences=['sci_workshop'];S.buildings.academy={lv:1,state:'idle'};S.popAlloc.tech=2;S.popAlloc.wood=1;S.res.tech=500");
  const before=e.run("({tech:prodRate('tech'),wood:prodRate('wood')})");
  assert.ok(before.tech>0);
  assert.equal(e.run('upgradeScholarMastery().ok'),true);
  assert.ok(Math.abs(e.run("prodRate('tech')")-before.tech*1.05)<1e-9);
  assert.equal(e.run("prodRate('wood')"),before.wood);
});

check('v17原档安全迁移到v32，保留零值、人口、超仓资源和迁移前原文',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.tech=999999;S.population.current=7;S.pool.infantry=4;const d=serializeSave();d.v=17;delete d.scholarMasteryLv;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.scholarMasteryLv'),0);
  assert.equal(e.run('S.res.tech'),999999);
  assert.equal(e.run('S.population.current'),7);
  assert.equal(e.run('S.pool.infantry'),4);
  assert.equal(JSON.parse(e.store.get('rts_save')).scholarMasteryLv,0);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
});

check('坏等级与未来版本保护主档，写入失败回滚等级和费用',()=>{
  const seed=environment();seed.run('save()');
  const valid=JSON.parse(seed.store.get('rts_save'));
  for(const mutate of [d=>delete d.scholarMasteryLv,d=>d.scholarMasteryLv=-1,d=>d.scholarMasteryLv=21,d=>d.scholarMasteryLv=1.5,d=>d.v=33]){
    const d=structuredClone(valid);mutate(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),d.v===33?'future':'invalid');
    e.run('tick()');assert.equal(e.store.get('rts_save'),raw);
  }
  const e=environment();e.run("S.sciences=['sci_workshop'];S.res.tech=500;save()");
  const original=e.store.get('rts_save');
  e.run("const priorWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');priorWrite(key,value)}");
  assert.equal(e.run('upgradeScholarMastery().reason'),'save-failed');
  assert.equal(e.run('S.res.tech'),500);
  assert.equal(e.run('S.scholarMasteryLv'),0);
  assert.equal(e.store.get('rts_save'),original);
});

console.log(`scholar mastery: ${passed}/5`);
