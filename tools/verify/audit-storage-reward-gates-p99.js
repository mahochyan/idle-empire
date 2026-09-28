'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { environment } = require('../../tests/progression/harness');

const root = process.cwd();
const replayPath = path.join(root, 'docs/codex/reports/data/p97-natural-stage-frontier-1-100.json');
const savePath = path.join(root, 'docs/codex/reports/data/p97-natural-stage-frontier-final-save.json');
const probePath = path.join(root, 'tools/verify/probe-stage-frontier.js');
const codePaths = ['config.js', 'levels.js', 'math.js'];
const outputPath = path.join(root, 'docs/codex/reports/data/p99-storage-reward-gates.json');
const keys = ['warehouse', 'stone_store', 'large_granary'];
const resourceKeys = ['wood', 'stone', 'food'];
const replayBytes = fs.readFileSync(replayPath);
const saveBytes = fs.readFileSync(savePath);
const probeBytes = fs.readFileSync(probePath);
const replay = JSON.parse(replayBytes.toString('utf8'));
const save = JSON.parse(saveBytes.toString('utf8'));
const probeText = probeBytes.toString('utf8');
assert.equal(replay.source, 'full-natural-new-game');
assert.equal(replay.rows.length, 100);
assert.equal(replay.refills.length, 100);
assert.equal(replay.wins, 100);
assert.equal(probeText.includes('researchScience('), false, 'P97 campaign probe must not research during the replay');
assert.equal(probeText.includes('buildAct('), false, 'P97 campaign probe must not issue storage/build actions during the replay');

const env = environment({ rts_save: saveBytes.toString('utf8') });
assert.equal(env.run('loadSaveAndApply().status'), 'ok');
assert.equal(env.run('S.defeated.length'), 100);
assert.equal(env.run('S.storageMode'), 'aligned');
assert.equal(env.run('S.storageMasteryLv'), 100);
assert.equal(env.run('S.eraStorage.steamBasic'), 0);

const entryRefill = replay.refills[0];
assert.equal(entryRefill.forStage, 1);
const stageEntryStock = { ...entryRefill.after };
const capacitiesBefore = Object.fromEntries(resourceKeys.map(key => [key, env.run("resCap('" + key + "')")]));
const scienceAtDerivedEntry = [...env.run('S.sciences')];
const finalBuildings = JSON.parse(JSON.stringify(env.run('S.buildings')));
const startStage = 1;

// Reconstruct stage-one post-recruit stocks and the campaign route's saved science/storage
// state. No exact stage-entry save exists, so this is an explicitly hybrid audit fixture.
// All calls below still go through the real lock, price, payment, save, and tick functions.
env.run(`S.res.wood=${stageEntryStock.wood};S.res.stone=${stageEntryStock.stone};S.res.food=${stageEntryStock.food};S.tick=${stageEntryStock.second};S.defeated=[]`);
for (const key of resourceKeys) {
  assert.ok(stageEntryStock[key] <= capacitiesBefore[key], key + ' stage-entry stock exceeds current capacity');
}

const gates = {};
for (const key of keys) {
  const cfg = JSON.parse(JSON.stringify(env.run(`CFG.buildings['${key}']`)));
  const needId = cfg.needScience;
  const science = needId ? JSON.parse(JSON.stringify(env.run(`activeSciences()['${needId}']`))) : null;
  assert.ok(cfg.storagePerLv || cfg.storageFor, key + ' must be a storage building');
  assert.equal(env.run(`buildingScienceUnlocked('${key}')`), true, key + ' research gate should be open in the P97 entry-derived fixture');
  assert.equal(env.run(`upgradeLockReason('${key}')`), '', key + ' should have no upgrade-level lock');
  gates[key] = {
    name: cfg.name,
    scienceId: needId,
    scienceName: science?.name || null,
    scienceCost: science?.cost || null,
    sciencePrerequisites: science?.need || [],
    scienceOwned: !needId || scienceAtDerivedEntry.includes(needId),
    entryLevel: finalBuildings[key]?.lv || 0
  };
  assert.equal(gates[key].scienceOwned, true, key + ' research not owned in P97 final save');
}

const startResources = Object.fromEntries(resourceKeys.map(key => [key, env.run(`S.res.${key}`)]));
const upgrades = [];
for (const key of keys) {
  const price = JSON.parse(JSON.stringify(env.run(`upCost('${key}')`)));
  const beforeResources = Object.fromEntries(resourceKeys.map(resource => [resource, env.run(`S.res.${resource}`)]));
  const beforeCaps = Object.fromEntries(resourceKeys.map(resource => [resource, env.run("resCap('" + resource + "')")]));
  const result = env.run(`buildAct('${key}')`);
  assert.equal(result?.ok, true, key + ' real buildAct upgrade failed: ' + JSON.stringify(result));
  const afterResources = Object.fromEntries(resourceKeys.map(resource => [resource, env.run(`S.res.${resource}`)]));
  for (const resource of resourceKeys) {
    const expected = beforeResources[resource] - (price[resource] || 0);
    assert.ok(Math.abs(afterResources[resource] - expected) < 1e-6,
      key + ' ' + resource + ' payment mismatch: expected ' + expected + ', observed ' + afterResources[resource]);
  }
  const building = JSON.parse(JSON.stringify(env.run(`S.buildings['${key}']`)));
  assert.equal(building.state, 'upgrading', key + ' should enter upgrading state');
  upgrades.push({
    key,
    name: gates[key].name,
    levelBefore: building.lv,
    levelAfter: building.lv + 1,
    cost: price,
    startTimer: building.timer,
    resourcesBefore: beforeResources,
    resourcesAfterPayment: afterResources,
    capacityBefore: beforeCaps
  });
}

const resourcesAfterCombinedPayment = Object.fromEntries(resourceKeys.map(key => [key, env.run(`S.res.${key}`)]));
const costsTotal = Object.fromEntries(resourceKeys.map(resource => [resource,
  upgrades.reduce((sum, upgrade) => sum + (upgrade.cost[resource] || 0), 0)
]));
for (const resource of resourceKeys) {
  assert.ok(costsTotal[resource] <= startResources[resource], resource + ' combined upgrade cost exceeds entry stock');
  assert.ok(Math.abs(resourcesAfterCombinedPayment[resource] - (startResources[resource] - costsTotal[resource])) < 1e-6,
    resource + ' combined payment total mismatch');
}

const states = () => JSON.parse(JSON.stringify(env.run(`Object.fromEntries(${JSON.stringify(keys)}.map(key=>[key,S.buildings[key].state]))`)));
let ticks = 0;
while (keys.some(key => states()[key] !== 'idle') && ticks < 1000) {
  env.run('tick()');
  ticks++;
}
assert.ok(keys.every(key => states()[key] === 'idle'), 'combined storage upgrades did not complete within 1000 ticks');
const capacitiesAfter = Object.fromEntries(resourceKeys.map(key => [key, env.run("resCap('" + key + "')")]));
const capacityDelta = Object.fromEntries(resourceKeys.map(key => [key, capacitiesAfter[key] - capacitiesBefore[key]]));
const expectedDelta = { wood: 19800, stone: 13200, food: 22000 };
assert.deepEqual(capacityDelta, expectedDelta);
for (const upgrade of upgrades) {
  const building = JSON.parse(JSON.stringify(env.run(`S.buildings['${upgrade.key}']`)));
  assert.equal(building.lv, upgrade.levelAfter, upgrade.key + ' level did not complete');
  upgrade.finishLevel = building.lv;
  upgrade.stateAfterCompletion = building.state;
}

const hashes = Object.fromEntries([...codePaths, 'tools/verify/probe-stage-frontier.js'].map(relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  return [relative, crypto.createHash('sha256').update(bytes).digest('hex')];
}));
const result = {
  evidenceScope: 'P97 first-stage post-recruit stock combined with storage/science levels from its terminal save; isolated hybrid fixture, not a full entry snapshot or representative player route.',
  unit: 'resource units, building levels, and game online ticks',
  source: {
    replay: path.relative(root, replayPath).replaceAll(path.sep, '/'),
    replaySha256: crypto.createHash('sha256').update(replayBytes).digest('hex'),
    finalSaveSha256: crypto.createHash('sha256').update(saveBytes).digest('hex'),
    codeSha256: hashes,
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  },
  fixture: {
    route: replay.source,
    seed: replay.seed,
    stage: startStage,
    defeatedStagesResetTo: 0,
    storageAndScienceStateSource: 'P97 final save; probe has no researchScience() or buildAct() calls, but no exact stage-entry save was captured',
    storageMode: 'aligned',
    storageMasteryLevel: 100,
    stageEntryStock,
    capacitiesBefore,
    scienceAtDerivedEntry,
    gates
  },
  combinedUpgrade: {
    action: 'start the next level of warehouse, stone_store, and large_granary through real buildAct(), then advance real tick() until all complete',
    costsTotal,
    resourcesAfterCombinedPayment,
    upgrades,
    completionTicks: ticks,
    capacitiesAfter,
    capacityDelta,
    expectedCapacityDelta: expectedDelta
  }
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: path.relative(root, outputPath).replaceAll(path.sep, '/'),
  fixtureScope: result.evidenceScope,
  stageEntryStock,
  capacitiesBefore,
  costsTotal,
  resourcesAfterCombinedPayment,
  completionTicks: ticks,
  capacitiesAfter,
  capacityDelta,
  gates
}, null, 2));
