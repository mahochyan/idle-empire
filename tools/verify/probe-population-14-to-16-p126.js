'use strict';
// P126: compare the real 14->16 housing handoff after a brief metal shift or
// after adopting a continuous copper-mint package, from one shared P101 save.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const sourceArgs=process.argv.slice(2).filter(arg=>/^--research-workers=[2-7]$/.test(arg)||arg==='--research-priority');
const source=spawnSync(process.execPath,
  ['tools/verify/probe-population-early-18.js',...sourceArgs,'--capture-population14-save'],
  {cwd:process.cwd(),encoding:'utf8',maxBuffer:16*1024*1024});
assert.equal(source.status,0,`P101共同来源路线失败：${source.stderr||source.stdout}`);
const sourceRun=JSON.parse(source.stdout);
const checkpoint=sourceRun.population14IndustryCheck?.stateSave;
assert.equal(typeof checkpoint,'string','P101没有导出隔离用的14人口真实存档');
const source14=sourceRun.milestones.find(m=>m.label==='population-14');
const source16=sourceRun.milestones.find(m=>m.label==='population-16');
assert.ok(source14&&source16,'P101缺少14／16人口检查点');
assert.equal(source14.population,14);
assert.equal(source14.capacity,14);
assert.equal(source14.settlements.smallTown,3);
assert.equal(source16.population,16);
const baselineExpansionSeconds=source16.second-source14.second;

const metalPackage={wood:1,stone:3,food:2,tech:1,coal:4,copper:1,iron:1};
const mintPackage={...metalPackage,coin:1};
const growthPackage={wood:10,stone:1,food:1,tech:2};
function route(){
  const e=environment({rts_save:checkpoint});
  const run=e.run;
  const loaded=run('loadSaveAndApply()');
  assert.equal(loaded.status,'ok');
  assert.equal(run('S.defeated.length'),0);
  assert.equal(run('S.tick'),source14.second);
  assert.equal(run('popCurrent()'),14);
  assert.equal(run('maxPop()'),14);
  assert.equal(run("S.settlements.smallTown"),3);
  return run;
}
function state(run){
  return JSON.parse(JSON.stringify(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    settlements:{...S.settlements},allocation:{...S.popAlloc},free:popFree(),resources:{...S.res},
    foodRate:offlineNetRates().food,battleWins:S.defeated.length,sciences:[...S.sciences]})`)));
}
function assign(run,target,label){
  const current=JSON.parse(JSON.stringify(run('({...S.popAlloc})')));
  const keys=[...new Set([...Object.keys(current),...Object.keys(target)])];
  for(const key of keys)if((target[key]||0)<(current[key]||0)){
    const result=run(`setPopAlloc('${key}',${target[key]||0})`);
    assert.equal(result?.ok,true,`${label}撤回${key}失败：${JSON.stringify(result)}`);
  }
  for(const key of keys)if((target[key]||0)>(current[key]||0)){
    const result=run(`setPopAlloc('${key}',${target[key]||0})`);
    assert.equal(result?.ok,true,`${label}分配${key}失败：${JSON.stringify(result)}`);
  }
  assert.ok(run('popAllocTotal()<=popCurrent()'),`${label}超出实际人口`);
  return JSON.parse(JSON.stringify(run('({allocated:popAllocTotal(),free:popFree(),allocation:{...S.popAlloc}})')));
}
function makeRunner(run){
  let minFood=run('S.res.food');
  let ticks=0;
  const marketTrades=[];
  function tick(){
    run('tick()');ticks++;
    minFood=Math.min(minFood,run('S.res.food'));
  }
  function waitForCoin(target){
    let guard=0;
    while(run('S.res.coin')+1e-7<target){
      assert.ok(++guard<100,'筹币循环异常');
      let traded=false;
      for(const [key,reserve] of [['wood',100],['stone',1000],['food',1000]]){
        const available=Math.floor(run(`S.res.${key}`)-reserve);
        if(available<1000)continue;
        const rate=key==='wood'?0.1:key==='stone'?0.14:0.08;
        const missing=target-run('S.res.coin');
        const qty=Math.min(available,Math.max(1000,Math.ceil((missing+0.01)/rate)));
        const result=run(`exchangeResource('${key}','coin',${qty})`);
        assert.equal(result?.ok,true,`${key}换币失败：${JSON.stringify(result)}`);
        marketTrades.push({from:key,quantity:qty,coinReceived:result.get});
        minFood=Math.min(minFood,run('S.res.food'));
        traded=true;
        if(run('S.res.coin')+1e-7>=target)break;
      }
      if(traded)continue;
      const before=run('S.tick');
      const missing=target-run('S.res.coin');
      const woodThreshold=Math.min(run("resCap('wood')"),
        Math.max(1100,Math.ceil((missing+0.01)/0.1)+100));
      while(run('S.res.wood')<woodThreshold){
        assert.ok(ticks<20000,'市场筹币等待超过20000在线秒');
        tick();
      }
      assert.ok(run('S.tick')>before);
    }
  }
  function waitForMintCoin(target){
    let guard=0;
    while(run('S.res.coin')+1e-7<target){
      assert.ok(++guard<20000,'铸币岗位筹币等待超过20000在线秒');
      tick();
    }
  }
  function buyNextSmallTown(funding='market'){
    const cost=run("settlementCost('smallTown')");
    const quote=run("settlementBatchPreview('smallTown',1)");
    assert.equal(quote.ok,false,'未筹币时不应可直接扩建');
    assert.equal(cost,24);
    const coinTarget=cost*100;
    if(funding==='mint')waitForMintCoin(coinTarget);
    else waitForCoin(coinTarget);
    const coinBefore=run('S.res.coin');
    const deed=run(`exchangeResource('coin','deed',${coinTarget})`);
    assert.equal(deed?.ok,true,`购买${cost}地契失败：${JSON.stringify(deed)}`);
    assert.equal(deed.get,cost);
    const upgrade=run("upgradeSettlement('smallTown')");
    assert.equal(upgrade?.ok,true,`小镇扩建失败：${JSON.stringify(upgrade)}`);
    assert.equal(run('maxPop()'),16);
    const beforeBirth=run('S.tick');
    while(run('popCurrent()')<16){
      assert.ok(run('S.tick')-beforeBirth<30,'扩容后人口等待超过30秒');
      tick();
    }
    return{cost,coinTarget,coinBefore,deed,upgrade,birthWaitSeconds:run('S.tick')-beforeBirth};
  }
  return{tick,waitForCoin,buyNextSmallTown,metrics:()=>({ticks,minFood,marketTrades})};
}

const base=route();
const initial=state(base);
assert.equal(initial.resources.coin,source14.resources.coin);
assert.ok(sourceRun.noMintScience);

// Candidate A: unlock minting, run the copper-fed coin worker continuously,
// then buy the next two-person small-town capacity using that output.
const mint=route();
const mintTechBefore=mint('S.res.tech');
const mintResearch=mint("researchScience('sci_currency')");
assert.equal(mintResearch?.ok,true,`研究铸币技术失败：${JSON.stringify(mintResearch)}`);
assert.ok(Math.abs((mintTechBefore-mint('S.res.tech'))-1200)<1e-8,
  '铸币技术没有实际扣除1200科技点');
const mintAllocation=assign(mint,mintPackage,'煤链铸币包');
assert.equal(mintAllocation.allocated,14);
assert.equal(mintAllocation.free,0);
assert.equal(mint("workerLockReason('coin')"),'');
const mintBefore=state(mint);
const mintRunner=makeRunner(mint);
for(let i=0;i<120;i++)mintRunner.tick();
const mintAfter120=state(mint);
assert.equal(mintAfter120.resources.coin-mintBefore.resources.coin,240);
assert.ok(mintAfter120.resources.iron-mintBefore.resources.iron>=60);
assert.ok(mintAfter120.resources.food>0);
const mintExpansion=mintRunner.buyNextSmallTown('mint');
const mintFinal=state(mint);
assert.ok(mintFinal.resources.iron>mintBefore.resources.iron);
assert.ok(mintFinal.resources.coal>mintBefore.resources.coal);
assert.equal(mintFinal.population,16);
assert.equal(mintFinal.capacity,16);
assert.equal(mintFinal.battleWins,0);
assert.ok(mintRunner.metrics().minFood>0);
assert.equal(mintRunner.metrics().marketTrades.length,0,
  '持续铸币路线不应通过基础资源出售补足购契');

// Candidate B: make a 120-second metal reserve, then return workers to the
// already-proven market-funded housing route.
const switched=route();
const metalAllocation=assign(switched,metalPackage,'煤链短班');
assert.equal(metalAllocation.allocated,13);
assert.equal(metalAllocation.free,1);
const metalBefore=state(switched);
const switchRunner=makeRunner(switched);
for(let i=0;i<120;i++)switchRunner.tick();
const metalAfter120=state(switched);
assert.equal(metalAfter120.resources.coal-metalBefore.resources.coal,120);
assert.equal(metalAfter120.resources.copper-metalBefore.resources.copper,120);
assert.equal(metalAfter120.resources.iron-metalBefore.resources.iron,60);
assert.ok(metalAfter120.resources.food>0);
const switchAllocation=assign(switched,growthPackage,'返回扩容经济岗');
assert.equal(switchAllocation.allocated,14);
const switchExpansion=switchRunner.buyNextSmallTown();
const switchFinal=state(switched);
assert.equal(switchFinal.population,16);
assert.equal(switchFinal.capacity,16);
assert.equal(switchFinal.battleWins,0);
assert.ok(switchRunner.metrics().minFood>0);

const artifact={batch:'P126',unit:'simulated online seconds; residents; deeds; resources',
  method:'branch two isolated environments from one current-worktree P101 real 14-resident save; use real research, worker allocation, tick, market exchange, deed purchase and settlement upgrade functions',
  scope:'compare the 14->16 expansion under a continuous copper-mint/metal package and a 120-second metal shift followed by the established wood-market package; no battle, injected resources, manual game-state edits or player-save writes',
  sourceRoute:sourceRun.route,sourceArgs,
  baseline:{route:sourceRun.route,first14Seconds:source14.second,first16Seconds:source16.second,
    expansionSeconds:baselineExpansionSeconds,startingState:initial},
  sharedExpansion:{fromPopulation:14,toPopulation:16,settlement:'smallTown',fromLevel:3,toLevel:4,
    deedCost:24,coinCost:2400,reserves:{wood:100,stone:1000,food:1000}},
  continuousMint:{research:{id:'sci_currency',costTech:1200,success:!!mintResearch.ok,
      techBefore:mintTechBefore,techAfter:mintBefore.resources.tech,
      techSpent:Number((mintTechBefore-mintBefore.resources.tech).toFixed(4))},
    allocation:mintAllocation,package:mintPackage,after120Seconds:mintAfter120,
    expansion:mintExpansion,totalElapsedSeconds:mintFinal.tick-initial.tick,
    minFood:mintRunner.metrics().minFood,marketTrades:mintRunner.metrics().marketTrades,final:mintFinal},
  metalThenMarket:{metalPackage:metalPackage,metalAllocation,after120Seconds:metalAfter120,
    growthAllocation:switchAllocation,expansion:switchExpansion,
    totalElapsedSeconds:switchFinal.tick-initial.tick,minFood:switchRunner.metrics().minFood,
    marketTrades:switchRunner.metrics().marketTrades,
    final:switchFinal}};
const rawArg=process.argv.find(arg=>arg.startsWith('--raw-output='));
const rawPath=rawArg?rawArg.slice('--raw-output='.length):'docs/codex/reports/data/p126-population-14-to-16.json';
require('node:fs').mkdirSync(require('node:path').dirname(rawPath),{recursive:true});
require('node:fs').writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P126',baselineSeconds:baselineExpansionSeconds,
  mintSeconds:artifact.continuousMint.totalElapsedSeconds,
  switchSeconds:artifact.metalThenMarket.totalElapsedSeconds,
  mintCoin:mintFinal.resources.coin,mintIron:mintFinal.resources.iron,
  switchMetal:{coal:metalAfter120.resources.coal-metalBefore.resources.coal,
    copper:metalAfter120.resources.copper-metalBefore.resources.copper,
    iron:metalAfter120.resources.iron-metalBefore.resources.iron},
  mintMinFood:artifact.continuousMint.minFood,switchMinFood:artifact.metalThenMarket.minFood,
  mintMarketTrades:artifact.continuousMint.marketTrades.length,
  switchMarketTrades:artifact.metalThenMarket.marketTrades.length,
  rawData:rawPath},null,2));
