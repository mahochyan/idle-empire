'use strict';
// Consolidate and assert the paid level-5→6 route without replaying game formulas.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(dataDir,name),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dataDir,name))).digest('hex');
const checkpoints={
  start:'p276-awakening-level4-replenished-save.json',
  equipment:'p277-awakening-steam3-energy3-rifle2-sniper2-paid-save.json',
  level5:'p277-awakening-energy3-opt-single-seed10-0312-2130-level5-win-save.json',
  restored:'p277-awakening-level5-replenished-save.json',
  pretrial6:'p277-awakening-101star-level6-fruit-seed10-terminal-save.json'
};
assert.equal(hash(checkpoints.start),'3ebea242ba3c3dc1d92e09a6f6d467ffc47553f96cffdfcdb20c26c1d46ee5fe');
const saves={};
for(const [key,file]of Object.entries(checkpoints)){
  const raw=fs.readFileSync(path.join(dataDir,file),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'ok',key+' reload');
  saves[key]={file,sha256:hash(file),level:e.run('S.awakening.star_trooper.level'),stars:e.run('S.awakening.star_trooper.stars'),
    army:e.run('armyCount()'),deployed:e.run('formSoldierCount()'),star:e.run("expeditionCount('star_trooper')"),fruit:e.run('S.items.trialFruit'),
    core:e.run('S.items.godCore')};
}
assert.equal(saves.start.level,4);assert.equal(saves.start.deployed,587);
assert.equal(saves.equipment.level,4);assert.equal(saves.equipment.deployed,587);
assert.deepEqual([saves.level5.level,saves.level5.deployed,saves.level5.star,saves.level5.fruit],[5,429,101,21]);
assert.deepEqual([saves.restored.level,saves.restored.deployed,saves.restored.star],[5,587,101]);
assert.deepEqual([saves.pretrial6.level,saves.pretrial6.deployed,saves.pretrial6.star,saves.pretrial6.fruit],[5,587,101,130]);
const paidFiles=['p277-awakening-steam2-paid.json','p277-awakening-steam2-energy2-paid.json',
  'p277-awakening-steam3-energy2-paid.json','p277-awakening-steam3-energy2-rifle2-paid.json',
  'p277-awakening-steam3-energy2-rifle2-sniper2-paid.json','p277-awakening-steam3-energy3-rifle2-sniper2-paid.json'];
const upgrades=paidFiles.map(file=>{
  const x=read(file);
  assert.ok(x.investments.length>=1,file+' investments');
  assert.equal(x.sourceSha256,hash(path.basename(x.source)),file+' input hash');
  assert.equal(x.saveSha256,hash(path.basename(x.file)),file+' save hash');
  return{file,weapon:x.weapon,target:x.target,seconds:x.seconds,
    paid:Object.fromEntries(Object.entries(x.investments[0].cost).map(([k,v])=>[k,v*x.investments[0].steps]))};
});
const coreFarms=['p277-awakening-core-1-pressure.json','p277-awakening-core-rifle2-2-pressure.json',
  'p277-awakening-core-sniper2-1-pressure.json'].map(file=>{
    const x=read(file);assert.equal(x.wins,x.count);assert.equal(x.sourceSha256,hash(path.basename(x.source)));
    return{file,wins:x.wins,coreGained:x.last.after.core-x.initial.core,soldierLoss:x.initial.army-x.last.after.army};
  });
const default5=[],silver5=[],trial6=[];
for(let seed=1;seed<=11;seed++){
  const a=read(`p277-awakening-101star-energy3-level5-seed${seed}-pressure.json`);
  const b=read(`p277-awakening-energy3-opt-single-order-silver_heavy-seed${seed}.json`);
  const c=read(`p277-awakening-101star-level6-trial-seed${seed}-pressure.json`);
  assert.equal(a.summary.seed,seed);assert.equal(b.seed,seed);assert.equal(c.summary.seed,seed);
  assert.equal(b.sourceSha256,saves.equipment.sha256);
  assert.equal(a.summary.start.level,4);assert.equal(c.summary.start.level,5);
  default5.push({seed,result:a.summary.last.result,soldiers:a.summary.last.soldiers,star:a.summary.last.star,enemyHpLeft:a.summary.last.enemyHpLeft});
  const q=b.results[0];assert.equal(b.tested,1);
  if(q.terminal){assert.equal(q.terminal.sha256,hash(path.basename(q.terminal.file)));}
  silver5.push({seed,result:q.trial.result,soldiers:q.soldiers,star:q.star,enemyHpLeft:q.trial.enemyHpLeft});
  trial6.push({seed,result:c.summary.last.result,enemyHpLeft:c.summary.last.enemyHpLeft});
}
assert.equal(default5.filter(x=>x.result==='win').length,1);
assert.equal(silver5.filter(x=>x.result==='win').length,3);
assert.equal(trial6.filter(x=>x.result==='win').length,0);
assert.ok(trial6.every(x=>x.enemyHpLeft>=21701&&x.enemyHpLeft<=37362));
const replenish=read('p277-awakening-level5-replenish.json');
assert.deepEqual(replenish.totalCost,{copper:494000,iron:494000,steel:499500,food:82500});
assert.equal(replenish.elapsedOnlineSec,2651);
assert.equal(replenish.saveSha256,saves.restored.sha256);
const fruit=read('p277-awakening-101star-level6-fruit-seed10-pressure.json');
assert.equal(fruit.summary.wins,2);assert.equal(fruit.summary.last.fruit,130);assert.equal(fruit.summary.last.soldiers,587);
const summary={batch:'P277',unit:'simulated online seconds, resources, soldiers and battle HP',checkpoints:saves,upgrades,coreFarms,
  replenish:{seconds:replenish.elapsedOnlineSec,cost:replenish.totalCost,minFood:replenish.minFood},
  level5:{default:default5,silver:silver5},level6:{fruitWins:2,pretrialFruit:130,seeds:trial6}};
const file=path.join(dataDir,'p277-awakening-level5-6-audit.json');
fs.writeFileSync(file,JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({checkpoints:saves,upgrades,coreFarms,replenish:summary.replenish,
  level5Wins:{default:default5.filter(x=>x.result==='win').length,silver:silver5.filter(x=>x.result==='win').length},
  level6Wins:trial6.filter(x=>x.result==='win').length,level6EnemyHpLeft:{min:Math.min(...trial6.map(x=>x.enemyHpLeft)),max:Math.max(...trial6.map(x=>x.enemyHpLeft))}},null,2));
