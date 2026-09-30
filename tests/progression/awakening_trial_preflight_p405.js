'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');

const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p390-star-array-entry-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}

check('军团规模不足时真实试炼入口拒战且不扣已存异果',()=>{
  const e=environment({rts_save:source});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  // 保留可恢复的旧军队：旧档或后续平衡变更可能让已编人数超过现行规模上限。
  e.run("S.sciences.push('sci_steam_military');S.steamMilitaryStars=50;S.items.trialFruit=1000;save()");
  const before=e.store.get('rts_save');
  assert.equal(e.run('saveProtected()'),false);
  assert.equal(e.run('formSoldierCount()>steamMilitaryActiveFieldCap()'),true);
  const result=e.run("openAwakeningTrial('easy')");
  assert.equal(result.ok,false);
  assert.equal(result.reason,'formation-too-large');
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run('S.items.trialFruit'),1000);
  assert.equal(e.store.get('rts_save'),before);
  const reload=environment({rts_save:before});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.trialFruit'),1000);
  assert.equal(reload.run('formSoldierCount()>steamMilitaryActiveFieldCap()'),true);
});

check('合法试炼仍只扣一次并真正进入异步战斗',()=>{
  const e=environment({rts_save:source});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  e.run(`globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};Math.random=()=>0.5`);
  e.run('S.items.trialFruit=1000;save()');
  const cost=e.run('awakeningTrialCost()');
  assert.ok(cost>0);
  const result=e.run("openAwakeningTrial('easy')");
  assert.equal(result.ok,true);
  assert.equal(result.cost,cost);
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('S.items.trialFruit'),1000-cost);
  assert.equal(JSON.parse(e.store.get('rts_save')).items.trialFruit,1000-cost);
  assert.equal(e.run("openAwakeningTrial('easy').reason"),'unavailable');
  assert.equal(e.run('S.items.trialFruit'),1000-cost);
});

console.log(`awakening trial preflight P405: ${passed}/2`);
