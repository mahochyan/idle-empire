'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('电力时代仅接蒸汽，单笔知识500万与钢100万',()=>{
  const e=environment();
  for(const table of ['sciences','sciencesLong']){
    assert.deepEqual(Array.from(e.run(`CFG.${table}.sci_electric_age.need`)),['sci_steam_age']);
    assert.equal(e.run(`CFG.${table}.sci_electric_age.cost.tech`),5000000);
    assert.equal(e.run(`CFG.${table}.sci_electric_age.cost.steel`),1000000);
  }
  assert.equal(e.run("researchScience('sci_electric_age').reason"),'science-prerequisite');
  assert.equal(e.run("buildAct('electric_armory').reason"),'need-science');
  assert.equal(e.run("train('electro_trooper',1).reason"),'locked');
});

check('电力研究缺一项不扣费，写档失败回滚，两项足额仅扣一次',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age'];S.res.tech=5000000;S.res.steel=999999");
  assert.equal(e.run("researchScience('sci_electric_age').reason"),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),5000000);
  e.run('S.res.steel=1000000;save()');
  const raw=e.store.get('rts_save');
  e.run("const originalElectricWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalElectricWrite(k,v)}");
  assert.equal(e.run("researchScience('sci_electric_age').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),5000000);
  assert.equal(e.run('S.res.steel'),1000000);
  assert.equal(e.run("S.sciences.includes('sci_electric_age')"),false);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=originalElectricWrite');
  assert.equal(e.run("researchScience('sci_electric_age').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("researchScience('sci_electric_age').repeat"),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).sciences.includes('sci_electric_age'),true);
});

check('电磁兵坊解锁后每兵实扣铜铁钢各8000，远征和驻军都使用真实兵种',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age','sci_electric_age'];S.res.wood=2500;S.res.stone=2200;S.res.food=1200;S.res.copper=8000;S.res.iron=8000;S.res.steel=8000");
  assert.equal(e.run("train('electro_trooper',1).reason"),'locked');
  assert.equal(e.run("buildAct('electric_armory').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("train('electro_trooper',1).ok"),true);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.electro_trooper'),1);
  for(const rk of ['copper','iron','steel'])assert.equal(e.run(`S.res.${rk}`),0);
  e.run("S.formation.front=[{type:'electro_trooper',count:1,id:401}];S._garrisonForm.front=[{type:'electro_trooper',count:1,id:402}];S.selEnemy=0;B.isTraining=false;initBattleState()");
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

check('v18存档可加载，电力研究、兵坊与兵力往返',()=>{
  const e=environment();
  e.run('save()');
  const old=environment({rts_save:e.store.get('rts_save')});
  assert.equal(old.run('loadSaveAndApply().status'),'ok');
  assert.equal(old.run("S.sciences.includes('sci_electric_age')"),false);
  assert.equal(old.run('S.pool.electro_trooper||0'),0);
  old.run("S.sciences.push('sci_electric_age');S.buildings.electric_armory={lv:1,state:'idle'};S.pool.electro_trooper=2;save()");
  const restored=environment({rts_save:old.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run("S.sciences.includes('sci_electric_age')"),true);
  assert.equal(restored.run("bldSt('electric_armory').lv"),1);
  assert.equal(restored.run('S.pool.electro_trooper'),2);
  assert.equal(restored.run('serializeSave().v'),32);
});
console.log(`electric era: ${passed}/4`);
