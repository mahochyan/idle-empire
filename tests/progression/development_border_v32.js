'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const paidSave=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p245-outer-village-l10-save.json'),'utf8').trim();
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function battleEnvironment(save=null){
  const e=environment(save?{rts_save:save}:{});
  if(save){
    const old=JSON.parse(save),needsNuclearFill=!Object.hasOwn(old.eraStorage,'nuclearKnowledge');
    assert.equal(e.run('loadSaveAndApply().status'),needsNuclearFill?'migrated':'ok');
    if(needsNuclearFill)assert.equal(e.store.get('rts_save_premigration'),save);
  }
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
    globalThis.addLog=message=>S.log.push(String(message));Math.random=()=>0.5;
  `);
  if(!save)e.run(`S.sciences=['sci_copper'];S.selEnemy=0;
    S.formation={front:[{type:'bronze_guard',count:8,id:101}],mid:[{type:'archer',count:13,id:102}],back:[]}`);
  return e;
}
function flushBattle(e){
  for(let n=0;n<1000&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}

check('边疆动作要求铜科技和非空编队，不能借主线按钮或未知点位绕过',()=>{
  const e=battleEnvironment();
  e.run("S.sciences=[];openDevelopmentBorder('copper')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences=['sci_copper'];S.formation={front:[],mid:[],back:[]};openDevelopmentBorder('copper')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("openDevelopmentBorder('silver')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("openDevelopmentBorder('godCrystal')");
  assert.equal(e.run('S.battleActive'),false,'未知边疆点位不能路由成其它特殊挑战');
  assert.equal(e.run('S.development.border.sites.copper.level'),0);
});

check('真实边疆首战授一级铜点与胜次，保存重载后仅选中点每60秒产铜',()=>{
  const e=battleEnvironment();
  const coinBefore=e.run('S.res.coin');
  e.run("openDevelopmentBorder('copper')");
  assert.equal(e.run('S.battleEncounter'),'borderCopper');
  assert.equal(e.run('B.enemyCfg.name'),'边疆铜脉哨站');
  assert.equal(e.run('B.enemyUnits.length'),3);
  flushBattle(e);
  assert.match(e.run("document.getElementById('battle-result').className"),/win/);
  assert.equal(e.run('S.development.border.sites.copper.level'),1);
  assert.equal(e.run('S.development.border.sites.copper.wins'),1);
  assert.equal(e.run('S.res.coin'),coinBefore+400);
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run('S.merit'),0);
  const saved=e.store.get('rts_save');
  assert.equal(JSON.parse(saved).development.border.sites.copper.level,1);
  assert.equal(JSON.parse(saved).res.coin,coinBefore+400);
  e.run("endBattle('win');exitBattle()");
  assert.equal(e.store.get('rts_save'),saved,'重复回调或退出不能二次授点');
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.development.border.sites.copper.wins'),1);
  assert.equal(reload.run('S.res.coin'),coinBefore+400);
  reload.run("S.popAlloc=Object.fromEntries(Object.keys(S.popAlloc).map(k=>[k,0]));S.population.current=0;S.res.copper=0;selectDevelopmentSite('copper');for(let i=0;i<60;i++)tick()");
  assert.equal(reload.run('S.res.copper'),2);
  assert.equal(reload.run('S.development.border.collection.activeSite'),'copper');
});

check('伪胜、败局和撤退不授点；矿点等级封顶但胜次仍可记录',()=>{
  const fake=battleEnvironment();fake.run("openDevelopmentBorder('copper');endBattle('win')");
  assert.equal(fake.run('S.battleActive'),true);
  assert.equal(fake.run('S.development.border.sites.copper.level'),0);
  fake.run('fleeBattle()');
  assert.equal(fake.run('S.development.border.sites.copper.wins'),0);
  assert.equal(fake.run('S.res.coin'),0);
  const lost=battleEnvironment();lost.run("openDevelopmentBorder('copper');endBattle('lose')");
  assert.equal(lost.run('S.development.border.sites.copper.level'),0);
  assert.equal(lost.run('S.development.border.sites.copper.wins'),0);
  assert.equal(lost.run('S.res.coin'),0);
  const capped=battleEnvironment();
  capped.run("S.development.border.sites.copper.level=500;S.development.border.sites.copper.wins=700;openDevelopmentBorder('copper');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(capped.run('S.development.border.sites.copper.level'),500);
  assert.equal(capped.run('S.development.border.sites.copper.wins'),701);
});

check('铜钱战利品按专仓实际上限入库，历史超仓不裁剪',()=>{
  const e=battleEnvironment();
  e.run("S.res.coin=resCap('coin')-30;openDevelopmentBorder('copper');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(e.run('S.res.coin'),e.run("resCap('coin')"));
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/铜钱[^<]*\+30/);
  assert.equal(JSON.parse(e.store.get('rts_save')).res.coin,e.run("resCap('coin')"));
  const over=battleEnvironment();
  over.run("S.res.coin=resCap('coin')+123;openDevelopmentBorder('copper');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(over.run('S.res.coin'),over.run("resCap('coin')+123"));
  assert.equal(JSON.parse(over.store.get('rts_save')).res.coin,over.run("resCap('coin')+123"));
});

check('警戒随本点胜次增长，500门槛改变敌压而不借用主线击败数',()=>{
  const e=battleEnvironment();
  e.run("S.defeated=[1,2,3,4,5];S.development.border.sites.copper.wins=10;openDevelopmentBorder('copper')");
  assert.equal(e.run('B.enemyCfg.alert'),200);
  assert.equal(e.run('B.enemyCfg.units.infantry[0]'),6);
  e.run('fleeBattle()');
  e.run("S.development.border.sites.copper.wins=25;openDevelopmentBorder('copper')");
  assert.equal(e.run('B.enemyCfg.alert'),500);
  assert.ok(e.run('B.enemyCfg.units.infantry[0]')>6);
  assert.equal(e.run('S.development.border.sites.copper.level'),0);
});

check('主档写入失败时战损、等级、胜次和日志同场回滚',()=>{
  const e=battleEnvironment();e.run('save()');
  const raw=e.store.get('rts_save');
  e.run("openDevelopmentBorder('copper')");
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res})');
  e.run(`
    B.ourUnits[0].hp=1;B.ourUnits[0].alive=true;
    B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');
  `);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

check('历史离线窗口未封口时拒绝开边疆战，防止战后事务被离线结算替代',()=>{
  const e=battleEnvironment();
  e.run("S.offline.populationFoodRule='legacy-pending';settleOffline=()=>({ok:false,reason:'save-failed'})");
  e.run("openDevelopmentBorder('copper')");
  assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run('S.development.border.sites.copper.level'),0);
});

check('未过第19关的实付档冶铁术后可胜铁点；授点、采集与主线成绩隔离',()=>{
  const e=battleEnvironment(paidSave);
  const defeated=JSON.parse(e.run('JSON.stringify(S.defeated)'));
  const beforeCoin=e.run('S.res.coin'),beforeGoldCoin=e.run('S.res.goldCoin'),beforeMerit=e.run('S.merit');
  assert.equal(defeated.includes(19),false);
  e.run("S.sciences=S.sciences.filter(id=>id!=='sci_iron');openDevelopmentBorder('iron')");
  assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences.push('sci_iron');openDevelopmentBorder('iron')");
  assert.equal(e.run('S.battleEncounter'),'borderIron');
  assert.equal(e.run('B.enemyCfg.name'),'边疆铁脉关隘');
  assert.equal(e.run('B.enemyUnits.length'),4);
  flushBattle(e);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  assert.equal(e.run('S.development.border.sites.iron.level'),1);
  assert.equal(e.run('S.development.border.sites.iron.wins'),1);
  assert.equal(e.run('S.res.coin'),beforeCoin);
  assert.equal(e.run('S.res.goldCoin'),beforeGoldCoin+50);
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.goldCoin'),beforeGoldCoin+50);
  assert.equal(e.run('S.merit'),beforeMerit);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.defeated)')),defeated);
  assert.doesNotMatch(e.run("document.getElementById('battle-result').innerHTML"),/铜钱[^<]*\+/);
  const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
  assert.equal(saved.development.border.sites.iron.level,1);
  assert.equal(saved.res.coin,beforeCoin);
  assert.equal(saved.res.goldCoin,beforeGoldCoin+50);
  const reload=battleEnvironment(raw);
  assert.equal(reload.run('S.development.border.sites.iron.wins'),1);
  assert.equal(reload.run('S.res.goldCoin'),beforeGoldCoin+50);
  assert.equal(reload.run('S.development.border.collection.activeSite'),null);
  reload.run("selectDevelopmentSite('iron')");
  const ironBefore=reload.run('S.res.iron');
  reload.run('for(let i=0;i<60;i++)tick()');
  assert.equal(reload.run('S.res.iron'),ironBefore+1);
  assert.equal(reload.run('S.development.border.collection.activeSite'),'iron');
});

check('铁点败逃不授级、上限后仍记胜次，历史铁库存超仓不裁剪',()=>{
  const lost=battleEnvironment(paidSave);
  lost.run("openDevelopmentBorder('iron');endBattle('lose')");
  assert.equal(lost.run('S.development.border.sites.iron.level'),0);
  assert.equal(lost.run('S.development.border.sites.iron.wins'),0);
  assert.equal(lost.run('S.res.goldCoin'),0);
  const capped=battleEnvironment(paidSave);
  capped.run("S.development.border.sites.iron={level:500,wins:700};S.res.iron=resCap('iron')+9;openDevelopmentBorder('iron');B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(capped.run('S.development.border.sites.iron.level'),500);
  assert.equal(capped.run('S.development.border.sites.iron.wins'),701);
  assert.equal(capped.run('S.res.goldCoin'),50);
  assert.equal(capped.run('S.res.iron'),capped.run("resCap('iron')+9"));
  assert.equal(JSON.parse(capped.store.get('rts_save')).development.border.sites.iron.wins,701);
});

check('铁点战斗写盘失败时等级、胜次、战损与资源同场回滚',()=>{
  const e=battleEnvironment(paidSave);
  e.run('save()');const raw=e.store.get('rts_save');
  e.run("openDevelopmentBorder('iron')");
  const before=e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res})');
  e.run(`B.ourUnits[0].hp=1;B.enemyUnits.forEach(u=>u.alive=false);
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win');`);
  assert.equal(e.run('JSON.stringify({formation:S.formation,development:S.development,log:S.log,res:S.res})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
