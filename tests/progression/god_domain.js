'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function battleEnv(){
  const e=environment();
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));
    S.sciences=['sci_alloy_age'];S.selEnemy=0;
    S.buildings.barracks={lv:3,state:'idle'};S.buildings.alloy_armory={lv:4,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:16,id:101}],mid:[],back:[]};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++){
    if(!e.run('__step()'))throw new Error('战斗计时器丢失');
  }
  assert.equal(e.run('S.battleActive'),false,'战斗未在500个回调内结束');
}

check('神域研究是合金支线，扣知识与钢各一次并保存',()=>{
  const e=battleEnv();
  assert.equal(e.run("researchScience('sci_god_domain').reason"),'insufficient-tech');
  e.run('S.res.tech=50000;S.res.steel=5000');
  assert.equal(e.run("researchScience('sci_god_domain').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.steel'),0);
  assert.equal(e.run("researchScience('sci_god_domain').repeat"),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).sciences.includes('sci_god_domain'),true);
});

check('神域双资源研究写档失败时原数额与前置状态保持',()=>{
  const e=battleEnv();e.run("S.res.tech=50000;S.res.steel=5000;save=()=>({ok:false,stage:'write'})");
  assert.equal(e.run("researchScience('sci_god_domain').reason"),'save-failed');
  assert.equal(e.run('S.res.tech'),50000);
  assert.equal(e.run('S.res.steel'),5000);
  assert.equal(e.run("S.sciences.includes('sci_god_domain')"),false);
});

check('未研究或无编队时动作不能开启神域战斗',()=>{
  const e=battleEnv();e.run('openGodDomain()');
  assert.equal(e.run('S.battleActive'),false);
  e.run("S.sciences.push('sci_god_domain');S.formation.front=[];openGodDomain()");
  assert.equal(e.run('S.battleActive'),false);
});

check('真实战斗胜利才得水晶，重复结算不重发且不改关卡记录',()=>{
  const e=battleEnv();
  e.run("S.buildings.barracks.lv=7;S.buildings.alloy_armory.lv=12;S.formation.front[0].count=40;S.sciences.push('sci_god_domain');openGodDomain()");
  assert.equal(e.run('B.enemyCfg.name'),'机巧遗迹·守卫机兵');
  assert.equal(e.run('B.enemyUnits[0].hp'),40);
  flushBattle(e);
  assert.equal(e.run('S.items.godCrystal'),1,JSON.stringify(e.run("({round:B.round,formation:S.formation,result:document.getElementById('battle-result').innerHTML,enemy:B.enemyUnits[0].hp})")));
  assert.equal(e.run('S.items.godCrystal'),1);
  assert.equal(e.run('S.killValues.godRevival'),100);
  assert.equal(e.run('S.defeated.length'),0);
  assert.equal(e.run('S.merit'),0);
  e.run("endBattle('win')");
  assert.equal(e.run('S.items.godCrystal'),1);
  assert.equal(JSON.parse(e.store.get('rts_save')).items.godCrystal,1);
  assert.equal(JSON.parse(e.store.get('rts_save')).killValues.godRevival,100);
  const survivors=e.run('S.formation.front[0]?.count||0');
  e.run('fleeBattle()');
  assert.equal(e.run('S.formation.front[0]?.count||0'),survivors,'结算后的逃跑键不能返还战损');
  assert.equal(JSON.parse(e.store.get('rts_save')).formation.front[0]?.count||0,survivors);
  e.run("exitBattle();S.formation={front:[{type:'alloy_special',count:40,id:201}],mid:[],back:[]};openGodDomain()");
  flushBattle(e);
  assert.equal(e.run('S.items.godCrystal'),2,'补兵后的重复挑战应再得水晶');
  assert.equal(e.run('S.killValues.godRevival'),200);
  assert.equal(e.run('S.defeated.length'),0,'神域挑战不占关卡首通');
  const loaded=environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(loaded.run('S.items.godCrystal'),2);
  assert.equal(loaded.run('S.killValues.godRevival'),200);
  assert.equal(loaded.run("S.sciences.includes('sci_god_domain')"),true);
});

check('战败、逃离与保存失败均不生成水晶',()=>{
  const e=battleEnv();e.run("S.sciences.push('sci_god_domain');openGodDomain()");
  e.run('fleeBattle()');assert.equal(e.run('S.items.godCrystal'),0);
  assert.equal(e.run('S.killValues.godRevival'),0);
  e.run('openGodDomain()');e.run("endBattle('lose')");
  assert.equal(e.run('S.items.godCrystal'),0);
  assert.equal(e.run('S.killValues.godRevival'),0);
  e.run('exitBattle();openGodDomain()');
  e.run("endBattle('win')");
  assert.equal(e.run('S.battleActive'),true,'敌人未死不能伪结算胜利');
  e.run("B.enemyUnits[0].alive=false;save=()=>({ok:false,stage:'write'});endBattle('win')");
  assert.equal(e.run('S.items.godCrystal'),0);
  assert.equal(e.run('S.killValues.godRevival'),0);
  assert.equal(e.run('S.defeated.length'),0);
});

check('一名合金兵真实战败，无材料奖励且战损入档',()=>{
  const e=battleEnv();
  e.run("S.sciences.push('sci_god_domain');S.formation.front=[{type:'alloy_special',count:1,id:301}];openGodDomain()");
  flushBattle(e);
  assert.equal(e.run('S.items.godCrystal'),0);
  assert.equal(e.run('S.killValues.godRevival'),0);
  assert.equal(e.run('S.formation.front.length'),0);
  assert.equal(JSON.parse(e.store.get('rts_save')).items.godCrystal,0);
});

check('材料已到上限或旧档超上限时不增长、不裁剪',()=>{
  const e=battleEnv();e.run("S.sciences.push('sci_god_domain');S.items.godCrystal=1000000;openGodDomain();B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(e.run('S.items.godCrystal'),1000000);
  e.run("exitBattle();S.items.godCrystal=1000007;openGodDomain();B.enemyUnits[0].alive=false;endBattle('win')");
  assert.equal(e.run('S.items.godCrystal'),1000007);
  assert.equal(e.run('S.killValues.godRevival'),200,'库存已满仍记录胜利，难度继续成长');
});

check('神域奖励与战力随杀戮值分段成长，静态关卡配置不被改动',()=>{
  const e=battleEnv();
  const rows=JSON.parse(e.run('JSON.stringify([0,100,200,300,400,500,600,700,800,900,1000].map(k=>{const x=godDomainEncounter(k);return [x.units.god_crystal_guard[0],x.reward.godCrystal]}))'));
  assert.deepEqual(rows.map(r=>r[1]),[1,1,2,3,4,5,6,7,8,12,13]);
  assert.deepEqual(rows.slice(0,3).map(r=>r[0]),[40,46,52]);
  assert.equal(rows[10][0],160);
  assert.equal(rows.reduce((n,r)=>n+r[1],0),62,'正常品质按母本首段曲线约11胜可累计60水晶');
  assert.equal(e.run('CFG.godDomain.units.god_crystal_guard[0]'),40);
  e.run("S.sciences.push('sci_god_domain');S.killValues.godRevival=500;openGodDomain()");
  assert.equal(e.run('B.enemyUnits[0].hp'),84);
  assert.equal(e.run('B.enemyCfg.reward.godCrystal'),5);
  e.run('fleeBattle()');
  assert.equal(e.run('S.killValues.godRevival'),500);
});

check('有杀戮值的真实胜利按战前档位发奖并只推进一次',()=>{
  const e=battleEnv();
  // 单体 Boss 受伤后不再随 HP 下降而丧失攻击力；此奖励测试使用可由兵坊／营帐承载的40人队。
  e.run("Math.random=()=>0.5;S.sciences.push('sci_god_domain');S.buildings.barracks.lv=7;S.buildings.alloy_armory.lv=12;S.formation.front[0].count=40;S.killValues.godRevival=200;openGodDomain()");
  assert.equal(e.run('B.enemyUnits[0].hp'),52);
  flushBattle(e);
  assert.equal(e.run('S.items.godCrystal'),2);
  assert.equal(e.run('S.killValues.godRevival'),300);
  e.run("endBattle('win')");
  assert.equal(e.run('S.items.godCrystal'),2);
  assert.equal(e.run('S.killValues.godRevival'),300);
  assert.equal(JSON.parse(e.store.get('rts_save')).killValues.godRevival,300);
});

check('v13原档迁移到v32保留水晶和超仓资源，坏杀戮值与未来档保护原文',()=>{
  const seed=battleEnv();seed.run('S.items.godCrystal=7;S.res.steel=100001;save()');
  const old=JSON.parse(seed.store.get('rts_save'));old.v=13;delete old.killValues;
  const raw=JSON.stringify(old),migrated=environment({rts_save:raw});
  assert.equal(migrated.run('loadSaveAndApply().status'),'migrated');
  assert.equal(migrated.run('S.killValues.godRevival'),0);
  assert.equal(migrated.run('S.items.godCrystal'),7);
  assert.equal(migrated.run('S.res.steel'),100001);
  assert.equal(migrated.store.get('rts_save_premigration'),raw);
  const carried={...old,killValues:{godRevival:500}};
  const preserved=environment({rts_save:JSON.stringify(carried)});
  assert.equal(preserved.run('loadSaveAndApply().status'),'migrated');
  assert.equal(preserved.run('S.killValues.godRevival'),500);
  for(const mutate of [d=>delete d.killValues,d=>d.killValues.godRevival=-1,d=>d.killValues.godRevival=1.5,d=>d.killValues.other=1,d=>d.v=35]){
    const d=JSON.parse(migrated.store.get('rts_save'));mutate(d);
    const badRaw=JSON.stringify(d),bad=environment({rts_save:badRaw});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');
    assert.equal(bad.store.get('rts_save'),badRaw);
  }
});

check('v13迁移保护副本写失败时不应用候选杀戮值、不覆盖旧主档',()=>{
  const seed=environment();seed.run('S.items.godCrystal=7;save()');
  const old=JSON.parse(seed.store.get('rts_save'));old.v=13;delete old.killValues;
  const raw=JSON.stringify(old),blocked=environment({rts_save:raw});
  blocked.run("localStorage.setItem=(key,value)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(blocked.run('saveProtected()'),true);
  assert.equal(blocked.run('S.killValues.godRevival'),0);
  assert.equal(blocked.run('S.items.godCrystal'),0);
  assert.equal(blocked.store.get('rts_save'),raw);
});

check('敌方专属单位不能招募或写入玩家兵力存档',()=>{
  const e=battleEnv();
  assert.equal(e.run("train('god_crystal_guard',1).ok"),false);
  e.run('save()');
  const crafted=JSON.parse(e.store.get('rts_save'));
  crafted.pool.god_crystal_guard=1;
  const bad=environment({rts_save:JSON.stringify(crafted)});
  assert.equal(bad.run('loadSaveAndApply().status'),'invalid');
  assert.equal(bad.run('saveProtected()'),true);
});

check('未打第5关时第二前排格不能由动作函数强行编入',()=>{
  const e=battleEnv();
  e.run("S.formation.front=[];S.pool.alloy_special=16;openFormModal('expedition','front',1)");
  assert.equal(e.run('formModalTarget'),null);
  assert.equal(e.run('S.formation.front.length'),0);
  assert.equal(e.run('S.pool.alloy_special'),16);
});

console.log(`god domain: ${passed}/${passed+failed}`);
if(failed)process.exitCode=1;
