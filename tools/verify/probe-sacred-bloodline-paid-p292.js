'use strict';
// Continue the P291 paid save with one real god-domain victory and one paid bloodline infusion.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p291-god-blood-cleanser-paid-save.json',sourceRaw=fs.readFileSync(path.join(data,source),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(sourceRaw),'820721bd21fd33867a95dbb58fbae97a429dd9e67d576d934e893055351a6f16');
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
assert.equal(run('S.items.sacredBlood'),0);
assert.equal(run('S.bloodline.star_trooper'),undefined);
const initial={blood:run('S.items.sacredBlood'),cleanser:run('S.items.domainCleanser'),
  soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),
  hpPerSoldier:run("battleVitals('star_trooper',1,true).hp")};
run('globalThis.__battleSeed=1;Math.random=()=>{let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296}');
run("openMaterialDomain('phantomFlower')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
const postBattle={blood:run('S.items.sacredBlood'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),callbacks};
assert.equal(postBattle.blood,1);
assert.equal(postBattle.alert,initial.alert+100);
run('exitBattle()');
const used=run("useSacredBlood('star_trooper',1)");
assert.equal(used.ok,true,JSON.stringify(used));
const terminal={blood:run('S.items.sacredBlood'),cleanser:run('S.items.domainCleanser'),
  soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),
  starBloodline:run('S.bloodline.star_trooper'),hpPerSoldier:run("battleVitals('star_trooper',1,true).hp"),
  enemyHpPerSoldier:run("battleVitals('star_trooper',1,false).hp")};
assert.equal(terminal.blood,0);
assert.equal(terminal.starBloodline,1);
assert.ok(Math.abs(terminal.hpPerSoldier-initial.hpPerSoldier-0.04)<1e-8);
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.bloodline.star_trooper'),1);
assert.equal(reload.run('S.items.sacredBlood'),0);
assert.equal(hash(fs.readFileSync(path.join(data,source),'utf8')),hash(sourceRaw));
const savePath='p292-sacred-bloodline-paid-save.json',reportPath='p292-sacred-bloodline-paid-report.json';
const report={batch:'P292',kind:'real god-domain blood drop and paid single-unit permanent HP infusion',
  source,sourceSha256:hash(sourceRaw),initial,postBattle,used,terminal,savePath,saveSha256:hash(output)};
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
