'use strict';
// P251: paid iron-point-to-army route across all 16 fixed battle streams.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const p248File='tools/verify/probe-border-iron-continuous-p248.js';
const p250File='tools/verify/probe-iron-point-to-army-p250.js';
const outputFile='docs/codex/reports/data/p251-iron-point-to-army-all.json';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const rows=[];
for(let flow=1;flow<=16;flow++){
  const output=execFileSync(process.execPath,[path.join(root,p250File),`--flow=${flow}`,'--no-write'],
    {cwd:root,encoding:'utf8',maxBuffer:1024*1024});
  const data=JSON.parse(output);
  assert.equal(data.flow,flow);
  assert.equal(data.final.ironSpearman,1);
  assert.equal(data.final.defeated,10);
  assert.equal(data.final.ironCap,800);
  assert.ok(data.point15.iron>=200);
  assert.ok(data.minFood>=0&&data.minFoodTraining>=0);
  rows.push({flow,point15:data.point15,storeSeconds:data.storeSeconds,
    knowledgeSeconds:data.knowledgeSeconds,minFood:data.minFood,
    forgeSeconds:data.forgeSeconds,trainingSeconds:data.trainingSeconds,
    minFoodTraining:data.minFoodTraining,final:data.final});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',sourceFile,p248File,p250File,
  'tools/verify/probe-iron-point-to-army-all-p251.js'];
const result={batch:'P251',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  unit:'game simulated online tick seconds, resources and soldiers',
  policy:{sourceSaveSha256:sha(fs.readFileSync(path.join(root,sourceFile),'utf8').trim()),
    flows:'1..16; each uses formal P249 iron point, fifteen wins, paid recovery and P250 player actions',
    output:'summary only; P250 flow 5 retains full step ledger and checkpoint save'},
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),rows};
const dest=path.join(root,outputFile);
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P251',flows:rows.length,trained:rows.filter(x=>x.final.ironSpearman===1).length,
  pointIronRange:[Math.min(...rows.map(x=>x.point15.iron)),Math.max(...rows.map(x=>x.point15.iron))],
  knowledgeSecondsRange:[Math.min(...rows.map(x=>x.knowledgeSeconds)),Math.max(...rows.map(x=>x.knowledgeSeconds))],
  minFood:Math.min(...rows.map(x=>x.minFood)),
  finalIronRange:[Math.min(...rows.map(x=>x.final.iron)),Math.max(...rows.map(x=>x.final.iron))],
  outputFile},null,2));
