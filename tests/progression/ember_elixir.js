'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.resolve(__dirname,'../..');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const oldRaw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p292-sacred-bloodline-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function marketReady(){const e=environment();e.run("S.sciences=['sci_copper','sci_currency','sci_gold','sci_electric_age'];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");return e}
function battleReady(){const e=environment();e.run(`
  S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age','sci_god_domain'];
  S.buildings.barracks={lv:7,state:'idle'};
  S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>S.log.push(String(m));`);return e}

check('母本永久攻击道具、20血剂市场价与分档稀有掉落对齐',()=>{
  assert.equal(source[180002]['itemPill:AddATK'],10);
  assert.equal(source[180002]['itemPill:LimitNum'],30);
  assert.equal(source[380019]['market:Rate'],10);
  assert.deepEqual(source[380019]['market:Need'],[180001,20]);
  assert.deepEqual(source[380019]['market:Get'],[180002,1]);
  const deob=fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/deob_main.js'),'utf8');
  const start=deob.indexOf("'key':'winGodWar'");assert(start>=0);
  const body=deob.slice(start,start+5000);
  assert(body.includes('["per10000"](_0xcc0584)'));
  for(const chance of ['0x64','0xc8','0x12c','0x190'])assert(body.includes(chance));
  const e=environment();
  assert.equal(e.run('CFG.emberElixir.atkPerUse'),0.1);
  assert.equal(e.run('CFG.emberElixir.limitPerUnit'),30);
  assert.equal(e.run('CFG.market.special.weights.emberElixir'),10);
  for(const [alert,expected] of [[100,100],[2000,100],[2001,200],[4001,300],[6001,400]])
    assert.equal(e.run(`godEmberDropChance(${alert})`),expected);
  for(const key of ['godCrystal','phantomFlower','guardianStone','revivalLeaf','trialFruit','medal'])
    assert.equal(e.run(`materialDomainEncounter('${key}',1901).emberDropChance`),200,key);
  assert.equal(e.run("materialDomainEncounter('bone',0).emberDropChance"),undefined);
});

check('旧v32实付档候选迁移三处新字段并保护原文，合法零值往返',()=>{
  const e=environment({rts_save:oldRaw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),oldRaw);
  assert.equal(e.run('S.items.emberElixir'),0);
  assert.equal(e.run('S.marketSpecial.offers.emberElixir'),0);
  assert.equal(e.run('JSON.stringify(S.attackInfusions)'),'{}');
  e.run('S.attackInfusions.alloy_special=0;save()');
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.attackInfusions.alloy_special'),0);
  assert.equal(reload.run('S.items.emberElixir'),0);
  const noBackup=environment({rts_save:oldRaw});
  noBackup.run("globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');return __set(k,v)}");
  assert.equal(noBackup.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(noBackup.store.get('rts_save'),oldRaw);
});

check('真实货架扣20血剂买1战剂，刷新抽样、重载和旧货架补零',()=>{
  const e=marketReady(),run=e.run;
  run('S.marketSpecial.offers.emberElixir=1;S.items.sacredBlood=20;save()');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('emberElixir'))")).ok,true);
  assert.equal(run('S.items.sacredBlood'),0);
  assert.equal(run('S.items.emberElixir'),1);
  assert.equal(run('S.marketSpecial.offers.emberElixir'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.emberElixir'),1);
  const old=JSON.parse(e.store.get('rts_save'));delete old.marketSpecial.offers.emberElixir;
  const oldText=JSON.stringify(old),migration=environment({rts_save:oldText});
  assert.equal(migration.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migration.store.get('rts_save_premigration'),oldText);
  assert.equal(migration.run('S.marketSpecial.offers.emberElixir'),0);
  const rolls=marketReady();rolls.run('Math.random=()=>0.014;refreshMarketSpecial()');
  assert.equal(rolls.run('S.marketSpecial.offers.emberElixir'),10);
});

check('战剂只增指定我方基础攻击，远征驻军共用且不改变兵员生命',()=>{
  const e=environment(),run=e.run;
  run("S.pool.alloy_special=10;S.items.emberElixir=2;S._garrisonForm.front=[{type:'alloy_special',count:10,id:222}]");
  const base=run("weaponAttack('alloy_special')"),unitBase=run('CFG.units.alloy_special.atk');
  const hp=run("battleVitals('alloy_special',10,true).hp");
  assert.equal(JSON.parse(run("JSON.stringify(useEmberElixir('alloy_special',2))")).ok,true);
  assert.ok(Math.abs(run("weaponAttack('alloy_special')")-(base+unitBase*0.2))<1e-8);
  assert.ok(Math.abs(run('buildGarrisonUnitsFromForm()[0].atk')-run("weaponAttack('alloy_special')"))<1e-8);
  assert.equal(run("battleVitals('alloy_special',10,true).hp"),hp);
  assert.equal(run('S.pool.alloy_special'),10);
  assert.equal(run('S.items.emberElixir'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.attackInfusions.alloy_special'),2);
});

check('动作层阻止无兵种、敌方、战斗中、坏数量和超过30份',()=>{
  const e=environment(),run=e.run;run('S.pool.alloy_special=1;S.items.emberElixir=31');
  for(const [call,reason] of [["useEmberElixir('__proto__',1)",'invalid-unit'],["useEmberElixir('god_crystal_guard',1)",'invalid-unit'],
    ["useEmberElixir('armored_trooper',1)",'unit-unowned'],["useEmberElixir('alloy_special',0)",'invalid-quantity'],
    ["useEmberElixir('alloy_special',1.5)",'invalid-quantity'],["useEmberElixir('alloy_special',31)",'use-limit']])
    assert.equal(run(call+'.reason'),reason,call);
  run('S.battleActive=true');assert.equal(run("useEmberElixir('alloy_special',1).reason"),'battle-active');run('S.battleActive=false');
  assert.equal(run("useEmberElixir('alloy_special',30).ok"),true);
  assert.equal(run('S.attackInfusions.alloy_special'),30);
  assert.equal(run('S.items.emberElixir'),1);
  assert.equal(run("useEmberElixir('alloy_special',1).reason"),'use-limit');
});

check('战剂货架库存不足和写盘失败均不扣血剂或占货位',()=>{
  const e=marketReady(),run=e.run;
  run('S.marketSpecial.offers.emberElixir=1;S.items.sacredBlood=19;save()');
  assert.equal(run("buyMarketSpecial('emberElixir').reason"),'insufficient-resource');
  assert.equal(run('S.items.sacredBlood'),19);
  run('S.items.sacredBlood=20;save()');const raw=e.store.get('rts_save');
  run("globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');return __set(k,v)}");
  assert.equal(run("buyMarketSpecial('emberElixir').reason"),'save-failed');
  assert.equal(run('S.items.sacredBlood'),20);
  assert.equal(run('S.items.emberElixir'),0);
  assert.equal(run('S.marketSpecial.offers.emberElixir'),1);
  assert.equal(e.store.get('rts_save'),raw);
});

check('非法使用次数与新库存保护主档；备份或主档失败回滚使用',()=>{
  const e=environment();e.run('save()');const base=JSON.parse(e.store.get('rts_save'));
  for(const bad of [null,{god_crystal_guard:1},{alloy_special:-1},{alloy_special:31},JSON.parse('{"__proto__":1}')]){
    const edited=JSON.parse(JSON.stringify(base));edited.attackInfusions=bad;
    const raw=JSON.stringify(edited),blocked=environment({rts_save:raw});
    assert.equal(blocked.run('loadSaveAndApply().status'),'invalid');
    blocked.run('tick();save()');assert.equal(blocked.store.get('rts_save'),raw);
  }
  const edited=JSON.parse(JSON.stringify(base));edited.items.emberElixir=-1;
  assert.equal(environment({rts_save:JSON.stringify(edited)}).run('loadSaveAndApply().status'),'invalid');
  for(const failKey of ['rts_save','rts_save_backup_1']){
    const x=environment();x.run('S.pool.alloy_special=1;S.items.emberElixir=1;save()');const raw=x.store.get('rts_save');
    x.run(`globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${failKey}')throw Error('quota');return __set(k,v)}`);
    assert.equal(x.run("useEmberElixir('alloy_special',1).reason"),'save-failed');
    assert.equal(x.run('S.items.emberElixir'),1);
    assert.equal(x.run("'alloy_special' in S.attackInfusions"),false);
    assert.equal(x.store.get('rts_save'),raw);
  }
});

check('六神域只在胜利后按警戒稀有掉战剂，复结和败逃不重奖',()=>{
  const e=battleReady(),run=e.run;
  run("Math.random=()=>0;openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(run('S.items.emberElixir'),1);
  assert.equal(run('S.killValues.godPhantom'),100);
  assert.ok(run("document.getElementById('battle-result').innerHTML").includes('炽翼战剂 +1'));
  run("endBattle('win');fleeBattle()");assert.equal(run('S.items.emberElixir'),1);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.emberElixir'),1);
  const lost=battleReady();lost.run("Math.random=()=>0;openMaterialDomain('phantomFlower');endBattle('lose')");
  assert.equal(lost.run('S.items.emberElixir'),0);
  const noDrop=battleReady();noDrop.run("Math.random=()=>0.5;openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(noDrop.run('S.items.emberElixir'),0);
  const failed=battleReady();failed.run("Math.random=()=>0;openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(failed.run('S.items.emberElixir'),0);
  assert.equal(failed.run('S.killValues.godPhantom'),0);
});

console.log(`${passed} passed`);
