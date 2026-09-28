'use strict';
// Compare the live L3 deed reward with an isolated no-reward control while
// housing, production and real training queues advance between battles.
// P102's historical direct deed additions are never executed.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p166Path=path.join(__dirname,'probe-current-first-clear-population-p166.js');
const outputPath=path.join(root,'docs/codex/reports/data/p167-current-first-clear-campaign.json');
const seeds=[1,2,3,42,12345];
const rosterTarget={infantry:15,archer:13,bronze_guard:15};
const workerPolicies=[
  {name:'wood-wood',jobs:['wood','wood']},
  {name:'wood-food',jobs:['wood','food']},
  {name:'food-wood',jobs:['food','wood']},
  {name:'food-food',jobs:['food','food']}
];
const stoneReserve=100;
const stoneSaleSize=1000;
const waitAfterVictory=600;
const maxStage=10;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}

// Reuse P166's real P101/P102 preparation and battle DOM/timer adapter. The
// in-memory return precedes P166's own scenario; no P166 or P102 candidate
// reward loop runs, and neither source file is changed.
function preparationHelpers(){
  const source=fs.readFileSync(p166Path,'utf8');
  const marker='const prepared=capturePreparation();';
  const first=source.indexOf(marker);
  assert.notEqual(first,-1,'P166准备档返回点消失');
  assert.equal(source.indexOf(marker,first+marker.length),-1,'P166准备档返回点不唯一');
  const isolated=source.slice(0,first)+
    'return {capturePreparation,snapshot,installBattleHarness,formArmy,checked,plain};\n'+
    source.slice(first);
  return new Function('require','console','__dirname',isolated)(
    createRequire(p166Path),{log(){},error:console.error},path.dirname(p166Path));
}
const {capturePreparation,snapshot,installBattleHarness,formArmy,checked,plain}=preparationHelpers();
const prepared=capturePreparation();
assert.equal(prepared.battleState.population,18);
assert.equal(prepared.battleState.capacity,18);
assert.equal(prepared.battleState.resources.deed,0);
assert.equal(prepared.battleState.army,36);

function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function armyByType(run){
  return Object.fromEntries(Object.keys(rosterTarget).map(type=>[type,owned(run,type)]));
}
function deployedByType(state){
  const counts=Object.fromEntries(Object.keys(rosterTarget).map(type=>[type,0]));
  for(const row of ['front','mid','back'])for(const unit of state.formation[row])
    if(Object.hasOwn(counts,unit.type))counts[unit.type]+=unit.count;
  return counts;
}
function queueToTarget(run,stage){
  const actions=[];
  for(const [type,target] of Object.entries(rosterTarget)){
    const have=owned(run,type);
    const queued=run(`S.queue['${type}']?.count||0`);
    const missing=target-have-queued;
    if(missing>0){
      const result=checked(run,`train('${type}',${missing})`,`L${stage}补训${type}`);
      actions.push({type,target,have,queued,requested:missing,result});
    }
  }
  return actions;
}
function battleRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p167Rng=${initial};Math.random=()=>{
    let x=__p167Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p167Rng=x>>>0;return __p167Rng/4294967296;}`);
}
function fight(run,seed,stage){
  assert.equal(run('S.defeated.length'),stage-1,`L${stage}不可跳关`);
  run('Math.random=()=>0.5');
  formArmy(run);
  const before=snapshot(run);
  const beforeArmy=armyByType(run);
  battleRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`L${stage}未开战`);
  const enemy=plain(run(`({id:B.enemyCfg.id,name:B.enemyCfg.name,boss:!!B.enemyCfg.boss,
    troops:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0),0),
    hp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p166Step()'),true,`L${stage}回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage}未结算`);
  const round=run('B.round');
  const won=run(`S.defeated.includes(${stage})`);
  const resultText=run("document.getElementById('battle-result').innerHTML");
  const after=snapshot(run);
  const afterArmy=armyByType(run);
  run('exitBattle()');
  return{stage,enemy,won,round,callbacks,before,after,beforeArmy,afterArmy,
    beforeDeployed:deployedByType(before),afterDeployed:deployedByType(after),
    casualties:Object.fromEntries(Object.keys(rosterTarget).map(type=>
      [type,beforeArmy[type]-afterArmy[type]])),
    showsDeedReward:resultText.includes('拓居令')};
}
function comparableFight(row){
  const copy=plain(row);
  delete copy.before.resources.deed;
  delete copy.after.resources.deed;
  delete copy.showsDeedReward;
  delete copy.afterWait;
  delete copy.minFoodAfterWait;
  delete copy.training;
  for(const state of [copy.before,copy.after])
    for(const formationRow of ['front','mid','back'])
      for(const unit of state.formation[formationRow])delete unit.id;
  return copy;
}

function runBranch(seed,disableReward,workerPolicy){
  const e=environment({rts_save:prepared.battleSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(disableReward){
    assert.equal(run('CFG.enemies[2].firstClearReward.deed'),6);
    run('CFG.enemies[2].firstClearReward=null');
  }
  installBattleHarness(run);
  const start=snapshot(run);
  let minFood=start.resources.food;
  let minStone=start.resources.stone;
  let birthSeen=start.population;
  const market=[],births=[],battles=[];
  function observe(){
    minFood=Math.min(minFood,run('S.res.food'));
    minStone=Math.min(minStone,run('S.res.stone'));
  }
  function staffBirths(){
    const population=run('popCurrent()');
    while(birthSeen<population){
      birthSeen++;
      const job=workerPolicy.jobs[birthSeen-19];
      assert.ok(['wood','food'].includes(job),`第${birthSeen}人的岗位策略缺失`);
      const previous=run(`S.popAlloc.${job}||0`);
      checked(run,`setPopAlloc('${job}',${previous+1})`,`第${birthSeen}人上${job}岗`);
      births.push({tick:run('S.tick'),population:birthSeen,job,workers:plain(run('({...S.popAlloc})')),
        resources:plain(run('({...S.res})'))});
    }
  }
  function tradeAndExpand(){
    for(let guard=0;guard<20;guard++){
      const people=run('popCurrent()');
      if(people>=20||people<run('maxPop()'))return;
      const quote=plain(run("settlementBatchPreview('village',1)"));
      if(quote.ok){
        const before=snapshot(run);
        const result=checked(run,"upgradeSettlement('village')",'扩建村庄');
        market.push({action:'expand',tick:before.tick,population:before.population,
          capacityBefore:before.capacity,deedBefore:before.resources.deed,
          deedCost:result.cost,capacityAfter:run('maxPop()')});
        return;
      }
      const missing=quote.cost-run('S.res.deed');
      assert.ok(Number.isInteger(missing)&&missing>0&&missing<=20,'扩容地契缺口非法');
      const coinCost=missing*100;
      if(run('S.res.coin')>=coinCost){
        const before=snapshot(run);
        const result=checked(run,`exchangeResource('coin','deed',${coinCost})`,'市场购契');
        assert.equal(result.get,missing);
        market.push({action:'buy-deed',tick:before.tick,missing,coinCost,
          coinBefore:before.resources.coin,deedBefore:before.resources.deed});
        continue;
      }
      if(run('S.res.stone')>=stoneReserve+stoneSaleSize){
        const before=snapshot(run);
        const result=checked(run,`exchangeResource('stone','coin',${stoneSaleSize})`,'卖石筹币');
        market.push({action:'sell-stone',tick:before.tick,amount:stoneSaleSize,
          coinGained:result.get,stoneBefore:before.resources.stone,
          coinBefore:before.resources.coin});
        observe();
        continue;
      }
      return;
    }
    throw Error('同一tick市场动作未收敛');
  }
  function tickOne(withMarket){
    run('tick()');observe();
    if(withMarket){staffBirths();tradeAndExpand()}
  }
  function waitTicks(count,withMarket){
    if(withMarket)tradeAndExpand();
    for(let i=0;i<count;i++)tickOne(withMarket);
  }

  for(let stage=1;stage<=maxStage;stage++){
    const row=fight(run,seed,stage);
    battles.push(row);observe();
    if(stage<=3)assert.equal(row.won,true,`种子${seed}未通过L${stage}`);
    if(!row.won)break;
    const training=stage>=3?queueToTarget(run,stage):[];
    row.training=training;
    waitTicks(stage>=3?10+waitAfterVictory:10,stage>=3);
    row.afterWait=snapshot(run);
    row.minFoodAfterWait=minFood;
  }
  const final=snapshot(run);
  const saveResult=checked(run,'save()','P167最终存档');
  const stored=run("localStorage.getItem('rts_save')");
  const reloaded=environment({rts_save:stored});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(snapshot(reloaded.run),final,'P167最终存档重载不一致');
  return{seed,workerPolicy:workerPolicy.name,
    branch:disableReward?'no-L3-reward':'current-L3-plus-six',start,battles,market,births,
    final,minFood,minStone,saveResult,finalSaveSha256:sha(stored),
    attempted:battles.length,wins:battles.filter(row=>row.won).length,
    firstLoss:battles.find(row=>!row.won)?.stage||null};
}

const profiles=workerPolicies.flatMap(policy=>seeds.map(seed=>{
  const reward=runBranch(seed,false,policy);
  const control=runBranch(seed,true,policy);
  assert.deepEqual(reward.start,control.start,`${policy.name}/种子${seed}未同档`);
  for(let stage=1;stage<=3;stage++){
    assert.deepEqual(comparableFight(reward.battles[stage-1]),
      comparableFight(control.battles[stage-1]),`${policy.name}/种子${seed}/L${stage}首胜前后不共源`);
  }
  assert.equal(reward.battles[2].after.resources.deed,6);
  assert.equal(control.battles[2].after.resources.deed,0);
  assert.equal(reward.battles[2].showsDeedReward,true);
  assert.equal(control.battles[2].showsDeedReward,false);
  assert.deepEqual(reward.battles[2].training,control.battles[2].training,
    `种子${seed}/L3补兵目标必须一致`);
  assert.equal(reward.market.find(item=>item.action==='buy-deed')?.missing,3,
    `${policy.name}/种子${seed}现行奖励首档应只买3地契`);
  assert.equal(control.market.find(item=>item.action==='buy-deed')?.missing,9,
    `${policy.name}/种子${seed}无奖首档应购买9地契`);
  for(const branch of [reward,control]){
    assert.equal(branch.final.population,20,`${policy.name}/种子${seed}未到20人`);
    assert.equal(branch.final.capacity,20,`${policy.name}/种子${seed}未到20容量`);
    assert.ok(branch.minFood>0,`${policy.name}/种子${seed}粮食耗尽`);
    assert.ok(branch.minStone>=stoneReserve,`${policy.name}/种子${seed}石料跌破保留线`);
  }
  return{seed,workerPolicy:policy.name,reward,control};
}));
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0,`读取HEAD失败：${head.stderr||''}`);
const artifact={batch:'P167',unit:'simulated online tick seconds; food/stone/wood and troops',
  sourceHead:head.stdout.trim(),sourceSaveSha256:sha(prepared.sourceSave),
  battleStartSaveSha256:sha(prepared.battleSave),battleStartState:prepared.battleState,
  method:'same real P101 zero-win 18/18 save and P102 real preparation save; actual battle/settlement/training/market/tick functions, attempt at most through L10 and stop at first loss; beforeArmy/afterArmy are total owned (pool plus expedition plus garrison), beforeDeployed/afterDeployed are formation counts actually sent into battle; no P102 direct deed injections; control disables only L3 firstClearReward inside isolated VM; every stage restarts xorshift32 battle RNG from its seed and stage',
  policy:{seeds,workerPolicies,rosterTarget,stoneReserve,stoneSaleSize,waitAfterVictory,
    stage1To2Wait:10,stage2To3Wait:10,stage3PlusWait:610,
    addedWorker:'wood-wood, wood-food, food-wood and food-food sensitivity; each reward/control pair follows the same jobs',
    market:'sell stone in 1000 units when needed; buy only missing deeds; one village expansion at a time',
    noOffline:true,noGarrison:true,stopAtFirstLoss:true,
    battleCallbackTime:'not included in online tick seconds'},
  profiles,inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P167',sourceHead:artifact.sourceHead,
  profiles:profiles.map(profile=>({seed:profile.seed,workerPolicy:profile.workerPolicy,
    branches:[profile.reward,profile.control].map(branch=>({name:branch.branch,
      wins:branch.wins,firstLoss:branch.firstLoss,finalPopulation:branch.final.population,
      finalCapacity:branch.final.capacity,
      births:branch.births.map(x=>({tick:x.tick,population:x.population,job:x.job})),
      minFood:branch.minFood,minStone:branch.minStone,
      stage4Owned:branch.battles.find(row=>row.stage===4)?.beforeArmy||null,
      stage4Deployed:branch.battles.find(row=>row.stage===4)?.beforeDeployed||null,
      lossOwned:branch.battles.find(row=>!row.won)?.beforeArmy||null,
      lossDeployed:branch.battles.find(row=>!row.won)?.beforeDeployed||null}))})),
  rawData:outputPath},null,2));
