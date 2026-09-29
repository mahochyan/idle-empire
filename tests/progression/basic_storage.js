'use strict';

// 新档分项木石粮仓容与 v5 历史仓容迁移：调用真实研究、建造、生产、存档函数。
const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed=0,failed=0;
function check(name,run){try{run();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}
function saveJson(e){return JSON.parse(e.store.get('rts_save'));}

check('新档 v32 使用木1800、石1200、粮3000分项上限，合法初值可生产',()=>{
  const e=environment();
  1332;
  assert.equal(e.run('CFG.save.schema'),24);
  assert.equal(e.run('S.storageMode'),'aligned');
  assert.deepEqual(Array.from(e.run("['wood','stone','food'].map(resCap)")),[1800,1200,3000]);
  assert.equal(e.run('S.res.wood'),300);
  e.run('S.population.current=4;S.popAlloc.wood=1;S.res.wood=1799');
  e.run('S.res=productionSecond()');
  assert.equal(e.run('S.res.wood'),1800);
  assert.equal(e.run('save().ok'),true);
  const d=saveJson(e);
  1332;
  assert.equal(d.storageMode,'aligned');
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(Array.from(loaded.run("['wood','stone','food'].map(resCap)")),[1800,1200,3000]);
});

check('新档木仓研究后真实付木800建造，完工只增木600石400',()=>{
  const e=environment();
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_wood_store')")),['sci_prospect']);
  assert.equal(e.run('activeSciences().sci_wood_store.cost.tech'),400);
  assert.equal(e.run("buildAct('warehouse').reason"),'need-science');
  e.run('S.res.tech=400');
  assert.equal(e.run("researchScience('sci_wood_store').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_prospect')");
  assert.equal(e.run("researchScience('sci_wood_store').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.deepEqual(JSON.parse(e.run("JSON.stringify(buildingInitialCost('warehouse'))")),
    {wood:800,stone:0,food:0,time:5});
  e.run('S.res.wood=799');
  assert.equal(e.run("buildAct('warehouse').reason"),'resources');
  e.run('S.res.wood=800');
  assert.equal(e.run("buildAct('warehouse').ok"),true);
  assert.equal(e.run('S.res.wood'),0);
  assert.deepEqual(Array.from(e.run("['wood','stone','food'].map(resCap)")),[1800,1200,3000]);
  e.run('advanceBuildingsBy(30)');
  assert.deepEqual(Array.from(e.run("['wood','stone','food'].map(resCap)")),[2400,1600,3000]);
  assert.equal(e.run("upCost('warehouse').wood"),960);
  assert.equal(e.run("upCost('warehouse').stone"),0);
});

check('木石仓储研究或建仓写档失败均不扣费、不解锁、不扩容',()=>{
  const study=environment();
  study.run("S.sciences.push('sci_prospect');S.res.tech=400;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(study.run("researchScience('sci_wood_store').reason"),'save-failed');
  assert.equal(study.run('S.res.tech'),400);
  assert.equal(study.run("S.sciences.includes('sci_wood_store')"),false);
  const build=environment();
  build.run("S.sciences.push('sci_wood_store');S.res.wood=800;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(build.run("buildAct('warehouse').reason"),'save-failed');
  assert.equal(build.run('S.res.wood'),800);
  assert.equal(build.run("bldSt('warehouse').lv"),0);
  assert.deepEqual(Array.from(build.run("['wood','stone','food'].map(resCap)")),[1800,1200,3000]);
});

check('旧 v5 高库存和仓库等级迁到 v32 legacy，原文备份、合法0与原容量保留',()=>{
  const seed=environment();
  seed.run("S.buildings.warehouse={lv:2,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=50000;S.res.stone=40000;S.res.food=30000;S.res.tech=0;S.res.deed=0");
  const old=seed.run("(()=>{const d=serializeSave();d.v=5;delete d.storageMode;return JSON.stringify(d)})()");
  const e=environment({rts_save:old});
  const result=e.run('loadSaveAndApply()');
  assert.equal(result.status,'migrated');
  assert.equal(e.store.get('rts_save_premigration'),old);
  assert.equal(e.run('S.storageMode'),'legacy');
  assert.equal(saveJson(e).storageMode,'legacy');
  1332;
  assert.equal(e.run('S.res.wood'),50000);
  assert.equal(e.run('S.res.stone'),40000);
  assert.equal(e.run('S.res.food'),30000);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.deed'),0);
  assert.deepEqual(Array.from(e.run("['wood','stone','food'].map(resCap)")),[110000,110000,110000]);
  assert.deepEqual(JSON.parse(e.run("JSON.stringify(buildingInitialCost('warehouse'))")),
    {wood:200,stone:200,food:100,time:5});
  assert.equal(e.run("upCost('warehouse').wood"),6000);
});

check('旧 v5 未建仓仍可沿用旧成本；新木仓研究不会收取无用科技费',()=>{
  const seed=environment();
  const old=seed.run("(()=>{const d=serializeSave();d.v=5;delete d.storageMode;return JSON.stringify(d)})()");
  const e=environment({rts_save:old});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run("buildingScienceUnlocked('warehouse')"),true);
  assert.equal(e.run("buildAct('warehouse').ok"),true);
  assert.equal(e.run('S.storageMode'),'legacy');
  e.run("S.sciences.push('sci_prospect');S.res.tech=400");
  const before=e.run('S.res.tech');
  assert.equal(e.run("researchScience('sci_wood_store').reason"),'mode-mismatch');
  assert.equal(e.run('S.res.tech'),before);
});

check('v5 带有未定义的同名仓容字段也迁为历史模式',()=>{
  const seed=environment();
  const old=seed.run("(()=>{const d=serializeSave();d.v=5;return JSON.stringify(d)})()");
  const e=environment({rts_save:old});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('S.storageMode'),'legacy');
  assert.deepEqual(Array.from(e.run("['wood','stone','food'].map(resCap)")),[10000,10000,10000]);
});

check('v32 缺仓容模式或非法模式拒载并阻止 tick 自动写回；v33 仍保护',()=>{
  for(const variant of ['missing','invalid','future']){
    const seed=environment();
    const d=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
    if(variant==='missing')delete d.storageMode;
    else if(variant==='invalid')d.storageMode='wrong';
    else d.v=34;
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    const status=e.run('loadSaveAndApply().status');
    assert.equal(status,variant==='future'?'future':'invalid');
    assert.equal(e.run('saveProtected()'),true);
    e.run('for(let i=0;i<61;i++)tick()');
    assert.equal(e.store.get('rts_save'),raw);
  }
});

check('迁移前保护副本写失败时，旧 v5 主档和运行状态均不被覆盖',()=>{
  const seed=environment();
  const old=seed.run("(()=>{const d=serializeSave();d.v=5;delete d.storageMode;return JSON.stringify(d)})()");
  const e=environment({rts_save:old});
  e.run("const oldStorageSet=localStorage.setItem;localStorage.setItem=(key,text)=>{if(key==='rts_save_premigration')throw new Error('quota');oldStorageSet(key,text)}");
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.store.get('rts_save'),old);
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.run('S.storageMode'),'aligned','迁移候选失败前不可污染运行中的新档默认态');
});

check('新档超当前上限的合法库存刷新后原样保留，停产不裁剪',()=>{
  const e=environment();
  e.run('S.res.wood=10000;S.res.stone=5000;S.res.food=9000;S.population.current=4;S.popAlloc.wood=1');
  assert.equal(e.run('save().ok'),true);
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  loaded.run('S.res=productionSecond()');
  assert.equal(loaded.run('S.res.wood'),10000);
  assert.equal(loaded.run('S.res.stone'),5000);
  assert.ok(loaded.run('S.res.food')<=9000);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
