'use strict';
// node tests/progression/awakening_star_third.js
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function actor(id=0){return{id,type:'star_trooper',initialCount:10,hpPerSoldier:4,
  hp:40,maxHp:40,entryAtk:0,entryDef:0,atk:0,def:0,alive:true}}
function enemy(hp,def=100){return{type:'infantry',initialCount:hp,hpPerSoldier:1,
  hp,maxHp:hp,def,shield:0,alive:true}}

check('100星首位兵团单次触发星辉裁决，敌方全体生命与防御下降且不写S',()=>{
  const e=environment(),saved=e.store.get('rts_save');
  const result=e.run(`(()=>{S.awakening.star_trooper.level=20;S.awakening.star_trooper.stars=100;
    Math.random=()=>0;const first=${actor.toString()}(0);
    const a=${enemy.toString()}(1000,100),b=${enemy.toString()}(500,50);
    const hit=applyAwakeningOpeningSkills(first,a,[a,b]);
    const again=applyAwakeningOpeningSkills(first,a,[a,b]);
    return{hit,again,a:{hp:a.hp,def:a.def},b:{hp:b.hp,def:b.def},pool:{...S.pool}}})()`);
  assert.equal(result.hit.areaDamage,150);
  assert.equal(result.hit.areaDefReduced,6);
  assert.equal(result.hit.areaTargets,2);
  assert.deepEqual(JSON.parse(JSON.stringify(result.a)),{hp:900,def:96});
  assert.deepEqual(JSON.parse(JSON.stringify(result.b)),{hp:450,def:48});
  assert.equal(result.again.areaDamage,0);
  assert.equal(e.store.get('rts_save'),saved);
});

check('99星、非首位、已受伤目标或未命中均不会触发',()=>{
  const e=environment();
  const result=e.run(`(()=>{Math.random=()=>0;
    const mkActor=${actor.toString()},mkEnemy=${enemy.toString()};
    function trial(stars,id,hp,roll){S.awakening.star_trooper.level=20;S.awakening.star_trooper.stars=stars;
      Math.random=()=>roll;const a=mkEnemy(1000),b=mkEnemy(500);a.hp=hp;
      const r=applyAwakeningOpeningSkills(mkActor(id),a,[a,b]);return{r,aHp:a.hp,bHp:b.hp,bDef:b.def}}
    return{low:trial(99,0,1000,0),late:trial(100,1,1000,0),wounded:trial(100,0,989,0),
      missed:trial(100,0,1000,0.99)}})()`);
  for(const row of Object.values(result)){
    assert.equal(row.r.areaDamage,0);assert.equal(row.r.areaDefReduced,0);
    assert.equal(row.bHp,500);assert.equal(row.bDef,100);
  }
});

check('概率先取整，入场单兵生命每2000源值额外削防且总削防封顶20%',()=>{
  const e=environment();
  const result=e.run(`(()=>{S.awakening.star_trooper.level=20;S.awakening.star_trooper.stars=100;
    const mkActor=${actor.toString()},mkEnemy=${enemy.toString()};
    function trial(per,roll){const a=mkEnemy(1000,100),u=mkActor();u.hpPerSoldier=per;u.hp=per;u.maxHp=per;
      Math.random=()=>roll;const r=applyAwakeningOpeningSkills(u,a,[a]);return{r,def:a.def}}
    return{miss:trial(4,0.7),step:trial(20,0),cap:trial(200,0)}})()`);
  assert.equal(result.miss.r.areaTargets,0);assert.equal(result.miss.def,100);
  assert.equal(result.step.def,94);assert.equal(result.cap.def,80);
});

check('已受伤的旁支目标不被群体效果治疗，临时护盾不转成士兵',()=>{
  const e=environment();
  const result=e.run(`(()=>{S.awakening.star_trooper.level=20;S.awakening.star_trooper.stars=100;
    Math.random=()=>0;const mkActor=${actor.toString()},mkEnemy=${enemy.toString()};
    const a=mkEnemy(1000),b=mkEnemy(500);b.hp=200;b.shield=60;
    const r=applyAwakeningOpeningSkills(mkActor(),a,[a,b]);
    return{r,aHp:a.hp,bHp:b.hp,bShield:b.shield,bSurvivors:combatSurvivors(b)}})()`);
  assert.equal(result.aHp,900);assert.equal(result.bHp,200);
  assert.equal(result.bShield,60);assert.equal(result.bSurvivors,200);
  assert.equal(result.r.areaDamage,100);
});

check('远征真实战斗回调可见星辉裁决且正常结算',()=>{
  const e=environment();
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));Math.random=()=>0;
    S.sciences.push('sci_nuclear_age');S.awakening.star_trooper={level:20,stars:100,tracks:{easy:20,perfect:0,extreme:0}};
    S.pool.star_trooper=10;S.formation={front:[{id:101,type:'star_trooper',count:10}],mid:[],back:[]};
    selEnemy(0);openBattle();`);
  assert.equal(e.run('S.battleActive'),true);
  let callbacks=0;
  while(e.run('S.battleActive')&&callbacks++<200){assert.equal(e.run('__step()'),true)}
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run("B.msgs.some(x=>x.m.includes('星辉裁决'))"),true);
  assert.equal(e.run('saveProtected()'),false);
  const stored=e.store.get('rts_save');assert.ok(stored);
  const reload=environment({rts_save:stored});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.awakening.star_trooper.stars'),100);
});

check('驻军真实回合调用同源群体技能',()=>{
  const e=environment();
  const result=e.run(`(()=>{Math.random=()=>0;CFG.garrisonInvade.maxRounds=1;
    S.awakening.star_trooper={level:20,stars:100,tracks:{easy:20,perfect:0,extreme:0}};
    S._garrisonForm={front:[{type:'star_trooper',count:10,id:102}],mid:[],back:[]};
    const calls=[];const original=applyAwakeningOpeningSkills;
    applyAwakeningOpeningSkills=(a,t,foes)=>{const r=original(a,t,foes);calls.push(r);return r};
    const battle=resolveGarrisonBattle({units:{wild_boar:[100,100]}});
    return{calls,battle: {outcome:battle.outcome,enemyLeft:battle.enemyLeft}}})()`);
  assert.ok(result.calls.length>0);
  assert.ok(result.calls.some(x=>x.areaTargets===2&&x.areaDamage>0));
});

console.log(`awakening star third: ${passed}/6`);
