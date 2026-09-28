'use strict';
// Continue a real paid save through one actual battle; the fixed loot roll selects the rare source branch.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p292-sacred-bloodline-paid-save.json',sourceRaw=fs.readFileSync(path.join(data,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(sourceRaw),'a5c3bc4343bfad0e0f1625ee6fa3e28fe6ba8a0e3ff986e4de28650491c7d8a1');
const sourceData=JSON.parse(sourceRaw),e=environment({rts_save:sourceRaw}),run=e.run;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${sourceData.ts}+(S.tick-${sourceData.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));`);
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),sourceRaw);
const initial={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  starAttack:run("weaponAttack('star_trooper')"),starBaseAttack:run('CFG.units.star_trooper.atk'),
  starHp:run("battleVitals('star_trooper',1,true).hp")};
assert.equal(initial.ember,0);
run(`globalThis.__battleSeed=1;Math.random=()=>{
  if(!S.battleActive)return 0;
  let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296};`);
run("openMaterialDomain('phantomFlower')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
const postBattle={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),callbacks,
  chancePer10000:run('godEmberDropChance(S.killValues.godPhantom)')};
assert.equal(postBattle.alert,initial.alert+100);
assert.equal(postBattle.ember,1);
assert.ok(postBattle.blood>initial.blood);
run('exitBattle()');
const used=run("useEmberElixir('star_trooper',1)");
assert.equal(used.ok,true,JSON.stringify(used));
const terminal={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  starInfusions:run('S.attackInfusions.star_trooper'),starAttack:run("weaponAttack('star_trooper')"),
  starHp:run("battleVitals('star_trooper',1,true).hp")};
assert.equal(terminal.ember,0);
assert.equal(terminal.starInfusions,1);
assert.ok(Math.abs(terminal.starAttack-initial.starAttack-initial.starBaseAttack*0.1)<1e-8);
assert.equal(terminal.starHp,initial.starHp);
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.attackInfusions.star_trooper'),1);
assert.equal(reload.run('S.items.emberElixir'),0);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(sourceRaw));
const savePath='p294-ember-elixir-paid-save.json',reportPath='p294-ember-elixir-paid-report.json';
const report={batch:'P294',kind:'real god-domain victory, favorable fixed rare-loot roll, and paid permanent attack infusion',
  source,sourceSha256:sha(sourceRaw),battleSeed:1,lootRoll:0,initial,postBattle,used,terminal,savePath,saveSha256:sha(output)};
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
