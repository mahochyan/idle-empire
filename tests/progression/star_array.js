'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const oldPaid=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p386-300m-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}

check('两笔研究各自验证前置、扣费一次并重载',()=>{
  const e=environment();
  assert.equal(e.run("researchScience('sci_star_beast_domain').reason"),'science-prerequisite');
  e.run("S.sciences=['sci_nuclear_age'];S.res.tech=500000000;S.res.medal=3000000");
  assert.equal(e.run("researchScience('sci_star_array').reason"),'science-prerequisite');
  assert.equal(e.run("researchScience('sci_star_beast_domain').ok"),true);
  assert.equal(e.run('S.res.tech'),300000000);
  assert.equal(e.run('S.res.medal'),2000000);
  assert.equal(e.run("researchScience('sci_star_array').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  e.run("researchScience('sci_star_array')");
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run("S.sciences.filter(id=>id==='sci_star_array').length"),1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("scienceUnlocked('sci_star_array')"),true);
});

check('P386 实付 v32 原档在独立候选迁移，原文受保护且旧进度不变',()=>{
  const before=JSON.parse(oldPaid),e=environment({rts_save:oldPaid});
  assert.equal(before.v,32);
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),oldPaid);
  const migrated=JSON.parse(e.store.get('rts_save'));
  assert.equal(migrated.v,35);
  assert.equal(migrated.res.tech,before.res.tech);
  assert.equal(migrated.res.medal,before.res.medal);
  assert.deepEqual(migrated.defeated,before.defeated);
  assert.deepEqual(migrated.awakening,before.awakening);
  for(const key of ['starOriginStone','illusionStone','sacredRingCore'])assert.equal(migrated.items[key],0);
  assert.equal(migrated.starArray.star_trooper.slots.length,20);
  assert.equal(migrated.starArray.star_trooper.slots.every(slot=>slot.open===false&&slot.type==='unbound'&&slot.level===1&&slot.refreshCount===0),true);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("resCap('tech')"),e.run("resCap('tech')"));
});

check('开槽、刻印、升级逐项真扣材料；重复请求与旧按钮不二次扣费',()=>{
  const e=environment();
  assert.equal(e.run('openStarArraySlot(0).reason'),'science-prerequisite');
  e.run("S.sciences=['sci_star_array'];S.items.sacredRingCore=3000;S.items.illusionStone=100;S.items.starOriginStone=20");
  assert.equal(e.run('openStarArraySlot(1).reason'),'not-next-slot');
  assert.equal(e.run('openStarArraySlot(0).ok'),true);
  assert.equal(e.run('S.items.sacredRingCore'),2000);
  assert.equal(e.run('openStarArraySlot(0).reason'),'already-open');
  assert.equal(e.run('attuneStarArrayKnowledgeSlot(0).ok'),true);
  assert.equal(e.run('S.items.illusionStone'),0);
  assert.equal(e.run('attuneStarArrayKnowledgeSlot(0).reason'),'already-attuned');
  assert.equal(e.run('upgradeStarArraySlot(0,1).ok'),true);
  assert.equal(e.run('S.items.starOriginStone'),0);
  assert.equal(e.run('upgradeStarArraySlot(0,1).reason'),'stale-level');
  assert.equal(e.run('S.starArray.star_trooper.slots[0].level'),2);
  assert.equal(e.run('S.starArray.star_trooper.slots[0].refreshCount'),1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.starArray.star_trooper.slots[0].level'),2);
  assert.equal(reload.run('S.items.sacredRingCore'),2000);
});

check('觉醒 20 阶 50 星前不预支容量，星阵乘区在图纸之前',()=>{
  const e=environment();
  e.run("S.sciences=['sci_star_array'];S.starArray.star_trooper.slots[0]={open:true,type:'knowledgeCap',level:10,refreshCount:1};S.eraStorage.steamKnowledge=1;S.beastExchange.scrollUsed=130");
  const before=e.run("resCap('tech')");
  assert.equal(e.run('starArrayKnowledgePercent()'),0);
  e.run("S.awakening.star_trooper={level:20,stars:50,tracks:{easy:20,perfect:0,extreme:0}}");
  assert.equal(e.run('starArrayKnowledgePercent()'),24);
  const cap=e.run("resCap('tech')");
  const preScroll=e.run("(()=>{const used=S.beastExchange.scrollUsed;S.beastExchange.scrollUsed=0;const n=resCap('tech');S.beastExchange.scrollUsed=used;return n})()");
  assert.equal(cap,Math.floor(preScroll*2.3));
  assert.ok(cap>before);
  e.run(`S.res.tech=${cap+1000};S.awakening.star_trooper.stars=49`);
  assert.equal(e.run('starArrayKnowledgePercent()'),0);
  assert.equal(e.run('productionSecond().tech'),cap+1000);
  assert.equal(e.run('S.res.tech'),cap+1000);
});

check('写档或迁移备份失败时材料、槽位与旧主档保持原样',()=>{
  const blocked=environment({rts_save:oldPaid});
  blocked.run("const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');originalSet(k,v)}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),oldPaid);
  const e=environment();
  e.run("S.sciences=['sci_star_array'];S.items.sacredRingCore=1000;save()");
  const stable=e.store.get('rts_save');
  e.run("const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalSet(k,v)}");
  assert.equal(e.run('openStarArraySlot(0).reason'),'save-failed');
  assert.equal(e.run('S.items.sacredRingCore'),1000);
  assert.equal(e.run('S.starArray.star_trooper.slots[0].open'),false);
  assert.equal(e.store.get('rts_save'),stable);
  const backup=environment({rts_save:stable});
  assert.equal(backup.run('loadSaveAndApply().status'),'ok');
  backup.run("const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_backup_1')throw Error('quota');originalSet(k,v)}");
  assert.equal(backup.run('openStarArraySlot(0).reason'),'save-failed');
  assert.equal(backup.run('S.items.sacredRingCore'),1000);
  assert.equal(backup.run('S.starArray.star_trooper.slots[0].open'),false);
  assert.equal(backup.store.get('rts_save'),stable);
});

check('运行时槽位或材料被篡改时动作拒绝且不扣费、不写坏档',()=>{
  const e=environment();
  e.run("S.sciences=['sci_star_array'];S.items.sacredRingCore=1000;S.items.starOriginStone=100;save()");
  const stable=e.store.get('rts_save');
  e.run('S.starArray.star_trooper.slots[0].level=NaN');
  assert.equal(e.run("starArraySlotCost('open',0)"),null);
  assert.equal(e.run('openStarArraySlot(0).reason'),'invalid-state');
  assert.equal(e.run('S.items.sacredRingCore'),1000);
  assert.equal(e.store.get('rts_save'),stable);
  e.run('S.starArray=defaultStarArrayState();S.starArray.star_trooper.slots[1]=null');
  assert.equal(e.run('openStarArraySlot(0).reason'),'invalid-state');
  e.run("S.starArray=defaultStarArrayState();S.starArray.star_trooper.slots[0]={open:true,type:'knowledgeCap',level:-1,refreshCount:1}");
  assert.equal(e.run('upgradeStarArraySlot(0).reason'),'invalid-state');
  assert.equal(e.run('S.items.starOriginStone'),100);
  e.run("S.starArray=defaultStarArrayState();S.starArray.star_trooper.slots[0]={open:true,type:'knowledgeCap',level:1,refreshCount:1};S.items.starOriginStone=Infinity");
  assert.equal(e.run('upgradeStarArraySlot(0).reason'),'insufficient-items');
  assert.equal(e.run('S.starArray.star_trooper.slots[0].level'),1);
  assert.equal(e.store.get('rts_save'),stable);
});

check('损坏星阵字段、负数星石及未来档一律保护主档',()=>{
  const e=environment();e.run('save()');
  const base=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>delete d.starArray,d=>{d.starArray.star_trooper.slots[0].level=0},d=>{d.items.starOriginStone=-1},d=>{d.v=36}]){
    const d=JSON.parse(JSON.stringify(base));mutate(d);
    const raw=JSON.stringify(d),bad=environment({rts_save:raw});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===36?'future':'invalid');
    bad.run('tick();save()');
    assert.equal(bad.store.get('rts_save'),raw);
  }
});
console.log(`star array: ${passed}/7`);
