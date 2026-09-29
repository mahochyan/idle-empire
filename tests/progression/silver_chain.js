'use strict';
// 白银产业：城市化→冶银→铸银两→银两购契；调用游戏真实动作与存档。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}
const saved=e=>JSON.parse(e.store.get('rts_save'));
const near=(actual,want)=>assert.ok(Math.abs(actual-want)<1e-7,`${actual} != ${want}`);

check('新档 v35 银与银两入档，冶银技术须城市化后花3200科技点',()=>{
  const e=environment();
  assert.equal(e.run('CFG.save.schema'),24);
  assert.equal(e.run('S.res.silver'),0);
  assert.equal(e.run('S.res.silverCoin'),0);
  assert.equal(e.run('S.popAlloc.silver'),0);
  assert.equal(e.run('S.popAlloc.silverCoin'),0);
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_silver')")),['sci_city']);
  e.run('S.res.tech=3200');
  assert.equal(e.run("researchScience('sci_silver').reason"),'science-prerequisite');
  e.run("S.sciences=['sci_city']");
  assert.equal(e.run("researchScience('sci_silver').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run("researchScience('sci_silver').repeat"),true);
  assert.equal(saved(e).v,35);
  assert.equal(saved(e).res.silver,0);
  const short=environment();
  short.run("CFG.tech.longLadder=false;S.sciences=['sci_iron'];S.res.tech=2200");
  assert.equal(short.run("researchScience('sci_city').ok"),true);
  short.run('S.res.tech=3200');
  assert.equal(short.run("researchScience('sci_silver').ok"),true);
});

check('冶银岗位每3在线秒耗石6煤3产银1；缺料和银仓满不空扣',()=>{
  const e=environment();
  e.run("S.sciences=['sci_city','sci_silver'];S.population.current=4;S.res.food=1000;S.res.stone=100;S.res.coal=50");
  assert.equal(e.run("setPopAlloc('silver',1).ok"),true);
  e.run('for(let i=0;i<3;i++)tick()');
  near(e.run('S.res.silver'),1);
  near(e.run('S.res.stone'),94);
  near(e.run('S.res.coal'),47);
  assert.equal(e.run("resCap('silver')"),300);
  e.run('S.res.stone=0;tick()');
  near(e.run('S.res.silver'),1);
  near(e.run('S.res.coal'),47);
  e.run("S.res.stone=100;S.res.silver=resCap('silver');tick()");
  near(e.run('S.res.stone'),100);
  near(e.run('S.res.coal'),47);
});

check('铸银两工须同时有冶银和铸币研究，每3在线秒耗银1产银两2',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver'];S.population.current=4;S.res.food=1000;S.res.silver=3");
  assert.notEqual(e.run("workerLockReason('silverCoin')"),'');
  e.run("S.sciences.push('sci_currency')");
  assert.equal(e.run("workerLockReason('silverCoin')"),'');
  assert.equal(e.run("setPopAlloc('silverCoin',1).ok"),true);
  e.run('for(let i=0;i<3;i++)tick()');
  near(e.run('S.res.silver'),2);
  near(e.run('S.res.silverCoin'),2);
  assert.equal(e.run("resCap('silverCoin')"),10000);
  e.run('S.res.silver=0;tick()');
  near(e.run('S.res.silverCoin'),2);
  e.run("S.res.silver=3;S.res.silverCoin=resCap('silverCoin');tick()");
  near(e.run('S.res.silver'),3);
});

check('离线逐秒推进使用同一银链配方并按比例扣产',()=>{
  const e=environment();
  e.run("S.sciences=['sci_silver','sci_currency'];S.population.current=4;S.res.food=1000;S.res.stone=100;S.res.coal=50;S.popAlloc.silver=1;S.popAlloc.silverCoin=1");
  const before={stone:e.run('S.res.stone'),coal:e.run('S.res.coal')};
  e.run('offlineAdvanceSec(3,0.6)');
  near(e.run('S.res.stone'),before.stone-3.6);
  near(e.run('S.res.coal'),before.coal-1.8);
  near(e.run('S.res.silverCoin'),1.2);
  near(e.run('S.res.silver'),0);
});

check('银两200购1地契须冶银研究与已建市场，失败不扣款且不限早期日限',()=>{
  const e=environment();
  e.run("S.sciences=['sci_copper'];S.buildings.market={lv:1,state:'idle'};S.res.silverCoin=200");
  assert.equal(e.run("exchangeResource('silverCoin','deed',200).reason"),'rate-locked');
  e.run("S.sciences.push('sci_silver')");
  assert.equal(e.run("exchangeResource('silverCoin','deed',199).reason"),'invalid-output');
  assert.equal(e.run("exchangeResource('silverCoin','deed',200).ok"),true);
  assert.equal(e.run('S.res.silverCoin'),0);
  assert.equal(e.run('S.res.deed'),31);
  assert.equal(e.run("dailyCount('market')"),0);
  assert.equal(saved(e).res.deed,31);
});

check('银两购契遇满仓或写档失败时不扣款、不虚报成功',()=>{
  const e=environment();
  e.run("S.sciences=['sci_copper','sci_silver'];S.buildings.market={lv:1,state:'idle'};S.res.silverCoin=200;S.res.deed=resCap('deed')");
  assert.equal(e.run("exchangeResource('silverCoin','deed',200).reason"),'capacity');
  assert.equal(e.run('S.res.silverCoin'),200);
  e.run("S.res.deed=30;save();localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  const original=e.store.get('rts_save');
  assert.equal(e.run("exchangeResource('silverCoin','deed',200).reason"),'save-failed');
  assert.equal(e.run('S.res.silverCoin'),200);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.store.get('rts_save'),original);
});

check('v8 原文迁移补银与银两0，不裁剪旧金币、工人和旧配方',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.coin=25000;S.population.current=10;S.popAlloc.coin=1;S.currencyRecipeMode='legacy';S.sciences=['sci_city','sci_coin'];const d=serializeSave();d.v=8;delete d.res.silver;delete d.res.silverCoin;delete d.popAlloc.silver;delete d.popAlloc.silverCoin;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.coin'),25000);
  assert.equal(e.run('S.popAlloc.coin'),1);
  assert.equal(e.run('S.currencyRecipeMode'),'legacy');
  assert.equal(e.run('S.res.silver'),0);
  assert.equal(e.run('S.res.silverCoin'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,35);
  e.run('S.res.tech=3200');
  assert.equal(e.run("researchScience('sci_silver').ok"),true);
  assert.equal(e.run("workerLockReason('silverCoin')"),'');
  const blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
  assert.equal(blocked.run('saveProtected()'),true);
});

check('v35 缺银字段、非法值与未来 v36 均保护原始主档',()=>{
  const seed=environment(),base=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
  [d=>delete d.res.silver,d=>{d.popAlloc.silverCoin=-1},d=>{d.v=36}].forEach((mutate,i)=>{
    const d=structuredClone(base);mutate(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),i===2?'future':'invalid');
    assert.equal(e.run('saveProtected()'),true);
    e.run('for(let j=0;j<61;j++)tick()');
    assert.equal(e.store.get('rts_save'),raw);
  });
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
