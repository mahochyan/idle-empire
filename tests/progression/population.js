'use strict';
// 聚落与人口回归：用真实 config/math 状态机、存档和动作入口；DOM/存储仅用 VM 替身。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.stack)}}
function oldText(version,alter=''){
  const e=environment();
  return e.run(`(()=>{const d=serializeSave();d.v=${version};delete d.settlements;delete d.population;delete d.metalRecipeMode;delete d.storageMode;delete d.res.coal;delete d.popAlloc.coal;${alter};return JSON.stringify(d)})()`);
}

test('新档实际人口0、容量4、30地契，v32与合法0重载',()=>{
  const e=environment();
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.run('maxPop()'),4);
  assert.equal(e.run('popAllocTotal()'),0);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.res.food'),300);
  1332;
  assert.equal(e.run('save().ok'),true);
  const r=environment(Object.fromEntries(e.store));
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('popCurrent()'),0);
  assert.equal(r.run('S.population.growthClock'),0);
  assert.equal(r.run('maxPop()'),4);
  assert.equal(r.run('S.res.deed'),30);
});

test('在线十秒加2，断粮暂停；扩容后不追溯补人',()=>{
  const e=environment();
  e.run('for(let i=0;i<9;i++)tick()');
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.run('S.population.growthClock'),9);
  e.run('S.res.food=0;for(let i=0;i<20;i++)tick()');
  assert.equal(e.run('S.population.growthClock'),9);
  assert.equal(e.run('popCurrent()'),0);
  e.run('S.res.food=300;tick();for(let i=0;i<10;i++)tick()');
  assert.equal(e.run('popCurrent()'),4);
  assert.equal(e.run('upgradeSettlement("village",0).ok'),true);
  assert.equal(e.run('maxPop()'),5);
  assert.equal(e.run('popCurrent()'),4);
  e.run('for(let i=0;i<10;i++)tick()');
  assert.equal(e.run('popCurrent()'),5);
});

test('满十秒生人立即写档，不等60秒定期保存',()=>{
  const e=environment();
  e.run('for(let i=0;i<10;i++)tick()');
  assert.equal(e.run('popCurrent()'),2);
  assert.equal(JSON.parse(e.store.get('rts_save')).population.current,2);
});

test('村庄费用5、6递增；旧按钮重复调用不二次扣费',()=>{
  const e=environment();
  assert.equal(e.run('settlementCost("village")'),5);
  assert.equal(e.run('upgradeSettlement("village",0).ok'),true);
  assert.equal(e.run('S.res.deed'),25);
  assert.equal(e.run('upgradeSettlement("village",0).ok'),false);
  assert.equal(e.run('S.res.deed'),25);
  assert.equal(e.run('settlementCost("village")'),6);
  assert.equal(e.run('upgradeSettlement("village",1).ok'),true);
  assert.equal(e.run('S.res.deed'),19);
  assert.equal(e.run('maxPop()'),6);
});

test('小镇和城市动作门检查对应发展科技，研究后可扩容',()=>{
  const e=environment();
  assert.match(e.run('settlementLockReason("smallTown")'),/城镇化/);
  assert.match(e.run('settlementLockReason("city")'),/城市化/);
  assert.equal(e.run('upgradeSettlement("city",1).ok'),false);
  e.run('S.sciences=["sci_prospect","sci_copper","sci_metal"];S.res.tech=1400');
  assert.equal(e.run('researchScience("sci_urbanization").ok'),true);
  assert.equal(e.run('upgradeSettlement("smallTown",0).ok'),true);
  assert.equal(e.run('maxPop()'),6);
  e.run('S.sciences.push("sci_iron");S.res.tech=2200;S.res.deed=40');
  assert.equal(e.run('researchScience("sci_city").ok'),true);
  assert.equal(e.run('settlementCost("city")'),36);
  assert.equal(e.run('upgradeSettlement("city",1).ok'),true);
  assert.equal(e.run('maxPop()'),10);
});

test('聚落等级、实际人口与十秒进度重启后保持',()=>{
  const e=environment();e.run('upgradeSettlement("village",0);for(let i=0;i<15;i++)tick();save()');
  const r=environment(Object.fromEntries(e.store));
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('S.settlements.village'),1);
  assert.equal(r.run('popCurrent()'),2);
  assert.equal(r.run('S.population.growthClock'),5);
  r.run('for(let i=0;i<5;i++)tick()');
  assert.equal(r.run('popCurrent()'),4);
});

test('v3迁移人口至少旧容量，也保留已分配、地契和原文',()=>{
  const text=oldText(3,'d.tick=0;d.townLv=2;d.popAlloc={wood:9,stone:4,food:0};d.res.deed=7');
  const e=environment({rts_save:text});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('popCurrent()'),20);
  assert.equal(e.run('maxPop()'),20);
  assert.equal(e.run('S.res.deed'),7);
  1332;
  assert.equal(e.store.get('rts_save_premigration'),text);
});

test('v3历史超额分配高于旧容量时不裁剪实际人口',()=>{
  const text=oldText(3,'d.tick=0;d.townLv=1;d.popAlloc={wood:20,stone:0,food:0}');
  const e=environment({rts_save:text});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('popCurrent()'),20);
  assert.equal(e.run('maxPop()'),20);
  assert.equal(e.run('popAllocTotal()'),20);
});

test('v2及更早旧档迁移把原城镇容量作为人口，不缩水',()=>{
  const text=oldText(2,'d.tick=0;d.popAlloc={wood:0,stone:0,food:0};d.res.deed=0');
  const e=environment({rts_save:text});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('popCurrent()'),10);
  assert.equal(e.run('maxPop()'),10);
  assert.equal(e.run('S.res.deed'),0);
});

test('已付款的旧城镇升级完成后仍获得旧容量，离线完成亦然',()=>{
  const text=oldText(3,'d.tick=0;d.townUpgrade={timer:2,timerEnd:2}');
  const e=environment({rts_save:text});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('townCanUpgrade()'),false);
  assert.equal(e.run('upgradeTown().ok'),false);
  e.run('offlineAdvanceSec(2,0.6)');
  assert.equal(e.run('S.townLv'),2);
  assert.ok(e.run('maxPop()')>=20);
});

test('离线推进tick与资源，但不推进实际人口或增长钟',()=>{
  const e=environment();
  e.run('for(let i=0;i<7;i++)tick()');
  const before=e.run('JSON.stringify(S.population)');
  e.run('offlineAdvanceSec(121,0.6)');
  assert.equal(e.run('JSON.stringify(S.population)'),before);
  assert.ok(e.run('S.tick')>=128);
});

test('损坏v32拒载并禁止自动保存，不把合法0当缺失',()=>{
  const e=environment();
  const bad=e.run('(()=>{const d=serializeSave();d.population.growthClock=10;return JSON.stringify(d)})()');
  const r=environment({rts_save:bad});
  assert.equal(r.run('loadSaveAndApply().status'),'invalid');
  assert.equal(r.run('saveProtected()'),true);
  assert.equal(r.run('save().ok'),false);
  assert.equal(r.store.get('rts_save'),bad);
  assert.equal(r.run('popCurrent()'),0);
});

test('导入提交入口重新校验，不接受绕过预览的坏 v32',()=>{
  const e=environment();e.run('save()');
  const before=e.store.get('rts_save');
  const bad=e.run('(()=>{const d=serializeSave();d.population.current=-1;return JSON.stringify(d)})()');
  const result=e.run('commitSaveData('+JSON.stringify(bad)+')');
  assert.equal(result.ok,false);
  assert.equal(e.store.get('rts_save'),before);
});

test('迁移备份失败时内存不应用候选，原始主档不覆盖',()=>{
  const raw=oldText(3,'d.townLv=2;d.popAlloc={wood:5,stone:0,food:0}');
  const e=environment({rts_save:raw});
  e.run('localStorage.setItem=(k,v)=>{if(k==="rts_save_backup_1")throw Error("full");globalThis.__saved=(globalThis.__saved||[]).concat(k)}');
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.run('S.townLv'),1);
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

test('迁移前原文副本写入失败时，不应用新状态也不覆盖主档',()=>{
  const raw=oldText(3,'d.townLv=2');
  const e=environment({rts_save:raw});
  e.run('localStorage.setItem=(k,v)=>{if(k==="rts_save_premigration")throw Error("full")}');
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.run('saveProtected()'),true);
  assert.equal(e.run('S.townLv'),1);
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

test('关闭旧地契玩法开关仍保存 v32 地契字段',()=>{
  const e=environment();
  e.run('CFG.townGate.useDeed=false;save()');
  assert.equal(JSON.parse(e.store.get('rts_save')).res.deed,30);
  const r=environment(Object.fromEntries(e.store));
  assert.equal(r.run('loadSaveAndApply().status'),'ok');
  assert.equal(r.run('S.res.deed'),30);
});

test('导入预览与备份摘要显示真实人口和三类聚落容量',()=>{
  const e=environment();e.run('upgradeSettlement("village",0);for(let i=0;i<10;i++)tick();save()');
  const preview=JSON.parse(e.run('JSON.stringify(inspectSaveText(exportCurrentSaveText()).summary)'));
  assert.equal(preview.population,2);
  assert.equal(preview.capacity,5);
  assert.equal(preview.settlements.village,1);
  const backup=JSON.parse(e.run('JSON.stringify(backupSlotSummaries()[0].summary)'));
  assert.equal(backup.capacity,5);
  assert.equal(backup.settlements.city,1);
});

test('轮转备份槽读取失败时阻止扩容与主档覆盖',()=>{
  const e=environment();e.run('save()');
  const before=e.store.get('rts_save');
  e.run('const get0=localStorage.getItem;localStorage.getItem=k=>{if(k==="rts_save_backup_1")throw Error("unreadable");return get0(k)}');
  assert.equal(e.run('upgradeSettlement("village",0).ok'),false);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.settlements.village'),0);
  assert.equal(e.store.get('rts_save'),before);
});

test('扩容写档失败回滚地契与级数；保护状态不扣费',()=>{
  const e=environment();
  e.run('localStorage.setItem=()=>{throw Error("full")}');
  assert.equal(e.run('upgradeSettlement("village",0).ok'),false);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.settlements.village'),0);
  e.run('enterProtection("test")');
  assert.equal(e.run('upgradeSettlement("village",0).ok'),false);
  assert.equal(e.run('S.res.deed'),30);
});

console.log(`${passed} passed / ${failed} failed`);
process.exitCode=failed?1:0;
