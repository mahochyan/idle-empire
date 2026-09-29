'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本战机、飞弹研发与锻造费用及顺序',()=>{
  assert.deepEqual(source[470081]['warScience:Need'],[[160003,100000000],[160010,1000000]]);
  assert.deepEqual(source[470082]['warScience:Need'],[[160003,100000000],[160010,1000000]]);
  assert.equal(source[470081]['warScience:LimitID'],450023);
  assert.equal(source[470082]['warScience:LimitID'],470081);
  for(const id of [230082,230083])assert.deepEqual(source[id]['weapon:Need'],[[150010,10000],[170011,8]]);
  assert.ok(source[230082]['weapon:Effect'].includes('135%'));
  assert.ok(source[230083]['weapon:Effect'].includes('1000'));
  const e=environment();
  assert.equal(e.run('CFG.weaponForge.starFighter.researchCost.medal'),1000000);
  assert.equal(e.run('CFG.weaponForge.starMissile.needWeapon'),'starFighter');
  assert.equal(e.run('CFG.weaponForge.starMissile.stepCost.godCore'),8);
});

check('实付研究、20次制成、装备生效及资源不足不改态',()=>{
  const e=environment();
  e.run("S.sciences=['sci_nuclear_age'];S.res.tech=200000000;S.res.medal=2000000;S.res.steel=400000;S.items.godCore=320");
  assert.equal(e.run("researchWeapon('starMissile').reason"),'weapon-prerequisite');
  assert.equal(e.run("researchWeapon('starFighter').ok"),true);
  assert.equal(e.run("researchWeapon('starFighter').reason"),'already-researched');
  assert.equal(e.run("researchWeapon('starMissile').ok"),true);
  assert.equal(e.run('S.res.tech'),0);assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("forgeWeapon('starFighter').ok"),true);
  for(let i=1;i<20;i++)assert.equal(e.run("forgeWeapon('starFighter').ok"),true);
  for(let i=0;i<20;i++)assert.equal(e.run("forgeWeapon('starMissile').ok"),true);
  assert.equal(e.run('S.res.steel'),0);assert.equal(e.run('S.items.godCore'),0);
  assert.equal(e.run('S.weaponForge.starFighter.level'),1);
  assert.equal(e.run('S.weaponForge.starMissile.level'),1);
  const baseline=e.run("weaponAttack('star_trooper')");
  assert.equal(e.run("setWeaponEquipped('starFighter',true).ok"),true);
  assert.equal(e.run("setWeaponEquipped('starMissile',true).ok"),true);
  assert.equal(e.run("weaponAttack('star_trooper')"),baseline+20);
  assert.equal(e.run("equippedWeaponSkills('star_trooper').starFighter"),true);
  assert.equal(e.run("forgeWeapon('starMissile').reason"),'insufficient-resources');
});

check('首击按入场人数与半血门槛生效，护盾优先，不能把临时伤害写成兵员',()=>{
  const e=environment();
  e.run("S.weaponForge.starFighter={researched:true,level:1,progress:0,equipped:true};S.weaponForge.starMissile={researched:true,level:1,progress:0,equipped:true}");
  const out=e.run(`(()=>{const actor={type:'star_trooper',hp:400,maxHp:400,initialCount:100,hpPerSoldier:4,atk:60,weaponSkills:equippedWeaponSkills('star_trooper')};
    const target={type:'soul_wraith',hp:10000,maxHp:10000,initialCount:1200,hpPerSoldier:10,shield:1000,def:100,alive:true};
    const first=applyStarWeaponSkillHits(actor,target,100, true);
    const second=applyStarWeaponSkillHits(actor,target,100,false);
    return{first,second,target,actor};})()`);
  assert.equal(out.first.fighter,true);assert.equal(out.first.missile,true);
  assert.equal(out.first.replacesNormal,true);
  assert.equal(out.target.def,69);
  assert.ok(out.first.shieldLost>0&&out.first.hpLost>0);
  assert.equal(out.second.hpLost,0);
  assert.equal(out.actor.initialCount,100);
  const beast=e.run(`(()=>{const actor={type:'star_trooper',hp:1400,maxHp:1400,initialCount:100,hpPerSoldier:14,atk:60,weaponSkills:{starFighter:true}};
    const target={type:'beast',starBeast:true,hp:100000,maxHp:100000,initialCount:1,hpPerSoldier:100000,def:100,alive:true};
    const first=applyStarWeaponSkillHits(actor,target,100,true);return{first,def:target.def,count:actor.initialCount}})()`);
  assert.equal(beast.def,50);assert.equal(beast.count,100);
  assert.ok(beast.first.hpLost>18000&&beast.first.hpLost<=18200);
  for(const [count,hp] of [[1000,10000],[1200,5000]]){
    const miss=e.run(`(()=>{const actor={type:'star_trooper',hp:400,maxHp:400,initialCount:100,hpPerSoldier:4,atk:60,weaponSkills:{starMissile:true}};
      const target={type:'soul_wraith',hp:${hp},maxHp:10000,initialCount:${count},hpPerSoldier:10,def:100,alive:true};
      return applyStarWeaponSkillHits(actor,target,100,true).missile})()`);
    assert.equal(miss,false);
  }
});

check('真实远征和驻军入口共享星界军备首击，兵员回写不增加',()=>{
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
    S.sciences=['sci_electric_age','sci_nuclear_age'];
    S.formation.front=[{id:1,type:'star_trooper',count:300}];
    S._garrisonForm.front=[{id:2,type:'star_trooper',count:300}];
    for(const key of ['starFighter','starMissile'])S.weaponForge[key]={researched:true,level:1,progress:0,equipped:true};
    CFG.garrisonInvade.maxRounds=1;CFG.units.infantry.spd=0;CFG.units.infantry.atk=0;`);
  e.run("openMaterialDomain('medal')");
  e.run('B.enemyUnits[0].hp=100000;B.enemyUnits[0].maxHp=100000;B.enemyUnits[0].initialCount=1200');
  for(let i=0;i<24&&!e.run("B.msgs.some(m=>m.m.includes('[星界战机]'))");i++)assert.equal(e.run('__step()'),true);
  assert.equal(e.run('B.ourUnits[0].starWeaponUsed'),true);
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[星界战机]'))"));
  assert.ok(e.run("B.msgs.some(m=>m.m.includes('[星陨飞弹]'))"));
  e.run('fleeBattle()');
  const g=e.run("resolveGarrisonBattle({units:{infantry:[100000]}})");
  assert.equal(g.ourUnits[0].starWeaponUsed,true);
  assert.ok(g.enemyUnits[0].hp<=g.enemyUnits[0].maxHp*0.5);
  assert.equal(e.run('S._garrisonForm.front[0].count'),300);
});

check('旧v32在独立候选迁移并保护原文；坏键、缺前置和未来档禁止覆盖',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));delete old.weaponForge.starFighter;delete old.weaponForge.starMissile;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.weaponForge.starFighter.level'),0);
  assert.equal(e.run('S.weaponForge.starMissile.progress'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>d.weaponForge.starFighter.level=21,d=>d.weaponForge.starMissile.researched=true,d=>d.v=34]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===34?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('P338有价满编档迁移保留警戒、铭石、知识与旧兵装',()=>{
  const file=path.join(__dirname,'../../docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json');
  const raw=fs.readFileSync(file,'utf8').trim(),e=environment({rts_save:raw});
  const before=JSON.parse(raw);
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.killValues.soulRealm'),before.killValues.soulRealm);
  assert.equal(e.run('S.items.soulStone'),before.items.soulStone);
  assert.equal(e.run('S.res.tech'),before.res.tech);
  assert.equal(e.run('S.armsUp.star_trooper.atk.stars'),before.armsUp.star_trooper.atk.stars);
  assert.equal(e.run('S.weaponForge.starFighter.researched'),false);
  assert.equal(e.run('S.weaponForge.starMissile.researched'),false);
});

check('存档写失败时研发、锻造、装备逐项回滚',()=>{
  const e=environment();
  e.run("S.sciences=['sci_nuclear_age'];S.res.tech=100000000;S.res.medal=1000000;S.res.steel=10000;S.items.godCore=8;save()");
  const raw=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(e.run("researchWeapon('starFighter').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),100000000);assert.equal(e.run('S.res.medal'),1000000);
  assert.equal(e.run('S.weaponForge.starFighter.researched'),false);
  e.run('S.weaponForge.starFighter.researched=true');
  assert.equal(e.run("forgeWeapon('starFighter').reason"),'save-failed');
  assert.equal(e.run('S.res.steel'),10000);assert.equal(e.run('S.items.godCore'),8);
  assert.equal(e.run('S.weaponForge.starFighter.progress'),0);
  e.run('S.weaponForge.starFighter.level=1');
  assert.equal(e.run("setWeaponEquipped('starFighter',true).reason"),'save-failed');
  assert.equal(e.run('S.weaponForge.starFighter.equipped'),false);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`${passed} passed / ${failed} failed`);if(failed)process.exitCode=1;
