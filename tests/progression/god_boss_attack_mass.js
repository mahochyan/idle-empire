'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function battleAt(kill){
  const e=environment();
  e.run(`Math.random=()=>0.5;S.sciences=['sci_electric_age'];
    S.killValues.godSlaughter=${kill};S.battleEncounter='medal';
    S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[],back:[]};
    initBattleState()`);
  return e;
}

check('神祇警戒值增加生命和面板攻击，但不增加单体出手规模',()=>{
  const early=battleAt(0),late=battleAt(2000);
  assert.ok(late.run('B.enemyUnits[0].hp')>early.run('B.enemyUnits[0].hp'));
  assert.ok(late.run('B.enemyUnits[0].atk')>early.run('B.enemyUnits[0].atk'));
  assert.equal(early.run('B.enemyUnits[0].attackMass'),47);
  assert.equal(late.run('B.enemyUnits[0].attackMass'),47);
  const earlyDmg=early.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg');
  const lateDmg=late.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg');
  assert.ok(lateDmg>earlyDmg,'攻击倍率仍应增加伤害');
  assert.ok(lateDmg<earlyDmg*10,'生命膨胀不应被当作额外攻击人数');
});

check('单体受伤后攻击规模不下降，普通兵团依存活人数输出',()=>{
  const e=battleAt(2000);
  const before=e.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg');
  e.run('applyCombatDamage(B.enemyUnits[0],200)');
  const after=e.run('calcDmg(B.enemyUnits[0],B.ourUnits[0],false).dmg');
  assert.equal(after,before);
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),40);
  e.run('applyCombatDamage(B.ourUnits[0],55)');
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),30);
});

check('驻军伤害共享出手规模语义，普通驻军仍按人数衰减',()=>{
  const e=environment();
  e.run(`Math.random=()=>0.5;S._garrisonForm={front:[{type:'alloy_special',count:40,id:201}],mid:[],back:[]};
    globalThis.__g=buildGarrisonUnitsFromForm()[0];
    globalThis.__target={type:'infantry',tag:'infantry',def:8,hp:100,alive:true}`);
  const full=e.run('calcGarrisonDmg(__g,__target)');
  e.run('applyCombatDamage(__g,110)');
  const reduced=e.run('calcGarrisonDmg(__g,__target)');
  assert.ok(reduced<full);
  assert.equal(e.run('combatAttackMass(__g)'),20);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
