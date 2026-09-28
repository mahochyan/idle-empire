'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}
}

check('远征与驻军共用小数余伤累积，铁枪攻击成长不再被整数取整吞没',()=>{
  const e=environment();
  e.run("Math.random=()=>0.5;B.tactic={atkPct:0,backPct:0,defPct:0};globalThis.__defender={type:'iron_spearman',tag:'generic',def:819,hp:4500,maxHp:4500,attackMass:15};globalThis.__makeAttacker=atk=>({type:'iron_spearman',tag:'generic',atk,row:'front',hp:15,maxHp:15,initialCount:15,hpPerSoldier:1})");
  e.run('globalThis.__atk12=__makeAttacker(12);globalThis.__atk23=__makeAttacker(23)');
  const expedition12=e.run('Array.from({length:4},()=>calcDmg(__atk12,__defender,true).dmg)');
  const expedition23=e.run('Array.from({length:4},()=>calcDmg(__atk23,__defender,true).dmg)');
  assert.deepEqual(JSON.parse(JSON.stringify(expedition12)),[1,1,1,2]);
  assert.deepEqual(JSON.parse(JSON.stringify(expedition23)),[1,2,1,2]);

  e.run('globalThis.__garrison12=__makeAttacker(12);globalThis.__garrison23=__makeAttacker(23)');
  const garrison12=e.run('Array.from({length:4},()=>calcGarrisonDmg(__garrison12,__defender))');
  const garrison23=e.run('Array.from({length:4},()=>calcGarrisonDmg(__garrison23,__defender))');
  assert.deepEqual(JSON.parse(JSON.stringify(garrison12)),JSON.parse(JSON.stringify(expedition12)));
  assert.deepEqual(JSON.parse(JSON.stringify(garrison23)),JSON.parse(JSON.stringify(expedition23)));
  assert.equal(e.run('__atk12.damageRemainder>0'),true);
  assert.equal(e.run("S.armsUp.iron_spearman.atk.stars===0"),true);
  assert.equal(e.run('B.ourUnits=[__atk12];save().ok'),true);
  assert.equal(JSON.stringify(JSON.parse(e.store.get('rts_save'))).includes('damageRemainder'),false);
});

check('零伤格挡仍然为零，不被小数精度抬成有效命中',()=>{
  const e=environment();
  e.run("B.tactic={atkPct:0,backPct:0,defPct:0};globalThis.__values=[0.5,0.5,0.9];Math.random=()=>__values.shift()??0.9;globalThis.__bow={type:'archer',tag:'bow',atk:20,row:'back',hp:10,maxHp:10,initialCount:10,hpPerSoldier:1};globalThis.__shield={type:'infantry',tag:'shield',def:20,hp:100,maxHp:100,initialCount:100,hpPerSoldier:1}");
  assert.equal(e.run('calcDmg(__bow,__shield,true).dmg'),0);
  e.run("globalThis.__values=[0.5,0.5,0.9]");
  assert.equal(e.run('calcGarrisonDmg(__bow,__shield)'),0);
});

check('多次小数伤害先保留团体生命，累计跨过单兵阈值后才扣一人',()=>{
  const e=environment();
  e.run("globalThis.__unit={hp:22.5,maxHp:22.5,hpPerSoldier:1.5,initialCount:15,alive:true}");
  const first=e.run('applyCombatDamage(__unit,0.467)');
  assert.equal(first.casualties,0);
  assert.equal(e.run('combatSurvivors(__unit)'),15);
  e.run('applyCombatDamage(__unit,0.467);applyCombatDamage(__unit,0.467);globalThis.__last=applyCombatDamage(__unit,0.467)');
  assert.equal(e.run('__last.casualties'),1);
  assert.equal(e.run('combatSurvivors(__unit)'),14);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
