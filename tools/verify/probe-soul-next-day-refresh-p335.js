'use strict';
// Continue the exhausted 7050 paid roster to the next local day and inspect the actual refreshed tier pool.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p335-soul-daily-cliff-save.json',raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),'f4640ec5a83409cd45bbfe1529c2ac3e36720a38259e063bb8b46c64fa3510b9');
const previous=JSON.parse(fs.readFileSync(path.join(root,data+'p335-soul-daily-cliff.json'),'utf8'));
assert.equal(previous.finalSha256,sha(raw));assert.equal(previous.final.rng,4261733588);
const origin=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__rng=${previous.final.rng};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  addLog=m=>S.log.push(String(m));`);
const before=run('({day:soulRealmDay(),teamDay:S.soulRealmTeam.day,slots:[...S.soulRealmTeam.slots],stone:S.items.soulStone,alert:S.killValues.soulRealm,army:armyCount(),rng:__rng,food:S.res.food})');
assert.equal(before.day,before.teamDay);assert.equal(before.alert,7050);assert.equal(before.stone,79);assert.equal(before.army,672);
assert.equal(run('refreshSoulRealmTeam().reason'),'refresh-locked');
const wait=run(`(()=>{let n=0,min=S.res.food;while(soulRealmDay()<=S.soulRealmTeam.day&&n<86401){tick();n++;min=Math.min(min,S.res.food)}
  return{seconds:n,minFood:min,day:soulRealmDay(),tick:S.tick}})()`);
assert.ok(wait.seconds>0&&wait.seconds<=86401);assert.equal(wait.day,before.day+1);assert.ok(wait.minFood>0);
const result=run('refreshSoulRealmTeam()');assert.equal(result.ok,true);
const refresh={ok:result.ok,slots:[...result.slots]};
assert.equal(refresh.slots.length,9);assert.ok(refresh.slots.every(id=>id===540499||id===540599||id===540699));
const after=run('({day:soulRealmDay(),teamDay:S.soulRealmTeam.day,slots:[...S.soulRealmTeam.slots],stone:S.items.soulStone,alert:S.killValues.soulRealm,army:armyCount(),rng:__rng,food:S.res.food})');
assert.equal(after.stone,79);assert.equal(after.alert,7050);assert.equal(after.army,672);
const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('JSON.stringify(S.soulRealmTeam.slots)'),JSON.stringify(after.slots));
assert.equal(reload.run('S.items.soulStone'),79);
const saveFile=data+'p335-soul-next-day-refresh-save.json';fs.writeFileSync(path.join(root,saveFile),saved,'utf8');
const report={batch:'P335',kind:'actual online next-day refresh from the exhausted 7050 paid save',sourceFile,sourceSha256:sha(raw),
  rngStart:previous.final.rng,before,wait,refresh,after,saveFile,saveSha256:sha(saved),
  limits:['Uses the harness local calendar; Android/WebView timezone behavior is not covered.',
    'Refreshing replaces the old uncompleted elite slots because their current fights were repeatedly lost; this is an explicit path choice.']};
const reportFile=data+'p335-soul-next-day-refresh.json';fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
console.log(JSON.stringify(report,null,2));
