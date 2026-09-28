'use strict';
// P203: compare L40 rosters from two paid P202 L40 pre-battle saves.
// Only the isolated VM enemy roster changes; combat and save use real game code.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p202-fourth-chapter-paid.json');
const outputPath=path.join(root,'docs/codex/reports/data/p203-l40-boss-sensitivity.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(source.batch,'P202');
const inputs={p202:sha(fs.readFileSync(sourcePath)),
  levels:sha(fs.readFileSync(path.join(root,'levels.js'))),
  config:sha(fs.readFileSync(path.join(root,'config.js'))),
  math:sha(fs.readFileSync(path.join(root,'math.js'))),
  technology:sha(fs.readFileSync(path.join(root,'technology.js')))};
const profiles=source.profiles.filter(p=>p.sourceKind==='P194'&&[1,15].includes(p.seed));
assert.equal(profiles.length,2);
const variants=[
  {id:'current',counts:[1,1,1],current:true},
  {id:'4-3-2',counts:[4,3,2]},
  {id:'6-4-3',counts:[6,4,3]},
  {id:'7-5-3',counts:[7,5,3]},
  {id:'8-6-4',counts:[8,6,4]}
];
const seeds=Array.from({length:16},(_,i)=>i+1);
function units(counts){return{infantry:[...counts],archer:[...counts],
  cavalry_t1:[...counts],mage_t1:counts.slice(0,2)};}
function start(save,saveSha,label){
  assert.equal(sha(save),saveSha,`${label}: save SHA`);
  const world=environment({rts_save:save});
  const run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}: load`);
  assert.equal(run('saveProtected()'),false,`${label}: not protected`);
  run(`globalThis.__p203Timers=new Map();globalThis.__p203TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p203TimerId++;
      __p203Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p203Timers.delete(id);
    globalThis.__p203Step=()=>{const next=__p203Timers.entries().next().value;
      if(!next)return false;__p203Timers.delete(next[0]);next[1]();return true};
    globalThis.__p203Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p203Nodes.has(id))__p203Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p203Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));`);
  return{world,run};
}
function setRoster(run,variant){
  const before=plain(run('CFG.enemies[39]'));
  assert.equal(before.id,40);
  if(!variant.current)run(`CFG.enemies[39].units=${JSON.stringify(units(variant.counts))}`);
  const after=plain(run('CFG.enemies[39]'));
  assert.deepEqual(after.units,units(variant.counts));
  delete before.units;delete after.units;
  assert.deepEqual(after,before,`${variant.id}: changed non-roster Boss field`);
}
function enemyStats(save,saveSha,variant){
  const {run}=start(save,saveSha,`${variant.id} enemy`);
  setRoster(run,variant);
  return plain(run(`S.selEnemy=39;S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
}
function fight(profile,variant,seed){
  const stage=profile.stages.find(s=>s.stage===40);
  assert.ok(stage?.prepared?.save,'P202 paid L40 pre-battle save missing');
  assert.equal(stage.battle?.won,true,'P202 original L40 must win');
  const {world,run}=start(stage.prepared.save,stage.prepared.saveSha256,
    `${profile.seed}/${variant.id}/${seed}`);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:39},(_,i)=>i+1),'L40 requires real prior wins');
  setRoster(run,variant);
  const beforeArmy=run('armyCount()');
  const beforeRes=plain(run('({...S.res})'));
  const beforeEssence=plain(run('({...S.essence})'));
  const initial=(seed*1009+40*9176)>>>0;
  run(`globalThis.__p203Rng=${initial};Math.random=()=>{
    let x=__p203Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p203Rng=x>>>0;return __p203Rng/4294967296;}`);
  run('selEnemy(39);openBattle()');
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p203Step()'),true,'battle async callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle did not finish');
  const won=run('S.defeated.includes(40)');
  const round=run('B.round');
  const winner=run('B.winner');
  const afterArmy=run('armyCount()');
  const afterRes=plain(run('({...S.res})'));
  const afterEssence=plain(run('({...S.essence})'));
  assert.ok(afterArmy<=beforeArmy&&afterArmy>=0,'battle cannot add soldiers');
  if(!won){
    assert.deepEqual(afterRes,beforeRes,'loss cannot credit reward');
    assert.deepEqual(afterEssence,beforeEssence,'loss cannot credit essence');
  }
  run('exitBattle()');
  assert.equal(run('save().ok'),true);
  const saved=world.store.get('rts_save');
  assert.equal(typeof saved,'string');
  const verify=environment({rts_save:saved});
  assert.equal(verify.run('loadSaveAndApply().status'),'ok','post-battle reload');
  assert.equal(verify.run('armyCount()'),afterArmy,'casualties persisted');
  assert.equal(verify.run('S.defeated.includes(40)'),won,'victory persisted');
  return{sourceKind:profile.sourceKind,sourceSeed:profile.seed,
    sourceSaveSha256:stage.prepared.saveSha256,
    variant:variant.id,seed,won,round,winner,callbacks,
    loss:beforeArmy-afterArmy,afterArmy,
    actualReward:Object.fromEntries(['wood','stone','food']
      .map(k=>[k,afterRes[k]-beforeRes[k]])),
    essenceDelta:Object.fromEntries(Object.keys(afterEssence)
      .filter(k=>afterEssence[k]!==beforeEssence[k])
      .map(k=>[k,afterEssence[k]-(beforeEssence[k]||0)])),
    postSaveSha256:sha(saved)};
}
const enemy=variants.map(variant=>({variant:variant.id,
  ...enemyStats(profiles[0].stages.find(s=>s.stage===40).prepared.save,
    profiles[0].stages.find(s=>s.stage===40).prepared.saveSha256,variant)}));
const outcomes=[];
for(const profile of profiles)for(const variant of variants)for(const seed of seeds)
  outcomes.push(fight(profile,variant,seed));
for(const profile of profiles){
  const actual=outcomes.find(o=>o.sourceSeed===profile.seed&&o.variant==='current'&&
    o.seed===profile.seed);
  const baseline=profile.stages.find(s=>s.stage===40).battle;
  assert.deepEqual({won:actual.won,round:actual.round,loss:actual.loss,
    callbacks:actual.callbacks},
  {won:baseline.won,round:baseline.round,loss:baseline.lossTotal,
    callbacks:baseline.callbacks},'P202 baseline not reproduced');
}
const summary=profiles.flatMap(profile=>variants.map(variant=>{
  const rows=outcomes.filter(o=>o.sourceSeed===profile.seed&&o.variant===variant.id);
  const losses=rows.map(o=>o.loss).sort((a,b)=>a-b);
  return{sourceSeed:profile.seed,variant:variant.id,
    wins:rows.filter(o=>o.won).length,attempts:rows.length,
    lossMin:losses[0],lossMedian:(losses[7]+losses[8])/2,
    lossMax:losses.at(-1),lossesOnOriginalSeed:rows.find(o=>o.seed===profile.seed).loss,
    failedSeeds:rows.filter(o=>!o.won).map(o=>o.seed)};
}));
const result={batch:'P203',unit:'enemy HP and attack mass; battle losses in soldiers',
  scope:'Two P202 fully paid 73-soldier L40 pre-battle saves; 16 fixed battle streams each; isolated L40 roster only. No resource, soldier, win or essence injection.',
  inputs,variants,enemy,summary,outcomes};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P203',enemy,summary},null,2));
