'use strict';
// Restore the 165M knowledge spent in P338 using real scholar production, then verify a reloadable full-roster save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p338-soul-production-continuation-save.json';
const sourceText=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(sourceText),'902f7626a693b81ad93151e47a52674b9bc19c45592d414f00491fa55b38b29c');
const baselineFile=data+'p335-soul-alert7050-full-save.json';
const baselineText=fs.readFileSync(path.join(root,baselineFile),'utf8');
assert.equal(sha(baselineText),'fc8eaa036fa8a1943b9c267c855f3ab39daa95c0cfedde2e21dbf07d89b5eb99');
const targetTech=JSON.parse(baselineText).res.tech,origin=JSON.parse(sourceText);
const env=environment({rts_save:sourceText}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run('({tick:S.tick,tech:S.res.tech,food:S.res.food,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,rate:prodRate("tech"),cap:resCap("tech"),alloc:{...S.popAlloc}})');
assert.equal(initial.army,672);assert.equal(initial.deployed,626);
assert.equal(initial.stone,6);assert.equal(initial.alert,7650);
assert.equal(run('S.eraStorage.electricProduction'),5);
assert.equal(run('S.eraStorage.nuclearProduction'),5);
assert.ok(initial.tech<targetTech);assert.ok(initial.cap>=targetTech);
assert.equal(initial.alloc.food,100);assert.equal(initial.alloc.tech,902);
assert.ok(initial.rate>0);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  addLog=msg=>{S.log.push({time:'probe',msg:String(msg)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};`);
const advanced=run(`(()=>{let n=0,minFood=S.res.food;while(S.res.tech<${targetTech}&&n<30000){tick();n++;minFood=Math.min(minFood,S.res.food)}
  return{seconds:n,minFood,tech:S.res.tech,food:S.res.food,rate:prodRate('tech')}})()`);
assert.ok(advanced.seconds>0&&advanced.seconds<30000);
assert.ok(advanced.minFood>0);assert.ok(advanced.tech>=targetTech);
assert.equal(run('armyCount()'),672);assert.equal(run('formSoldierCount()'),626);
assert.equal(run('S.items.soulStone'),6);assert.equal(run('S.killValues.soulRealm'),7650);
assert.equal(run('S.soulRanks.star_trooper.stars'),1);
assert.equal(run('save().ok'),true);
const finalText=env.store.get('rts_save'),reload=environment({rts_save:finalText});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.res.tech'),advanced.tech);
assert.equal(reload.run('S.eraStorage.electricProduction'),5);
assert.equal(reload.run('S.eraStorage.nuclearProduction'),5);
assert.equal(reload.run('S.soulRanks.star_trooper.stars'),1);
assert.equal(reload.run('armyCount()'),672);assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(sourceText));
assert.equal(sha(fs.readFileSync(path.join(root,baselineFile),'utf8')),sha(baselineText));
const finalFile=data+'p338-soul-production-knowledge-restored-save.json';
fs.writeFileSync(path.join(root,finalFile),finalText,'utf8');
const report={batch:'P338',kind:'real scholar production restores initial knowledge after paid 5+5 production branch',
  sourceFile,sourceSha256:sha(sourceText),baselineFile,baselineSha256:sha(baselineText),targetTech,
  unit:'simulated online seconds and resources',initial,advanced,
  final:run('({tick:S.tick,tech:S.res.tech,food:S.res.food,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,levels:{electric:S.eraStorage.electricProduction,nuclear:S.eraStorage.nuclearProduction},stocks:{stone:S.res.stone,coal:S.res.coal,iron:S.res.iron,steel:S.res.steel,copper:S.res.copper}})'),
  finalFile,finalSha256:sha(finalText),limits:['Replenishes only the knowledge stock to the pre-research level; other resources are reported, not equalized.',
    'All seconds are simulated online tick; offline, active player time and other strategy choices are not tested.']};
const reportFile=data+'p338-soul-production-knowledge-restore.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({targetTech,initial,advanced,final:report.final,finalFile,finalSha256:report.finalSha256,reportFile},null,2));
