'use strict';
// P120: compare the same post-stage-3 +6 deed candidate when its new resident
// works food versus wood; all outcomes use the real P102 campaign harness.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const seeds=[1,2,3,42,12345];

function childJson(seed){
  const args=[campaignProbe,'--campaign-max-stage=10',`--battle-seed=${seed}`,'--include-wood-branch'];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}

const profiles=seeds.map(seed=>{
  const data=childJson(seed);
  assert.equal(data.battleSeed,seed);
  assert.equal(data.campaignMaxStage,10);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  const window=data.results.find(row=>row.extraSecondsPerWin===600);
  assert.ok(window?.frontloadedFood&&window?.frontloadedWood);
  const branches=['frontloadedFood','frontloadedWood'].map(key=>{
    const branch=window[key];
    assert.ok(branch.battleTrace.length>0);
    const stage3=branch.rows.find(row=>row.stage===3);
    assert.equal(stage3?.win,true,'两个比较支线须都先实际赢第3关');
    assert.equal(stage3.reward.spent,9,'+6地契扩容的真实付款必须为9');
    assert.equal(stage3.populationBefore,18);
    assert.equal(stage3.capacityBefore,18);
    if(key==='frontloadedWood'){
      assert.equal(stage3.workforceChange?.policy,
        'new worker assigned to wood; preserve the previous 18-person production mix');
      assert.ok(stage3.workforceChange.rates.wood>0);
    }
    const stages=branch.rows.filter(row=>row.stage>=3);
    if(key==='frontloadedWood')for(const row of stages)if(row.replenishment)
      assert.equal(row.replenishment.remainingQueue.archer,0,
        `木工支线第${row.stage}关胜后仍有猎人因木料不足未补齐`);
    return{branch:key,wins:branch.wins,blockedAt:branch.blockedAt,
      highestStageAttempted:branch.battleTrace.at(-1).stage,
      stages:stages.map(row=>({stage:row.stage,win:row.win,
        round:row.round,armyBefore:row.byTypeBefore,armyAfter:row.byTypeAfter,
        workforceChange:row.workforceChange,
        replenishment:row.replenishment?{beforeQueue:row.replenishment.beforeQueue,
          afterArmy:row.replenishment.afterArmy,queued:row.replenishment.queuedAtStart,
          remaining:row.replenishment.remainingQueue,reasons:row.replenishment.queueReasons,
          resources:row.replenishment.resources}:null}))};
  });
  return{seed,entry:{tick:data.entryState.tick,population:data.entryState.population,
    capacity:data.entryState.capacity,army:data.entryState.army,workers:data.entryState.workers,
    resources:data.entryState.resources},branches};
});

const reachedCounts=Object.fromEntries([7,8,9,10].map(stage=>[
  stage,profiles.reduce((count,profile)=>count+profile.branches.filter(branch=>
    branch.stages.some(row=>row.stage===stage)).length,0)]));
const summary=Object.fromEntries(['frontloadedFood','frontloadedWood'].map(key=>{
  const branches=profiles.map(profile=>profile.branches.find(branch=>branch.branch===key));
  return[key,{reachedCounts:Object.fromEntries([7,8,9,10].map(stage=>[
    stage,branches.filter(branch=>branch.stages.some(row=>row.stage===stage)).length])),
    totalClearedStages:branches.reduce((sum,branch)=>sum+branch.wins,0),
    firstLosses:Object.fromEntries([4,6,7,8,9,10].map(stage=>[
      stage,branches.filter(branch=>branch.blockedAt===stage).length]).filter(([,count])=>count>0)),
    archerQueueAfterWins:branches.flatMap(branch=>branch.stages.filter(row=>row.replenishment)
      .map(row=>({stage:row.stage,remaining:row.replenishment.remaining.archer,
        wood:row.replenishment.resources.wood,food:row.replenishment.resources.food}))) }];
}));

const artifact={batch:'P120',
  unit:'simulated online seconds; villagers; wood/food/metal stocks; trained soldiers; campaign stage and casualties',
  method:'P102 real zero-win 18-person preparation, real candidate deed settlement and village expansion, real 19th birth, workforce assignment, production, training, campaign battle, reward and replenishment; xorshift32 seeds 1, 2, 3, 42 and 12345',
  scope:'compare only the 600 simulated online seconds per win window: after the stage-3 win both branches simulate +6 deed, spend 9 deed to expand village capacity 18→19, wait 10 seconds for natural birth, then assign the added resident either to food or wood while preserving the same prior 18-person allocation; each route stops at its first loss; this is a candidate sensitivity, not current reward behavior or a player win-rate estimate',
  branches:{frontloadedFood:'new resident assigned to food; baseline stone 6 / food 3 / coal 6 / copper 3 becomes stone 6 / food 4 / coal 6 / copper 3',
    frontloadedWood:'new resident assigned to wood; baseline stone 6 / food 3 / coal 6 / copper 3 remains, plus wood 1'},
  reachedCounts,seeds,summary,profiles};
const rawPath=path.join(root,'docs/codex/reports/data/p120-wood-worker-campaign.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P120',reachedCounts,summary,rawData:rawPath},null,2));
