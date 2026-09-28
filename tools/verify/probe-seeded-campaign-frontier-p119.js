'use strict';
// P119: extend the real P102 first-clear/replenishment route from six to ten
// stages, recording late-stage first-clear and recovery pressure without
// relabeling deterministic streams as player win rates.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const seeds=[1,2,3,42,12345];
const branchKeys=['current','frontloadedMetal','frontloadedFood'];
const waits=[0,60,180,600];

function childJson(seed){
  const args=[campaignProbe,'--campaign-max-stage=10',`--battle-seed=${seed}`];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}

const profiles=seeds.map(seed=>{
  const data=childJson(seed);
  assert.equal(data.battleSeed,seed);
  assert.equal(data.campaignMaxStage,10);
  assert.equal(data.results.length,waits.length);
  const windows=data.results.map(window=>{
    assert.ok(waits.includes(window.extraSecondsPerWin));
    return{extraSecondsPerWin:window.extraSecondsPerWin,
      branches:branchKeys.map(key=>{
        const branch=window[key];
        assert.ok(branch.battleTrace.length>0,'实际战役必须保留战斗轨迹');
        const firstLoss=branch.battleTrace.find(row=>!row.win)||null;
        const lateTrace=branch.battleTrace.filter(row=>row.stage>=7);
        const battleRows=branch.rows.filter(row=>row.stage>=7);
        assert.equal(lateTrace.length,battleRows.length,'晚期摘要须对应真实逐场结算');
        return{rewardMode:branch.rewardMode,wins:branch.wins,blockedAt:branch.blockedAt,
          highestStageAttempted:branch.battleTrace.at(-1).stage,
          firstLoss:firstLoss?{stage:firstLoss.stage,round:firstLoss.round,
            armyBefore:firstLoss.armyBefore,armyAfter:firstLoss.armyAfter}:null,
          lateTrace:lateTrace.map(row=>({stage:row.stage,enemy:row.enemy,win:row.win,round:row.round,
            armyBefore:row.armyBefore,armyAfter:row.armyAfter,resourcesBefore:row.resourcesBefore,
            replenishment:battleRows.find(item=>item.stage===row.stage)?.replenishment||null}))};
      })};
  });
  return{seed,entry:{tick:data.entryState.tick,population:data.entryState.population,
    capacity:data.entryState.capacity,army:data.entryState.army,resources:data.entryState.resources,
    workers:data.entryState.workers},windows};
});

const stageRows=new Map();
for(const profile of profiles)for(const window of profile.windows)for(const branch of window.branches)
  for(const row of branch.lateTrace)if(!stageRows.has(row.stage))stageRows.set(row.stage,row.enemy);
const actualEnemyFrontier=[...stageRows.entries()].sort((a,b)=>a[0]-b[0])
  .map(([stage,enemy])=>({stage,...enemy}));
assert.ok(actualEnemyFrontier.length>=1,'至少须覆盖第7关或更后关卡');

const exposure=[];
for(const seconds of waits){
  const rows=[];
  for(const profile of profiles){
    const window=profile.windows.find(item=>item.extraSecondsPerWin===seconds);
    for(const branch of window.branches){
      const attempted=new Set(branch.lateTrace.map(row=>row.stage));
      rows.push({seed:profile.seed,branch:branch.rewardMode,highestStageAttempted:branch.highestStageAttempted,
        blockedAt:branch.blockedAt,firstLoss:branch.firstLoss,
        reached:Object.fromEntries([7,8,9,10].map(stage=>[stage,attempted.has(stage)]))});
    }
  }
  exposure.push({extraSecondsPerWin:seconds,branches:rows.length,
    highestStageAttempted:Math.max(...rows.map(row=>row.highestStageAttempted)),
    reachedCounts:Object.fromEntries([7,8,9,10].map(stage=>[
      stage,rows.filter(row=>row.reached[stage]).length])),
    firstLosses:Object.fromEntries([4,6,7,8,9,10].map(stage=>[
      stage,rows.filter(row=>row.firstLoss?.stage===stage).length]).filter(([,count])=>count>0)),rows});
}

const artifact={batch:'P119',
  unit:'simulated online seconds; people; resources; soldiers; stages; actual enemy units/HP/combat stats',
  method:'P102 real zero-win 18-person route, real production/training/formation/battle callbacks/settlement; xorshift32 seeds 1, 2, 3, 42 and 12345; campaign extended to level 10; capture actual B.enemyUnits after initBattleState()',
  scope:'levels 1-10 first-clear attempts; per-win waits 0/60/180/600 simulated seconds; P102 baseline simulated +1 first-clear deed candidate and two stage-3 +6 deed/worker-allocation sensitivities (none are current player rewards); stop each route on its first loss; five deterministic streams are sensitivity examples, not player win-rate estimates; level 10 is included only if naturally reached',
  recoveryBoundary:'no same-stage recovery in this batch; P116 separately tested a single 600-second real retrain/retry after the first loss, but that retry does not resume the campaign loop',
  seeds,actualEnemyFrontier,exposure,profiles};
const rawPath=path.join(root,'docs/codex/reports/data/p119-seeded-campaign-frontier.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P119',actualEnemyFrontier:actualEnemyFrontier.map(({stage,id,name,boss,totalTroops,totalHp,troopWeightedAttack,groups})=>
  ({stage,id,name,boss,totalTroops,totalHp,troopWeightedAttack,groups})),
  exposure:exposure.map(({extraSecondsPerWin,branches,highestStageAttempted,reachedCounts,firstLosses})=>
    ({extraSecondsPerWin,branches,highestStageAttempted,reachedCounts,firstLosses})),rawData:rawPath},null,2));
