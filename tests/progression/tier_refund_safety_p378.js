'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function snapshot(e){
  return e.run('JSON.stringify({pool:S.pool,formation:S.formation,garrison:S._garrisonForm,queue:S.queue})');
}

check('退还旧阶兵时保留同线高阶兵的兵池、远征、驻军和训练队列',()=>{
  const e=environment();
  e.run(`S.buildings.infantry_camp={lv:1,state:'idle',tier:2};
    S.pool.infantry_t1=2;S.pool.infantry_shield=3;
    S.formation.front=[{type:'infantry_t1',count:1,id:1},{type:'infantry_shield',count:4,id:2},{type:'archer',count:2,id:3}];
    S._garrisonForm.front=[{type:'infantry_t1',count:1,id:4},{type:'infantry_shield',count:5,id:5}];
    S.queue.infantry_t1={count:6,timer:1,reason:''};
    S.queue.infantry_shield={count:7,timer:1,reason:''};
    S.res.wood=100;S.res.stone=100;S.res.food=100`);
  e.run("refundUnitsByLine('infantry_camp',1)");
  assert.equal(e.run('S.pool.infantry_t1'),0);
  assert.equal(e.run('S.queue.infantry_t1.count'),0);
  assert.equal(e.run('S.formation.front.some(u=>u.type===\'infantry_t1\')'),false);
  assert.equal(e.run('S._garrisonForm.front.some(u=>u.type===\'infantry_t1\')'),false);
  assert.equal(e.run('S.pool.infantry_shield'),3);
  assert.equal(e.run('S.formation.front.find(u=>u.type===\'infantry_shield\').count'),4);
  assert.equal(e.run('S._garrisonForm.front.find(u=>u.type===\'infantry_shield\').count'),5);
  assert.equal(e.run('S.queue.infantry_shield.count'),7);
  assert.equal(e.run('S.formation.front.find(u=>u.type===\'archer\').count'),2);
  assert.equal(e.run('S.res.wood'),100+4*e.run('CFG.units.infantry_t1.cost.wood'));
});

check('研究另一条 T2 分支时只退役 T1，已拥有的 T3 兵仍在远征、驻军和队列',()=>{
  const e=environment();
  e.run(`S.buildings.infantry_camp={lv:1,state:'idle',tier:3};
    S.defeated.push(20,40);
    S.res.wood=3000;S.res.stone=3000;S.res.food=3000;S.res.tech=3000;
    S.merit=30;S.essence.spear_essence=2;
    S.upgradedUnits.infantry_t1=true;S.upgradedUnits.infantry_fortress=true;
    S.pool.infantry_t1=2;S.pool.infantry_fortress=3;
    S.formation.front=[{type:'infantry_t1',count:1,id:1},{type:'infantry_fortress',count:4,id:2}];
    S._garrisonForm.front=[{type:'infantry_t1',count:1,id:3},{type:'infantry_fortress',count:5,id:4}];
    S.queue.infantry_t1={count:6,timer:1,reason:''};
    S.queue.infantry_fortress={count:7,timer:1,reason:''}`);
  assert.equal(e.run("upgradeUnit('infantry_t1','infantry_spear').ok"),true);
  assert.equal(e.run('S.upgradedUnits.infantry_spear'),true);
  assert.equal(e.run('S.pool.infantry_t1'),0);
  assert.equal(e.run('S.queue.infantry_t1.count'),0);
  assert.equal(e.run('S.pool.infantry_fortress'),3);
  assert.equal(e.run('S.formation.front.find(u=>u.type===\'infantry_fortress\').count'),4);
  assert.equal(e.run('S._garrisonForm.front.find(u=>u.type===\'infantry_fortress\').count'),5);
  assert.equal(e.run('S.queue.infantry_fortress.count'),7);
  const after=snapshot(e),loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(snapshot(loaded),after);
});

check('有 T1 接班兵种时营地 T0→T1 完工仍按既有规则退役 T0',()=>{
  const e=environment();
  e.run(`S.buildings.infantry_camp={lv:1,state:'tier_upgrading',timer:1,timerEnd:1,tier:0};
    S.pool.infantry=2;S.formation.front=[{type:'infantry',count:1,id:1}];
    S._garrisonForm.front=[{type:'infantry',count:1,id:2}];
    S.queue.infantry={count:3,timer:1,reason:''}`);
  assert.equal(e.run('advanceBuildingsBy(1)'),true);
  assert.equal(e.run('S.buildings.infantry_camp.tier'),1);
  assert.equal(e.run('S.pool.infantry'),0);
  assert.equal(e.run('S.formation.front.length'),0);
  assert.equal(e.run('S._garrisonForm.front.length'),0);
  assert.equal(e.run('S.queue.infantry.count'),0);
});

for(const [building,unit] of [
  ['infantry_camp','infantry_fortress'],
  ['archer_range','archer_longbow'],
  ['mage_tower','mage_chrono']
]){
  check(`${building} 实付 T3→T4 后无 T4 接班兵种，不退役仍可训练 T3`,()=>{
    const e=environment();
    e.run(`S.buildings.${building}={lv:1,state:'idle',timer:0,timerEnd:0,tier:3};
      S.defeated.push(10,20,30,40,65);S.res.wood=50000;S.res.stone=50000;S.res.food=50000;
      S.upgradedUnits.${unit}=true;S.pool.${unit}=3;
      S.formation.front=[{type:'${unit}',count:4,id:11}];
      S._garrisonForm.back=[{type:'${unit}',count:5,id:12}];
      S.queue.${unit}={count:6,timer:1,reason:''}`);
    const before=snapshot(e);
    assert.equal(e.run(`tierUpgradeLockReason('${building}')`),'');
    assert.equal(e.run(`buildTierUpgradeAct('${building}').ok`),true);
    assert.equal(e.run(`advanceBuildingsBy(S.buildings.${building}.timerEnd)`),true);
    assert.equal(e.run(`S.buildings.${building}.tier`),4);
    assert.equal(snapshot(e),before);
    assert.equal(e.run(`trainLockReason('${unit}')`),'');
    assert.equal(e.run('save().ok'),true);
    const loaded=environment(Object.fromEntries(e.store));
    assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
    assert.equal(snapshot(loaded),before);
  });
}

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
