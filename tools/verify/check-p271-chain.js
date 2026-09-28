'use strict';
// Verify that the P271 paid save and sensitivity reports still refer to one traceable chain.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const data='docs/codex/reports/data/';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
const hash=file=>crypto.createHash('sha256').update(read(file)).digest('hex');
const before=json(data+'p271-stage46-99-prenuclear.json');
const after=json(data+'p271-stage46-99-fulltech.json');
const paid=json(data+'p271-stage100-star-paid.json');
const terminal=json(data+'p271-stage100-terminal-sensitivity.json');
const growth=json(data+'p271-star-growth-sensitivity-paid.json');
const growthSingle=json(data+'p271-star-growth-sensitivity.json');
const growthTwo=json(data+'p271-star-growth-sensitivity-two-groups.json');
for(const campaign of [before,after]){
  assert.equal(hash(campaign.source),campaign.sourceSha256);
  assert.equal(campaign.trials.length,54);
  assert.equal(campaign.trials.every(x=>x.win&&(x.actualTroopLoss===0||x.replenishment?.cost)),true);
  assert.equal(campaign.trials[0].stage,46);
  assert.equal(campaign.trials.at(-1).stage,99);
  assert.equal(campaign.finalSaves.length,1);
  assert.equal(hash(campaign.finalSaves[0].saveFile),campaign.finalSaves[0].sha256);
}
const beforeFile=before.finalSaves[0].saveFile,afterFile=after.finalSaves[0].saveFile;
assert.equal(hash(paid.sourceFile),paid.sourceSha256);
assert.equal(paid.sourceFile,afterFile);
assert.equal(hash(paid.saveFile),paid.saveSha256);
assert.equal(paid.final.defeated,99);
assert.equal(paid.final.starDeployed,101);
assert.equal(paid.final.deployed,516);
assert.deepEqual(paid.totalCost,{copper:800000,iron:800000,steel:800000});
assert.equal(terminal.sources.prenuclear.file,beforeFile);
assert.equal(terminal.sources.prenuclear.sha256,hash(beforeFile));
assert.equal(terminal.sources.fulltech.file,afterFile);
assert.equal(terminal.sources.fulltech.sha256,hash(afterFile));
assert.equal(growth.sourceFile,afterFile);
assert.equal(growth.sourceSha256,hash(afterFile));
assert.equal(growth.paidStarFile,paid.saveFile);
assert.equal(growth.paidStarSha256,hash(paid.saveFile));
for(const conditional of [growthSingle,growthTwo]){
  assert.equal(conditional.sourceFile,afterFile);
  assert.equal(conditional.sourceSha256,hash(afterFile));
}
assert.equal(json(paid.saveFile).defeated.length,99);
console.log('P271 chain: paid saves and sensitivity sources verified');
