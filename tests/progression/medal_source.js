'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
function battleEnv(){
  const e=environment();
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age'];S.selEnemy=0;
    S.buildings.barracks={lv:10,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:55,id:101}],
      mid:[{type:'armored_trooper',count:55,id:102}],back:[{type:'archer',count:55,id:103}]};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}

check('母本勋章与旧战功独立；杀戮之神静态40和首战预计数同源',()=>{
  assert.deepEqual(source.ents[540001]['godWar:Get'],[[160010,40],[170011,1]]);
  const e=battleEnv();
  assert.equal(e.run('CFG.save.schema'),24);
  assert.equal(e.run('CFG.res.medal.name'),'战备勋章');
  assert.equal(e.run("resCap('medal')"),100000000000);
  assert.equal(e.run("isWorkerResource('medal')"),false);
  assert.equal(e.run("train('slaughter_god',1).ok"),false);
  assert.equal(e.run("materialDomainEncounter('medal',0).reward.medal"),40);
  assert.equal(e.run("materialDomainEncounter('medal',100).reward.medal"),72);
  assert.equal(e.run("CFG.godDomains.guardianStone.reward.guardianStone"),2);
  assert.equal(e.run("CFG.godDomains.phantomFlower.reward.phantomFlower"),2);
});

check('电力前置与编队动作门阻止空打',()=>{
  const e=battleEnv();
  e.run("S.sciences=S.sciences.filter(x=>x!=='sci_electric_age');openMaterialDomain('medal')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences.push('sci_electric_age');S.formation={front:[],mid:[],back:[]};openMaterialDomain('medal')");
  assert.equal(e.run('S.battleActive'),false);
});

check('真实战斗胜利入独立勋章仓、记独立警戒值、战损回写且不重复发奖',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('medal')");
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('B.enemyCfg.name'),'战术演算机');
  flushBattle(e);
  assert.equal(e.run('S.res.medal'),40);
  assert.equal(e.run('S.killValues.godSlaughter'),100);
  const formation=e.run('JSON.stringify(S.formation)');
  e.run("endBattle('win');fleeBattle()");
  assert.equal(e.run('S.res.medal'),40);
  assert.equal(e.run('JSON.stringify(S.formation)'),formation);
  assert.equal(e.run('S.merit'),0);
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run('S.items.guardianStone+S.items.phantomFlower'),0);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.res.medal'),40);
  assert.equal(restored.run('S.killValues.godSlaughter'),100);
});

check('逃跑、战败、伪胜、写档失败均不发勋章；历史超仓不裁剪',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('medal');fleeBattle()");
  assert.equal(e.run('S.res.medal'),0);
  e.run("openMaterialDomain('medal');endBattle('lose')");
  assert.equal(e.run('S.res.medal'),0);
  e.run("exitBattle();openMaterialDomain('medal');endBattle('win')");
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('S.res.medal'),0);
  e.run("B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('S.killValues.godSlaughter'),0);
  const high=battleEnv();
  high.run("S.res.medal=100000000007;openMaterialDomain('medal');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(high.run('S.res.medal'),100000000007);
  assert.equal(high.run('S.killValues.godSlaughter'),100);
});

check('v16候选迁移保留原文、旧战功与超仓；损坏v32/未来v33/备份失败只读',()=>{
  const seed=environment();
  seed.run('S.res.medal=123;S.merit=789;S.res.steel=1234567;S.population.current=102;save()');
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=16;delete old.res.medal;delete old.killValues.godSlaughter;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('S.merit'),789);
  assert.equal(e.run('S.res.steel'),1234567);
  assert.equal(e.run('S.population.current'),102);
  assert.equal(e.run('S.killValues.godSlaughter'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
  for(const mutate of [d=>delete d.res.medal,d=>{d.res.medal=-1},d=>delete d.killValues.godSlaughter,d=>{d.killValues.godSlaughter=Infinity},d=>{d.v=33}]){
    const invalid=JSON.parse(e.store.get('rts_save'));mutate(invalid);
    const text=JSON.stringify(invalid),x=environment({rts_save:text});
    assert.notEqual(x.run('loadSaveAndApply().status'),'ok');
    x.run('tick();save()');
    assert.equal(x.store.get('rts_save'),text);
  }
  const blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
});

console.log(`medal source: ${passed}/5`);
