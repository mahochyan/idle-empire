'use strict';
// P143 tests food-worker hysteresis after each recovery window against P142's
// static food profile. It patches only temporary developer probes.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p143-'));
const clonedProbe=path.join(tempRoot,'tools/verify/probe-adaptive-food-workers-p143-inner.js');
const outputFile=path.join(root,'docs/codex/reports/data/p143-adaptive-food-campaign.json');

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P139/P102结构变化，找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P139/P102结构变化，${label}不再唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function safeRemoveTemp(){
  const tempBase=fs.realpathSync(os.tmpdir());
  const resolved=path.resolve(tempRoot);
  assert.equal(path.dirname(resolved),tempBase,'P143临时副本必须是系统临时目录的直接子目录');
  assert.ok(path.basename(resolved).startsWith('idle-empire-p143-'),'P143临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}

try{
  let source=fs.readFileSync(path.join(root,'tools/verify/probe-live-deed-baseline-p139.js'),'utf8');
  source=replaceOnce(source,
    "const root=path.resolve(__dirname,'../..');",
    'const root=process.env.P143_REPO_ROOT;',
    '由P143传入真实工作区');
  source=replaceOnce(source,
    "const workers=foodPolicy?{stone:6,food:3,coal:6,copper:3}\\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3}\\n          :{stone:5,food:2,coal:7,copper:4};",
    "const workers=foodPolicy?{stone:5,food:4,coal:6,copper:3}\\n        :woodPolicy?{stone:6,food:3,coal:6,copper:3}\\n          :{stone:5,food:2,coal:7,copper:4};",
    '给粮工支线相同的18岗起点');
  source=source.replace(/batch:'P139'/g,"batch:'P143'");
  assert.ok(source.includes("batch:'P143'"),'P143批次标记未更新');
  source=replaceOnce(source,
    'No-deed baseline for the P137 candidate deed route. The current-role branch is closest to the current 18-person route; frontloaded branches preserve role-sensitivity with 18 workers and do not create a 19th resident.',
    'No-deed 18-person campaign comparison. The food branch adds one stone-to-food worker after L3. After each 600-second replenishment window and before the next battle, food below 100 assigns four food workers; food at or above 400 returns to three; between thresholds the allocation holds. All branches keep 18 residents and inject no first-clear deeds.',
    '更新P143范围说明');
  source=replaceOnce(source,
    'The matched current-role branch starts identically and has the same first-loss stage/win count for all five seeds under P137 base deeds and P139 no deeds. The frontloaded-food comparison changes a package: P137 adds six L3 deeds, buys housing, waits for resident 19, and changes roles; it is not deed-only attribution.',
    'Current and metal profiles replay P139 per seed. The P143 food branch checks stock after each 600-second recovery window and before the next battle: below 100 food switch to four food workers; at or above 400 return to three; between thresholds keep the current role. P137 reward-package comparisons remain non-causal because they include deeds, housing, and a 19th resident.',
    '更新P143对照边界');
  source=replaceOnce(source,
    'workers:row.workforceChange?.rates?row.workforceChange:null,',
    'workers:row.workforceChange?.rates?row.workforceChange:null,workersAfterRecovery:row.workersAfterRecovery||null,adaptiveRoleChanges:row.adaptiveRoleChanges||[],',
    '保留逐窗调岗记录');
  const p143WaitNeedle="    run(`for(let i=0;i<${seconds};i++)tick()`);";
  const p143WaitReplacement=[
    "    run(`for(let i=0;i<${seconds};i++)tick()`);",
    "    if(rewardMode==='frontloaded-food'&&seconds>=600){",
    "      const foodBefore=run('S.res.food');",
    "      const workersBefore=run('({...S.popAlloc})');",
    "      const foodWorkersBefore=workersBefore.food||0;",
    "      const foodWorkersAfter=foodBefore<100?4:foodBefore>=400?3:foodWorkersBefore;",
    "      const action=foodWorkersAfter===foodWorkersBefore?'hold':'switch';",
    "      if(action==='switch'){",
    "        const next={...workersBefore,food:foodWorkersAfter,stone:(workersBefore.stone||0)+foodWorkersBefore-foodWorkersAfter};",
    "        assert.equal(Object.values(next).reduce((sum,value)=>sum+value,0),18,'P143调岗必须保持18人');",
    "        assign(run,next);",
    "      }",
    "      p143AdaptiveRoleChanges.push({afterStage:run('S.defeated.length'),foodBefore,foodWorkersBefore,foodWorkersAfter,action});",
    "    }"
  ].join('\n');
  const adaptivePatch=[
    '  source=replaceOnce(source,',
    `    ${JSON.stringify(p143WaitNeedle)},`,
    `    ${JSON.stringify(p143WaitReplacement)},`,
    "    '在600秒恢复窗结束后按粮食阈值调岗');",
    '  source=replaceOnce(source,',
    '    "const rows=[];",',
    '    "const rows=[];const p143AdaptiveRoleChanges=[];",',
    "    '初始化P143调岗轨迹');",
    '  source=replaceOnce(source,',
    '    "rows.push({...fought,reward,workforceChange,replenishment,afterTick:run(\'S.tick\')});",',
    '    "rows.push({...fought,reward,workforceChange,replenishment,workersAfterRecovery:run(\'({...S.popAlloc})\'),adaptiveRoleChanges:p143AdaptiveRoleChanges.splice(0),afterTick:run(\'S.tick\')});",',
    "    '保留恢复后岗位');",
    '  source=replaceOnce(source,',
    '    "workforceChange:r.workforceChange,replenishment:r.replenishment,",',
    '    "workforceChange:r.workforceChange,replenishment:r.replenishment,workersAfterRecovery:r.workersAfterRecovery,adaptiveRoleChanges:r.adaptiveRoleChanges,",',
    "    '在P102输出行透传岗位轨迹');",
    '  fs.writeFileSync(tempProbe,source);'
  ].join('\n');

  source=replaceOnce(source,
    '  fs.writeFileSync(tempProbe,source);',
    adaptivePatch,
    '在隔离P102副本中加入P143调岗策略');
  source=replaceOnce(source,
    'docs/codex/reports/data/p139-no-deed-campaign.json',
    'docs/codex/reports/data/p143-adaptive-food-campaign.json',
    'P143原始数据路径');
  fs.mkdirSync(path.dirname(clonedProbe),{recursive:true});
  fs.writeFileSync(clonedProbe,source);

  const result=spawnSync(process.execPath,[clonedProbe],{
    cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024,
    env:{...process.env,P143_REPO_ROOT:root}
  });
  assert.equal(result.status,0,`P143粮食阈值调岗对照失败：${result.stderr||result.stdout}`);

  const raw=JSON.parse(fs.readFileSync(outputFile,'utf8'));
  assert.equal(raw.batch,'P143');
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
    for(const row of food.stages){
      assert.equal(row.populationBefore,18,`种子${profile.seed}/L${row.stage}人口必须保持18`);
      assert.equal(row.capacityBefore,18,`种子${profile.seed}/L${row.stage}容量必须保持18`);
      assert.equal(row.deedAward,0,`种子${profile.seed}/L${row.stage}不得注入地契`);
      assert.equal(row.deedSpent,0,`种子${profile.seed}/L${row.stage}不得使用地契扩容`);
      assert.ok(row.workersAfterRecovery,`种子${profile.seed}/L${row.stage}缺少恢复后岗位记录`);
      const total=Object.values(row.workersAfterRecovery).reduce((sum,value)=>sum+value,0);
      assert.equal(total,18,`种子${profile.seed}/L${row.stage}恢复后岗位总数必须为18`);
      assert.ok([3,4].includes(row.workersAfterRecovery.food),
        `种子${profile.seed}/L${row.stage}粮工数必须遵循3/4工阈值策略`);
      for(const change of row.adaptiveRoleChanges){
        if(change.action==='switch'){
          assert.ok(change.foodBefore<100||change.foodBefore>=400,
            `种子${profile.seed}/L${row.stage}调岗触发值必须位于阈值区外`);
          assert.equal(change.foodWorkersAfter,change.foodBefore<100?4:3,
            `种子${profile.seed}/L${row.stage}调岗目标不符合阈值策略`);
        }
      }
    }
  }
  raw.batch='P143';
  raw.method='Current worktree CFG/enemies and P102 real production, training, role allocation, tick, battle, loss, ordinary rewards, and replenishment functions. A temporary P102 copy checks food-worker hysteresis after each post-victory 600-second recovery window.';
  raw.scope='No-deed 18-person campaign role comparison. After the L3 win, the food branch starts with one stone worker moved to food. After each 600-second replenishment window and before the next battle, food below 100 switches to four food workers; at or above 400 returns to three; between thresholds the current allocation stays. Five xorshift32 seeds × three profiles; stop at first loss; no player save.';
  raw.comparisonBoundary='Current and metal profiles match P139 per seed. P143 differs from P142 by checkpoint-based food-role hysteresis; no first-clear deeds, housing expansion, or 19th resident are used.';
  delete raw.frontloadedFoodSensitivity;
  raw.inputs.push(
    {file:'tools/verify/probe-live-deed-baseline-p139.js',sha256:sha256('tools/verify/probe-live-deed-baseline-p139.js')},
    {file:'tools/verify/probe-adaptive-food-workers-p143.js',sha256:sha256('tools/verify/probe-adaptive-food-workers-p143.js')},
    {file:'docs/codex/reports/data/p139-no-deed-campaign.json',sha256:sha256('docs/codex/reports/data/p139-no-deed-campaign.json')},
    {file:'docs/codex/reports/data/p142-food-worker-campaign.json',sha256:sha256('docs/codex/reports/data/p142-food-worker-campaign.json')}
  );
  fs.writeFileSync(outputFile,JSON.stringify(raw,null,2)+'\n');
  console.log(JSON.stringify({batch:'P143',food:raw.noDeedExposure.find(item=>item.branch==='frontloadedFood'),
    adaptiveChanges:raw.profiles.map(profile=>({seed:profile.seed,changes:profile.branches
      .find(branch=>branch.branch==='frontloadedFood').stages.flatMap(stage=>stage.adaptiveRoleChanges)})),
    baselineReplays:'P139 current/metal frontiers match for all 5 seeds',rawData:outputFile},null,2));
}finally{
  safeRemoveTemp();
}
