'use strict';
// P116: sample the real early campaign across repeatable PRNG streams and
// preserve the actual enemy-unit panels constructed by initBattleState().
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const seeds=[1,2,3,42,12345];

function childJson(seed){
  const args=[campaignProbe,`--battle-seed=${seed}`,'--retry-first-loss','--recovery-wait-seconds=600'];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}

const profiles=seeds.map(seed=>{
  const data=childJson(seed);
  assert.equal(data.battleSeed,seed);
  assert.equal(data.battleRandom,null);
  assert.equal(data.results.length,4);
  const results=data.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
    branches:['current','frontloadedMetal','frontloadedFood'].map(key=>{
      const branch=window[key];
      assert.ok(branch.battleTrace.length>0,'种子路线应保留真实交战轨迹');
      const failed=branch.battleTrace.find(row=>!row.win);
      const recovery=branch.defeatRecovery;
      if(recovery){
        assert.equal(recovery.stage,recovery.firstLoss.stage);
        assert.equal(recovery.activeWaitSeconds,600);
        assert.equal(recovery.firstLoss.populationBefore,recovery.firstLoss.populationAfterDefeat);
      }
      return{rewardMode:branch.rewardMode,attempted:branch.attempted,wins:branch.wins,
        blockedAt:branch.blockedAt,firstLoss:failed?{stage:failed.stage,round:failed.round,
          enemy:failed.enemy,armyBefore:failed.armyBefore,armyAfter:failed.armyAfter}:null,
        battleTrace:branch.battleTrace.map(row=>({stage:row.stage,enemy:row.enemy,win:row.win,
          round:row.round,armyBefore:row.armyBefore,armyAfter:row.armyAfter,
          resourcesBefore:row.resourcesBefore})),
        retry:recovery?{stage:recovery.stage,win:recovery.retry.outcome.win,
          round:recovery.retry.outcome.round,army:recovery.retry.outcome.byType,
          beforeRetry:recovery.beforeRetry.army}:null};
    })}));
  return{seed,entry:{tick:data.entryState.tick,population:data.entryState.population,
    capacity:data.entryState.capacity,army:data.entryState.army,resources:data.entryState.resources},results};
});

const enemyByStage=new Map();
for(const profile of profiles)for(const window of profile.results)for(const branch of window.branches)
  for(const row of branch.battleTrace)if(!enemyByStage.has(row.stage))enemyByStage.set(row.stage,row.enemy);
const enemyFrontier=[...enemyByStage.entries()].sort((a,b)=>a[0]-b[0]).map(([stage,enemy])=>({stage,...enemy}));
assert.ok(enemyFrontier.length>=4,'现有种子至少应覆盖前四关实际敌军构成');

const artifact={batch:'P116',
  unit:'seeded real campaign outcomes; enemy troop counts, HP and combat stats; stage waits; casualties; first-loss retry',
  method:'P102 real zero-win 18-person route, resource production, training queue, battle callbacks and settlement; xorshift32 streams seeded independently at 1, 2, 3, 42 and 12345; capture B.enemyUnits immediately after actual initBattleState()',
  scope:'early levels 1-6, current reward and two stage-3 role/reward sensitivities, per-win waits 0/60/180/600 simulated seconds, one 600-second same-stage retry after first defeat; five deterministic streams are sensitivity examples, not a population-level win-rate estimate',
  seeds,enemyFrontier,profiles};
const rawPath=path.join(root,'docs/codex/reports/data/p116-seeded-stage-pressure.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P116',enemyFrontier:enemyFrontier.map(({stage,id,name,boss,groups,totalTroops,totalHp,troopWeightedAttack})=>
  ({stage,id,name,boss,totalTroops,totalHp,troopWeightedAttack,groups})),
  profiles:profiles.map(profile=>({seed:profile.seed,results:profile.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
    branches:window.branches.map(branch=>({rewardMode:branch.rewardMode,wins:branch.wins,
      blockedAt:branch.blockedAt,firstLoss:branch.firstLoss?{stage:branch.firstLoss.stage,round:branch.firstLoss.round}:null,
      retry:branch.retry?{stage:branch.retry.stage,win:branch.retry.win,round:branch.retry.round}:null}))}))})),
  rawData:rawPath},null,2));
