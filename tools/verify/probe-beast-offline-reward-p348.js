'use strict';
// Replay the same paid Lv31 save through real offline settlement in isolated VMs.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir='docs/codex/reports/data';
const sourceFile=`${dataDir}/p342-hide-paid-seed1-save.json`;
const sourceReportFile=`${dataDir}/p342-hide-paid-seed1.json`;
const reportFile=`${dataDir}/p348-beast-offline-reward.json`;
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const sourceText=read(sourceFile);
const sourceSha256=sha(sourceText);
assert.equal(sourceSha256,'ca734f8b6dfa88dc22a0ec7a7367800fb4422a27b55c594444e08b27fc6806e8');
const source=JSON.parse(sourceText);
const sourceReport=JSON.parse(read(sourceReportFile));
assert.equal(sourceReport.saveSha256,sourceSha256);
assert.equal(sourceReport.final.rng,1696915948);
const codeFiles=['config.js','math.js','tests/progression/harness.js'];
const codeSha256=Object.fromEntries(codeFiles.map(file=>[file,sha(read(file))]));
const motherFiles=['210(1)_unpacked/_analysis/deob_main.js','210(1)_unpacked/_analysis/entities_table.json'];
const motherSha256=Object.fromEntries(motherFiles.map(file=>[file,sha(read(file))]));
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();

// Mother source: getExchangeReward @1419143. With a 1002-person capacity,
// Lv31 is tier 1 and has a 1.05 multiplier. These fixed values are independent
// expectations; the probe never calls the project's reward helper directly.
const scenarios=[
  {seconds:899,expected:{bone:0,medal:0,deed:0}},
  {seconds:900,expected:{bone:1890,medal:472,deed:283}},
  {seconds:3600,expected:{bone:7560,medal:1890,deed:1134}},
  {seconds:14400,expected:{bone:30240,medal:7560,deed:4536}},
  {seconds:28800,expected:{bone:60480,medal:15120,deed:9072}}
];
const keys=['bone','medal','deed'];
const entries=[];

for(const {seconds,expected} of scenarios){
  const env=environment({rts_save:sourceText}),run=env.run;
  // Source time is fixed per branch, so every window has an exact wall-clock delta.
  run(`globalThis.__probeNow=${source.ts};const __NativeDate=Date;
    Date=class extends __NativeDate{static now(){return __probeNow}};
    globalThis.__rng=${sourceReport.final.rng};
    Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    globalThis.__offerRolls=0;const __originalRoll=rollBeastHeartOffers;
    rollBeastHeartOffers=function(){__offerRolls++;return __originalRoll()};`);
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const before=JSON.parse(run(`JSON.stringify({
    tick:S.tick,level:S.beastExchange.level,progress:S.beastExchange.progress,
    clock:S.beastExchange.refreshClock,charges:S.beastExchange.refreshCharges,
    population:S.population.current,populationCapacity:maxPop(),
    bone:S.res.bone,medal:S.res.medal,deed:S.res.deed,hide:S.res.hide,
    boneCap:resCap('bone'),medalCap:resCap('medal'),deedCap:resCap('deed')})`));
  const itemsBefore=run('JSON.stringify(S.items)');
  assert.equal(before.level,31);
  assert.equal(before.progress,1);
  assert.equal(before.populationCapacity,1002);
  assert.deepEqual([before.bone,before.medal,before.deed],[705,944,0]);
  for(const key of keys)assert.ok(before[key]+expected[key]<=before[`${key}Cap`],`${key} cap would mask reward`);

  run(`__probeNow+=${seconds}*1000`);
  const settled=run('settleOffline()');
  assert.equal(settled.ok,true);
  assert.equal(settled.durationSec,seconds);
  assert.equal(settled.truncated,false);
  const after=JSON.parse(run(`JSON.stringify({
    tick:S.tick,level:S.beastExchange.level,progress:S.beastExchange.progress,
    clock:S.beastExchange.refreshClock,charges:S.beastExchange.refreshCharges,
    bone:S.res.bone,medal:S.res.medal,deed:S.res.deed,hide:S.res.hide,
    boneCap:resCap('bone'),medalCap:resCap('medal'),deedCap:resCap('deed'),
    offerRolls:__offerRolls,rng:__rng})`));
  const actual=Object.fromEntries(keys.map(key=>[key,after[key]-before[key]]));
  assert.deepEqual(actual,expected);
  assert.equal(after.tick-before.tick,seconds);
  assert.equal(after.level,before.level);
  assert.equal(after.progress,before.progress,'offline must not purchase or grant trade experience');
  assert.equal(after.hide,before.hide,'offline must not spend beast hide');
  assert.equal(run('JSON.stringify(S.items)'),itemsBefore,'offline must not spend trade materials');
  for(const key of keys)assert.equal(after[`${key}Cap`],before[`${key}Cap`]);

  const pending=JSON.parse(run('JSON.stringify(S.offline.pendingReport)'));
  assert.equal(pending.durationSec,seconds);
  assert.equal(pending.rawSec,seconds);
  assert.equal(pending.advance.elapsed,seconds);
  for(const key of keys)assert.equal(pending.gains[key]||0,expected[key],`${key} pending-report gain`);
  for(const key of keys)assert.equal(settled.gains[key]||0,expected[key],`${key} returned gain`);

  const saved=env.store.get('rts_save');
  assert.ok(saved&&saved!==sourceText);
  const savedObject=JSON.parse(saved);
  assert.equal(savedObject.v,32);
  assert.equal(savedObject.ts,source.ts+seconds*1000);
  for(const key of keys)assert.equal(savedObject.res[key],after[key],`${key} persisted`);
  assert.equal(savedObject.beastExchange.progress,before.progress);
  const repeat=run('settleOffline()');
  assert.equal(repeat.repeat,true,'the same window must be idempotent');
  assert.equal(env.store.get('rts_save'),saved);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  for(const key of keys)assert.equal(reload.run(`S.res.${key}`),after[key],`${key} reloaded`);
  assert.equal(reload.run('S.beastExchange.progress'),before.progress);
  assert.equal(reload.run('S.offline.pendingReport.durationSec'),seconds);

  entries.push({requestedSec:seconds,actualSec:settled.durationSec,
    sourceTsMs:source.ts,settledTsMs:savedObject.ts,before,expectedGain:expected,actualGain:actual,
    returnedGains:JSON.parse(JSON.stringify(settled.gains)),pendingReportGains:pending.gains,
    after,saveSha256:sha(saved),reloadStatus:'ok',repeatSettlement:true,noAutoTrade:true});
}

assert.equal(sha(read(sourceFile)),sourceSha256);
for(const file of codeFiles)assert.equal(sha(read(file)),codeSha256[file],`${file} changed while replaying`);
const report={batch:'P348',kind:'same paid Lv31 save, independent real offline settlement windows',
  unit:'seconds, milliseconds, resources',head,sourceFile,sourceSha256,
  sourceReportFile,rngStart:sourceReport.final.rng,codeSha256,motherSha256,
  motherRule:'getExchangeReward @1419143: >=900 seconds and tier=min(30,floor((level-15)/10))>0; floor(rate*seconds*tier*(1+0.05*floor(maxPopulation/1000))) for bone 2, medal 0.5, deed 0.3; each capped by storage.',
  localRule:'Current settlement awards for actual accepted offline seconds; no automatic trade or trade experience.',
  scenarios:entries,
  limits:['P342 is a selected, historically paid late-game save, not a fresh-player or representative population sample.',
    'Each duration starts from a separate isolated reload of the same unchanged v32 source save.',
    'The harness uses a VM with simulated localStorage and clock; it is not a real browser or Android timing test.',
    'This probe checks the passive award itself, not the subsequent paid trades, troop recovery, level-60 reachability, or the 100-stage campaign.']};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({reportFile,sourceSha256,codeSha256,
  scenarios:entries.map(x=>({seconds:x.actualSec,gain:x.actualGain,offerRolls:x.after.offerRolls,
    charges:x.after.charges,progress:x.after.progress,saveSha256:x.saveSha256}))},null,2));
