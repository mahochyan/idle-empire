'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}

check('合金兵人数与聚合生命分开，轻伤不凭空损兵，重伤按幸存人数输出与回写',()=>{
  const e=environment();
  e.run("S.formation.front=[{type:'alloy_special',count:10,id:101}];S.selEnemy=0;initBattleState()");
  assert.equal(e.run('B.ourUnits[0].hp'),55);
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),10);
  e.run('applyCombatDamage(B.ourUnits[0],1)');
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),10);
  e.run('applyCombatDamage(B.ourUnits[0],5)');
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),9);
  e.run('rebuildFormation()');
  assert.equal(e.run('S.formation.front[0].count'),9);
  assert.equal(e.run('save().ok'),true);
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.formation.front[0].count'),9);
});

check('聚合生命治疗至多补满现存士兵，临时护盾不计入攻击和幸存人数',()=>{
  const e=environment();
  e.run("globalThis.__u={...battleVitals('armored_trooper',10),type:'armored_trooper',alive:true};applyCombatDamage(__u,8)");
  assert.equal(e.run('combatAttackMass(__u)'),9);
  assert.equal(e.run('healCombatUnit(__u,100)'),1.5);
  assert.equal(e.run('combatAttackMass(__u)'),9);
  assert.equal(e.run('__u.hp'),58.5);
  e.run('__u.shield=20');
  assert.equal(e.run('combatAttackMass(__u)'),9);
  assert.equal(e.run('applyCombatDamage(__u,10).hpLost'),0);
  assert.equal(e.run('combatAttackMass(__u)'),9);
});

check('驻军同样按单兵生命回写，敌方普通兵团也遵循人数语义',()=>{
  const e=environment();
  e.run("S._garrisonForm.front=[{type:'electro_trooper',count:10,id:201}];globalThis.__u=buildGarrisonUnitsFromForm()[0]");
  assert.equal(e.run('__u.hp'),28);
  e.run('applyCombatDamage(__u,3);rebuildGarrisonFormationAfterBattle({ourUnits:[__u]})');
  assert.equal(e.run('S._garrisonForm.front[0].count'),9);
  assert.equal(e.run('combatAttackMass(__u)'),9);
  e.run("globalThis.__enemy=buildGarrisonEnemyUnits({units:{bronze_guard:[10]}})[0]");
  assert.equal(e.run('__enemy.hp'),20);
  assert.equal(e.run('combatAttackMass(__enemy)'),10);
});

check('区域单体Boss继续按独立生命与攻击规模结算',()=>{
  const e=environment();
  e.run("S.formation.front=[{type:'alloy_special',count:10,id:301}];S.battleEncounter='medal';initBattleState()");
  assert.equal(e.run('B.enemyUnits[0].hp'),47);
  assert.equal(e.run('combatAttackMass(B.enemyUnits[0])'),47);
  e.run('applyCombatDamage(B.enemyUnits[0],5)');
  assert.equal(e.run('combatAttackMass(B.enemyUnits[0])'),47);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
