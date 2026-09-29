'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
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
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age'];
    S.buildings.barracks={lv:7,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:40,id:101}],
      mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};`);
  return e;
}
function finish(e){
  for(let i=0;i<500&&e.run('S.battleActive');i++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'500次回调仍未结算');
}

check('战术演算机双掉落映到高能核心与战备勋章，结算预估同源',()=>{
  assert.deepEqual(source[540001]['godWar:Get'],[[160010,40],[170011,1]]);
  const e=battleEnv(),reward=e.run("materialDomainEncounter('medal',0).reward");
  assert.equal(reward.medal,40);
  assert.equal(reward.godCore,1);
  assert.equal(e.run('CFG.eraMaterials.godCore.name'),'高能核心');
});

check('真实杀戮之神胜利双奖励只结算一次并随v32重载',()=>{
  const e=battleEnv();e.run("openMaterialDomain('medal')");
  assert.equal(e.run('S.battleActive'),true);
  finish(e);
  assert.equal(e.run('S.res.medal'),40);
  assert.equal(e.run('S.items.godCore'),1);
  assert.equal(e.run('S.killValues.godSlaughter'),100);
  const result=e.run("document.getElementById('battle-result').innerHTML");
  assert.ok(result.includes('高能核心 +1'));
  e.run("endBattle('win');fleeBattle()");
  assert.equal(e.run('S.items.godCore'),1);
  const saved=JSON.parse(e.store.get('rts_save'));
  1332;
  assert.equal(saved.items.godCore,1);
  const restored=environment({rts_save:JSON.stringify(saved)});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.items.godCore'),1);
});

check('逃跑、战败、伪胜、写档失败和历史超仓均不凭空增加高能核心',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('medal');fleeBattle()");
  assert.equal(e.run('S.items.godCore'),0);
  e.run("openMaterialDomain('medal');endBattle('lose')");
  assert.equal(e.run('S.items.godCore'),0);
  e.run("exitBattle();openMaterialDomain('medal');endBattle('win')");
  assert.equal(e.run('S.battleActive'),true);
  e.run("B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('S.killValues.godSlaughter'),0);
  const capped=battleEnv();
  capped.run("S.items.godCore=1000007;openMaterialDomain('medal');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(capped.run('S.items.godCore'),1000007);
});

check('旧v22候选迁移先备份、补合法0且保留库存；损坏v32与未来v33保护主档',()=>{
  const seed=environment();
  seed.run('S.res.medal=321;S.population.current=25;save()');
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=22;delete old.items.godCore;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run('S.res.medal'),321);
  assert.equal(e.run('S.population.current'),25);
  1332;
  for(const mutate of [d=>delete d.items.godCore,d=>d.items.godCore=-1,d=>d.items.godCore=Infinity,d=>d.v=34]){
    const bad=JSON.parse(e.store.get('rts_save'));mutate(bad);
    const text=JSON.stringify(bad),blocked=environment({rts_save:text});
    assert.equal(blocked.run('loadSaveAndApply().status'),bad.v===34?'future':'invalid');
    blocked.run('tick();save()');
    assert.equal(blocked.store.get('rts_save'),text);
  }
  const backupFail=environment({rts_save:raw});
  backupFail.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(backupFail.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(backupFail.store.get('rts_save'),raw);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
