'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}

check('母本青铜冶铜炉→石仓库→研究院及合金→蒸汽前置和费用',()=>{
  const e=environment();
  const nodes=[['sci_copper_furnace','sci_bronze_age',1000],['sci_stone_store','sci_copper_furnace',800],
    ['sci_institute','sci_stone_store',1000],['sci_steam_age','sci_alloy_age',100000]];
  for(const[id,need,cost]of nodes){
    assert.deepEqual(Array.from(e.run(`scienceNeedIds('${id}')`)),[need]);
    assert.equal(e.run(`activeSciences().${id}.cost.tech`),cost);
  }
  assert.equal(e.run('activeSciences().sci_steam_age.cost.steel'),10000);
  assert.equal(e.run("researchScience('sci_stone_store').reason"),'science-prerequisite');
  assert.equal(e.run('CFG.buildings.copper_furnace.build.stone'),1500);
  assert.equal(e.run('CFG.buildings.stone_store.build.stone'),1600);
  assert.equal(e.run('CFG.buildings.institute.build.wood'),1800);
});

check('冶铜炉增效叠加现有矿井，石仓扩木石煤，研究院扩知识',()=>{
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.tech=4000;S.res.wood=2000;S.res.stone=2000;S.res.food=2000");
  assert.equal(e.run("researchScience('sci_copper_furnace').ok"),true);
  assert.equal(e.run("buildAct('copper_furnace').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("buildingBuff('copper')"),0.1);
  e.run("S.buildings.mine={lv:1,state:'idle'}");
  assert.equal(e.run("buildingBuff('copper')"),0.2);
  assert.equal(e.run("researchScience('sci_stone_store').ok"),true);
  e.run('S.res.stone=2000');
  const before=e.run("({wood:resCap('wood'),stone:resCap('stone'),coal:resCap('coal')})");
  assert.equal(e.run("buildAct('stone_store').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('wood')"),before.wood+1200);
  assert.equal(e.run("resCap('stone')"),before.stone+800);
  assert.equal(e.run("resCap('coal')"),before.coal+400);
  assert.equal(e.run("researchScience('sci_institute').ok"),true);
  e.run('S.res.wood=1800;S.res.stone=1800');
  const techBefore=e.run("resCap('tech')");
  assert.equal(e.run("buildAct('institute').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('tech')"),techBefore+400);
});

check('蒸汽研究双资源一次付款，缺钢不扣知识；写档失败完整回滚',()=>{
  const e=environment();
  e.run("S.sciences=['sci_alloy_age'];S.res.tech=100000;S.res.steel=9999");
  assert.equal(e.run("researchScience('sci_steam_age').reason"),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),100000);
  assert.equal(e.run('S.res.steel'),9999);
  e.run('S.res.steel=10000;save()');
  const raw=e.store.get('rts_save');
  e.run("const oldSteamWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSteamWrite(k,v)}");
  assert.equal(e.run("researchScience('sci_steam_age').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),100000);
  assert.equal(e.run('S.res.steel'),10000);
  assert.equal(e.run("S.sciences.includes('sci_steam_age')"),false);
  assert.equal(e.store.get('rts_save'),raw);
  e.run('localStorage.setItem=oldSteamWrite');
  assert.equal(e.run("researchScience('sci_steam_age').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("S.sciences.includes('sci_steam_age')"),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).sciences.includes('sci_steam_age'),true);
});

check('蒸汽兵坊开放后装甲兵逐人付铜铁钢各2000，远征与驻军公式均可用',()=>{
  const e=environment();
  e.run("S.sciences=['sci_alloy_age'];S.res.wood=2000;S.res.stone=2000;S.res.food=2000;S.res.copper=2000;S.res.iron=2000;S.res.steel=2000");
  assert.equal(e.run("train('armored_trooper',1).reason"),'locked');
  e.run("S.sciences.push('sci_steam_age')");
  assert.equal(e.run("buildAct('steam_armory').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("train('armored_trooper',1).ok"),true);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.armored_trooper'),1);
  for(const rk of ['copper','iron','steel'])assert.equal(e.run(`S.res.${rk}`),0);
  e.run("S.formation.front=[{type:'armored_trooper',count:1,id:1}];S._garrisonForm.front=[{type:'armored_trooper',count:1,id:2}];S.selEnemy=0;B.isTraining=false;initBattleState()");
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

check('新增研究建筑和兵种随v32存档往返，旧档原始库存不被裁剪',()=>{
  const e=environment();
  e.run("S.sciences=['sci_institute','sci_steam_age'];S.buildings.institute={lv:3,state:'idle'};S.buildings.steam_armory={lv:1,state:'idle'};S.pool.armored_trooper=2;S.res.steel=10001;save()");
  const raw=e.store.get('rts_save');
  const loaded=environment({rts_save:raw});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.pool.armored_trooper'),2);
  assert.equal(loaded.run("bldSt('institute').lv"),3);
  assert.equal(loaded.run('S.res.steel'),10001);
  assert.equal(loaded.run('serializeSave().v'),32);
});
console.log(`steam era: ${passed}/5`);
