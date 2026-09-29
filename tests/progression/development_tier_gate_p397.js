'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}

check('四档兵营和兵种在主线未胜时均可读取拓境首胜，未胜仍锁定',()=>{
  for(const [tier,track,key,stage] of [[1,'border','copper',5],[2,'outer','town',20],[3,'outer','city',40],[4,'outer','capital',65]]){
    const e=environment();
    e.run(`S.buildings.infantry_camp={lv:1,state:'idle',timer:0,tier:${tier-1}};S.res.wood=100000;S.res.stone=100000;S.res.food=100000`);
    assert.match(e.run(`tierUpgradeLockReason('infantry_camp')`),new RegExp(`第${stage}关`));
    assert.match(e.run(`checkTierLevel(${tier})`),/或首胜/);
    e.run(`S.development.${track}${track==='border'?'.sites':''}.${key}.wins=1`);
    assert.equal(e.run(`tierUpgradeLockReason('infantry_camp')`),'');
    assert.equal(e.run(`checkTierLevel(${tier})`),'');
    assert.equal(e.run(`S.defeated.includes(${stage})`),false);
  }
});

check('边疆铜点首胜后可真实付费升T1、研究并训练；保存重载保持进度',()=>{
  const e=environment();
  e.run(`S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};
    S.development.border.sites.copper.wins=1;S.res.wood=3000;S.res.stone=3000;
    S.res.food=3000;S.res.tech=500;S.merit=5;`);
  assert.equal(e.run(`buildTierUpgradeAct('infantry_camp').ok`),true);
  assert.equal(e.run('S.res.wood'),2500);
  assert.equal(e.run('S.res.stone'),2700);
  assert.equal(e.run('S.res.food'),2800);
  assert.equal(e.run(`buildTierUpgradeAct('infantry_camp').ok`),false,'施工中不能重复扣费');
  e.run(`S.buildings.infantry_camp.timer=1;tick()`);
  assert.equal(e.run('S.buildings.infantry_camp.tier'),1);
  assert.equal(e.run(`upgradeUnit('infantry','infantry_t1').ok`),true);
  assert.equal(e.run('S.upgradedUnits.infantry_t1'),true);
  assert.equal(e.run(`train('infantry_t1',1).ok`),true);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.infantry_t1'),1);
  assert.equal(e.run('S.defeated.length'),0,'未伪造主线成绩');
  const save=e.store.get('rts_save');
  const reload=environment({rts_save:save});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.buildings.infantry_camp.tier'),1);
  assert.equal(reload.run('S.upgradedUnits.infantry_t1'),true);
  assert.equal(reload.run('S.pool.infantry_t1'),1);
  assert.equal(reload.run('S.development.border.sites.copper.wins'),1);
});

check('旧主线胜档仍可升阶；非法区域胜次不会绕门',()=>{
  const old=environment();
  old.run(`S.buildings.infantry_camp={lv:1,state:'idle',tier:0};S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.defeated.push(5)`);
  assert.equal(old.run(`tierUpgradeLockReason('infantry_camp')`),'');
  assert.equal(old.run('checkTierLevel(1)'),'');
  const invalid=environment();
  invalid.run(`S.buildings.infantry_camp={lv:1,state:'idle',tier:0};S.res.wood=1000;S.res.stone=1000;S.res.food=1000;S.development.border.sites.copper.wins=-1`);
  assert.match(invalid.run(`tierUpgradeLockReason('infantry_camp')`),/第5关/);
  assert.equal(invalid.run(`buildTierUpgradeAct('infantry_camp').ok`),false);
  assert.equal(invalid.run('S.res.wood'),1000);
});

console.log(`development_tier_gate_p397: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
