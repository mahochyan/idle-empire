'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p273-nuclear-knowledge-six-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function battleHarness(e){
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    Math.random=()=>0.5;`);
}
function finish(e){let n=0;while(e.run('S.battleActive')&&n<2000){assert.equal(e.run('__step()'),true);n++}assert.ok(n<2000);return e.run("document.getElementById('battle-result').className")}

check('母本试炼与异果来源独立于兵装，旧v32安全补零并拒绝损坏进度',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('S.awakening.star_trooper.level'),0);
  assert.equal(e.run('S.awakening.star_trooper.stars'),0);
  assert.equal(e.run('S.items.trialFruit'),0);
  assert.equal(e.run('S.killValues.godSilence'),0);
  assert.equal(e.store.get('rts_save_premigration'),source);
  assert.equal(e.run('CFG.awakening.maxLevel'),20);
  assert.equal(e.run('CFG.godDomains.trialFruit.units.silence_god[0]'),40);
  e.run("S.formation={front:[{id:1,type:'electro_trooper',count:55},{id:2,type:'star_trooper',count:1}],mid:[],back:[]}");
  assert.equal(e.run('awakeningTrialCost()'),55); // 母本 playerData[0].Num，只取首个出战兵团。
  e.run('S.formation.front.reverse()');assert.equal(e.run('awakeningTrialCost()'),1);
  const d=JSON.parse(e.store.get('rts_save'));d.awakening.star_trooper.tracks.easy=1;
  const bad=JSON.stringify(d),f=environment({rts_save:bad});assert.equal(f.run('loadSaveAndApply().status'),'invalid');
  f.run('tick();save()');assert.equal(f.store.get('rts_save'),bad);
  const blocked=environment({rts_save:source});
  blocked.run("const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');oldSet(k,v)}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.store.get('rts_save'),source);
  assert.equal(blocked.run('S.population.current'),0);
});

check('缄默神域真实战斗胜利产异果，警戒增长且只结算一次',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
  e.run("openMaterialDomain('trialFruit')");assert.equal(e.run('S.battleActive'),true);
  assert.equal(finish(e),'win');
  assert.equal(e.run('S.items.trialFruit'),2);
  assert.equal(e.run('S.killValues.godSilence'),100);
  e.run("endBattle('win')");assert.equal(e.run('S.items.trialFruit'),2);
});

check('试炼必须有目标兵并支付异果；真胜升阶加星，远征驻军共享全军基础属性',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
  assert.equal(e.run("openAwakeningTrial('easy').reason"),'unit-not-deployed');
  e.run("S.formation.front[0]={id:9001,type:'star_trooper',count:1};S.items.trialFruit=1000;save()");
  const cost=e.run('awakeningTrialCost()');assert.equal(cost,1);
  e.run("openBattle('awakeningTrial')");assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run("openAwakeningTrial('easy').ok"),true);
  assert.equal(e.run('S.items.trialFruit'),1000-cost);
  assert.equal(e.run('S.battleActive'),true);
  assert.equal(e.run('B.enemyUnits[0].attackMass'),126);
  assert.equal(e.run('B.enemyUnits[0].hp'),5556);
  assert.equal(e.run('B.enemyUnits[0].atk'),6);
  assert.equal(e.run('B.enemyUnits[0].def'),10);
  assert.equal(finish(e),'win');
  assert.equal(e.run('S.awakening.star_trooper.level'),1);
  assert.equal(e.run('S.awakening.star_trooper.stars'),1);
  assert.equal(e.run('S.awakening.star_trooper.tracks.easy'),1);
  e.run("endBattle('win')");assert.equal(e.run('S.awakening.star_trooper.level'),1);
  const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.awakening.star_trooper.stars'),1);
  assert.equal(reload.run("weaponAttack('star_trooper')"),e.run("weaponAttack('star_trooper')"));
  e.run("S.awakening.star_trooper={level:10,stars:100,tracks:{easy:10,perfect:0,extreme:0}}");
  const boosted=e.run("weaponAttack('star_trooper')"),hp=e.run("battleVitals('star_trooper',1,true).hp");
  assert.ok(boosted>reload.run("weaponAttack('star_trooper')"));assert.ok(hp>reload.run("battleVitals('star_trooper',1,true).hp"));
  e.run("S._garrisonForm={front:[{type:'star_trooper',count:1,id:9010}],mid:[],back:[]}");
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),boosted);
});

check('第6阶奖励按阶段与难度加星，历史极限选择会抬升守卫强度',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
  e.run("S.formation={front:[{id:9001,type:'star_trooper',count:1}],mid:[],back:[]};S.items.trialFruit=100;S.awakening.star_trooper={level:5,stars:5,tracks:{easy:5,perfect:0,extreme:0}};save()");
  const easyHistory=e.run("(()=>{S._awakeningTrial={mode:'perfect',level:5,paid:true};return materialDomainEncounter('awakeningTrial').units.trial_guard_perfect[0]})()");
  const extremeHistory=e.run("(()=>{S.awakening.star_trooper.tracks={easy:0,perfect:0,extreme:5};return materialDomainEncounter('awakeningTrial').units.trial_guard_perfect[0]})()");
  assert.ok(extremeHistory>easyHistory);
  e.run("S.awakening.star_trooper.tracks={easy:5,perfect:0,extreme:0};S._awakeningTrial=null");
  assert.equal(e.run("openAwakeningTrial('perfect').ok"),true);
  e.run("B.enemyUnits.forEach(u=>{u.hp=0;u.alive=false});endBattle('win')"); // 只验证真实结算函数，不把该构造当作实战通关。
  assert.equal(e.run('S.awakening.star_trooper.level'),6);
  assert.equal(e.run('S.awakening.star_trooper.stars'),9);
  assert.equal(e.run('S.awakening.star_trooper.tracks.perfect'),1);
});

check('三档首战按母本下一胜场分别生成守卫人数和攻生防，不把难度直接乘所有属性',()=>{
  const expected={easy:{mass:126,hp:5556,atk:6,def:10},
    perfect:{mass:147,hp:6791,atk:6,def:11},extreme:{mass:189,hp:9525,atk:7,def:12}};
  for(const [mode,stats] of Object.entries(expected)){
    const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
    e.run("S.formation={front:[{id:9001,type:'star_trooper',count:1}],mid:[],back:[]};S.items.trialFruit=10;save()");
    assert.equal(e.run(`openAwakeningTrial('${mode}').ok`),true);
    const actual=e.run('({mass:B.enemyUnits[0].attackMass,hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),stats);
  }
});

check('P274旧口径已付款档原样可读，改价不追溯虚构退款',()=>{
  const old=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p274-awakening-first-paid-save.json'),'utf8');
  const e=environment({rts_save:old});assert.equal(e.run('loadSaveAndApply().status'),'migrated');assert.equal(e.store.get('rts_save_premigration'),old);
  assert.equal(e.run('S.awakening.star_trooper.level'),1);
  assert.equal(e.run('S.awakening.star_trooper.stars'),1);
  assert.equal(e.run('S.items.trialFruit'),43);
  assert.equal(e.run('awakeningTrialCost()'),11);
  e.run('save()');assert.equal(JSON.parse(e.store.get('rts_save')).items.trialFruit,43);
});

check('扣费写档失败回滚；战败消耗异果但不得升阶',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
  e.run("S.formation={front:[{id:9001,type:'star_trooper',count:1}],mid:[],back:[]};S.items.trialFruit=3;save()");
  const stable=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)}");
  assert.equal(e.run("openAwakeningTrial('easy').reason"),'save-failed');
  assert.equal(e.run('S.items.trialFruit'),3);assert.equal(e.store.get('rts_save'),stable);
  e.run('localStorage.setItem=oldSet');
  assert.equal(e.run("openAwakeningTrial('easy').ok"),true);
  e.run("endBattle('lose')");
  assert.equal(e.run('S.awakening.star_trooper.level'),0);
  assert.equal(e.run('S.items.trialFruit'),2);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.awakening.star_trooper.level'),0);assert.equal(reload.run('S.items.trialFruit'),2);
});
check('胜利结算写档失败回滚阶数与星辉，保留已支付的开战费用',()=>{
  const e=environment({rts_save:source});assert.equal(e.run('loadSaveAndApply().status'),'migrated');battleHarness(e);
  e.run("S.formation={front:[{id:9001,type:'star_trooper',count:1}],mid:[],back:[]};S.items.trialFruit=3;save()");
  assert.equal(e.run("openAwakeningTrial('easy').ok"),true);
  const paid=e.store.get('rts_save');
  e.run("const oldSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};B.enemyUnits.forEach(u=>{u.hp=0;u.alive=false});endBattle('win')");
  assert.equal(e.run('S.awakening.star_trooper.level'),0);
  assert.equal(e.run('S.awakening.star_trooper.stars'),0);
  assert.equal(e.run('S.items.trialFruit'),2);
  assert.equal(e.store.get('rts_save'),paid);
  assert.equal(JSON.parse(paid).awakening.star_trooper.level,0);
});
console.log(`awakening trial: ${passed}/8`);
