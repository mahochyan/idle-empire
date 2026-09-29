'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本470071→072→073→074研究和230072/073、220071制造配置逐项映射',()=>{
  for(const [id,need,limit] of [
    [470072,[[160003,2000000],[160010,50000]],470071],
    [470073,[[160003,2500000],[160010,70000]],470072],
    [470074,[[160003,300000],[160010,15000]],470073]]){
    assert.deepEqual(source[id]['warScience:Need'],need);assert.equal(source[id]['warScience:LimitID'],limit);
  }
  assert.deepEqual(source[230072]['weapon:Need'],[[150010,10000],[170011,4]]);
  assert.deepEqual(source[230073]['weapon:Need'],[[150010,10000],[170011,4]]);
  assert.ok(source[230072]['weapon:Effect'].includes('32%')&&source[230072]['weapon:Effect'].includes('5次'));
  assert.ok(source[230073]['weapon:Effect'].includes('130%')&&source[230073]['weapon:Effect'].includes('70%')&&source[230073]['weapon:Effect'].includes('DEF-30'));
  assert.deepEqual(source[220071]['clothes:Need'],[[150010,200000]]);
  const e=environment();
  assert.equal(e.run("CFG.weaponForge.electroRifle.name"),'电磁步枪');
  assert.equal(e.run("CFG.weaponForge.electroSniper.name"),'狙击枪');
  assert.equal(e.run("CFG.weaponForge.electroArmor.name"),'电磁甲');
  assert.equal(e.run("CFG.weaponForge.electroRifle.maxLevel"),20);
  assert.equal(e.run("CFG.weaponForge.electroSniper.maxLevel"),20);
});

check('动作门严格执行前置、知识勋章扣费一次与失败不改态',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.res.tech=4800000;S.res.medal=135000");
  assert.equal(e.run("researchWeapon('electroRifle').reason"),'weapon-prerequisite');
  e.run('S.weaponForge.electro.researched=true');
  assert.equal(e.run("researchWeapon('electroSniper').reason"),'weapon-prerequisite');
  assert.equal(e.run("researchWeapon('electroArmor').reason"),'weapon-prerequisite');
  for(const key of ['electroRifle','electroSniper','electroArmor'])assert.equal(e.run(`researchWeapon('${key}').ok`),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("researchWeapon('electroRifle').reason"),'already-researched');
  assert.equal(e.run("setWeaponEquipped('electroArmor',true).reason"),'not-forged');
});

check('神核与钢逐次实付、装备叠加属性并同步远征和驻军',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.res.tech=4800000;S.res.medal=135000;S.res.steel=4400000;S.items.godCore=160;S.weaponForge.electro.researched=true");
  for(const key of ['electroRifle','electroSniper','electroArmor'])assert.equal(e.run(`researchWeapon('${key}').ok`),true);
  const army=e.run('armyCount()');
  for(const key of ['electroRifle','electroSniper','electroArmor']){
    for(let i=0;i<20;i++)assert.equal(e.run(`forgeWeapon('${key}').ok`),true);
    assert.equal(e.run(`S.weaponForge.${key}.level`),1);
    assert.equal(e.run(`setWeaponEquipped('${key}',true).ok`),true);
  }
  assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("weaponAttack('electro_trooper')"),75);
  assert.equal(e.run("weaponDefense('electro_trooper')"),28);
  assert.equal(e.run('armyCount()'),army);
  e.run("S.formation.front=[{id:1,type:'electro_trooper',count:20}];S._garrisonForm.front=[{id:2,type:'electro_trooper',count:20}];S.selEnemy=0;initBattleState()");
  assert.equal(e.run('B.ourUnits[0].atk'),75);
  assert.equal(e.run('B.ourUnits[0].def'),28);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),75);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].def'),28);
  assert.equal(e.run("setWeaponEquipped('electroRifle',false).ok"),true);
  assert.equal(e.run("weaponAttack('electro_trooper')"),65);
});

check('v23→v32先备份再补三件装备，坏新键与未来v33保护原文',()=>{
  const seed=environment();seed.run('S.items.godCore=23;S.res.medal=900;S.weaponForge.electro.level=3;S.weaponForge.electro.researched=true;save()');
  const old=JSON.parse(seed.store.get('rts_save'));old.v=23;
  for(const key of ['electroRifle','electroSniper','electroArmor'])delete old.weaponForge[key];
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.godCore'),23);
  assert.equal(e.run('S.weaponForge.electro.level'),3);
  assert.equal(e.run('S.res.medal'),900);
  1332;
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>delete d.weaponForge.electroRifle,d=>d.weaponForge.electroArmor.level=4,d=>d.weaponForge.electroSniper.researched=true,d=>d.v=36]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===36?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('连射五段与首次狙击穿甲减防在真实远征和驻军战斗入口生效',()=>{
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
    S.sciences=['sci_electric_age'];
    S.formation.front=[{id:1,type:'electro_trooper',count:40}];
    S._garrisonForm.front=[{id:2,type:'electro_trooper',count:40}];
    for(const key of ['electro','electroRifle','electroSniper'])S.weaponForge[key]={researched:true,level:1,progress:0,equipped:true};
    CFG.garrisonInvade.maxRounds=1;`);
  assert.equal(e.run("openMaterialDomain('medal')"),undefined);
  e.run('B.enemyUnits[0].hp=5000;B.enemyUnits[0].maxHp=5000');
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('__step()'),true);
  assert.equal(e.run('B.ourUnits[0].sniperUsed'),true);
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[精准狙击]'))"));
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[电磁连射]'))"));
  assert.ok(e.run('B.enemyUnits[0].def')<22);
  e.run('fleeBattle()');
  const g=e.run("resolveGarrisonBattle({units:{slaughter_god:[5000]}})");
  assert.equal(g.ourUnits[0].sniperUsed,true);
  assert.ok(g.enemyUnits[0].def<22);
  assert.equal(e.run('S._garrisonForm.front[0].count'),40);
});

check('神核锻造写档失败回滚资源、材料与进度，装备写失败保持原态',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.weaponForge.electro.researched=true;S.res.tech=2000000;S.res.medal=50000;S.res.steel=10000;S.items.godCore=4;save()");
  const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run("researchWeapon('electroRifle').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),2000000);
  assert.equal(e.run('S.res.medal'),50000);
  assert.equal(e.run('S.weaponForge.electroRifle.researched'),false);
  e.run('S.weaponForge.electroRifle.researched=true');
  assert.equal(e.run("forgeWeapon('electroRifle').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),10000);
  assert.equal(e.run('S.items.godCore'),4);
  assert.equal(e.run('S.weaponForge.electroRifle.progress'),0);
  e.run('S.weaponForge.electroRifle.level=1');
  assert.equal(e.run("setWeaponEquipped('electroRifle',true).reason"),'save-failed');
  assert.equal(e.run('S.weaponForge.electroRifle.equipped'),false);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
