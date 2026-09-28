'use strict';
// P136: sensitivity-test the first chapter boss with one real early route.
// Only the L10 enemy counts vary; all cases use P102 callbacks in isolated copies.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-population-early-18.js'];
const bossCounts={baseline:[1,1,1],boss18:[4,3,2],boss26:[6,4,3],boss34:[8,5,4],boss40:[9,6,5]};
const sourceHashes=Object.fromEntries(files.map(file=>[file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const rootLevels=fs.readFileSync(path.join(root,'levels.js'),'utf8');
const workingRow=rootLevels.split(/\r?\n/).find(line=>/^  \{id:10,/.test(line));
assert.ok(workingRow,'必须找到L10 Boss配置');
const unitsToken=/units:\{"infantry":\[[0-9,]+\],"archer":\[[0-9,]+\]\}/.exec(workingRow)?.[0];
assert.ok(unitsToken,'L10 Boss须保持步兵＋弓手两类编成');
const baselineUnits='units:{"infantry":[1,1,1],"archer":[1,1,1]}';
const baselineRow=workingRow.replace(unitsToken,baselineUnits);
const baselineLevels=rootLevels.replace(workingRow,baselineRow);

function prepareClone(label,counts){
  const clone=fs.mkdtempSync(path.join(os.tmpdir(),`p136-${label}-`));
  for(const file of files){
    const source=path.join(root,file),destination=path.join(clone,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(source,destination);
    const copyHash=crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
    assert.equal(copyHash,sourceHashes[file],`${label}: ${file}副本SHA不一致`);
  }
  const candidateRow=baselineRow.replace(
    baselineUnits,
    `units:{"infantry":${JSON.stringify(counts)},"archer":${JSON.stringify(counts)}}`);
  const candidateLevels=baselineLevels.replace(baselineRow,candidateRow);
  assert.equal(candidateLevels.replace(candidateRow,baselineRow),baselineLevels,
    '仅可替换L10 Boss编成');
  fs.writeFileSync(path.join(clone,'levels.js'),candidateLevels);
  return clone;
}

function runRoute(clone,label){
  const args=['tools/verify/probe-population-first-clear-replenish-p102.js',
    '--campaign-max-stage=10','--battle-seed=3','--wait-windows=600'];
  const result=spawnSync(process.execPath,args,{cwd:clone,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`${label} P102战役失败：${result.stderr||result.stdout}`);
  const data=JSON.parse(result.stdout);
  const branch=data.results[0].frontloadedFood;
  const trace=branch.battleTrace;
  const boss=trace.find(row=>row.stage===10);
  assert.ok(boss,`${label}相同早期路线应抵达L10`);
  return{branch,trace,boss};
}

const cases={};
for(const [label,counts] of Object.entries(bossCounts)){
  const clone=prepareClone(label,counts);
  cases[label]={counts,rosterTotal:counts.reduce((sum,count)=>sum+count,0)*2,...runRoute(clone,label)};
}
const baselineTrace=cases.baseline.trace.filter(row=>row.stage<10);
for(const [label,result] of Object.entries(cases)){
  assert.deepEqual(result.trace.filter(row=>row.stage<10),baselineTrace,
    `${label}: L1–L9必须与基线完全一致`);
}
const expectedP135=JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p135-current-worktree-campaign.json'),'utf8'));
const sampledBoss=expectedP135.profiles.flatMap(profile=>profile.windows
  .filter(window=>window.extraSecondsPerWin===600)
  .flatMap(window=>window.branches.flatMap(branch=>branch.lateTrace)))
  .find(row=>row.stage===10);
assert.ok(sampledBoss?.win&&sampledBoss.round===1,'P135观测到L10应为首回合胜利');
assert.equal(cases.baseline.boss.round,sampledBoss.round);
assert.deepEqual(cases.baseline.boss.armyBefore,sampledBoss.armyBefore);
assert.deepEqual(cases.baseline.boss.armyAfter,sampledBoss.armyAfter);

const output=Object.fromEntries(Object.entries(cases).map(([label,result])=>[label,{
  counts:result.counts,rosterTotal:result.rosterTotal,win:result.boss.win,round:result.boss.round,
  enemy:result.boss.enemy,armyBefore:result.boss.armyBefore,armyAfter:result.boss.armyAfter,
  resourcesBefore:result.boss.resourcesBefore,
  ...(result.branch.rows.find(row=>row.stage===10)?{
    battleReward:result.branch.rows.find(row=>row.stage===10).reward}:{}),
  blockedAt:result.branch.blockedAt
}]));
const artifact={batch:'P136',unit:'simulated online seconds; actual soldiers; actual battle round; actual enemy groups/HP/ATK/DEF',
  method:'P102 real zero-win 18-person route; xorshift32 seed 3; frontloaded-food branch; 600 simulated seconds after each win; actual production/training/formation/battle/settlement callbacks; no player save',
  scope:'L10 composition-only sensitivities: baseline 6 troops and candidate 18/26/34/40 troops; all L1-L9 battle traces asserted identical before comparing the Boss',
  checkpoints:{seed:3,branch:'frontloaded-food',extraSecondsPerWin:600,stage9Win:true,
    baselineBossRound:cases.baseline.boss.round,entryArmy:cases.baseline.boss.armyBefore},
  variants:output,inputSha256:sourceHashes,
  workingLevelsSha256:crypto.createHash('sha256').update(rootLevels).digest('hex'),
  baselineLevelsSha256:crypto.createHash('sha256').update(baselineLevels).digest('hex'),
  candidateLevelsSha256:Object.fromEntries(Object.entries(bossCounts).map(([label,counts])=>{
    const candidateRow=baselineRow.replace(baselineUnits,
      `units:{"infantry":${JSON.stringify(counts)},"archer":${JSON.stringify(counts)}}`);
    const candidateText=baselineLevels.replace(baselineRow,candidateRow);
    return[label,crypto.createHash('sha256').update(candidateText).digest('hex')];
  }))};
const rawPath=path.join(root,'docs/codex/reports/data/p136-l10-boss-roster-sensitivity.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P136',checkpoint:artifact.checkpoints,
  results:Object.fromEntries(Object.entries(output).map(([label,row])=>[label,{
    roster:row.rosterTotal,weightedAttack:row.enemy.troopWeightedAttack,win:row.win,
    round:row.round,armyBefore:row.armyBefore,armyAfter:row.armyAfter}])),rawData:rawPath},null,2));
