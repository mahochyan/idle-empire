'use strict';
// P157 extends P122's three zero-win economic/research routes from 19 to 20 residents.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const p122Path=path.join(root,'docs/codex/reports/data/p122-zero-win-population-routes.json');
const outputPath=path.join(root,'docs/codex/reports/data/p157-zero-win-population-18-to-20.json');
const reserves={wood:100,stone:1000,food:1000};
const scenarios=[
  {name:'sequential-expansion',args:[]},
  {name:'research-priority-4',args:['--research-workers=4']},
  {name:'research-priority-7',args:['--research-workers=7']}
];

function child(script,args){
  return spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
}
function state(run){
  return run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),allocated:popAllocTotal(),
    free:popFree(),workers:{...S.popAlloc},resources:{...S.res},settlements:{...S.settlements},
    battleWins:S.defeated.length})`);
}

function runScenario(scenario){
  const sourceResult=child(populationProbe,[...scenario.args,'--capture-final-save']);
  assert.equal(sourceResult.status,0,
    `P101来源路线${scenario.name}失败：${sourceResult.stderr||sourceResult.stdout}`);
  const source=JSON.parse(sourceResult.stdout);
  assert.equal(source.battleWins,0);
  const at18=source.milestones.find(x=>x.label==='population-18');
  assert.ok(at18,`${scenario.name}缺少18人口检查点`);
  const e=environment({rts_save:source.finalStateSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.defeated.length'),0);
  assert.equal(run('popCurrent()'),18);
  assert.equal(run('maxPop()'),18);

  const start=state(run);
  let elapsedTicks=0;
  let minFood=run('S.res.food');
  const stepResults=[];
  function tickOne(){
    run('tick()');
    elapsedTicks++;
    minFood=Math.min(minFood,run('S.res.food'));
  }
  function sellSurplus(key,tradeLog,segment){
    const amount=Math.floor(run(`S.res.${key}`)-reserves[key]);
    if(amount<1000)return false;
    const coinBefore=run('S.res.coin');
    const sale=run(`exchangeResource('${key}','coin',${amount})`);
    if(!sale?.ok)throw Error(`${scenario.name}/${segment}出售${key}失败：${JSON.stringify(sale)}`);
    tradeLog.push({from:key,amount,coinBefore,coinAfter:run('S.res.coin'),coinReceived:sale.get,
      resourcesAfter:{wood:run('S.res.wood'),stone:run('S.res.stone'),food:run('S.res.food')}});
    minFood=Math.min(minFood,run('S.res.food'));
    return true;
  }
  function expandAndBirth(targetPopulation,segment){
    const segmentStart=state(run);
    const quote=run("settlementBatchPreview('village',1)");
    assert.equal(quote.ok,false,`${scenario.name}/${segment}应从可见地契不足报价开始`);
    assert.equal(quote.level,targetPopulation-14,
      `${scenario.name}/${segment}聚落目标级别不符`);
    const deedCost=quote.cost;
    const rate=run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
    assert.ok(Number.isFinite(rate)&&rate>0,'市场缺少有效的金币购地契汇率');
    const coinTarget=Math.ceil(deedCost/rate);
    assert.equal(coinTarget,deedCost*100,'P122使用的100金币/地契价格应保持一致');
    const sales=[];
    const tickStart=elapsedTicks;
    let guard=0;
    while(run('S.res.coin')+1e-7<coinTarget){
      assert.ok(++guard<100,`${scenario.name}/${segment}筹币动作循环异常`);
      let sold=false;
      for(const key of ['wood','stone','food'])
        if(sellSurplus(key,sales,segment))sold=true;
      if(run('S.res.coin')+1e-7>=coinTarget)break;
      if(sold)continue;
      const possible=['wood','stone','food'].filter(key=>
        reserves[key]+1000<=run(`resCap('${key}')`));
      if(possible.length===0){
        return {status:'blocked-storage',segment,segmentStart,deedCost,coinTarget,sales,
          elapsedSeconds:elapsedTicks-tickStart,minFood,resources:run('({...S.res})'),
          capacities:Object.fromEntries(['wood','stone','food'].map(key=>[key,run(`resCap('${key}')`)]))};
      }
      let seconds=0;
      while(!possible.some(key=>run(`S.res.${key}>=${reserves[key]+1000}`))){
        if(seconds>=20000){
          return {status:'blocked-production',segment,segmentStart,deedCost,coinTarget,sales,
            elapsedSeconds:elapsedTicks-tickStart,minFood,resources:run('({...S.res})'),possible};
        }
        tickOne();seconds++;
      }
    }
    const deedTrade=run(`exchangeResource('coin','deed',${coinTarget})`);
    assert.equal(deedTrade?.ok,true,
      `${scenario.name}/${segment}购买地契失败：${JSON.stringify(deedTrade)}`);
    assert.equal(deedTrade.get,deedCost,`${scenario.name}/${segment}购买地契数不符`);
    const beforeExpansion=state(run);
    const expansion=run("upgradeSettlement('village')");
    assert.equal(expansion?.ok,true,
      `${scenario.name}/${segment}真实聚落扩容失败：${JSON.stringify(expansion)}`);
    assert.equal(run('maxPop()'),targetPopulation,
      `${scenario.name}/${segment}扩容后容量不符`);
    const beforeBirthTick=run('S.tick');
    let birthSeconds=0;
    while(run('popCurrent()')<targetPopulation){
      if(birthSeconds>=20)throw Error(`${scenario.name}/${segment}扩容后自然出生超过20秒`);
      tickOne();birthSeconds++;
    }
    assert.equal(run('popCurrent()'),targetPopulation);
    const woodBefore=run('S.popAlloc.wood||0');
    const assign=run(`setPopAlloc('wood',${woodBefore+1})`);
    assert.equal(assign?.ok,true,
      `${scenario.name}/${segment}新增居民分配到木工失败：${JSON.stringify(assign)}`);
    assert.ok(run('popAllocTotal()')<=run('popCurrent()'));
    assert.equal(run('S.defeated.length'),0);
    const end=state(run);
    const saved=run('save()');
    assert.equal(saved?.ok,true,`${scenario.name}/${segment}存档失败`);
    const serialized=run("localStorage.getItem('rts_save')");
    const reloaded=environment({rts_save:serialized});
    assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
    const reloadedSnapshot=JSON.parse(JSON.stringify(reloaded.run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
      allocated:popAllocTotal(),deed:S.res.deed,settlements:{...S.settlements}})`)));
    const expectedSnapshot=JSON.parse(JSON.stringify(
      {tick:end.tick,population:end.population,capacity:end.capacity,allocated:end.allocated,
        deed:end.resources.deed,settlements:end.settlements}));
    assert.deepEqual(reloadedSnapshot,expectedSnapshot,
      `${scenario.name}/${segment}存档重载状态不一致`);
    return {status:'complete',segment,segmentStart,deedCost,coinTarget,sales,
      deedTrade:{coinSpent:coinTarget,deedsReceived:deedTrade.get},expansion,
      elapsedSeconds:elapsedTicks-tickStart,birthSeconds,beforeBirthTick,
      beforeExpansion,afterBirth:end,minFood,woodRate:run("prodRate('wood')"),
      resourcesAfter:end.resources};
  }

  const step19=expandAndBirth(19,'18-to-19');
  stepResults.push(step19);
  if(step19.status!=='complete')
    return {name:scenario.name,sourceRoute:source.route,status:step19.status,source,
      start,at18,stepResults,elapsedFromFirst18ToCurrent:run('S.tick')-at18.second};
  const step20=expandAndBirth(20,'19-to-20');
  stepResults.push(step20);
  assert.ok(minFood>=reserves.food-1e-9,
    `${scenario.name}市场交易或在线推进跌破粮食保留线：${minFood}`);
  return {name:scenario.name,sourceRoute:source.route,
    status:step20.status==='complete'?'population-20-reached':step20.status,
    sourceOnlineSeconds:source.activeOnlineSeconds,sourceElapsedSimulationSeconds:source.elapsedSimulationSeconds,
    firstPopulation14Seconds:source.milestones.find(x=>x.label==='population-14').second,
    firstPopulation18Seconds:at18.second,post18ValidationSeconds:start.tick-at18.second,
    start,at18,stepResults,elapsedFromFirst18To19:step19.afterBirth.tick-at18.second,
    elapsedFrom19To20:step20.status==='complete'?step20.afterBirth.tick-step19.afterBirth.tick:null,
    elapsedFromFirst18To20:step20.status==='complete'?step20.afterBirth.tick-at18.second:null,
    totalNoWinOnlineSeconds:source.activeOnlineSeconds+elapsedTicks,
    final:state(run),minFood,battleWins:run('S.defeated.length')};
}

const p122=JSON.parse(fs.readFileSync(p122Path,'utf8'));
const results=scenarios.map(scenario=>runScenario(scenario));
for(const result of results){
  const baseline=p122.scenarios.find(x=>x.name===result.name);
  assert.ok(baseline,`P122缺少${result.name}基线`);
  assert.equal(result.firstPopulation18Seconds,baseline.firstPopulation18Seconds,
    `${result.name} P101到18人口时点与P122不一致`);
  assert.equal(result.elapsedFromFirst18To19,baseline.elapsedFromFirst18To19,
    `${result.name} 18→19复跑必须重现P122时点`);
  assert.equal(result.stepResults[0].elapsedSeconds,baseline.marketToBirthSeconds,
    `${result.name} P121基准续接耗时必须重现`);
}

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','docs/codex/reports/data/p122-zero-win-population-routes.json',
  'tools/verify/probe-population-early-18.js','tools/verify/probe-market-population-19-p121.js',
  'tools/verify/probe-market-population-routes-p122.js','tools/verify/probe-population-18-to-20-p157.js'
];
const artifact={batch:'P157',unit:'simulated online seconds; residents; housing capacity; market trades; deeds; resources',
  method:'continue the three exact P122 zero-win economic/research profiles using real serialized P101 saves, current market exchanges, village upgrades, online birth ticks, and job assignment; preserve P122 reserves of 100 wood, 1000 stone, and 1000 food at each expansion',
  scope:'economic/research profiles only; no battles, candidate rewards, injected resources, direct state edits, or player-save writes; test next market-funded village steps from 18 to 20 residents',
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  reservePolicy:reserves,p122FirstStepBaselineVerified:true,
  results,
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P157',results:results.map(x=>({name:x.name,status:x.status,
  first18:x.firstPopulation18Seconds,first19:x.elapsedFromFirst18To19,
  nextHousing:x.elapsedFrom19To20??null,total18To20:x.elapsedFromFirst18To20??null,
  blockedAt:x.stepResults.find(s=>s.status!=='complete')?.segment??null,
  population:x.final?.population,capacity:x.final?.capacity,minFood:x.minFood,
  battleWins:x.battleWins})),rawData:outputPath},null,2));
