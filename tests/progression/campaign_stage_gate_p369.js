'use strict';
// node tests/progression/campaign_stage_gate_p369.js
// Exercises the real selection and battle-entry actions. A controlled army only
// removes the formation precondition; these checks do not claim battle victory.
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function ready(e){
  e.run(`
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{
        style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}
      });
      return __nodes.get(id);
    };
    S.formation={front:[{type:'infantry',count:1,id:101}],mid:[],back:[]};S.selEnemy=0;
  `);
  return e;
}
function openCampaign(e,index){
  e.run(`S.selEnemy=${JSON.stringify(index)};openBattle()`);
  return {active:e.run('S.battleActive'),encounter:e.run('S.battleEncounter'),stage:e.run('B.enemyCfg?.id??null')};
}
function oldGapSave(){
  const source=environment();
  source.run('S.defeated=[1,4,20]');
  assert.equal(source.run('save().ok'),true);
  const loaded=environment({rts_save:source.store.get('rts_save')});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  return ready(loaded);
}

check('新档只能进入第1关，直接写 selEnemy=99 也不能越到第100关',()=>{
  const e=ready(environment());
  const first=openCampaign(e,0);
  assert.deepEqual(first,{active:true,encounter:null,stage:1});
  const skipped=openCampaign(ready(environment()),99);
  assert.equal(skipped.active,false);
  assert.equal(skipped.stage,null);
  assert.equal(skipped.encounter,null);
});

check('新档第2关尚未通关前不可开战，记录第1关胜场后可进入第2关',()=>{
  const fresh=ready(environment());
  const blocked=openCampaign(fresh,1);
  assert.equal(blocked.active,false);
  assert.equal(blocked.stage,null);
  const e=environment();
  e.run('S.defeated=[1];save()');
  const loaded=environment({rts_save:e.store.get('rts_save')});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  ready(loaded);
  const second=openCampaign(loaded,1);
  assert.deepEqual(second,{active:true,encounter:null,stage:2});
});

check('selEnemy 拒绝负数、越界、非整数和非数字，不改已有合法选择',()=>{
  const e=ready(environment());
  for(const candidate of ['-1','CFG.enemies.length','1.5',"'0'",'NaN']){
    e.run(`selEnemy(${candidate})`);
    assert.equal(e.run('S.selEnemy'),0,`${candidate} 改动了合法选择`);
  }
  assert.equal(e.run('selEnemy(0)'),true);
  assert.equal(e.run('S.selEnemy'),0);
});

check('旧档不连续胜场保留历史补打、最高已胜场及下一关，不能进入更远关',()=>{
  for(const [index,stage] of [[0,1],[3,4],[9,10],[19,20],[20,21]]){
    const e=oldGapSave();
    assert.equal(e.run(`selEnemy(${index})`),true,`第${stage}关被拒`);
    const opened=openCampaign(e,index);
    assert.equal(opened.active,true,`第${stage}关未开战`);
    assert.equal(opened.stage,stage);
  }
  const e=oldGapSave();
  assert.equal(e.run('selEnemy(21)'),false);
  assert.equal(e.run('S.selEnemy'),0);
  const skipped=openCampaign(e,21);
  assert.equal(skipped.active,false);
  assert.equal(skipped.stage,null);
});

check('区域副本入口不受主线关卡选择限制',()=>{
  const e=ready(environment());
  e.run('S.selEnemy=99;openMaterialDomain("bone")');
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('S.battleEncounter'),'bone');
  assert.equal(e.run('B.enemyCfg?.name'),'郊野猎场·野猪群');
  assert.equal(e.run('S.defeated.length'),0);
});

console.log(`campaign stage gate: ${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
