'use strict';
// P327: 从99石实付补兵档延续同一 RNG 流，以玩家现行源倍率战斗打第三个普通位并支付首星。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceFile='docs/codex/reports/data/p327-soul-source-two-win-restored-save.json';
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(source),'9a8fb7f7909c66528d2e7348728bfe50f461d5c1e5caed4dffed5285e17449dc');
const recovery=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p327-soul-source-two-win-recovery.json'),'utf8'));
assert.equal(recovery.restoredSha256,sha(source));
assert.equal(recovery.rngStart,2902581373);
assert.ok(Number.isSafeInteger(recovery.rngEnd)&&recovery.rngEnd>0);
const origin=JSON.parse(source),env=environment({rts_save:source}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=${recovery.rngEnd};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
// P327首星历史账发生在英魂固定入场人数规则下，后续复核继续显式使用旧口径。
run(`globalThis.__historicalEncounter=materialDomainEncounter;
  materialDomainEncounter=function(key,alert=null,tierId=null){const e=__historicalEncounter(key,alert,tierId);
    if(key==='soulStone'&&e)e.attackMassFallsWithHp=false;return e};`);
const slot=origin.soulRealmTeam.slots.indexOf(540299);
assert.ok(slot>=0);
const before=run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,stars:S.soulRanks.arcane_mage?.stars||0})');
assert.equal(before.army,672);assert.equal(before.deployed,626);assert.equal(before.stone,99);assert.equal(before.alert,4850);assert.equal(before.stars,0);
assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
assert.ok(callbacks<3000);
const result=run("document.getElementById('battle-result').className");
const after=run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,stars:S.soulRanks.arcane_mage?.stars||0,enemyHp:B.enemyUnits[0].hp})');
let upgrade=null,final=null,saveFile=null,saveSha256=null;
if(result==='win'){
  assert.equal(after.stone,103);assert.equal(after.alert,5000);
  assert.equal(run(`S.soulRealmTeam.slots[${slot}]`),null);
  upgrade=run("upgradeSoulRank('arcane_mage')");assert.equal(upgrade.ok,true);
  final=run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,stars:S.soulRanks.arcane_mage.stars})');
  assert.equal(final.stone,3);assert.equal(final.stars,1);
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.soulRanks.arcane_mage.stars'),1);
  saveFile='docs/codex/reports/data/p327-soul-source-growth-paid-first-star-save.json';
  fs.writeFileSync(path.join(root,saveFile),saved,'utf8');saveSha256=sha(saved);
}else{
  assert.equal(after.stone,99);assert.equal(after.alert,4850);
  assert.equal(run(`S.soulRealmTeam.slots[${slot}]`),540299);
}
const report={batch:'P327',kind:'real paid casualty recovery followed by one uninterrupted xorshift32 battle stream under current player-code source growth mapping',
  sourceFile,sourceSha256:sha(source),recoveryReport:'docs/codex/reports/data/p327-soul-source-two-win-recovery.json',
  rngStart:recovery.rngEnd,rngEnd:run('__rng'),unit:'simulated online seconds, soldiers, battle HP and material items',
  slot,before,enemy,result,after,callbacks,upgrade,final,saveFile,saveSha256,
  limits:['The P324 source of the 91-stone paid save was selected from earlier independent fixed-seed wins, so this is not a natural new-game route.',
    'The single-battalion HP/attack-mass conversion is local combat adaptation, not proof of source combat equivalence.']};
const reportFile='docs/codex/reports/data/p327-soul-source-growth-paid-star.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(source));
console.log(JSON.stringify({slot,before,enemy,result,after,callbacks,upgrade,final,saveSha256,reportFile},null,2));
