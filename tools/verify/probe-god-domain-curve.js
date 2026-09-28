'use strict';
// 从真实新档、零关卡胜利的两场神域路线继续，逐场支付补兵与实际战斗。
// 时间单位为在线秒；随机数固定为0.5以复现战斗，不注入资源或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-god-domain.js'),'utf8');
const {run,assign,waitFor,action,build,upgradeTo,extraActions}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,build,upgradeTo,extraActions};'
)(require,{log(){}},__dirname);
run('Math.random=()=>0.5');
const records=[];
let target=16;
for(let attempt=3;attempt<=16&&run('S.items.godCrystal')<60;attempt++){
  run('exitBattle()');
  const owned=run("S.formation.front.reduce((n,u)=>n+u.count,0)");
  const missing=target-owned;
  if(missing>0){
    assign({food:2,stone:8,coal:7,iron:5,steel:4});
    waitFor(`S.res.steel>=${missing*100}`,20000);
    assign({food:26});
    const recruit=run(`train('alloy_special',${missing})`);
    assert.equal(recruit?.ok,true,JSON.stringify(recruit));
    extraActions.train++;
    waitFor(`S.pool.alloy_special>=${missing}`,20000);
    run(`openFormModal('expedition','front',0);S._formModalSel='alloy_special';S._formModalQty=${missing};confirmForm()`);
  }
  assert.equal(run('S.formation.front[0].count'),target);
  const before=run('S.items.godCrystal');
  const kill=run('S.killValues.godRevival');
  run('openGodDomain()');
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,reward:B.enemyCfg.reward.godCrystal})');
  for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'战斗回调应存在');
  assert.equal(run('S.battleActive'),false);
  const after=run('S.items.godCrystal');
  records.push({attempt,kill,enemy,win:after>before,crystal:after,survivors:run("S.formation.front.reduce((n,u)=>n+u.count,0)"),second:run('S.tick')});
  if(after===before){
    if(target===16){
      assign({wood:8,stone:8,food:4,tech:6});
      upgradeTo('alloy_armory',9);
      upgradeTo('barracks',5);
      target=30;
    }else break;
  }
}
console.log(JSON.stringify({unit:'online seconds',population:run('S.population.current'),stageWins:run('S.defeated.length'),killValue:run('S.killValues.godRevival'),crystal:run('S.items.godCrystal'),target60Reached:run('S.items.godCrystal>=60'),records,
  nextTraining:{alloyLevel:run("bldSt('alloy_armory').lv"),alloyCost:run("upCost('alloy_armory')"),barracksLevel:run("bldSt('barracks').lv"),barracksCost:run("upCost('barracks')"),stoneStoreLevel:run("bldSt('stone_store').lv"),stoneStoreCost:run("upCost('stone_store')"),granaryLevel:run("bldSt('large_granary').lv"),granaryResearch:run("scienceUnlocked('sci_large_granary')"),caps:run("({wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')})")}},null,2));
