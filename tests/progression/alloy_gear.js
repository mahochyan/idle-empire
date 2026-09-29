'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}

check('母本合金剑与合金甲的研发门、费用和基础属性',()=>{
  assert.deepEqual(source[470051]['warScience:Need'],[[160003,5000],[160010,80]]);
  assert.equal(source[470052]['warScience:LimitID'],470051);
  assert.deepEqual(source[470052]['warScience:Need'],[[160003,5000],[160010,80]]);
  assert.deepEqual(source[230051]['weapon:Need'],[[150010,200]]);
  assert.deepEqual(source[220051]['clothes:Need'],[[150010,200]]);
  assert.equal(source[230051]['weapon:InitValue'],5);
  assert.equal(source[220051]['clothes:InitValue'],10);
  const e=environment();
  assert.equal(e.run("CFG.weaponForge.alloySword.name"),'合金剑');
  assert.equal(e.run("CFG.weaponForge.alloyArmor.name"),'合金甲');
});

check('合金剑先研，合金甲再研；制造、装备只改攻击防御不增兵',()=>{
  const e=environment();
  e.run("S.res.tech=10000;S.res.medal=160;S.res.steel=8000");
  assert.equal(e.run("researchWeapon('alloySword').reason"),'science-prerequisite');
  e.run("S.sciences=['sci_alloy_age']");
  assert.equal(e.run("researchWeapon('alloyArmor').reason"),'weapon-prerequisite');
  assert.equal(e.run("researchWeapon('alloySword').ok"),true);
  assert.equal(e.run("researchWeapon('alloyArmor').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  const armyBefore=e.run('armyCount()');
  for(let i=0;i<20;i++)assert.equal(e.run("forgeWeapon('alloySword').ok"),true);
  for(let i=0;i<20;i++)assert.equal(e.run("forgeWeapon('alloyArmor').ok"),true);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("weaponAttack('alloy_special')"),32);
  assert.equal(e.run("weaponDefense('alloy_special')"),18);
  assert.equal(e.run("setWeaponEquipped('alloySword',true).ok"),true);
  assert.equal(e.run("setWeaponEquipped('alloyArmor',true).ok"),true);
  assert.equal(e.run("weaponAttack('alloy_special')"),37);
  assert.equal(e.run("weaponDefense('alloy_special')"),28);
  assert.equal(e.run('armyCount()'),armyBefore);
  e.run("S.formation.front=[{id:101,type:'alloy_special',count:20}];S._garrisonForm.front=[{id:102,type:'alloy_special',count:20}];S.selEnemy=0;initBattleState()");
  assert.equal(e.run('B.ourUnits[0].atk'),37);
  assert.equal(e.run('B.ourUnits[0].def'),28);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),37);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].def'),28);
  e.run("Math.random=()=>0.5;B.enemyUnits[0].hp=100;B.enemyUnits[0].atk=20");
  const expeditionDefended=e.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg');
  // Keep expedition and garrison attackers independent: both store P87's
  // per-attacker fractional remainder on their temporary battle-unit object.
  e.run('initBattleState();B.enemyUnits[0].hp=100;B.enemyUnits[0].atk=20');
  const garrisonDefended=e.run('Array.from({length:20},()=>calcGarrisonDmg(B.enemyUnits[0],buildGarrisonUnitsFromForm()[0]))');
  assert.equal(e.run("setWeaponEquipped('alloyArmor',false).ok"),true);
  assert.equal(e.run("weaponDefense('alloy_special')"),18);
  e.run('initBattleState();B.enemyUnits[0].hp=100;B.enemyUnits[0].atk=20');
  assert.ok(e.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg')>expeditionDefended);
  e.run('initBattleState();B.enemyUnits[0].hp=100;B.enemyUnits[0].atk=20');
  const garrisonUnequipped=e.run('Array.from({length:20},()=>calcGarrisonDmg(B.enemyUnits[0],buildGarrisonUnitsFromForm()[0]))');
  assert.ok(garrisonUnequipped.reduce((sum,damage)=>sum+damage,0)>
    garrisonDefended.reduce((sum,damage)=>sum+damage,0),
    '多次驻军命中应体现装备防御差，单次整数伤害可能相同');
  const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
  1332;
  const restored=environment({rts_save:raw});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run("weaponAttack('alloy_special')"),37);
  assert.equal(restored.run("weaponDefense('alloy_special')"),18);
});

check('v21旧档安全迁移，缺键、未来档和写档失败受保护',()=>{
  const seed=environment();
  const legacy=seed.run("(()=>{const d=serializeSave();d.v=21;d.res.steel=900000;d.weaponForge.armored={researched:true,level:1,progress:0,equipped:true};d.pool.alloy_special=7;delete d.weaponForge.alloySword;delete d.weaponForge.alloyArmor;return JSON.stringify(d)})()");
  const e=environment({rts_save:legacy});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),legacy);
  assert.equal(e.run('S.res.steel'),900000);
  assert.equal(e.run('S.pool.alloy_special'),7);
  assert.equal(e.run('S.weaponForge.armored.level'),1);
  assert.equal(e.run('S.weaponForge.armored.equipped'),true);
  assert.equal(e.run('S.weaponForge.alloySword.level'),0);
  assert.equal(e.run('S.weaponForge.alloyArmor.level'),0);
  const blocked=environment({rts_save:legacy});
  blocked.run("localStorage.setItem=(key,value)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.run('saveProtected()'),true);
  assert.equal(blocked.store.get('rts_save'),legacy);
  const valid=JSON.parse(e.store.get('rts_save'));
  1332;
  for(const change of [d=>delete d.weaponForge.alloySword,d=>d.weaponForge.alloyArmor.level=4,d=>{d.weaponForge.alloyArmor.researched=true},d=>d.v=35]){
    const d=structuredClone(valid);change(d);
    const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick()');assert.equal(bad.store.get('rts_save'),text);
  }
  const paid=environment();
  paid.run("S.sciences=['sci_alloy_age'];S.res.tech=5000;S.res.medal=80;save()");
  const prior=paid.store.get('rts_save');
  paid.run("localStorage.setItem=()=>{throw Error('quota')}");
  assert.equal(paid.run("researchWeapon('alloySword').reason"),'save-failed');
  assert.equal(paid.run('S.res.tech'),5000);
  assert.equal(paid.run('S.res.medal'),80);
  assert.equal(paid.run('S.weaponForge.alloySword.researched'),false);
  assert.equal(paid.store.get('rts_save'),prior);
});

console.log(`alloy gear: ${passed}/3`);
