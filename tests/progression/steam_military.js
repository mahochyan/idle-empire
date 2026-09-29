'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const paid=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p390-star-array-entry-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}

check('P390 v33 实付档迁移后六秒知识产出能支付蒸汽军制，原文仍可恢复',()=>{
  const e=environment({rts_save:paid});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),paid);
  assert.equal(e.run('S.steamMilitaryStars'),0);
  assert.equal(e.run("researchScience('sci_steam_military').reason"),'insufficient-tech');
  e.run('for(let i=0;i<6;i++)tick()');
  const before=e.run('S.res.tech');
  assert.ok(before>=150000);
  assert.equal(e.run("researchScience('sci_steam_military').ok"),true);
  assert.equal(e.run('S.res.tech'),before-150000);
  assert.equal(e.run("researchScience('sci_steam_military').repeat"),true);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,33);
  assert.equal(saved.steamMilitaryStars,0);
  assert.equal(saved.sciences.filter(id=>id==='sci_steam_military').length,1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.tech'),before-150000);
});

check('源端递增规模损失与实付阵容形成升星门，退星保留已训练兵',()=>{
  const e=environment({rts_save:paid});e.run('loadSaveAndApply()');
  e.run('for(let i=0;i<6;i++)tick()');
  assert.equal(e.run("researchScience('sci_steam_military').ok"),true);
  const soldiers=e.run('totalSoldiers()');
  assert.equal(e.run('steamMilitaryBaseFieldSize()'),1007);
  assert.equal(e.run('steamMilitaryFieldLoss(5)'),250);
  assert.equal(e.run('steamMilitaryFieldLoss(10)'),750);
  assert.equal(e.run('steamMilitaryFieldLoss(50)'),13750);
  for(let i=0;i<6;i++)assert.equal(e.run('steamMilitaryStarStep(1).ok'),true);
  assert.equal(e.run('S.steamMilitaryStars'),6);
  assert.equal(e.run('steamMilitaryFieldSize()'),657);
  assert.equal(e.run('steamMilitaryStarStep(1).reason'),'formation-too-large');
  e.run("rmForm('expedition','back',3)");
  assert.equal(e.run('steamMilitaryStarStep(1).ok'),true);
  const beforeRejected=e.run('totalSoldiers()');
  e.run("formModalTarget={which:'expedition',row:'back',idx:3};S._formModalSel='archer';S._formModalQty=13;confirmForm()");
  assert.equal(e.run('formSoldierCount()'),545);
  assert.equal(e.run('S.pool.archer'),55);
  assert.equal(e.run('totalSoldiers()'),beforeRejected);
  assert.equal(e.run('totalSoldiers()'),soldiers);
  assert.equal(e.run('steamMilitaryStarStep(-1).ok'),true);
  assert.equal(e.run('S.steamMilitaryStars'),6);
  assert.equal(e.run('totalSoldiers()'),soldiers);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.steamMilitaryStars'),6);
  assert.equal(reload.run('totalSoldiers()'),soldiers);
});

check('出征与驻军使用相同的开场攻击及逐兵生命乘区，幸存人数不凭空增加',()=>{
  const e=environment({rts_save:paid});e.run('loadSaveAndApply()');
  e.run('for(let i=0;i<6;i++)tick()');e.run("researchScience('sci_steam_military')");
  const baseline=e.run("(()=>{const u=S.formation.front[0];return{atk:weaponAttack(u.type),hp:battleVitals(u.type,u.count,true).hp,per:battleVitals(u.type,u.count,true).hpPerSoldier,count:u.count}})()");
  e.run('for(let i=0;i<6;i++)steamMilitaryStarStep(1)');
  const result=e.run("(()=>{S.battleEncounter=null;S.selEnemy=0;B.isTraining=false;initBattleState();const exp=B.ourUnits.find(u=>u.originRow==='front');S._garrisonForm.front=[{...S.formation.front[0]}];const gar=buildGarrisonUnitsFromForm()[0];return{exp:{atk:exp.atk,hp:exp.hp,per:exp.hpPerSoldier,survivors:combatSurvivors(exp)},gar:{atk:gar.atk,hp:gar.hp,per:gar.hpPerSoldier,survivors:combatSurvivors(gar)}}})()");
  for(const unit of [result.exp,result.gar]){
    assert.ok(Math.abs(unit.atk-baseline.atk*1.6)<1e-8);
    assert.ok(Math.abs(unit.hp-baseline.hp*1.6)<1e-8);
    assert.ok(Math.abs(unit.per-baseline.per*1.6)<1e-8);
    assert.equal(unit.survivors,baseline.count);
  }
});

check('新档、无前置、越界、坏档与写档失败均安全',()=>{
  const fresh=environment();
  assert.equal(fresh.run('S.steamMilitaryStars'),0);
  assert.equal(fresh.run('steamMilitaryStarStep(1).reason'),'science-prerequisite');
  fresh.run('save()');
  const stable=fresh.store.get('rts_save');
  for(const mutate of [d=>{d.steamMilitaryStars=-1},d=>{d.steamMilitaryStars=51},d=>{d.steamMilitaryStars=1},d=>{d.v=34}]){
    const d=JSON.parse(stable);mutate(d);
    const raw=JSON.stringify(d),bad=environment({rts_save:raw});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===34?'future':'invalid');
    bad.run('tick();save()');
    assert.equal(bad.store.get('rts_save'),raw);
  }
  const prior=JSON.parse(stable);delete prior.steamMilitaryStars;
  const priorText=JSON.stringify(prior),old=environment({rts_save:priorText});
  assert.equal(old.run('loadSaveAndApply().status'),'migrated');
  assert.equal(old.store.get('rts_save_premigration'),priorText);
  assert.equal(JSON.parse(old.store.get('rts_save')).steamMilitaryStars,0);
  assert.equal(old.run('loadSaveAndApply().status'),'ok');
  assert.equal(old.run('S.steamMilitaryStars'),0);
  const noVersion=JSON.parse(stable);delete noVersion.v;delete noVersion.steamMilitaryStars;
  const legacy=environment({rts_save:JSON.stringify(noVersion)});
  assert.equal(legacy.run('loadSaveAndApply().status'),'migrated');
  assert.equal(legacy.run('S.steamMilitaryStars'),0);
  assert.equal(legacy.run('saveProtected()'),false);
  const e=environment({rts_save:paid});e.run('loadSaveAndApply()');e.run('for(let i=0;i<6;i++)tick()');
  const beforeWrite=e.store.get('rts_save');
  e.run("const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');originalSet(key,value)}");
  const tech=e.run('S.res.tech');
  assert.equal(e.run("researchScience('sci_steam_military').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),tech);
  assert.equal(e.run("scienceUnlocked('sci_steam_military')"),false);
  assert.equal(e.store.get('rts_save'),beforeWrite);
  const action=environment({rts_save:paid});action.run('loadSaveAndApply()');
  action.run('for(let i=0;i<6;i++)tick()');action.run("researchScience('sci_steam_military')");
  const paidSave=action.store.get('rts_save'),owned=action.run('totalSoldiers()');
  action.run("const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');originalSet(key,value)}");
  assert.equal(action.run('steamMilitaryStarStep(1).reason'),'save-failed');
  assert.equal(action.run('S.steamMilitaryStars'),0);
  assert.equal(action.run('totalSoldiers()'),owned);
  assert.equal(action.store.get('rts_save'),paidSave);
});

console.log(`steam military: ${passed}/4`);
