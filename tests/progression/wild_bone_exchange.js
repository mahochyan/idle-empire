'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
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
    S.selEnemy=0;S.buildings.barracks={lv:10,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:55,id:101}],mid:[],back:[]};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}

check('母本野猪普通品质、兽骨与Lv0必成交换价直接对应',()=>{
  assert.deepEqual(source[550001]['smallWar:Get'],[[160007,2],[160008,15]]);
  assert.deepEqual(source[550001]['smallWar:Num'],[5,10,15]);
  assert.equal(source[590002]['evil:AddKillValue'],10);
  assert.deepEqual(source[290015]['exchangeShop:Need'],[160008,10]);
  assert.deepEqual(source[290015]['exchangeShop:Get'],[160010,20]);
  assert.equal(source[290015]['exchangeShop:Rate'],100);
  assert.equal(source[290015]['exchangeShop:ExchangeLv'],0);
  const e=environment();
  assert.equal(e.run('CFG.save.schema'),24);
  assert.equal(e.run("materialDomainEncounter('bone',0).reward.bone"),15);
  assert.equal(e.run("resourceDisplayName('medal')"),'战备勋章');
  assert.equal(e.run("isWorkerResource('bone')"),false);
  assert.equal(e.run("train('wild_boar',1).ok"),false);
});

check('真实郊野战斗胜利得兽骨且只增长郊野警戒值，不能伪胜或重复领奖',()=>{
  const starter=battleEnv();
  starter.run("S.formation.front=[{type:'infantry',count:8,id:101}];openMaterialDomain('bone')");
  flushBattle(starter);
  assert.equal(starter.run('S.res.bone'),15,'早期步兵可首胜，未要求后期科技');
  const e=battleEnv();
  e.run("openMaterialDomain('bone')");
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('B.enemyCfg.name'),'郊野猎场·野猪群');
  e.run("endBattle('win')");
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('S.res.bone'),0);
  assert.equal(e.run('S.items.boarHeart'),0);
  flushBattle(e);
  assert.equal(e.run('S.res.bone'),15);
  assert.equal(e.run('S.items.boarHeart'),1);
  assert.equal(e.run('S.killValues.wildBoar'),10);
  assert.equal(e.run('S.killValues.godRevival'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('S.merit'),0);
  assert.equal(e.run('S.defeated.length'),0);
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.bone'),15);
  assert.equal(e.run('S.items.boarHeart'),1);
});

check('郊野结算写档失败会回滚兽心、兽骨和警戒值',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('bone')");
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  flushBattle(e);
  assert.equal(e.run('S.items.boarHeart'),0);
  assert.equal(e.run('S.res.bone'),0);
  assert.equal(e.run('S.killValues.wildBoar'),0);
});

check('电力研究之前重复狩猎与兽骨兑换可实付蒸汽枪勋章研究费',()=>{
  const e=battleEnv();
  e.run("S.sciences=['sci_steam_age'];S.res.tech=20000");
  let wins=0;
  while(e.run('S.res.bone')<500&&wins<30){
    const before=e.run('S.res.bone');
    e.run("openMaterialDomain('bone')");flushBattle(e);
    assert.ok(e.run('S.res.bone')>before,'必须由真实胜利增加兽骨');
    e.run('exitBattle()');wins++;
  }
  assert.ok(wins>1&&wins<=30);
  assert.ok(e.run('S.res.bone')>=500);
  assert.equal(e.run("scienceUnlocked('sci_electric_age')"),false);
  assert.equal(e.run("exchangeBonesForMedals(50).ok"),true);
  assert.equal(e.run('S.res.medal'),1000);
  assert.equal(e.run('S.daily.counts.market||0'),0);
  assert.equal(e.run("researchWeapon('armored').ok"),true);
  assert.equal(e.run('S.weaponForge.armored.researched'),true);
  assert.equal(e.run('S.res.medal'),0);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.weaponForge.armored.researched'),true);
  assert.ok(restored.run('S.killValues.wildBoar')>0);
});

check('兑换非法数量、缺兽骨、勋章满仓与写档失败均不扣费',()=>{
  const e=environment();
  e.run('S.res.bone=30');
  for(const q of [0,-1,1.5,Number.MAX_SAFE_INTEGER])assert.equal(e.run(`exchangeBonesForMedals(${q}).ok`),false);
  assert.equal(e.run('S.res.bone'),30);
  assert.equal(e.run('exchangeBonesForMedals(4).reason'),'insufficient-bone');
  e.run("S.res.medal=resCap('medal')");
  assert.equal(e.run('exchangeBonesForMedals(1).reason'),'capacity');
  e.run("S.res.medal=0;save()");const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run('exchangeBonesForMedals(2).reason'),'save-failed');
  assert.equal(e.run('S.res.bone'),30);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

check('v19独立迁移保留超仓和合法0，v34损坏字段、未来版与备份失败只读',()=>{
  const seed=environment();
  const raw=seed.run("(()=>{S.res.steel=999999;S.population.current=7;S.pool.infantry=4;const d=serializeSave();d.v=19;delete d.res.bone;delete d.killValues.wildBoar;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.bone'),0);
  assert.equal(e.run('S.killValues.wildBoar'),0);
  assert.equal(e.run('S.res.steel'),999999);
  assert.equal(e.run('S.population.current'),7);
  assert.equal(e.run('S.pool.infantry'),4);
  const valid=JSON.parse(e.store.get('rts_save'));
  assert.equal(valid.v,34);
  for(const mutate of [d=>delete d.res.bone,d=>d.res.bone=-1,d=>delete d.killValues.wildBoar,d=>d.killValues.wildBoar=Infinity,d=>d.v=35]){
    const d=structuredClone(valid);mutate(d);
    const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
  const blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),raw);
});

console.log(`wild bone exchange: ${passed}/6`);
