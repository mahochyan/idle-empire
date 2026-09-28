'use strict';
// Conditional source-queue sensitivity. No player resources are granted or saved.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const refFile='210(1)_unpacked/_analysis/deob_main.js';
const reference=fs.readFileSync(path.join(root,refFile),'utf8');
assert.equal(sha(reference),'b0bc24d680517c592e8bd123148814f4f9ee24c53ddb0db8165294e131b563c4');
const queueSource=reference.slice(reference.indexOf("'key':\"getQueueAmount\""),reference.indexOf("'key':\"getTeam\"",reference.indexOf("'key':\"getQueueAmount\"")));
assert.ok(queueSource.includes('_0x23eae6<0x78?0x5:0x6'));
const attackSource=reference.slice(reference.indexOf("_0x3ab8a2=_0x3de7b4[0x0]"),reference.indexOf("_0x3ab8a2=_0x3de7b4[0x0]")+500);
assert.ok(attackSource.includes('getDefender'));
const sources={
  5450:{file:'p328-soul-normal-3-save.json',sha:'3a70475cdd16e536d86647ba95c72227eb3f827ce6e52899271fae7168831f31'},
  6050:{file:'p329-soul-refreshed-save.json',sha:'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd'}
};
const n=Number(process.argv[2]||32);assert.ok(Number.isSafeInteger(n)&&n>=1&&n<=128);
const scenarios=[{key:'prior-group-mass',mass:'prior',falls:true},{key:'source-6-fixed',mass:6,falls:false},{key:'source-6-attrition',mass:6,falls:true},
  {key:'12-fixed',mass:12,falls:false},{key:'24-fixed',mass:24,falls:false},{key:'48-fixed',mass:48,falls:false}];
function trial(alert,source,scenario,seed){
  const raw=fs.readFileSync(path.join(root,'docs/codex/reports/data',source.file),'utf8');assert.equal(sha(raw),source.sha);
  const origin=JSON.parse(raw),slot=origin.soulRealmTeam.slots.indexOf(540399);assert.ok(slot>=0);
  assert.equal(origin.killValues.soulRealm,alert);
  const env=environment({rts_save:raw}),run=env.run;assert.equal(run('loadSaveAndApply().status'),'ok');
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run(`globalThis.__baseSoulEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){const e=__baseSoulEncounter(key,alert,tierId);
      if(key==='soulStone'&&e){e.attackMass=${scenario.mass==='prior'
        ?'Math.floor(100*CFG.soulRealm.tiers.find(t=>t.id===e.soulTierId).count/CFG.soulRealm.tiers[0].count*Math.pow(CFG.soulRealm.growth.count,Math.floor(e.killValue/CFG.soulRealm.growth.alertStep)))'
        :scenario.mass};e.attackMassFallsWithHp=${scenario.falls}}return e};`);
  assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,mass:B.enemyUnits[0].attackMass})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");assert.ok(['win','lose'].includes(result));
  const after=run('({army:armyCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp})');
  if(result==='win'){assert.equal(after.alert,alert+200);assert.ok(after.stone>origin.items.soulStone)}
  else{assert.equal(after.alert,alert);assert.equal(after.stone,origin.items.soulStone)}
  run('exitBattle()');return{alert,scenario:scenario.key,seed,enemy,result,after,callbacks};
}
const trials=[];for(const[alertStr,source]of Object.entries(sources))for(const scenario of scenarios)
  for(let seed=1;seed<=n;seed++)trials.push(trial(Number(alertStr),source,scenario,seed));
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b);return x[Math.floor(x.length/2)]};
const summary=Object.keys(sources).flatMap(alert=>scenarios.map(s=>{
  const rows=trials.filter(x=>x.alert===Number(alert)&&x.scenario===s.key),wins=rows.filter(x=>x.result==='win');
  return{alert:Number(alert),scenario:s.key,tested:rows.length,enemy:rows[0].enemy,wins:wins.length,
    medianWinLoss:median(wins.map(x=>672-x.after.army)),medianEndEnemyHp:median(rows.map(x=>x.after.enemyHp))};
}));
assert.equal(summary.find(x=>x.alert===5450&&x.scenario==='prior-group-mass').enemy.mass,510);
assert.equal(summary.find(x=>x.alert===6050&&x.scenario==='prior-group-mass').enemy.mass,663);
assert.ok(summary.filter(x=>x.scenario==='source-6-fixed').every(x=>x.enemy.mass===6));
const out='docs/codex/reports/data/p332-soul-queue-sensitivity.json';
fs.writeFileSync(path.join(root,out),JSON.stringify({batch:'P332',sourceReference:refFile,referenceSha256:sha(reference),
  sourceSaves:sources,unit:'one current-combat battle per scenario and seed; no purchases',summary,trials,
  limitations:['Source has six active queues at 120 or more monsters; its individual HP and multi-round battle are not identical to the local aggregate model.',
    'Seeds are conditional comparisons, not measured player win rates.']},null,2)+'\n');
console.log(JSON.stringify({summary,out},null,2));
