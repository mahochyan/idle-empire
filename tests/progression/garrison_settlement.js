'use strict';
// 战斗结算的人数守恒、驻军真实伤害与空城掠夺回归。
// 运行：node tests/progression/garrison_settlement.js
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function fixedRandom(value,fn){
  const previous=Math.random;
  Math.random=()=>value;
  try{return fn()}finally{Math.random=previous}
}
function expedition(mode){
  const e=environment();
  e.run(`S.formation.front=[{type:'mage_space',count:10,id:101}];S.selEnemy=0;B.isTraining=${mode==='training'};initBattleState()`);
  return e;
}
function savedFormCount(e,which='formation'){
  return JSON.parse(e.store.get('rts_save'))[which].front[0].count;
}

check('远征胜利实际 endBattle 落盘不会把护盾变成士兵',()=>{
  const e=expedition('win');
  assert.equal(e.run('B.ourUnits[0].shield'),2);
  e.run("B.enemyUnits=[];B.round=1;endBattle('win')");
  assert.equal(e.run('S.formation.front[0].count'),10);
  assert.equal(savedFormCount(e),10);
});

check('远征战败实际 endBattle 只回写破盾后的真实战损',()=>{
  const e=expedition('lose');
  e.run("applyCombatDamage(B.ourUnits[0],3);B.enemyUnits=[];B.round=1;endBattle('lose')");
  assert.equal(e.run('S.formation.front[0].count'),9);
  assert.equal(savedFormCount(e),9);
});

check('训练场实际 endBattle 落盘不会把护盾变成士兵',()=>{
  const e=expedition('training');
  e.run("B.round=1;endBattle('win')");
  assert.equal(e.run('S.formation.front[0].count'),10);
  assert.equal(savedFormCount(e),10);
});

check('驻军真实交战先耗护盾，再扣人数，结算后保存正确人数',()=>fixedRandom(0.5,()=>{
  function fight(shieldEnabled){
    const e=environment({}, {garrison:true});
    e.run(`CFG.invasions.push({id:'shield_probe',name:'护盾探针',units:{infantry:[2]},reward:{},merit:0});
      CFG.garrisonInvade.maxRounds=1;
      S.tick=1;S._garrisonForm.front=[{type:'mage_space',count:10,id:201}];
      S.garrison={...defaultGarrisonState(),phase:'sortie',phaseUntil:1,templateId:'shield_probe'};`);
    if(!shieldEnabled)e.run('delete CFG.mageSpecials.mage_space.voidShield');
    e.run('garrisonTick()');
    assert.equal(e.run('S.garrison.phase'),'battle');
    return {count:e.run('S._garrisonForm.front[0].count'),saved:savedFormCount(e,'garrisonForm')};
  }
  assert.deepEqual(fight(true),{count:10,saved:10});
  assert.deepEqual(fight(false),{count:9,saved:9});
}));

check('空城真实入侵仅掠夺木石粮，刷新同一相位不重复扣费',()=>fixedRandom(0,()=>{
  const e=environment({}, {garrison:true});
  e.run(`S.res={...S.res,wood:100,stone:100,food:100,tech:100,coal:100,copper:100,iron:100,coin:100,deed:100};
    S.garrison=defaultGarrisonState();S.tick=300;garrisonTick()`);
  assert.equal(e.run('S.garrison.phase'),'warning');
  e.run('S.tick=303;garrisonTick()');
  assert.equal(e.run('S.garrison.result.outcome'),'empty');
  for(const key of ['wood','stone','food'])assert.equal(e.run(`S.res.${key}`),97,key);
  for(const key of ['tech','coal','copper','iron','coin','deed'])assert.equal(e.run(`S.res.${key}`),100,key);
  assert.equal(e.run("Object.keys(S.garrison.result.loss).sort().join(',')"),'food,stone,wood');
  const saved=e.store.get('rts_save');
  const logCount=e.run('S.garrisonLog.length'); // 预警与洗劫各记一条
  assert.ok(saved);
  const reloaded=environment(Object.fromEntries(e.store),{garrison:true});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  reloaded.run('garrisonTick()');
  assert.equal(reloaded.run('S.res.wood'),97);
  assert.equal(reloaded.run('S.res.tech'),100);
  assert.equal(reloaded.run('S.garrisonLog.length'),logCount);
}));

check('空城掠夺保存失败回滚资源、相位和入侵日志，主档保持原文',()=>fixedRandom(0,()=>{
  const e=environment({}, {garrison:true});
  e.run(`S.res={wood:100,stone:100,food:100,tech:100,coal:100,copper:100,iron:100,coin:100,deed:100};
    S.tick=303;S.garrison={...defaultGarrisonState(),phase:'warning',phaseUntil:303,templateId:'forest_scout'};
    save()`);
  const raw=e.store.get('rts_save');
  const before=e.run('JSON.stringify({g:S.garrison,form:S._garrisonForm,res:S.res,merit:S.merit,raidLog:S.garrisonLog})');
  e.run("save=()=>({ok:false,stage:'write'});garrisonTick()");
  const after=e.run('JSON.stringify({g:S.garrison,form:S._garrisonForm,res:S.res,merit:S.merit,raidLog:S.garrisonLog})');
  assert.equal(after,before);
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.store.get('rts_save'),raw);
}));

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
