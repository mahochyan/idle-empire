'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function battleEnv(){
  const e=environment();
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;
      if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_god_domain','sci_steam_age','sci_electric_age'];
    S.buildings.barracks={lv:7,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:40,id:101}],
      mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};`);
  return e;
}
function finish(e){
  for(let i=0;i<500&&e.run('S.battleActive');i++)
    assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结算');
}
const domains=[['godCrystal','godRevival'],['phantomFlower','godPhantom'],['guardianStone','godGuardian']];
check('三种母本神域模板各有基础勋章40与独立材料',()=>{
  for(const id of [540001,540011,540021])
    assert.equal(source[id]['godWar:Get'].find(([key])=>key===160010)[1],40);
  const e=battleEnv();
  for(const [key] of domains){
    const reward=e.run(`materialDomainEncounter('${key}',0).reward`);
    assert.equal(reward.medal,40,`${key} 漏了战备勋章`);
    assert.ok(reward[key]>0,`${key} 主材料丢失`);
  }
  assert.equal(e.run("materialDomainEncounter('bone',0).reward.medal"),undefined);
});
check('胜利同时入材料和勋章，重复结算不重复发，重载保留',()=>{
  for(const [key,killKey] of domains){
    const e=battleEnv();
    e.run(`openMaterialDomain('${key}')`);
    assert.equal(e.run('S.battleActive'),true,`${key} 未开战`);
    finish(e);
    assert.ok(e.run(`S.items.${key}`)>0,`${key} 未得材料`);
    assert.equal(e.run('S.res.medal'),40,`${key} 未得勋章`);
    assert.equal(e.run(`S.killValues.${killKey}`),100);
    assert.equal(e.run('S.merit'),0);
    const before=e.run(`({item:S.items.${key},medal:S.res.medal,kill:S.killValues.${killKey}})`);
    e.run("endBattle('win');fleeBattle()");
    assert.deepEqual(e.run(`({item:S.items.${key},medal:S.res.medal,kill:S.killValues.${killKey}})`),before);
    const restored=environment({rts_save:e.store.get('rts_save')});
    assert.equal(restored.run('loadSaveAndApply().status'),'ok');
    assert.equal(restored.run('S.res.medal'),40);
    assert.equal(restored.run(`S.items.${key}`),before.item);
  }
});
check('逃跑和败北不发双奖励；主档写入失败两份奖励与警戒值一起回滚',()=>{
  for(const [key,killKey] of domains){
    const e=battleEnv();
    e.run(`openMaterialDomain('${key}');fleeBattle()`);
    assert.equal(e.run('S.res.medal'),0);
    e.run(`openMaterialDomain('${key}');endBattle('lose')`);
    assert.equal(e.run('S.res.medal'),0);
    e.run(`exitBattle();openMaterialDomain('${key}');B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')`);
    assert.equal(e.run(`S.items.${key}`),0);
    assert.equal(e.run('S.res.medal'),0);
    assert.equal(e.run(`S.killValues.${killKey}`),0);
  }
});
check('勋章历史超仓不被胜利裁剪，预估与实得随同一警戒值增长',()=>{
  const e=battleEnv();
  assert.equal(e.run("materialDomainEncounter('guardianStone',100).reward.medal"),72);
  e.run("S.res.medal=resCap('medal')+7;openMaterialDomain('guardianStone');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(e.run('S.res.medal'),e.run("resCap('medal')")+7);
  assert.equal(e.run('S.items.guardianStone'),2);
  assert.equal(e.run('S.killValues.godGuardian'),100);
});
console.log(`god multi reward: ${passed}/4`);
