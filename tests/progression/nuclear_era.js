'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('星核发展保留母本单笔费用和电力前置，兵种使用现有电磁兵坊',()=>{
  const e=environment();
  for(const table of ['sciences','sciencesLong']){
    assert.deepEqual(Array.from(e.run(`CFG.${table}.sci_nuclear_age.need`)),['sci_electric_age']);
    assert.equal(e.run(`CFG.${table}.sci_nuclear_age.cost.tech`),100000000);
    assert.equal(e.run(`CFG.${table}.sci_nuclear_age.cost.medal`),800000);
  }
  assert.equal(e.run("trainBuildingKey('star_trooper')"),'electric_armory');
  assert.equal(e.run("CFG.units.star_trooper.cost.copper"),8000);
  assert.equal(e.run("CFG.units.star_trooper.cost.iron"),8000);
  assert.equal(e.run("CFG.units.star_trooper.cost.steel"),8000);
  assert.equal(e.run("researchScience('sci_nuclear_age').reason"),'science-prerequisite');
  assert.equal(e.run("train('star_trooper',1).reason"),'locked');
});

check('条件足额时星核研究原子付款，失败回滚且重复调用不扣第二笔',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age','sci_electric_age'];S.res.tech=100000000;S.res.medal=799999");
  assert.equal(e.run("researchScience('sci_nuclear_age').reason"),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),100000000);
  e.run('S.res.medal=800000;save()');
  const raw=e.store.get('rts_save');
  e.run("const originalNuclearWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalNuclearWrite(k,v)}");
  assert.equal(e.run("researchScience('sci_nuclear_age').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),100000000);
  assert.equal(e.run('S.res.medal'),800000);
  assert.equal(e.run("S.sciences.includes('sci_nuclear_age')"),false);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=originalNuclearWrite');
  assert.equal(e.run("researchScience('sci_nuclear_age').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("researchScience('sci_nuclear_age').repeat"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).sciences.includes('sci_nuclear_age'),true);
});

check('研究后复用已建兵坊，训练完成实扣三金属且远征驻军伤害有限',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age','sci_electric_age'];S.buildings.electric_armory={lv:1,state:'idle'};S.res.copper=8000;S.res.iron=8000;S.res.steel=8000");
  assert.equal(e.run("train('star_trooper',1).reason"),'locked');
  e.run("S.sciences.push('sci_nuclear_age')");
  assert.equal(e.run("train('star_trooper',1).ok"),true);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.star_trooper'),1);
  for(const rk of ['copper','iron','steel'])assert.equal(e.run(`S.res.${rk}`),0);
  assert.equal(e.run('unitCap("star_trooper")'),8);
  e.run("S.formation.front=[{type:'star_trooper',count:1,id:501}];S._garrisonForm.front=[{type:'star_trooper',count:1,id:502}];S.selEnemy=0;B.isTraining=false;initBattleState()");
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
  e.run('save()');
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run("S.sciences.includes('sci_nuclear_age')"),true);
  assert.equal(restored.run('S.pool.star_trooper'),1);
  assert.equal(restored.run("S.formation.front[0].type"),'star_trooper');
  assert.equal(restored.run("S._garrisonForm.front[0].type"),'star_trooper');
  assert.equal(restored.run('serializeSave().v'),32);
});

check('P76真实v29档兼容读取，容量仍未达到星核单笔知识门槛',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p76-stock-scroll-paid.json'),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run("S.sciences.includes('sci_nuclear_age')"),false);
  assert.equal(e.run('resCap("tech")'),43480800);
  assert.equal(e.run('S.res.medal'),804284);
  assert.equal(e.run("researchScience('sci_nuclear_age').reason"),'insufficient-tech');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
});
console.log(`nuclear era: ${passed}/4`);
