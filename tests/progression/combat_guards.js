'use strict';
const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}
}

check('营地动作必须执行与 UI 相同的 Boss 门，未击败不得扣费或开工',()=>{
  const e=environment();
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=1000;S.res.stone=1000;S.res.food=1000");
  const before=e.run('({wood:S.res.wood,stone:S.res.stone,food:S.res.food})');
  assert.match(e.run("tierUpgradeLockReason('infantry_camp')"),/需击败第5关「/);
  e.run("buildTierUpgradeAct('infantry_camp')");
  assert.equal(e.run('S.buildings.infantry_camp.state'),'idle');
  assert.deepEqual(e.run('JSON.stringify({wood:S.res.wood,stone:S.res.stone,food:S.res.food})'),JSON.stringify(before));
});

check('营地动作满足 Boss 门后只扣一次，保存失败恢复资源与施工状态',()=>{
  const e=environment();
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.defeated.push(5)");
  assert.equal(e.run("tierUpgradeLockReason('infantry_camp')"),'');
  e.run("buildTierUpgradeAct('infantry_camp');buildTierUpgradeAct('infantry_camp')");
  assert.equal(e.run('S.buildings.infantry_camp.state'),'tier_upgrading');
  assert.equal(e.run('S.res.wood'),500);
  assert.equal(e.run('S.res.stone'),700);
  assert.equal(e.run('S.res.food'),800);

  const f=environment();
  f.run("S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.defeated.push(5);save=()=>({ok:false,stage:'write'})");
  f.run("buildTierUpgradeAct('infantry_camp')");
  assert.equal(f.run('S.buildings.infantry_camp.state'),'idle');
  assert.equal(f.run('S.res.wood'),1000);
  assert.equal(f.run('S.res.stone'),1000);
  assert.equal(f.run('S.res.food'),1000);
});

check('兵种研究动作不得跳过未解锁的前置 T1',()=>{
  const e=environment();
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',tier:2};S.defeated.push(20);S.res.wood=3000;S.res.stone=3000;S.res.food=3000;S.res.tech=3000;S.merit=30;S.essence.shield_essence=5");
  const before=e.run('JSON.stringify({res:S.res,merit:S.merit,essence:S.essence})');
  const out=e.run("upgradeUnit('infantry_t1','infantry_shield')");
  assert.equal(out.reason,'unit-prerequisite');
  assert.equal(e.run('S.upgradedUnits.infantry_shield'),undefined);
  assert.equal(e.run('JSON.stringify({res:S.res,merit:S.merit,essence:S.essence})'),before);
});

check('兵种研究保存失败时恢复兵力池、远征、驻军和队列',()=>{
  const e=environment();
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',tier:2};S.defeated.push(20);S.res.wood=3000;S.res.stone=3000;S.res.food=3000;S.res.tech=3000;S.merit=30;S.essence.shield_essence=5;S.upgradedUnits.infantry_t1=true;S.pool.infantry_t1=3;S.formation.front=[{type:'infantry_t1',count:2,id:1}];S._garrisonForm.front=[{type:'infantry_t1',count:1,id:2}];S.queue.infantry_t1={count:4,timer:1,reason:''};save=()=>({ok:false,stage:'write'})");
  const before=e.run('JSON.stringify({res:S.res,merit:S.merit,essence:S.essence,up:S.upgradedUnits,pool:S.pool,formation:S.formation,garrison:S._garrisonForm,queue:S.queue,ops:S.ops})');
  const out=e.run("upgradeUnit('infantry_t1','infantry_shield')");
  assert.equal(out.reason,'save-failed');
  assert.equal(e.run('JSON.stringify({res:S.res,merit:S.merit,essence:S.essence,up:S.upgradedUnits,pool:S.pool,formation:S.formation,garrison:S._garrisonForm,queue:S.queue,ops:S.ops})'),before);
});

check('旧档超仓库存不会在升阶退兵时被裁剪',()=>{
  const e=environment();
  e.run("S.buildings.infantry_camp={lv:1,state:'idle',tier:1};S.pool.infantry=1;S.res.wood=storageCapacity()+7");
  const before=e.run('S.res.wood');
  e.run("refundUnitsByLine('infantry_camp',0)");
  assert.ok(e.run('S.res.wood')>=before);
});

check('驻军零奖励不裁剪专属仓、货币或旧档超额库存',()=>{
  const e=environment();
  e.run("S.res.iron=resCap('iron')+7;S.res.coin=resCap('coin')+9;S.res.deed=30000");
  const before=e.run('JSON.stringify({iron:S.res.iron,coin:S.res.coin,deed:S.res.deed})');
  e.run("applyGarrisonResult({name:'测试入侵',reward:{wood:1},merit:2},{outcome:'win',ourUnits:[],rounds:1,ourLeft:1,enemyLeft:0,towerShots:0,towerDmg:0})");
  assert.equal(e.run('JSON.stringify({iron:S.res.iron,coin:S.res.coin,deed:S.res.deed})'),before);
});

check('驻军有奖励按该资源专属容量收取并展示实际所得',()=>{
  const e=environment();
  e.run("S.res.iron=resCap('iron')-2");
  e.run("applyGarrisonResult({name:'测试入侵',reward:{iron:10},merit:2},{outcome:'win',ourUnits:[],rounds:1,ourLeft:1,enemyLeft:0,towerShots:0,towerDmg:0})");
  assert.equal(e.run('S.res.iron'),e.run("resCap('iron')"));
  assert.equal(e.run('S.garrison.result.reward.iron'),2);
});

check('远征奖励与驻军共用专属容量，历史超仓库存不因胜利裁剪',()=>{
  const e=environment();
  e.run("S.selEnemy=0;S.formation={front:[],mid:[],back:[]};S._preForm={front:[],mid:[],back:[]};B.ourUnits=[];B.isTraining=false;CFG.enemies[0].reward={iron:10,wood:1};S.res.iron=resCap('iron')-2;S.res.coin=resCap('coin')+3");
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.iron'),e.run("resCap('iron')"));
  assert.equal(e.run('S.res.coin'),e.run("resCap('coin')+3"));
});

check('远征结算写档失败时不保留奖励、首通或战损',()=>{
  const e=environment();
  e.run("S.selEnemy=0;S.formation={front:[{type:'infantry',count:4,id:7}],mid:[],back:[]};S._preForm={front:[{type:'infantry',count:4,id:7}],mid:[],back:[]};B.ourUnits=[];B.isTraining=false;S.res.wood=100;save=()=>({ok:false,stage:'write'})");
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.wood'),100);
  assert.equal(e.run('S.formation.front[0].count'),4);
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run('S.merit'),0);
});

check('训练结算写档失败时不回写战斗临时损失',()=>{
  const e=environment();
  e.run("S.formation={front:[{type:'infantry',count:4,id:7}],mid:[],back:[]};B.ourUnits=[];B.enemyUnits=[];B.round=1;B.isTraining=true;save=()=>({ok:false,stage:'write'})");
  e.run("endBattle('win')");
  assert.equal(e.run('S.formation.front[0].count'),4);
});

check('驻军胜利与相位同次落盘，刷新后不重复领奖',()=>{
  const e=environment({}, {garrison:true});
  e.run("S.tick=1;S.garrison={...defaultGarrisonState(),phase:'sortie',phaseUntil:1,templateId:'forest_scout'};resolveGarrisonBattle=()=>({outcome:'win',ourUnits:[],rounds:1,ourLeft:1,enemyLeft:0,towerShots:0,towerDmg:0})");
  e.run('garrisonTick()');
  assert.equal(e.run('S.res.wood'),360);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.res.wood,360);
  assert.equal(saved.garrison.phase,'battle');
  const r=environment(Object.fromEntries(e.store),{garrison:true});
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  r.run('garrisonTick()');
  assert.equal(r.run('S.res.wood'),360);
});

check('驻军结算写档失败回滚并保护主档，不能显示已领奖',()=>{
  const e=environment({}, {garrison:true});
  e.run("S.tick=1;S.garrison={...defaultGarrisonState(),phase:'sortie',phaseUntil:1,templateId:'forest_scout'};resolveGarrisonBattle=()=>({outcome:'win',ourUnits:[],rounds:1,ourLeft:1,enemyLeft:0,towerShots:0,towerDmg:0});save=()=>({ok:false,stage:'write'})");
  e.run('garrisonTick()');
  assert.equal(e.run('S.res.wood'),300);
  assert.equal(e.run('S.garrison.phase'),'sortie');
  assert.equal(e.run('S.garrison.result'),null);
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.store.get('rts_save'),undefined);
});

check('手动触发驻军事件保存失败时恢复原相位与日志',()=>{
  const e=environment({}, {garrison:true});
  e.run("save=()=>({ok:false,stage:'write'})");
  assert.equal(e.run("triggerGarrisonInvasion('forest_scout')"),false);
  assert.equal(e.run('S.garrison.phase'),'idle');
  assert.equal(e.run('S.garrisonLog.length'),0);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
