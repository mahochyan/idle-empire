'use strict';
// P134: inspect actual L4-L6 battle transitions after the P133 L4 adjustment.
// Uses the existing P102 route and real battle callbacks; never loads a player save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const route=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const seeds=[1,2,3,42,12345];
const waits=[0,60,180,600];
const branches=['current','frontloadedMetal','frontloadedFood'];
const stages=[4,5,6];
const hashInputs=['config.js','levels.js','math.js','garrison.js','tests/progression/harness.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js','tools/verify/probe-population-early-18.js'];

function routeForSeed(seed){
  const args=[route,'--campaign-max-stage=6',`--battle-seed=${seed}`,`--wait-windows=${waits.join(',')}`];
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`P102 ${args.slice(1).join(' ')}失败：${result.stderr||result.stdout}`);
  const data=JSON.parse(result.stdout);
  assert.equal(data.battleSeed,seed);
  assert.ok(data.campaignMaxStage===undefined||data.campaignMaxStage===6,
    'P102省略campaignMaxStage时表示默认值6');
  assert.deepEqual(data.results.map(row=>row.extraSecondsPerWin),waits);
  return data;
}

const profiles=seeds.map(seed=>{
  const data=routeForSeed(seed);
  return{
    seed,entryState:data.entryState,
    windows:data.results.map(window=>({
      extraSecondsPerWin:window.extraSecondsPerWin,
      branches:branches.map(key=>{
        const branch=window[key];
        assert.ok(branch.battleTrace.length>0,'须保留真实战斗轨迹');
        return{key,wins:branch.wins,blockedAt:branch.blockedAt,
          battles:branch.battleTrace.filter(row=>stages.includes(row.stage)).map(row=>({
            stage:row.stage,enemy:row.enemy,win:row.win,round:row.round,
            armyBefore:row.armyBefore,armyAfter:row.armyAfter,resourcesBefore:row.resourcesBefore}))};
      })
    }))
  };
});

const exposure=waits.map(seconds=>{
  const rows=profiles.flatMap(profile=>profile.windows.find(window=>window.extraSecondsPerWin===seconds)
    .branches.map(branch=>({seed:profile.seed,branch:branch.key,wins:branch.wins,
      blockedAt:branch.blockedAt,battles:branch.battles})));
  const stageSummary=Object.fromEntries(stages.map(stage=>{
    const attempts=rows.flatMap(row=>row.battles.filter(battle=>battle.stage===stage)
      .map(battle=>({...battle,seed:row.seed,branch:row.branch})));
    const totals=attempts.map(row=>Object.values(row.armyBefore).reduce((sum,count)=>sum+count,0));
    return[String(stage),{attempts:attempts.length,wins:attempts.filter(row=>row.win).length,
      losses:attempts.filter(row=>!row.win).length,
      averageArmyBefore:totals.length?totals.reduce((sum,n)=>sum+n,0)/totals.length:null,
      armyBeforeRange:totals.length?{min:Math.min(...totals),max:Math.max(...totals)}:null}];
  }));
  return{extraSecondsPerWin:seconds,branches:rows.length,stageSummary};
});

const stageEnemies={};
for(const profile of profiles){
  for(const window of profile.windows){
    for(const branch of window.branches){
      for(const battle of branch.battles){
        const key=String(battle.stage);
        if(!stageEnemies[key])stageEnemies[key]=battle.enemy;
        assert.deepEqual(battle.enemy,stageEnemies[key],`L${key}敌军应在各路线中一致`);
      }
    }
  }
}
assert.deepEqual(Object.keys(stageEnemies).sort(),stages.map(String),'应实际触达L4、L5、L6');

const inputSha256=Object.fromEntries(hashInputs.map(file=>[file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const artifact={batch:'P134',unit:'simulated online seconds; actual soldiers; actual battle round; resources',
  method:'P102 real zero-win 18-person route, real production/training/formation/battle callbacks/settlement; xorshift32 seeds 1, 2, 3, 42 and 12345; campaign through L6; capture actual B.enemyUnits and survivor pools for L4-L6',
  scope:'current P133 L4=24 roster; three existing reward/worker sensitivities; per-win waits 0/60/180/600; first loss stops each branch; deterministic routes are sensitivity samples, not player win-rate estimates',
  seeds,waits,branches,stages,stageEnemies,exposure,profiles,inputSha256};
const rawPath=path.join(root,'docs/codex/reports/data/p134-early-campaign-l4-l6-detail.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P134',stageEnemies:Object.fromEntries(Object.entries(stageEnemies)
  .map(([stage,enemy])=>[stage,{name:enemy.name,totalTroops:enemy.totalTroops,totalHp:enemy.totalHp,
    troopWeightedAttack:enemy.troopWeightedAttack}])),exposure,rawData:rawPath},null,2));
