'use strict';
// P164 continues P158's serialized zero-win short-session routes from 20 to 28 residents.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p158Path='tools/verify/probe-population-short-session-18-to-20-p158.js';
const p158DataPath='docs/codex/reports/data/p158-short-session-population-18-to-20.json';
const outputPath=path.join(root,'docs/codex/reports/data/p164-zero-win-population-20-to-28.json');
const profile={activeSec:600,offlineSec:28800};
const reserves={wood:100,stone:1000,food:1000};
const targets=[21,22,23,24,25,26,27,28];

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
const p158=JSON.parse(fs.readFileSync(path.join(root,p158DataPath),'utf8'));
assert.equal(p158.sourceHead,head,'P158隔离终档必须与当前HEAD一致');
verifyInputs(p158,'P158');
assert.equal(p158.batch,'P158');
assert.equal(p158.results.length,3,'P158必须包含三条零胜场短会话路线');
for(const route of p158.results){
  assert.equal(route.final.population,20,`${route.name}摘要人口不是20`);
  assert.equal(route.final.capacity,20,`${route.name}摘要住房不是20`);
  assert.equal(route.final.battleWins,0,`${route.name}来源路线不是零胜场`);
  assert.equal(route.final.resources.deed,0,`${route.name}终档残留地契`);
  assert.equal(typeof route.finalStateSave,'string',`${route.name}缺少可续接的20人口真实存档`);
  const saved=JSON.parse(route.finalStateSave);
  assert.equal(saved.population.current,20,`${route.name}序列化人口不是20`);
  assert.equal(saved.res.deed,0,`${route.name}序列化存档残留地契`);
  assert.equal(saved.defeated.length,0,`${route.name}序列化存档存在关卡胜场`);
}

function runScenario(sourceRoute){
  const name=`${sourceRoute.name}-20-to-28`;
  const sourceSave=JSON.parse(sourceRoute.finalStateSave);
  const originalDateNow=Date.now;
  const startTs=Number(sourceSave.ts);
  assert.ok(Number.isFinite(startTs),`${name}来源存档缺少有效时间戳`);
  let virtualNow=startTs;
  Date.now=()=>virtualNow;
  try{
    const e=environment({rts_save:sourceRoute.finalStateSave});
    const run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok',`${name}无法读取P158终档`);
    const start=state(run);
    for(const [key,value] of Object.entries(sourceRoute.final))
      assert.deepEqual(start[key],value,`${name}真实重载字段${key}与P158摘要不一致`);
    assert.equal(start.population,20);
    assert.equal(start.capacity,20);
    assert.equal(start.battleWins,0);
    assert.equal(start.resources.deed,0);
    const staffingStart={...start.workers};
    run(`(()=>{const g=globalThis;g.__p164MinFoodCandidate=Number(S.res.food)||0;
      const original=productionSecond;
      productionSecond=function(...args){const next=original(...args);
        if(Number.isFinite(next.food))g.__p164MinFoodCandidate=Math.min(g.__p164MinFoodCandidate,next.food);
        return next;};})()`);

    let activeSeconds=0;
    let nextPause=profile.activeSec-(sourceRoute.totalActiveOnlineSeconds%profile.activeSec);
    if(nextPause===0)nextPause=profile.activeSec;
    let minObservedFood=run('S.res.food');
    let pauseReason=null;
    const offlineSessions=[];
    const steps=[];
    function observeFood(){
      minObservedFood=Math.min(minObservedFood,run('S.res.food'),run('globalThis.__p164MinFoodCandidate'));
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
      assert.equal(end.battleWins,0,`${name}/${segment}不应增加关卡胜场`);
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
    assert.equal(finalReload.run('loadSaveAndApply().status'),'ok',`${name}终档不能真实重载`);
    assert.deepEqual(state(finalReload.run),final,`${name}终档保存重载状态不一致`);
    const fullOfflineWindows=offlineSessions.every(window=>
      window.actualSeconds===profile.offlineSec&&!window.truncated);
    const foodReserveMaintained=minObservedFood>=reserves.food-1e-9;
    return{name,status,blockedAt,staffingStart,start,steps,offlineSessions,
      activeOnlineSeconds:activeSeconds,offlineSeconds:offlineSessions.reduce((sum,window)=>sum+window.actualSeconds,0),
      totalActiveOnlineSeconds:sourceRoute.totalActiveOnlineSeconds+activeSeconds,
      totalOfflineSeconds:sourceRoute.totalSettledOfflineSeconds+
        offlineSessions.reduce((sum,window)=>sum+window.actualSeconds,0),
      totalOfflineWindows:sourceRoute.totalOfflineWindows+offlineSessions.length,
      fullOfflineWindows,foodReserveMaintained,minObservedFood,final,finalStateSave};
  }finally{
    Date.now=originalDateNow;
  }
}

const results=p158.results.map(runScenario);
const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  p158Path,p158DataPath,'tools/verify/probe-zero-win-population-20-to-28-p164.js'
];
const artifact={batch:'P164',unit:'active online seconds; offline seconds; population; housing capacity; deeds; resources; food reserve',
  method:'continue each exact serialized P158 zero-win short-session route from 20 to 28 residents; use current market sales, deed purchase, village upgrade, online natural birth, save/reload, and settleOffline() actions; include the first blocking condition if a route cannot reach 28',
  scope:'three P158 zero-win economic/research routes; no campaign wins, reward injection, direct game-state edits, or player save; 600 active online seconds plus 28800 offline seconds; preserve 100 wood, 1000 stone, and 1000 food as market reserves',
  sourceHead:head,sourceBatch:'P158',sourceState:p158.results.map(route=>({name:route.name,final:route.final})),
  sessionProfile:profile,reservePolicy:reserves,results,
  inputs:inputFiles.map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P164',results:results.map(result=>({name:result.name,status:result.status,
  blockedAt:result.blockedAt,activeOnlineSeconds:result.activeOnlineSeconds,
  offlineWindows:result.offlineSessions.length,offlineSeconds:result.offlineSeconds,
  totalActiveOnlineSeconds:result.totalActiveOnlineSeconds,totalOfflineWindows:result.totalOfflineWindows,
  totalOfflineSeconds:result.totalOfflineSeconds,fullOfflineWindows:result.fullOfflineWindows,
  foodReserveMaintained:result.foodReserveMaintained,minFood:result.minObservedFood,
  levelsCompleted:result.steps.filter(step=>step.status==='complete').map(step=>step.segment),
  finalPopulation:result.final.population,finalCapacity:result.final.capacity,
  finalFood:result.final.resources.food,finalDeed:result.final.resources.deed})),rawData:outputPath},null,2));
