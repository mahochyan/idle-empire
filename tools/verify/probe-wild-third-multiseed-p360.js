'use strict';
// P360: independent, fixed-seed real battle continuations of one paid P354 save.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const data = 'docs/codex/reports/data/';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const expectedCodeHashes = {
  'config.js':'8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675',
  'levels.js':'9ef3e47bae99242e70970fc9c0f86912301aabdb6ed4fef9e4e18250293c1cc1',
  'math.js':'dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95',
  'garrison.js':'762da86c67c0bfb1ef0c5a519a7fad57a8f8e4f7ad6c5045f4736c2b650739a9',
  'technology.js':'9cfda541f49011a676674fb2740b12af63812542a1ce872dcafc57eb4330bf98',
  'tests/progression/harness.js':'4770d17fa72cc8c87f4c8ef79678f19d63a41da895b8dd58776e5a39ce2ede2b'
};
const codeHashes = Object.fromEntries(Object.keys(expectedCodeHashes).map(file =>
  [file, sha(fs.readFileSync(path.join(root, file)))]));
assert.deepEqual(codeHashes, expectedCodeHashes, 'battle implementation or VM harness changed');

const sourceFile = data + 'p354-wood-5-coal-235-full-queue-4h-save.json';
const sourceText = fs.readFileSync(path.join(root, sourceFile), 'utf8');
const sourceSha256 = sha(sourceText);
assert.equal(sourceSha256, '8727dcc7934d728ca9c5f876c0b6fb8a3d0133bc31f34649564c6cdf258359cf');
const source = JSON.parse(sourceText);
assert.equal(source.v, 32);
const rosterFile = data + 'p329-soul-refreshed-save.json';
const rosterText = fs.readFileSync(path.join(root, rosterFile), 'utf8');
const rosterSha256 = sha(rosterText);
assert.equal(rosterSha256, '9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const target = JSON.parse(rosterText).formation;
assert.equal(Object.values(target).flat().reduce((n, u) => n + u.count, 0), 626);

const streamCount = Number(process.argv[2] || 64);
assert.ok(Number.isSafeInteger(streamCount) && streamCount >= 1 && streamCount <= 128);
// Hash-derived stream starts avoid adjacent xorshift32 seeds. These are a reproducible
// diagnostic grid, not a random sample of player battles or a win-rate estimate.
function streamSeed(index) {
  const digest = crypto.createHash('sha256').update(`P360|${sourceSha256}|${index}`).digest();
  return digest.readUInt32BE(0) || 1;
}
function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return {min:sorted[0], median:sorted[Math.floor((sorted.length-1)/2)],
    max:sorted.at(-1), mean:values.reduce((a,b) => a+b,0)/values.length};
}

function replay(index, overrideSeed = null) {
  const seed = overrideSeed ?? streamSeed(index);
  const env = environment({rts_save:sourceText}), run = env.run;
  run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
    globalThis.Date=class extends __RealDate {static now(){return __clockMs}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  `);
  assert.equal(run('loadSaveAndApply().status'), 'ok');
  assert.equal(run('armyCount()'), 672);
  assert.equal(run('formSoldierCount()'), 0);
  assert.equal(run('S.killValues.wildWyrm'), 3930);
  assert.equal(run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'), 0);
  for (const [row, groups] of Object.entries(target)) groups.forEach((item, slot) => {
    assert.ok(run(`poolAvail(${JSON.stringify(item.type)})`) >= item.count);
    run(`openFormModal(${JSON.stringify('expedition')},${JSON.stringify(row)},${slot});`+
      `S._formModalSel=${JSON.stringify(item.type)};S._formModalQty=${item.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`), item.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`), item.count);
  });
  assert.equal(run('formSoldierCount()'), 626);
  assert.equal(run('armyCount()'), 672);
  assert.equal(run('save().ok'), true);
  const formedSave = env.store.get('rts_save');
  if (index === 0) {
    const reloaded = environment({rts_save:formedSave});
    assert.equal(reloaded.run('loadSaveAndApply().status'), 'ok');
    assert.equal(reloaded.run('formSoldierCount()'), 626);
  }
  const before = run('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.wildWyrm,'+
    'bone:S.res.bone,hide:S.res.hide,medal:S.res.medal,items:{...S.items}})');
  run(`globalThis.__rng=${seed};globalThis.__rngDraws=0;
    Math.random=()=>{__rngDraws++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};
    openMaterialDomain('wyrmSinew')`);
  assert.equal(run('S.battleActive'), true);
  const enemy = run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks = 0;
  while (run('S.battleActive') && callbacks++ < 3000) assert.equal(run('__step()'), true);
  assert.ok(callbacks < 3000, 'battle callback limit');
  const result = run("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after = run('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.wildWyrm,'+
    'bone:S.res.bone,hide:S.res.hide,medal:S.res.medal,items:{...S.items}})');
  const enemyHpAfter = run('B.enemyUnits[0].hp');
  const casualties = before.deployed - after.deployed;
  assert.ok(casualties >= 0 && casualties <= 626);
  assert.equal(after.army, before.army - casualties);
  if (result === 'win') {
    assert.equal(after.alert, 3940);
    assert.ok(after.bone > before.bone && after.hide > before.hide);
    assert.ok(enemyHpAfter <= 0);
  } else {
    assert.equal(after.alert, before.alert);
    assert.equal(after.bone, before.bone);
    assert.equal(after.hide, before.hide);
    assert.equal(after.medal, before.medal);
    assert.equal(casualties, 626);
    assert.ok(enemyHpAfter > 0);
  }
  const itemDelta = Object.fromEntries(Object.keys(after.items)
    .filter(key => after.items[key] !== before.items[key])
    .map(key => [key, after.items[key] - before.items[key]]));
  run('exitBattle()');
  const battleSave = env.store.get('rts_save');
  const battleReload = environment({rts_save:battleSave});
  assert.equal(battleReload.run('loadSaveAndApply().status'), 'ok');
  assert.equal(battleReload.run('armyCount()'), after.army);
  assert.equal(battleReload.run('S.killValues.wildWyrm'), after.alert);
  assert.equal(battleReload.run('S.res.bone'), after.bone);
  assert.equal(battleReload.run('S.res.hide'), after.hide);
  return {index, seed, result, callbacks, rngDraws:run('__rngDraws'), enemy, enemyHpAfter,
    casualties, survivors:after.deployed, armyAfter:after.army,
    reward:{bone:after.bone-before.bone, hide:after.hide-before.hide,
      medal:after.medal-before.medal, items:itemDelta},
    alertBefore:before.alert,alertAfter:after.alert,
    formedSaveSha256:sha(formedSave),battleSaveSha256:sha(battleSave)};
}

const streams = [];
for (let i=0; i<streamCount; i++) streams.push(replay(i));
assert.equal(new Set(streams.map(s=>s.seed)).size, streamCount, 'stream seeds must be distinct');
assert.equal(new Set(streams.map(s=>s.formedSaveSha256)).size, 1, 'all battles must start from the same formed save');
const p358Reference = replay('P358-reference', 3551856150);
assert.equal(p358Reference.result, 'lose');
assert.equal(p358Reference.casualties, 626);
assert.equal(p358Reference.enemyHpAfter, 28);
assert.equal(p358Reference.formedSaveSha256, 'e1430dba26fbee6f3cc85483d128a29b5e5ebf28a46852e44ddf0717366c9a0d');
assert.equal(p358Reference.battleSaveSha256, '3a1f5eaf03e1593f60a392ced7048a777f1565dc0c7d52ba601414690a9e3bbe');
const wins = streams.filter(s => s.result === 'win');
const losses = streams.filter(s => s.result === 'lose');
assert.equal(wins.length + losses.length, streamCount);
const report = {
  batch:'P360', date:'2026-09-29', unit:'soldiers, resources, callback steps',
  codeHashes,sourceFile,sourceSha256,rosterFile,rosterSha256,
  method:{streamCount,seedDerivation:'uint32be(first 4 bytes of SHA-256 UTF-8 "P360|<sourceSha256>|<zero-based index>"); zero becomes one',
    rng:'per-VM xorshift32, seeded immediately before openMaterialDomain; fixed Date.now=source.ts',
    battle:"real formation actions, openMaterialDomain('wyrmSinew'), queued battle callbacks, real endBattle/save and independent reload"},
  initial:{army:672,deployed:626,alert:3930,bone:source.res.bone,hide:source.res.hide,medal:source.res.medal},
  summary:{wins:wins.length,losses:losses.length,
    casualtiesAll:stats(streams.map(s=>s.casualties)),
    casualtiesWins:stats(wins.map(s=>s.casualties)),casualtiesLosses:stats(losses.map(s=>s.casualties)),
    callbacks:stats(streams.map(s=>s.callbacks)),rngDraws:stats(streams.map(s=>s.rngDraws)),
    enemyHpAfterWins:stats(wins.map(s=>s.enemyHpAfter)),
    enemyHpAfterLosses:stats(losses.map(s=>s.enemyHpAfter)),
    boneRewardWins:stats(wins.map(s=>s.reward.bone)),
    hideRewardWins:stats(wins.map(s=>s.reward.hide)),
    medalRewardWins:stats(wins.map(s=>s.reward.medal)),
    bonusItemRewardWins:Object.fromEntries([...new Set(wins.flatMap(s=>Object.keys(s.reward.items)))].sort()
      .map(key=>[key,{streams:wins.filter(s=>s.reward.items[key]>0).length,
        total:wins.reduce((n,s)=>n+(s.reward.items[key]||0),0)}])),
    alertDeltaValues:[...new Set(streams.map(s=>s.alertAfter-s.alertBefore))].sort((a,b)=>a-b)},
  streams,p358Reference,
  limits:['Fixed diagnostic streams are not a player win-rate estimate.',
    'One already-paid late-game save and one target formation; no alternative strategy, previous windows or production in this probe.',
    'VM DOM, storage and timers are substitutes; this is not browser or Android validation.']
};
const reportFile = data + 'p360-wild-third-multiseed.json';
fs.writeFileSync(path.join(root, reportFile), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reportFile,streamCount,summary:report.summary,
  firstWin:wins[0]&&{index:wins[0].index,seed:wins[0].seed,casualties:wins[0].casualties},
  firstLoss:losses[0]&&{index:losses[0].index,seed:losses[0].seed,casualties:losses[0].casualties}},null,2));
