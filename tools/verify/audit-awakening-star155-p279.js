'use strict';
// Consolidate the paid Lv50 armory / 155-star-soldier route and formation trials.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(data,name),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(data,name))).digest('hex');
const files={start:'p278-awakening-energy4-paid-save.json',armory:'p279-awakening-armory50-paid-save.json',star:'p279-awakening-star155-paid-save.json'};
assert.equal(hash(files.start),'1e00aa48053f4222e250bbaddf45c55bd8a2aa780d0fcb82cbd0ff6541dfadeb');
const saves={};
for(const [key,file]of Object.entries(files)){
  const e=environment({rts_save:fs.readFileSync(path.join(data,file),'utf8')});
  assert.equal(e.run('loadSaveAndApply().status'),'ok',key);
  saves[key]={file,sha256:hash(file),tick:e.run('S.tick'),level:e.run('S.awakening.star_trooper.level'),
    armory:e.run("bldSt('electric_armory').lv"),starCap:e.run("unitCap('star_trooper')"),
    army:e.run('armyCount()'),deployed:e.run('formSoldierCount()'),star:e.run("expeditionCount('star_trooper')"),
    fruit:e.run('S.items.trialFruit')};
}
assert.deepEqual(Object.values(saves).map(x=>x.level),[5,5,5]);
assert.deepEqual(Object.values(saves).map(x=>x.armory),[32,50,50]);
assert.deepEqual(Object.values(saves).map(x=>x.starCap),[101,155,155]);
assert.deepEqual(Object.values(saves).map(x=>x.star),[101,101,155]);
assert.deepEqual(Object.values(saves).map(x=>x.fruit),[130,130,130]);
const pre=read('p279-awakening-armory-preflight.json');
assert.equal(pre.sourceSha256,saves.start.sha256);
assert.equal(pre.kind,'conditional preflight only; no actions, payment or save');
const armory=read('p279-awakening-armory50-paid.json');
assert.equal(armory.sourceSha256,saves.start.sha256);
assert.equal(armory.saveSha256,saves.armory.sha256);
assert.equal(armory.rows.length,18);
assert.deepEqual(armory.paid,{wood:3851091,stone:3369708,food:2118104});
assert.equal(armory.seconds,998);assert.equal(armory.phases.building,909);
assert.equal(saves.armory.tick-saves.start.tick,998);
for(let i=0;i<18;i++){
  assert.equal(armory.rows[i].from,32+i);assert.equal(armory.rows[i].to,33+i);
  assert.deepEqual(armory.rows[i].cost,pre.rows[i].cost);
  assert.equal(armory.rows[i].starCap,5+3*(33+i));
}
const train=read('p279-awakening-star155-paid.json');
assert.equal(train.sourceSha256,saves.armory.sha256);
assert.equal(train.saveSha256,saves.star.sha256);
assert.equal(train.target,54);
assert.deepEqual(train.actualPaid,{copper:432000,iron:432000,steel:432000});
assert.equal(train.elapsedOnlineSec,1867);
assert.equal(saves.star.tick-saves.armory.tick,1867);
assert.deepEqual([saves.star.army,saves.star.deployed,saves.star.star],[671,626,155]);
const form=read('p279-awakening-star155-formation.json');
assert.equal(form.sourceSha256,saves.star.sha256);
assert.equal(form.tested,66);assert.equal(form.results.length,66);assert.equal(form.wins,0);
assert.equal(form.variants.length,6);
assert.ok(form.results.every(x=>x.result==='lose'&&x.level===5&&x.enemy.hp===59623));
const baseline=form.byVariant.find(x=>x.key==='baseline');
assert.deepEqual([baseline.wins,baseline.minEnemyHpLeft,baseline.maxEnemyHpLeft],[0,20821,34493]);
const summary={batch:'P279',unit:'simulated online seconds, resources, soldiers, battle HP',saves,
  armory:{levels:18,paid:armory.paid,seconds:armory.seconds,phases:armory.phases,minFood:armory.minFood},
  train:{soldiers:54,paid:train.actualPaid,seconds:train.elapsedOnlineSec,phases:train.phases,minFood:train.minFood},
  totalOnlineSeconds:armory.seconds+train.elapsedOnlineSec,
  trial:{tested:form.tested,wins:form.wins,byVariant:form.byVariant,results:form.results}};
fs.writeFileSync(path.join(data,'p279-awakening-star155-audit.json'),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({saves,armory:summary.armory,train:summary.train,totalOnlineSeconds:summary.totalOnlineSeconds,
  trial:{tested:summary.trial.tested,wins:summary.trial.wins,byVariant:summary.trial.byVariant}},null,2));
