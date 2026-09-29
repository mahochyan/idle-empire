'use strict';
// In-memory candidate patch of the existing paid low-army P97 route.
// No game file or historical P97 probe is edited.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const input=path.join(dataDir,'p100-natural-campaign-entry-before-upgrades-save.json');
const original=path.join(__dirname,'probe-stage-frontier.js');
const through99=process.argv.includes('--through99');
const candidate=through99?
  {90:165,91:180,92:210,93:250,94:300,95:360,96:450,97:600,98:800,99:1100}:
  {90:165,91:180};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=fs.readFileSync(original,'utf8');
const anchor='  run(`selEnemy(${stage-1});openBattle()`);';
assert.equal(source.split(anchor).length,2,'P97 source anchor changed');
const injected=[
  `  if(stage>=90&&stage<=${through99?99:91})run(\`(()=>{const e=CFG.enemies[\${stage-1}];`,
  `    const before=Object.values(e.units).flat().reduce((a,b)=>a+b,0),ratio=\${${JSON.stringify(candidate)}[stage]}/before;`,
  '    e.units=Object.fromEntries(Object.entries(e.units).map(([k,groups])=>',
  '      [k,groups.map(n=>Math.max(1,Math.round(n*ratio)))]));})()`);',
  anchor
].join('\n');
const amended=source.replace(anchor,injected);
const suffix=through99?'through99':'through91';
const saveFile=path.join(dataDir,`p-stage90-low-continuation-agent-${suffix}-save.json`);
const outputFile=path.join(dataDir,`p-stage90-low-continuation-agent-${suffix}.json`);
const oldArgs=process.argv,oldLog=console.log;
let rawReport=null;
process.argv=['node',original,`--snapshot-in=${input}`,`--max-stage=${through99?99:91}`,'--seed=9',
  '--alloy-front','--replenish',`--snapshot-final=${saveFile}`];
console.log=x=>{rawReport=String(x)};
try{new Function('require','console','__dirname',amended)(require,console,__dirname)}
finally{process.argv=oldArgs;console.log=oldLog}
assert.ok(rawReport,'P97 candidate report');
const probe=JSON.parse(rawReport);
const saveRaw=fs.readFileSync(saveFile,'utf8'),save=JSON.parse(saveRaw);
const report={kind:`paid natural low-army 1-${through99?99:91} route, late-stage candidate only in isolated source string`,
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  input:{file:path.basename(input),sha256:hash(fs.readFileSync(input,'utf8'))},
  sourceSha256:hash(source),amendedSha256:hash(amended),
  candidate,attempted:probe.attempted,wins:probe.wins,
  blockedAt:probe.blockedAt,rows:probe.rows.filter(x=>x.stage>=88),
  refills:probe.refills.filter(x=>x.forStage>=88),
  snapshot:{file:path.basename(saveFile),sha256:hash(saveRaw),lastStage:Math.max(0,...save.defeated),
    tick:save.tick,army:Object.values(save.formation).flat().reduce((a,u)=>a+u.count,0)+
      Object.values(save.pool||{}).reduce((a,n)=>a+n,0)}};
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
assert.equal(hash(fs.readFileSync(input,'utf8')),report.input.sha256);
console.log(JSON.stringify({outputFile,attempted:report.attempted,wins:report.wins,
  blockedAt:report.blockedAt,rows:report.rows.map(x=>({stage:x.stage,win:x.win,
    loss:x.deployedBefore-x.deployedAfter,armyAfter:x.armyAfter})),
  refills:report.refills.map(x=>({stage:x.forStage,alloy:x.alloy,archer:x.archer,
    seconds:x.after.second-x.before.second}))},null,2));
