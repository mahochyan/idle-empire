'use strict';
// P141 reruns P139's isolated no-deed campaign with a fourth 18-worker
// allocation: one stone worker moves to wood after a stage-3 win.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p141-'));
const clonedProbe=path.join(tempRoot,'tools/verify/probe-no-deed-wood-campaign-p141-inner.js');
const outputFile=path.join(root,'docs/codex/reports/data/p141-no-deed-wood-campaign.json');

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P139结构变化，找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P139结构变化，${label}不再唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function safeRemoveTemp(){
  const tempBase=fs.realpathSync(os.tmpdir());
  const resolved=path.resolve(tempRoot);
  assert.equal(path.dirname(resolved),tempBase,'P141临时副本必须是系统临时目录的直接子目录');
  assert.ok(path.basename(resolved).startsWith('idle-empire-p141-'),'P141临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}
function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}

try{
  let source=fs.readFileSync(path.join(root,'tools/verify/probe-live-deed-baseline-p139.js'),'utf8');
  source=replaceOnce(source,
    "const root=path.resolve(__dirname,'../..');",
    'const root=process.env.P141_REPO_ROOT;',
    '由P141传入真实工作区');
  source=replaceOnce(source,
    "const branchKeys=['current','frontloadedMetal','frontloadedFood'];",
    "const branchKeys=['current','frontloadedMetal','frontloadedFood','frontloadedWood'];",
    '添加无奖励木工支线');
  source=replaceOnce(source,
    "const args=[tempProbe,'--campaign-max-stage=20',",
    "const args=[tempProbe,'--include-wood-branch','--campaign-max-stage=20',",
    '启用P102木工分支');
  source=replaceOnce(source,
    ':woodPolicy?{stone:6,food:3,coal:6,copper:3}',
    ':woodPolicy?{wood:1,stone:5,food:3,coal:6,copper:3}',
    '将一个石工改为木工但保持18人总岗数');
  source=source.replace(/batch:'P139'/g,"batch:'P141'");
  assert.ok(source.includes("batch:'P141'"),'P141批次标记未更新');
  source=replaceOnce(source,
    'No-deed baseline for the P137 candidate deed route. The current-role branch is closest to the current 18-person route; frontloaded branches preserve role-sensitivity with 18 workers and do not create a 19th resident.',
    'No-deed 18-person campaign role comparison. The fourth branch moves one worker from stone to wood after a stage-3 win; all branches keep 18 residents and capacity, and no first-clear deeds are injected.',
    '更新P141范围说明');
  source=replaceOnce(source,
    'Five xorshift32 seeds × three 18-worker role profiles; 600 simulated online seconds per victory;',
    'Five xorshift32 seeds × four 18-worker role profiles; 600 simulated online seconds per victory;',
    '更新P141路线数量');
  source=replaceOnce(source,
    'docs/codex/reports/data/p139-no-deed-campaign.json',
    'docs/codex/reports/data/p141-no-deed-wood-campaign.json',
    'P141原始数据路径');
  fs.mkdirSync(path.dirname(clonedProbe),{recursive:true});
  fs.writeFileSync(clonedProbe,source);

  const result=spawnSync(process.execPath,[clonedProbe],{
    cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024,
    env:{...process.env,P141_REPO_ROOT:root}
  });
  assert.equal(result.status,0,`P141无奖励木工对照失败：${result.stderr||result.stdout}`);

  const raw=JSON.parse(fs.readFileSync(outputFile,'utf8'));
  assert.equal(raw.batch,'P141');
  assert.equal(raw.noDeedExposure.length,4);
  assert.equal(raw.profiles.length,5);
  const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p139-no-deed-campaign.json'),'utf8'));
  for(const profile of raw.profiles){
    const previous=prior.profiles.find(item=>item.seed===profile.seed);
    assert.ok(previous,`P139缺少种子${profile.seed}`);
    for(const key of ['current','frontloadedMetal','frontloadedFood']){
      const now=profile.branches.find(item=>item.branch===key);
      const before=previous.branches.find(item=>item.branch===key);
      assert.equal(now.blockedAt,before.blockedAt,`种子${profile.seed}/${key}复跑首败关卡变化`);
      assert.equal(now.wins,before.wins,`种子${profile.seed}/${key}复跑胜场数变化`);
    }
    const wood=profile.branches.find(item=>item.branch==='frontloadedWood');
    const afterStage3=wood.stages.find(item=>item.stage===3)?.workers;
    if(wood.stages.find(item=>item.stage===3)?.win){
      assert.ok(afterStage3,`种子${profile.seed}木工岗位没有记录产率`);
      assert.match(afterStage3.policy,/wood/);
      assert.ok(afterStage3.rates.wood>0,`种子${profile.seed}木工岗位产率应为正`);
    }
    for(const row of wood.stages){
      assert.equal(row.populationBefore,18,`种子${profile.seed}/L${row.stage}人口必须保持18`);
      assert.equal(row.capacityBefore,18,`种子${profile.seed}/L${row.stage}容量必须保持18`);
      assert.equal(row.deedAward,0,`种子${profile.seed}/L${row.stage}不得注入地契`);
      assert.equal(row.deedSpent,0,`种子${profile.seed}/L${row.stage}不得使用地契扩容`);
    }
  }
  raw.inputs.push(
    {file:'tools/verify/probe-live-deed-baseline-p139.js',sha256:sha256('tools/verify/probe-live-deed-baseline-p139.js')},
    {file:'tools/verify/probe-no-deed-wood-campaign-p141.js',sha256:sha256('tools/verify/probe-no-deed-wood-campaign-p141.js')},
    {file:'docs/codex/reports/data/p139-no-deed-campaign.json',sha256:sha256('docs/codex/reports/data/p139-no-deed-campaign.json')}
  );
  fs.writeFileSync(outputFile,JSON.stringify(raw,null,2)+'\n');
  console.log(JSON.stringify({batch:'P141',wood:raw.noDeedExposure.find(item=>item.branch==='frontloadedWood'),
    baselineReplays:'P139 current/metal/food frontiers match for all 5 seeds',rawData:outputFile},null,2));
}finally{
  safeRemoveTemp();
}
