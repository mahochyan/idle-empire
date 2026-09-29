'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('母本蒸汽/电磁枪的研发、逐次投入、首件20次与攻击加值',()=>{
  assert.deepEqual(source[470061]['warScience:Need'],[[160003,20000],[160010,1000]]);
  assert.deepEqual(source[230061]['weapon:Need'],[[150007,10000],[150010,500]]);
  assert.equal(source[230061]['weapon:InitValue'],6);
  assert.deepEqual(source[230061]['weapon:Get'],[[370007,4]]);
  assert.deepEqual(source[470071]['warScience:Need'],[[160003,200000],[160010,10000]]);
  assert.deepEqual(source[230071]['weapon:Need'],[[150007,100000],[150010,5000]]);
  assert.equal(source[230071]['weapon:InitValue'],7);
  assert.deepEqual(source[230071]['weapon:Get'],[[370008,5]]);
  assert.equal(source[230000]['weapon:CountInit2'],20);
  assert.equal(source[230000]['weapon:CountInit'],10);
  assert.equal(source[230000]['weapon:CountLv'],2);
  const e=environment();
  assert.equal(e.run("weaponForgeSteps('armored',0)"),20);
  assert.equal(e.run("weaponForgeSteps('armored',1)"),12);
  assert.equal(e.run("weaponForgeSteps('armored',2)"),14);
});

check('研发→20次锻造→装备闭环，攻击只在装备后作用于远征与驻军',()=>{
  const e=environment();
  e.run("S.res.tech=20000;S.res.medal=1000;S.res.iron=200000;S.res.steel=10000");
  assert.equal(e.run("researchWeapon('armored').reason"),'science-prerequisite');
  e.run("S.sciences=['sci_steam_age']");
  assert.equal(e.run("forgeWeapon('armored').reason"),'science-prerequisite');
  assert.equal(e.run("researchWeapon('armored').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("researchWeapon('armored').reason"),'already-researched');
  assert.equal(e.run("setWeaponEquipped('armored',true).reason"),'not-forged');
  assert.equal(e.run("forgeWeapon('armored').ok"),true);
  assert.equal(e.run('S.weaponForge.armored.progress'),1);
  assert.equal(e.run('S.weaponForge.armored.level'),0);
  assert.equal(e.run("weaponAttack('armored_trooper')"),35);
  for(let n=1;n<20;n++)assert.equal(e.run("forgeWeapon('armored').ok"),true);
  assert.equal(e.run('S.weaponForge.armored.level'),1);
  assert.equal(e.run('S.weaponForge.armored.progress'),0);
  assert.equal(e.run('S.res.iron'),0);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("weaponAttack('armored_trooper')"),35);
  e.run("Math.random=()=>0.5;S.formation.front=[{id:1,type:'armored_trooper',count:20}];S._garrisonForm.front=[{id:2,type:'armored_trooper',count:20}];S.selEnemy=0;initBattleState()");
  const expeditionBase=e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg');
  const garrisonBase=e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[20]}})[0])");
  assert.equal(e.run("setWeaponEquipped('armored',true).ok"),true);
  assert.equal(e.run("weaponAttack('armored_trooper')"),41);
  assert.equal(e.run("weaponAttack('electro_trooper')"),55);
  e.run('initBattleState()');
  assert.equal(e.run('B.ourUnits[0].atk'),41);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),41);
  assert.ok(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')>expeditionBase);
  assert.ok(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[20]}})[0])")>garrisonBase);
  assert.equal(e.run("setWeaponEquipped('armored',false).ok"),true);
  assert.equal(e.run("weaponAttack('armored_trooper')"),35);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,34);
  assert.equal(saved.weaponForge.armored.researched,true);
  assert.equal(saved.weaponForge.armored.level,1);
  assert.equal(saved.weaponForge.armored.equipped,false);
});

check('后续12/14次再升级，单次费用固定；电磁枪独立解锁与装备',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age','sci_electric_age'];S.res.tech=200000;S.res.medal=10000;S.res.iron=4600000;S.res.steel=230000");
  assert.equal(e.run("researchWeapon('electro').ok"),true);
  for(let n=0;n<46;n++)assert.equal(e.run("forgeWeapon('electro').ok"),true);
  assert.equal(e.run('S.weaponForge.electro.level'),3);
  assert.equal(e.run('S.weaponForge.electro.progress'),0);
  assert.equal(e.run("forgeWeapon('electro').reason"),'max-level');
  assert.equal(e.run("setWeaponEquipped('electro',true).ok"),true);
  assert.equal(e.run("weaponAttack('electro_trooper')"),72);
  assert.equal(e.run("weaponAttack('armored_trooper')"),35);
});

check('v18迁移保留人口、兵力、超仓与合法0，坏锻造数据和未来档保护原文',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.steel=999999;S.population.current=7;S.pool.infantry=4;const d=serializeSave();d.v=18;delete d.weaponForge;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.weaponForge.armored.level'),0);
  assert.equal(e.run('S.weaponForge.armored.progress'),0);
  assert.equal(e.run('S.res.steel'),999999);
  assert.equal(e.run('S.population.current'),7);
  assert.equal(e.run('S.pool.infantry'),4);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,34);
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>delete d.weaponForge,d=>d.weaponForge.armored.progress=20,d=>d.weaponForge.armored.level=4,d=>d.weaponForge.armored.equipped=true,d=>d.weaponForge.foo={},d=>d.v=35]){
    const d=structuredClone(valid);mutate(d);
    const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('研发与单次锻造写档失败分别回滚扣费、进度和装备',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age'];S.res.tech=20000;S.res.medal=1000;S.res.iron=10000;S.res.steel=500;save()");
  const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run("researchWeapon('armored').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),20000);
  assert.equal(e.run('S.res.medal'),1000);
  assert.equal(e.run('S.weaponForge.armored.researched'),false);
  assert.equal(e.store.get('rts_save'),raw);
  e.run("S.weaponForge.armored.researched=true");
  assert.equal(e.run("forgeWeapon('armored').reason"),'save-failed');
  assert.equal(e.run('S.res.iron'),10000);
  assert.equal(e.run('S.res.steel'),500);
  assert.equal(e.run('S.weaponForge.armored.progress'),0);
  e.run("S.weaponForge.armored.level=1");
  assert.equal(e.run("setWeaponEquipped('armored',true).reason"),'save-failed');
  assert.equal(e.run('S.weaponForge.armored.equipped'),false);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`weapon forge: ${passed}/5`);
