'use strict';
// P158: continue P101's zero-win 18-resident saves through market housing on a 600s/8h cadence.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const p157Path=path.join(root,'docs/codex/reports/data/p157-zero-win-population-18-to-20.json');
const outputPath=path.join(root,'docs/codex/reports/data/p158-short-session-population-18-to-20.json');
const profile={activeSec:600,offlineSec:28800};
const reserves={wood:100,stone:1000,food:1000};
const scenarios=[
  {name:'sequential-expansion',args:[]},
  {name:'research-priority-4',args:['--research-workers=4']},
  {name:'research-priority-7',args:['--research-workers=7']}
];

function child(args){
  const result=spawnSync(process.execPath,[populationProbe,...args,
    `--session-profile=${profile.activeSec}:${profile.offlineSec}`,'--capture-final-save'],
    {cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
  assert.equal(result.status,0,`P101 ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function state(run){
  return JSON.parse(JSON.stringify(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    allocated:popAllocTotal(),free:popFree(),workers:{...S.popAlloc},resources:{...S.res},
    growthClock:S.population.growthClock,settlements:{...S.settlements},battleWins:S.defeated.length})`)));
}
function runScenario(scenario,p157Baseline){
  const source=child(scenario.args);
  assert.equal(source.battleWins,0,`${scenario.name} P101入口不得有胜场`);
  assert.deepEqual(source.sessionProfile,profile,`${scenario.name} P101短时profile不符`);
  assert.equal(typeof source.finalStateSave,'string',`${scenario.name}缺少真实保存的人口入口`);
  const at18=source.milestones.find(item=>item.label==='population-18');
  assert.ok(at18,`${scenario.name}缺少18人口检查点`);
  assert.equal(at18.population,18);
  assert.equal(at18.capacity,18);
  assert.ok(source.offlineSessions.length>0,`${scenario.name}人口入口没有真实离线窗`);
  const e=environment({rts_save:source.finalStateSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('popCurrent()'),18);
  assert.equal(run('maxPop()'),18);
  assert.equal(run('S.defeated.length'),0);
  const start=state(run);

  const originalDateNow=Date.now;
  let virtualNow=originalDateNow();
  // The harness injects the host Date object into each VM, so keep the clock in
  // this Node realm and restore it after the isolated scenario.
  Date.now=()=>virtualNow;
  run(`(()=>{const g=globalThis;g.__p158MinFoodCandidate=Number(S.res.food)||0;
    const original=productionSecond;
    productionSecond=function(...args){const next=original(...args);
      if(Number.isFinite(next.food))g.__p158MinFoodCandidate=Math.min(g.__p158MinFoodCandidate,next.food);
      return next;};})()`);
  let activeSeconds=0;
  let nextPause=profile.activeSec;
  let minObservedFood=run('S.res.food');
  const offlineSessions=[];
  function observeFood(){
    minObservedFood=Math.min(minObservedFood,run('S.res.food'),run('globalThis.__p158MinFoodCandidate'));
  }
  function tickOne(){
    run('tick()');
    activeSeconds++;
    virtualNow+=1000;
    observeFood();
    if(activeSeconds>=nextPause){
      const saved=run('save()');
      assert.equal(saved?.ok,true,`${scenario.name}在线会话存档失败：${JSON.stringify(saved)}`);
      const savedTs=run('_loadedTs');
      assert.ok(Number.isFinite(savedTs),`${scenario.name}会话存档缺少时间戳`);
      const before=state(run);
      virtualNow=savedTs+profile.offlineSec*1000;
      const settled=run('settleOffline()');
      assert.equal(settled?.ok,true,`${scenario.name}离线结算失败：${JSON.stringify({settled,
        now:Date.now(),virtualNow,loadedTs:run('_loadedTs'),savedTs})}`);
      assert.equal(settled.durationSec,profile.offlineSec,
        `${scenario.name}未完整结算${profile.offlineSec}秒离线窗`);
      assert.equal(settled.truncated,false,`${scenario.name}离线窗触发了时间或粮食截断`);
      const after=state(run);
      assert.equal(after.population,before.population,'离线结算改变了人口');
      assert.equal(after.capacity,before.capacity,'离线结算改变了住房容量');
      assert.equal(after.growthClock,before.growthClock,
        '离线结算改变了自然出生时钟');
      assert.equal(after.battleWins,0,'无战斗路线的胜场数发生变化');
      observeFood();
      offlineSessions.push({activeAt:activeSeconds,durationSec:settled.durationSec,
        before,after,gains:settled.gains,truncated:settled.truncated});
      nextPause+=profile.activeSec;
    }
  }

  function sellSurplus(key,tradeLog,segment){
    const amount=Math.floor(run(`S.res.${key}`)-reserves[key]);
    if(amount<1000)return false;
    const coinBefore=run('S.res.coin');
    const sale=run(`exchangeResource('${key}','coin',${amount})`);
    assert.equal(sale?.ok,true,`${scenario.name}/${segment}出售${key}失败：${JSON.stringify(sale)}`);
    observeFood();
    tradeLog.push({from:key,amount,coinBefore,coinAfter:run('S.res.coin'),coinReceived:sale.get,
      resourcesAfter:{wood:run('S.res.wood'),stone:run('S.res.stone'),food:run('S.res.food')}});
    return true;
  }
  function expandAndBirth(target,segment){
    const segmentStart=state(run);
    const segmentActiveStart=activeSeconds;
    const segmentOfflineStart=offlineSessions.length;
    const quote=run("settlementBatchPreview('village',1)");
    assert.equal(quote.ok,false,`${scenario.name}/${segment}应从地契不足开始`);
    assert.equal(quote.level,target-14,`${scenario.name}/${segment}聚落目标等级不符`);
    const deedCost=quote.cost;
    const rate=run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
    assert.ok(Number.isFinite(rate)&&rate>0,'市场缺少有效金币购地契汇率');
    const coinTarget=Math.ceil(deedCost/rate);
    assert.equal(coinTarget,deedCost*100,'地契价格须复现P122/P157的100金币/张');
    const sales=[];
    let guard=0;
    while(run('S.res.coin')+1e-7<coinTarget){
      assert.ok(++guard<100,`${scenario.name}/${segment}筹币循环异常`);
      let sold=false;
      for(const key of ['wood','stone','food'])if(sellSurplus(key,sales,segment))sold=true;
      if(run('S.res.coin')+1e-7>=coinTarget)break;
      if(sold)continue;
      const possible=['wood','stone','food'].filter(key=>
        reserves[key]+1000<=run(`resCap('${key}')`));
      assert.ok(possible.length>0,`${scenario.name}/${segment}仓容不足以筹币`);
      let waited=0;
      while(!possible.some(key=>run(`S.res.${key}>=${reserves[key]+1000}`))){
        assert.ok(waited++<20000,`${scenario.name}/${segment}生产等待超过上限`);
        tickOne();
      }
    }
    const deedTrade=run(`exchangeResource('coin','deed',${coinTarget})`);
    assert.equal(deedTrade?.ok,true,`${scenario.name}/${segment}购买地契失败：${JSON.stringify(deedTrade)}`);
    assert.equal(deedTrade.get,deedCost);
    const beforeExpansion=state(run);
    const expansion=run("upgradeSettlement('village')");
    assert.equal(expansion?.ok,true,`${scenario.name}/${segment}村庄扩容失败：${JSON.stringify(expansion)}`);
    assert.equal(run('maxPop()'),target);
    const beforeBirthTick=run('S.tick');
    let birthSeconds=0;
    while(run('popCurrent()')<target){
      assert.ok(birthSeconds++<20,`${scenario.name}/${segment}出生等待超过20秒`);
      tickOne();
    }
    const newWoodWorkers=run('S.popAlloc.wood||0')+1;
    const assigned=run(`setPopAlloc('wood',${newWoodWorkers})`);
    assert.equal(assigned?.ok,true,`${scenario.name}/${segment}木工分配失败：${JSON.stringify(assigned)}`);
    const end=state(run);
    assert.equal(end.population,target);
    assert.equal(end.capacity,target);
    assert.equal(end.battleWins,0);
    const saveResult=run('save()');
    assert.equal(saveResult?.ok,true,`${scenario.name}/${segment}存档失败`);
    const saveText=run("localStorage.getItem('rts_save')");
    const reloaded=environment({rts_save:saveText});
    assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
    assert.deepEqual(state(reloaded.run),end,`${scenario.name}/${segment}隔离保存重载不一致`);
    return{status:'complete',segment,segmentStart,deedCost,coinTarget,sales,
      deedTrade:{coinSpent:coinTarget,deedsReceived:deedTrade.get},expansion,
      activeOnlineSeconds:activeSeconds-segmentActiveStart,
      offlineWindows:offlineSessions.length-segmentOfflineStart,
      offlineSeconds:offlineSessions.slice(segmentOfflineStart).reduce((n,s)=>n+s.durationSec,0),
      elapsedSimulationSeconds:end.tick-segmentStart.tick,birthSeconds,beforeBirthTick,
      beforeExpansion,afterBirth:end,minObservedFood,woodRate:run("prodRate('wood')"),
      resourcesAfter:end.resources};
  }

  // Keep a separate clock snapshot around every offline window; offline settlement may not grow residents.
  const rawTick=run('S.tick');
  const step19=expandAndBirth(19,'18-to-19');
  const step20=expandAndBirth(20,'19-to-20');
  const final=state(run);
  assert.equal(final.population,20);
  assert.equal(final.capacity,20);
  assert.equal(final.battleWins,0);
  assert.ok(minObservedFood>=reserves.food-1e-9,
    `${scenario.name}市场交易或生产跌破粮食保留线：${minObservedFood}`);
  const finalSaveResult=run('save()');
  assert.equal(finalSaveResult?.ok,true,`${scenario.name}20人口终档保存失败`);
  const finalStateSave=run("localStorage.getItem('rts_save')");
  assert.equal(typeof finalStateSave,'string',`${scenario.name}缺少20人口真实序列化终档`);
  const finalReload=environment({rts_save:finalStateSave});
  assert.equal(finalReload.run('loadSaveAndApply().status'),'ok',`${scenario.name}20人口终档不能重载`);
  assert.deepEqual(state(finalReload.run),final,`${scenario.name}20人口终档重载状态不一致`);
  Date.now=originalDateNow;
  const continuousFullRouteSeconds=p157Baseline.totalNoWinOnlineSeconds;
  return{name:scenario.name,sourceRoute:source.route,
    sourceFirst18Tick:at18.second,sourceOnlineSeconds:source.activeOnlineSeconds,
    sourceOfflineSeconds:source.settledOfflineSeconds,sourceOfflineWindows:source.offlineSessions.length,
    post18SaveOffsetSimulationSeconds:start.tick-at18.second,
    start,stepResults:[step19,step20],activeOnlineSeconds:activeSeconds,
    continuationOfflineSeconds:offlineSessions.reduce((n,s)=>n+s.durationSec,0),
    continuationOfflineWindows:offlineSessions.length,offlineSessions,
    totalActiveOnlineSeconds:source.activeOnlineSeconds+activeSeconds,
    totalSettledOfflineSeconds:source.settledOfflineSeconds+
      offlineSessions.reduce((n,s)=>n+s.durationSec,0),
    totalOfflineWindows:source.offlineSessions.length+offlineSessions.length,
    continuousFrom18ActiveSeconds:p157Baseline.stepResults.reduce((n,s)=>n+s.elapsedSeconds,0),
    activeSecondsSavedVsContinuous:p157Baseline.stepResults.reduce((n,s)=>n+s.elapsedSeconds,0)-activeSeconds,
    continuousFullRouteSeconds,activeSecondsSavedFullRoute:continuousFullRouteSeconds-
      source.activeOnlineSeconds-activeSeconds,
    elapsedSimulationSeconds:final.tick-rawTick,final,finalStateSave,minObservedFood};
}

const p157=JSON.parse(fs.readFileSync(p157Path,'utf8'));
const results=scenarios.map(scenario=>{
  const baseline=p157.results.find(result=>result.name===scenario.name);
  assert.ok(baseline,`P157缺少${scenario.name}对照`);
  return runScenario(scenario,baseline);
});
const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p157-zero-win-population-18-to-20.json',
  'tools/verify/probe-population-early-18.js','tools/verify/probe-population-18-to-20-p157.js',
  'tools/verify/probe-population-short-session-18-to-20-p158.js'
];
const artifact={batch:'P158',unit:'active online seconds; settled offline seconds; residents; housing capacity; market trades; resources',
  method:'from fresh zero-win P101 routes using actual save()/settleOffline() every 600 active online seconds plus 28800 offline seconds, load the real serialized 18-resident save; continue the same cadence and extend two market-funded village levels through real exchange, expansion, online birth, save, and isolated reload actions',
  scope:'three economic/research profiles only; no battles, reward/resource injection, direct game-state edits, or player browser save; verify full short-session routes to 20 residents and distinguish offline time from active online time',
  sessionProfile:profile,reservePolicy:reserves,
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  results,inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P158',results:results.map(result=>({name:result.name,
  status:result.stepResults.every(step=>step.status==='complete')?'population-20-reached':'blocked',
  sourceActiveOnlineSeconds:result.sourceOnlineSeconds,
  continuationActiveOnlineSeconds:result.activeOnlineSeconds,
  totalActiveOnlineSeconds:result.totalActiveOnlineSeconds,
  sourceOfflineWindows:result.sourceOfflineWindows,
  continuationOfflineWindows:result.continuationOfflineWindows,
  totalOfflineWindows:result.totalOfflineWindows,
  totalOfflineSeconds:result.totalSettledOfflineSeconds,
  activeSecondsSavedVsContinuous:result.activeSecondsSavedVsContinuous,
  continuousFullRouteSeconds:result.continuousFullRouteSeconds,
  activeSecondsSavedFullRoute:result.activeSecondsSavedFullRoute,
  from18to19:result.stepResults[0].activeOnlineSeconds,from19to20:result.stepResults[1].activeOnlineSeconds,
  minFood:result.minObservedFood,population:result.final.population,capacity:result.final.capacity,
  battleWins:result.final.battleWins})),rawData:outputPath},null,2));
