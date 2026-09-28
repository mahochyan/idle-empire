'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p273-nuclear-knowledge-six-paid-save.json'),'utf8');

check('量子研究保留星核前置和30亿知识／300万勋章的动作门',()=>{
  const e=environment();
  assert.equal(e.run("researchScience('sci_quantum_age').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_nuclear_age');S.res.tech=3000000000;S.res.medal=2999999");
  assert.equal(e.run("researchScience('sci_quantum_age').reason"),'insufficient-resources');
  e.run('S.res.medal=3000000');
  assert.equal(e.run("researchScience('sci_quantum_age').ok"),true);
  assert.equal(e.run('S.res.tech'),0);assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("S.sciences.filter(x=>x==='sci_quantum_age').length"),1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("scienceUnlocked('sci_quantum_age')"),true);
});

check('四项升级沿源460071–074付费，第6级起分别扣对应材料',()=>{
  const expected={quantumBasic:[500000000,'godCrystal',300],quantumMetal:[500000000,'guardianStone',300],
    quantumKnowledge:[500000000,'revivalLeaf',600],quantumProduction:[1000000000,'phantomFlower',1000]};
  for(const [key,[tech,material,base]] of Object.entries(expected)){
    const e=environment();
    assert.equal(e.run(`CFG.eraStorage.${key}.needScience`),'sci_quantum_age');
    assert.equal(e.run(`upgradeEraStorage('${key}').reason`),'science-prerequisite');
    e.run("S.sciences.push('sci_quantum_age')");
    assert.equal(e.run(`eraStorageCost('${key}').tech`),tech);
    e.run(`S.eraStorage.${key}=5;S.res.tech=${tech*6};S.items.${material}=${base*6-1}`);
    assert.equal(e.run(`eraStorageCost('${key}').${material}`),base*6);
    assert.equal(e.run(`upgradeEraStorage('${key}').reason`),'insufficient-items');
    e.run(`S.items.${material}++`);
    assert.equal(e.run(`upgradeEraStorage('${key}').ok`),true);
    assert.equal(e.run(`S.eraStorage.${key}`),6);
    assert.equal(e.run('S.res.tech'),0);
    assert.equal(e.run(`S.items.${material}`),0);
  }
});

check('量子仓容与生产独立乘区生效，钱币产率不受生产科技影响',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_quantum_age','sci_currency');S.popAlloc.tech=10;S.popAlloc.coin=1");
  const cap=e.run("resCap('tech')"),tech=e.run("prodRate('tech')"),coin=e.run("prodRate('coin')");
  e.run('S.eraStorage.quantumKnowledge=1;S.eraStorage.quantumProduction=1');
  assert.equal(e.run("resCap('tech')"),Math.floor(cap*1.1));
  assert.ok(Math.abs(e.run("prodRate('tech')")-tech*1.1)<1e-8);
  assert.equal(e.run("prodRate('coin')"),coin);
});

check('旧v32存档先保护原文再补零，非法字段和备份失败不写回',()=>{
  const e=environment({rts_save:source});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),source);
  for(const key of ['quantumBasic','quantumMetal','quantumKnowledge','quantumProduction'])assert.equal(e.run(`S.eraStorage.${key}`),0);
  assert.equal(e.run('S.defeated.length'),99);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  const invalid=JSON.parse(e.store.get('rts_save'));invalid.eraStorage.quantumKnowledge=-1;
  const raw=JSON.stringify(invalid),bad=environment({rts_save:raw});
  assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
  bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),raw);
  const blocked=environment({rts_save:source});
  blocked.run("const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');originalSet(k,v)}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),source);
});

check('量子研发和升级写档失败均回滚库存及进度',()=>{
  const e=environment();e.run("S.sciences.push('sci_nuclear_age');S.res.tech=3000000000;S.res.medal=3000000");
  e.run("const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalSet(k,v)}");
  assert.equal(e.run("researchScience('sci_quantum_age').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),3000000000);assert.equal(e.run('S.res.medal'),3000000);
  assert.equal(e.run("scienceUnlocked('sci_quantum_age')"),false);
  e.run("localStorage.setItem=originalSet;S.sciences.push('sci_quantum_age');S.res.tech=3000000000;S.eraStorage.quantumKnowledge=5;S.items.revivalLeaf=3600;save()");
  const stable=e.store.get('rts_save');
  e.run("localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalSet(k,v)}");
  assert.equal(e.run("upgradeEraStorage('quantumKnowledge').reason"),'save-failed');
  assert.equal(e.run('S.eraStorage.quantumKnowledge'),5);
  assert.equal(e.run('S.res.tech'),3000000000);assert.equal(e.run('S.items.revivalLeaf'),3600);
  assert.equal(e.store.get('rts_save'),stable);
});
console.log(`quantum economy: ${passed}/5`);
