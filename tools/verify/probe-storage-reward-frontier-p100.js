'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const requiredFlags = ['--steel-mastery-early', '--steel-mastery-20', '--steel-mastery-hunt-10', '--iron-store=300'];
for (const flag of requiredFlags) assert.ok(process.argv.includes(flag), '须带' + flag + '保持P97同一新档路线');
const replayPath = path.join(root, 'docs/codex/reports/data/p97-natural-stage-frontier-1-100.json');
const replayBytes = fs.readFileSync(replayPath);
const replay = JSON.parse(replayBytes.toString('utf8'));
const economicProbePath = path.join(root, 'tools/verify/probe-scholar-mastery-full.js');
const campaignProbePath = path.join(root, 'tools/verify/probe-stage-frontier.js');
const preludeBytes = fs.readFileSync(economicProbePath);
const campaignProbeBytes = fs.readFileSync(campaignProbePath);
const { run } = new Function('require', 'console', '__dirname',
  preludeBytes.toString('utf8') + '\nreturn {run};')(
  require,
  { log() {}, error: console.error },
  path.dirname(economicProbePath)
);

assert.equal(run('S.population.current'), 102);
assert.equal(run('S.defeated.length'), 0);
assert.equal(run('S.scholarMasteryLv'), 20);
assert.equal(run('S.tick'), replay.refills[0].before.second, 'economic route should reproduce exact P97 first-stage entry second');
const entryResources = Object.fromEntries(['wood', 'stone', 'food', 'steel'].map(key => [key, run(`S.res.${key}`)]));
for (const key of ['wood', 'stone', 'food', 'steel']) {
  assert.ok(Math.abs(entryResources[key] - replay.refills[0].before[key]) < 1e-6,
    key + ' exact new-game entry stock should match P97 before refill actions');
}

const startState = {
  tick: run('S.tick'),
  resources: { ...entryResources },
  capacities: Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, run(`resCap('${key}')`)])),
  storageMasteryLevel: run('S.storageMasteryLv'),
  storageMode: run('S.storageMode'),
  sciences: [...run('S.sciences')],
  buildings: JSON.parse(JSON.stringify(run('S.buildings')))
};
assert.equal(startState.storageMode, 'aligned');
assert.equal(startState.storageMasteryLevel, 100);

const buildingKeys = ['warehouse', 'stone_store', 'large_granary'];
const costs = [];
for (const key of buildingKeys) {
  assert.equal(run(`buildingScienceUnlocked('${key}')`), true, key + ' storage research must be open at the exact pre-battle checkpoint');
  assert.equal(run(`upgradeLockReason('${key}')`), '', key + ' must have no upgrade-level lock at the exact pre-battle checkpoint');
  const cfg = JSON.parse(JSON.stringify(run(`CFG.buildings['${key}']`)));
  const science = JSON.parse(JSON.stringify(run(`activeSciences()['${cfg.needScience}']`)));
  assert.ok(startState.sciences.includes(cfg.needScience), key + ' research must be present in the real new-game checkpoint');
  costs.push({
    key,
    name: cfg.name,
    science: { id: cfg.needScience, name: science.name, cost: science.cost, prerequisites: science.need || [] },
    levelBefore: run(`S.buildings['${key}'].lv`),
    cost: JSON.parse(JSON.stringify(run(`upCost('${key}')`)))
  });
}

const preUpgradeSaveText = run("localStorage.getItem('rts_save')");
assert.ok(preUpgradeSaveText, 'exact pre-battle route save should exist in the isolated harness');
const preUpgradeSavePath = path.join(root, 'docs/codex/reports/data/p100-natural-campaign-entry-before-upgrades-save.json');
fs.writeFileSync(preUpgradeSavePath, preUpgradeSaveText, 'utf8');

for (const upgrade of costs) {
  const before = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, run(`S.res.${key}`)]));
  assert.equal(run(`buildAct('${upgrade.key}').ok`), true, upgrade.key + ' real build action must start at the pre-battle checkpoint');
  const after = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, run(`S.res.${key}`)]));
  for (const resource of ['wood', 'stone', 'food']) {
    const expected = before[resource] - (upgrade.cost[resource] || 0);
    assert.ok(Math.abs(after[resource] - expected) < 1e-6,
      upgrade.key + ' ' + resource + ' real payment mismatch');
  }
  upgrade.resourcesBefore = before;
  upgrade.resourcesAfterPayment = after;
  upgrade.levelAfterStart = run(`S.buildings['${upgrade.key}'].lv`);
  upgrade.buildingTimer = run(`S.buildings['${upgrade.key}'].timer`);
}

const totalCost = Object.fromEntries(['wood', 'stone', 'food'].map(resource => [resource,
  costs.reduce((sum, upgrade) => sum + (upgrade.cost[resource] || 0), 0)
]));
const resourcesAfterPayment = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, run(`S.res.${key}`)]));
for (const resource of ['wood', 'stone', 'food']) {
  assert.ok(totalCost[resource] <= entryResources[resource], resource + ' combined costs must be covered at the exact checkpoint');
  assert.ok(Math.abs(resourcesAfterPayment[resource] - (entryResources[resource] - totalCost[resource])) < 1e-6,
    resource + ' combined exact-checkpoint payment mismatch');
}

let constructionTicks = 0;
while (buildingKeys.some(key => run(`S.buildings['${key}'].state`) !== 'idle') && constructionTicks < 1000) {
  run('tick()');
  constructionTicks++;
}
assert.ok(buildingKeys.every(key => run(`S.buildings['${key}'].state`) === 'idle'), 'storage buildings did not finish within 1000 real ticks');
const upgradedCapacities = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, run(`resCap('${key}')`)]));
const capacityIncrease = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, upgradedCapacities[key] - startState.capacities[key]]));
assert.deepEqual(capacityIncrease, { wood: 19800, stone: 13200, food: 22000 });
for (const upgrade of costs) upgrade.levelAfterFinish = run(`S.buildings['${upgrade.key}'].lv`);
assert.equal(run('S.defeated.length'), 0, 'no campaign stage should be cleared before storage expansion');
const upgradedEntrySaveText = run("localStorage.getItem('rts_save')");
const upgradedEntrySavePath = path.join(root, 'docs/codex/reports/data/p100-natural-campaign-entry-after-upgrades-save.json');
fs.writeFileSync(upgradedEntrySavePath, upgradedEntrySaveText, 'utf8');

const campaignPath = path.join(root, 'docs/codex/reports/data/p100-storage-expanded-campaign-1-100.json');
const finalSavePath = path.join(root, 'docs/codex/reports/data/p100-storage-expanded-campaign-final-save.json');
const campaignStdout = execFileSync(process.execPath, [
  campaignProbePath,
  `--snapshot-in=${upgradedEntrySavePath}`,
  `--snapshot-final=${finalSavePath}`,
  '--max-stage=100', '--seed=9', '--alloy-front', '--replenish'
], { cwd: root, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
const campaign = JSON.parse(campaignStdout);
fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
assert.equal(campaign.attempted, 100);
assert.equal(campaign.wins, 100);
assert.equal(campaign.refills.length, 100);

const finalSaveBytes = fs.readFileSync(finalSavePath);
const finalEnv = require('../../tests/progression/harness').environment({ rts_save: finalSaveBytes.toString('utf8') });
assert.equal(finalEnv.run('loadSaveAndApply().status'), 'ok');
assert.equal(finalEnv.run('S.defeated.length'), 100);
const rewardTotals = Object.fromEntries(['wood', 'stone', 'food'].map(key => [key, {
  configured: 0,
  credited: 0,
  clipped: 0,
  clippedStages: 0,
  zeroCreditedStages: 0
}]));
const rewardRows = [];
for (let index = 0; index < campaign.rows.length; index++) {
  const row = campaign.rows[index];
  const refill = campaign.refills[index];
  const rewards = {};
  for (const key of ['wood', 'stone', 'food']) {
    const configured = finalEnv.run(`CFG.enemies[${index}].reward.${key}||0`);
    const credited = row.reward[key] || 0;
    const stockBefore = refill.after[key];
    const cap = finalEnv.run(`resCap('${key}')`);
    const expected = Math.min(configured, Math.max(0, cap - stockBefore));
    assert.ok(Math.abs(credited - expected) < 1e-6,
      'stage ' + (index + 1) + ' ' + key + ' reward/cap mismatch: expected ' + expected + ', saw ' + credited);
    const clipped = Math.max(0, configured - credited);
    const total = rewardTotals[key];
    total.configured += configured;
    total.credited += credited;
    total.clipped += clipped;
    if (clipped > 1e-6) {
      total.clippedStages++;
      if (credited < 1e-6) total.zeroCreditedStages++;
    }
    rewards[key] = { configured, stockBefore, capacity: cap, credited, clipped };
  }
  rewardRows.push({ stage: index + 1, resources: rewards });
}

const hashFiles = [economicProbePath, campaignProbePath, 'config.js', 'levels.js', 'math.js'];
const sourceHashes = Object.fromEntries(hashFiles.map(file => {
  const bytes = typeof file === 'string' && path.isAbsolute(file) ? fs.readFileSync(file) : fs.readFileSync(path.join(root, file));
  return [path.relative(root, file).replaceAll(path.sep, '/'), crypto.createHash('sha256').update(bytes).digest('hex')];
}));
sourceHashes['p97Replay'] = crypto.createHash('sha256').update(replayBytes).digest('hex');
const allResult = {
  unit: 'online seconds, resource units, completed stages',
  source: {
    route: 'full-natural-new-game; P97 economic prelude reproduced, three storage upgrades paid before stage 1, then same seed-9 1–100 campaign probe',
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    hashes: sourceHashes
  },
  entry: {
    routeStartSecond: startState.tick,
    population: run('S.population.current'),
    capacity: run('maxPop()'),
    defeatedStages: 0,
    resources: entryResources,
    capacities: startState.capacities,
    storageMode: startState.storageMode,
    storageMasteryLevel: startState.storageMasteryLevel,
    researchAndLevels: costs.map(item => ({ key: item.key, name: item.name, science: item.science, levelBefore: item.levelBefore })),
    preUpgradeSave: path.relative(root, preUpgradeSavePath).replaceAll(path.sep, '/'),
    preUpgradeSaveSha256: crypto.createHash('sha256').update(preUpgradeSaveText).digest('hex')
  },
  storagePlan: {
    upgrades: costs,
    combinedCost: totalCost,
    resourcesAfterPayment,
    constructionTicks,
    capacitiesAfter: upgradedCapacities,
    capacityIncrease,
    upgradedEntrySave: path.relative(root, upgradedEntrySavePath).replaceAll(path.sep, '/'),
    upgradedEntrySaveSha256: crypto.createHash('sha256').update(upgradedEntrySaveText).digest('hex')
  },
  campaign: {
    source: path.relative(root, campaignPath).replaceAll(path.sep, '/'),
    finalSave: path.relative(root, finalSavePath).replaceAll(path.sep, '/'),
    start: campaign.start,
    finish: campaign.finish,
    population: campaign.population,
    attempted: campaign.attempted,
    wins: campaign.wins,
    battleLosses: campaign.battleLosses,
    recruitTotals: campaign.recruitTotals,
    trainingSpend: campaign.trainingSpend,
    finalResources: campaign.finalResources,
    finalSaveSha256: crypto.createHash('sha256').update(finalSaveBytes).digest('hex'),
    rewardTotals,
    rewardRows
  }
};
const resultPath = path.join(root, 'docs/codex/reports/data/p100-storage-reward-frontier.json');
fs.writeFileSync(resultPath, JSON.stringify(allResult, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: path.relative(root, resultPath).replaceAll(path.sep, '/'),
  entry: allResult.entry,
  storagePlan: allResult.storagePlan,
  campaign: {
    source: allResult.campaign.source,
    start: allResult.campaign.start,
    finish: allResult.campaign.finish,
    attempted: allResult.campaign.attempted,
    wins: allResult.campaign.wins,
    battleLosses: allResult.campaign.battleLosses,
    recruitTotals: allResult.campaign.recruitTotals,
    trainingSpend: allResult.campaign.trainingSpend,
    finalResources: allResult.campaign.finalResources,
    rewardTotals: allResult.campaign.rewardTotals
  }
}, null, 2));
