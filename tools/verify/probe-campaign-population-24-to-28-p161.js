'use strict';
// P161 continues both serialized P160 staffing routes from 24 to 28 residents.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p160Path='tools/verify/probe-campaign-population-20-to-24-p160.js';
const p160DataPath='docs/codex/reports/data/p160-campaign-population-20-to-24.json';
const outputPath=path.join(root,'docs/codex/reports/data/p161-campaign-population-24-to-28.json');
const profile={activeSec:600,offlineSec:28800};
const reserves={wood:100,stone:1000,food:1000};
const targets=[25,26,27,28];

function hash(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function verifyInputs(data,label){
  for(const input of data.inputs||[])
    assert.equal(hash(input.file),input.sha256,`${label}输入SHA已变化：${input.file}`);
}
function state(run){
  return JSON.parse(JSON.stringify(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    allocated:popAllocTotal(),free:popFree(),growthClock:S.population.growthClock,
    workers:{...S.popAlloc},resources:{...S.res},settlements:{...S.settlements},
    battleWins:S.defeated.length,queue:{...S.queue}})`)));
}

const headResult=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(headResult.status,0,`读取HEAD失败：${headResult.stderr||''}`);
const head=headResult.stdout.trim();
const p160=JSON.parse(fs.readFileSync(path.join(root,p160DataPath),'utf8'));
assert.equal(p160.sourceHead,head,'P160隔离终档必须与当前HEAD一致');
verifyInputs(p160,'P160');
assert.equal(p160.batch,'P160');
assert.equal(p160.results.length,2);
for(const route of p160.results){
  assert.equal(route.status,'population-24-reached',`${route.name}没有到达24人口`);
  assert.equal(route.final.population,24,`${route.name}摘要人口不是24`);
  assert.equal(route.final.capacity,24,`${route.name}摘要住房不是24`);
  assert.equal(typeof route.finalStateSave,'string',`${route.name}缺少24人口隔离终档`);
  const saved=JSON.parse(route.finalStateSave);
  assert.equal(saved.population.current,24,`${route.name}序列化存档人口不是24`);
  assert.equal(saved.res.deed,0,`${route.name}序列化存档残留地契`);
  assert.equal(saved.defeated.length,11,`${route.name}战役胜场发生变化`);
}

function runScenario(sourceRoute){
  const name=`${sourceRoute.name}-24-to-28`;
  const sourceSave=JSON.parse(sourceRoute.finalStateSave);
  const originalDateNow=Date.now;
  const startTs=Number(sourceSave.ts);
  assert.ok(Number.isFinite(startTs),`${name}来源存档缺少有效时间戳`);
  let virtualNow=startTs;
  Date.now=()=>virtualNow;
  try{
    const e=environment({rts_save:sourceRoute.finalStateSave});
    const run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok',`${name}无法读取P160终档`);
    const start=state(run);
    assert.deepEqual(start,sourceRoute.final,`${name}真实重载状态与P160摘要不一致`);
    assert.equal(start.population,24);
    assert.equal(start.capacity,24);
    assert.equal(start.battleWins,11);
    assert.equal(start.resources.deed,0);
    const staffingStart={...start.workers};
    run(`(()=>{const g=globalThis;g.__p160MinFoodCandidate=Number(S.res.food)||0;
      const original=productionSecond;
      productionSecond=function(...args){const next=original(...args);
        if(Number.isFinite(next.food))g.__p160MinFoodCandidate=Math.min(g.__p160MinFoodCandidate,next.food);
        return next;};})()`);

    let activeSeconds=0;
    let nextPause=profile.activeSec-(sourceRoute.totalActiveOnlineSeconds%profile.activeSec);
    if(nextPause===0)nextPause=profile.activeSec;
    let minObservedFood=run('S.res.food');
    let pauseReason=null;
    const offlineSessions=[];
    const steps=[];
    function observeFood(){
      minObservedFood=Math.min(minObservedFood,run('S.res.food'),run('globalThis.__p160MinFoodCandidate'));
    }
    function tickOne(){
      if(pauseReason)return;
      run('tick()');
      activeSeconds++;
      virtualNow+=1000;
      observeFood();
      if(activeSeconds>=nextPause){
        const saved=run('save()');
        assert.equal(saved?.ok,true,`${name}会话边界保存失败：${JSON.stringify(saved)}`);
        const savedTs=Number(run('_loadedTs'));
        assert.ok(Number.isFinite(savedTs),`${name}会话边界缺少存档时间戳`);
        const before=state(run);
        virtualNow=savedTs+profile.offlineSec*1000;
        const settled=run('settleOffline()');
        assert.equal(settled?.ok,true,`${name}离线结算调用失败：${JSON.stringify(settled)}`);
        const after=state(run);
        assert.equal(after.population,before.population,`${name}离线改变人口`);
        assert.equal(after.capacity,before.capacity,`${name}离线改变住房容量`);
        assert.equal(after.growthClock,before.growthClock,`${name}离线推进自然出生时钟`);
        observeFood();
        offlineSessions.push({activeAt:sourceRoute.totalActiveOnlineSeconds+activeSeconds,
          requestedSeconds:profile.offlineSec,actualSeconds:settled.durationSec,
          truncated:!!settled.truncated,before,after});
        if(settled.durationSec!==profile.offlineSec||settled.truncated){
          pauseReason='offline-truncated';
          return;
        }
        nextPause+=profile.activeSec;
      }
    }
    function sellSurplus(key,sales,segment){
      const amount=Math.floor(run(`S.res.${key}`)-reserves[key]);
      if(amount<1000)return false;
      const coinBefore=run('S.res.coin');
      const sale=run(`exchangeResource('${key}','coin',${amount})`);
      if(!sale?.ok)throw Error(`${name}/${segment}出售${key}失败：${JSON.stringify(sale)}`);
      observeFood();
      sales.push({from:key,amount,coinBefore,coinAfter:run('S.res.coin'),coinReceived:sale.get,
        resourcesAfter:{wood:run('S.res.wood'),stone:run('S.res.stone'),food:run('S.res.food')}});
      return true;
    }
    function expandAndBirth(target){
      const segment=`${target-1}-to-${target}`;
      const segmentStart=state(run);
      const activeStart=activeSeconds;
      const offlineStart=offlineSessions.length;
      const quote=run("settlementBatchPreview('village',1)");
      assert.equal(quote.ok,false,`${name}/${segment}必须从地契不足报价开始`);
      const deedCost=quote.cost;
      const rate=run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
      assert.ok(Number.isFinite(rate)&&rate>0,'缺少有效早期金币购契汇率');
      const coinTarget=Math.ceil(deedCost/rate);
      assert.equal(coinTarget,deedCost*100,`${name}/${segment}地契汇率不再是100金币/张`);
      const sales=[];
      let guard=0;
      while(run('S.res.coin')+1e-7<coinTarget){
        assert.ok(++guard<100,`${name}/${segment}筹币循环异常`);
        let sold=false;
        for(const key of ['wood','stone','food'])if(sellSurplus(key,sales,segment))sold=true;
        if(run('S.res.coin')+1e-7>=coinTarget)break;
        if(sold)continue;
        const possible=['wood','stone','food'].filter(key=>
          reserves[key]+1000<=run(`resCap('${key}')`));
        if(possible.length===0)return{status:'blocked-storage',segment,segmentStart,deedCost,coinTarget,sales,
          activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
        let waited=0;
        while(!pauseReason&&!possible.some(key=>run(`S.res.${key}>=${reserves[key]+1000}`))){
          if(waited++>=20000)return{status:'blocked-production',segment,segmentStart,deedCost,coinTarget,sales,
            activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})'),possible};
          tickOne();
        }
        if(pauseReason)return{status:pauseReason,segment,segmentStart,deedCost,coinTarget,sales,
          activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
      }
      const bought=run(`exchangeResource('coin','deed',${coinTarget})`);
      assert.equal(bought?.ok,true,`${name}/${segment}购买地契失败：${JSON.stringify(bought)}`);
      assert.equal(bought.get,deedCost);
      const beforeExpansion=state(run);
      const expansion=run("upgradeSettlement('village')");
      assert.equal(expansion?.ok,true,`${name}/${segment}村庄扩建失败：${JSON.stringify(expansion)}`);
      assert.equal(run('maxPop()'),target,`${name}/${segment}扩建容量错误`);
      const beforeBirthTick=run('S.tick');
      let birthSeconds=0;
      while(run('popCurrent()')<target){
        if(pauseReason)return{status:pauseReason,segment,segmentStart,deedCost,coinTarget,sales,
          activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
        if(birthSeconds>=20)return{status:'blocked-birth',segment,segmentStart,deedCost,coinTarget,sales,
          activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
        tickOne();birthSeconds++;
      }
      const woodWorkers=run('S.popAlloc.wood||0')+1;
      const assigned=run(`setPopAlloc('wood',${woodWorkers})`);
      assert.equal(assigned?.ok,true,`${name}/${segment}新增居民岗位分配失败：${JSON.stringify(assigned)}`);
      const end=state(run);
      assert.equal(end.population,target);
      assert.equal(end.capacity,target);
      assert.equal(end.battleWins,start.battleWins);
      const saved=run('save()');
      assert.equal(saved?.ok,true,`${name}/${segment}隔离存档失败`);
      const reloaded=environment({rts_save:run("localStorage.getItem('rts_save')")});
      assert.equal(reloaded.run('loadSaveAndApply().status'),'ok',`${name}/${segment}存档重载失败`);
      assert.deepEqual(state(reloaded.run),end,`${name}/${segment}保存重载状态不一致`);
      const result={status:'complete',segment,segmentStart,deedCost,coinTarget,sales,
        deedTrade:{coinSpent:coinTarget,deedsReceived:bought.get},expansion,
        activeSeconds:activeSeconds-activeStart,offlineWindows:offlineSessions.length-offlineStart,
        offlineSeconds:offlineSessions.slice(offlineStart).reduce((sum,window)=>sum+window.actualSeconds,0),
        elapsedSimulationSeconds:end.tick-segmentStart.tick,birthSeconds,beforeBirthTick,
        beforeExpansion,afterBirth:end};
      steps.push(result);
      return result;
    }

    let status='population-28-reached';
    let blockedAt=null;
    for(const target of targets){
      const result=expandAndBirth(target);
      if(result.status!=='complete'){
        status=result.status;
        blockedAt=result.segment;
        steps.push(result);
        break;
      }
    }
    const final=state(run);
    const finalSaveResult=run('save()');
    assert.equal(finalSaveResult?.ok,true,`${name}终档隔离保存失败：${JSON.stringify(finalSaveResult)}`);
    const finalStateSave=run("localStorage.getItem('rts_save')");
    assert.equal(typeof finalStateSave,'string',`${name}终档未写入隔离存储`);
    const finalReload=environment({rts_save:finalStateSave});
    assert.equal(finalReload.run('loadSaveAndApply().status'),'ok',`${name}24人口终档不能真实重载`);
    assert.deepEqual(state(finalReload.run),final,`${name}24人口终档保存重载状态不一致`);
    const fullOfflineWindows=offlineSessions.every(window=>
      window.actualSeconds===profile.offlineSec&&!window.truncated);
    const foodReserveMaintained=minObservedFood>=reserves.food-1e-9;
    return{name,sourceScenario:sourceRoute.name,status,blockedAt,staffingStart,start,steps,offlineSessions,
      activeOnlineSeconds:activeSeconds,offlineSeconds:offlineSessions.reduce((sum,window)=>sum+window.actualSeconds,0),
      totalActiveOnlineSeconds:sourceRoute.totalActiveOnlineSeconds+activeSeconds,
      totalOfflineSeconds:sourceRoute.totalOfflineSeconds+
        offlineSessions.reduce((sum,window)=>sum+window.actualSeconds,0),
      totalOfflineWindows:sourceRoute.totalOfflineWindows+offlineSessions.length,
      fullOfflineWindows,foodReserveMaintained,minObservedFood,final,finalStateSave};
  }finally{
    Date.now=originalDateNow;
  }
}

const results=[
  runScenario(p160.results[0]),
  runScenario(p160.results[1])
];
const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  p160Path,p160DataPath,'tools/verify/probe-campaign-population-24-to-28-p161.js'
];
const artifact={batch:'P161',unit:'active online seconds; offline seconds; population; housing capacity; deeds; resources; food reserve',
  method:'continue the exact serialized P160 24-resident endings of both staffing routes; use current market, village upgrade, online natural birth, save/reload, and settleOffline() functions through population 28 or first blocking condition',
  scope:'two P160 staffing endpoints from one P159 no-deed L1-L11 route; no new campaign or deed rewards; no injected resources or direct game-state edits; no player save; 600 active online seconds plus 28800 offline seconds; preserve 100 wood, 1000 stone, and 1000 food as market reserves',
  sourceHead:head,sourceBatch:'P160',sourceStates:p160.results.map(route=>({name:route.name,final:route.final})),
  sessionProfile:profile,reservePolicy:reserves,results,
  inputs:inputFiles.map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P161',results:results.map(result=>({name:result.name,sourceScenario:result.sourceScenario,status:result.status,
  blockedAt:result.blockedAt,activeOnlineSeconds:result.activeOnlineSeconds,
  offlineWindows:result.offlineSessions.length,offlineSeconds:result.offlineSeconds,
  totalActiveOnlineSeconds:result.totalActiveOnlineSeconds,totalOfflineWindows:result.totalOfflineWindows,
  totalOfflineSeconds:result.totalOfflineSeconds,fullOfflineWindows:result.fullOfflineWindows,
  foodReserveMaintained:result.foodReserveMaintained,minFood:result.minObservedFood,
  levelsCompleted:result.steps.filter(step=>step.status==='complete').map(step=>step.segment),
  finalPopulation:result.final.population,finalCapacity:result.final.capacity,
  finalFood:result.final.resources.food,finalDeed:result.final.resources.deed})),rawData:outputPath},null,2));
