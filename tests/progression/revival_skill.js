'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p272-nuclear-first-knowledge-leaf-save.json'),'utf8');

check('复苏圣像仅在活着、实际失血且敌攻超过三倍当前防御时回复与叠甲',()=>{
  const e=environment();
  e.run("globalThis.boss={...battleVitals('revival_god',240),type:'revival_god',def:23,attackMass:60,alive:true};globalThis.low={atk:69};globalThis.high={atk:92}");
  const low=e.run('applyCombatDamage(boss,20,low)');
  assert.equal(low.healed,0);assert.equal(low.defAdded,0);
  assert.equal(e.run('boss.hp'),220);assert.equal(e.run('boss.def'),23);
  const high=e.run('applyCombatDamage(boss,100,high)');
  assert.equal(high.hpLost,100);assert.equal(high.healed,36);assert.equal(high.defAdded,1);
  assert.equal(e.run('boss.hp'),156);assert.equal(e.run('boss.def'),24);
  e.run('boss.shield=20');
  const shield=e.run('applyCombatDamage(boss,10,high)');
  assert.equal(shield.hpLost,0);assert.equal(shield.healed,0);assert.equal(e.run('boss.def'),24);
});

check('回复封顶进场生命，致命一击不能复活或增加持久兵力',()=>{
  const e=environment();
  e.run("globalThis.boss={...battleVitals('revival_god',240),type:'revival_god',def:23,attackMass:60,alive:true};globalThis.attacker={atk:400}");
  e.run('boss.hp=200');
  const capped=e.run('applyCombatDamage(boss,20,attacker)');
  assert.equal(capped.healed,60);assert.equal(capped.defAdded,3);
  assert.equal(e.run('boss.hp'),240);assert.equal(e.run('boss.def'),26);
  const killed=e.run('applyCombatDamage(boss,300,attacker)');
  assert.equal(killed.healed,0);assert.equal(killed.defAdded,0);
  assert.equal(e.run('boss.hp'),0);assert.equal(e.run('boss.alive'),false);
  assert.equal(e.run('combatSurvivors(boss)'),0);
});

check('远征和驻军的真实伤害路径共用受击技能，仍不写入玩家存档',()=>{
  const e=environment({rts_save:source});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),source);
  e.run("S._garrisonForm={front:[{type:'electro_trooper',count:55,id:9001}],mid:[],back:[]};Math.random=()=>0.5");
  const g=e.run("(()=>{const result=resolveGarrisonBattle({units:{revival_god:[500]}});return{def:result.enemyUnits[0].def,hp:result.enemyUnits[0].hp}})()");
  assert.ok(g.def>23,'驻军实际行动应触发圣辉叠甲');
  assert.ok(g.hp<=500);
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
  e.run("openMaterialDomain('revivalLeaf')");assert.equal(e.run('S.battleActive'),true);
  e.run('B.enemyUnits[0].hp=500;B.enemyUnits[0].maxHp=500'); // 仅扩大测试战斗体以观察受击效果，不写入玩家存档。
  let callbacks=0;while(e.run('S.battleActive')&&callbacks<2000){assert.equal(e.run('__step()'),true);callbacks++}
  assert.ok(callbacks<2000);assert.equal(e.run('S.battleActive'),false);
  assert.equal(e.run("B.msgs.some(row=>row.m.includes('圣辉自愈'))"),true);
  const record=e.store.get('rts_save');
  assert.equal(JSON.stringify(JSON.parse(record)).includes('onHitRecovery'),false);
  assert.equal(JSON.stringify(JSON.parse(record)).includes('defAdded'),false);
  assert.ok(e.run('S.defeated.length')===99);
});

console.log(`revival skill: ${passed}/3`);
