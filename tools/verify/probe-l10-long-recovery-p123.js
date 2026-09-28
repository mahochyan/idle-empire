'use strict';
// P123: test whether extended real replenishment windows let the early route
// reach and actually fight the configured level-10 boss.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const rawPath=path.join(root,'docs/codex/reports/data/p123-l10-long-recovery.json');
const seeds=[1,2,3,42,12345];
const waits=[600,1800,3600];
const modes=[
  {key:'current',label:'current 18-person allocation; no added wood worker'},
  {key:'frontloadedWood',label:'isolated +6 deed candidate after stage 3; 19th resident assigned to wood'}
];

function runSeed(seed){
  const args=[campaignProbe,'--campaign-max-stage=10','--include-wood-branch',
    `--wait-windows=${waits.join(',')}`,`--battle-seed=${seed}`];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:48*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}

const profiles=seeds.map(seed=>{
  const data=runSeed(seed);
  assert.equal(data.battleSeed,seed);
  assert.equal(data.campaignMaxStage,10);
  assert.deepEqual(data.waitWindows,waits);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  const windows=data.results.map(result=>{
    assert.ok(waits.includes(result.extraSecondsPerWin));
    const branches=modes.map(mode=>{
      const branch=result[mode.key];
      assert.ok(branch.battleTrace.length>0);
      const trace=branch.battleTrace;
      const losses=trace.filter(row=>!row.win);
      const lateRows=branch.rows.filter(row=>row.stage>=7);
      const boss=trace.find(row=>row.stage===10)||null;
      return{mode:mode.key,label:mode.label,wins:branch.wins,blockedAt:branch.blockedAt,
        highestStageAttempted:trace.at(-1).stage,
        firstLoss:losses[0]?{stage:losses[0].stage,round:losses[0].round,
          armyBefore:losses[0].armyBefore,armyAfter:losses[0].armyAfter}:null,
        boss:boss?{win:boss.win,round:boss.round,enemy:boss.enemy,
          armyBefore:boss.armyBefore,armyAfter:boss.armyAfter}:null,
        lateTrace:lateRows.map(row=>({stage:row.stage,win:row.win,round:row.round,
          armyBefore:row.byTypeBefore,armyAfter:row.byTypeAfter,
          enemy:trace.find(item=>item.stage===row.stage)?.enemy||null,
          replenishment:row.replenishment?{remainingQueue:row.replenishment.remainingQueue,
            queueReasons:row.replenishment.queueReasons,resources:row.replenishment.resources}:null}))};
    });
    return{extraSecondsPerWin:result.extraSecondsPerWin,branches};
  });
  return{seed,entry:{tick:data.entryState.tick,army:data.entryState.army,
    workers:data.entryState.workers,resources:data.entryState.resources},windows};
});

const summary=Object.fromEntries(waits.map(wait=>{
  const branches=profiles.flatMap(profile=>profile.windows.find(row=>row.extraSecondsPerWin===wait)
    .branches.map(branch=>({...branch,seed:profile.seed})));
  return[wait,Object.fromEntries(modes.map(mode=>{
    const rows=branches.filter(branch=>branch.mode===mode.key);
    return[mode.key,{attemptedL7To10:Object.fromEntries([7,8,9,10].map(stage=>[
      stage,rows.filter(row=>row.lateTrace.some(item=>item.stage===stage)).length])),
      clearedL7To10:Object.fromEntries([7,8,9,10].map(stage=>[
        stage,rows.filter(row=>row.lateTrace.some(item=>item.stage===stage&&item.win)).length])),
      totalClearedStages:rows.reduce((sum,row)=>sum+row.wins,0),
      firstLosses:Object.fromEntries([4,6,7,8,9,10].map(stage=>[
        stage,rows.filter(row=>row.firstLoss?.stage===stage).length]).filter(([,n])=>n>0)),
      bossOutcomes:rows.filter(row=>row.boss).map(row=>({seed:row.seed,win:row.boss.win,
        round:row.boss.round,armyBefore:row.boss.armyBefore,armyAfter:row.boss.armyAfter}))}];
  }))];
}));

const bossRecord=profiles.flatMap(profile=>profile.windows.flatMap(window=>window.branches
  .filter(branch=>branch.boss).map(branch=>({stage:10,seed:profile.seed,
    extraSecondsPerWin:window.extraSecondsPerWin,mode:branch.mode,enemy:branch.boss.enemy}))));
if(bossRecord.length){
  const serialized=new Set(bossRecord.map(row=>JSON.stringify(row.enemy)));
  assert.equal(serialized.size,1,'同一关卡初始化的Boss面板在固定配置下应一致');
}

const artifact={batch:'P123',
  unit:'simulated online seconds per victory; actual troop count/HP/attack; real resource-replenishment queues; battle rounds and losses',
  method:'P102 current real zero-win 18-person preparation, actual market-independent combat/train/replenish functions, five xorshift32 seeds, current enemy initialization; optional post-stage-3 +6 deed/19th wood-worker branch runs only in isolated VM',
  scope:'test 600/1800/3600 online seconds after each victory through level 10 or first loss; compare current 18-person workforce with the post-stage-3 +6 deed candidate assigning the 19th worker to wood; fixed deterministic seeds are sensitivity probes, not player win-rate samples; no game balance or reward configuration changes',
  waits,seeds,modes,enemyL10Observed:bossRecord.length>0,
  l10EnemyFrontier:bossRecord.length?bossRecord[0].enemy:null,summary,profiles};
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P123',waits,seeds,enemyL10Observed:artifact.enemyL10Observed,
  l10EnemyFrontier:artifact.l10EnemyFrontier,summary,rawData:rawPath},null,2));
