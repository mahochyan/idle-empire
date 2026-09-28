'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+': '+e.stack)}}
const j=(e,expr)=>JSON.parse(e.run('JSON.stringify('+expr+')'));
const state=e=>j(e,'S.development');
const zeroWorkers="S.popAlloc=Object.fromEntries(Object.keys(S.popAlloc).map(k=>[k,0]));S.population.current=0;S.res.food=1000;S.res.copper=0;S.res.iron=0";

test('新档 v32 零状态保存重载，v31 原文迁移并保护副本',()=>{
  const seed=environment();
  assert.equal(seed.run('serializeSave().v'),32);
  assert.deepEqual(state(seed).border.collection,{activeSite:null,elapsedSec:0});
  seed.run('S.res.copper=117;S.defeated=[1];save()');
  const fresh=environment({rts_save:seed.store.get('rts_save')});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok');
  assert.equal(fresh.run('S.res.copper'),117);
  assert.deepEqual(state(fresh),state(seed));
  const old=JSON.parse(seed.store.get('rts_save'));old.v=31;delete old.development;
  const raw=JSON.stringify(old),migrated=environment({rts_save:raw});
  assert.equal(migrated.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migrated.store.get('rts_save_premigration'),raw);
  assert.equal(JSON.parse(migrated.store.get('rts_save')).v,32);
  assert.equal(migrated.run('S.res.copper'),117);
  assert.deepEqual(state(migrated),state(seed));
});

test('v32 严格校验点位和区域，合法 0、500 级与已得点位往返',()=>{
  const e=environment();e.run('S.development.border.sites.copper.level=500;S.development.border.sites.copper.wins=502;S.development.outer.village.wins=0;S.development.border.collection.activeSite="copper";S.development.border.collection.elapsedSec=59;save()');
  const raw=e.store.get('rts_save'),reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.development.border.sites.copper.level'),500);
  assert.equal(reload.run('S.development.border.collection.elapsedSec'),59);
  assert.equal(reload.run('S.development.outer.village.wins'),0);
  for(const mutate of [
    d=>{d.development.border.sites.silver={level:1,wins:1}},
    d=>{d.development.border.sites.copper.level=501},
    d=>{d.development.border.sites.copper.level=-1},
    d=>{d.development.border.collection.activeSite='silver'},
    d=>{d.development.border.collection.elapsedSec=-1},
    d=>{d.development.border.collection.elapsedSec=60},
    d=>{d.development.border.collection.activeSite=null;d.development.border.collection.elapsedSec=1},
    d=>{d.development.outer.capital.alert='bad'},
    d=>{delete d.development.outer.town},
    d=>{d.development.border.collection.pending={copper:1}},
    d=>{delete d.development}
  ]){
    const d=JSON.parse(raw);mutate(d);
    const bad=environment({rts_save:JSON.stringify(d)});
    assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
    bad.run('tick();save()');
    assert.equal(bad.store.get('rts_save'),JSON.stringify(d));
  }
  const future=JSON.parse(raw);future.v=33;
  const badFuture=environment({rts_save:JSON.stringify(future)});
  assert.equal(badFuture.run('loadSaveAndApply().status'),'future');
  badFuture.run('tick();save()');
  assert.equal(badFuture.store.get('rts_save'),JSON.stringify(future));
  const nan=JSON.parse(raw);nan.development.border.collection.elapsedSec=null;
  assert.equal(environment({rts_save:JSON.stringify(nan)}).run('loadSaveAndApply().status'),'invalid');
});

test('迁移保护副本、备份、主档写失败均不应用候选状态',()=>{
  const seed=environment();seed.run('S.res.wood=777;save()');
  const d=JSON.parse(seed.store.get('rts_save'));d.v=31;delete d.development;
  const raw=JSON.stringify(d);
  for(const key of ['rts_save_premigration','rts_save_backup_1','rts_save']){
    const e=environment({rts_save:raw});
    e.run('const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="'+key+'")throw Error("quota");oldSet(k,v)}');
    assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
    assert.equal(e.run('saveProtected()'),true);
    assert.equal(e.store.get('rts_save'),raw);
    assert.equal(e.run('S.res.wood'),300);
    assert.deepEqual(state(e),state(environment()));
  }
});

test('导入 v31 升 v32 后才加载；坏点位或未来版导入不改主档/S',()=>{
  const e=environment();e.run('save()');
  const current=e.store.get('rts_save'),before=state(e);
  const bad=JSON.parse(current);bad.development.border.sites.silver={level:1,wins:0};
  assert.equal(e.run('commitSaveData('+JSON.stringify(JSON.stringify(bad))+').ok'),false);
  const future=JSON.parse(current);future.v=33;
  assert.equal(e.run('commitSaveData('+JSON.stringify(JSON.stringify(future))+').ok'),false);
  assert.equal(e.store.get('rts_save'),current);assert.deepEqual(state(e),before);
  const old=JSON.parse(current);old.v=31;delete old.development;old.res.wood=543;
  assert.equal(e.run('commitSaveData('+JSON.stringify(JSON.stringify(old))+').ok'),true);
  assert.equal(e.run('S.res.wood'),300,'导入确认后内存 S 尚未重载');
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
  assert.equal(e.run('loadSaveAndApply().status'),'ok');
  assert.equal(e.run('S.res.wood'),543);
  assert.deepEqual(state(e),before);
});

test('点位动作只选已拥有的一处，停用与重选无重复写入',()=>{
  const e=environment();e.run(zeroWorkers);
  assert.equal(e.run('selectDevelopmentSite("copper").reason'),'site-locked');
  assert.equal(e.run('selectDevelopmentSite("silver").reason'),'unknown-site');
  e.run('S.development.border.sites.copper.level=2;S.development.border.sites.iron.level=1;save()');
  assert.equal(e.run('selectDevelopmentSite("copper").ok'),true);
  e.run('for(let i=0;i<37;i++)tick()');
  assert.equal(e.run('S.development.border.collection.elapsedSec'),37);
  assert.equal(e.run('selectDevelopmentSite("iron").ok'),true);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  assert.equal(e.run('S.development.border.collection.activeSite'),'iron');
  assert.equal(e.run('selectDevelopmentSite("iron").unchanged'),true);
  assert.equal(e.run('selectDevelopmentSite(null).ok'),true);
  assert.equal(e.run('S.development.border.collection.activeSite'),null);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});reload.run('loadSaveAndApply()');
  assert.deepEqual(state(reload),state(e));
});

test('激活动作保存失败回滚，战斗忙碌与保护态拒绝',()=>{
  const e=environment();e.run('S.development.border.sites.copper.level=1;save()');
  e.run('S.battleActive=true');assert.equal(e.run('selectDevelopmentSite("copper").reason'),'busy');e.run('S.battleActive=false');
  const before=state(e),raw=e.store.get('rts_save');
  e.run('const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")throw Error("quota");oldSet(k,v)}');
  assert.equal(e.run('selectDevelopmentSite("copper").reason'),'save-failed');
  assert.deepEqual(state(e),before);assert.equal(e.store.get('rts_save'),raw);
  e.run('enterProtection("test")');assert.equal(e.run('selectDevelopmentSite("copper").reason'),'save-protected');
  const backup=environment();backup.run('S.development.border.sites.iron.level=1;save()');
  const backupBefore=state(backup),backupRaw=backup.store.get('rts_save');
  backup.run('const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save_backup_1")throw Error("quota");oldSet(k,v)}');
  assert.equal(backup.run('selectDevelopmentSite("iron").reason'),'save-failed');
  assert.deepEqual(state(backup),backupBefore);assert.equal(backup.store.get('rts_save'),backupRaw);
});

test('在线只为唯一激活点每 60 秒采集，不扣铜铁岗位原料',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=2;S.development.border.sites.iron.level=3;selectDevelopmentSite("copper")');
  e.run('for(let i=0;i<59;i++)tick()');
  assert.equal(e.run('S.res.copper'),0);assert.equal(e.run('S.res.iron'),0);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),59);
  const stone=e.run('S.res.stone'),coal=e.run('S.res.coal');
  e.run('tick()');
  assert.equal(e.run('S.res.copper'),4);assert.equal(e.run('S.res.iron'),0);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  assert.equal(e.run('S.res.stone'),stone);assert.equal(e.run('S.res.coal'),coal);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.res.copper,4);assert.equal(saved.development.border.collection.elapsedSec,0);
  e.run('selectDevelopmentSite("iron");for(let i=0;i<60;i++)tick()');
  assert.equal(e.run('S.res.iron'),3);assert.equal(e.run('S.res.copper'),4);
});

test('默认未激活的旧档不改变原有在线铜铁产出',()=>{
  const e=environment();e.run(zeroWorkers+';S.res.copper=13;S.res.iron=7;for(let i=0;i<120;i++)tick()');
  assert.equal(e.run('S.res.copper'),13);assert.equal(e.run('S.res.iron'),7);
  assert.equal(e.run('S.development.border.collection.activeSite'),null);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
});

test('满仓和历史超仓不裁剪，采集周期到点仍归零',()=>{
  for(const extra of [0,7]){
    const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=2;S.res.copper=resCap("copper")+'+extra+';selectDevelopmentSite("copper");for(let i=0;i<60;i++)tick()');
    assert.equal(e.run('S.res.copper'),e.run('resCap("copper")+'+extra));
    assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  }
});

test('在线周期落盘失败撤回点位本次入仓与时钟，主档原文不变',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=1;selectDevelopmentSite("copper");for(let i=0;i<59;i++)tick();save()');
  const raw=e.store.get('rts_save'),before=state(e);
  e.run('const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")throw Error("quota");oldSet(k,v)};tick()');
  assert.equal(e.run('S.res.copper'),0);
  assert.deepEqual(state(e),before);assert.equal(e.store.get('rts_save'),raw);
});

test('离线逐秒推进唯一点位的60秒时钟，点位收益按现有0.6系数计',()=>{
  const setup=zeroWorkers+';S.development.border.sites.copper.level=2;S.development.border.sites.iron.level=3;selectDevelopmentSite("copper");for(let i=0;i<30;i++)tick();save()';
  const direct=environment(),settled=environment(),online=environment();
  for(const e of [direct,settled,online])e.run(setup);
  const result=j(direct,'offlineAdvanceSec(121,0.6)');
  assert.equal(result.elapsed,121);
  assert.ok(Math.abs(direct.run('S.res.copper')-4.8)<1e-9);
  assert.equal(direct.run('S.res.iron'),0);
  assert.equal(direct.run('S.development.border.collection.elapsedSec'),31);
  online.run('for(let i=0;i<121;i++)tick()');
  assert.equal(online.run('S.res.copper'),8);
  assert.equal(online.run('S.development.border.collection.elapsedSec'),31);
  settled.run('_loadedTs=Date.now()-121000');
  const receipt=j(settled,'settleOffline()');
  assert.equal(receipt.ok,true);assert.equal(receipt.durationSec,121);
  assert.ok(Math.abs(receipt.gains.copper-4.8)<1e-9);
  assert.ok(Math.abs(settled.run('S.res.copper')-4.8)<1e-9);
  assert.equal(settled.run('S.development.border.collection.elapsedSec'),31);
  assert.equal(settled.run('settleOffline().repeat'),true);
  assert.ok(Math.abs(settled.run('S.res.copper')-4.8)<1e-9);
  const reload=environment({rts_save:settled.store.get('rts_save')});reload.run('loadSaveAndApply()');
  assert.deepEqual(state(reload),state(settled));
  assert.ok(Math.abs(reload.run('S.res.copper')-4.8)<1e-9);
});

test('离线点位到点受仓容限制，历史超仓不裁剪',()=>{
  for(const extra of [0,7]){
    const e=environment();e.run(zeroWorkers+';S.development.border.sites.iron.level=3;S.res.iron=resCap("iron")+'+extra+';selectDevelopmentSite("iron");for(let i=0;i<59;i++)tick()');
    const cap=e.run('resCap("iron")');
    assert.equal(j(e,'offlineAdvanceSec(121,0.6)').elapsed,121);
    assert.equal(e.run('S.res.iron'),cap+extra);
    assert.equal(e.run('S.res.copper'),0);
    assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  }
});

test('离线断粮未计入的一秒不推进点钟或发点位金属',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=2;selectDevelopmentSite("copper");for(let i=0;i<59;i++)tick();S.population.current=1;S.res.food=0');
  const before=state(e);
  const result=j(e,'offlineAdvanceSec(121,0.6)');
  assert.equal(result.elapsed,0);assert.equal(result.foodClamped,true);
  assert.deepEqual(state(e),before);
  assert.equal(e.run('S.res.copper'),0);
});

test('离线写入失败还原包含采集点状态的整份 S',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.iron.level=1;selectDevelopmentSite("iron");for(let i=0;i<12;i++)tick();save();_loadedTs=Date.now()-121000');
  const before=state(e),raw=e.store.get('rts_save');
  e.run('const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")throw Error("quota");oldSet(k,v)}');
  assert.equal(e.run('settleOffline().reason'),'save-failed');
  assert.deepEqual(state(e),before);assert.equal(e.run('S.res.iron'),0);assert.equal(e.store.get('rts_save'),raw);
});

test('活跃战斗时在线 tick 不推进点位时钟',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=1;selectDevelopmentSite("copper");S.battleActive=true;for(let i=0;i<60;i++)tick()');
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  assert.equal(e.run('S.res.copper'),0);
});

test('同页战斗活跃时离线窗口仍暂停点位时钟，战后才从原秒数继续',()=>{
  const e=environment();e.run(zeroWorkers+';S.development.border.sites.copper.level=2;selectDevelopmentSite("copper");for(let i=0;i<59;i++)tick();S.battleActive=true');
  assert.equal(j(e,'offlineAdvanceSec(121,0.6)').elapsed,121);
  assert.equal(e.run('S.development.border.collection.elapsedSec'),59);
  assert.equal(e.run('S.res.copper'),0);
  e.run('S.battleActive=false;offlineAdvanceSec(1,0.6)');
  assert.equal(e.run('S.development.border.collection.elapsedSec'),0);
  assert.ok(Math.abs(e.run('S.res.copper')-2.4)<1e-9);
});

console.log(`${pass} passed / ${fail} failed`);process.exitCode=fail?1:0;
