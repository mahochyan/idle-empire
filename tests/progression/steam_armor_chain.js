'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本蒸汽装甲炮→加特林→迫击炮→蒸汽甲的前置与费用逐项核对',()=>{
  for(const [research,gear,prior,tech,medal] of [[470062,230062,470061,80000,5000],[470063,230063,470062,150000,8000],[470064,220061,470063,40000,2000]]){
    assert.equal(source[research]['warScience:LimitID'],prior);
    assert.deepEqual(source[research]['warScience:Need'],[[160003,tech],[160010,medal]]);
    assert.equal(source[gear][gear===220061?'clothes:LimitID':'weapon:LimitID'],research);
  }
  assert.deepEqual(source[470063]['warScience:Unlocked'],[230062]); // 母本误指加特林，按迫击炮自身LimitID修正
  assert.deepEqual(source[230062]['weapon:Need'],[[150010,2000],[170011,2]]);
  assert.deepEqual(source[230063]['weapon:Need'],[[150010,3000],[170011,2]]);
  assert.deepEqual(source[220061]['clothes:Need'],[[150010,20000]]);
  const e=environment();
  assert.equal(e.run('CFG.weaponForge.gatling.name'),'蒸汽加特林');
  assert.equal(e.run('CFG.weaponForge.mortar.name'),'蒸汽迫击炮');
  assert.equal(e.run('CFG.weaponForge.steamArmor.name'),'蒸汽甲');
});

check('动作函数严格按研究前置顺序扣知识和勋章一次',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age'];S.res.tech=270000;S.res.medal=15000");
  assert.equal(e.run("researchWeapon('gatling').reason"),'weapon-prerequisite');
  e.run('S.weaponForge.armored.researched=true');
  assert.equal(e.run("researchWeapon('mortar').reason"),'weapon-prerequisite');
  assert.equal(e.run("researchWeapon('steamArmor').reason"),'weapon-prerequisite');
  for(const key of ['gatling','mortar','steamArmor'])assert.equal(e.run(`researchWeapon('${key}').ok`),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("researchWeapon('steamArmor').reason"),'already-researched');
  assert.equal(e.run("setWeaponEquipped('steamArmor',true).reason"),'not-forged');
});

check('三件首件按钢和神核逐次付款，攻防进入远征和驻军',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age'];S.weaponForge.armored.researched=true;S.res.tech=270000;S.res.medal=15000;S.res.steel=500000;S.items.godCore=80");
  for(const key of ['gatling','mortar','steamArmor'])assert.equal(e.run(`researchWeapon('${key}').ok`),true);
  for(const key of ['gatling','mortar','steamArmor']){
    for(let n=0;n<20;n++)assert.equal(e.run(`forgeWeapon('${key}').ok`),true);
    assert.equal(e.run(`S.weaponForge.${key}.level`),1);
    assert.equal(e.run(`setWeaponEquipped('${key}',true).ok`),true);
  }
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run("weaponAttack('armored_trooper')"),53);
  assert.equal(e.run("weaponDefense('armored_trooper')"),32);
  e.run("S.formation.front=[{id:1,type:'armored_trooper',count:20}];S._garrisonForm.front=[{id:2,type:'armored_trooper',count:20}];S.selEnemy=0;initBattleState()");
  assert.equal(e.run('B.ourUnits[0].atk'),53);
  assert.equal(e.run('B.ourUnits[0].def'),32);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),53);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].def'),32);
  const saved=e.store.get('rts_save'),reloaded=environment({rts_save:saved});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.weaponForge.steamArmor.equipped'),true);
});

check('前排超过50人时扫射替换普攻，迫击炮首击覆盖前排且只触发一次',()=>{
  const e=environment();
  e.run("S.weaponForge.gatling={researched:true,level:1,progress:0,equipped:true};S.weaponForge.mortar={researched:true,level:1,progress:0,equipped:true};S._garrisonForm.front=[{id:1,type:'armored_trooper',count:20}];Math.random=()=>0.5");
  e.run("globalThis.actor=buildGarrisonUnitsFromForm()[0];globalThis.enemies=[{type:'infantry',row:'front',...battleVitals('infantry',60),def:10,alive:true},{type:'infantry',row:'front',...battleVitals('infantry',60),def:10,alive:true}]");
  assert.equal(e.run('steamSweepActive(actor,enemies)'),true);
  const result=e.run('applySteamWeaponSkillHits(actor,enemies,enemies[0],100,true,true)');
  assert.equal(result.swept,true);
  assert.equal(result.bombarded,true);
  assert.ok(result.totalDamage>100);
  assert.ok(result.hits.length>=2);
  assert.equal(e.run('enemies[0].hp'),0);
  assert.equal(e.run('enemies[1].hp'),0);
  e.run('actor.mortarUsed=true');
  assert.equal(e.run('actor.mortarUsed'),true);
});

check('远征真实回调与驻军回合均触发迫击炮，装备效果不写成常驻人数',()=>{
  const e=environment();
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=()=>{};Math.random=()=>0.5;
    S.sciences=['sci_steam_age','sci_electric_age'];
    S.formation.front=[{id:1,type:'armored_trooper',count:40}];
    S._garrisonForm.front=[{id:2,type:'armored_trooper',count:40}];
    S.weaponForge.gatling={researched:true,level:1,progress:0,equipped:true};
    S.weaponForge.mortar={researched:true,level:1,progress:0,equipped:true};
    CFG.garrisonInvade.maxRounds=1;`);
  e.run("openMaterialDomain('medal')");
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('B.ourUnits[0].mortarUsed'),true);
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[迫击轰击]'))"));
  e.run('fleeBattle()');
  const g=e.run("resolveGarrisonBattle({units:{infantry:[60]}})");
  assert.equal(g.ourUnits[0].mortarUsed,true);
  assert.ok(g.enemyUnits[0].hp<g.enemyUnits[0].maxHp);
  assert.equal(e.run('S._garrisonForm.front[0].count'),40);
});

check('v25候选迁移先保原文，v34缺键和未来v35不自动覆盖',()=>{
  const seed=environment();seed.run('S.res.medal=123;S.items.godCore=17;save()');
  const old=JSON.parse(seed.store.get('rts_save'));old.v=25;
  for(const key of ['gatling','mortar','steamArmor'])delete old.weaponForge[key];
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.medal'),123);
  assert.equal(e.run('S.items.godCore'),17);
  assert.equal(e.run('S.weaponForge.steamArmor.level'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  assert.equal(valid.v,34);
  for(const mutate of [d=>delete d.weaponForge.gatling,d=>{d.weaponForge.steamArmor.researched=true},d=>{d.v=35}]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('研究与锻造写档失败各自回滚费用、状态和原始主档',()=>{
  const e=environment();
  e.run("S.sciences=['sci_steam_age'];S.weaponForge.armored.researched=true;S.res.tech=80000;S.res.medal=5000;S.res.steel=2000;S.items.godCore=2;save()");
  const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run("researchWeapon('gatling').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),80000);
  assert.equal(e.run('S.res.medal'),5000);
  assert.equal(e.run('S.weaponForge.gatling.researched'),false);
  e.run('S.weaponForge.gatling.researched=true');
  assert.equal(e.run("forgeWeapon('gatling').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),2000);
  assert.equal(e.run('S.items.godCore'),2);
  assert.equal(e.run('S.weaponForge.gatling.progress'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
