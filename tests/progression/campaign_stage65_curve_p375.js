'use strict';
// node tests/progression/campaign_stage65_curve_p375.js
// Read the actual loaded CFG and battle initialization, not a copied level table.
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const e=environment();
e.run("S.formation.front=[{type:'infantry',count:10,id:1}]");
for(const [stage,expected] of [[64,42],[65,48],[66,52]]){
  const configured=e.run(`(()=>{const enemy=CFG.enemies.find(item=>item.id===${stage});
    return enemy&&Object.values(enemy.units).flat().reduce((sum,n)=>sum+n,0)})()`);
  assert.equal(configured,expected,`第${stage}关正式配置人数`);
  e.run(`S.selEnemy=${stage-1};S.battleEncounter=null;B.isTraining=false;initBattleState()`);
  const initialized=e.run('B.enemyUnits.reduce((sum,unit)=>sum+unit.initialCount,0)');
  assert.equal(initialized,expected,`第${stage}关实际战斗初始化人数`);
}
console.log('PASS 第64–66关实际CFG与战斗人数 42→48→52');
