'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(error){fail++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本电磁兵三维分别每投钢4000，1000次一星；生命按兵团HP口径换算',()=>{
  for(const [id,field]of [[340008,'AddATK'],[341008,'AddHP'],[342008,'AddDEF']]){
    assert.equal(source[id]['armsUP:ArmyID'],370008);
    assert.deepEqual(source[id]['armsUP:Need'],[[150010,4000]]);
    assert.equal(source[id]['armsUP:'+field],1);
  }
  const e=environment();
  assert.equal(e.run('CFG.armsUp.electro_trooper.stepsPerStar'),1000);
  assert.equal(e.run('CFG.armsUp.electro_trooper.stats.hp.perStar'),0.01);
});

check('真实动作门、999进度、1000次升星、重复投入扣费且兵数不增加',()=>{
  const e=environment();
  assert.equal(e.run("investArmsUp('electro_trooper','atk').reason"),'science-prerequisite');
  e.run("S.sciences=['sci_electric_age'];S.res.steel=8000000");
  assert.equal(e.run("investArmsUp('electro_trooper','bad').reason"),'unknown-upgrade');
  assert.equal(e.run("investArmsUp('electro_trooper','atk',1001).reason"),'invalid-count');
  assert.equal(e.run('armyCount()'),0);
  assert.equal(e.run("investArmsUp('electro_trooper','atk',999).ok"),true);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.progress'),999);
  assert.equal(e.run("weaponAttack('electro_trooper')"),55);
  assert.equal(e.run("investArmsUp('electro_trooper','atk').ok"),true);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.stars'),1);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.progress'),0);
  assert.equal(e.run("weaponAttack('electro_trooper')"),56);
  assert.equal(e.run('S.res.steel'),4000000);
  assert.equal(e.run('armyCount()'),0);
  assert.equal(e.run("investArmsUp('electro_trooper','atk',1000).ok"),true);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.stars'),2);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("investArmsUp('electro_trooper','atk').reason"),'insufficient-resources');
  assert.equal(e.run('S.armsUp.electro_trooper.atk.stars'),2);
});

check('远征与驻军共享强化属性，敌军及兵数不受我方投资影响',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.res.steel=12000000;investArmsUp('electro_trooper','atk',1000);investArmsUp('electro_trooper','hp',1000);investArmsUp('electro_trooper','def',1000)");
  e.run("S.formation.front=[{id:1,type:'electro_trooper',count:10}];S._garrisonForm.front=[{id:2,type:'electro_trooper',count:10}];S.selEnemy=0;initBattleState()");
  assert.equal(e.run('B.ourUnits[0].atk'),56);
  assert.equal(e.run('B.ourUnits[0].def'),19);
  assert.equal(e.run('B.ourUnits[0].hpPerSoldier'),2.8099999999999996);
  assert.equal(e.run('B.ourUnits[0].initialCount'),10);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),56);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].def'),19);
  assert.ok(Math.abs(e.run('buildGarrisonUnitsFromForm()[0].hpPerSoldier')-2.81)<1e-9);
  assert.equal(e.run("battleVitals('electro_trooper',10).hpPerSoldier"),2.8);
  assert.equal(e.run('armyCount()'),20);
});

check('v29独立迁移先保原文，非法新字段与未来版本拒载，存储失败回滚投入',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));old.v=29;delete old.armsUp;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.stars'),0);
  1332;
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>delete d.armsUp.electro_trooper.hp,d=>d.armsUp.electro_trooper.atk.progress=1000,d=>d.armsUp.electro_trooper.def.stars=-1,d=>d.v=35]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
  e.run("S.sciences=['sci_electric_age'];S.res.steel=4000;localStorage.setItem=()=>{throw Error('full')}");
  assert.equal(e.run("investArmsUp('electro_trooper','hp').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),4000);
  assert.equal(e.run('S.armsUp.electro_trooper.hp.progress'),0);
});

console.log('arms_up: pass '+pass+' fail '+fail);
process.exit(fail?1:0);
