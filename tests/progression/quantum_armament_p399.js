'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
const paidV33=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p397-quantum-stage100-paid-save.json'),'utf8');

check('已付 v33 旧档候选迁移到 v36，先保存原文且不改兵力、库存、科技',()=>{
  const before=JSON.parse(paidV33),e=environment({rts_save:paidV33});
  assert.equal(before.v,33);
  const migration=e.run('loadSaveAndApply()');
  assert.equal(migration.status,'migrated');
  assert.ok(migration.filled.includes('quantumArmament'));
  assert.equal(e.store.get('rts_save_premigration'),paidV33);
  const after=JSON.parse(e.store.get('rts_save'));
  assert.equal(after.v,36);
  for(const field of ['res','pool','formation','sciences','defeated','armsUp','weaponForge','starArray','development'])
    assert.deepEqual(after[field],before[field],field);
  for(const [key,value] of Object.entries(before.items))assert.equal(after.items[key],value,'items.'+key);
  for(const tier of [2,3,4,5])assert.equal(after.items['storageScroll'+tier],0,'new storageScroll'+tier);
  assert.equal(JSON.stringify(Object.keys(after.quantumArmament).sort()),JSON.stringify(e.run('CFG.quantumArmament.units.slice().sort()')));
  assert.ok(Object.values(after.quantumArmament).every(x=>x.atk===0&&x.hp===0));
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
});

check('损坏、未来与不完整 v34 圣痕状态受保护，原文不被自动覆盖',()=>{
  const corrupt=JSON.stringify({...JSON.parse(paidV33),v:34,quantumArmament:{quantum_trooper:{atk:-1,hp:0}}});
  const e=environment({rts_save:corrupt});
  assert.equal(e.run('loadSaveAndApply().status'),'invalid');
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.run('save().ok'),false);
  assert.equal(e.store.get('rts_save'),corrupt);
  const future=JSON.stringify({...JSON.parse(paidV33),v:37});
  const f=environment({rts_save:future});
  assert.equal(f.run('loadSaveAndApply().status'),'future');
  assert.equal(f.store.get('rts_save'),future);
  const valid=environment();valid.run('save()');
  const malformed=JSON.parse(valid.store.get('rts_save'));
  malformed.sciences={};malformed.quantumArmament.quantum_trooper.atk=1;
  const bad=environment({rts_save:JSON.stringify(malformed)});
  assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
  assert.equal(bad.run('saveProtected()'),true);
});

check('研究检查前置与实付两种资源，重复调用不重复扣费',()=>{
  const e=environment();
  e.run('S.res.tech=5000000000;S.res.medal=5000000');
  assert.equal(e.run("researchScience('sci_astral_armament').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_quantum_age')");
  const result=e.run("researchScience('sci_astral_armament')");
  assert.equal(result.ok,true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  const repeat=e.run("researchScience('sci_astral_armament')");
  assert.equal(repeat.ok,true);
  assert.equal(repeat.repeat,true);
  assert.equal(e.run('S.sciences.filter(x=>x===\'sci_astral_armament\').length'),1);
  assert.equal(e.run('upgradeQuantumArmament(\'quantum_trooper\',\'atk\').reason'),'insufficient-resources');
});

check('逐兵种独立购买 ATK 和 HP；远征与驻军共享增强且敌兵不受益',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_quantum_age','sci_astral_armament');S.res.steel=24000;S.items.starOriginStone=30");
  const base=e.run("({atk:weaponAttack('quantum_trooper'),hp:battleVitals('quantum_trooper',2,true).maxHp,enemy:battleVitals('quantum_trooper',2,false).maxHp})");
  assert.equal(e.run("upgradeQuantumArmament('quantum_trooper','atk').ok"),true);
  assert.equal(e.run("upgradeQuantumArmament('quantum_trooper','hp').ok"),true);
  assert.equal(e.run('S.res.steel'),8000);
  assert.equal(e.run('S.items.starOriginStone'),10);
  assert.equal(e.run("quantumArmamentBonus('quantum_trooper','atk')"),1.75);
  assert.equal(e.run("quantumArmamentBonus('quantum_trooper','hp')"),0.375);
  assert.equal(e.run("weaponAttack('quantum_trooper')"),base.atk+1.75);
  assert.equal(e.run("battleVitals('quantum_trooper',2,true).maxHp"),base.hp+0.75);
  assert.equal(e.run("battleVitals('quantum_trooper',2,false).maxHp"),base.enemy);
  assert.equal(e.run("quantumArmamentBonus('star_trooper','atk')"),0);
  e.run("S.formation={front:[{id:1,type:'quantum_trooper',count:2}],mid:[],back:[]};S._garrisonForm={front:[{id:2,type:'quantum_trooper',count:2}],mid:[],back:[]};S.selEnemy=0");
  e.run('initBattleState()');
  const expedition=e.run('({atk:B.ourUnits[0].atk,hp:B.ourUnits[0].maxHp,enemyAtk:B.enemyUnits[0].atk})');
  const garrison=e.run("buildGarrisonUnitsFromForm()[0]");
  assert.equal(expedition.atk,e.run("battleMilitaryAttack('quantum_trooper')"));
  assert.equal(expedition.hp,e.run("battleVitals('quantum_trooper',2,true).maxHp"));
  assert.equal(garrison.atk,expedition.atk);
  assert.equal(garrison.maxHp,expedition.hp);
  assert.equal(e.run("S.quantumArmament.star_trooper.atk"),0);
  assert.equal(e.run("S.quantumArmament.quantum_trooper.atk"),1);
  const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.quantumArmament.quantum_trooper.atk'),1);
  assert.equal(reload.run('S.quantumArmament.quantum_trooper.hp'),1);
});

check('资源不足、非法项、满级与保存失败都不更改已持有资源或等级',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_quantum_age','sci_astral_armament');S.res.steel=8000;S.items.starOriginStone=10");
  assert.equal(e.run("upgradeQuantumArmament('invalid','atk').reason"),'unknown-upgrade');
  assert.equal(e.run("upgradeQuantumArmament('quantum_trooper','def').reason"),'unknown-upgrade');
  assert.equal(e.run("upgradeQuantumArmament('silver_heavy','atk').reason"),'unit-science-prerequisite');
  assert.equal(e.run('S.res.steel'),8000);
  assert.equal(e.run('S.items.starOriginStone'),10);
  e.run("localStorage.setItem=()=>{throw Error('blocked')}");
  assert.equal(e.run("upgradeQuantumArmament('quantum_trooper','atk').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),8000);
  assert.equal(e.run('S.items.starOriginStone'),10);
  assert.equal(e.run('S.quantumArmament.quantum_trooper.atk'),0);
  const full=environment();
  full.run("S.sciences.push('sci_quantum_age','sci_astral_armament');S.quantumArmament.quantum_trooper.atk=CFG.quantumArmament.maxLevel");
  assert.equal(full.run("upgradeQuantumArmament('quantum_trooper','atk').reason"),'max-level');
});

console.log(`quantum_armament_p399: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
