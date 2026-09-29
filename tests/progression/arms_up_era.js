'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let pass=0,fail=0;
function check(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(error){fail++;console.error('FAIL '+name+'\n'+error.stack)}}

const units=[
  ['bronze_guard',2,'copper',150006,1000,'sci_bronze_age'],
  ['iron_spearman',3,'iron',150007,1000,'sci_iron_age'],
  ['silver_heavy',4,'silver',150008,1000,'sci_silver_age'],
  ['gold_cavalry',5,'gold',150009,1000,'sci_gold_age'],
  ['alloy_special',6,'steel',150010,1000,'sci_alloy_age'],
  ['armored_trooper',7,'steel',150010,1000,'sci_steam_age'],
  ['electro_trooper',8,'steel',150010,4000,'sci_electric_age'],
  ['star_trooper',9,'steel',150010,4000,'sci_nuclear_age']
];

check('八个现有时代兵种的三维费用与母本370002～009逐项一致',()=>{
  const e=environment();
  for(const [uk,id,material,materialId,cost,science]of units){
    const digits=String(id).padStart(3,'0');
    assert.deepEqual(source['370'+digits]['army:ArmsUP'],[340000+id,341000+id,342000+id]);
    assert.equal(e.run(`CFG.armsUp.${uk}.material`),material);
    assert.equal(e.run(`CFG.armsUp.${uk}.stepCost`),cost);
    assert.equal(e.run(`CFG.armsUp.${uk}.needScience`),science);
    assert.equal(e.run(`CFG.armsUp.${uk}.stepsPerStar`),1000);
    for(const [prefix,field,stat,bonus]of [[340,'AddATK','atk',1],[341,'AddHP','hp',0.01],[342,'AddDEF','def',1]]){
      const row=source[String(prefix)+digits];
      assert.equal(row['armsUP:ArmyID'],370000+id);
      assert.deepEqual(row['armsUP:Need'],[[materialId,cost]]);
      assert.equal(row['armsUP:'+field],1);
      assert.equal(e.run(`CFG.armsUp.${uk}.stats.${stat}.perStar`),bonus);
    }
  }
  assert.equal(e.run("Object.prototype.hasOwnProperty.call(CFG.armsUp,'infantry')"),false);
});

check('每个时代兵装只消耗其母本材料，科技门不能被直接调用绕过',()=>{
  for(const [uk,,material,,cost,science]of units){
    const e=environment();
    e.run(`S.res.${material}=${cost}`);
    assert.equal(e.run(`investArmsUp('${uk}','atk').reason`),'science-prerequisite');
    e.run(`S.sciences=['${science}']`);
    assert.equal(e.run(`investArmsUp('${uk}','atk').ok`),true);
    assert.equal(e.run(`S.res.${material}`),0);
    assert.equal(e.run(`S.armsUp.${uk}.atk.progress`),1);
    assert.equal(e.run(`S.armsUp.${uk}.atk.stars`),0);
    assert.equal(e.run('armyCount()'),0);
    assert.equal(JSON.parse(e.store.get('rts_save')).armsUp[uk].atk.progress,1);
  }
});

check('铜仓只够部分投入时同价批量支付，兵数与敌方生命不增加',()=>{
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.copper=2000");
  assert.equal(e.run("investArmsUp('bronze_guard','atk',3).reason"),'insufficient-resources');
  assert.equal(e.run('S.res.copper'),2000);
  assert.equal(e.run("investArmsUp('bronze_guard','atk',2).ok"),true);
  assert.equal(e.run('S.res.copper'),0);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.progress'),2);
  assert.equal(e.run("weaponAttack('bronze_guard')"),7);
  assert.equal(e.run('armyCount()'),0);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.armsUp.bronze_guard.atk.progress'),2);
  assert.equal(reload.run("battleVitals('bronze_guard',10).hpPerSoldier"),2);
});

check('条件足额的一星早期兵装同时作用于远征与驻军，敌军不继承',()=>{
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.copper=3000000;S.formation.front=[{id:1,type:'bronze_guard',count:10}];S._garrisonForm.front=[{id:2,type:'bronze_guard',count:10}]");
  for(const stat of ['atk','hp','def'])assert.equal(e.run(`investArmsUp('bronze_guard','${stat}',1000).ok`),true);
  e.run('S.selEnemy=0;initBattleState()');
  assert.equal(e.run('B.ourUnits[0].atk'),8);
  assert.equal(e.run('B.ourUnits[0].def'),17);
  assert.ok(Math.abs(e.run('B.ourUnits[0].hpPerSoldier')-2.01)<1e-9);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),8);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].def'),17);
  assert.ok(Math.abs(e.run('buildGarrisonUnitsFromForm()[0].hpPerSoldier')-2.01)<1e-9);
  assert.equal(e.run("battleVitals('bronze_guard',10).hpPerSoldier"),2);
  assert.equal(e.run('armyCount()'),20);
});

check('攻击第10星与生命第100星实付跨档，远征／驻军共用且v32重载保留',()=>{
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.copper=2000;S.armsUp.bronze_guard.atk={stars:9,progress:999};S.armsUp.bronze_guard.hp={stars:99,progress:999};S.formation.front=[{id:11,type:'bronze_guard',count:10}];S._garrisonForm.front=[{id:12,type:'bronze_guard',count:10}]");
  assert.equal(e.run("weaponAttack('bronze_guard')"),16);
  assert.ok(Math.abs(e.run("battleVitals('bronze_guard',10,true).hpPerSoldier")-2.99)<1e-9);
  assert.equal(e.run("battleVitals('bronze_guard',10,false).hpPerSoldier"),2);
  assert.equal(e.run("investArmsUp('bronze_guard','atk').ok"),true);
  assert.equal(e.run("investArmsUp('bronze_guard','hp').ok"),true);
  assert.equal(e.run('S.res.copper'),0);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.stars'),10);
  assert.equal(e.run('S.armsUp.bronze_guard.hp.stars'),100);
  assert.equal(e.run("weaponAttack('bronze_guard')"),18);
  assert.ok(Math.abs(e.run("battleVitals('bronze_guard',10,true).hpPerSoldier")-3.4)<1e-9);
  assert.equal(e.run("battleVitals('bronze_guard',10,false).hpPerSoldier"),2);
  e.run('S.selEnemy=0;initBattleState()');
  assert.equal(e.run('B.ourUnits[0].atk'),18);
  assert.ok(Math.abs(e.run('B.ourUnits[0].hpPerSoldier')-3.4)<1e-9);
  assert.equal(e.run('buildGarrisonUnitsFromForm()[0].atk'),18);
  assert.ok(Math.abs(e.run('buildGarrisonUnitsFromForm()[0].hpPerSoldier')-3.4)<1e-9);
  const saved=JSON.parse(e.store.get('rts_save'));
  1332;
  assert.equal(saved.armsUp.bronze_guard.atk.stars,10);
  assert.equal(saved.armsUp.bronze_guard.hp.stars,100);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("weaponAttack('bronze_guard')"),18);
  assert.ok(Math.abs(reload.run("battleVitals('bronze_guard',10,true).hpPerSoldier")-3.4)<1e-9);
});

check('阶段档位投入存档失败时铜库存、星数、进度均回滚',()=>{
  const e=environment();
  e.run("S.sciences=['sci_bronze_age'];S.res.copper=1000;S.armsUp.bronze_guard.atk={stars:9,progress:999};save()");
  const original=e.store.get('rts_save');
  e.run("localStorage.setItem=()=>{throw Error('quota')}");
  assert.equal(e.run("investArmsUp('bronze_guard','atk').reason"),'save-failed');
  assert.equal(e.run('S.res.copper'),1000);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.stars'),9);
  assert.equal(e.run('S.armsUp.bronze_guard.atk.progress'),999);
  assert.equal(e.run("weaponAttack('bronze_guard')"),16);
  assert.equal(e.store.get('rts_save'),original);
});

check('v30实付电磁进度先备份再补七兵种，v32坏字段与未来版只读',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p82-arms-up-first-invest-paid.json'),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.armsUp.electro_trooper.atk.progress'),1);
  assert.equal(e.run('S.res.steel'),29);
  assert.equal(e.run('armyCount()'),437);
  for(const [uk]of units)if(uk!=='electro_trooper')assert.equal(e.run(`S.armsUp.${uk}.atk.progress`),0);
  const saved=e.store.get('rts_save');
  1332;
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.armsUp.electro_trooper.atk.progress'),1);
  for(const mutate of [d=>delete d.armsUp.bronze_guard,d=>d.armsUp.iron_spearman.hp.progress=1000,d=>d.armsUp.star_trooper.def.stars=-1,d=>d.v=34]){
    const data=structuredClone(JSON.parse(saved));mutate(data);const text=JSON.stringify(data),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),data.v===34?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

console.log('arms_up_era: pass '+pass+' fail '+fail);
process.exit(fail?1:0);
