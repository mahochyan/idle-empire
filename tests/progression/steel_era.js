'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}}
function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`)}

check('冶钢、钢仓、冶钢厂与合金时代按母本直接前置和知识费研究',()=>{
  const e=environment();
  const nodes=[['sci_steel','sci_gold_age',9000],['sci_steel_store','sci_steel',4000],
    ['sci_steel_refinery','sci_steel_store',8000],['sci_alloy_age','sci_steel',10000]];
  for(const [id,need,cost] of nodes){
    assert.deepEqual(Array.from(e.run(`scienceNeedIds('${id}')`)),[need]);
    assert.equal(e.run(`activeSciences().${id}.cost.tech`),cost);
  }
  e.run("S.sciences=['sci_gold'];S.res.tech=12000");
  assert.equal(e.run("researchScience('sci_steel').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_gold_age')");
  assert.equal(e.run("researchScience('sci_steel').ok"),true);
  assert.equal(e.run("researchScience('sci_steel_refinery').reason"),'science-prerequisite');
  e.run('S.res.tech=10000');
  assert.equal(e.run("researchScience('sci_alloy_age').ok"),true);
});

check('冶钢工每在线秒耗铁矿石煤各1产钢四分之一，缺料满仓不吞原料',()=>{
  const e=environment();
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run('S.popAlloc.steel'),0);
  assert.equal(e.run("workerLockReason('steel')"),'需先研究「冶钢技术」');
  e.run("S.sciences=['sci_steel'];S.population.current=4;S.res.iron=10;S.res.stone=10;S.res.coal=10;S.res.food=1000");
  assert.equal(e.run("setPopAlloc('steel',1).ok"),true);
  for(let i=0;i<4;i++)e.run('tick()');
  near(e.run('S.res.steel'),1);
  near(e.run('S.res.iron'),6);
  near(e.run('S.res.stone'),6);
  near(e.run('S.res.coal'),6);
  assert.equal(e.run("resCap('steel')"),300);
  e.run('S.res.iron=0;tick()');
  near(e.run('S.res.steel'),1);
  near(e.run('S.res.coal'),6);
  e.run("S.res.steel=resCap('steel');S.res.iron=10;tick()");
  near(e.run('S.res.steel'),300);
  near(e.run('S.res.iron'),10);
});

check('钢仓付铁200钢200，完工增钢100并扩铜铁；冶钢厂金500先扩金仓',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steel','sci_steel_store','sci_steel_refinery','sci_gold_store'];S.res.iron=300;S.res.steel=250;S.res.gold=400;S.res.wood=1200;S.res.food=1000");
  assert.equal(e.run("buildAct('steel_store').ok"),true);
  assert.equal(e.run("resCap('steel')"),300);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('steel')"),400);
  assert.equal(e.run("resCap('iron')"),800);
  assert.equal(e.run("resCap('copper')"),800);
  const legacy=environment();
  legacy.run("S.metalRecipeMode='legacy'");
  const oldCaps=legacy.run("({copper:resCap('copper'),iron:resCap('iron')})");
  legacy.run("S.buildings.steel_store={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert.equal(legacy.run("resCap('copper')"),oldCaps.copper+200);
  assert.equal(legacy.run("resCap('iron')"),oldCaps.iron+200);
  e.run("S.buildings.gold_store={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  assert.equal(e.run("resCap('gold')"),400);
  assert.equal(e.run("buildAct('steel_refinery').reason"),'resources');
  e.run('S.res.gold=180');
  assert.equal(e.run("buildAct('gold_store').ok"),true);
  e.run('advanceBuildingsBy(30)');
  assert.equal(e.run("resCap('gold')"),500);
  e.run('S.res.gold=500');
  assert.equal(e.run("buildAct('steel_refinery').ok"),true);
  assert.equal(e.run('S.res.gold'),0);
  e.run('advanceBuildingsBy(30)');
  near(e.run("buildingBuff('steel')"),0.1);
});

check('合金特种兵须研究和兵坊，逐兵扣食物1500钢100，可入远征驻军',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steel'];S.res.wood=1500;S.res.stone=1500;S.res.food=3000;S.res.steel=100");
  assert.equal(e.run("train('alloy_special',1).reason"),'locked');
  e.run("S.sciences.push('sci_alloy_age')");
  assert.equal(e.run("buildAct('alloy_armory').ok"),true);
  e.run('advanceBuildingsBy(30)');
  const foodBefore=e.run('S.res.food');
  assert.equal(e.run("train('alloy_special',1).ok"),true);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.alloy_special'),1);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run('S.res.food'),foodBefore-1500);
  e.run("S.formation.front=[{type:'alloy_special',count:1,id:1}];S._garrisonForm.front=[{type:'alloy_special',count:1,id:2}];S.selEnemy=0;B.isTraining=false;initBattleState()");
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

check('v10迁移补钢与钢工0，旧超仓金铁人口保留；坏v34未来v35保护原文',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.gold=501;S.res.iron=801;S.population.current=8;S.popAlloc.gold=1;S.pool.gold_cavalry=2;S.sciences=['sci_gold_age'];S.currencyRecipeMode='legacy';const d=serializeSave();d.v=10;delete d.res.steel;delete d.popAlloc.steel;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('S.res.gold'),501);
  assert.equal(e.run('S.res.iron'),801);
  assert.equal(e.run('S.population.current'),8);
  assert.equal(e.run('S.popAlloc.gold'),1);
  assert.equal(e.run('S.pool.gold_cavalry'),2);
  assert.equal(e.run("S.sciences.includes('sci_gold_age')"),true);
  assert.equal(e.run('S.currencyRecipeMode'),'legacy');
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run('S.popAlloc.steel'),0);
  const d=JSON.parse(e.store.get('rts_save'));
  assert.equal(d.v,34);
  assert.equal(d.res.steel,0);
  assert.equal(d.popAlloc.steel,0);
  const blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
  for(const mutate of [x=>delete x.res.steel,x=>{x.popAlloc.steel=-1},x=>{x.v=35}]){
    const copy=structuredClone(d);mutate(copy);
    const text=JSON.stringify(copy),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),copy.v===35?'future':'invalid');
    bad.run('tick()');
    assert.equal(bad.store.get('rts_save'),text);
  }
});

check('冶钢研究与钢仓保存失败不扣知识、铁钢',()=>{
  const e=environment();
  e.run("S.sciences=['sci_gold_age'];S.res.tech=9000;save()");
  const old=e.store.get('rts_save');
  e.run("const oldSteelWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSteelWrite(k,v)}");
  assert.equal(e.run("researchScience('sci_steel').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),9000);
  assert.equal(e.run("S.sciences.includes('sci_steel')"),false);
  assert.equal(e.store.get('rts_save'),old);
  const store=environment();
  store.run("S.sciences=['sci_steel','sci_steel_store'];S.res.iron=200;S.res.steel=200;save()");
  const before=store.store.get('rts_save');
  store.run("const oldSteelStoreWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSteelStoreWrite(k,v)}");
  assert.equal(store.run("buildAct('steel_store').reason"),'save-failed');
  assert.equal(store.run('S.res.iron'),200);
  assert.equal(store.run('S.res.steel'),200);
  assert.equal(store.run("bldSt('steel_store').lv"),0);
  assert.equal(store.store.get('rts_save'),before);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
