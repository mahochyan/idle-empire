'use strict';
// Reuse the real paid P271 stage-46 campaign probe, but capture its stage-89
// checkpoint in memory instead of overwriting any historical P271 artifact.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const script=path.join(__dirname,'probe-stage99-fulltech-p271.js');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const originalWrite=fs.writeFileSync;
const originalArgs=process.argv;
const originalLog=console.log;
const sources=[
  {label:'prenuclear',input:'p269-crystal-full-roster-last-recovered-save.json'},
  {label:'fulltech',input:'p270-nuclear-research-paid-save.json'}
];
const entries=[];
for(const source of sources){
  let capturedSave=null,capturedReport=null;
  fs.writeFileSync=(file,data)=>{
    const name=path.basename(String(file));
    if(name===`p271-stage99-${source.label}-seed1-save.json`){capturedSave=String(data);return}
    if(name===`p271-stage46-99-${source.label}.json`){capturedReport=String(data);return}
    throw Error('unexpected P271 output '+file);
  };
  console.log=()=>{};
  process.argv=['node',script,`--input=${path.join(dataDir,source.input)}`,
    `--label=${source.label}`,'--stage=46','--through-stage=89','--seeds=1'];
  try{delete require.cache[require.resolve(script)];require(script)}
  finally{fs.writeFileSync=originalWrite;process.argv=originalArgs;console.log=originalLog}
  assert.ok(capturedSave&&capturedReport,source.label+' output');
  const save=JSON.parse(capturedSave),report=JSON.parse(capturedReport);
  assert.equal(Math.max(...save.defeated),89);
  assert.equal(report.trials.length,44);
  assert.equal(report.trials.filter(x=>x.win).length,44);
  assert.equal(report.trials.filter(x=>x.replenishmentBlocked).length,0);
  const output=`p-stage90-entry-mid-${source.label}-paid-save.json`;
  originalWrite(path.join(dataDir,output),capturedSave);
  entries.push({source:source.input,sourceSha256:hash(fs.readFileSync(path.join(dataDir,source.input))),
    output,outputSha256:hash(capturedSave),stage89:report.trials.at(-1),
    onlineSeconds:save.tick-JSON.parse(fs.readFileSync(path.join(dataDir,source.input))).tick,
    army:Object.values(save.formation).flat().reduce((a,u)=>a+u.count,0),
    totalArmy:Object.values(save.pool||{}).reduce((a,n)=>a+n,0)+Object.values(save.formation).flat().reduce((a,u)=>a+u.count,0)});
}
const out={kind:'paid sequential first clears 46-89, no candidate battle yet',
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  scriptSha256:hash(fs.readFileSync(script)),entries};
originalWrite(path.join(dataDir,'p-stage90-entry-mid-build-agent.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({entries:entries.map(({stage89,...meta})=>({...meta,
  stage89:{win:stage89.win,loss:stage89.actualTroopLoss,
    replacement:stage89.replenishment?.paidCost,seconds:stage89.replenishment?.seconds}}))},null,2));
