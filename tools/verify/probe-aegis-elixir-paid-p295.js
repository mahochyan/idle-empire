'use strict';
// One actual god-domain victory from a paid save; fixed favorable defense-loot roll, no item injection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p294-ember-elixir-paid-save.json',raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'a1fa5b1d6da51151de9490f829ba064374f204374c2caef3435fb6676424d6a1');
const sourceData=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${sourceData.ts}+(S.tick-${sourceData.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));`);
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
const initial={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),aegis:run('S.items.aegisElixir'),
  starAttack:run("weaponAttack('star_trooper')"),starDefense:run("weaponDefense('star_trooper')"),
  starHp:run("battleVitals('star_trooper',1,true).hp"),starBaseAttack:run('CFG.units.star_trooper.atk'),
  starBaseHp:run('CFG.units.star_trooper.hpPerSoldier')};
assert.equal(initial.aegis,0);
run(`globalThis.__battleSeed=1;globalThis.__lootDraw=0;Math.random=()=>{
  if(!S.battleActive)return ++__lootDraw===1?0.5:0;
  let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296};`);
run("openMaterialDomain('phantomFlower')");
assert.equal(run('S.battleActive'),true);
run('__lootDraw=0');
let callbacks=0;
while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
const postBattle={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),aegis:run('S.items.aegisElixir'),
  callbacks,lootDraws:run('__lootDraw'),chancePer10000:run('godAegisDropChance(S.killValues.godPhantom)')};
assert.equal(postBattle.alert,initial.alert+100);
assert.equal(postBattle.ember,initial.ember);
assert.equal(postBattle.aegis,1);
assert.equal(postBattle.lootDraws,2);
run('exitBattle()');
const used=run("useAegisElixir('star_trooper',1)");
assert.equal(used.ok,true,JSON.stringify(used));
const terminal={alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),aegis:run('S.items.aegisElixir'),
  starInfusions:run('S.aegisInfusions.star_trooper'),starAttack:run("weaponAttack('star_trooper')"),
  starDefense:run("weaponDefense('star_trooper')"),starHp:run("battleVitals('star_trooper',1,true).hp")};
assert.equal(terminal.aegis,0);
assert.equal(terminal.starInfusions,1);
assert.ok(Math.abs(terminal.starAttack-initial.starAttack-initial.starBaseAttack*0.05)<1e-8);
assert.equal(terminal.starDefense,initial.starDefense+1);
assert.ok(Math.abs(terminal.starHp-initial.starHp-initial.starBaseHp*0.05)<1e-8);
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.aegisInfusions.star_trooper'),1);
assert.equal(reload.run('S.items.aegisElixir'),0);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const savePath='p295-aegis-elixir-paid-save.json',reportPath='p295-aegis-elixir-paid-report.json';
const report={batch:'P295',kind:'real god-domain victory, attack-loot miss and favorable fixed defense-loot hit, then paid compound infusion',
  source,sourceSha256:sha(raw),battleSeed:1,lootRolls:[0.5,0],initial,postBattle,used,terminal,savePath,saveSha256:sha(output)};
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
