'use strict';
// P337 conditional armament sensitivity only: no materials are granted or persisted.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p335-soul-alert7050-full-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'fc8eaa036fa8a1943b9c267c855f3ab39daa95c0cfedde2e21dbf07d89b5eb99');
const source=JSON.parse(raw),slot=source.soulRealmTeam.slots.indexOf(540399);
assert.ok(slot>=0);assert.equal(source.killValues.soulRealm,7050);assert.equal(source.items.soulStone,79);
const scenarios=[
  {key:'baseline'},
  ...[60,80,100,120,160].map(stars=>({key:`star-atk-${stars}`,arms:{star_trooper:{atk:stars}}})),
  ...[60,80,100,120,160].map(stars=>({key:`electro-atk-${stars}`,arms:{electro_trooper:{atk:stars}}})),
  ...[60,80,100,120].map(stars=>({key:`star-def-${stars}`,arms:{star_trooper:{def:stars}}})),
  ...[40,60,80].map(stars=>({key:`star-electro-atk-${stars}`,
    arms:{star_trooper:{atk:stars},electro_trooper:{atk:stars}}})),
];
const count=Number(process.argv[2]||32);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=256);
const actualContinuationSeed=2740185912;
function trial(scenario,seed){
  const e=environment({rts_save:raw}),r=e.run;
  assert.ok(['ok','migrated'].includes(r('loadSaveAndApply().status')));
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${source.ts}+(S.tick-${source.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  for(const[unitType,stats]of Object.entries(scenario.arms||{}))for(const[stat,stars]of Object.entries(stats)){
    assert.ok(Object.prototype.hasOwnProperty.call(source.armsUp,unitType));
    assert.ok(Object.prototype.hasOwnProperty.call(source.armsUp[unitType],stat));
    r(`S.armsUp['${unitType}']['${stat}'].stars=${stars}`);
    r(`S.armsUp['${unitType}']['${stat}'].progress=0`);
  }
  for(const[unitType,doses]of Object.entries(scenario.ember||{})){
    assert.ok(doses<=30);
    r(`S.attackInfusions['${unitType}']=${doses}`);
  }
  for(const[unitType,progress]of Object.entries(scenario.soul||{}))r(`S.soulRanks['${unitType}']=${JSON.stringify(progress)}`);
  const stats=r('({starAttack:weaponAttack("star_trooper"),electroAttack:weaponAttack("electro_trooper"),starDefense:weaponDefense("star_trooper"),electroDefense:weaponDefense("electro_trooper"),starHp:battleVitals("star_trooper",1,true).hpPerSoldier})');
  assert.equal(r(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after=r(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
    stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}]})`);
  assert.ok(enemy.hp>9994);assert.equal(enemy.attackMass,6);
  if(result==='win'){assert.equal(after.slot,null);assert.ok(after.stone>79);assert.equal(after.alert,7250)}
  else{assert.equal(after.slot,540399);assert.equal(after.alert,7050);assert.equal(after.stone,79)}
  r('exitBattle()');
  return{scenario:scenario.key,seed,stats,result,enemy,after,callbacks};
}
const trialSeeds=[...Array.from({length:count},(_,i)=>i+1),actualContinuationSeed];
const trials=[];for(const s of scenarios)for(const seed of trialSeeds)trials.push(trial(s,seed));
const summary=scenarios.map(s=>{
  const rows=trials.filter(x=>x.scenario===s.key),sorted=rows.map(x=>x.after.enemyHp).sort((a,b)=>a-b);
  return{key:s.key,arms:s.arms||{},ember:s.ember||{},soul:s.soul||{},stats:rows[0].stats,tested:rows.length,
    wins:rows.filter(x=>x.result==='win').length,firstWinSeed:rows.find(x=>x.result==='win')?.seed??null,
    minEnemyHp:sorted[0],medianEnemyHp:sorted[Math.floor(sorted.length/2)]};
});
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const output='docs/codex/reports/data/p337-soul-alert7050-arms.json';
const report={batch:'P337',kind:'unpaid in-memory armament sensitivity through current combat at alert 7050',sourceFile,
  sourceSha256:sha(raw),unit:'armament stars, infusion doses, one battle and HP',
  seeds:`independent xorshift32 1..${count} plus P335 real continuation ${actualContinuationSeed} per scenario`,summary,trials,
  limits:['No armament stars, ember doses or soul stars were earned, paid for, saved or merged into the source.',
    'Fixed initial seeds are conditional diagnosis, not player win-rate estimates.',
    'Only the current formation and one lowest elite slot were tested.']};
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),summary,output},null,2));
