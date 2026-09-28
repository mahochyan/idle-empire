'use strict';
// Real P250 iron-point checkpoint: compare one offline hour with the point active or deliberately stopped.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const inputFile='docs/codex/reports/data/p250-iron-point-l15-save.json';
const raw=fs.readFileSync(path.join(root,inputFile),'utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function arm(active){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(!active)assert.equal(run('selectDevelopmentSite(null)')?.ok,true);
  const before=run("({tick:S.tick,food:S.res.food,iron:S.res.iron,ironCap:resCap('iron'),level:S.development.border.sites.iron.level,clock:S.development.border.collection.elapsedSec,active:S.development.border.collection.activeSite})");
  assert.equal(before.level,15);
  assert.equal(before.iron,272);
  assert.equal(before.ironCap,600);
  run('_loadedTs=Date.now()-3600000');
  const receipt=run('settleOffline()');
  assert.equal(receipt.ok,true);
  assert.equal(receipt.durationSec,3600);
  const after=run("({tick:S.tick,food:S.res.food,iron:S.res.iron,clock:S.development.border.collection.elapsedSec,active:S.development.border.collection.activeSite})");
  assert.equal(after.tick,before.tick+3600);
  assert.equal(run('settleOffline().repeat'),true);
  assert.equal(run('S.res.iron'),after.iron);
  const save=e.store.get('rts_save'),reload=environment({rts_save:save});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.iron'),after.iron);
  assert.equal(reload.run('S.development.border.collection.elapsedSec'),after.clock);
  return{before,receipt,after,save,saveSha256:hash(save)};
}
const active=arm(true),stopped=arm(false);
assert.equal(active.before.clock,17);
assert.equal(active.after.clock,17);
assert.equal(active.after.iron,600);
assert.equal(active.receipt.gains.iron,328);
assert.equal(stopped.before.clock,0);
assert.equal(stopped.after.iron,272);
assert.equal(stopped.receipt.gains.iron,undefined);
const saveFile='docs/codex/reports/data/p266-iron-point-offline-save.json';
fs.writeFileSync(path.join(root,saveFile),active.save,'utf8');
const report={batch:'P266',inputFile,inputSha256:hash(raw),unit:'simulated offline seconds; resource units',
  active:{before:active.before,receipt:active.receipt,after:active.after,saveFile,saveSha256:active.saveSha256},
  stopped:{before:stopped.before,receipt:stopped.receipt,after:stopped.after}};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p266-iron-point-offline.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({inputSha256:report.inputSha256,active:report.active,stopped:report.stopped}));
process.exit(0);
