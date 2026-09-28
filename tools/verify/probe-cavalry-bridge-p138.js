'use strict';
// P138 tests whether the existing post-Boss route can reach and use the real
// T1 cavalry unlock. It patches only an ephemeral copy of the P102 dev probe;
// shipped game modules and the shared P102 probe are copied byte-for-byte.
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
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'idle-empire-p138-'));
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
  assert.ok(path.basename(resolved).startsWith('idle-empire-p138-'),'临时清理路径前缀不匹配');
  fs.rmSync(resolved,{recursive:true,force:true});
}

try{
  for(const file of files){
    const destination=path.join(tempRoot,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(root,file),destination);
  }

  let source=fs.readFileSync(tempProbe,'utf8');
  source=replaceOnce(source,
    'const rosterTarget={infantry:15,archer:13,bronze_guard:15};',
    "const rosterTarget={infantry:15,archer:13,bronze_guard:15,...(process.argv.includes('--p138-cavalry')?{cavalry_t1:1}:{})};",
    '标准兵力目标');
  source=replaceOnce(source,
    "    let bronze=run('S.pool.bronze_guard||0');",
    "    let cavalry=run('S.pool.cavalry_t1||0');\n    for(let i=0;i<run(\"rowSlots('front')\")&&cavalry>0;i++){\n      const n=Math.min(run('regMax()'),cavalry);place('front','cavalry_t1',n,i);cavalry-=n;\n    }\n    let bronze=run('S.pool.bronze_guard||0');",
    '骑兵优先编入前排');
  source=replaceOnce(source,
    "      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;",
    "      if(run(`S.formation.front[${i}]`))continue;\n      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;",
    '编队时跳过已占槽位');
  const bronzeCount="bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard')";
  const cavalryCount="bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard'),cavalry_t1:(S.pool.cavalry_t1||0)+expeditionCount('cavalry_t1')";
  assert.ok(source.includes(bronzeCount),'P102探针缺少战斗兵种计数');
  source=source.split(bronzeCount).join(cavalryCount);
  source=replaceOnce(source,
    "    for(const [type,target] of Object.entries(rosterTarget)){\n      const queued=run(`S.queue['${type}']?.count||0`);",
    "    for(const [type,target] of Object.entries(rosterTarget)){\n      if(type==='cavalry_t1'&&!run('S.upgradedUnits.cavalry_t1'))continue;\n      const queued=run(`S.queue['${type}']?.count||0`);",
    '未解锁前跳过骑兵补训');
  source=replaceOnce(source,
    '  const rows=[];\n  for(let stage=1;stage<=campaignMaxStage;stage++){\n    const fought=battle(stage);',
    `  const rows=[];\n  const p138Setup=[];\n  for(let stage=1;stage<=campaignMaxStage;stage++){\n    if(process.argv.includes('--p138-cavalry')&&stage===12){\n      const before=run(\"({population:popCurrent(),capacity:maxPop(),workers:{...S.popAlloc},resources:{...S.res},tech:S.res.tech,merit:S.merit,bosses:bossDefeatedCount(),stableLevel:bldSt('stable').lv,army:{infantry:(S.pool.infantry||0)+expeditionCount('infantry')+garrisonCount('infantry'),archer:(S.pool.archer||0)+expeditionCount('archer')+garrisonCount('archer'),bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard')+garrisonCount('bronze_guard')}})\");\n      const build=checked(run,\"buildAct('stable')\",'P138建设骑兵训练场');\n      for(let i=0;i<7;i++)run('tick()');\n      const completedBuilding=run(\"({...bldSt('stable')})\");\n      const unlock=run(\"unlockUnitRoot('cavalry_t1')\");\n      assert.equal(unlock?.ok,true,\"P138真实侍从骑士解锁失败：\"+JSON.stringify(unlock));\n      const afterUnlock=run(\"({resources:{...S.res},tech:S.res.tech,merit:S.merit,unlocked:S.upgradedUnits.cavalry_t1,lock:trainLockReason('cavalry_t1'),cap:unitCap('cavalry_t1')})\");\n      const train=checked(run,\"train('cavalry_t1',1)\",'P138训练首名侍从骑士');\n      let trainingSeconds=0;\n      while(run('(S.pool.cavalry_t1||0)<1')&&trainingSeconds<1000){run('tick()');trainingSeconds++;}\n      assert.equal(run('(S.pool.cavalry_t1||0)'),1,'P138骑兵训练未在1000秒内完成');\n      p138Setup.push({stage,before,build,completedBuilding,unlock,afterUnlock,train,trainingSeconds,\n        trainedAtTick:run('S.tick'),poolCount:run('S.pool.cavalry_t1||0'),queueCount:run(\"S.queue.cavalry_t1?.count||0\"),\n        productionCost:run(\"({...CFG.units.cavalry_t1.cost})\"),unitCap:run(\"unitCap('cavalry_t1')\"),\n        formationSlots:run(\"rowSlots('front')\")});\n    }\n    const fought=battle(stage);`,
    'L12真实骑兵建筑、解锁与训练动作');
  source=replaceOnce(source,
    '  if(getSessionStats)branch.sessionClock=getSessionStats();\n  return branch;',
    "  if(process.argv.includes('--p138-cavalry'))branch.p138Setup=p138Setup;\n  if(getSessionStats)branch.sessionClock=getSessionStats();\n  return branch;",
    '记录骑兵设置结果');
  fs.writeFileSync(tempProbe,source);

  const args=[tempProbe,'--campaign-max-stage=20','--battle-seed=3','--wait-windows=600','--p138-cavalry'];
  const result=spawnSync(process.execPath,args,{cwd:tempRoot,encoding:'utf8',maxBuffer:64*1024*1024});
  assert.equal(result.status,0,`临时P102骑兵路线失败：${result.stderr||result.stdout}`);
  const replay=JSON.parse(result.stdout);
  assert.equal(replay.batch,'P102');
  assert.equal(replay.battleSeed,3);
  const candidate=replay.results[0].frontloadedFood;
  assert.equal(candidate.p138Setup.length,1,'只有通过L11的食物策略支线应执行骑兵解锁');
  const setup=candidate.p138Setup[0];
  assert.equal(setup.stage,12);
  assert.equal(setup.before.bosses,1,'L10 Boss胜利应满足骑兵训练场建造门槛');
  assert.equal(setup.build.ok,true);
  assert.equal(setup.completedBuilding.lv,1,'真实tick应完成7秒建造');
  assert.equal(setup.unlock.ok,true);
  assert.equal(setup.afterUnlock.unlocked,true);
  assert.equal(setup.afterUnlock.lock,'','解锁后训练门槛应全部开放');
  assert.equal(setup.train.ok,true);
  assert.equal(setup.poolCount,1);
  assert.equal(setup.queueCount,0);

  const p137Path=path.join(root,'docs/codex/reports/data/p137-chapter-two-campaign-frontier.json');
  const p137=JSON.parse(fs.readFileSync(p137Path,'utf8'));
  const baseline=p137.profiles.find(profile=>profile.seed===3).windows
    .find(window=>window.extraSecondsPerWin===600).branches.find(branch=>branch.branch==='frontloadedFood');
  assert.equal(baseline.blockedAt,16,'P137基线首次失败关应为L16');
  const baselineL10L11=baseline.lateTrace.filter(row=>row.stage===10||row.stage===11);
  const actualL10L11=candidate.rows.filter(row=>row.stage===10||row.stage===11);
  const originalRoster=units=>Object.fromEntries(['infantry','archer','bronze_guard'].map(key=>[key,units[key]]));
  assert.deepEqual(actualL10L11.map(row=>({stage:row.stage,win:row.win,round:row.round,
    before:originalRoster(row.byTypeBefore),after:originalRoster(row.byTypeAfter)})),
    baselineL10L11.map(row=>({stage:row.stage,win:row.win,round:row.round,
    before:row.armyBefore,after:row.armyAfter})),
    '骑兵测试必须保持L10/L11入口与P137基线相同');

  const enemyByStage=new Map(candidate.battleTrace.map(row=>[row.stage,row.enemy]));
  const route=candidate.rows.filter(row=>row.stage>=12).map(row=>({stage:row.stage,win:row.win,round:row.round,
    enemy:{name:enemyByStage.get(row.stage).name,totalTroops:enemyByStage.get(row.stage).totalTroops,
      totalHp:enemyByStage.get(row.stage).totalHp,weightedAttack:enemyByStage.get(row.stage).troopWeightedAttack},
    byTypeBefore:row.byTypeBefore,byTypeAfter:row.byTypeAfter,
    populationBefore:row.populationBefore,capacityBefore:row.capacityBefore,
    reward:row.reward,
    resourcesBefore:{wood:row.resourcesBefore.wood,stone:row.resourcesBefore.stone,food:row.resourcesBefore.food},
    replenishment:row.replenishment?{afterArmy:row.replenishment.afterArmy,
      remainingQueue:row.replenishment.remainingQueue,resources:row.replenishment.resources}:null}));
  const stage12=route.find(row=>row.stage===12);
  assert.equal(stage12.byTypeBefore.cavalry_t1,1,'骑兵必须通过真实编队与battle入口参与L12');
  assert.equal(route.find(row=>row.stage===16)?.win,true,'一名真实训练并编队的骑兵应使本种子L16获胜');
  assert.equal(candidate.blockedAt,17,'骑兵桥接路线应把本种子首败推进到L17');
  assert.equal(candidate.blockedAt,route.find(row=>!row.win)?.stage||null);

  const inputs=files.filter(file=>!file.startsWith('tools/verify/')).map(file=>({file,sha256:sha256(file)}));
  inputs.push({file:'tools/verify/probe-population-first-clear-replenish-p102.js',sha256:sha256('tools/verify/probe-population-first-clear-replenish-p102.js')});
  inputs.push({file:'tools/verify/probe-population-early-18.js',sha256:sha256('tools/verify/probe-population-early-18.js')});
  const artifact={batch:'P138',unit:'simulated online seconds; resources; soldiers; enemy units/HP/weighted attack',
    method:'P102 zero-win population-route harness; seed 3; 600 simulated online seconds after each victory; at stage 12 use actual buildAct(stable), seven real ticks, unlockUnitRoot(cavalry_t1), train(cavalry_t1,1), real training ticks, formation, battle, losses, and replenishment. P102 plus runtime modules are copied to a guarded OS temporary directory; only the temporary P102 probe source is instrumented. No player save.',
    scope:'One deterministic route sensitivity to test whether the existing T1 cavalry bridge is available after L11; not a player win-rate estimate and not an enemy-balance conclusion.',
    rewardBoundary:'The P102 harness injects a development-only first-clear deed model (ceil(stage/10), plus 6 deeds after stage 3 on the frontloaded branches) and performs real settlement upgrades with those candidate deeds. This reward is not enabled in live game code and is not the complete proposed P15 formula; population and resource milestones here are conditional on that harness model.',
    baseline:{batch:'P137',seed:3,branch:'frontloadedFood',waitSeconds:600,firstLossStage:baseline.blockedAt,
      throughL11:baselineL10L11.map(row=>({stage:row.stage,win:row.win,round:row.round,
        armyBefore:row.armyBefore,armyAfter:row.armyAfter}))},
    actualUnlockAndTraining:setup,stages12Plus:route,firstLossStage:candidate.blockedAt,
    inputs,sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim()};
  const outPath=path.join(root,'docs/codex/reports/data/p138-cavalry-bridge.json');
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({batch:'P138',setup:{building:setup.completedBuilding.lv,unlocked:setup.afterUnlock.unlocked,
    cavalryCap:setup.unitCap,trained:setup.poolCount,trainingSeconds:setup.trainingSeconds},
    route:route.map(row=>({stage:row.stage,win:row.win,round:row.round,population:row.populationBefore,
      capacity:row.capacityBefore,cavalry:row.byTypeBefore.cavalry_t1,
      infantry:row.byTypeBefore.infantry,archer:row.byTypeBefore.archer,bronze_guard:row.byTypeBefore.bronze_guard,
      deedAward:row.reward.award,deedSpent:row.reward.spent,
      casualties:Object.fromEntries(Object.keys(row.byTypeBefore).map(key=>[key,
        row.byTypeBefore[key]-row.byTypeAfter[key]]))})),firstLossStage:candidate.blockedAt,rawData:outPath},null,2));
}finally{
  safeRemoveTemp();
}
