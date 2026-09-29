'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('量子军种承接源370010费用与340010–342010兵装，采用我方星界主题',()=>{
  assert.equal(source[370010]['army:LimitID'],450024);
  assert.deepEqual(source[370010]['army:Need'],[[150006,8000],[150007,8000],[150010,8000]]);
  for(const id of [340010,341010,342010]){
    assert.equal(source[id]['armsUP:ArmyID'],370010);
    assert.deepEqual(source[id]['armsUP:Need'],[[150010,4000]]);
  }
  const e=environment();
  assert.equal(e.run('CFG.units.quantum_trooper.name'),'星界构装卫士');
  assert.equal(e.run("trainBuildingKey('quantum_trooper')"),'electric_armory');
  assert.equal(e.run('CFG.units.quantum_trooper.hpPerSoldier'),7.5);
  assert.equal(e.run('CFG.units.quantum_trooper.trainTime'),source[370010]['army:Interval']/1000);
  assert.equal(e.run('CFG.armsUp.quantum_trooper.stepCost'),4000);
  for(const table of ['sciences','sciencesLong'])assert.ok(Array.from(e.run(`CFG.${table}.sci_quantum_age.unlocks`)).includes('quantum_trooper'));
});

check('量子研究、训练、编队、远征与驻军从同一条付费链生效并可重载',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age','sci_nuclear_age'];S.buildings.electric_armory={lv:1,state:'idle'};S.res.tech=3000000000;S.res.medal=3000000;S.res.copper=16000;S.res.iron=16000;S.res.steel=16000");
  assert.equal(e.run("train('quantum_trooper',2).reason"),'locked');
  assert.equal(e.run("researchScience('sci_quantum_age').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("train('quantum_trooper',2).ok"),true);
  assert.equal(e.run('S.pool.quantum_trooper||0'),0);
  for(let i=0;i<9;i++)assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.quantum_trooper||0'),0);
  assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.quantum_trooper'),1);
  for(let i=0;i<10;i++)assert.equal(e.run('processQueue().ok'),true);
  assert.equal(e.run('S.pool.quantum_trooper'),2);
  for(const rk of ['copper','iron','steel'])assert.equal(e.run(`S.res.${rk}`),0);
  e.run("openFormModal('expedition','front',0);S._formModalSel='quantum_trooper';S._formModalQty=1;confirmForm()");
  e.run("openFormModal('garrison','front',0);S._formModalSel='quantum_trooper';S._formModalQty=1;confirmForm()");
  assert.equal(e.run('S.pool.quantum_trooper'),0);
  assert.equal(e.run("S.formation.front[0].type"),'quantum_trooper');
  assert.equal(e.run("S._garrisonForm.front[0].type"),'quantum_trooper');
  e.run('S.selEnemy=0;B.isTraining=false;initBattleState()');
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  assert.equal(e.run('B.ourUnits[0].hpPerSoldier'),7.5);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].hpPerSoldier'),7.5);
  e.run('save()');
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.formation.front[0].type'),'quantum_trooper');
  assert.equal(reload.run('S._garrisonForm.front[0].type'),'quantum_trooper');
});

check('离线十秒训练与在线倒计时一致，资源仅在完成时扣一次',()=>{
  const prepare=()=>{
    const e=environment();
    e.run("S.sciences=['sci_electric_age','sci_nuclear_age','sci_quantum_age'];S.buildings.electric_armory={lv:1,state:'idle'};S.res.food=1000;S.res.copper=8000;S.res.iron=8000;S.res.steel=8000;train('quantum_trooper',1)");
    return e;
  };
  const online=prepare(),offline=prepare();
  for(let i=0;i<9;i++)online.run('processQueue(false)');
  assert.equal(online.run('S.pool.quantum_trooper||0'),0);
  assert.equal(offline.run('offlineAdvanceSec(9,1).elapsed'),9);
  assert.equal(offline.run('S.pool.quantum_trooper||0'),0);
  assert.equal(offline.run('S.queue.quantum_trooper.timer'),online.run('S.queue.quantum_trooper.timer'));
  online.run('processQueue(false)');
  assert.equal(offline.run('offlineAdvanceSec(1,1).elapsed'),1);
  assert.equal(offline.run('S.pool.quantum_trooper'),online.run('S.pool.quantum_trooper'));
  for(const rk of ['copper','iron','steel'])assert.equal(offline.run(`S.res.${rk}`),online.run(`S.res.${rk}`));
});

check('三维兵装须研究后扣钢；升星收益同时进入远征与驻军且不增兵',()=>{
  const e=environment();
  assert.equal(e.run("investArmsUp('quantum_trooper','hp').reason"),'science-prerequisite');
  e.run("S.sciences.push('sci_quantum_age');S.res.steel=12000000;S.formation.front=[{type:'quantum_trooper',count:1,id:101}];S._garrisonForm.front=[{type:'quantum_trooper',count:1,id:102}]");
  for(const stat of ['atk','hp','def'])assert.equal(e.run(`investArmsUp('quantum_trooper','${stat}',1000).ok`),true);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run('armyCount()'),2);
  e.run('S.selEnemy=0;initBattleState()');
  assert.equal(e.run('B.ourUnits[0].atk'),36);
  assert.equal(e.run('B.ourUnits[0].def'),19);
  assert.ok(Math.abs(e.run('B.ourUnits[0].hpPerSoldier')-7.51)<1e-9);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),36);
  assert.ok(Math.abs(e.run('buildGarrisonUnitsFromForm()[0].hpPerSoldier')-7.51)<1e-9);
});

check('既有v32实付档候选迁移先保原文，坏兵装值与未来版本拒载',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p315-crystal-alert5000-nano11-full-roster-paid-save.json'),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.armsUp.quantum_trooper.hp.stars'),0);
  assert.equal(e.run('S.armsUp.quantum_trooper.hp.progress'),0);
  const migrated=e.store.get('rts_save');
  assert.equal(environment({rts_save:migrated}).run('loadSaveAndApply().status'),'ok');
  for(const mutate of [d=>d.armsUp.quantum_trooper.hp.progress=1000,d=>d.armsUp.quantum_trooper.def.stars=-1,d=>d.v=37]){
    const d=JSON.parse(migrated);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===37?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
  const blocked=environment({rts_save:raw});
  blocked.run("const originalQuantumSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');originalQuantumSet(k,v)}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
});

check('训练和兵装写档失败回滚队列、材料与进度',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age','sci_nuclear_age','sci_quantum_age'];S.buildings.electric_armory={lv:1,state:'idle'};S.res.copper=8000;S.res.iron=8000;S.res.steel=12000;save()");
  const stable=e.store.get('rts_save');
  e.run("const originalQuantumWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');originalQuantumWrite(k,v)}");
  assert.equal(e.run("train('quantum_trooper',1).reason"),'save-failed');
  assert.equal(e.run('S.queue.quantum_trooper'),undefined);
  assert.equal(e.run("investArmsUp('quantum_trooper','atk').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),12000);
  assert.equal(e.run('S.armsUp.quantum_trooper.atk.progress'),0);
  assert.equal(e.store.get('rts_save'),stable);
});

console.log(`quantum soldier: ${passed}/6`);
