'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const paidSave=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p245-outer-village-l10-save.json'),'utf8').trim();
const silverPaidSave=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p256-outer-city-first-silver-save.json'),'utf8').trim();
const goldPaidSave=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p258-outer-capital-gold-army-save.json'),'utf8').trim();
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function battleEnvironment(save=paidSave){
  const e=environment({rts_save:save});
  const old=JSON.parse(save),needsNuclearFill=!Object.hasOwn(old.eraStorage,'nuclearKnowledge');
  assert.equal(e.run('loadSaveAndApply().status'),needsNuclearFill?'migrated':'ok');
  if(needsNuclearFill)assert.equal(e.store.get('rts_save_premigration'),save);
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
      return __nodes.get(id)
    };
    globalThis.addLog=message=>S.log.push(String(message));
    globalThis.__rng=1009+11*9176;
    Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<1000&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}
function placeGoldArmy(e){
  e.run("clrForm('expedition')");
  for(const [row,slot,type,count] of [['front',0,'bronze_guard',15],
    ['front',1,'gold_cavalry',15],['back',0,'archer_t1',13]]){
    e.run(`openFormModal('expedition','${row}',${slot});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(e.run(`S.formation.${row}[${slot}].count`),count);
  }
}

check('外域入口要求青铜研究、非空编队，未知区域不能借道其它副本',()=>{
  const e=battleEnvironment();
  e.run("S.sciences=S.sciences.filter(x=>x!=='sci_bronze_age');openDevelopmentOuter('village')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences.push('sci_bronze_age');S.formation={front:[],mid:[],back:[]};openDevelopmentOuter('village')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("openDevelopmentOuter('capital');openDevelopmentOuter('unknown')");
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run('S.development.outer.village.wins'),0);
});

check('实付L10无L19战前档真实胜村寨，地契勋章警戒同场保存并重载',()=>{
  const e=battleEnvironment();
  const before=JSON.parse(e.run('JSON.stringify({deed:S.res.deed,medal:S.res.medal,merit:S.merit,shield:S.essence.shield_essence||0,defeated:S.defeated})'));
  assert.deepEqual(before.defeated,Array.from({length:10},(_,i)=>i+1));
  e.run("openDevelopmentOuter('village')");
  assert.equal(e.run('S.battleEncounter'),'outerVillage');
  assert.equal(e.run('B.enemyCfg.name'),'外域军屯村寨');
  assert.equal(e.run('B.enemyUnits.length'),8);
  flushBattle(e);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  assert.equal(e.run('S.development.outer.village.wins'),1);
  assert.equal(e.run('S.development.outer.village.alert'),20);
  assert.equal(e.run('S.res.deed'),before.deed+12);
  assert.equal(e.run('S.res.medal'),before.medal+5);
  assert.equal(e.run('S.merit'),before.merit+5);
  assert.equal(e.run('S.essence.shield_essence'),before.shield+1);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.defeated)')),before.defeated);
  const saved=e.store.get('rts_save'),data=JSON.parse(saved);
  assert.equal(data.development.outer.village.wins,1);
  assert.equal(data.development.outer.village.alert,20);
  assert.equal(data.res.deed,before.deed+12);
  assert.equal(data.res.medal,before.medal+5);
  assert.equal(data.merit,before.merit+5);
  assert.equal(data.essence.shield_essence,before.shield+1);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/地契[^<]*\+12/);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/战备勋章[^<]*\+5/);
  e.run("endBattle('win');exitBattle()");
  assert.equal(e.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.development.outer.village.wins'),1);
  assert.equal(reload.run('S.res.deed'),before.deed+12);
  assert.equal(reload.run('S.res.medal'),before.medal+5);
  assert.equal(reload.run('S.merit'),before.merit+5);
  assert.equal(reload.run('S.essence.shield_essence'),before.shield+1);
});

check('外域警戒由本区字段增长，保留历史超出新试价上限的记录',()=>{
  const e=battleEnvironment();
  e.run("S.development.outer.village={wins:25,alert:500};openDevelopmentOuter('village')");
  assert.equal(e.run('B.enemyCfg.alert'),500);
  assert.ok(e.run('B.enemyCfg.units.infantry[0]')>6);
  e.run('fleeBattle()');
  e.run("S.development.outer.village={wins:650,alert:13020};openDevelopmentOuter('village');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(e.run('S.development.outer.village.wins'),651);
  assert.equal(e.run('S.development.outer.village.alert'),13020);
});

check('伪胜、败局与撤退不发地契勋章，也不推进外域警戒',()=>{
  const fake=battleEnvironment();
  fake.run("openDevelopmentOuter('village');endBattle('win')");
  assert.equal(fake.run('S.battleActive'),true);
  fake.run('fleeBattle()');
  assert.equal(fake.run('S.development.outer.village.wins'),0);
  assert.equal(fake.run('S.res.deed'),0);
  assert.equal(fake.run('S.res.medal'),0);
  const lost=battleEnvironment();
  lost.run("openDevelopmentOuter('village');endBattle('lose')");
  assert.equal(lost.run('S.development.outer.village.wins'),0);
  assert.equal(lost.run('S.development.outer.village.alert'),0);
  assert.equal(lost.run('S.res.deed'),0);
  assert.equal(lost.run('S.res.medal'),0);
});

check('地契勋章按各自仓容实际入库，历史超仓不裁剪',()=>{
  const cap=battleEnvironment();
  cap.run("S.res.deed=resCap('deed')-3;S.res.medal=resCap('medal')-2;openDevelopmentOuter('village');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(cap.run('S.res.deed'),cap.run("resCap('deed')"));
  assert.equal(cap.run('S.res.medal'),cap.run("resCap('medal')"));
  assert.match(cap.run("document.getElementById('battle-result').innerHTML"),/地契[^<]*\+3/);
  assert.match(cap.run("document.getElementById('battle-result').innerHTML"),/战备勋章[^<]*\+2/);
  const over=battleEnvironment();
  over.run("S.res.deed=resCap('deed')+9;S.res.medal=resCap('medal')+7;openDevelopmentOuter('village');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(over.run('S.res.deed'),over.run("resCap('deed')+9"));
  assert.equal(over.run('S.res.medal'),over.run("resCap('medal')+7"));
});

check('主档写入失败时战损、奖励、区域胜次和日志同场回滚',()=>{
  const e=battleEnvironment();
  e.run('save()');const raw=e.store.get('rts_save');
  e.run("openDevelopmentOuter('village')");
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})');
  e.run(`B.ourUnits[0].hp=1;B.ourUnits[0].alive=true;
    B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');`);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

check('历史离线窗口未封口时拒绝外域战，避免战后保存替代离线结算',()=>{
  const e=battleEnvironment();
  e.run("S.offline.populationFoodRule='legacy-pending';settleOffline=()=>({ok:false,reason:'save-failed'})");
  e.run("openDevelopmentOuter('village')");
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run('S.development.outer.village.wins'),0);
});

check('工造军镇需真实铁器研究；零村寨胜场可付铁仓、练铁兵并胜军镇',()=>{
  const e=battleEnvironment();
  e.run("openDevelopmentOuter('town')");
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run('S.development.outer.town.wins'),0);
  assert.equal(e.run("researchScience('sci_iron_warehouse').ok"),true);
  assert.equal(e.run('S.res.tech'),1600);
  assert.equal(e.run("buildAct('iron_store').ok"),false);
  assert.equal(e.run("setPopAlloc('wood',S.popAlloc.wood-1).ok"),true);
  assert.equal(e.run("setPopAlloc('iron',S.popAlloc.iron+1).ok"),true);
  let ironSeconds=0;
  while(e.run('S.res.iron')<300&&ironSeconds<1000){e.run('tick()');ironSeconds++}
  assert.ok(ironSeconds<1000);
  assert.equal(e.run("buildAct('iron_store').ok"),true);
  assert.equal(e.run('S.res.iron'),100);
  for(let n=0;n<8;n++)e.run('tick()');
  assert.equal(e.run("bldSt('iron_store').lv"),1);
  assert.equal(e.run("setPopAlloc('iron',S.popAlloc.iron-1).ok"),true);
  assert.equal(e.run("setPopAlloc('tech',S.popAlloc.tech+1).ok"),true);
  let knowledgeSeconds=0;
  while(e.run('S.res.tech')<2500&&knowledgeSeconds<7200){e.run('tick()');knowledgeSeconds++}
  assert.ok(knowledgeSeconds<7200);
  assert.equal(e.run("researchScience('sci_iron_age').ok"),true);
  assert.equal(e.run("buildAct('iron_forge').ok"),true);
  for(let n=0;n<10;n++)e.run('tick()');
  assert.equal(e.run("bldSt('iron_forge').lv"),1);
  assert.equal(e.run("train('iron_spearman',1).ok"),true);
  e.run('tick()');
  assert.equal(e.run('(S.pool.iron_spearman||0)+expeditionCount(\'iron_spearman\')'),1);
  const paid=e.store.get('rts_save');
  const live=battleEnvironment(paid);
  assert.equal(live.run('S.development.outer.village.wins'),0);
  assert.equal(live.run('S.defeated.length'),10);
  const deeds=live.run('S.res.deed'),medals=live.run('S.res.medal'),merit=live.run('S.merit');
  const bow=live.run('S.essence.bow_essence||0'),wind=live.run('S.essence.wind_essence||0');
  live.run("openDevelopmentOuter('town')");
  assert.equal(live.run('S.battleEncounter'),'outerTown');
  assert.equal(live.run('B.enemyCfg.name'),'外域工造军镇');
  flushBattle(live);
  assert.equal(live.run("document.getElementById('battle-result').className"),'win');
  assert.equal(live.run('S.development.outer.town.wins'),1);
  assert.equal(live.run('S.development.outer.town.alert'),20);
  assert.equal(live.run('S.development.outer.village.wins'),0);
  assert.equal(live.run('S.res.deed'),deeds+20);
  assert.equal(live.run('S.res.medal'),medals+7);
  assert.equal(live.run('S.merit'),merit+7);
  assert.equal(live.run('S.essence.bow_essence'),bow+1);
  assert.equal(live.run('S.essence.wind_essence'),wind+1);
  assert.equal(live.run('S.defeated.length'),10);
  const battleSave=live.store.get('rts_save');
  live.run("endBattle('win');exitBattle()");
  assert.equal(live.store.get('rts_save'),battleSave);
  const reloaded=environment({rts_save:battleSave});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.development.outer.town.wins'),1);
  assert.equal(reloaded.run('S.res.deed'),deeds+20);
  assert.equal(reloaded.run('S.res.medal'),medals+7);
  assert.equal(reloaded.run('S.merit'),merit+7);
  assert.equal(reloaded.run('S.essence.bow_essence'),bow+1);
  assert.equal(reloaded.run('S.essence.wind_essence'),wind+1);
});

check('工造军镇胜利写档失败时独立警戒、奖励、战损同场回滚',()=>{
  const e=battleEnvironment();
  e.run("S.sciences.push('sci_iron_age');save()");
  const raw=e.store.get('rts_save');
  e.run("openDevelopmentOuter('town')");
  assert.equal(e.run('S.battleActive'),true);
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})');
  e.run(`B.ourUnits[0].hp=1;B.ourUnits[0].alive=true;
    B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');`);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

check('铸银城塞需白银时代；零外域胜场实付档可真实首胜并保存独立奖励',()=>{
  const gated=battleEnvironment();
  gated.run("openDevelopmentOuter('city')");
  assert.equal(gated.run('S.battleActive'),false);
  assert.equal(gated.run('S.development.outer.city.wins'),0);
  const e=battleEnvironment(silverPaidSave);
  assert.equal(e.run("scienceUnlocked('sci_silver_age')"),true);
  assert.equal(e.run('S.defeated.length'),10);
  assert.equal(e.run('S.development.outer.village.wins'),0);
  assert.equal(e.run('S.development.outer.town.wins'),0);
  const before=e.run('JSON.stringify({deed:S.res.deed,medal:S.res.medal,merit:S.merit,defeated:S.defeated})');
  e.run("openDevelopmentOuter('city')");
  assert.equal(e.run('S.battleEncounter'),'outerCity');
  assert.equal(e.run('B.enemyCfg.name'),'外域铸银城塞');
  assert.equal(e.run('B.enemyUnits.length'),10);
  flushBattle(e);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  const start=JSON.parse(before);
  assert.equal(e.run('S.development.outer.city.wins'),1);
  assert.equal(e.run('S.development.outer.city.alert'),20);
  assert.equal(e.run('S.development.outer.village.wins'),0);
  assert.equal(e.run('S.development.outer.town.wins'),0);
  assert.equal(e.run('S.res.deed'),start.deed+32);
  assert.equal(e.run('S.res.medal'),start.medal+10);
  assert.equal(e.run('S.merit'),start.merit+10);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.defeated)')),start.defeated);
  const saved=e.store.get('rts_save'),data=JSON.parse(saved);
  assert.equal(data.development.outer.city.wins,1);
  assert.equal(data.development.outer.city.alert,20);
  assert.equal(data.res.deed,start.deed+32);
  assert.equal(data.res.medal,start.medal+10);
  assert.equal(data.merit,start.merit+10);
  e.run("endBattle('win');exitBattle()");
  assert.equal(e.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.development.outer.city.wins'),1);
  assert.equal(reload.run('S.res.deed'),start.deed+32);
  assert.equal(reload.run('S.res.medal'),start.medal+10);
  assert.equal(reload.run('S.merit'),start.merit+10);
});

check('铸银城塞写档失败时战损、区域进度与奖励整场回滚',()=>{
  const e=battleEnvironment(silverPaidSave);
  e.run('save()');const raw=e.store.get('rts_save');
  e.run("openDevelopmentOuter('city')");
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})');
  e.run(`B.ourUnits[0].hp=1;B.ourUnits[0].alive=true;
    B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');`);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

check('铸金王都需黄金时代；零外域胜场实付档可真实首胜并保存独立奖励',()=>{
  const gated=battleEnvironment(silverPaidSave);
  gated.run("openDevelopmentOuter('capital')");
  assert.equal(gated.run('S.battleActive'),false);
  const e=battleEnvironment(goldPaidSave);
  assert.equal(e.run("scienceUnlocked('sci_gold_age')"),true);
  assert.equal(e.run('S.defeated.length'),10);
  for(const region of ['village','town','city','capital'])
    assert.equal(e.run(`S.development.outer.${region}.wins`),0);
  placeGoldArmy(e);
  const before=JSON.parse(e.run('JSON.stringify({deed:S.res.deed,medal:S.res.medal,merit:S.merit,defeated:S.defeated})'));
  e.run("openDevelopmentOuter('capital')");
  assert.equal(e.run('S.battleEncounter'),'outerCapital');
  assert.equal(e.run('B.enemyCfg.name'),'外域铸金王都');
  assert.equal(e.run('B.enemyUnits.length'),13);
  flushBattle(e);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  assert.equal(e.run('S.development.outer.capital.wins'),1);
  assert.equal(e.run('S.development.outer.capital.alert'),20);
  for(const region of ['village','town','city'])
    assert.equal(e.run(`S.development.outer.${region}.wins`),0);
  assert.equal(e.run('S.res.deed'),before.deed+40);
  assert.equal(e.run('S.res.medal'),before.medal+20);
  assert.equal(e.run('S.merit'),before.merit+15);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.defeated)')),before.defeated);
  const saved=e.store.get('rts_save'),data=JSON.parse(saved);
  assert.equal(data.development.outer.capital.wins,1);
  assert.equal(data.development.outer.capital.alert,20);
  assert.equal(data.res.deed,before.deed+40);
  assert.equal(data.res.medal,before.medal+20);
  assert.equal(data.merit,before.merit+15);
  e.run("endBattle('win');exitBattle()");
  assert.equal(e.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.development.outer.capital.wins'),1);
  assert.equal(reload.run('S.res.deed'),before.deed+40);
  assert.equal(reload.run('S.res.medal'),before.medal+20);
  assert.equal(reload.run('S.merit'),before.merit+15);
});

check('铸金王都写档失败时战损、区域进度与奖励整场回滚',()=>{
  const e=battleEnvironment(goldPaidSave);
  placeGoldArmy(e);
  e.run('save()');const raw=e.store.get('rts_save');
  e.run("openDevelopmentOuter('capital')");
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})');
  e.run(`B.ourUnits[0].hp=1;B.ourUnits[0].alive=true;
    B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');`);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res,merit:S.merit,essence:S.essence})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
