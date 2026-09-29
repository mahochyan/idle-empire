'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}

const v35Raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p401-postquantum-medal-ready-save.json'),'utf8');
const v35=JSON.parse(v35Raw);

check('450924 对应研究双表价格、前置和实际效果吻合',()=>{
  const e=environment();
  for(const table of ['sciences','sciencesLong']){
    const sc=e.run(`CFG.${table}.sci_astral_engine`);
    assert.equal(sc.name,'星界时序引擎');
    assert.deepEqual(Array.from(sc.need),['sci_astral_armament']);
    assert.equal(sc.cost.tech,100000000000);
    assert.equal(sc.cost.medal,30000000);
  }
  assert.equal(e.run('battleSpeedAllowed(100)'),false);
});

check('实付 v35 档候选迁移到 v36，原文可恢复且不改资源、军力、科技、合法零',()=>{
  assert.equal(v35.v,35);
  const e=environment({rts_save:v35Raw});
  const result=e.run('loadSaveAndApply()');
  assert.equal(result.status,'migrated');
  assert.ok(result.filled.includes('battleSpeed'));
  assert.equal(e.store.get('rts_save_premigration'),v35Raw);
  const after=JSON.parse(e.store.get('rts_save'));
  assert.equal(after.v,36);
  assert.equal(after.battleSpeed,2);
  for(const field of ['res','pool','formation','sciences','defeated','quantumArmament','beastExchange','items','eraStorage'])
    assert.deepEqual(after[field],v35[field],field);
  assert.equal(e.run('S.battleSpeed'),2);
  assert.equal(e.run('scienceUnlocked(\'sci_astral_armament\')'),true);
  const reloaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
});

check('研究必须先有兵装、单笔同时付足知识勋章，重复点击不再扣费',()=>{
  const e=environment();
  e.run('S.res.tech=100000000000;S.res.medal=30000000');
  assert.equal(e.run("researchScience('sci_astral_engine').reason"),'science-prerequisite');
  assert.equal(e.run('S.res.tech'),100000000000);
  assert.equal(e.run('S.res.medal'),30000000);
  e.run("S.sciences.push('sci_astral_armament');S.res.medal=29999999");
  assert.equal(e.run("researchScience('sci_astral_engine').reason"),'insufficient-resources');
  assert.equal(e.run('S.res.tech'),100000000000);
  e.run('S.res.medal=30000000');
  assert.equal(e.run("researchScience('sci_astral_engine').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('battleSpeedAllowed(100)'),true);
  assert.equal(e.run("researchScience('sci_astral_engine').repeat"),true);
  assert.equal(e.run("S.sciences.filter(id=>id==='sci_astral_engine').length"),1);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,36);
  assert.ok(saved.sciences.includes('sci_astral_engine'));
  assert.equal(saved.res.tech,0);
  assert.equal(saved.res.medal,0);
});

check('倍速动作拒绝越权和非法值；研究后100倍速落盘、重载保留',()=>{
  const e=environment();
  assert.equal(e.run('setBattleSpeed(100).reason'),'science-prerequisite');
  assert.equal(e.run('setBattleSpeed(200).reason'),'invalid-speed');
  assert.equal(e.run('S.battleSpeed'),2);
  assert.equal(e.run('setBattleSpeed(4).ok'),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).battleSpeed,4);
  e.run("S.sciences.push('sci_astral_armament','sci_astral_engine')");
  assert.equal(e.run('setBattleSpeed(100).ok'),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).battleSpeed,100);
  const reloaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.battleSpeed'),100);
  assert.equal(reloaded.run('battleSpeedAllowed(100)'),true);
});

check('保存失败回滚研究、费用和倍速，旧主档保持原样',()=>{
  const research=environment();
  research.run("S.sciences.push('sci_astral_armament');S.res.tech=100000000000;S.res.medal=30000000;save()");
  const before=research.store.get('rts_save');
  research.run("localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('full');return null}");
  assert.equal(research.run("researchScience('sci_astral_engine').reason"),'save-failed');
  assert.equal(research.run('S.res.tech'),100000000000);
  assert.equal(research.run('S.res.medal'),30000000);
  assert.equal(research.run("scienceUnlocked('sci_astral_engine')"),false);
  assert.equal(research.store.get('rts_save'),before);
  const speed=environment();
  speed.run("S.sciences.push('sci_astral_engine');save()");
  const old= speed.store.get('rts_save');
  speed.run("localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('full');return null}");
  assert.equal(speed.run('setBattleSpeed(100).reason'),'save-failed');
  assert.equal(speed.run('S.battleSpeed'),2);
  assert.equal(speed.store.get('rts_save'),old);
});

check('坏 v36、无研究却存100倍及未来 v37 均保护原文，普通保存不能覆盖',()=>{
  const seed=environment();seed.run('save()');
  const valid=JSON.parse(seed.store.get('rts_save'));
  assert.equal(valid.v,36);
  for(const mutation of [
    d=>{delete d.battleSpeed},
    d=>{d.battleSpeed=0},
    d=>{d.battleSpeed=100},
    d=>{d.battleSpeed=Infinity},
    d=>{d.v=37}
  ]){
    const d=structuredClone(valid);mutation(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.ok(['invalid','future'].includes(e.run('loadSaveAndApply().status')));
    assert.equal(e.run('saveProtected()'),true);
    assert.equal(e.run('save().ok'),false);
    assert.equal(e.store.get('rts_save'),raw);
  }
});

console.log(`astral_engine_p402: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
