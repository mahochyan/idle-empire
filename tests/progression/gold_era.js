'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`)}

check('黄金发展和仓储增效形成两条并行研究线',()=>{
  const e=environment();
  const list=[['sci_gold','sci_silver_age',6000],['sci_gold_store','sci_gold',3000],
    ['sci_gold_refinery','sci_gold_store',5000],['sci_gold_age','sci_gold',7000]];
  for(const [id,need,cost] of list){
    assert.deepEqual(Array.from(e.run(`scienceNeedIds('${id}')`)),[need]);
    assert.equal(e.run(`activeSciences().${id}.cost.tech`),cost);
  }
  e.run("S.sciences=['sci_silver'];S.res.tech=13000");
  assert.equal(e.run("researchScience('sci_gold').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_silver_age')");
  assert.equal(e.run("researchScience('sci_gold').ok"),true);
  assert.equal(e.run("researchScience('sci_gold_refinery').reason"),'science-prerequisite');
  assert.equal(e.run("researchScience('sci_gold_age').ok"),true);
  assert.equal(e.run("S.sciences.includes('sci_gold_store')"),false);
});

check('金属金工逐在线秒耗矿石2煤1产金四分之一，缺料和满仓不吞原料',()=>{
  const e=environment();
  assert.equal(e.run('S.res.gold'),0);
  assert.equal(e.run('S.popAlloc.gold'),0);
  assert.equal(e.run("workerLockReason('gold')"),'需先研究「冶金技术」');
  e.run("S.sciences=['sci_gold'];S.population.current=4;S.res.stone=20;S.res.coal=10;S.res.food=1000");
  assert.equal(e.run("setPopAlloc('gold',1).ok"),true);
  e.run('tick()');
  near(e.run('S.res.gold'),0.25);
  near(e.run('S.res.stone'),18);
  near(e.run('S.res.coal'),9);
  assert.equal(e.run("resCap('gold')"),300);
  e.run('S.res.stone=0;tick()');
  near(e.run('S.res.gold'),0.25);
  near(e.run('S.res.coal'),9);
  e.run("S.res.gold=resCap('gold');S.res.stone=20;tick()");
  near(e.run('S.res.gold'),300);
  near(e.run('S.res.stone'),20);
});

check('小金库首级金150、容量+100；冶金厂银500需先将小银库升至2级',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver_store','sci_gold','sci_gold_store','sci_gold_refinery'];S.res.gold=150;S.res.wood=1200;S.res.food=1000;S.res.silver=300");
  assert.equal(e.run("buildAct('gold_store').ok"),true);
  assert.equal(e.run("resCap('gold')"),300);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('gold')"),400);
  assert.equal(e.run("upCost('gold_store').gold"),180);
  assert.equal(e.run("buildAct('gold_refinery').reason"),'resources');
  e.run("S.buildings.silver_store={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.silver=180");
  assert.equal(e.run("buildAct('silver_store').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('silver')"),500);
  e.run('S.res.silver=500');
  assert.equal(e.run("buildAct('gold_refinery').ok"),true);
  assert.equal(e.run('S.res.silver'),0);
  assert.equal(e.run("buildingBuff('gold')"),0);
  e.run('advanceBuildingsBy(30)');
  near(e.run("buildingBuff('gold')"),0.1);
  near(e.run("upCost('gold_refinery').silver"),2000/3);
});

check('黄金重骑兵须时代研究和兵坊，完成训练扣粮1000金100并可入远征驻军',()=>{
  const e=environment();
  e.run("S.sciences=['sci_gold'];S.res.wood=1200;S.res.stone=1200;S.res.food=2500;S.res.gold=100");
  assert.equal(e.run("train('gold_cavalry',1).reason"),'locked');
  e.run("S.sciences.push('sci_gold_age')");
  assert.equal(e.run("buildAct('gold_armory').ok"),true);
  e.run('advanceBuildingsBy(30)');
  const foodBefore=e.run('S.res.food');
  assert.equal(e.run("train('gold_cavalry',1).ok"),true);
  assert.equal(e.run('S.res.gold'),100);
  assert.equal(e.run('S.res.food'),foodBefore);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.gold_cavalry'),1);
  assert.equal(e.run('S.res.gold'),0);
  assert.equal(e.run('S.res.food'),foodBefore-1000);
  assert.equal(e.run("combatBaseUnitType('gold_cavalry')"),'cavalry');
  e.run("S.formation.front=[{type:'gold_cavalry',count:1,id:1}];S._garrisonForm.front=[{type:'gold_cavalry',count:1,id:2}];S.selEnemy=0;B.isTraining=false;initBattleState()");
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

check('v9迁移补金与金工0、保留已有银和人口；坏v32与未来档写回受保护',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.silver=501;S.population.current=8;const d=serializeSave();d.v=9;delete d.res.gold;delete d.popAlloc.gold;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('S.res.silver'),501);
  assert.equal(e.run('S.population.current'),8);
  assert.equal(e.run('S.res.gold'),0);
  assert.equal(e.run('S.popAlloc.gold'),0);
  const v10=JSON.parse(e.store.get('rts_save'));
  1332;
  assert.equal(v10.res.gold,0);
  assert.equal(v10.popAlloc.gold,0);
  const blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
  assert.equal(blocked.run('saveProtected()'),true);
  for(const change of [d=>delete d.res.gold,d=>{d.popAlloc.gold=-1},d=>{d.v=34}]){
    const copy=structuredClone(v10);change(copy);
    const old=JSON.stringify(copy),bad=environment({rts_save:old});
    assert.equal(bad.run('loadSaveAndApply().status'),copy.v===34?'future':'invalid');
    bad.run('tick()');
    assert.equal(bad.store.get('rts_save'),old);
  }
});

check('黄金研究与金库写档失败不扣科技或金属',()=>{
  const science=environment();
  science.run("S.sciences=['sci_gold'];S.res.tech=3000;save()");
  const before=science.store.get('rts_save');
  science.run("const oldGoldWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldGoldWrite(k,v)}");
  assert.equal(science.run("researchScience('sci_gold_store').reason"),'save-failed');
  assert.equal(science.run('S.res.tech'),3000);
  assert.equal(science.run("S.sciences.includes('sci_gold_store')"),false);
  assert.equal(science.store.get('rts_save'),before);
  const store=environment();
  store.run("S.sciences=['sci_gold','sci_gold_store'];S.res.gold=150;save()");
  const old=store.store.get('rts_save');
  store.run("const oldGoldStoreWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldGoldStoreWrite(k,v)}");
  assert.equal(store.run("buildAct('gold_store').reason"),'save-failed');
  assert.equal(store.run('S.res.gold'),150);
  assert.equal(store.run("bldSt('gold_store').lv"),0);
  assert.equal(store.store.get('rts_save'),old);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
