'use strict';
// P405: continue from the independently reloadable, paid L80 capacity victory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p405-l80-capacity-final-save.json';
const outDir='docs/codex/reports/data';
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const hashBytes=s=>crypto.createHash('sha256').update(s).digest('hex');
const hash=f=>hashBytes(fs.readFileSync(path.join(root,f)));
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
let routeRaw=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(JSON.parse(routeRaw).defeated.length,80);
const checkpointStages=new Set([90,99,100]);
const checkpoints={},rows=[];
const fullArmy=[['front','gold_cavalry',15],['front','gold_cavalry',14],
  ['front','silver_heavy',15],['front','silver_heavy',15],
  ['mid','silver_heavy',10],['mid','iron_spearman',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',15],
  ['back','archer_silverbow',15],['back','archer_silverbow',15],
  ['back','archer_silverbow',15],['back','archer_silverbow',9]];
const workerPlans={
  archer_silverbow:{food:13,wood:4,stone:2},
  bronze_guard:{food:11,coal:4,copper:2,stone:2},
  iron_spearman:{food:11,coal:2,iron:2,stone:2,wood:2},
  silver_heavy:{food:14,coal:1,silver:1,stone:1,wood:2},
  gold_cavalry:{food:14,coal:1,gold:1,stone:1,wood:2}
};
function saveCheckpoint(stage,raw){
  if(!checkpointStages.has(stage))return;
  const name=`${outDir}/p405-mainline-l${stage}-save.json`;
  fs.writeFileSync(path.join(root,name),raw+'\n');
  checkpoints[stage]={path:name,sha256:hash(name)};
}
function fullRefill(candidate){
  const fills=[];
  for(const [type,target]of [['archer_silverbow',54],['bronze_guard',20],
    ['iron_spearman',20],['silver_heavy',40],['gold_cavalry',29]])
    fills.push(candidate.fill(type,target,workerPlans[type]));
  candidate.form(fullArmy);
  assert.equal(candidate.run('formSoldierCount()'),158);
  return fills;
}
let routeStage=80,totalOnline=0,totalBattleMs=0,failure=null,blocked=null;
try{
  for(let stage=81;stage<=100;stage++){
    const gate=session(routeRaw).run(`campaignStageLockReason(${stage-1})`);
    if(gate){blocked={stage,gate,inputSha256:hashBytes(routeRaw)};rows.push({stage,mode:'gate',...blocked});break}
    let advanced=false;
    for(const mode of ['survivors','full-refill']){
      const candidate=session(routeRaw),fills=mode==='full-refill'?fullRefill(candidate):[];
      const battle=candidate.battle(stage);
      const row={stage,mode,inputSha256:hashBytes(routeRaw),online:candidate.online(),
        paid:candidate.charges(),fills,...battle};
      rows.push(row);
      console.log(JSON.stringify({stage,mode,won:battle.won,round:battle.round,
        armyBefore:battle.armyBefore,armyAfter:battle.armyAfter,online:row.online}));
      if(battle.won){
        routeRaw=candidate.raw();routeStage=stage;
        totalOnline+=row.online;totalBattleMs+=battle.battleMs;
        saveCheckpoint(stage,routeRaw);
        advanced=true;break;
      }
      if(battle.blocked){blocked={stage,gate:battle.lock,inputSha256:hashBytes(routeRaw)};break}
    }
    if(!advanced)break;
  }
}catch(error){failure=String(error.stack||error);console.error(failure)}
const finalPath=`${outDir}/p405-mainline-l81-onward-final-save.json`;
fs.writeFileSync(path.join(root,finalPath),routeRaw+'\n');
const ledgerPath=`${outDir}/p405-mainline-l81-onward-ledger.jsonl`;
fs.writeFileSync(path.join(root,ledgerPath),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
const paid={},wins=rows.filter(x=>x.won);
for(const row of wins)for(const [rk,n]of Object.entries(row.paid||{}))paid[rk]=(paid[rk]||0)+n;
const summary={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'Every candidate independently loaded from prior winning v36 save; actual stage selection, paid queued training, modal formation, battle callbacks, settlement, save and independent reload; one Math.random=0.5 flow',
  units:'totalOnline is simulated noncombat tick seconds; totalBattleMs is callback milliseconds with additional tick advancement; menu actions instant in harness',
  routeStage,totalOnline,totalBattleMs,paid,wins:wins.length,attempts:rows.length,
  blocked,stop:rows.at(-1),checkpoints,finalPath,finalSha256:hash(finalPath),ledgerPath,failure};
fs.writeFileSync(path.join(root,`${outDir}/p405-mainline-l81-onward.json`),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash,'source/input changed during replay');
if(failure)process.exitCode=1;
