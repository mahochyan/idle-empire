'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const oldPaid=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p319-armored18-crystal-alert5200-recovered-save.json'),'utf8');
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
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function finish(e){for(let n=0;n<2000&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true);assert.equal(e.run('S.battleActive'),false)}

check('研究链逐项实付；奥术师经法师塔训练并扣勋章',()=>{
  const e=environment();
  e.run("S.sciences=['sci_electric_age'];S.res.tech=38000000;S.res.medal=600100");
  assert.equal(e.run("researchScience('sci_soul_realm').reason"),'science-prerequisite');
  for(const id of ['sci_arcane_mage','sci_astral_lord','sci_soul_realm'])assert.equal(e.run(`researchScience('${id}').ok`),true,id);
  assert.equal(e.run('S.res.tech'),0);assert.equal(e.run('S.res.medal'),100);
  e.run("S.buildings.mage_tower={lv:1,state:'idle',tier:1};S.defeated=CFG.enemies.filter(x=>x.boss).slice(0,4).map(x=>x.id)");
  assert.equal(e.run("train('arcane_mage',1).ok"),true);
  for(let i=0;i<4;i++)e.run('processQueue(false)');
  assert.equal(e.run('S.pool.arcane_mage'),1);assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run("train('soul_wraith',1).ok"),false);
});
check('胜利结算英魂铭石和独立警戒；败逃及复结不发奖',()=>{
  const e=environment();battleHarness(e);
  e.run("S.sciences=['sci_soul_realm'];S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]}");
  assert.equal(e.run('refreshSoulRealmTeam().ok'),true);
  assert.equal(e.run('S.soulRealmTeam.slots.length'),9);
  assert.equal(e.run("openMaterialDomain('soulStone');S.battleActive"),false);
  e.run('openSoulRealmSlot(0);fleeBattle()');assert.equal(e.run('S.items.soulStone'),0);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),540199);
  e.run('openSoulRealmSlot(0);endBattle(\'lose\')');assert.equal(e.run('S.items.soulStone'),0);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),540199);
  e.run('retryBattle()');assert.equal(e.run('__step()'),true);
  assert.equal(e.run('B.enemyCfg.soulSlot'),0);
  assert.equal(e.run('S.battleActive'),true);
  e.run('fleeBattle()');
  e.run("exitBattle();S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[{type:'armored_trooper',count:40,id:102}],back:[{type:'archer',count:40,id:103}]};openSoulRealmSlot(0)");finish(e);
  assert.equal(e.run('S.items.soulStone'),1,JSON.stringify(e.run('({winner:B.winner,round:B.round,enemy:B.enemyUnits[0].hp,form:S.formation})')));
  assert.equal(e.run('S.killValues.soulRealm'),100);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),null);
  e.run("endBattle('win')");assert.equal(e.run('S.items.soulStone'),1);
  assert.equal(e.run('openSoulRealmSlot(0).reason'),'target-unavailable');
  const reloaded=environment({rts_save:e.store.get('rts_save')});assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.items.soulStone'),1);assert.equal(reloaded.run('S.killValues.soulRealm'),100);
  assert.equal(reloaded.run('S.soulRealmTeam.slots[0]'),null);
});
check('九敌位按可出现区间和权重生成，所选档奖励及警戒独立结算',()=>{
  const e=environment();
  const rows=JSON.parse(e.run("JSON.stringify([540199,540299,540399,540499,540599,540699].map(id=>{const a=materialDomainEncounter('soulStone',6000,id);return [a.reward.soulStone,a.nextKillValue,a.units.soul_wraith[0]]}))"));
  assert.deepEqual(rows.map(x=>x[0]),[2,5,8,14,19,42]);
  assert.deepEqual(rows.map(x=>x[1]),[6100,6150,6200,6250,6300,6300]);
  assert.ok(rows.every((x,i)=>i===0||x[2]>rows[i-1][2]));
  e.run("S.sciences=['sci_soul_realm'];S.killValues.soulRealm=4550;Math.random=()=>0");
  assert.equal(e.run('refreshSoulRealmTeam().ok'),true);
  assert.equal(e.run('S.soulRealmTeam.slots.every(id=>id===540299)'),true);
  assert.equal(e.run('refreshSoulRealmTeam().reason'),'refresh-locked');
  e.run('S.soulRealmTeam.day=soulRealmDay()-1;Math.random=()=>0.5');
  assert.equal(e.run('refreshSoulRealmTeam().ok'),true);
  assert.equal(e.run('S.soulRealmTeam.slots.every(id=>id===540399)'),true);
  assert.equal(e.run('S.soulRealmTeam.day===soulRealmDay()'),true);
  e.run('S.soulRealmTeam.slots.fill(null);Math.random=()=>0.99');
  assert.equal(e.run('refreshSoulRealmTeam().ok'),true);
  assert.equal(e.run('S.soulRealmTeam.slots.every(id=>id===540499)'),true);
  e.run("S.sciences=['sci_electric_age','sci_soul_realm'];S.killValues.soulRealm=6000;S.items.domainCleanser=1");
  assert.equal(e.run("useDomainCleanser('soulStone').reason"),'domain-locked');
  assert.equal(e.run('S.killValues.soulRealm'),6000);
  assert.equal(e.run('Object.keys(CFG.godDomains.medal.bonusItemReward).includes("soulStone")'),false);
});
check('英魂警戒只在整千节点按源生命／人数／攻防倍率跳阶，极大值不溢出',()=>{
  const e=environment();
  const rows=JSON.parse(e.run("JSON.stringify([0,999,1000,5000,Number.MAX_SAFE_INTEGER].map(alert=>{const x=materialDomainEncounter('soulStone',alert,540299);return{amount:x.units.soul_wraith[0],mass:x.attackMass,atk:x.bossMult.atk,def:x.bossMult.def,next:x.nextKillValue}}))"));
  assert.deepEqual(rows.slice(0,3).map(x=>x.amount),[200,200,364]);
  assert.deepEqual(rows.slice(0,3).map(x=>x.mass),[6,6,6]);
  assert.equal(rows[3].amount,3993);
  assert.equal(rows[3].mass,6);
  assert.ok(rows[3].atk>rows[2].atk&&rows[3].def>rows[2].def);
  assert.ok(rows[4].amount<=Number.MAX_SAFE_INTEGER&&Number.isFinite(rows[4].atk)&&Number.isFinite(rows[4].def));
  assert.equal(rows[4].next,Number.MAX_SAFE_INTEGER);
  assert.equal(e.run('S.killValues.soulRealm'),0);
  e.run("S.sciences=['sci_soul_realm'];S.killValues.soulRealm=Number.MAX_SAFE_INTEGER;Math.random=()=>0");
  assert.equal(e.run('refreshSoulRealmTeam().ok'),true);
  assert.equal(e.run('S.soulRealmTeam.slots.every(id=>id===540699)'),true);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.killValues.soulRealm'),Number.MAX_SAFE_INTEGER);
});
check('英魂群体按母本六队队首出手，其他材料Boss保持原规则',()=>{
  const e=environment();battleHarness(e);
  e.run("S.sciences=['sci_soul_realm'];S.killValues.soulRealm=5450;S.soulRealmTeam={day:soulRealmDay(),slots:[540399,null,null,null,null,null,null,null,null]};S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[],back:[]}");
  assert.equal(e.run('openSoulRealmSlot(0).ok'),true);
  assert.equal(e.run('B.enemyUnits[0].attackMassFallsWithHp'),false);
  const entryMass=e.run('combatAttackMass(B.enemyUnits[0])');
  assert.equal(entryMass,6);
  e.run('applyCombatDamage(B.enemyUnits[0],B.enemyUnits[0].maxHp/2)');
  assert.equal(e.run('combatAttackMass(B.enemyUnits[0])'),6);
  assert.equal(e.run("!!materialDomainEncounter('guardianStone').attackMassFallsWithHp"),false);
  e.run('fleeBattle()');
  assert.equal(e.run('S.items.soulStone'),0);assert.equal(e.run('S.killValues.soulRealm'),5450);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),540399);
});
check('指定敌位胜利只清该位；结算写盘失败同时回滚敌位、铭石与警戒',()=>{
  const e=environment();battleHarness(e);
  e.run("S.sciences=['sci_soul_realm'];S.killValues.soulRealm=4550;S.soulRealmTeam={day:soulRealmDay(),slots:[540299,540399,540499,540299,540399,540499,540299,540399,540499]};S.formation={front:[{type:'alloy_special',count:40,id:101}],mid:[],back:[]};save()");
  assert.equal(e.run('openSoulRealmSlot(1).ok'),true);
  assert.equal(e.run('B.enemyCfg.soulTierId'),540399);
  e.run("B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(e.run('S.items.soulStone'),6);
  assert.equal(e.run('S.killValues.soulRealm'),4750);
  assert.equal(e.run('S.soulRealmTeam.slots[1]'),null);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),540299);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.soulRealmTeam.slots[1],null);
  e.run('exitBattle()');
  const raw=e.store.get('rts_save');
  assert.equal(e.run('openSoulRealmSlot(0).ok'),true);
  e.run("const realSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');return realSet(k,v)};B.enemyUnits.forEach(u=>u.alive=false);endBattle('win')");
  assert.equal(e.run('S.items.soulStone'),6);
  assert.equal(e.run('S.killValues.soulRealm'),4750);
  assert.equal(e.run('S.soulRealmTeam.slots[0]'),540299);
  assert.equal(e.store.get('rts_save'),raw);
  const fresh=environment();
  fresh.run("S.sciences=['sci_soul_realm'];Math.random=()=>0");
  fresh.run("localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota')}");
  assert.equal(fresh.run('refreshSoulRealmTeam().reason'),'save-failed');
  assert.equal(fresh.run('S.soulRealmTeam'),null);
});
check('同兵种十星后升阶实扣2000石，生命/攻击在远征与驻军同源',()=>{
  const e=environment();
  e.run("S.sciences=['sci_astral_lord'];S.pool.arcane_mage=10;S._garrisonForm.back=[{type:'arcane_mage',count:10,id:222}];S.items.soulStone=2000");
  assert.equal(e.run("weaponAttack('arcane_mage')"),30);
  assert.equal(e.run("battleVitals('arcane_mage',10,true).hp"),30);
  for(let i=0;i<10;i++)assert.equal(e.run("upgradeSoulRank('arcane_mage').ok"),true);
  assert.equal(e.run('S.items.soulStone'),1000);
  assert.equal(e.run('S.soulRanks.arcane_mage.stars'),10);
  assert.equal(e.run("battleVitals('arcane_mage',10,true).hp"),60);
  assert.equal(e.run("upgradeSoulRank('arcane_mage').ok"),true);
  assert.equal(e.run('S.items.soulStone'),0);
  assert.equal(e.run('S.soulRanks.arcane_mage.rank'),1);
  assert.equal(e.run("weaponAttack('arcane_mage')"),45);
  assert.equal(e.run("battleVitals('arcane_mage',10,true).hp"),60);
  assert.equal(e.run("battleVitals('arcane_mage',10,false).hp"),30);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].hp'),60);
  const reload=environment({rts_save:e.store.get('rts_save')});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.soulRanks.arcane_mage.rank'),1);
});
check('五阶累计实扣30000石并封顶，不把升阶写成新增兵员',()=>{
  const e=environment();e.run("S.sciences=['sci_astral_lord'];S.pool.arcane_mage=1;S.items.soulStone=30000");
  for(let i=0;i<55;i++)assert.equal(e.run("upgradeSoulRank('arcane_mage').ok"),true);
  assert.equal(e.run('S.items.soulStone'),0);
  assert.equal(e.run('S.soulRanks.arcane_mage.rank'),5);
  assert.equal(e.run('S.soulRanks.arcane_mage.stars'),0);
  assert.equal(e.run("weaponAttack('arcane_mage')"),105);
  assert.equal(e.run("battleVitals('arcane_mage',1,true).hp"),18);
  assert.equal(e.run("upgradeSoulRank('arcane_mage').reason"),'max-rank');
  assert.equal(e.run('S.pool.arcane_mage'),1);
});
check('旧v32有价档仅在候选迁移补默认值，坏字段保护且写盘失败回滚',()=>{
  const e=environment({rts_save:oldPaid});assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),oldPaid);
  assert.equal(e.run('S.items.soulStone'),0);assert.equal(e.run('S.killValues.soulRealm'),0);
  assert.equal(e.run('JSON.stringify(S.soulRanks)'),'{}');
  assert.equal(e.run('S.soulRealmTeam'),null);
  e.run("S.sciences.push('sci_astral_lord');S.pool.arcane_mage=1;S.items.soulStone=100;save()");
  const raw=e.store.get('rts_save');
  e.run("const realSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');return realSet(k,v)}");
  assert.equal(e.run("upgradeSoulRank('arcane_mage').reason"),'save-failed');
  assert.equal(e.run('S.items.soulStone'),100);assert.equal(e.run("'arcane_mage' in S.soulRanks"),false);
  assert.equal(e.store.get('rts_save'),raw);
  for(const mutation of [d=>{d.soulRanks.arcane_mage={rank:-1,stars:0}},d=>{d.soulRanks.arcane_mage={rank:6,stars:0}},d=>{d.items.soulStone=-1},d=>{d.killValues.soulRealm=-1},d=>{d.soulRealmTeam={day:0,slots:[540199]}},d=>{d.soulRealmTeam={day:0,slots:Array(9).fill(1)}}]){
    const value=JSON.parse(raw);mutation(value);const text=JSON.stringify(value),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
    assert.equal(bad.run('save().ok'),false);assert.equal(bad.store.get('rts_save'),text);
  }
});
console.log(`soul rank: ${passed}/9`);
