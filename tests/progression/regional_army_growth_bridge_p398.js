'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}

function regionEnvironment(){
  const e=environment();
  e.run(`
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)
    };
    S.sciences.push('sci_copper','sci_iron','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age');
    S.res.wood=100000;S.res.stone=100000;S.res.food=100000;S.res.tech=10000;
    S.pool.infantry=100;S.formation={front:[{type:'infantry',count:1}],mid:[],back:[]};
  `);
  return e;
}
function win(e,track,key){
  e.run(`openDevelopment${track==='border'?'Border':'Outer'}('${key}')`);
  assert.equal(e.run('S.battleActive'),true,`${track}.${key} 应可开战`);
  e.run("B.enemyUnits.forEach(unit=>unit.alive=false);endBattle('win')");
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  e.run('exitBattle()');
}
function extract(e){
  return JSON.parse(e.run('JSON.stringify({merit:S.merit,essence:S.essence,development:S.development,defeated:S.defeated})'));
}

check('边疆胜利给现有战功；铜脉首胜无 Boss 也可支付骑兵建造与根研究、训练及重载',()=>{
  const e=regionEnvironment();
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run("buildAct('stable').ok"),false);
  for(let i=0;i<4;i++)win(e,'border','copper');
  assert.equal(e.run('S.merit'),8);
  assert.equal(e.run('bossDefeatedCount()'),0);
  assert.equal(e.run("buildAct('stable').ok"),true);
  e.run('S.buildings.stable.timer=1;tick()');
  assert.equal(e.run('S.buildings.stable.lv'),1);
  assert.equal(e.run("unlockUnitRoot('cavalry_t1').ok"),true);
  assert.equal(e.run('S.merit'),0);
  assert.equal(e.run("train('cavalry_t1',1).ok"),true);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.cavalry_t1'),1);
  assert.equal(e.run('S.defeated.length'),0);
  const loaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.upgradedUnits.cavalry_t1'),true);
  assert.equal(loaded.run('S.pool.cavalry_t1'),1);
  assert.equal(loaded.run('S.merit'),0);
  assert.equal(loaded.run('S.development.border.sites.copper.wins'),4);
  assert.equal(loaded.run('S.defeated.length'),0);
});

check('外域军屯与工造胜利以确定循环给八类精魄、战功，不伪造主线胜场',()=>{
  const e=regionEnvironment();
  for(let i=0;i<15;i++)win(e,'outer','village');
  assert.equal(e.run('S.merit'),75);
  for(const key of ['shield_essence','spear_essence','sword_essence'])
    assert.equal(e.run(`S.essence.${key}`),5,key);
  for(let i=0;i<15;i++)win(e,'outer','town');
  assert.equal(e.run('S.merit'),180);
  for(const key of ['bow_essence','crossbow_essence','blade_essence'])
    assert.equal(e.run(`S.essence.${key}`),5,key);
  assert.equal(e.run('S.essence.wind_essence'),8);
  assert.equal(e.run('S.essence.iron_essence'),7);
  assert.equal(e.run('S.defeated.length'),0);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.merit,180);
  assert.equal(saved.essence.shield_essence,5);
  assert.equal(saved.essence.wind_essence,8);
  const loaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.essence.iron_essence'),7);
  assert.equal(loaded.run('S.defeated.length'),0);
});

check('工造首胜替代四 Boss 法师塔门，已赚战功和精魄仍需按兵种研究逐次付费',()=>{
  const e=regionEnvironment();
  assert.equal(e.run("buildAct('mage_tower').ok"),false);
  win(e,'border','copper');
  win(e,'outer','town');
  assert.equal(e.run('bossDefeatedCount()'),0);
  assert.equal(e.run("buildAct('mage_tower').ok"),true);
  e.run('S.buildings.mage_tower.timer=1;tick()');
  assert.equal(e.run('S.buildings.mage_tower.lv'),1);
  win(e,'outer','town');
  assert.equal(e.run('S.merit'),16);
  assert.equal(e.run("unlockUnitRoot('mage_t1').ok"),true);
  assert.equal(e.run('S.merit'),8);
  assert.equal(e.run("train('mage_t1',1).ok"),true);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.mage_t1'),1);
  assert.equal(e.run('S.defeated.length'),0);
});

check('铜脉、村寨与军镇有效胜利结算后依次付费升 T1/T2、研究盾卫并训练，重载仍无主线胜场',()=>{
  const e=regionEnvironment();
  win(e,'border','copper');
  for(let i=0;i<4;i++)win(e,'outer','village');
  win(e,'outer','town');
  assert.equal(e.run('S.essence.shield_essence'),2);
  assert.equal(e.run('S.merit'),29);
  assert.equal(e.run("buildAct('infantry_camp').ok"),true);
  e.run('S.buildings.infantry_camp.timer=1;tick()');
  assert.equal(e.run("buildTierUpgradeAct('infantry_camp').ok"),true);
  e.run('S.buildings.infantry_camp.timer=1;tick()');
  assert.equal(e.run("buildTierUpgradeAct('infantry_camp').ok"),true);
  e.run('S.buildings.infantry_camp.timer=1;tick()');
  assert.equal(e.run('S.buildings.infantry_camp.tier'),2);
  assert.equal(e.run("upgradeUnit('infantry','infantry_t1').ok"),true);
  assert.equal(e.run("upgradeUnit('infantry_t1','infantry_shield').ok"),true);
  assert.equal(e.run('S.merit'),14);
  assert.equal(e.run('S.essence.shield_essence'),0);
  assert.equal(e.run("train('infantry_shield',1).ok"),true);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.infantry_shield'),1);
  assert.equal(e.run('S.defeated.length'),0);
  const loaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.upgradedUnits.infantry_shield'),true);
  assert.equal(loaded.run('S.pool.infantry_shield'),1);
  assert.equal(loaded.run('S.essence.shield_essence'),0);
  assert.equal(loaded.run('S.defeated.length'),0);
});

check('外域奖励只在有效胜利结算一次；失败回滚原档和运行中研究资源',()=>{
  const e=regionEnvironment();
  e.run('save()');
  const original=e.store.get('rts_save');
  e.run("openDevelopmentOuter('village');endBattle('win')");
  assert.equal(e.store.get('rts_save'),original,'敌人尚存的伪胜不能给奖励');
  const beforeLoss=extract(e);
  e.run("endBattle('lose')");
  assert.deepEqual(extract(e),beforeLoss,'战败不能给研究奖励');
  e.run('exitBattle()');
  const lossSave=e.store.get('rts_save');
  const before=extract(e);
  e.run(`const realSet=localStorage.setItem;
    localStorage.setItem=(key,value)=>{if(key==='rts_save')throw new Error('simulated write failure');realSet(key,value)};`);
  e.run("openDevelopmentOuter('village');B.enemyUnits.forEach(unit=>unit.alive=false);endBattle('win')");
  assert.deepEqual(extract(e),before,'写档失败应回滚区域胜次、战功、精魄与主线');
  assert.equal(e.store.get('rts_save'),lossSave);
});

check('已结算区域胜利重复调用不重复给战功或精魄',()=>{
  const e=regionEnvironment();
  e.run("openDevelopmentOuter('village');B.enemyUnits.forEach(unit=>unit.alive=false);endBattle('win')");
  const before=extract(e),saved=e.store.get('rts_save');
  e.run("endBattle('win')");
  assert.deepEqual(extract(e),before);
  assert.equal(e.store.get('rts_save'),saved);
});

check('旧主线 Boss 通关可继续建骑兵营与法师塔；无效区域胜次不得绕门',()=>{
  const old=regionEnvironment();
  old.run('S.defeated=[10,20,30,40]');
  assert.equal(old.run("buildAct('stable').ok"),true);
  assert.equal(old.run("buildAct('mage_tower').ok"),true);
  const bad=regionEnvironment();
  bad.run('S.development.border.sites.copper.wins=-1;S.development.outer.town.wins=-1');
  assert.equal(bad.run("buildAct('stable').ok"),false);
  assert.equal(bad.run("buildAct('mage_tower').ok"),false);
});

console.log(`regional_army_growth_bridge_p398: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
