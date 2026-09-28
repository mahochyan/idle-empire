'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`)}

check('白银三项研究保留母本并行前置和知识费用',()=>{
  const e=environment();
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_silver_store')")),['sci_silver']);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_silver_refinery')")),['sci_silver_store']);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_silver_age')")),['sci_silver']);
  for(const [key,cost] of [['sci_silver_store',2000],['sci_silver_refinery',3000],['sci_silver_age',4000]])
    assert.equal(e.run(`activeSciences().${key}.cost.tech`),cost);
  e.run("S.sciences=['sci_city'];S.res.tech=10000");
  assert.equal(e.run("researchScience('sci_silver_age').reason"),'science-prerequisite');
  assert.equal(e.run("researchScience('sci_silver').ok"),true);
  assert.equal(e.run("researchScience('sci_silver_refinery').reason"),'science-prerequisite');
  assert.equal(e.run("researchScience('sci_silver_age').ok"),true);
  assert.equal(e.run("S.sciences.includes('sci_silver_store')"),false);
});

check('小银库首级耗银150，完工才增仓100，升级费用180',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver'];S.res.silver=150");
  assert.equal(e.run("buildAct('silver_store').reason"),'need-science');
  e.run("S.sciences.push('sci_silver_store');S.res.silver=149");
  assert.equal(e.run("buildAct('silver_store').reason"),'resources');
  e.run('S.res.silver=150');
  assert.equal(e.run("buildAct('silver_store').ok"),true);
  assert.equal(e.run('S.res.silver'),0);
  assert.equal(e.run("resCap('silver')"),300);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('silver')"),400);
  assert.equal(e.run("upCost('silver_store').silver"),180);
  e.run('S.res.silver=407;save()');
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.res.silver'),407);
  assert.equal(loaded.run("resCap('silver')"),400);
});

check('冶银厂研究与建造成本生效，完工增加银工产率10%',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver','sci_silver_store'];S.res.iron=500;S.res.wood=1000;S.res.food=500");
  assert.equal(e.run("buildAct('silver_refinery').reason"),'need-science');
  e.run("S.sciences.push('sci_silver_refinery')");
  assert.equal(e.run("buildAct('silver_refinery').ok"),true);
  assert.equal(e.run('S.res.iron'),0);
  assert.equal(e.run("buildingBuff('silver')"),0);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("buildingBuff('silver')"),0.1);
  near(e.run("upCost('silver_refinery').iron"),2000/3);
  e.run("S.population.current=3;S.popAlloc.silver=1;S.res.stone=20;S.res.coal=10;S.res.food=1000");
  const before=e.run('S.res.silver');
  e.run('tick()');
  assert.ok(Math.abs(e.run('S.res.silver')-before-1.1/3)<1e-8);
});

check('重甲兵须白银科技和军备建筑，训练完成逐人扣粮800银100',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver'];S.res.wood=1000;S.res.stone=1000;S.res.food=2000;S.res.silver=100");
  assert.equal(e.run("train('silver_heavy',1).reason"),'locked');
  assert.equal(e.run("buildAct('silver_armory').reason"),'need-science');
  e.run("S.sciences.push('sci_silver_age')");
  assert.equal(e.run("buildAct('silver_armory').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("trainLockReason('silver_heavy')"),'');
  const beforeFood=e.run('S.res.food');
  assert.equal(e.run("train('silver_heavy',1).ok"),true);
  assert.equal(e.run('S.res.silver'),100);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.silver_heavy'),1);
  assert.equal(e.run('S.res.silver'),0);
  assert.equal(e.run('S.res.food'),beforeFood-800);
  assert.equal(e.run('save().ok'),true);
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.pool.silver_heavy'),1);
  assert.equal(loaded.run("S.sciences.includes('sci_silver_age')"),true);
  assert.equal(loaded.run("bldSt('silver_armory').lv"),1);
});

check('白银重甲兵沿现有远征和驻军伤害入口，兵力分别计入容量',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver_age'];S.buildings.silver_armory={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.formation.front=[{type:'silver_heavy',count:2,id:1}];S._garrisonForm.front=[{type:'silver_heavy',count:3,id:2}];S.selEnemy=0;B.isTraining=false");
  assert.equal(e.run("combatBaseUnitType('silver_heavy')"),'infantry');
  assert.equal(e.run("unitCapLeft('silver_heavy')"),e.run("unitCap('silver_heavy')")-5);
  e.run('initBattleState()');
  assert.equal(e.run('B.ourUnits[0].type'),'silver_heavy');
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].hp'),9);
  assert.equal(e.run('combatAttackMass(buildGarrisonUnitsFromForm()[0])'),3);
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

check('新研究和建筑扣费写档失败必须回滚',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver'];S.res.tech=2000;S.res.silver=150;save()");
  const original=e.store.get('rts_save');
  e.run("const priorSilverWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');priorSilverWrite(k,v)}");
  assert.equal(e.run("researchScience('sci_silver_store').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),2000);
  assert.equal(e.run("S.sciences.includes('sci_silver_store')"),false);
  assert.equal(e.store.get('rts_save'),original);
  const b=environment();
  b.run("S.sciences=['sci_silver','sci_silver_store'];S.res.silver=150;save()");
  const old=b.store.get('rts_save');
  b.run("const priorSilverBuildWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');priorSilverBuildWrite(k,v)}");
  assert.equal(b.run("buildAct('silver_store').reason"),'save-failed');
  assert.equal(b.run('S.res.silver'),150);
  assert.equal(b.run("bldSt('silver_store').lv"),0);
  assert.equal(b.store.get('rts_save'),old);
});

check('旧v9档无白银新增ID仍能按原资源人口读取',()=>{
  const e=environment();
  e.run("S.res.silver=211;S.res.silverCoin=7;S.population.current=4;save()");
  const old=e.store.get('rts_save');
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.store.get('rts_save'),old);
  assert.equal(loaded.run('S.res.silver'),211);
  assert.equal(loaded.run('S.population.current'),4);
  assert.equal(loaded.run("bldSt('silver_store').lv"),0);
  assert.equal(loaded.run("S.sciences.includes('sci_silver_age')"),false);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
