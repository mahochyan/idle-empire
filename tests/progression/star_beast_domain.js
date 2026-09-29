'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');

let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function battleEnv(){
  const e=environment();
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    S.sciences=['sci_star_beast_domain'];
    S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[],back:[]};
  `);
  return e;
}
function finish(e){for(let n=0;n<500&&e.run('S.battleActive');n++)assert.ok(e.run('__step()'),'战斗回调不应丢失');assert.equal(e.run('S.battleActive'),false)}

check('九阶星兽初始数值和满千警戒成长按源配置映射',()=>{
  const e=battleEnv();
  const low=JSON.parse(e.run("JSON.stringify(materialDomainEncounter('starBeast1',0))"));
  assert.equal(low.units.wild_wyrm[0],211764);
  assert.equal(low.starBeastAtk,30);assert.equal(low.starBeastDef,5);
  assert.equal(low.attackMass,6);assert.equal(low.attackMassFallsWithHp,true);assert.equal(low.nextKillValue,100);
  assert.deepEqual(low.reward,{starOriginStone:10,illusionStone:10,sacredRingCore:10});
  const high=JSON.parse(e.run("JSON.stringify(materialDomainEncounter('starBeast9',1000))"));
  assert.equal(high.units.wild_wyrm[0],2541176);
  assert.equal(high.starBeastAtk,55);assert.equal(high.starBeastDef,11);
  assert.equal(high.reward.starOriginStone,300);assert.equal(high.nextKillValue,1500);
});

check('研究与每日每阶次数在实际开战动作拦截',()=>{
  const e=battleEnv();
  e.run("S.sciences=[];openMaterialDomain('starBeast1')");assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences=['sci_star_beast_domain'];S.daily={day:localDay(),counts:{starBeast1:1}};openMaterialDomain('starBeast1')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("openMaterialDomain('starBeast2')");assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('B.enemyUnits[0].name'),'星界兽域·2阶星兽');
  assert.equal(e.run('B.enemyUnits[0].def'),6);
  e.run('fleeBattle()');assert.equal(e.run('S.daily.counts.starBeast2||0'),0);
});

check('未击败星兽不能伪造胜利，败退无三材无警戒',()=>{
  const e=battleEnv();e.run("openMaterialDomain('starBeast1');endBattle('win')");
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('S.items.starOriginStone'),0);
  e.run('fleeBattle()');
  assert.equal(e.run('S.killValues.starBeast'),0);
  assert.equal(e.run('S.daily.counts.starBeast1||0'),0);
  assert.equal(e.run('S.items.illusionStone'),0);
});

check('击败后的真实结算函数一次授三材并持久化每日记录',()=>{
  const e=battleEnv();e.run("openMaterialDomain('starBeast1');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(e.run('S.items.starOriginStone'),10);
  assert.equal(e.run('S.items.illusionStone'),10);
  assert.equal(e.run('S.items.sacredRingCore'),10);
  assert.equal(e.run('S.killValues.starBeast'),100);
  assert.equal(e.run('S.daily.counts.starBeast1'),1);
  e.run("endBattle('win');exitBattle();openMaterialDomain('starBeast1')");
  assert.equal(e.run('S.items.starOriginStone'),10);
  assert.equal(e.run('S.battleActive'),false);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.daily.counts.starBeast1'),1);
  assert.equal(reload.run('S.items.sacredRingCore'),10);
});

check('保存失败回滚每日次数、警戒与三材',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('starBeast1');B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(e.run('S.items.starOriginStone'),0);
  assert.equal(e.run('S.items.illusionStone'),0);
  assert.equal(e.run('S.items.sacredRingCore'),0);
  assert.equal(e.run('S.killValues.starBeast'),0);
  assert.equal(e.run('S.daily.counts.starBeast1||0'),0);
});

check('警戒镇静每日三次，重复动作和保存失败不额外扣次数',()=>{
  const e=battleEnv();
  e.run('S.killValues.starBeast=3200');
  for(const expected of [2200,1200,200])assert.equal(e.run('calmStarBeastAlert().alert'),expected);
  assert.equal(e.run('calmStarBeastAlert().reason'),'daily-limit');
  assert.equal(e.run('S.daily.counts.starBeastCalm'),3);
  e.run("S.daily={day:localDay(),counts:{}};S.killValues.starBeast=1200;save=()=>({ok:false,stage:'write'})");
  assert.equal(e.run('calmStarBeastAlert().reason'),'save-failed');
  assert.equal(e.run('S.killValues.starBeast'),1200);
  assert.equal(e.run('S.daily.counts.starBeastCalm||0'),0);
});

check('普通编队实际战败不会产出星阵材料',()=>{
  const e=battleEnv();e.run("Math.random=()=>0.5;openMaterialDomain('starBeast1')");
  finish(e);
  assert.equal(e.run('S.items.starOriginStone'),0);
  assert.equal(e.run('S.daily.counts.starBeast1||0'),0);
});

check('旧 v32 实付档补零警戒并保留原文，损坏警戒阻断写回',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p386-300m-paid-save.json'),'utf8');
  const migrated=environment({rts_save:raw});
  assert.equal(migrated.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migrated.run('S.killValues.starBeast'),0);
  assert.equal(migrated.store.get('rts_save_premigration'),raw);
  const d=JSON.parse(migrated.store.get('rts_save'));
  assert.equal(d.killValues.starBeast,0);
  d.killValues.starBeast=-1;
  const badRaw=JSON.stringify(d),bad=environment({rts_save:badRaw});
  assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
  bad.run('tick();save()');
  assert.equal(bad.store.get('rts_save'),badRaw);
});
console.log(`star beast domain: ${passed}/8`);
