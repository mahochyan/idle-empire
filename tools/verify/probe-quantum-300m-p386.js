'use strict';
// P386: continue the exact P385 paid RNG stream, then pay the steam-knowledge
// corridor to the 300,000,000 knowledge-cap entrance. This is a developer probe.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'docs/codex/reports/data');
const sourcePath = path.join(__dirname, 'probe-crystal-sustainability-p385.js');
const sourceSavePath = path.join(dataDir, 'p385-after-ten-crystal-cycles-save.json');
const outputSavePath = path.join(dataDir, 'p386-300m-paid-save.json');
const outputLedgerPath = path.join(dataDir, 'p386-300m-paid-ledger.json');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const sourceRaw = fs.readFileSync(sourceSavePath, 'utf8');
const sourceSha = '9f181d49eea30aaad3d6ce0bd4d2e9f66cc9d38b17dac902a02de1fb6fb36e83';
assert.equal(sha(sourceRaw), sourceSha, 'P385 paid save changed');
const sourceScript = fs.readFileSync(sourcePath, 'utf8');

// Replay P385 without writing any of its prior checkpoints. The replay verifies
// the paid source save byte-for-byte and recovers its RNG state, which localStorage
// intentionally does not serialize. This VM then continues without a seed reset.
const readOnlyFs = Object.assign(Object.create(fs), {writeFileSync(file) {
  assert.ok(path.resolve(file).startsWith(dataDir + path.sep), 'unexpected P385 write');
}});
function scopedRequire(name) {
  return name === 'node:fs' ? readOnlyFs : require(name);
}
const continuation = String.raw`
const p386SourceRaw=world.store.get('rts_save');
assert.equal(sha(p386SourceRaw), '${sourceSha}', 'P385 replay mismatch');
const p386Initial=state();
const p386InitialRng=run('__rng');
const p386OnlineStart=onlineSeconds;
const p386TrainingStart=run('({...__trainingPaid})');
const p386Upgrades=[];
const p386Cycles=[];
let p386StopReason=null;

function p386Snapshot(){
  return {...state(),knowledgeCap:run("resCap('tech')"),
    steamKnowledge:run('S.eraStorage.steamKnowledge'),
    techRate:run("prodRate('tech')"),rng:run('__rng')};
}
function p386VerifyReload(){
  assert.equal(run('save().ok'),true,'P386 checkpoint save failed');
  const raw=world.store.get('rts_save');
  const other=boot(raw);
  const same=other.run("({level:S.eraStorage.steamKnowledge,cap:resCap('tech'),tech:S.res.tech,crystal:S.items.godCrystal,alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),blood:S.items.sacredBlood})");
  const live=run("({level:S.eraStorage.steamKnowledge,cap:resCap('tech'),tech:S.res.tech,crystal:S.items.godCrystal,alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),blood:S.items.sacredBlood})");
  assert.equal(JSON.stringify(same),JSON.stringify(live),'P386 checkpoint reload mismatch');
  return sha(raw);
}
function p386PayAffordable(){
  while(run('S.eraStorage.steamKnowledge')<30){
    const cost=run("eraStorageCost('steamKnowledge')");
    const before=p386Snapshot();
    if(before.crystal<(cost.godCrystal||0)||before.resources.tech<cost.tech)break;
    const paid=run("upgradeEraStorage('steamKnowledge')");
    assert.equal(paid?.ok,true,'steam knowledge upgrade rejected');
    const after=p386Snapshot();
    assert.equal(after.steamKnowledge,before.steamKnowledge+1);
    assert.equal(after.crystal,before.crystal-(cost.godCrystal||0));
    assert.ok(Math.abs(after.resources.tech-(before.resources.tech-cost.tech))<1e-6);
    assert.ok(after.knowledgeCap>before.knowledgeCap);
    const checkpointSha=p386VerifyReload();
    p386Upgrades.push({from:before.steamKnowledge,to:after.steamKnowledge,cost,
      before:{tech:before.resources.tech,crystal:before.crystal,cap:before.knowledgeCap},
      after:{tech:after.resources.tech,crystal:after.crystal,cap:after.knowledgeCap},
      saveSha256:checkpointSha,onlineSeconds:onlineSeconds-p386OnlineStart});
  }
}

p386PayAffordable();
while(run('S.eraStorage.steamKnowledge')<30&&p386Cycles.length<30){
  const before=p386Snapshot();
  if(before.blood<3||before.army!==672||before.deployed!==626||
     before.crystalAlert!==5000){
    p386StopReason='cycle precondition unavailable';break;
  }
  const exchanged=run('exchangeDomainCleanser(1)');
  if(!exchanged?.ok){p386StopReason='cleanser exchange: '+exchanged?.reason;break;}
  const cleansed=run("useDomainCleanser('godCrystal')");
  if(!cleansed?.ok){p386StopReason='cleanser use: '+cleansed?.reason;break;}
  assert.equal(state().crystalAlert,4900);
  const battle=fight('godCrystal');
  const entry={round:p386Cycles.length+11,before:{crystal:before.crystal,blood:before.blood,
    alert:before.crystalAlert,army:before.army,steamKnowledge:before.steamKnowledge},
    battle:{result:battle.result,loss:battle.loss,crystalGain:battle.crystalGain,
      bloodGain:battle.bloodGain,callbacks:battle.callbacks,
      alertAfter:battle.after.crystalAlert},onlineSecondsBefore:onlineSeconds-p386OnlineStart};
  if(battle.result!=='win'){
    p386Cycles.push(entry);p386StopReason='crystal battle lost';break;
  }
  assert.equal(battle.crystalGain,58);
  assert.equal(battle.bloodGain,3);
  const recovery=restoreRoster();
  entry.recovery={trained:recovery.trained,paid:recovery.actualPaid,
    onlineSeconds:onlineSeconds-p386OnlineStart-entry.onlineSecondsBefore,
    minFood:recovery.minFood,minCoal:recovery.minCoal,minSteel:recovery.minSteel};
  entry.after=p386Snapshot();
  entry.saveSha256=p386VerifyReload();
  p386Cycles.push(entry);
  p386PayAffordable();
}

const p386AfterResearch=p386Snapshot();
let p386Fill=null;
if(p386AfterResearch.knowledgeCap>=300000000){
  const start=p386Snapshot();
  assign('tech');
  const result=advanceUntil('S.res.tech>=300000000',30000);
  p386Fill={start:{tech:start.resources.tech,cap:start.knowledgeCap},
    seconds:result.n,done:result.done,stop:result.stopped,
    minFood:result.minFood,minCoal:result.minCoal,minSteel:result.minSteel,
    after:p386Snapshot()};
  if(!result.done)p386StopReason=p386StopReason||'tech production did not reach 300m';
}

const p386BeforeQuantum=p386Snapshot();
const p386QuantumAttempt=run("researchScience('sci_quantum_age')");
const p386AfterQuantum=p386Snapshot();
assert.equal(p386AfterQuantum.resources.tech,p386BeforeQuantum.resources.tech);
assert.equal(p386AfterQuantum.medal,p386BeforeQuantum.medal);
assert.equal(run("scienceUnlocked('sci_quantum_age')"),false);
assert.equal(run('save().ok'),true);
const p386FinalRaw=world.store.get('rts_save');
const p386FinalSaveSha=p386VerifyReload();
const p386TrainingEnd=run('({...__trainingPaid})');
const p386TrainingPaid=Object.fromEntries(Object.entries(p386TrainingEnd).map(([key,n])=>
  [key,n-(p386TrainingStart[key]||0)]));
globalThis.__p386Result={sourceReplaySha256:sha(p386SourceRaw),
  initial:p386Initial,initialRng:p386InitialRng,upgrades:p386Upgrades,
  cycles:p386Cycles,afterResearch:p386AfterResearch,fill:p386Fill,
  quantumAttempt:p386QuantumAttempt,quantumCost:run("({...activeSciences().sci_quantum_age.cost})"),
  afterQuantum:p386AfterQuantum,finalSaveRaw:p386FinalRaw,
  finalSaveSha256:p386FinalSaveSha,finalRng:run('__rng'),
  trainingPaid:p386TrainingPaid,onlineSeconds:onlineSeconds-p386OnlineStart,
  stopReason:p386StopReason,
  implementedStarArrayKeys:run("Object.keys(CFG).filter(k=>/starArray|astralArray/i.test(k))")};
`;
const context = {require: scopedRequire, __dirname, console: {log(){}, error: console.error}};
vm.runInNewContext(sourceScript + '\n' + continuation, context, {
  filename: sourcePath, timeout: 240000});
const result = context.__p386Result;
assert.ok(result, 'continuation did not return');
const finalRaw = result.finalSaveRaw;
delete result.finalSaveRaw;
const ledger = {
  batch: 'P386', source: {file: path.basename(sourceSavePath), sha256: sourceSha},
  replay: {script: path.basename(sourcePath), sha256: sha(sourceScript),
    paidSaveMatched: result.sourceReplaySha256 === sourceSha,
    firstSeed: 1, rngAtP385End: result.initialRng,
    rngAtP386End: result.finalRng,
    note: 'P385 replayed without writes to recover non-persistent RNG state; the same VM continued every P386 battle without reseeding or selecting wins.'},
  initial: result.initial, upgrades: result.upgrades, cycles: result.cycles,
  afterResearch: result.afterResearch, fill: result.fill,
  quantumAttempt: result.quantumAttempt, quantumCost: result.quantumCost,
  afterQuantum: result.afterQuantum, finalSave: {
    file: path.basename(outputSavePath), sha256: result.finalSaveSha256},
  trainingPaid: result.trainingPaid, onlineSeconds: result.onlineSeconds,
  stopReason: result.stopReason, implementedStarArrayKeys: result.implementedStarArrayKeys,
  sourceHashes: Object.fromEntries(['config.js', 'levels.js', 'math.js',
    'garrison.js', 'technology.js', 'tests/progression/harness.js',
    'tools/verify/probe-crystal-sustainability-p385.js',
    'tools/verify/probe-quantum-300m-p386.js'].map(file =>
    [file, sha(fs.readFileSync(path.join(root, file)))])),
  scope: 'Paid single-stream Node VM continuation. No player save, runtime code, UI or art is modified. This proves only the reached warehouse/stock and executed actions, not unimplemented star-array research, quantum graduation, average win rate, or new-game pacing.'
};
fs.writeFileSync(outputSavePath, finalRaw);
fs.writeFileSync(outputLedgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({sourceSha256: sourceSha,
  wins: ledger.cycles.filter(c => c.battle.result === 'win').length,
  losses: ledger.cycles.filter(c => c.battle.result === 'lose').length,
  upgrades: ledger.upgrades.map(u => ({to: u.to, cap: u.after.cap,
    paidCrystal: u.cost.godCrystal, paidTech: u.cost.tech})),
  fill: ledger.fill && {done: ledger.fill.done, seconds: ledger.fill.seconds,
    tech: ledger.fill.after.resources.tech, cap: ledger.fill.after.knowledgeCap},
  quantumAttempt: ledger.quantumAttempt,
  stopReason: ledger.stopReason, onlineSeconds: ledger.onlineSeconds,
  finalSaveSha256: ledger.finalSave.sha256}, null, 2));
