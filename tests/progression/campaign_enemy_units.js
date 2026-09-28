'use strict';
// node tests/progression/campaign_enemy_units.js
// 使用真实远征战斗初始化检查100关敌阵；缺失的敌兵配置会在玩家开战时抛错。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const e=environment();
e.run("S.formation.front=[{type:'infantry',count:10,id:1}]");
for(let stage=1;stage<=100;stage++){
  try{
    e.run(`S.selEnemy=${stage-1};S.battleEncounter=null;B.isTraining=false;initBattleState()`);
    assert.ok(e.run('B.enemyUnits.length')>0,`第${stage}关敌阵为空`);
    assert.ok(e.run('B.enemyUnits.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.atk)&&Number.isFinite(u.def))'),`第${stage}关属性无效`);
  }catch(error){
    throw new Error(`第${stage}关初始化失败：${error.message}`,{cause:error});
  }
}
console.log('PASS 100关远征敌阵均能初始化');
