'use strict';
// P142 tests whether moving one of the existing 18 workers from stone to food
// helps the no-deed campaign after P141 exposed low-food recovery windows.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p142-'));
const clonedProbe=path.join(tempRoot,'tools/verify/probe-food-worker-campaign-p142-inner.js');
const outputFile=path.join(root,'docs/codex/reports/data/p142-food-worker-campaign.json');

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P139结构变化，找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P139结构变化，${label}不再唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function safeRemoveTemp(){
  const tempBase=fs.realpathSync(os.tmpdir());
  const resolved=path.resolve(tempRoot);
  assert.equal(path.dirname(resolved),tempBase,'P142临时副本必须是系统临时目录的直接子目录');
  assert.ok(path.basename(resolved).startsWith('idle-empire-p142-'),'P142临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}

try{
  let source=fs.readFileSync(path.join(root,'tools/verify/probe-live-deed-baseline-p139.js'),'utf8');
  source=replaceOnce(source,
    "const root=path.resolve(__dirname,'../..');",
    'const root=process.env.P142_REPO_ROOT;',
    '由P142传入真实工作区');
  source=replaceOnce(source,
    "const workers=foodPolicy?{stone:6,food:3,coal:6,copper:3}\\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3}\\n          :{stone:5,food:2,coal:7,copper:4};",
    "const workers=foodPolicy?{stone:5,food:4,coal:6,copper:3}\\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3}\\n          :{stone:5,food:2,coal:7,copper:4};",
    '把一名现有石工改为粮工并保持18人总岗数');
  source=source.replace(/batch:'P139'/g,"batch:'P142'");
  assert.ok(source.includes("batch:'P142'"),'P142批次标记未更新');
  source=replaceOnce(source,
    'No-deed baseline for the P137 candidate deed route. The current-role branch is closest to the current 18-person route; frontloaded branches preserve role-sensitivity with 18 workers and do not create a 19th resident.',
    'No-deed 18-person campaign role comparison. The food branch moves one existing worker from stone to food after a stage-3 win; all branches keep 18 residents and capacity, and no first-clear deeds are injected.',
    '更新P142范围说明');
  source=replaceOnce(source,
    'The matched current-role branch starts identically and has the same first-loss stage/win count for all five seeds under P137 base deeds and P139 no deeds. The frontloaded-food comparison changes a package: P137 adds six L3 deeds, buys housing, waits for resident 19, and changes roles; it is not deed-only attribution.',
    'The matched current-role and metal-role branches replay P139 exactly. The P142 food-role branch changes only one existing worker from stone to food after a stage-3 win; comparisons with P137 retain its distinct deed, housing, and 19th-resident package and are not causal attribution.',
    '更新P142对照边界');
  source=replaceOnce(source,
    'docs/codex/reports/data/p139-no-deed-campaign.json',
    'docs/codex/reports/data/p142-food-worker-campaign.json',
    'P142原始数据路径');
  fs.mkdirSync(path.dirname(clonedProbe),{recursive:true});
  fs.writeFileSync(clonedProbe,source);

  const result=spawnSync(process.execPath,[clonedProbe],{
    cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024,
    env:{...process.env,P142_REPO_ROOT:root}
  });
  assert.equal(result.status,0,`P142无奖励粮工对照失败：${result.stderr||result.stdout}`);

  const raw=JSON.parse(fs.readFileSync(outputFile,'utf8'));
  assert.equal(raw.batch,'P142');
  assert.equal(raw.noDeedExposure.length,3);
  assert.equal(raw.profiles.length,5);
  const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p139-no-deed-campaign.json'),'utf8'));
  for(const profile of raw.profiles){
    const previous=prior.profiles.find(item=>item.seed===profile.seed);
    assert.ok(previous,`P139缺少种子${profile.seed}`);
    for(const key of ['current','frontloadedMetal']){
      const now=profile.branches.find(item=>item.branch===key);
      const before=previous.branches.find(item=>item.branch===key);
      assert.equal(now.blockedAt,before.blockedAt,`种子${profile.seed}/${key}复跑首败关卡变化`);
      assert.equal(now.wins,before.wins,`种子${profile.seed}/${key}复跑胜场数变化`);
    }
    const food=profile.branches.find(item=>item.branch==='frontloadedFood');
    const afterStage3=food.stages.find(item=>item.stage===3)?.workers;
    if(food.stages.find(item=>item.stage===3)?.win){
      assert.ok(afterStage3,`种子${profile.seed}粮工岗位没有记录产率`);
      assert.ok(afterStage3.rates.food>0,`种子${profile.seed}粮工岗位产率应为正`);
      assert.ok(afterStage3.rates.food>7.425,
        `种子${profile.seed}四名粮工的真实粮产率必须高于同档三名粮工的7.425/秒`);
      assert.equal(afterStage3.rates.wood||0,0,`种子${profile.seed}粮工支线不得投入木工`);
    }
    for(const row of food.stages){
      assert.equal(row.populationBefore,18,`种子${profile.seed}/L${row.stage}人口必须保持18`);
      assert.equal(row.capacityBefore,18,`种子${profile.seed}/L${row.stage}容量必须保持18`);
      assert.equal(row.deedAward,0,`种子${profile.seed}/L${row.stage}不得注入地契`);
      assert.equal(row.deedSpent,0,`种子${profile.seed}/L${row.stage}不得使用地契扩容`);
    }
  }
  raw.batch='P142';
  raw.method='Current worktree CFG/enemies and P102 real production, training, role allocation, tick, battle, loss, ordinary rewards, and replenishment functions. A temporary P102 copy disables only the development candidate first-clear deed injection.';
  raw.scope='No-deed 18-person campaign role comparison. After the stage-3 win, the food branch moves one existing stone worker to food; population and capacity stay 18. Five xorshift32 seeds × three role profiles; 600 simulated online seconds per victory; stop at first loss; no player save.';
  raw.comparisonBoundary='Current and metal profiles match P139 per seed. P142 changes only one stone worker to food after L3 for the food profile. P137 reward-package comparisons remain non-causal because they also add deeds, expand housing, and wait for a 19th resident.';
  for(const profile of raw.profiles){
    const row=profile.branches.find(branch=>branch.branch==='frontloadedFood')?.stages.find(stage=>stage.stage===3);
    if(row?.workers)row.workers.policy='one existing stone worker reassigned to food; keep population at 18';
  }
  delete raw.frontloadedFoodSensitivity;
  raw.inputs.push(
    {file:'tools/verify/probe-live-deed-baseline-p139.js',sha256:sha256('tools/verify/probe-live-deed-baseline-p139.js')},
    {file:'tools/verify/probe-food-worker-campaign-p142.js',sha256:sha256('tools/verify/probe-food-worker-campaign-p142.js')},
    {file:'docs/codex/reports/data/p139-no-deed-campaign.json',sha256:sha256('docs/codex/reports/data/p139-no-deed-campaign.json')}
  );
  fs.writeFileSync(outputFile,JSON.stringify(raw,null,2)+'\n');
  console.log(JSON.stringify({batch:'P142',food:raw.noDeedExposure.find(item=>item.branch==='frontloadedFood'),
    baselineReplays:'P139 current/metal frontiers match for all 5 seeds',rawData:outputFile},null,2));
}finally{
  safeRemoveTemp();
}
