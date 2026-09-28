'use strict';
// Check the real paid armor continuation and compare identical fixed-seed trials.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(data,name))).digest('hex');
const files={start:'p277-awakening-101star-level6-fruit-seed10-terminal-save.json',
  core:'p278-awakening-core-stage5-pretrial-2-paid-save.json',
  restored:'p278-awakening-stage5-medal-restored-save.json',
  armor:'p278-awakening-energy4-paid-save.json'};
assert.equal(hash(files.start),'d2f6ff6aa140a1461ee1100581fcbfecde0254f11acf428b6052bc4549ef6e27');
const checkpoints={};
for(const [key,file]of Object.entries(files)){
  const e=environment({rts_save:fs.readFileSync(path.join(data,file),'utf8')});
  assert.equal(e.run('loadSaveAndApply().status'),'ok',key);
  checkpoints[key]={file,sha256:hash(file),level:e.run('S.awakening.star_trooper.level'),
    army:e.run('armyCount()'),deployed:e.run('formSoldierCount()'),star:e.run("expeditionCount('star_trooper')"),
    core:e.run('S.items.godCore'),fruit:e.run('S.items.trialFruit'),
    energyArmor:e.run('S.weaponForge.energyArmor.level')};
}
assert.deepEqual(Object.values(checkpoints).map(x=>x.level),[5,5,5,5]);
assert.deepEqual(Object.values(checkpoints).map(x=>x.deployed),[587,580,587,587]);
assert.deepEqual(Object.values(checkpoints).map(x=>x.core),[17,97,97,33]);
assert.deepEqual(Object.values(checkpoints).map(x=>x.energyArmor),[3,3,3,4]);
const farm=read('p278-awakening-core-stage5-pretrial-2-pressure.json');
assert.equal(farm.sourceSha256,checkpoints.start.sha256);
assert.equal(farm.terminal.sha256,checkpoints.core.sha256);
assert.equal(farm.wins,2);assert.equal(farm.last.after.core-farm.initial.core,80);
assert.equal(farm.initial.army-farm.last.after.army,7);
const restore=read('p278-awakening-stage5-medal-restore.json');
assert.equal(restore.sourceSha256,checkpoints.core.sha256);
assert.equal(restore.saveSha256,checkpoints.restored.sha256);
assert.deepEqual(restore.targets,{armored_trooper:3,alloy_special:4});
assert.deepEqual(restore.cost,{copper:6000,iron:6000,steel:6400,food:6000});
assert.equal(restore.seconds,12);
const forge=read('p278-awakening-energy4-paid.json');
assert.equal(forge.sourceSha256,checkpoints.restored.sha256);
assert.equal(forge.saveSha256,checkpoints.armor.sha256);
assert.equal(forge.weapon,'energyArmor');assert.equal(forge.target,4);
assert.deepEqual(forge.investments.map(x=>({steps:x.steps,cost:x.cost})),[{steps:16,cost:{godCore:4}}]);
const seeds=[];
for(let seed=1;seed<=11;seed++){
  const before=read(`p277-awakening-101star-level6-trial-seed${seed}-pressure.json`).summary;
  const after=read(`p278-awakening-101star-energy4-level6-seed${seed}-pressure.json`).summary;
  assert.equal(before.seed,seed);assert.equal(after.seed,seed);
  assert.equal(after.start.level,5);assert.equal(after.start.soldiers,587);assert.equal(after.start.star,101);
  assert.equal(after.start.fruit,130);assert.equal(after.last.kind,'trial');
  assert.deepEqual(after.last.enemy,before.last.enemy);
  seeds.push({seed,before:{result:before.last.result,enemyHpLeft:before.last.enemyHpLeft},
    after:{result:after.last.result,enemyHpLeft:after.last.enemyHpLeft},
    hpReduction:before.last.enemyHpLeft-after.last.enemyHpLeft});
}
assert.equal(seeds.filter(x=>x.after.result==='win').length,0);
assert.equal(seeds.filter(x=>x.hpReduction>0).length,10);
const ents=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const guard=ents['540091'],star=ents['370009'];
assert.ok(guard['godWar:SkillEffect1'].includes('30%概率'));
assert.ok(star['army:GodSkill03'].includes('100星级后解锁'));
const summary={batch:'P278',unit:'simulated online seconds, resources, soldiers, battle HP',checkpoints,
  farm:{wins:farm.wins,coreGained:80,losses:7},restore:{targets:restore.targets,cost:restore.cost,seconds:restore.seconds,minFood:restore.minFood},
  forge:{weapon:forge.weapon,from:3,to:4,steps:16,corePaid:64,seconds:forge.seconds},
  guardReference:{source:'210(1)_unpacked/_analysis/entities_table.json',id:'540091',skill1:guard['godWar:SkillEffect1'],
    skill2:guard['godWar:SkillEffect2'],skill3:guard['godWar:SkillEffect3']},
  starReference:{source:'210(1)_unpacked/_analysis/entities_table.json',id:'370009',skill1:star['army:GodSkill01'],
    skill2:star['army:GodSkill02'],skill3:star['army:GodSkill03']},
  trials:{seeds,wins:0,positiveDamageDeltas:10,minEnemyHpLeft:Math.min(...seeds.map(x=>x.after.enemyHpLeft)),
    maxEnemyHpLeft:Math.max(...seeds.map(x=>x.after.enemyHpLeft))}};
fs.writeFileSync(path.join(data,'p278-awakening-level6-energy4-audit.json'),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({checkpoints,farm:summary.farm,restore:summary.restore,forge:summary.forge,
  trialSummary:{wins:summary.trials.wins,positiveDamageDeltas:summary.trials.positiveDamageDeltas,
    minEnemyHpLeft:summary.trials.minEnemyHpLeft,maxEnemyHpLeft:summary.trials.maxEnemyHpLeft}},null,2));
