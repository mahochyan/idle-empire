'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { environment } = require('../../tests/progression/harness');

const root = process.cwd();
const sourcePath = path.join(root, 'docs/codex/reports/data/p97-natural-stage-frontier-1-100.json');
const savePath = path.join(root, 'docs/codex/reports/data/p97-natural-stage-frontier-final-save.json');
const configPath = path.join(root, 'config.js');
const levelsPath = path.join(root, 'levels.js');
const mathPath = path.join(root, 'math.js');
const outputArg = process.argv.find(arg => arg.startsWith('--out='));
const outputPath = outputArg
  ? path.resolve(root, outputArg.slice('--out='.length))
  : path.join(root, 'docs/codex/reports/data/p98-campaign-reward-storage-ledger.json');

const sourceBytes = fs.readFileSync(sourcePath);
const saveBytes = fs.readFileSync(savePath);
const configBytes = fs.readFileSync(configPath);
const levelsBytes = fs.readFileSync(levelsPath);
const mathBytes = fs.readFileSync(mathPath);
const replay = JSON.parse(sourceBytes.toString('utf8'));
const save = JSON.parse(saveBytes.toString('utf8'));
assert.equal(replay.source, 'full-natural-new-game');
assert.equal(replay.seed, 9);
assert.equal(replay.rows.length, 100);
assert.equal(replay.refills.length, 100);
assert.equal(replay.wins, 100);

const env = environment({ rts_save: JSON.stringify(save) });
assert.equal(env.run('loadSaveAndApply().status'), 'ok');
assert.equal(env.run('S.defeated.length'), 100);

const resourceKeys = ['wood', 'stone', 'food'];
const capacities = Object.fromEntries(resourceKeys.map(key => [
  key,
  env.run("resCap('" + key + "')")
]));
for (const key of resourceKeys) {
  assert.equal(replay.finalResources[key], capacities[key], key + ' final inventory should be at capacity');
}

const totals = Object.fromEntries(resourceKeys.map(key => [key, {
  configured: 0,
  credited: 0,
  clipped: 0,
  clippedStages: 0,
  zeroCreditedStages: 0
}]));
const chapters = [];
const stages = [];
let verifiedPairs = 0;

for (let index = 0; index < replay.rows.length; index++) {
  const battle = replay.rows[index];
  const chapterIndex = Math.floor(index / 10);
  if (!chapters[chapterIndex]) {
    const firstStage = chapterIndex * 10 + 1;
    chapters[chapterIndex] = {
      chapter: chapterIndex + 1,
      fromStage: firstStage,
      throughStage: firstStage + 9,
      resources: Object.fromEntries(resourceKeys.map(key => [key, {
        configured: 0,
        credited: 0,
        clipped: 0,
        clippedStages: 0,
        zeroCreditedStages: 0
      }]))
    };
  }

  const stageRecord = { stage: index + 1, resources: {} };
  for (const key of resourceKeys) {
    const configured = env.run('CFG.enemies[' + index + '].reward.' + key + '||0');
    const stockBeforeBattle = replay.refills[index].after[key];
    const credited = battle.reward[key] || 0;
    const clipped = configured - credited;
    const expected = Math.min(configured, Math.max(0, capacities[key] - stockBeforeBattle));
    assert.ok(
      Math.abs(expected - credited) < 1e-6,
      'stage ' + (index + 1) + ' ' + key + ': expected ' + expected + ', observed ' + credited
    );
    assert.ok(stockBeforeBattle + credited <= capacities[key] + 1e-6,
      'stage ' + (index + 1) + ' ' + key + ' exceeded capacity');
    assert.ok(clipped >= -1e-6, 'stage ' + (index + 1) + ' ' + key + ' credited more than configured');
    verifiedPairs++;

    const clippedNonNegative = Math.max(0, clipped);
    const chapterResource = chapters[chapterIndex].resources[key];
    for (const bucket of [totals[key], chapterResource]) {
      bucket.configured += configured;
      bucket.credited += credited;
      bucket.clipped += clippedNonNegative;
      if (clippedNonNegative > 1e-6) {
        bucket.clippedStages++;
        if (credited < 1e-6) bucket.zeroCreditedStages++;
      }
    }
    stageRecord.resources[key] = {
      configured,
      stockBeforeBattle,
      capacity: capacities[key],
      credited,
      clipped: clippedNonNegative
    };
  }
  stages.push(stageRecord);
}

assert.equal(verifiedPairs, 300);
assert.deepEqual(Object.fromEntries(resourceKeys.map(key => [key, totals[key].configured])), {
  wood: 776104,
  stone: 595880,
  food: 502400
});
assert.deepEqual(Object.fromEntries(resourceKeys.map(key => [key, totals[key].credited])), {
  wood: 193883,
  stone: 8949,
  food: 324558.42660758644
});

const result = {
  unit: 'resource units; one row per completed campaign stage',
  source: {
    replay: path.relative(root, sourcePath).replaceAll(path.sep, '/'),
    replaySha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    finalSaveSha256: crypto.createHash('sha256').update(saveBytes).digest('hex'),
    configSha256: crypto.createHash('sha256').update(configBytes).digest('hex'),
    levelsSha256: crypto.createHash('sha256').update(levelsBytes).digest('hex'),
    mathSha256: crypto.createHash('sha256').update(mathBytes).digest('hex'),
    seed: replay.seed,
    campaignStages: replay.rows.length
  },
  method: 'For each stage, compare the reward configured in current CFG.enemies with the actual resource delta captured by P97. Apply the current real capacity to the pre-battle stock in P97 refill snapshots; expected credited reward is min(configured reward, remaining capacity).',
  capacities,
  verifiedPairs,
  totals,
  chapters,
  stages
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: path.relative(root, outputPath).replaceAll(path.sep, '/'),
  verifiedPairs,
  capacities,
  totals,
  chapters
}, null, 2));
