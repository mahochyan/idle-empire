'use strict';
// Conditional capacity/payment fixture from an authentic v33 paid save.
// The knowledge-store levels and funds below are deliberately seeded in the
// isolated VM; this is a combat/action proof, not a natural-curve proof.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p397-quantum-stage100-paid-save.json');
const sourceRaw=fs.readFileSync(sourcePath,'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceHash=hash(sourceRaw);
const CFG_COST={knowledge:5000000000,medal:5000000};
const e=environment({rts_save:sourceRaw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),sourceRaw);
const natural=run(`({knowledge:S.res.tech,knowledgeCapacity:resCap('tech'),medal:S.res.medal,
  knowledgeStore:S.eraStorage.quantumKnowledge,starOriginStone:S.items.starOriginStone})`);
const baselineStats=run(`({attack:battleMilitaryAttack('star_trooper'),hp:battleVitals('star_trooper',7,true).maxHp})`);
assert.ok(natural.knowledgeCapacity<CFG_COST.knowledge);
assert.ok(natural.medal<CFG_COST.medal);
assert.equal(run("researchScience('sci_astral_armament').reason"),'insufficient-tech');
const naturalAfterRefusal=run('({tech:S.res.tech,medal:S.res.medal,researched:scienceUnlocked(\'sci_astral_armament\')})');
assert.equal(naturalAfterRefusal.tech,natural.knowledge);
assert.equal(naturalAfterRefusal.medal,natural.medal);
assert.equal(naturalAfterRefusal.researched,false);

// P399 capacity-route report's conditional combination (5 store levels and
// 25 extra used blueprints) gives this specific P397 save a >5b cap.
// Neither set of extra purchases is claimed paid in this probe.
run(`S.eraStorage.quantumKnowledge=5;S.beastExchange.scrollUsed=158;
  S.res.tech=5000000000;S.res.medal=5000000;
  S.res.steel=Math.max(S.res.steel,8000);
  S.items.starOriginStone=Math.max(S.items.starOriginStone,20);`);
const fixture=run(`({capacity:resCap('tech'),knowledge:S.res.tech,medal:S.res.medal,
  steel:S.res.steel,starOriginStone:S.items.starOriginStone,storeLevel:S.eraStorage.quantumKnowledge,
  usedBlueprints:S.beastExchange.scrollUsed})`);
assert.ok(fixture.capacity>=CFG_COST.knowledge);
const research=run("researchScience('sci_astral_armament')");
assert.equal(research.ok,true);
assert.equal(run('S.res.tech'),0);
assert.equal(run('S.res.medal'),0);
assert.equal(run("S.sciences.filter(x=>x==='sci_astral_armament').length"),1);
assert.equal(run("upgradeQuantumArmament('star_trooper','atk').ok"),true);
assert.equal(run("upgradeQuantumArmament('star_trooper','hp').ok"),true);
assert.equal(run('S.res.steel'),fixture.steel-16000);
assert.equal(run('S.items.starOriginStone'),fixture.starOriginStone-20);
const upgraded=run(`({attack:weaponAttack('star_trooper'),hp:battleVitals('star_trooper',7,true).maxHp,
  attackLevel:S.quantumArmament.star_trooper.atk,hpLevel:S.quantumArmament.star_trooper.hp,
  pool:S.pool,formation:S.formation})`);
const reloaded=environment({rts_save:e.store.get('rts_save')});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run('S.quantumArmament.star_trooper.atk'),1);
assert.equal(reloaded.run('S.quantumArmament.star_trooper.hp'),1);

run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
    __timers.delete(first[0]);first[1].fn();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  Math.random=()=>0.5;`);
assert.equal(run('selEnemy(99)'),true);
run('openBattle()');
assert.equal(run('S.battleActive'),true);
const entry=run(`({star:B.ourUnits.filter(x=>x.type==='star_trooper').map(x=>({atk:x.atk,maxHp:x.maxHp,count:x.initialCount})),
  enemyHp:B.enemyUnits.reduce((sum,x)=>sum+x.maxHp,0)})`);
assert.ok(entry.star.length>0);
assert.ok(entry.star[0].atk>baselineStats.attack);
assert.ok(entry.star[0].maxHp>baselineStats.hp);
assert.equal(entry.star[0].atk,run("battleMilitaryAttack('star_trooper')"));
assert.equal(entry.star[0].maxHp,run("battleVitals('star_trooper',7,true).maxHp"));
let callbacks=0;
while(run('S.battleActive')&&callbacks<5000){assert.equal(run('__step()'),true);callbacks++}
assert.ok(callbacks<5000,'battle did not settle');
const outcome=run("document.getElementById('battle-result').className");
assert.ok(['win','lose'].includes(outcome));
const battle={outcome,callbacks,round:run('B.round'),remainingEnemyHp:run('B.enemyUnits.reduce((sum,x)=>sum+Math.max(0,x.hp),0)'),
  starAfter:run("B.ourUnits.filter(x=>x.type==='star_trooper').map(x=>({hp:x.hp,maxHp:x.maxHp}))")};
assert.equal(hash(fs.readFileSync(sourcePath,'utf8')),sourceHash);
const result={source:'docs/codex/reports/data/p397-quantum-stage100-paid-save.json',sourceHash,
  sourceSaveVersion:33,newSaveVersion:34,natural,naturalAfterRefusal,baselineStats,
  conditionalFixture:{...fixture,seeded:true,notes:'VM-only: quantumKnowledge level 5, 25 additional used blueprints and one-time resources were assigned, not earned or paid'},
  paidResearchCost:CFG_COST,upgraded:{attack:upgraded.attack,hp:upgraded.hp,attackLevel:upgraded.attackLevel,hpLevel:upgraded.hpLevel},
  entry,battle};
const output=path.join(root,'docs/codex/reports/data/p399-quantum-armament-battle.json');
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({natural,baselineStats,fixture:result.conditionalFixture,paidResearchCost:CFG_COST,
  upgraded:result.upgraded,entry,battle,output:path.relative(root,output)},null,2));
