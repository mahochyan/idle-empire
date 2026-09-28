'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('母本冶钢精通20级、每级5%，前五级知识、第六级起另需勋章',()=>{
  const ref=source.ents[460013],e=environment();
  assert.equal(ref['resourceScience:LvMax'],20);
  assert.deepEqual(ref['resourceScience:Need'],[160003,1500]);
  assert.deepEqual(ref['resourceScience:Need2'],[[160003,1500],[160010,30]]);
  assert.deepEqual(ref['resourceScience:Get'],[350012,5]);
  assert.equal(ref['resourceScience:LimitID'],450017);
  assert.equal(e.run('CFG.steelMastery.maxLevel'),20);
  assert.equal(e.run('steelMasteryCost(0).tech'),1500);
  assert.equal(e.run('steelMasteryCost(0).medal'),undefined);
  assert.equal(e.run('steelMasteryCost(5).tech'),9000);
  assert.equal(e.run('steelMasteryCost(5).medal'),180);
  assert.equal(e.run('steelMasteryCost(20)'),null);
});

check('研究动作检查冶钢前置、逐级付款、满级和缺勋章',()=>{
  const e=environment();
  e.run('S.res.tech=50000;S.res.medal=179');
  assert.equal(e.run('upgradeSteelMastery().reason'),'science-prerequisite');
  e.run("S.sciences=['sci_steel']");
  for(let lv=1;lv<=5;lv++)assert.equal(e.run('upgradeSteelMastery().level'),lv);
  assert.equal(e.run('S.res.tech'),27500);
  assert.equal(e.run('upgradeSteelMastery().reason'),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),27500);
  e.run('S.res.medal=180');
  assert.equal(e.run('upgradeSteelMastery().level'),6);
  assert.equal(e.run('S.res.tech'),18500);
  assert.equal(e.run('S.res.medal'),0);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,32);
  assert.equal(saved.steelMasteryLv,6);
  e.run('S.steelMasteryLv=20');
  assert.equal(e.run('upgradeSteelMastery().reason'),'max-level');
});

check('钢工真实在线与离线共用产率，学者和其它岗位不受影响',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steel'];S.buildings.steel_refinery={lv:1,state:'idle'};S.popAlloc.steel=1;S.popAlloc.tech=1;S.buildings.academy={lv:1,state:'idle'};S.res.tech=1500;S.res.iron=100;S.res.stone=100;S.res.coal=100");
  const before=e.run("({steel:prodRate('steel'),tech:prodRate('tech'),wood:prodRate('wood')})");
  const onlineBefore=e.run('productionSecond(1,true).steel-S.res.steel');
  assert.equal(e.run('upgradeSteelMastery().ok'),true);
  assert.ok(Math.abs(e.run("prodRate('steel')")-before.steel*1.05)<1e-9);
  assert.ok(Math.abs(e.run('productionSecond(1,true).steel-S.res.steel')-onlineBefore*1.05)<1e-9);
  assert.ok(Math.abs(e.run('productionSecond(0.6,true).steel-S.res.steel')-onlineBefore*1.05*0.6)<1e-9);
  assert.equal(e.run("prodRate('tech')"),before.tech);
  assert.equal(e.run("prodRate('wood')"),before.wood);
});

check('v20独立候选迁移保留合法0、超仓资源、人口与兵力',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.steel=999999;S.population.current=7;S.pool.infantry=4;const d=serializeSave();d.v=20;delete d.steelMasteryLv;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.steelMasteryLv'),0);
  assert.equal(e.run('S.res.steel'),999999);
  assert.equal(e.run('S.population.current'),7);
  assert.equal(e.run('S.pool.infantry'),4);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
});

check('无效新等级与未来档只读，主档或保护副本写入失败不扣费',()=>{
  const seed=environment();seed.run('save()');
  const valid=JSON.parse(seed.store.get('rts_save'));
  for(const mutate of [d=>delete d.steelMasteryLv,d=>d.steelMasteryLv=-1,d=>d.steelMasteryLv=21,d=>d.steelMasteryLv=1.5,d=>d.v=33]){
    const d=structuredClone(valid);mutate(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),d.v===33?'future':'invalid');
    e.run('tick()');assert.equal(e.store.get('rts_save'),raw);
  }
  const e=environment();e.run("S.sciences=['sci_steel'];S.res.tech=1500;save()");
  const original=e.store.get('rts_save');
  e.run("const priorWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');priorWrite(key,value)}");
  assert.equal(e.run('upgradeSteelMastery().reason'),'save-failed');
  assert.equal(e.run('S.res.tech'),1500);
  assert.equal(e.run('S.steelMasteryLv'),0);
  assert.equal(e.store.get('rts_save'),original);
  const old=structuredClone(valid);old.v=20;delete old.steelMasteryLv;
  const raw=JSON.stringify(old),failed=environment({rts_save:raw});
  failed.run("const priorWrite=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save_premigration')throw Error('quota');priorWrite(key,value)}");
  assert.equal(failed.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(failed.store.get('rts_save'),raw);
});

console.log(`steel mastery: ${passed}/5`);
