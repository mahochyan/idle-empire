'use strict';
// P144 sweeps only the food-worker return-to-baseline reserve line used by
// the isolated P143 campaign probe. It never patches the shipped game.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const sourceProbe=path.join(root,'tools/verify/probe-adaptive-food-workers-p143.js');
const thresholds=[600,1000,1400,1800,2200,2600,2800,3000];
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p144-'));
const dataDir=path.join(root,'docs/codex/reports/data');

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P143结构变化，找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P143结构变化，${label}不再唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function safeRemoveTemp(){
  const tempBase=fs.realpathSync(os.tmpdir());
  const resolved=path.resolve(tempRoot);
  assert.equal(path.dirname(resolved),tempBase,'P144临时副本必须是系统临时目录的直接子目录');
  assert.ok(path.basename(resolved).startsWith('idle-empire-p144-'),'P144临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}
function summarize(raw,threshold){
  const foodRuns=raw.profiles.map(profile=>{
    const branch=profile.branches.find(item=>item.branch==='frontloadedFood');
    const switches=branch.stages.flatMap(row=>row.adaptiveRoleChanges)
      .filter(change=>change.action==='switch');
    return{seed:profile.seed,wins:branch.wins,blockedAt:branch.blockedAt,
      switches:switches.map(change=>({afterStage:change.afterStage,foodBefore:change.foodBefore,
        from:change.foodWorkersBefore,to:change.foodWorkersAfter}))};
  });
  return{threshold,totalWins:foodRuns.reduce((sum,run)=>sum+run.wins,0),
    firstLosses:foodRuns.reduce((counts,run)=>{
      const key=String(run.blockedAt);counts[key]=(counts[key]||0)+1;return counts;
    },{}),foodRuns};
}

try{
  fs.mkdirSync(dataDir,{recursive:true});
  const source=fs.readFileSync(sourceProbe,'utf8');
  const results=[];
  for(const threshold of thresholds){
    let cloned=source;
    const rootNeedle="const root=path.resolve(__dirname,'../..');";
    const rootOffset=cloned.indexOf(rootNeedle);
    assert.notEqual(rootOffset,-1,'P143结构变化，找不到包装器工作区根');
    cloned=cloned.slice(0,rootOffset)+'const root=process.env.P144_REPO_ROOT;'+
      cloned.slice(rootOffset+rootNeedle.length);
    cloned=cloned.replace(/400/g,String(threshold));
    cloned=cloned.replaceAll("batch:'P143'",`batch:'P144-${threshold}'`);
    const dataFile=`docs/codex/reports/data/p144-food-return-${threshold}.json`;
    cloned=replaceOnce(cloned,
      "const outputFile=path.join(root,'docs/codex/reports/data/p143-adaptive-food-campaign.json');",
      `const outputFile=path.join(root,'${dataFile}');`,
      '为阈值分配独立原始数据路径');
    cloned=cloned.replaceAll('docs/codex/reports/data/p143-adaptive-food-campaign.json',dataFile);
    cloned=replaceOnce(cloned,
      "assert.equal(raw.batch,'P143');",
      `assert.equal(raw.batch,'P144-${threshold}');`,
      '校验P144阈值批次');
    cloned=replaceOnce(cloned,
      "raw.batch='P143';",
      `raw.batch='P144-${threshold}';`,
      '写入P144阈值批次');
    const clonePath=path.join(tempRoot,`threshold-${threshold}`,
      'tools/verify/probe-adaptive-food-workers-p144.js');
    fs.mkdirSync(path.dirname(clonePath),{recursive:true});
    fs.writeFileSync(clonePath,cloned);
    const run=spawnSync(process.execPath,[clonePath],{
      cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024,
      env:{...process.env,P144_REPO_ROOT:root}
    });
    assert.equal(run.status,0,`P144回调阈值${threshold}失败：${run.stderr||run.stdout}`);
    const raw=JSON.parse(fs.readFileSync(path.join(root,dataFile),'utf8'));
    assert.equal(raw.batch,`P144-${threshold}`);
    raw.returnFoodThreshold=threshold;
    raw.inputs.push({file:'tools/verify/probe-food-return-threshold-sweep-p144.js',
      sha256:sha256('tools/verify/probe-food-return-threshold-sweep-p144.js')});
    fs.writeFileSync(path.join(root,dataFile),JSON.stringify(raw,null,2)+'\n');
    results.push(summarize(raw,threshold));
  }

  const prior=JSON.parse(fs.readFileSync(path.join(dataDir,'p142-food-worker-campaign.json'),'utf8'));
  const staticFood=prior.profiles.map(profile=>{
    const branch=profile.branches.find(item=>item.branch==='frontloadedFood');
    return{seed:profile.seed,wins:branch.wins,blockedAt:branch.blockedAt};
  });
  const staticBySeed=new Map(staticFood.map(row=>[row.seed,row]));
  for(const result of results){
    assert.equal(result.foodRuns.length,staticFood.length,`阈值${result.threshold}种子数量变化`);
    if(result.threshold>=2600){
      for(const row of result.foodRuns){
        const baseline=staticBySeed.get(row.seed);
        assert.ok(baseline,`P142缺少种子${row.seed}`);
        assert.equal(row.wins,baseline.wins,`阈值${result.threshold}/种子${row.seed}胜场偏离固定四粮工`);
        assert.equal(row.blockedAt,baseline.blockedAt,
          `阈值${result.threshold}/种子${row.seed}首败点偏离固定四粮工`);
      }
    }
  }
  const summary={batch:'P144',unit:'simulated online seconds; food reserve; wins; first-loss stage',
    method:'Eight isolated replays of the P143 checkpoint rule. After each 600-second replenishment window, food below 100 assigns four food workers and food at or above the tested threshold returns to three before the next battle; between thresholds the current assignment holds. P102 real economy/combat functions; five fixed seeds; no deeds or player saves.',
    scope:'Threshold sensitivity only; all role changes preserve 18 workers and occur after the 600-second post-victory recovery window, before the next battle.',
    comparisonBoundary:'P139 current/metal branches are rechecked by each P143-derived probe. P142 is the static four-food-worker comparison. This deterministic five-seed test is not a player win-rate estimate.',
    thresholds,staticFourFood:staticFood,staticTotalWins:staticFood.reduce((sum,row)=>sum+row.wins,0),results,
    rawFiles:thresholds.map(value=>`docs/codex/reports/data/p144-food-return-${value}.json`),
    inputs:['tools/verify/probe-adaptive-food-workers-p143.js',
      'tools/verify/probe-food-return-threshold-sweep-p144.js',
      'docs/codex/reports/data/p139-no-deed-campaign.json',
      'docs/codex/reports/data/p142-food-worker-campaign.json'].map(file=>({file,sha256:sha256(file)})),
    rawArtifacts:thresholds.map(value=>{
      const file=`docs/codex/reports/data/p144-food-return-${value}.json`;
      return{file,sha256:sha256(file)};
    })};
  const outputFile=path.join(dataDir,'p144-food-return-threshold-sweep.json');
  fs.writeFileSync(outputFile,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({batch:'P144',staticTotalWins:summary.staticTotalWins,
    results:results.map(result=>({threshold:result.threshold,totalWins:result.totalWins,
      firstLosses:result.firstLosses,perSeed:result.foodRuns.map(run=>({seed:run.seed,
        wins:run.wins,blockedAt:run.blockedAt,switches:run.switches}))})),
    rawData:outputFile},null,2));
}finally{
  safeRemoveTemp();
}
