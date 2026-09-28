'use strict';
// 战斗临时护盾与持久兵力分离：真实 math/garrison 函数回归。
// node tests/progression/combat_shield.js
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function mageForm(e){
  e.run("S.formation.front=[{type:'mage_space',count:10,id:101}];S._garrisonForm.front=[{type:'mage_space',count:10,id:201}];S.selEnemy=0;B.isTraining=false");
}

check('远征开场的空间法师保留10名兵力，另有2点临时护盾',()=>{
  const e=environment();mageForm(e);
  e.run('initBattleState()');
  assert.equal(e.run('B.ourUnits[0].hp'),10);
  assert.equal(e.run('B.ourUnits[0].maxHp'),10);
  assert.equal(e.run('B.ourUnits[0].shield'),2);
  assert.equal(e.run('B.ourUnits[0].initialCount'),10);
});

check('远征无伤结算不会将临时护盾写成新增士兵',()=>{
  const e=environment();mageForm(e);
  e.run('initBattleState();rebuildFormation()');
  assert.equal(e.run('S.formation.front[0].count'),10);
});

check('远征伤害先耗护盾、再耗真实生命，输出使用真实存活人数',()=>{
  const e=environment();mageForm(e);
  e.run('initBattleState()');
  const first=e.run('applyCombatDamage(B.ourUnits[0],1)');
  assert.equal(first.shieldLost,1);
  assert.equal(first.hpLost,0);
  assert.equal(e.run('B.ourUnits[0].hp'),10);
  assert.equal(e.run('B.ourUnits[0].shield'),1);
  const offense=e.run(`(()=>{const random=Math.random;try{
    Math.random=()=>0.5;
    const guarded=calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg;
    B.ourUnits[0].shield=0;
    const unguarded=calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg;
    B.ourUnits[0].shield=1;
    return{guarded,unguarded};
  }finally{Math.random=random}})()`);
  assert.equal(offense.guarded,offense.unguarded,'临时护盾不能增加进攻人数或伤害');
  const second=e.run('applyCombatDamage(B.ourUnits[0],3)');
  assert.equal(second.shieldLost,1);
  assert.equal(second.hpLost,2);
  assert.equal(e.run('B.ourUnits[0].hp'),8);
  e.run('rebuildFormation()');
  assert.equal(e.run('S.formation.front[0].count'),8);
});

check('真实远征回合的敌方直击先破盾，再造成实际战损',()=>{
  const e=environment();mageForm(e);
  e.run(`
    globalThis.__steps=[];
    globalThis.setTimeout=fn=>{__steps.push(fn);return __steps.length};
    globalThis.clearTimeout=()=>{};
    const oldGetElementById=document.getElementById;
    document.getElementById=id=>id.startsWith('ou-')||id.startsWith('eu-')?null:oldGetElementById(id);
    initBattleState();S.battleActive=true;
    B.ourUnits[0].spd=0;
    B.enemyUnits=[{id:999,type:'infantry',name:'敌步兵',row:'front',hp:10,maxHp:10,spd:999,atk:1,def:0,tag:null,alive:true}];
    isAttackMiss=()=>false;
    calcDmg=()=>({dmg:3,crit:false});
    battleTurn();
  `);
  assert.equal(e.run('__steps.length'),1);
  e.run('__steps.shift()()');
  assert.equal(e.run('B.ourUnits[0].shield'),0);
  assert.equal(e.run('B.ourUnits[0].hp'),9);
  e.run('rebuildFormation()');
  assert.equal(e.run('S.formation.front[0].count'),9);
});

check('新战斗清空上一场时光回声，避免旧伤害进入新编队',()=>{
  const e=environment();mageForm(e);
  e.run("B.temporalEchoes=[{targetId:0,dmg:99,actorName:'旧战'}];initBattleState()");
  assert.equal(e.run('B.temporalEchoes.length'),0);
});

check('驻军与远征同样有独立护盾，战后兵力不超过战前人数',()=>{
  const e=environment();mageForm(e);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].hp'),10);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].shield'),2);
  e.run(`(()=>{const unit=buildGarrisonUnitsFromForm()[0];
    applyCombatDamage(unit,3);
    rebuildGarrisonFormationAfterBattle({ourUnits:[unit]});})()`);
  assert.equal(e.run('S._garrisonForm.front[0].count'),9);
});

check('训练场也不把开场护盾充当可保存人数',()=>{
  const e=environment();mageForm(e);
  e.run('B.isTraining=true;initBattleState();rebuildFormation()');
  assert.equal(e.run('S.formation.front[0].count'),10);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
