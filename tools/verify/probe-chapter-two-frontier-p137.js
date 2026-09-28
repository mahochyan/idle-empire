'use strict';
// P137 extends the real early P102 campaign through the second chapter to
// measure L10 recovery, L11 onboarding, and the next first-loss frontier.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js'];
const seeds=[1,2,3,42,12345];
const waits=[0,60,180,600];
const branchKeys=['current','frontloadedMetal','frontloadedFood'];
const rosterTarget={infantry:15,archer:13,bronze_guard:15};

function compactReplenishment(value){
  if(!value)return null;
  return{afterArmy:value.afterArmy,remainingQueue:value.remainingQueue,
    queueReasons:value.queueReasons,resources:value.resources};
}

function runSeed(seed){
  const args=[campaignProbe,'--campaign-max-stage=20',`--battle-seed=${seed}`];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  const data=JSON.parse(result.stdout);
  assert.equal(data.batch,'P102');
  assert.equal(data.campaignMaxStage,20);
  assert.equal(data.battleSeed,seed);
  assert.equal(data.results.length,waits.length);

  const windows=data.results.map(window=>{
    assert.ok(waits.includes(window.extraSecondsPerWin));
    const branches=branchKeys.map(key=>{
      const branch=window[key];
      const trace=branch.battleTrace;
      assert.ok(trace.length>0,`种子${seed}/${key}/${window.extraSecondsPerWin}没有战斗轨迹`);
      for(let i=0;i<trace.length;i++)assert.equal(trace[i].stage,i+1,'失败前必须逐关连续推进');
      const rowsByStage=new Map(branch.rows.map(row=>[row.stage,row]));
      const firstLoss=trace.find(row=>!row.win)||null;
      const lateTrace=trace.filter(row=>row.stage>=10).map(row=>{
        const result=rowsByStage.get(row.stage);
        assert.ok(result,`L${row.stage}战斗缺少真实结算记录`);
        return{stage:row.stage,win:row.win,round:row.round,enemy:row.enemy,
          armyBefore:row.armyBefore,armyAfter:row.armyAfter,resourcesBefore:row.resourcesBefore,
          reward:result.reward,replenishment:compactReplenishment(result.replenishment),
          afterTick:result.afterTick};
      });
      const boss=lateTrace.find(row=>row.stage===10)||null;
      if(boss&&boss.win){
        assert.equal(boss.enemy.name,'边境军镇统领');
        assert.equal(boss.enemy.totalTroops,40);
      }
      const bossArmy=boss?.replenishment?.afterArmy||null;
      const bossQueue=boss?.replenishment?.remainingQueue||null;
      const postBossRecovered=!!boss?.win&&!!bossArmy&&
        Object.entries(rosterTarget).every(([unit,count])=>bossArmy[unit]===count)&&
        !!bossQueue&&Object.values(bossQueue).every(count=>count===0);
      return{branch:key,blockedAt:branch.blockedAt,wins:branch.wins,
        highestStageAttempted:trace.at(-1).stage,
        firstLoss:firstLoss?{stage:firstLoss.stage,round:firstLoss.round,
          armyBefore:firstLoss.armyBefore,armyAfter:firstLoss.armyAfter}:null,
        reached:Object.fromEntries(Array.from({length:11},(_,i)=>[10+i,trace.some(row=>row.stage===10+i)])),
        cleared:Object.fromEntries(Array.from({length:11},(_,i)=>[10+i,
          !!trace.find(row=>row.stage===10+i)?.win])),
        postBossRecovered,lateTrace};
    });
    return{extraSecondsPerWin:window.extraSecondsPerWin,branches};
  });
  return{seed,entry:{tick:data.entryState.tick,population:data.entryState.population,
    capacity:data.entryState.capacity,army:data.entryState.army,resources:data.entryState.resources,
    workers:data.entryState.workers},windows};
}

const profiles=seeds.map(runSeed);
const exposure=waits.map(seconds=>{
  const branches=profiles.flatMap(profile=>profile.windows
    .find(window=>window.extraSecondsPerWin===seconds).branches
    .map(branch=>({seed:profile.seed,...branch})));
  return{extraSecondsPerWin:seconds,branches:branches.length,
    reachedCounts:Object.fromEntries(Array.from({length:11},(_,i)=>{
      const stage=10+i;return[stage,branches.filter(branch=>branch.reached[stage]).length];
    })),
    clearedCounts:Object.fromEntries(Array.from({length:11},(_,i)=>{
      const stage=10+i;return[stage,branches.filter(branch=>branch.cleared[stage]).length];
    })),
    postBossFullyRecovered:branches.filter(branch=>branch.postBossRecovered).length,
    firstLosses:Object.fromEntries([...new Set(branches.map(branch=>branch.firstLoss?.stage)
      .filter(stage=>stage!==undefined))].sort((a,b)=>a-b).map(stage=>[
        stage,branches.filter(branch=>branch.firstLoss?.stage===stage).length]))};
});

const reference=profiles.find(profile=>profile.seed===3)
  .windows.find(window=>window.extraSecondsPerWin===600)
  .branches.find(branch=>branch.branch==='frontloadedFood');
const boss10=reference.lateTrace.find(row=>row.stage===10);
const postBoss=reference.lateTrace.find(row=>row.stage===11);
assert.equal(reference.blockedAt,16,'参考早期支线应在L16首次失败');
assert.equal(boss10.win,true);
assert.equal(boss10.round,7);
assert.deepEqual(boss10.armyBefore,{infantry:15,archer:7,bronze_guard:15});
assert.deepEqual(boss10.armyAfter,{infantry:15,archer:0,bronze_guard:1});
assert.deepEqual(boss10.replenishment.afterArmy,rosterTarget,
  'L10胜后600秒真实训练应补回目标兵力');
assert.ok(Object.values(boss10.replenishment.remainingQueue).every(count=>count===0),
  'L10胜后600秒窗口结束时不能遗留补训队列');
assert.equal(postBoss.win,true,'补回后的队伍应能进入并通过L11');
assert.equal(postBoss.round,1);
assert.deepEqual(postBoss.armyBefore,rosterTarget);
assert.deepEqual(postBoss.armyAfter,rosterTarget,'L11通关不应造成战损');

const inputs=inputFiles.map(file=>({file,sha256:crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root,file))).digest('hex')}));
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
const artifact={batch:'P137',unit:'simulated online seconds; people; resources; soldiers; stages; enemy units/HP/weighted attack',
  method:'P102 real 18-person zero-win route; real production, training, role allocation, tick, battle, rewards, and replenishment; xorshift32 seeds 1, 2, 3, 42, 12345; stages 1-20; stop at first loss; no player save',
  scope:'5 deterministic seeds × 3 reward/worker sensitivity branches × 4 per-win recovery windows; stage 10-20 actual combat and post-win replenishment details; route sensitivity, not player win-rate estimates',
  recoveryBoundary:'P102 queues replacement troops to 15 infantry / 13 archer / 15 bronze guard after each victory from stage 3 onward; this is a fixed recovery scenario, not an inferred player schedule',
  rewardBoundary:'P102 injects a development-only first-clear deed model (ceil(stage/10), plus 6 deeds after stage 3 on the frontloaded branches) and uses real settlement upgrade actions with those candidate deeds. This is not enabled in live game code and is not the complete proposed P15 formula.',
  sourceHead:head,inputs,seeds,waits,exposure,profiles};
const rawPath=path.join(root,'docs/codex/reports/data/p137-chapter-two-campaign-frontier.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P137',reference:{seed:3,branch:'frontloadedFood',waitSeconds:600,
  stage10:{win:boss10.win,round:boss10.round,armyBefore:boss10.armyBefore,armyAfter:boss10.armyAfter,
    recovery:boss10.replenishment},
  stage11:{win:postBoss.win,round:postBoss.round,armyBefore:postBoss.armyBefore,armyAfter:postBoss.armyAfter},
  firstLossStage:reference.blockedAt},exposure,rawData:rawPath},null,2));
