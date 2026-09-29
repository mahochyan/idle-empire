'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本470075/076与220072/073的前置、费用、等级和神核阶梯',()=>{
  for(const [science,armor,prior,tech,medal] of [[470075,220072,470074,3000000,80000],[470076,220073,470075,3500000,100000]]){
    assert.equal(source[science]['warScience:LimitID'],prior);
    assert.deepEqual(source[science]['warScience:Need'],[[160003,tech],[160010,medal]]);
    assert.equal(source[armor]['clothes:LvMax'],40);
    assert.deepEqual(source[armor]['clothes:Need'],[[170011,4]]);
    assert.deepEqual(source[armor]['clothes:Need2'],[[170011,10]]);
  }
  const e=environment();
  assert.equal(e.run('CFG.weaponForge.energyArmor.name'),'能源甲');
  assert.equal(e.run('CFG.weaponForge.nanoArmor.name'),'纳米甲');
  assert.equal(e.run("weaponForgeStepCost('energyArmor',19).godCore"),4);
  assert.equal(e.run("weaponForgeStepCost('energyArmor',20).godCore"),10);
});

check('研发前置、实扣两笔费用、制造首件及写档重载',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.res.tech=6500000;S.res.medal=180000;S.items.godCore=160");
  assert.equal(e.run("researchWeapon('energyArmor').reason"),'weapon-prerequisite');
  e.run("for(const key of ['electro','electroRifle','electroSniper','electroArmor'])S.weaponForge[key].researched=true");
  assert.equal(e.run("researchWeapon('nanoArmor').reason"),'weapon-prerequisite');
  assert.equal(e.run("researchWeapon('energyArmor').ok"),true);
  assert.equal(e.run("researchWeapon('nanoArmor').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  for(const key of ['energyArmor','nanoArmor']){
    for(let i=0;i<20;i++)assert.equal(e.run(`forgeWeapon('${key}').ok`),true);
    assert.equal(e.run(`S.weaponForge.${key}.level`),1);
    assert.equal(e.run(`setWeaponEquipped('${key}',true).ok`),true);
  }
  assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run("weaponDefense('electro_trooper')"),28);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.weaponForge.nanoArmor.equipped'),true);
  assert.equal(restored.run('S.weaponForge.energyArmor.level'),1);
});

check('20级后每次10神核，短缺及写档失败均不扣料',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];for(const key of ['electro','electroRifle','electroSniper','electroArmor'])S.weaponForge[key].researched=true;S.weaponForge.energyArmor={researched:true,level:20,progress:0,equipped:true};S.items.godCore=9");
  assert.equal(e.run("forgeWeapon('energyArmor').reason"),'insufficient-resources');
  assert.equal(e.run('S.items.godCore'),9);
  e.run('S.items.godCore=10;save()');
  const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run("forgeWeapon('energyArmor').reason"),'save-failed');
  assert.equal(e.run('S.items.godCore'),10);
  assert.equal(e.run('S.weaponForge.energyArmor.progress'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

check('首次出手临时生命与防转攻仅触发一次，不返还已损兵员',()=>{
  const e=environment();
  e.run("S.weaponForge.energyArmor={researched:true,level:1,progress:0,equipped:true};S.weaponForge.nanoArmor={researched:true,level:1,progress:0,equipped:true};S.weaponForge.electroArmor.researched=true;S._garrisonForm.front=[{id:1,type:'electro_trooper',count:200}]");
  const baseline=e.run('buildGarrisonUnitsFromForm()[0]');
  assert.equal(baseline.initialCount,200);
  e.run('globalThis.actor=buildGarrisonUnitsFromForm()[0];applyCombatDamage(actor,56)');
  const before=e.run('combatSurvivors(actor)');
  const skill=e.run('applyArmorOpeningSkills(actor)');
  assert.equal(skill.hpAdded,128); // 入场560生命，20%×1.15，取整
  assert.equal(skill.defConverted,28);
  assert.equal(skill.atkAdded,36); // 入场防御28×1.3，取整
  assert.equal(e.run('actor.def'),0);
  assert.equal(e.run('actor.atk'),91);
  assert.equal(e.run('combatSurvivors(actor)'),before);
  assert.equal(e.run('applyArmorOpeningSkills(actor).hpAdded'),0);
  assert.equal(e.run('combatSurvivors(actor)'),before);
  assert.equal(e.run('S._garrisonForm.front[0].count'),200);
});

check('真实远征回调与驻军战斗都触发进场护甲且不增加常驻兵员',()=>{
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
    S.sciences=['sci_electric_age'];S.population.current=200;
    S.formation.front=[{id:1,type:'electro_trooper',count:40}];
    S._garrisonForm.front=[{id:2,type:'electro_trooper',count:40}];
    S.weaponForge.energyArmor={researched:true,level:1,progress:0,equipped:true};
    S.weaponForge.nanoArmor={researched:true,level:1,progress:0,equipped:true};
    CFG.garrisonInvade.maxRounds=1;`);
  e.run("openMaterialDomain('medal')");
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('B.ourUnits[0].armorOpeningUsed'),true);
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[能源护甲]'))"));
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[纳米重构]'))"));
  assert.equal(e.run('B.ourUnits[0].def'),0);
  e.run('fleeBattle()');
  const g=e.run("resolveGarrisonBattle({units:{slaughter_god:[5000]}})");
  assert.equal(g.ourUnits[0].armorOpeningUsed,true);
  assert.equal(g.ourUnits[0].def,0);
  assert.ok(g.ourUnits[0].maxHp>112);
  assert.equal(e.run('S._garrisonForm.front[0].count'),40);
});

check('v24旧档候选迁移、原文保护；v32坏键和v33未来档阻止自动覆盖',()=>{
  const seed=environment();seed.run('S.res.medal=123;S.items.godCore=17;save()');
  const old=JSON.parse(seed.store.get('rts_save'));
  old.v=24;delete old.weaponForge.energyArmor;delete old.weaponForge.nanoArmor;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.medal'),123);
  assert.equal(e.run('S.items.godCore'),17);
  assert.equal(e.run('S.weaponForge.energyArmor.level'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  1332;
  for(const mutate of [d=>delete d.weaponForge.energyArmor,d=>{d.weaponForge.nanoArmor.researched=true},d=>{d.v=35}]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

console.log(`${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
