'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { environment } = require('../../tests/progression/harness');

const root = process.cwd();
const files = {
  p97: 'docs/codex/reports/data/p97-natural-stage-frontier-1-100.json',
  p98: 'docs/codex/reports/data/p98-campaign-reward-storage-ledger.json',
  p100: 'docs/codex/reports/data/p100-storage-expanded-campaign-1-100.json',
  p100Result: 'docs/codex/reports/data/p100-storage-reward-frontier.json',
  p100FinalSave: 'docs/codex/reports/data/p100-storage-expanded-campaign-final-save.json',
  config: 'config.js',
  levels: 'levels.js',
  math: 'math.js'
};
const read = key => fs.readFileSync(path.join(root, files[key]));
const p97Bytes = read('p97');
const p98Bytes = read('p98');
const p100Bytes = read('p100');
const p100ResultBytes = read('p100Result');
const finalSaveBytes = read('p100FinalSave');
const p97 = JSON.parse(p97Bytes.toString('utf8'));
const p98 = JSON.parse(p98Bytes.toString('utf8'));
const p100 = JSON.parse(p100Bytes.toString('utf8'));
const p100Result = JSON.parse(p100ResultBytes.toString('utf8'));
assert.equal(p97.rows.length, 100);
assert.equal(p100.rows.length, 100);
assert.equal(p100.seed, 9);
assert.equal(p100.attempted, 100);
assert.equal(p100.wins, 100);
assert.equal(p100Result.campaign.attempted, 100);
assert.equal(p100Result.campaign.wins, 100);

const beforeSave = JSON.parse(fs.readFileSync(path.join(root, p100Result.entry.preUpgradeSave), 'utf8'));
const afterSave = JSON.parse(fs.readFileSync(path.join(root, p100Result.storagePlan.upgradedEntrySave), 'utf8'));
assert.equal(beforeSave.tick, p97.refills[0].before.second);
assert.deepEqual(beforeSave.defeated, []);
for (const resource of ['wood', 'stone', 'food', 'steel']) {
  assert.ok(Math.abs(beforeSave.res[resource] - p97.refills[0].before[resource]) < 1e-6,
    'P100 checkpoint must match exact P97 stage-entry ' + resource);
}
for (const key of ['warehouse', 'stone_store', 'large_granary']) {
  assert.equal(beforeSave.buildings[key].state, 'idle', key + ' must be idle before expansion');
  assert.equal(afterSave.buildings[key].state, 'idle', key + ' expansion should be complete before the first battle');
  assert.equal(afterSave.buildings[key].lv, beforeSave.buildings[key].lv + 1, key + ' should gain one level');
}

const finalEnv = environment({ rts_save: finalSaveBytes.toString('utf8') });
assert.equal(finalEnv.run('loadSaveAndApply().status'), 'ok');
assert.equal(finalEnv.run('S.defeated.length'), 100);
const capacities = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, finalEnv.run(`resCap('${key}')`)]));
assert.deepEqual(capacities, { wood: 508200, stone: 338800, food: 231000 });

const combatFields = ['win', 'round', 'callbacks', 'armyBefore', 'armyAfter', 'deployedBefore', 'deployedAfter', 'meritGain'];
const combatDifferenceCounts = Object.fromEntries(combatFields.map(field => [field, 0]));
for (let index = 0; index < 100; index++) {
  for (const field of combatFields) {
    if (p97.rows[index][field] !== p100.rows[index][field]) combatDifferenceCounts[field]++;
  }
}
assert.ok(Object.values(combatDifferenceCounts).every(count => count === 0),
  'expanded storage changed the fixed-seed combat path');
assert.equal(p100.battleLosses, p97.battleLosses);
assert.deepEqual(p100.recruitTotals, p97.recruitTotals);
assert.deepEqual(p100.trainingSpend, p97.trainingSpend);

const resourceKeys = ['wood', 'stone', 'food'];
const totals = Object.fromEntries(resourceKeys.map(key => [key, {
  configured: 0,
  credited: 0,
  clipped: 0,
  clippedStages: 0,
  zeroCreditedStages: 0
}]));
const chapters = Array.from({ length: 10 }, (_, index) => ({
  chapter: index + 1,
  fromStage: index * 10 + 1,
  throughStage: index * 10 + 10,
  resources: Object.fromEntries(resourceKeys.map(key => [key, { configured: 0, credited: 0, clipped: 0 }]))
}));
let verifiedPairs = 0;
for (let index = 0; index < p100.rows.length; index++) {
  const row = p100.rows[index];
  const stock = p100.refills[index].after;
  const chapter = chapters[Math.floor(index / 10)];
  for (const key of resourceKeys) {
    const configured = finalEnv.run(`CFG.enemies[${index}].reward.${key}||0`);
    const credited = row.reward[key] || 0;
    const cap = capacities[key];
    const expected = Math.min(configured, Math.max(0, cap - stock[key]));
    assert.ok(Math.abs(expected - credited) < 1e-6,
      'stage ' + (index + 1) + ' ' + key + ': expected ' + expected + ', saw ' + credited);
    const clipped = Math.max(0, configured - credited);
    totals[key].configured += configured;
    totals[key].credited += credited;
    totals[key].clipped += clipped;
    if (clipped > 1e-6) {
      totals[key].clippedStages++;
      if (credited < 1e-6) totals[key].zeroCreditedStages++;
    }
    chapter.resources[key].configured += configured;
    chapter.resources[key].credited += credited;
    chapter.resources[key].clipped += clipped;
    verifiedPairs++;
  }
}
assert.equal(verifiedPairs, 300);

const changesVsP98 = Object.fromEntries(resourceKeys.map(key => {
  const oldTotals = p98.totals[key];
  const current = totals[key];
  assert.ok(Math.abs(oldTotals.configured - current.configured) < 1e-6, key + ' configured reward total changed');
  const recovered = current.credited - oldTotals.credited;
  const clippingReduction = oldTotals.clipped - current.clipped;
  assert.ok(Math.abs(recovered - clippingReduction) < 1e-6, key + ' reward gain and clipping reduction should match');
  return [key, {
    creditedBefore: oldTotals.credited,
    creditedAfter: current.credited,
    additionalCredited: recovered,
    clippedBefore: oldTotals.clipped,
    clippedAfter: current.clipped,
    clippingReduction: clippingReduction,
    stagesClippedBefore: oldTotals.clippedStages,
    stagesClippedAfter: current.clippedStages,
    zeroCreditedStagesBefore: oldTotals.zeroCreditedStages,
    zeroCreditedStagesAfter: current.zeroCreditedStages
  }];
}));

const chapterChanges = chapters.map((chapter, index) => ({
  chapter: chapter.chapter,
  resources: Object.fromEntries(resourceKeys.map(key => [key, {
    creditedBefore: p98.chapters[index].resources[key].credited,
    creditedAfter: chapter.resources[key].credited,
    additionalCredited: chapter.resources[key].credited - p98.chapters[index].resources[key].credited,
    clippedAfter: chapter.resources[key].clipped
  }]))
}));
const hashKeys = ['p97', 'p98', 'p100', 'p100Result', 'p100FinalSave', 'config', 'levels', 'math'];
const hashes = Object.fromEntries(hashKeys.map(key => [
  files[key], crypto.createHash('sha256').update(read(key)).digest('hex')
]));
const result = {
  unit: 'resource units, completed stages, compared combat fields',
  source: {
    hashes,
    p100RouteStart: p100Result.entry.routeStartSecond,
    p100BattleStart: p100.start,
    p100BattleFinish: p100.finish,
    p100ConstructionTicks: p100Result.storagePlan.constructionTicks,
    storageCapacities: capacities,
    verifiedPairs
  },
  combatComparison: {
    baseline: 'P97 natural new-game route, seed 9, no pre-campaign storage upgrades',
    treatment: 'same economic route and battle seed, all three storage upgrades completed before stage 1',
    winsBefore: p97.wins,
    winsAfter: p100.wins,
    lossesBefore: p97.battleLosses,
    lossesAfter: p100.battleLosses,
    recruitTotalsBefore: p97.recruitTotals,
    recruitTotalsAfter: p100.recruitTotals,
    trainingSpendBefore: p97.trainingSpend,
    trainingSpendAfter: p100.trainingSpend,
    comparedFields: combatDifferenceCounts
  },
  rewardTotals: totals,
  changesVsP98: changesVsP98,
  chapterChanges
};
const outputPath = path.join(root, 'docs/codex/reports/data/p100-storage-reward-comparison.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: path.relative(root, outputPath).replaceAll(path.sep, '/'),
  verifiedPairs,
  capacities,
  combatDifferenceCounts,
  rewardTotals: totals,
  changesVsP98,
  chapterChanges
}, null, 2));
