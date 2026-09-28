'use strict';
// Continue the paid P329 roster and RNG through real battles under the current queue rule.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceFile='docs/codex/reports/data/p329-soul-refreshed-save.json';
const sourceText=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(sourceText),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const previous=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p329-soul-post-star-paid.json'),'utf8'));
assert.equal(previous.rngEnd,3431887083);
const origin=JSON.parse(sourceText),env=environment({rts_save:sourceText}),run=env.run;
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
  addLog=m=>S.log.push(String(m));
  globalThis.__rng=${previous.rngEnd};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
function status(){return run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,slots:[...S.soulRealmTeam.slots],rng:__rng})')}
const initial=status();assert.equal(initial.army,672);assert.equal(initial.deployed,626);assert.equal(initial.stone,39);assert.equal(initial.alert,6050);
const order=initial.slots.map((tierId,slot)=>({tierId,slot})).filter(x=>x.tierId!==null).sort((a,b)=>a.tierId-b.tierId);
const rounds=[];
for(const {slot,tierId} of order){
  const before=status();assert.equal(before.slots[slot],tierId);
  assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,mass:B.enemyUnits[0].attackMass})');
  assert.equal(enemy.mass,6);
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");assert.ok(['win','lose'].includes(result));
  const enemyRemainingHp=run('B.enemyUnits[0].hp');
  const after=status();
  if(result==='win'){assert.equal(after.slots[slot],null);assert.ok(after.stone>before.stone);assert.equal(after.alert,before.alert+run(`soulRealmTier(${tierId}).alert`))}
  else{assert.equal(after.slots[slot],tierId);assert.equal(after.stone,before.stone);assert.equal(after.alert,before.alert)}
  rounds.push({slot,tierId,before,enemy,result,enemyRemainingHp,after,callbacks});
  run('exitBattle()');
  if(result==='lose'||after.deployed===0)break;
}
const output='docs/codex/reports/data/p332-soul-queue-continuous.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P332',sourceFile,sourceSha256:sha(sourceText),rngStart:previous.rngEnd,
  kind:'same paid save and uninterrupted RNG; actual battles and settlement, no purchases or roster restoration',initial,rounds,final:status(),
  limits:['No soldier replenishment after casualties; this is a lower-bound continuous route, not a full paid recovery.']},null,2)+'\n');
console.log(JSON.stringify({initial,rounds:rounds.map(x=>({slot:x.slot,tierId:x.tierId,result:x.result,enemy:x.enemy,enemyRemainingHp:x.enemyRemainingHp,army:x.after.army,stone:x.after.stone,alert:x.after.alert,callbacks:x.callbacks})),final:status(),output},null,2));
