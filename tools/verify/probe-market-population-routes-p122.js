'use strict';
// P122: compare market-funded 18->19 housing expansion after three real
// zero-win P101 economic/research routes. Each route uses isolated VM state.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const continuation=path.join(root,'tools/verify/probe-market-population-19-p121.js');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const rawPath=path.join(root,'docs/codex/reports/data/p122-zero-win-population-routes.json');
const scenarios=[
  {name:'sequential-expansion',args:[],expectedRoute:'sequential-expansion'},
  {name:'research-priority-4',args:['--research-workers=4'],expectedRoute:'research-priority-4-after-market'},
  {name:'research-priority-7',args:['--research-workers=7'],expectedRoute:'research-priority-7-after-market'}
];

const profiles=[];
for(const scenario of scenarios){
  const sourceResult=spawnSync(process.execPath,[populationProbe,...scenario.args],
    {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(sourceResult.status,0,
    `P101来源路线${scenario.name}失败：${sourceResult.stderr||sourceResult.stdout}`);
  const sourceRun=JSON.parse(sourceResult.stdout);
  const population14=sourceRun.milestones.find(m=>m.label==='population-14');
  const population18=sourceRun.milestones.find(m=>m.label==='population-18');
  assert.ok(population14&&population18,`${scenario.name}缺少人口里程碑`);
  assert.ok(sourceRun.population14IndustryCheck,`${scenario.name}缺少14人口产业岗位核算`);
  assert.equal(population14.population,14);
  assert.equal(population14.capacity,14);
  assert.equal(population18.population,18);
  assert.equal(population18.capacity,18);

  const result=spawnSync(process.execPath,[continuation,...scenario.args],
    {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,
    `P121续跑${scenario.name}失败：${result.stderr||result.stdout}`);
  const artifact=JSON.parse(fs.readFileSync(path.join(root,
    'docs/codex/reports/data/p121-zero-win-population-19.json'),'utf8'));
  assert.equal(artifact.sourceRoute,scenario.expectedRoute);
  assert.equal(artifact.battleWins,0);
  assert.equal(artifact.final.battleWins,0);
  assert.equal(artifact.start.population,18);
  assert.equal(artifact.start.capacity,18);
  assert.equal(artifact.final.population,19);
  assert.equal(artifact.final.capacity,19);
  assert.equal(artifact.deedNeeded,9);
  assert.equal(artifact.targetCoin,900);
  assert.equal(artifact.final.tick-artifact.start.tick,artifact.waitSeconds);
  assert.ok(artifact.minFood>=1000-1e-9,`${scenario.name}跌破粮食交易保留线`);
  const post18ValidationSeconds=artifact.start.tick-population18.second;
  assert.ok(Number.isSafeInteger(post18ValidationSeconds)&&post18ValidationSeconds>=0);
  const elapsedFromFirst18To19=artifact.final.tick-population18.second;
  assert.equal(artifact.final.tick-population18.second,
    artifact.waitSeconds+post18ValidationSeconds);
  for(const key of ['wood','stone','food'])assert.ok(artifact.final.resources[key]>0);
  profiles.push({name:scenario.name,sourceRoute:artifact.sourceRoute,
    firstPopulation14Seconds:population14.second,
    population14Allocation:population14.popAlloc,
    population14IndustryCheck:sourceRun.population14IndustryCheck,
    firstPopulation18Seconds:population18.second,
    sourceOnlineSeconds:artifact.sourceOnlineSeconds,
    post18ValidationSeconds,
    startTick:artifact.start.tick,marketToBirthSeconds:artifact.waitSeconds,
    elapsedFromFirst18To19,
    totalNoWinOnlineSeconds:artifact.sourceOnlineSeconds+artifact.waitSeconds,
    tradeCount:artifact.tradeCount,deedsPurchased:artifact.deedNeeded,
    coinSpent:artifact.targetCoin,minFood:artifact.minFood,
    startResources:{wood:artifact.start.resources.wood,stone:artifact.start.resources.stone,
      food:Number(artifact.start.resources.food.toFixed(3))},
    finalResources:{wood:artifact.final.resources.wood,stone:artifact.final.resources.stone,
      food:Number(artifact.final.resources.food.toFixed(3))},
    population:artifact.final.population,capacity:artifact.final.capacity,
    woodWorkers:artifact.final.woodWorkers,woodRate:artifact.final.woodRate});
}

// Leave P121's linked raw file at its canonical default-route result.
const restored=spawnSync(process.execPath,[continuation],
  {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
assert.equal(restored.status,0,`恢复P121默认原始数据失败：${restored.stderr||restored.stdout}`);
const canonical=JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p121-zero-win-population-19.json'),'utf8'));
assert.equal(canonical.sourceRoute,'sequential-expansion');

const artifact={batch:'P122',
  unit:'simulated online seconds; residents; deeds; resources; market trades',
  method:'three current-worktree P101 real new-game zero-win routes, each serialized and loaded by the real-function P121 continuation; all use the same 18->19 village expansion and market reserve policy',
  scope:'compare sequential expansion, four-scholar research priority, and seven-scholar research priority through the same next-housing purchase; no combat, injected resources, candidate stage rewards, manual game-state edits, or player-save writes',
  sharedExpansion:{fromPopulation:18,toPopulation:19,fromCapacity:18,toCapacity:19,
    villageFromLevel:4,villageToLevel:5,deeds:9,coin:900,
    reserves:{wood:100,stone:1000,food:1000}},
  scenarios:profiles};
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P122',scenarios:profiles,rawData:rawPath},null,2));
