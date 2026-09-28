'use strict';
// 只用 VM 替身替换存储/时间；迁移、离线与保存均调用实际 math.js 实现。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const NOW=1700000000000;
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.stack)}}
function env(initial={}){
  const e=environment(initial);
  e.run(`const NativeDate=Date;let fakeNow=${NOW};Date=class extends NativeDate{static now(){return fakeNow}}`);
  return e;
}
function oldText({version=3,seconds=3600,pop=20,alloc=0,food=10,withTs=true}={}){
  const d=JSON.parse(env().run('JSON.stringify(serializeSave())'));
  d.v=version;d.ts=NOW-seconds*1000;d.townLv=2;d.tick=0;
  d.popAlloc={wood:alloc,stone:0,food:0,tech:0,copper:0,iron:0,coin:0};
  d.res.food=food;d.res.deed=0;d.pool={};d.queue={};
  delete d.offline.populationFoodRule;
  if(version<4){delete d.population;delete d.settlements}
  else{d.population={current:pop,growthClock:0,legacyBonus:0}}
  if(!withTs)delete d.ts;
  return JSON.stringify(d);
}
function result(e,expr){return JSON.parse(e.run('JSON.stringify('+expr+')'))}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8,`actual=${actual}, expected=${expected}`)}

test('v3 首次历史窗口按岗位口粮，第二窗口按实际人口且不重复',()=>{
  const raw=oldText(),e=env({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('popCurrent()'),20);assert.equal(e.run('popAllocTotal()'),0);
  assert.equal(e.run('S.offline.populationFoodRule'),'legacy-pending');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  const first=result(e,'settleOffline()');
  assert.equal(first.ok,true);assert.equal(first.durationSec,3600);
  assert.equal(first.gains.food,undefined);near(e.run('S.res.food'),10);
  assert.equal(e.run('S.offline.pendingReport.populationFoodRule'),'legacy');
  assert.equal(e.run('S.offline.populationFoodRule'),'all');
  assert.equal(JSON.parse(e.store.get('rts_save')).offline.populationFoodRule,'all');
  assert.equal(e.run('settleOffline().repeat'),true);
  e.run('fakeNow+=121000');
  const second=result(e,'settleOffline()');
  assert.equal(second.ok,true);assert.equal(second.durationSec,8);
  near(e.run('S.res.food'),0.4);
  assert.equal(e.run('S.offline.pendingReport.populationFoodRule'),'all');
});

test('无标记 v4 也须迁移，首次按 5 岗位、下一窗按 20 实际人口',()=>{
  const raw=oldText({version:4,seconds:120,alloc:5,food:300});
  const e=env({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('maxPop()'),4);assert.equal(e.run('popCurrent()'),20);
  assert.equal(result(e,'settleOffline()').durationSec,120);
  near(e.run('S.res.food'),264);
  e.run('fakeNow+=120000');
  assert.equal(result(e,'settleOffline()').durationSec,120);
  near(e.run('S.res.food'),120);
  assert.equal(e.run('popCurrent()'),20);assert.equal(e.run('maxPop()'),4);
});

test('不足 120 秒先写检查点，再允许在线 tick',()=>{
  const raw=oldText({version:4,seconds:119}),e=env({rts_save:raw});
  e.run('loadSaveAndApply()');
  const r=result(e,'settleOffline()');
  assert.equal(r.ok,false);assert.equal(r.reason,'below-min');assert.equal(r.checkpoint,true);
  assert.equal(e.run('_loadedTs'),NOW);
  assert.equal(e.run('S.offline.populationFoodRule'),'all');
  assert.equal(JSON.parse(e.store.get('rts_save')).offline.populationFoodRule,'all');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  near(e.run('S.res.food'),10);
  e.run('tick()');assert.equal(e.run('S.tick'),1);near(e.run('S.res.food'),8);
});

test('关闭离线与缺 ts 的旧档各自原子切换，不凭空追溯粮',()=>{
  for(const mode of['disabled','no-ts']){
    const raw=oldText({withTs:mode!=='no-ts'}),e=env({rts_save:raw});
    e.run('loadSaveAndApply()');
    if(mode==='disabled')e.run('CFG.offline.enabled=false');
    const r=result(e,'settleOffline()');
    assert.equal(r.reason,mode==='disabled'?'offline-disabled':'no-save-ts');
    assert.equal(r.checkpoint,true);assert.equal(e.run('_loadedTs'),NOW);
    assert.equal(e.run('S.offline.populationFoodRule'),'all');near(e.run('S.res.food'),10);
  }
});

test('普通 save 与 tick 早于显式 settle 时先结旧窗口，不能吞掉历史时段',()=>{
  const raw=oldText({seconds:121});
  const a=env({rts_save:raw});a.run('loadSaveAndApply()');
  a.run('let masterWrites=0;const realSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==="rts_save")masterWrites++;realSet(key,value)}');
  assert.equal(a.run('save().ok'),true);
  assert.equal(a.run('masterWrites'),1);
  assert.equal(a.run('S.offline.pendingReport.durationSec'),121);
  assert.equal(a.run('S.offline.pendingReport.populationFoodRule'),'legacy');
  near(a.run('S.res.food'),10);
  assert.equal(JSON.parse(a.store.get('rts_save')).offline.populationFoodRule,'all');
  const b=env({rts_save:raw});b.run('loadSaveAndApply();tick()');
  assert.equal(b.run('S.offline.pendingReport.durationSec'),121);
  assert.equal(b.run('S.tick'),122);
  near(b.run('S.res.food'),8);
});

test('待过渡标记优先于旧 ops 幂等键，仍完成历史窗口',()=>{
  const d=JSON.parse(oldText({version:4,seconds:121}));
  d.ops=[{key:'offline:'+d.ts,t:NOW}];
  const e=env({rts_save:JSON.stringify(d)});e.run('loadSaveAndApply()');
  const r=result(e,'settleOffline()');
  assert.equal(r.ok,true);assert.equal(r.durationSec,121);
  assert.equal(e.run('S.offline.populationFoodRule'),'all');
});

test('历史离线写主档失败保留 pending 和迁移前原文，保护后 tick 不推进，可重启重试',()=>{
  const raw=oldText({seconds:121}),e=env({rts_save:raw});e.run('loadSaveAndApply()');
  const migrated=e.store.get('rts_save'),loadedTs=e.run('_loadedTs');
  e.run('const realSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==="rts_save")throw Error("quota");realSet(key,value)}');
  const r=result(e,'settleOffline()');
  assert.equal(r.ok,false);assert.equal(r.reason,'save-failed');assert.equal(r.stage,'write');
  assert.equal(e.run('saveProtected()'),true);assert.equal(e.run('_loadedTs'),loadedTs);
  assert.equal(e.run('S.offline.populationFoodRule'),'legacy-pending');
  assert.equal(e.run('S.tick'),0);near(e.run('S.res.food'),10);
  e.run('tick()');assert.equal(e.run('S.tick'),0);near(e.run('S.res.food'),10);
  assert.equal(e.store.get('rts_save'),migrated);
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('exportMasterRawText()'),migrated);
  const retry=env(Object.fromEntries(e.store));retry.run('loadSaveAndApply()');
  assert.equal(result(retry,'settleOffline()').durationSec,121);
  assert.equal(retry.run('S.offline.populationFoodRule'),'all');
});

test('短窗口检查点备份失败时不切换、不推进、不覆盖主档',()=>{
  const raw=oldText({version:4,seconds:119}),e=env({rts_save:raw});e.run('loadSaveAndApply()');
  const migrated=e.store.get('rts_save');
  e.run('const realSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==="rts_save_backup_1")throw Error("quota");realSet(key,value)}');
  const r=result(e,'settleOffline()');
  assert.equal(r.ok,false);assert.equal(r.reason,'save-failed');assert.equal(r.stage,'backup');
  assert.equal(e.run('saveProtected()'),true);assert.equal(e.run('S.offline.populationFoodRule'),'legacy-pending');
  e.run('tick()');assert.equal(e.run('S.tick'),0);
  assert.equal(e.store.get('rts_save'),migrated);assert.equal(e.store.get('rts_save_premigration'),raw);
});

test('提前普通 save 遇到历史窗口备份失败时不做第二次写入',()=>{
  const raw=oldText({seconds:121}),e=env({rts_save:raw});e.run('loadSaveAndApply()');
  const migrated=e.store.get('rts_save');
  e.run('const realSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==="rts_save_backup_1")throw Error("quota");realSet(key,value)}');
  const r=result(e,'save()');
  assert.equal(r.ok,false);assert.equal(r.stage,'transition');
  assert.equal(e.run('saveProtected()'),true);assert.equal(e.run('S.offline.populationFoodRule'),'legacy-pending');
  assert.equal(e.store.get('rts_save'),migrated);assert.equal(e.store.get('rts_save_premigration'),raw);
});

test('导入和恢复旧档均携带待结算标记，重载后走相同历史结算',()=>{
  const raw=oldText({seconds:121});
  for(const kind of['import','restore']){
    const e=env();e.run('save()');
    if(kind==='restore')e.store.set('rts_save_backup_1',raw);
    const op=kind==='import'?'commitSaveData':'restoreBackupByText';
    assert.equal(e.run(`${op}(${JSON.stringify(raw)}).ok`),true);
    const candidate=JSON.parse(e.store.get('rts_save'));
    assert.equal(candidate.offline.populationFoodRule,'legacy-pending');
    const reloaded=env(Object.fromEntries(e.store));
    assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
    assert.equal(result(reloaded,'settleOffline()').durationSec,121);
    assert.equal(reloaded.run('S.offline.pendingReport.populationFoodRule'),'legacy');
    assert.equal(JSON.parse(reloaded.store.get('rts_save')).offline.populationFoodRule,'all');
  }
});

test('合法零值与历史超额人口不裁剪，未知标记保护原文',()=>{
  const clock=env();assert.equal(clock.run('offlineDeltaSec(1000,0).raw'),1);
  assert.equal(clock.run('offlineDeltaSec(0,0).delta'),0);
  const zero=oldText({version:4,seconds:121,pop:0,food:0});
  const a=env({rts_save:zero});a.run('loadSaveAndApply()');
  assert.equal(result(a,'settleOffline()').durationSec,121);
  assert.equal(a.run('S.population.current'),0);assert.equal(a.run('S.population.growthClock'),0);
  assert.equal(a.run('S.res.food'),0);assert.equal(a.run('S.res.deed'),0);
  const over=oldText({version:4,seconds:121,pop:45,food:10});
  const b=env({rts_save:over});b.run('loadSaveAndApply()');b.run('settleOffline()');
  assert.equal(b.run('popCurrent()'),45);assert.equal(b.run('maxPop()'),4);
  const d=JSON.parse(over);d.offline.populationFoodRule='unknown';const bad=JSON.stringify(d);
  const c=env({rts_save:bad});assert.equal(c.run('loadSaveAndApply().status'),'invalid');
  assert.equal(c.run('saveProtected()'),true);assert.equal(c.store.get('rts_save'),bad);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
