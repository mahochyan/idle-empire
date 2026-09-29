'use strict';
// P395: earn the quantum medal fee on the same paid storage/material save.
// Production and rewards use the real offline settlement. Only the clock is controlled.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sourceFile='p394-quantum-material-paid-save.json';
const sourcePath=path.join(dataDir,sourceFile);
const sourceRaw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(sourceRaw),'8b140b350c72b47d03663ede93b04b00ee8435370d006d3e44101c4c04a4131c');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const source=JSON.parse(sourceRaw);
let nowMs=source.ts;
const NativeDate=Date;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[nowMs]));}
  static now(){return nowMs;}
};

const env=environment({rts_save:sourceRaw}),run=env.run;
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
  globalThis.Date=class extends __RealDate{
    constructor(...args){super(...(args.length?args:[__clockMs]))}
    static now(){return __clockMs}
  }`);
assert.equal(run('loadSaveAndApply().status'),'ok');
function state(r=run){return r(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,
  bone:S.res.bone,deed:S.res.deed,food:S.res.food,cap:resCap('tech'),
  scrollUsed:S.beastExchange.scrollUsed,
  storage:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
    nuclear:S.eraStorage.nuclearKnowledge},
  materials:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,
    revivalLeaf:S.items.revivalLeaf},army:armyCount(),deployed:formSoldierCount()})`)}
const start=state();
assert.equal(start.medal,1063758);
assert.equal(start.cap,348618782);
const target=run('({...activeSciences().sci_quantum_age.cost})');
assert.equal(target.tech,3000000000);
assert.equal(target.medal,3000000);
const rows=[];
const windowMs=8*60*60*1000;
for(let i=1;state().medal<target.medal&&i<=30;i++){
  const before=state();
  nowMs+=windowMs;
  run(`__clockMs+=${windowMs}`);
  const settled=run('settleOffline()');
  assert.equal(settled.ok,true,JSON.stringify(settled));
  assert.equal(settled.repeat,undefined,'offline settlement unexpectedly deduplicated');
  const after=state();
  assert.equal(settled.durationSec,windowMs/1000);
  assert.ok(after.medal>before.medal,'no medal increase');
  assert.equal(after.cap,before.cap,'offline altered knowledge cap');
  assert.equal(after.scrollUsed,before.scrollUsed,'offline altered scrolls');
  assert.deepEqual(after.storage,before.storage,'offline altered storage research');
  assert.deepEqual(after.materials,before.materials,'offline altered materials');
  assert.equal(after.army,before.army);
  assert.equal(after.deployed,before.deployed);
  assert.ok(after.food>0,'food exhausted');
  const raw=env.store.get('rts_save');
  const reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(JSON.stringify(state(reload.run)),JSON.stringify(after),'reload mismatch');
  rows.push({window:i,durationSec:settled.durationSec,before,after,
    gains:settled.gains,saveSha256:sha(raw),reloaded:true});
}
const final=state();
assert.ok(final.medal>=target.medal,'medal cost not reached');
assert.equal(final.cap,start.cap);
assert.equal(final.tech,final.cap,'knowledge did not fill cap during offline settlement');
const attempt=run("researchScience('sci_quantum_age')");
assert.equal(attempt.ok,false);
assert.equal(attempt.reason,'insufficient-tech');
assert.deepEqual(state(),final,'failed research modified state');
const combinedRaw=env.store.get('rts_save');
const combinedFile='p395-quantum-storage-medal-combined-paid-save.json';
fs.writeFileSync(path.join(dataDir,combinedFile),combinedRaw);
const standalone=environment({rts_save:combinedRaw});
assert.equal(standalone.run('loadSaveAndApply().status'),'ok');
assert.equal(JSON.stringify(state(standalone.run)),JSON.stringify(final));
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sha(sourceRaw),'source changed');
for(const f of runtimeFiles)
  assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),runtimeSha256[f],`${f} changed during run`);
const result={source:sourceFile,sourceSha256:sha(sourceRaw),runtimeSha256,
  method:'Real settleOffline() in 8-hour windows on one paid P394 save; simulated clock only.',
  start,target,windows:rows.length,elapsedOfflineSeconds:rows.length*windowMs/1000,
  rows,final,quantumAttempt:attempt,combinedFile,combinedSha256:sha(combinedRaw),
  reloaded:true};
fs.writeFileSync(path.join(dataDir,'p395-quantum-medal-combined.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:result.sourceSha256,windows:rows.length,
  elapsedOfflineSeconds:result.elapsedOfflineSeconds,start,final,target,attempt,
  combinedSha256:result.combinedSha256},null,2));
