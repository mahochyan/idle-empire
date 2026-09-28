'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p279-awakening-star155-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function loaded(){const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');assert.equal(e.store.get('rts_save_premigration'),source);return e}
function battleHarness(e){
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));`);
}

check('觉醒前两技按入场兵团攻防触发一次，效果只在战斗体',()=>{
  const e=loaded();const saved=e.store.get('rts_save');
  const result=e.run(`(()=>{Math.random=()=>0;
    const actor={type:'star_trooper',initialCount:155,entryAtk:40,entryDef:18,atk:40,def:18,hp:620,maxHp:620,hpPerSoldier:4,alive:true};
    const target={type:'trial_guard_easy',attackMass:546,hp:50000,maxHp:50000,def:20,shield:0,alive:true};
    const first=applyAwakeningOpeningSkills(actor,target);
    const second=applyAwakeningOpeningSkills(actor,target);
    return {first,second,hp:target.hp,def:target.def,formation:JSON.stringify(S.formation)};
  })()`);
  assert.equal(result.first.defReduced,20);
  assert.equal(result.first.trueDamage,27900);
  assert.equal(result.hp,22100);assert.equal(result.def,0);
  assert.equal(result.second.defReduced,0);assert.equal(result.second.trueDamage,0);
  assert.equal(result.formation,e.run('JSON.stringify(S.formation)'));
  assert.equal(e.store.get('rts_save'),saved);
});

check('零星或未命中概率均不触发，首次出手之后不补摇',()=>{
  const e=loaded();
  const result=e.run(`(()=>{const actor={type:'star_trooper',initialCount:10,hpPerSoldier:4,hp:40,maxHp:40,entryAtk:40,entryDef:18,atk:40,def:18,alive:true};
    const target={type:'trial_guard_easy',attackMass:10,hp:10000,maxHp:10000,def:20,shield:0,alive:true};
    S.awakening.star_trooper.stars=0;Math.random=()=>0;
    const zero=applyAwakeningOpeningSkills(actor,target);
    actor.awakeningOpeningUsed=false;S.awakening.star_trooper.stars=5;Math.random=()=>0.99;
    const missed=applyAwakeningOpeningSkills(actor,target);
    Math.random=()=>0;const retry=applyAwakeningOpeningSkills(actor,target);
    return {zero,missed,retry,hp:target.hp,def:target.def};
  })()`);
  for(const key of ['zero','missed','retry'])assert.equal(result[key].defReduced+result[key].trueDamage,0);
  assert.equal(result.hp,10000);assert.equal(result.def,20);
});

check('母本概率先向下取整：1星不触发，5星可只触发削防',()=>{
  const e=loaded();
  const result=e.run(`(()=>{const make=()=>({type:'star_trooper',initialCount:1,hpPerSoldier:4,hp:4,maxHp:4,entryAtk:40,entryDef:18,atk:40,def:18,alive:true});
    const target={type:'trial_guard_easy',attackMass:10,hp:10000,maxHp:10000,def:20,shield:0,alive:true};
    S.awakening.star_trooper.stars=1;Math.random=()=>0;
    const one=applyAwakeningOpeningSkills(make(),target);
    S.awakening.star_trooper.stars=5;Math.random=()=>0.02;
    const five=applyAwakeningOpeningSkills(make(),target);
    return {one,five,hp:target.hp,def:target.def};
  })()`);
  assert.equal(result.one.defReduced+result.one.trueDamage,0);
  assert.equal(result.five.defReduced,4);assert.equal(result.five.trueDamage,0);
  assert.equal(result.hp,10000);assert.equal(result.def,16);
});

check('简单守卫神技按当前出手规模追加真实伤害，其他守卫不借用',()=>{
  const e=loaded();
  const r=e.run(`(()=>{Math.random=()=>0;
    const actor={type:'trial_guard_easy',attackMass:126,initialCount:126,atk:6,hp:5556,maxHp:5556,alive:true};
    const target={type:'star_trooper',initialCount:155,hpPerSoldier:4,hp:620,maxHp:620,def:999,shield:0,alive:true};
    const dealt=applyEasyTrialGuardAttackSkill(actor,target);
    actor.type='trial_guard_perfect';const other=applyEasyTrialGuardAttackSkill(actor,target);
    return {dealt,other,hp:target.hp};
  })()`);
  assert.equal(r.dealt,22);assert.equal(r.hp,598);assert.equal(r.other,0);
});

check('远征实战执行星核与守卫技能，战斗回调仍可推进',()=>{
  const e=loaded();battleHarness(e);
  e.run(`Math.random=()=>0;S.formation={front:[{id:71001,type:'star_trooper',count:155}],mid:[],back:[]};S.items.trialFruit=100000`);
  assert.equal(e.run("openAwakeningTrial('easy').ok"),true);
  e.run('B.enemyUnits[0].hp=1000000;B.enemyUnits[0].maxHp=1000000'); // 仅测试战斗回调，确保守卫有出手机会。
  let steps=0;
  while(steps<100&&!e.run("B.msgs.some(x=>x.m.includes('圣域神技'))")){
    assert.equal(e.run('__step()'),true);steps++;
  }
  assert.ok(steps<100);
  assert.equal(e.run("B.msgs.some(x=>x.m.includes('星核贯穿'))"),true);
  assert.equal(e.run("B.msgs.some(x=>x.m.includes('圣域神技'))"),true);
});

check('驻军实际循环调用同一觉醒技能',()=>{
  const e=loaded();
  const result=e.run(`(()=>{Math.random=()=>0;CFG.garrisonInvade.maxRounds=1;
    S._garrisonForm={front:[{type:'star_trooper',count:10,id:71002}],mid:[],back:[]};
    let calls=0;const original=applyAwakeningOpeningSkills;
    applyAwakeningOpeningSkills=(a,t)=>{calls++;return original(a,t)};
    const battle=resolveGarrisonBattle({units:{wild_boar:[1000]}});
    return {calls,used:battle.ourUnits[0].awakeningOpeningUsed,enemyHp:battle.enemyUnits[0].hp};
  })()`);
  assert.ok(result.calls>0);assert.equal(result.used,true);assert.ok(result.enemyHp<1000);
});

check('试炼守卫受损后按剩余人数出手，普通单体Boss仍用固定规模',()=>{
  const e=loaded();
  const result=e.run(`(()=>{S._awakeningTrial={mode:'easy',level:5,paid:true};S.battleEncounter='awakeningTrial';initBattleState();
    const guard=B.enemyUnits[0],entry=guard.attackMass;
    const full=combatAttackMass(guard);
    const garrisonTarget={type:'star_trooper',tag:'iron',def:0,hp:4000,maxHp:4000,alive:true};
    Math.random=()=>0.5;const garrisonFull=calcGarrisonDmg(guard,garrisonTarget);
    applyCombatDamage(guard,Math.floor(guard.maxHp/2));
    const garrisonWounded=calcGarrisonDmg(guard,garrisonTarget);
    Math.random=()=>0;const wounded=combatAttackMass(guard);
    const target={type:'star_trooper',initialCount:1000,hpPerSoldier:4,hp:4000,maxHp:4000,alive:true};
    const extra=applyEasyTrialGuardAttackSkill(guard,target);
    const single={type:'revival_god',attackMass:47,hp:100,maxHp:200,alive:true};
    initBattleState();const fresh=combatAttackMass(B.enemyUnits[0]);
    return {entry,full,wounded,garrisonFull,garrisonWounded,expected:Math.ceil(entry*guard.hp/guard.maxHp),extra,
      expectedExtra:Math.floor(wounded*guard.atk*CFG.awakening.combatSkills.easyGuardTrueHit.attackPct*CFG.awakening.combatSkills.easyGuardTrueHit.localHpScale),
      single:combatAttackMass(single),fresh};
  })()`);
  assert.equal(result.entry,546);assert.equal(result.full,546);
  assert.equal(result.wounded,result.expected);assert.ok(result.wounded<result.full);
  assert.ok(result.garrisonWounded<result.garrisonFull);
  assert.equal(result.extra,result.expectedExtra);
  assert.equal(result.single,47);
  assert.equal(result.fresh,546);
});

console.log(`awakening combat skills: ${passed}/7`);
