'use strict';
// Isolated first-clear replay for the four currently 11-soldier chapter bosses.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sourceFile=path.join(__dirname,'probe-stage-frontier.js');
const saveFile=path.join(root,'docs/codex/reports/data/p100-natural-campaign-entry-before-upgrades-save.json');
const formalOnly=process.argv.includes('--formal-only');
const outFile=path.join(root,'docs/codex/reports/data',formalOnly?'p394-boss-cliffs-after.json':'p394-boss-cliffs.json');
const source=fs.readFileSync(sourceFile,'utf8');
const originalSave=fs.readFileSync(saveFile,'utf8');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const candidates={50:12,60:13,70:14,80:15}; // Soldiers per one of 11 boss groups.
const anchor='  run(`selEnemy(${stage-1});openBattle()`);';
assert.equal(source.split(anchor).length,2,'P97 battle entry anchor changed');
const patchLine='  if([50,60,70,80].includes(stage))run(`(()=>{const e=CFG.enemies[${stage-1}];'+
  'const count='+JSON.stringify(candidates)+'[${stage}];'+
  'e.units=Object.fromEntries(Object.entries(e.units).map(([k,groups])=>[k,groups.map(()=>count)]));})()`);';
const amended=source.replace(anchor,patchLine+'\n'+anchor);
const seeds=Array.from({length:16},(_,i)=>i+1);
const runs=[];
function replay(seed,useCandidate){
  const oldArgs=process.argv,oldLog=console.log;
  let result;
  process.argv=['node',sourceFile,`--snapshot-in=${saveFile}`,'--max-stage=81',`--seed=${seed}`,'--alloy-front','--replenish'];
  console.log=value=>{result=JSON.parse(value)};
  try{new Function('require','console','__dirname',useCandidate?amended:source)(require,console,__dirname)}
  finally{process.argv=oldArgs;console.log=oldLog}
  assert.ok(result,'P97 replay produced no report');
  assert.equal(result.attempted,result.blockedAt??81);
  const checkpoints=result.rows.filter(row=>[49,50,51,59,60,61,69,70,71,79,80,81].includes(row.stage))
    .map(row=>({stage:row.stage,win:row.win,round:row.round,
      deployedBefore:row.deployedBefore,deployedAfter:row.deployedAfter,
      loss:row.deployedBefore-row.deployedAfter,armyAfter:row.armyAfter}));
  return{seed,mode:useCandidate?'candidate':'formal',wins:result.wins,blockedAt:result.blockedAt,
    onlineSeconds:result.finish-result.start,trainingSpend:result.trainingSpend,checkpoints};
}
for(const seed of seeds){runs.push(replay(seed,false));if(!formalOnly)runs.push(replay(seed,true))}
const summary={baseline:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  formalOnly,
  runtime:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js','ui.js']
    .map(file=>[file,sha256(fs.readFileSync(path.join(root,file),'utf8'))])),
  source:{file:path.relative(root,sourceFile),sha256:sha256(source)},
  input:{file:path.relative(root,saveFile),sha256:sha256(originalSave)},
  candidateSoldiersPerGroup:candidates,seeds,runs};
fs.writeFileSync(outFile,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(root,outFile),sourceSha256:summary.source.sha256,
  inputSha256:summary.input.sha256,
  rows:runs.map(run=>({seed:run.seed,mode:run.mode,wins:run.wins,blockedAt:run.blockedAt,
    bosses:run.checkpoints.filter(row=>[50,60,70,80].includes(row.stage))
      .map(row=>({stage:row.stage,win:row.win,loss:row.loss}))}))},null,2));
