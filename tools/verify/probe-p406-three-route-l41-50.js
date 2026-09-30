'use strict';
// Continue each independent P405 L40 paid save through the next mainline chapter.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session,hashBytes,hash}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const dir='docs/codex/reports/data';
const route=process.argv[2];
assert.ok(['short-session','balanced','military'].includes(route),'pass a route name');
const input=`${dir}/p405-${route}-paid-handoff-save.json`;
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',
  'tools/verify/probe-p406-three-route-l41-50.js',input];
const sources=Object.fromEntries(files.map(file=>[file,hash(file)]));
assert.equal(hashBytes(raw+'\n'),sources[input]);
const s=session(raw);
assert.equal(s.run('S.defeated.length'),40,'L40 input required');
const initial={sha256:sources[input],stage:40,tick:s.run('S.tick'),pop:s.run('popCurrent()'),
  resources:s.state().res,formation:s.state().formation};
const army=[['front','iron_spearman',10],['front','bronze_guard',10],
  ['front','silver_heavy',10],['mid','iron_spearman',10],
  ['mid','bronze_guard',10],['back','archer_silverbow',10],
  ['back','archer_silverbow',10]];
const workers={
  silver:{stone:3,coal:3,silver:4,food:9},
  iron:{wood:2,stone:2,food:9,coal:2,iron:4},
  copper:{wood:2,stone:2,food:9,coal:2,copper:4}
};
const ledger=[];
let lastWon=40,lastWonRaw=raw,failure=null;
try{
  for(let stage=41;stage<=50;stage++){
    const inputSha256=hashBytes(s.raw());
    const onlineBefore=s.online(),chargesBefore=s.charges();
    const fills=[
      s.fill('silver_heavy',10,workers.silver),
      s.fill('iron_spearman',20,workers.iron),
      s.fill('bronze_guard',20,workers.copper),
      s.fill('archer_silverbow',20,workers.copper)
    ];
    s.form(army);
    const battle=s.battle(stage);
    const chargesAfter=s.charges(),paid={};
    for(const key of new Set([...Object.keys(chargesAfter),...Object.keys(chargesBefore)]))
      paid[key]=(chargesAfter[key]||0)-(chargesBefore[key]||0);
    ledger.push({stage,inputSha256,onlineSeconds:s.online()-onlineBefore,
      paidTraining:paid,fills,battle,saveSha256:hashBytes(s.raw())});
    if(!battle.won)break;
    lastWon=stage;
    lastWonRaw=s.raw();
  }
}catch(error){failure=String(error.stack||error)}
const lastWonPath=`${dir}/p406-${route}-l49-won-save.json`;
const finalPath=`${dir}/p406-${route}-l41-50-final-save.json`;
const summaryPath=`${dir}/p406-${route}-l41-50.json`;
fs.writeFileSync(path.join(root,lastWonPath),lastWonRaw+'\n');
fs.writeFileSync(path.join(root,finalPath),s.raw()+'\n');
const summary={batch:'P406',route,input,sources,method:'P405 paid L40 save; real worker allocation, production ticks, queued training cost, formation, mainline battle callbacks and independent v36 reload; fixed Math.random=0.5',
  units:'onlineSeconds counts explicit noncombat wait() tick seconds; totalTickSeconds additionally includes tick() calls during battle callbacks; battle.battleMs is configured callback milliseconds; menu operations instantaneous; continuation online even for short-session-origin input',
  initial,lastWon,lastWonPath,lastWonSha256:hash(lastWonPath),
  totalOnlineSeconds:s.online(),totalTickSeconds:s.run('S.tick')-initial.tick,
  totalTrainingPaid:s.charges(),ledger,
  finalPath,finalSha256:hash(finalPath),failure};
fs.writeFileSync(path.join(root,summaryPath),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(files.map(file=>[file,hash(file)])),sources,
  'input/source files changed during replay');
assert.equal(hashBytes(s.raw()+'\n'),summary.finalSha256,'final save mismatch');
if(failure){console.error(failure);process.exitCode=1}
else console.log(JSON.stringify({route,lastWon,totalOnlineSeconds:s.online(),
  stop:ledger.at(-1)?.battle?.won?'none':ledger.at(-1)?.stage,
  finalSha256:summary.finalSha256}));
