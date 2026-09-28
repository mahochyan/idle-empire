'use strict';
// P139 compares the current real battle/economy route with the P102-only
// candidate first-clear deed injection disabled. All edits are made in a
// guarded temporary copy; shipped game logic and P102 remain untouched.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const files=[
  'config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js'
];
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p139-'));
const tempProbe=path.join(tempRoot,'tools/verify/probe-population-first-clear-replenish-p102.js');

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P102探针结构变化，找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P102探针结构变化，${label}不再唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function safeRemoveTemp(){
  const tempBase=fs.realpathSync(os.tmpdir());
  const resolved=path.resolve(tempRoot);
  assert.equal(path.dirname(resolved),tempBase,'临时副本必须是系统临时目录的直接子目录');
  assert.ok(path.basename(resolved).startsWith('idle-empire-p139-'),'临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}
function summarizeBranch(seed,key,branch){
  const enemyByStage=new Map(branch.battleTrace.map(row=>[row.stage,row.enemy]));
  return{seed,branch:key,blockedAt:branch.blockedAt,wins:branch.wins,attempted:branch.attempted,
    firstLoss:branch.firstLoss?{stage:branch.firstLoss.stage,round:branch.firstLoss.round,
      armyBefore:branch.firstLoss.armyBefore,armyAfter:branch.firstLoss.armyAfter}:null,
    stages:branch.rows.map(row=>({stage:row.stage,win:row.win,round:row.round,
      enemy:{name:enemyByStage.get(row.stage)?.name,totalTroops:enemyByStage.get(row.stage)?.totalTroops,
        weightedAttack:enemyByStage.get(row.stage)?.troopWeightedAttack},
      armyBefore:row.byTypeBefore,armyAfter:row.byTypeAfter,
      populationBefore:row.populationBefore,capacityBefore:row.capacityBefore,
      deedAward:row.reward.award,deedSpent:row.reward.spent,
      workers:row.workforceChange?.rates?row.workforceChange:null,
      replenishment:row.replenishment?{afterArmy:row.replenishment.afterArmy,
        remainingQueue:row.replenishment.remainingQueue,resources:row.replenishment.resources}:null}))};
}

try{
  for(const file of files){
    const destination=path.join(tempRoot,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(root,file),destination);
  }

  let source=fs.readFileSync(tempProbe,'utf8');
  source=replaceOnce(source,
    'const baseAward=Math.ceil(stage/10);',
    'const baseAward=0;',
    '首通基础地契注入');
  source=replaceOnce(source,
    'const bonus=rewardMode.startsWith(\'frontloaded\')&&stage===3?6:0;',
    'const bonus=0;',
    'L3前置地契注入');
  source=replaceOnce(source,
    "assert.equal(run('popCurrent()'),19,'首胜扩容应自然出生第19人');",
    "assert.equal(run('popCurrent()'),18,'无候选地契时应保持18人口');",
    '无地契模型下的人口期望');
  source=replaceOnce(source,
    "const workers=foodPolicy?{stone:6,food:4,coal:6,copper:3}\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3,wood:1}\n          :{stone:5,food:2,coal:8,copper:4};",
    "const workers=foodPolicy?{stone:6,food:3,coal:6,copper:3}\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3}\n          :{stone:5,food:2,coal:7,copper:4};",
    '无新增居民时的18岗敏感性分配');
  source=replaceOnce(source,
    "const stage3=candidate.rows.find(row=>row.stage===3);\n    if(stage3?.win){\n      assert.equal(stage3.reward.spent,9,'第3关+6须在真实扩容动作中支付9地契');",
    "const stage3=candidate.rows.find(row=>row.stage===3);\n    if(false&&stage3?.win){\n      assert.equal(stage3.reward.spent,9,'第3关+6须在真实扩容动作中支付9地契');",
    '跳过仅适用于候选奖励的断言');
  fs.writeFileSync(tempProbe,source);

  const seeds=[1,2,3,42,12345];
  const branchKeys=['current','frontloadedMetal','frontloadedFood'];
  const profiles=[];
  for(const seed of seeds){
    const args=[tempProbe,'--campaign-max-stage=20',`--battle-seed=${seed}`,'--wait-windows=600'];
    const result=spawnSync(process.execPath,args,{cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024});
    assert.equal(result.status,0,`无首通地契P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
    const replay=JSON.parse(result.stdout);
    assert.equal(replay.batch,'P102');
    assert.equal(replay.battleSeed,seed);
    assert.deepEqual(replay.waitWindows,[600]);
    const window=replay.results[0];
    const branches=branchKeys.map(key=>{
      const branch=window[key];
      for(let i=0;i<branch.battleTrace.length;i++)
        assert.equal(branch.battleTrace[i].stage,i+1,'失败前必须逐关连续推进');
      for(const row of branch.rows){
        assert.equal(row.reward.award,0,`种子${seed}/${key}/L${row.stage}不应注入候选地契`);
        assert.equal(row.reward.spent,0,`种子${seed}/${key}/L${row.stage}不应由候选地契扩容`);
      }
      assert.ok(branch.rows.every(row=>row.populationBefore===18&&row.capacityBefore===18),
        `种子${seed}/${key}的住房容量或人口不应超过18`);
      return summarizeBranch(seed,key,branch);
    });
    profiles.push({seed,entry:replay.entryState,branches});
  }

  const candidate=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p137-chapter-two-campaign-frontier.json'),'utf8'));
  const candidateExposure=candidate.exposure.find(item=>item.extraSecondsPerWin===600);
  const candidateBranch=(seed,key)=>{
    const profile=candidate.profiles.find(item=>item.seed===seed);
    assert.ok(profile,`P137缺少种子${seed}`);
    const window=profile.windows.find(item=>item.extraSecondsPerWin===600);
    assert.ok(window,`P137缺少种子${seed}/600秒窗口`);
    const branch=window.branches.find(item=>item.branch===key);
    assert.ok(branch,`P137缺少种子${seed}/${key}`);
    return branch;
  };
  const matchedCurrentRoleFrontier=profiles.map(profile=>{
    const noDeed=profile.branches.find(branch=>branch.branch==='current');
    const withBaseDeed=candidateBranch(profile.seed,'current');
    const candidateEntry=candidate.profiles.find(item=>item.seed===profile.seed).entry;
    for(const field of ['tick','population','capacity','workers','army','resources'])
      assert.deepEqual(profile.entry[field],candidateEntry[field],
        `种子${profile.seed}的P137/P139当前岗位起点${field}必须相同`);
    assert.equal(noDeed.blockedAt,withBaseDeed.blockedAt,
      `种子${profile.seed}当前岗位路线加入基础地契模型后推进关卡发生变化`);
    assert.equal(noDeed.wins,withBaseDeed.wins,
      `种子${profile.seed}当前岗位路线加入基础地契模型后胜场数发生变化`);
    return{seed:profile.seed,startingPopulation:profile.entry.population,
      startingCapacity:profile.entry.capacity,
      noDeed:{blockedAt:noDeed.blockedAt,wins:noDeed.wins},
      baseDeedCandidate:{blockedAt:withBaseDeed.blockedAt,wins:withBaseDeed.wins},
      sameFrontier:true};
  });
  const frontloadedFoodSensitivity=profiles.map(profile=>{
    const noDeed=profile.branches.find(branch=>branch.branch==='frontloadedFood');
    const withBonus=candidateBranch(profile.seed,'frontloadedFood');
    return{seed:profile.seed,noDeed:{blockedAt:noDeed.blockedAt,wins:noDeed.wins},
      bonusPlusHousingAndStaffing:{blockedAt:withBonus.blockedAt,wins:withBonus.wins},
      comparisonBoundary:'P137 adds six L3 deeds, buys housing, waits for resident 19, then changes role allocation; this is a package comparison, not deed-only attribution'};
  });
  const noDeedExposure=branchKeys.map(key=>{
    const branches=profiles.flatMap(profile=>profile.branches.filter(branch=>branch.branch===key));
    return{branch:key,branches:branches.length,
      reachedCounts:Object.fromEntries(Array.from({length:11},(_,i)=>{
        const stage=10+i;return[stage,branches.filter(branch=>branch.stages.some(row=>row.stage===stage)).length];
      })),
      clearedCounts:Object.fromEntries(Array.from({length:11},(_,i)=>{
        const stage=10+i;return[stage,branches.filter(branch=>branch.stages.some(row=>row.stage===stage&&row.win)).length];
      })),
      firstLosses:Object.fromEntries([...new Set(branches.map(branch=>branch.blockedAt))].sort((a,b)=>a-b)
        .map(stage=>[stage,branches.filter(branch=>branch.blockedAt===stage).length]))};
  });
  const inputFiles=files.filter(file=>!file.startsWith('tools/verify/'));
  for(const file of ['tools/verify/probe-population-early-18.js',
    'tools/verify/probe-population-first-clear-replenish-p102.js',
    'docs/codex/reports/data/p137-chapter-two-campaign-frontier.json'])inputFiles.push(file);
  const inputs=inputFiles.map(file=>({file,sha256:sha256(file)}));
  const sourceHead=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const artifact={batch:'P139',unit:'simulated online seconds; population; capacity; resources; troops; stage; enemy weighted attack',
    method:'Current worktree CFG/enemies and real P102 production, training, role allocation, tick, battle, loss, ordinary battle reward, and replenishment functions. A temporary P102 copy only disables its external candidate first-clear deed additions. Five xorshift32 seeds × three 18-worker role profiles; 600 simulated online seconds per victory; stop at first loss; no player save.',
    scope:'No-deed baseline for the P137 candidate deed route. The current-role branch is closest to the current 18-person route; frontloaded branches preserve role-sensitivity with 18 workers and do not create a 19th resident.',
    rewardBoundary:'Only P102 external deed injection is disabled. Real CFG combat rewards remain active. P137 comparison data injects ceil(stage/10) deeds and adds six at L3 for frontloaded branches; that remains a development model, not a live reward.',
    comparisonBoundary:'The matched current-role branch starts identically and has the same first-loss stage/win count for all five seeds under P137 base deeds and P139 no deeds. The frontloaded-food comparison changes a package: P137 adds six L3 deeds, buys housing, waits for resident 19, and changes roles; it is not deed-only attribution.',
    sourceHead,inputs,seeds,waits:[600],candidate600s:candidateExposure,noDeedExposure,
    matchedCurrentRoleFrontier,frontloadedFoodSensitivity,profiles};
  const outPath=path.join(root,'docs/codex/reports/data/p139-no-deed-campaign.json');
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({batch:'P139',candidate600s:{reached:candidateExposure.reachedCounts,cleared:candidateExposure.clearedCounts,
    firstLosses:candidateExposure.firstLosses},noDeedExposure,rawData:outPath},null,2));
}finally{
  safeRemoveTemp();
}
