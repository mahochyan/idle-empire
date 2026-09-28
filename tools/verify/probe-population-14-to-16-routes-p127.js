'use strict';
// P127: repeat the P126 14->16 handoff comparison across the three real
// zero-win P101 research/economic profiles from their own 14-resident saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const probe=path.join(root,'tools/verify/probe-population-14-to-16-p126.js');
const rawPath=path.join(root,'docs/codex/reports/data/p127-population-14-to-16-routes.json');
const inputPaths=[
  'config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-14-to-16-p126.js'
];
function fingerprint(){
  return Object.fromEntries(inputPaths.map(relative=>{
    const data=fs.readFileSync(path.join(root,relative));
    return[relative,crypto.createHash('sha256').update(data).digest('hex')];
  }));
}
const inputHashesBefore=fingerprint();
const scenarios=[
  {name:'sequential-expansion',args:[],raw:'docs/codex/reports/data/p126-population-14-to-16.json',
    expectedRoute:'sequential-expansion'},
  {name:'research-priority-4',args:['--research-workers=4'],
    raw:'docs/codex/reports/data/p126-population-14-to-16-research4.json',
    expectedRoute:'research-priority-4-after-market'},
  {name:'research-priority-7',args:['--research-workers=7'],
    raw:'docs/codex/reports/data/p126-population-14-to-16-research7.json',
    expectedRoute:'research-priority-7-after-market'}
];
const profiles=[];
for(const scenario of scenarios){
  const result=spawnSync(process.execPath,[probe,...scenario.args,`--raw-output=${scenario.raw}`],
    {cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,
    `14→16路线${scenario.name}失败：${result.stderr||result.stdout}`);
  const row=JSON.parse(fs.readFileSync(path.join(root,scenario.raw),'utf8'));
  assert.equal(row.sourceRoute,scenario.expectedRoute);
  assert.ok(Number.isSafeInteger(row.baseline.first14Seconds));
  assert.ok(row.baseline.first16Seconds>row.baseline.first14Seconds);
  assert.equal(row.baseline.expansionSeconds,row.baseline.first16Seconds-row.baseline.first14Seconds);
  assert.equal(row.baseline.startingState.population,14);
  assert.equal(row.baseline.startingState.capacity,14);
  assert.equal(row.sharedExpansion.deedCost,24);
  assert.equal(row.sharedExpansion.coinCost,2400);
  assert.equal(row.metalThenMarket.after120Seconds.resources.coal-
    row.baseline.startingState.resources.coal,120);
  assert.equal(row.metalThenMarket.after120Seconds.resources.copper-
    row.baseline.startingState.resources.copper,120);
  assert.equal(row.metalThenMarket.after120Seconds.resources.iron-
    row.baseline.startingState.resources.iron,60);
  assert.equal(row.continuousMint.marketTrades.length,0);
  assert.equal(row.continuousMint.final.battleWins,0);
  assert.equal(row.metalThenMarket.final.battleWins,0);
  assert.ok(row.continuousMint.minFood>0);
  assert.ok(row.metalThenMarket.minFood>0);
  profiles.push({name:scenario.name,sourceRoute:row.sourceRoute,
    firstPopulation14Seconds:row.baseline.first14Seconds,
    firstPopulation16Seconds:row.baseline.first16Seconds,
    startingCoin:row.baseline.startingState.resources.coin,
    startingTech:row.baseline.startingState.resources.tech,
    baselineSeconds:row.baseline.expansionSeconds,
    metalShiftSeconds:row.metalThenMarket.totalElapsedSeconds,
    metalShiftExtraSeconds:row.metalThenMarket.totalElapsedSeconds-row.baseline.expansionSeconds,
    metalShiftMinFood:row.metalThenMarket.minFood,
    metalShiftMarketSales:row.metalThenMarket.marketTrades.length,
    metalYield:{coal:120,copper:120,iron:60},
    mintSeconds:row.continuousMint.totalElapsedSeconds,
    mintExtraSeconds:row.continuousMint.totalElapsedSeconds-row.baseline.expansionSeconds,
    mintStartingCoin:row.continuousMint.baselineStartingCoin??row.baseline.startingState.resources.coin,
    mintCoinAfterExpansion:row.continuousMint.final.resources.coin,
    mintTechSpent:row.continuousMint.research.techSpent,
    mintMinFood:row.continuousMint.minFood});
}
const artifact={batch:'P127',unit:'simulated online seconds; residents; resources; deeds',
  method:'run P126 from three current-worktree P101 real new-game zero-win profiles; within each profile branch all candidates from its exact serialized 14-resident checkpoint',
  scope:'compare same 14->16 settlement cost using the source market route, a 120-second metal shift followed by market expansion, and a continuous copper-mint/metal allocation; these are three economic/research profiles, not the military or short-session route families',
  inputHashes:inputHashesBefore,
  sharedTarget:{fromPopulation:14,toPopulation:16,settlement:'smallTown',fromLevel:3,toLevel:4,
    deedCost:24,coinCost:2400},scenarios:profiles};
const inputHashesAfter=fingerprint();
assert.deepEqual(inputHashesAfter,inputHashesBefore,
  'P127运行期间共享工作区的配置/公式/测试或探针输入发生变化，结果不能作为单一快照');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P127',scenarios:profiles,rawData:rawPath},null,2));
