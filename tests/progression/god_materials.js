'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
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
    globalThis.addLog=m=>S.log.push(String(m));
    Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age'];S.selEnemy=0;
    S.buildings.barracks={lv:7,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:40,id:101}],
      mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}

check('两种材料挑战仅电力时代开放，敌方专用兵不能招募',()=>{
  const e=battleEnv();e.run("S.sciences=S.sciences.filter(x=>x!=='sci_electric_age')");
  for(const [key,enemy] of [['guardianStone','guardian_god'],['phantomFlower','phantom_god']]){
    e.run(`openMaterialDomain('${key}')`);
    assert.equal(e.run('S.battleActive'),false);
    assert.equal(e.run(`train('${enemy}',1).ok`),false);
  }
  e.run("S.sciences.push('sci_electric_age');S.formation.front=[];S.formation.mid=[];S.formation.back=[];openMaterialDomain('guardianStone')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("openMaterialDomain('unknown')");
  assert.equal(e.run('S.battleActive'),false);
});

check('独立警戒值按母本普通品质增长，静态模板与既有遗迹不被改动',()=>{
  const e=battleEnv();
  for(const [key,unit] of [['guardianStone','guardian_god'],['phantomFlower','phantom_god']]){
    const rows=JSON.parse(e.run(`JSON.stringify([0,100,200,500].map(k=>{const x=materialDomainEncounter('${key}',k);return [x.units.${unit}[0],x.reward.${key},x.nextKillValue]}))`));
    assert.deepEqual(rows.map(r=>r[1]),[2,3,5,11]);
    assert.deepEqual(rows.map(r=>r[2]),[100,200,300,600]);
  }
  assert.equal(e.run('CFG.godDomain.units.god_crystal_guard[0]'),40);
  assert.equal(e.run('godDomainEncounter(0).reward.godCrystal'),1);
});

check('守御与幻影真实战斗胜利分别入库，重复结算不重发，战损不复原',()=>{
  const e=battleEnv();
  for(const [key,killKey,unit] of [['guardianStone','godGuardian','guardian_god'],['phantomFlower','godPhantom','phantom_god']]){
    e.run(`openMaterialDomain('${key}')`);
    assert.equal(e.run('S.battleActive'),true);
    assert.equal(e.run('B.enemyCfg.name'),key==='guardianStone'?'重装防卫机':'光学拟态机');
    assert.equal(e.run(`CFG.units.${unit}.race`),'高阶机体');
    flushBattle(e);
    assert.equal(e.run(`S.items.${key}`),2,JSON.stringify(e.run("({winner:B.winner,round:B.round,formation:S.formation})")));
    assert.equal(e.run(`S.killValues.${killKey}`),100);
    const survivors=e.run("JSON.stringify(S.formation)");
    e.run("endBattle('win');fleeBattle()");
    assert.equal(e.run(`S.items.${key}`),2);
    assert.equal(e.run('JSON.stringify(S.formation)'),survivors);
    e.run('exitBattle()');
  }
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run('S.merit'),0);
  assert.equal(e.run('S.killValues.godRevival'),0);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.items.guardianStone'),2);
  assert.equal(restored.run('S.items.phantomFlower'),2);
  assert.equal(restored.run('S.killValues.godGuardian'),100);
  assert.equal(restored.run('S.killValues.godPhantom'),100);
});

check('校准后的中后段挑战威胁等级可由55人三排军力打赢',()=>{
  for(const [key,kill,killKey] of [['guardianStone',1000,'godGuardian'],['phantomFlower',1200,'godPhantom']]){
    const e=battleEnv();
    e.run(`S.buildings.barracks={lv:10,state:'idle'};for(const row of ['front','mid','back'])S.formation[row][0].count=55;S.killValues.${killKey}=${kill};openMaterialDomain('${key}')`);
    assert.equal(e.run('S.battleActive'),true);
    flushBattle(e);
    assert.ok(e.run(`S.items.${key}`)>0,`${key} 警戒值${kill}满编战败`);
    assert.equal(e.run(`S.killValues.${killKey}`),kill+100);
    assert.equal(e.run('S.defeated.length'),0);
  }
});

check('逃跑、战败、伪胜与主档写失败都不发材料；已满仓不裁剪',()=>{
  for(const key of ['guardianStone','phantomFlower']){
    const e=battleEnv();
    e.run(`openMaterialDomain('${key}');fleeBattle()`);
    assert.equal(e.run(`S.items.${key}`),0);
    e.run(`openMaterialDomain('${key}');endBattle('lose')`);
    assert.equal(e.run(`S.items.${key}`),0);
    e.run(`exitBattle();openMaterialDomain('${key}')`);
    e.run("endBattle('win')");
    assert.equal(e.run('S.battleActive'),true);
    e.run("B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
    assert.equal(e.run(`S.items.${key}`),0);
    assert.equal(e.run('S.killValues.godGuardian+S.killValues.godPhantom'),0);
    assert.equal(e.run('S.defeated.length'),0);
    const capped=battleEnv();
    capped.run(`S.items.${key}=1000007;openMaterialDomain('${key}');B.enemyUnits[0].alive=false;endBattle('win')`);
    assert.equal(capped.run(`S.items.${key}`),1000007);
  }
});

check('v15迁移保留材料、人口和超仓；缺新警戒值或未来v33保护原文',()=>{
  const seed=environment();
  seed.run('S.items.guardianStone=7;S.items.phantomFlower=9;S.res.steel=1234567;S.population.current=102;save()');
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=15;delete old.killValues.godGuardian;delete old.killValues.godPhantom;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.guardianStone'),7);
  assert.equal(e.run('S.items.phantomFlower'),9);
  assert.equal(e.run('S.res.steel'),1234567);
  assert.equal(e.run('S.population.current'),102);
  assert.equal(e.run('S.killValues.godGuardian'),0);
  assert.equal(e.run('S.killValues.godPhantom'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).v,32);
  for(const mutate of [d=>delete d.killValues.godGuardian,d=>{d.killValues.godPhantom=-1},d=>{d.v=33}]){
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

console.log(`god materials: ${passed}/6`);
