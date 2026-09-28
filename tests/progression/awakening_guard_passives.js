'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p279-awakening-star155-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function loaded(){const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');assert.equal(e.store.get('rts_save_premigration'),source);return e}

check('首次防御压制临时超额属性但不治疗、不增加持久兵员',()=>{
  const e=loaded(),saved=e.store.get('rts_save');
  const r=e.run(`(()=>{
    const guard={type:'trial_guard_easy',hp:1000,maxHp:1000,atk:2,entryAtk:20,def:0,entryDef:30,alive:true};
    const attacker={type:'star_trooper',initialCount:10,hpPerSoldier:4,hp:100,maxHp:200,atk:200,entryAtk:40,def:100,entryDef:5,alive:true};
    const effect=applyTrialGuardDefensePassives(guard,attacker,[guard],[attacker]);
    return{effect,guard:{atk:guard.atk,def:guard.def},attacker:{hp:attacker.hp,maxHp:attacker.maxHp,atk:attacker.atk,def:attacker.def},army:armyCount()};
  })()`);
  assert.deepEqual({...r.guard},{atk:14,def:3});
  assert.deepEqual({...r.attacker},{hp:100,maxHp:120,atk:120,def:15});
  assert.equal(r.army,671);assert.equal(e.store.get('rts_save'),saved);
});

check('永久兵装计入进场面板，不被三倍临时增益限制误裁剪',()=>{
  const e=loaded();
  const r=e.run(`(()=>{
    const guard={type:'trial_guard_easy',hp:1000,maxHp:1000,atk:16,entryAtk:16,def:23,entryDef:23,alive:true};
    const attacker={type:'star_trooper',initialCount:10,hpPerSoldier:4,hp:40,maxHp:40,atk:220,entryAtk:220,def:100,entryDef:100,alive:true};
    applyTrialGuardDefensePassives(guard,attacker,[guard],[attacker]);
    return{atk:attacker.atk,def:attacker.def,hp:attacker.hp,maxHp:attacker.maxHp};
  })()`);
  assert.deepEqual({...r},{atk:220,def:100,hp:40,maxHp:40});
});

check('守卫攻防下限逐次防御有效，首次人数增攻只结算一次',()=>{
  const e=loaded();
  const r=e.run(`(()=>{
    const guard={type:'trial_guard_easy',hp:1000,maxHp:1000,atk:1,entryAtk:20,def:0,entryDef:30,alive:true};
    const attacker={type:'star_trooper',initialCount:1100,hpPerSoldier:4,hp:4400,maxHp:4400,atk:40,entryAtk:40,def:0,entryDef:0,alive:true};
    const first=applyTrialGuardDefensePassives(guard,attacker,[guard],[attacker]);
    guard.atk=1;guard.def=0;
    const second=applyTrialGuardDefensePassives(guard,attacker,[guard],[attacker]);
    return{first,second,guard:{atk:guard.atk,def:guard.def},firstUsed:guard.guardFirstDefenseUsed};
  })()`);
  assert.equal(r.first.teamAtkAdded,0.4);
  assert.equal(r.second.teamAtkAdded,0);
  assert.ok(Math.abs(r.guard.atk-14)<1e-9);assert.equal(r.guard.def,3);assert.equal(r.firstUsed,true);
});

check('不足1000人、普通Boss与已死亡守卫不获得试炼被动',()=>{
  const e=loaded();
  const r=e.run(`(()=>{
    const actor={type:'star_trooper',initialCount:999,hpPerSoldier:4,hp:3996,maxHp:3996,atk:40,entryAtk:40,def:0,entryDef:0,alive:true};
    const guard={type:'trial_guard_easy',hp:1000,maxHp:1000,atk:16,entryAtk:16,def:23,entryDef:23,alive:true};
    const noBuff=applyTrialGuardDefensePassives(guard,actor,[guard],[actor]);
    const ordinary={type:'revival_god',hp:1000,maxHp:1000,atk:1,def:0,alive:true};
    const other=applyTrialGuardDefensePassives(ordinary,actor,[ordinary],[actor]);
    const dead={type:'trial_guard_easy',hp:0,maxHp:1000,atk:1,entryAtk:20,def:0,entryDef:30,alive:false};
    const stopped=applyTrialGuardDefensePassives(dead,actor,[dead],[actor]);
    return{noBuff,other,stopped,ordinary:{atk:ordinary.atk,def:ordinary.def},dead:{atk:dead.atk,def:dead.def}};
  })()`);
  assert.equal(r.noBuff.teamAtkAdded,0);assert.equal(r.other.teamAtkAdded,0);assert.equal(r.stopped.teamAtkAdded,0);
  assert.deepEqual({...r.ordinary},{atk:1,def:0});assert.deepEqual({...r.dead},{atk:1,def:0});
});

check('远征和驻军真实回合均调用试炼守卫防御路径',()=>{
  const e=loaded();
  const r=e.run(`(()=>{
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.formation={front:[{id:90001,type:'star_trooper',count:55}],mid:[],back:[]};
    S.items.trialFruit=1000;
    let calls=0;const original=applyTrialGuardDefensePassives;
    applyTrialGuardDefensePassives=(...args)=>{calls++;return original(...args)};
    const opened=openAwakeningTrial('easy');let steps=0;
    while(S.battleActive&&steps<4000){if(!__step())throw Error('timer exhausted');steps++}
    const expeditionCalls=calls,expeditionUsed=B.enemyUnits[0].guardFirstDefenseUsed;
    S._garrisonForm={front:[{id:90002,type:'star_trooper',count:55}],mid:[],back:[]};
    CFG.garrisonInvade.maxRounds=1;calls=0;
    const garrison=resolveGarrisonBattle({units:{trial_guard_easy:[1000]}});
    return{opened:opened.ok,steps,expeditionCalls,expeditionUsed,garrisonCalls:calls,
      garrisonUsed:garrison.enemyUnits[0].guardFirstDefenseUsed};
  })()`);
  assert.equal(r.opened,true);assert.ok(r.steps>0);assert.ok(r.expeditionCalls>0);assert.equal(r.expeditionUsed,true);
  assert.ok(r.garrisonCalls>0);assert.equal(r.garrisonUsed,true);
});

console.log(`awakening guard passives: ${passed}/5`);
