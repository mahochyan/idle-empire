'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p271-stage99-fulltech-seed1-save.json'),'utf8');

check('星核四项费用与材料分别对应母本460081–084，未研究不可直接升级',()=>{
  const e=environment();
  const expected={nuclearBasic:[30000000,'godCrystal',50],nuclearMetal:[30000000,'guardianStone',50],
    nuclearKnowledge:[20000000,'revivalLeaf',100],nuclearProduction:[10000000,'phantomFlower',150]};
  for(const [key,[tech,material,amount]] of Object.entries(expected)){
    const c=e.run(`CFG.eraStorage.${key}`);
    assert.equal(c.needScience,'sci_nuclear_age');assert.equal(c.techBase,tech);
    assert.equal(c.lateMaterial,material);assert.equal(c.lateMaterialBase,amount);
    assert.equal(e.run(`eraStorageCost('${key}').tech`),tech);
    assert.equal(e.run(`upgradeEraStorage('${key}').reason`),'science-prerequisite');
    e.run(`S.eraStorage.${key}=5`);
    assert.equal(e.run(`eraStorageCost('${key}').${material}`),amount*6);
  }
  assert.equal(e.run('CFG.eraMaterials.revivalLeaf.max'),1000000);
});

check('旧v32原文受保护，星核新字段补零且旧库存/进度不裁剪',()=>{
  const e=environment({rts_save:source});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),source);
  for(const key of ['nuclearBasic','nuclearMetal','nuclearKnowledge','nuclearProduction'])assert.equal(e.run(`S.eraStorage.${key}`),0);
  assert.equal(e.run('S.items.revivalLeaf'),0);assert.equal(e.run('S.killValues.godRebirth'),0);
  assert.equal(e.run('S.population.current'),1002);assert.equal(e.run('S.defeated.length'),99);
  assert.equal(e.run('S.res.tech'),JSON.parse(source).res.tech);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.eraStorage.nuclearKnowledge'),0);
  const invalid=JSON.parse(e.store.get('rts_save'));invalid.eraStorage.nuclearKnowledge=-1;
  const raw=JSON.stringify(invalid),bad=environment({rts_save:raw});
  assert.equal(bad.run('loadSaveAndApply().status'),'invalid');bad.run('tick();save()');
  assert.equal(bad.store.get('rts_save'),raw);
});

check('旧v32迁移备份失败时不提交候选状态或覆盖原档',()=>{
  for(const key of ['rts_save_premigration','rts_save_backup_1','rts_save']){
    const e=environment({rts_save:source});
    e.run(`const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${key}')throw Error('quota');originalSet(k,v)}`);
    assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
    assert.equal(e.run('saveProtected()'),true);
    assert.equal(e.store.get('rts_save'),source);
    assert.equal(e.run('S.population.current'),0);
  }
});

check('首级知识容量实付、非货币生产乘区与写档失败回滚',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  const beforeCap=e.run("resCap('tech')");
  e.run('S.res.tech=20000000');
  assert.equal(e.run("upgradeEraStorage('nuclearKnowledge').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.eraStorage.nuclearKnowledge'),1);
  assert.equal(e.run("resCap('tech')"),Math.floor(beforeCap*1.1));
  const saved=e.store.get('rts_save');
  e.run('S.res.tech=10000000;S.popAlloc.tech=999;S.popAlloc.food=2;S.popAlloc.coin=1');
  const baseTech=e.run("prodRate('tech')");
  const baseCoin=e.run("prodRate('coin')");
  assert.ok(baseTech>0);assert.ok(baseCoin>0);
  assert.equal(e.run("upgradeEraStorage('nuclearProduction').ok"),true);
  assert.ok(Math.abs(e.run("prodRate('tech')")-baseTech*1.1)<1e-6);
  assert.equal(e.run("prodRate('coin')"),baseCoin);
  e.run('S.res.tech=180000000;S.eraStorage.nuclearBasic=5;S.items.godCrystal=299');
  assert.equal(e.run("upgradeEraStorage('nuclearBasic').reason"),'insufficient-items');
  assert.equal(e.run('S.res.tech'),180000000);
  e.run('S.items.godCrystal=300;save()');const stable=e.store.get('rts_save');
  e.run("const writeNuclear=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');writeNuclear(k,v)}");
  assert.equal(e.run("upgradeEraStorage('nuclearBasic').reason"),'save-failed');
  assert.equal(e.run('S.eraStorage.nuclearBasic'),5);
  assert.equal(e.run('S.res.tech'),180000000);assert.equal(e.run('S.items.godCrystal'),300);
  assert.equal(e.store.get('rts_save'),stable);
  assert.ok(saved.length>0);
});

check('复苏圣域从星核科技开启，真实战斗胜利授叶并只结算一次',()=>{
  const e=environment({rts_save:source});const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const beforeLeaf=run('S.items.revivalLeaf'),beforeKill=run('S.killValues.godRebirth');
  run("openMaterialDomain('revivalLeaf')");assert.equal(run('S.battleActive'),true);
  let callbacks=0;while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);assert.ok(callbacks<2000);
  assert.equal(run("document.getElementById('battle-result').className"),'win');
  assert.equal(run('S.items.revivalLeaf'),beforeLeaf+2);
  assert.equal(run('S.killValues.godRebirth'),beforeKill+100);
  assert.equal(run('S.defeated.length'),99);
  run("endBattle('win')");
  assert.equal(run('S.items.revivalLeaf'),beforeLeaf+2);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.revivalLeaf'),beforeLeaf+2);
});
console.log(`nuclear storage: ${passed}/5`);
