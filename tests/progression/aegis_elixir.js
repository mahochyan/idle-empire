'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.resolve(__dirname,'../..');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const oldRaw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p294-ember-elixir-paid-save.json'),'utf8');
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
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));`);return e}

check('母本复合秘剂、三战剂市场价和稀有掉落率对应当前配置',()=>{
  assert.equal(source[180003]['itemPill:AddDEF'],1);
  assert.equal(source[180003]['itemPill:LimitNum'],30);
  assert.match(source[180003]['itemPill:Effect'],/ATK永久\+5%,HP永久\+5%/);
  assert.equal(source[380029]['market:Rate'],10);
  assert.deepEqual(source[380029]['market:Need'],[180002,3]);
  assert.deepEqual(source[380029]['market:Get'],[180003,1]);
  const deob=fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/deob_main.js'),'utf8');
  const start=deob.indexOf("'key':'winGodWar'");assert(start>=0);
  const body=deob.slice(start,start+5500);
  assert(body.includes('["per10000"](_0x4b3065)'));
  for(const chance of ['0x32','0x64','0x96','0xc8'])assert(body.includes(chance));
  const e=environment();
  assert.equal(e.run('CFG.aegisElixir.defPerUse'),1);
  assert.equal(e.run('CFG.aegisElixir.atkPerUse'),0.05);
  assert.equal(e.run('CFG.aegisElixir.hpPerUse'),0.05);
  assert.equal(e.run('CFG.aegisElixir.limitPerUnit'),30);
  assert.equal(e.run('CFG.market.special.weights.aegisElixir'),10);
  for(const [alert,expected] of [[100,50],[2000,50],[2001,100],[4001,150],[6001,200]])
    assert.equal(e.run(`godAegisDropChance(${alert})`),expected);
  for(const key of ['godCrystal','phantomFlower','guardianStone','revivalLeaf','trialFruit','medal'])
    assert.equal(e.run(`materialDomainEncounter('${key}',1901).aegisDropChance`),100,key);
  assert.equal(e.run("materialDomainEncounter('bone',0).aegisDropChance"),undefined);
});

check('P294旧v32实付档先保护原文再候选补库存、货架与使用次数',()=>{
  const e=environment({rts_save:oldRaw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),oldRaw);
  assert.equal(e.run('S.items.aegisElixir'),0);
  assert.equal(e.run('S.marketSpecial.offers.aegisElixir'),0);
  assert.equal(e.run('JSON.stringify(S.aegisInfusions)'),'{}');
  e.run('S.aegisInfusions.star_trooper=0;save()');
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.aegisInfusions.star_trooper'),0);
  const noBackup=environment({rts_save:oldRaw});
  noBackup.run("globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save_premigration')throw Error('quota');return __set(k,v)}");
  assert.equal(noBackup.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(noBackup.store.get('rts_save'),oldRaw);
});

check('市场实扣三份炽翼战剂买一份圣盾秘剂，旧货架缺键安全补零',()=>{
  const e=marketReady(),run=e.run;
  run('S.marketSpecial.offers.aegisElixir=1;S.items.emberElixir=3;save()');
  assert.equal(run("buyMarketSpecial('aegisElixir').ok"),true);
  assert.equal(run('S.items.emberElixir'),0);
  assert.equal(run('S.items.aegisElixir'),1);
  assert.equal(run('S.marketSpecial.offers.aegisElixir'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.aegisElixir'),1);
  const old=JSON.parse(e.store.get('rts_save'));delete old.marketSpecial.offers.aegisElixir;
  const text=JSON.stringify(old),migration=environment({rts_save:text});
  assert.equal(migration.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migration.store.get('rts_save_premigration'),text);
  assert.equal(migration.run('S.marketSpecial.offers.aegisElixir'),0);
  const rolls=marketReady();rolls.run('Math.random=()=>0.018;refreshMarketSpecial()');
  assert.equal(rolls.run('S.marketSpecial.offers.aegisElixir'),10);
});

check('单兵种实扣复合秘剂后攻防生按源加算，远征驻军同源且不变人数',()=>{
  const e=environment(),run=e.run;
  run("S.pool.alloy_special=10;S.items.aegisElixir=2;S._garrisonForm.front=[{type:'alloy_special',count:10,id:222}]");
  const before={atk:run("weaponAttack('alloy_special')"),def:run("weaponDefense('alloy_special')"),
    hp:run("battleVitals('alloy_special',10,true).hp"),baseAtk:run('CFG.units.alloy_special.atk'),baseHp:run('CFG.units.alloy_special.hpPerSoldier')};
  assert.equal(run("useAegisElixir('alloy_special',2).ok"),true);
  assert.ok(Math.abs(run("weaponAttack('alloy_special')")-before.atk-before.baseAtk*0.1)<1e-8);
  assert.equal(run("weaponDefense('alloy_special')"),before.def+2);
  assert.ok(Math.abs(run("battleVitals('alloy_special',10,true).hp")-before.hp-before.baseHp)<1e-8);
  assert.ok(Math.abs(run('buildGarrisonUnitsFromForm()[0].atk')-run("weaponAttack('alloy_special')"))<1e-8);
  assert.equal(run('buildGarrisonUnitsFromForm()[0].def'),before.def+2);
  assert.equal(run('S.pool.alloy_special'),10);
  assert.equal(run("battleVitals('alloy_special',10,false).hp"),before.baseHp*10);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.aegisInfusions.alloy_special'),2);
});

check('动作层阻止未知与敌方兵种、无兵、战斗、坏数量和超过30份',()=>{
  const e=environment(),run=e.run;run('S.pool.alloy_special=1;S.items.aegisElixir=31');
  for(const [call,reason] of [["useAegisElixir('__proto__',1)",'invalid-unit'],["useAegisElixir('god_crystal_guard',1)",'invalid-unit'],
    ["useAegisElixir('armored_trooper',1)",'unit-unowned'],["useAegisElixir('alloy_special',0)",'invalid-quantity'],
    ["useAegisElixir('alloy_special',1.5)",'invalid-quantity'],["useAegisElixir('alloy_special',31)",'use-limit']])
    assert.equal(run(call+'.reason'),reason,call);
  run('S.battleActive=true');assert.equal(run("useAegisElixir('alloy_special',1).reason"),'battle-active');run('S.battleActive=false');
  assert.equal(run("useAegisElixir('alloy_special',30).ok"),true);
  assert.equal(run('S.aegisInfusions.alloy_special'),30);
  assert.equal(run('S.items.aegisElixir'),1);
  assert.equal(run("useAegisElixir('alloy_special',1).reason"),'use-limit');
});

check('非法字段进入保护；市场与使用写盘失败均不扣道具',()=>{
  const e=environment();e.run('save()');const base=JSON.parse(e.store.get('rts_save'));
  for(const bad of [null,{god_crystal_guard:1},{alloy_special:-1},{alloy_special:31},JSON.parse('{"__proto__":1}')]){
    const edited=JSON.parse(JSON.stringify(base));edited.aegisInfusions=bad;
    const raw=JSON.stringify(edited),blocked=environment({rts_save:raw});
    assert.equal(blocked.run('loadSaveAndApply().status'),'invalid');
    blocked.run('tick();save()');assert.equal(blocked.store.get('rts_save'),raw);
  }
  const bad=JSON.parse(JSON.stringify(base));bad.items.aegisElixir=-1;
  assert.equal(environment({rts_save:JSON.stringify(bad)}).run('loadSaveAndApply().status'),'invalid');
  const mk=marketReady();mk.run('S.marketSpecial.offers.aegisElixir=1;S.items.emberElixir=3;save()');const raw=mk.store.get('rts_save');
  mk.run("globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');return __set(k,v)}");
  assert.equal(mk.run("buyMarketSpecial('aegisElixir').reason"),'save-failed');
  assert.equal(mk.run('S.items.emberElixir'),3);
  assert.equal(mk.run('S.items.aegisElixir'),0);
  assert.equal(mk.run('S.marketSpecial.offers.aegisElixir'),1);
  assert.equal(mk.store.get('rts_save'),raw);
  for(const failKey of ['rts_save','rts_save_backup_1']){
    const x=environment();x.run('S.pool.alloy_special=1;S.items.aegisElixir=1;save()');const before=x.store.get('rts_save');
    x.run(`globalThis.__set=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${failKey}')throw Error('quota');return __set(k,v)}`);
    assert.equal(x.run("useAegisElixir('alloy_special',1).reason"),'save-failed');
    assert.equal(x.run('S.items.aegisElixir'),1);
    assert.equal(x.run("'alloy_special' in S.aegisInfusions"),false);
    assert.equal(x.store.get('rts_save'),before);
  }
});

check('神域胜利第二独立抽数掉圣盾秘剂，败逃复结和写档失败不发',()=>{
  const e=battleReady(),run=e.run;
  run("openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;globalThis.__rolls=[0.5,0];Math.random=()=>__rolls.shift()??0.5;endBattle('win')");
  assert.equal(run('S.items.emberElixir'),0);
  assert.equal(run('S.items.aegisElixir'),1);
  assert.equal(run('S.killValues.godPhantom'),100);
  assert.ok(run("document.getElementById('battle-result').innerHTML").includes('圣盾秘剂 +1'));
  run("endBattle('win');fleeBattle()");assert.equal(run('S.items.aegisElixir'),1);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.aegisElixir'),1);
  const lost=battleReady();lost.run("Math.random=()=>0;openMaterialDomain('phantomFlower');endBattle('lose')");
  assert.equal(lost.run('S.items.aegisElixir'),0);
  const failed=battleReady();failed.run("openMaterialDomain('phantomFlower');B.enemyUnits[0].alive=false;Math.random=()=>0;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(failed.run('S.items.aegisElixir'),0);
  assert.equal(failed.run('S.killValues.godPhantom'),0);
});

console.log(`${passed} passed`);
