'use strict';
// P135: compare the current L6 roster with a 30-enemy progression candidate.
// Both cases run from isolated copies through the real P102/P119 battle route.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-population-early-18.js','tools/verify/probe-seeded-campaign-frontier-p119.js'];
const passthrough=files.filter(file=>file!=='levels.js');
const branches=['current','frontloadedMetal','frontloadedFood'];
const waits=[0,60,180,600];
const detailSeeds=[1,2,3,42,12345];
const oldRow=`  {id:6,name:'弓兵哨位',desc:'弓兵占据了有利地形',units:{"infantry":[9,7,4],"archer":[9,7,4]},reward:{"wood":146,"stone":102,"food":88}},`;
const candidateRow=`  {id:6,name:'军镇巡防队',desc:'步兵列阵掩护弓手，构筑第二道防线',units:{"infantry":[7,5,3],"archer":[7,5,3]},reward:{"wood":146,"stone":102,"food":88}},`;
const currentLevels=fs.readFileSync(path.join(root,'levels.js'),'utf8');
const baselineLevels=currentLevels.includes(candidateRow)
  ?currentLevels.replace(candidateRow,oldRow):currentLevels;
assert.equal(baselineLevels.split(oldRow).length-1,1,'L6基线行必须唯一');
const candidateLevels=baselineLevels.replace(oldRow,candidateRow);
assert.equal(candidateLevels.replace(candidateRow,oldRow),baselineLevels,
  '两个场景只能在L6单行有差异');

function cloneWithLevels(name,levelsText){
  const clone=fs.mkdtempSync(path.join(os.tmpdir(),`p135-${name}-`));
  for(const file of files){
    const source=path.join(root,file),destination=path.join(clone,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(source,destination);
  }
  fs.writeFileSync(path.join(clone,'levels.js'),levelsText);
  for(const file of passthrough){
    const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
    const cloneHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(clone,file))).digest('hex');
    assert.equal(cloneHash,sourceHash,`${name}副本${file}必须与当前工作区完全一致`);
  }
  return clone;
}
const baselineRoot=cloneWithLevels('l6-40',baselineLevels);
const candidateRoot=cloneWithLevels('l6-30',candidateLevels);

function run(clone,args,label){
  const result=spawnSync(process.execPath,args,{cwd:clone,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`${label}失败：${result.stderr||result.stdout}`);
  return result.stdout;
}
function runP119(clone,label){
  run(clone,['tools/verify/probe-seeded-campaign-frontier-p119.js'],`${label} P119全矩阵回放`);
  return JSON.parse(fs.readFileSync(path.join(clone,
    'docs/codex/reports/data/p119-seeded-campaign-frontier.json'),'utf8'));
}
function summarise(exposure){
  return exposure.map(window=>{
    const firstLossCounts={};
    for(const row of window.rows){
      const stage=String(row.firstLoss?.stage||'none');
      firstLossCounts[stage]=(firstLossCounts[stage]||0)+1;
    }
    const attemptedL6=window.rows.filter(row=>!row.firstLoss||row.firstLoss.stage>=6).length;
    const clearedL6=window.rows.filter(row=>!row.firstLoss||row.firstLoss.stage>6).length;
    return{extraSecondsPerWin:window.extraSecondsPerWin,branches:window.branches,
      firstLossCounts,attemptedL6,clearedL6,reachedCounts:window.reachedCounts};
  });
}
function captureL6Details(clone,label){
  return detailSeeds.flatMap(seed=>{
    const args=['tools/verify/probe-population-first-clear-replenish-p102.js',
      '--campaign-max-stage=6',`--battle-seed=${seed}`,`--wait-windows=${waits.join(',')}`];
    const data=JSON.parse(run(clone,args,`${label} P102 seed ${seed}详情`));
    assert.ok(data.campaignMaxStage===undefined||data.campaignMaxStage===6);
    return data.results.flatMap(window=>branches.map(key=>({seed,
      extraSecondsPerWin:window.extraSecondsPerWin,branch:key,
      battle:window[key].battleTrace.find(row=>row.stage===6)||null})))
      .filter(row=>row.battle);
  });
}

const baselineData=runP119(baselineRoot,'L6=40');
const candidateData=runP119(candidateRoot,'L6=30');
const baselineL6=captureL6Details(baselineRoot,'L6=40');
const candidateL6=captureL6Details(candidateRoot,'L6=30');
const baselineEnemy=baselineL6[0]?.battle.enemy;
const candidateEnemy=candidateL6[0]?.battle.enemy;
assert.equal(baselineEnemy?.totalTroops,40);
assert.equal(baselineEnemy?.troopWeightedAttack,240);
assert.equal(candidateEnemy?.totalTroops,30);
assert.equal(candidateEnemy?.troopWeightedAttack,180);

const sourceHashesSha256=Object.fromEntries(passthrough.map(file=>[file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
sourceHashesSha256['baseline levels.js']=crypto.createHash('sha256').update(baselineLevels).digest('hex');
sourceHashesSha256['candidate levels.js']=crypto.createHash('sha256').update(candidateLevels).digest('hex');
sourceHashesSha256['tools/verify/probe-campaign-l6-30-sensitivity-p135.js']=
  crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
const artifact={batch:'P135',unit:'simulated online seconds; actual soldiers; actual battle round; resources',
  method:'P119 full seeded campaign matrices for both cases in isolated source copies; P102 captures actual L6 battle callbacks; no player save',
  candidate:'L6 20 infantry + 20 archers (40 total, weighted attack 240) versus 15 infantry + 15 archers (30 total, weighted attack 180); only L6 row differs, with candidate name/description aligned to industrial frontier theme',
  seeds:detailSeeds,waits,branches,sourceHashesSha256,
  baseline:{exposure:summarise(baselineData.exposure),stage6Details:baselineL6},
  candidate:{exposure:summarise(candidateData.exposure),stage6Details:candidateL6},
  isolatedPaths:{baseline:baselineRoot,candidate:candidateRoot}};
const rawPath=path.join(root,'docs/codex/reports/data/p135-campaign-l6-30-sensitivity.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P135',baseline:artifact.baseline.exposure.map(row=>({
  seconds:row.extraSecondsPerWin,attempts:row.attemptedL6,cleared:row.clearedL6})),
  candidate:artifact.candidate.exposure.map(row=>({seconds:row.extraSecondsPerWin,
    attempts:row.attemptedL6,cleared:row.clearedL6,reachedCounts:row.reachedCounts})),
  rosters:{baseline:{total:baselineEnemy.totalTroops,attack:baselineEnemy.troopWeightedAttack},
    candidate:{name:candidateEnemy.name,total:candidateEnemy.totalTroops,
      attack:candidateEnemy.troopWeightedAttack}},rawData:rawPath},null,2));
