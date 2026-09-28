'use strict';
// P193: acquire two residents from the exact paid P189/P190 L21 save using
// live market and settlement actions, preserving all original resource jobs.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p189Path=path.join(root,'docs/codex/reports/data/p189-current-third-chapter.json');
const p190Path=path.join(root,'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const outputPath=path.join(root,'docs/codex/reports/data/p193-current-third-chapter-population.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p189=JSON.parse(fs.readFileSync(p189Path,'utf8'));
const p190=JSON.parse(fs.readFileSync(p190Path,'utf8'));
const maxOnlineSeconds=7200,woodReserve=400;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
assert.equal(p189.batch,'P189');assert.equal(p190.batch,'P190');
for(const item of [...p189.inputs,...p190.inputs])
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P189/P190输入已变：${item.file}`);
assert.equal(sha(p189.l21Rebuilt.save),p189.l21Rebuilt.saveSha256,
  'P189完整L21真实胜档SHA不符');
assert.equal(p190.sourceSaveSha256,p189.l21Rebuilt.saveSha256,
  'P190和P189不是同一个L21起点');
function restore(save){
  const e=environment({rts_save:save});
  const loaded=e.run('loadSaveAndApply()');
  assert.equal(loaded?.status,'ok',`真实L21档无法重载：${JSON.stringify(loaded)}`);
  return e.run;
}
function state(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    free:popFree(),growthClock:S.population.growthClock,
    resources:{...S.res},workers:{...S.popAlloc},settlements:{...S.settlements},
    farm:{...bldSt('farm')},market:{...bldSt('market')},
    marketDaily:JSON.parse(JSON.stringify(S.daily)),
    foodRate:prodRate('food'),woodRate:prodRate('wood'),
    stoneRate:prodRate('stone'),coalRate:prodRate('coal'),
    copperRate:prodRate('copper'),populationFood:popCurrent()*(CFG.popFoodCost??0.1),
    army:armyCount(),upkeep:totalUpkeep(),defeated:[...S.defeated],
    queue:JSON.parse(JSON.stringify(S.queue)),
    pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    garrisonForm:JSON.parse(JSON.stringify(S._garrisonForm))})`));
}
function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}保存失败`);
  const save=run("localStorage.getItem('rts_save')");
  const next=restore(save);
  assert.deepEqual(state(next),state(run),`${label}保存重载状态不一致`);
  return{run:next,saveSha256:sha(save)};
}
let run=restore(p189.l21Rebuilt.save);
const start=state(run);
assert.equal(start.population,20);assert.equal(start.capacity,20);
assert.equal(start.resources.deed,0);
assert.equal(start.resources.coin,57);
assert.equal(start.market.lv,1);assert.equal(start.market.state,'idle');
assert.deepEqual({wood:start.workers.wood,stone:start.workers.stone,
  food:start.workers.food,coal:start.workers.coal,copper:start.workers.copper},
  {wood:3,stone:3,food:5,coal:6,copper:3});
assert.equal(start.army,43);
const gates=plain(run(`({marketOpen:scienceUnlocked(CFG.buildings.market.needScience),
  marketDailyLimit:marketDailyLimit(),availableRates:marketAvailableRates(),
  village:CFG.settlements.village,
  villageQuote:settlementBatchPreview('village',2,S.settlements.village),
  woodCapacity:resCap('wood'),coinCapacity:resCap('coin'),
  deedCapacity:resCap('deed'),foodCapacity:resCap('food'),
  popGrowthPer10s:popGrowthPer10s()})`));
assert.equal(gates.marketOpen,true);
assert.equal(gates.villageQuote.ok,false);
assert.equal(gates.villageQuote.cost,23);
assert.equal(gates.popGrowthPer10s,2);
const woodRate=gates.availableRates.find(x=>x.from==='wood'&&x.to==='coin');
const deedRate=gates.availableRates.find(x=>x.from==='coin'&&x.to==='deed');
assert.equal(woodRate?.rate,0.1);assert.equal(deedRate?.rate,0.01);
assert.equal(woodRate.early,true);assert.equal(deedRate.early,true);
const neededDeeds=gates.villageQuote.cost;
const targetCoin=Math.ceil(neededDeeds/deedRate.rate);
assert.equal(targetCoin,2300);
let onlineSeconds=0,minFoodTickEnd=start.resources.food;
const steps=[],sales=[];
function observe(){minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'))}
function tickOne(){
  assert.ok(onlineSeconds<maxOnlineSeconds,'P193在线秒数上限已到');
  run('tick()');onlineSeconds++;observe();
}
function trade(from,to,qty,label){
  const before=state(run);
  const q=plain(run(`globalThis.__p193Plan=marketTradePlan([{from:'${from}',to:'${to}',qty:${qty}}]);
    globalThis.__p193Plan`));
  assert.equal(q.ok,true,`${label}报价失败：${JSON.stringify(q)}`);
  assert.equal(q.trades.length,1);
  const committed=plain(run('commitMarketTradePlan(globalThis.__p193Plan)'));
  run('delete globalThis.__p193Plan');
  assert.equal(committed.ok,true,`${label}成交失败：${JSON.stringify(committed)}`);
  const after=reload(run,label);run=after.run;
  const result={label,tick:onlineSeconds,from,to,qty,
    rate:gates.availableRates.find(x=>x.from===from&&x.to===to).rate,
    grossOutput:qty*gates.availableRates.find(x=>x.from===from&&x.to===to).rate,
    credited:q.trades[0].get,
    roundingLoss:qty*gates.availableRates.find(x=>x.from===from&&x.to===to).rate-q.trades[0].get,
    before:{resources:before.resources,population:before.population,capacity:before.capacity},
    after:{resources:state(run).resources,population:state(run).population,
      capacity:state(run).capacity},saveSha256:after.saveSha256};
  steps.push(result);observe();return result;
}
let guard=0,block=null;
while(run('S.res.coin')<targetCoin&&onlineSeconds<maxOnlineSeconds){
  assert.ok(++guard<20,'P193筹币循环异常');
  const remainingCoin=targetCoin-run('S.res.coin');
  const qty=Math.min(Math.ceil(remainingCoin/woodRate.rate),
    gates.woodCapacity-woodReserve);
  assert.ok(qty>=10);
  while(run('S.res.wood')<woodReserve+qty&&onlineSeconds<maxOnlineSeconds)
    tickOne();
  if(onlineSeconds>=maxOnlineSeconds){block={reason:'wood-production-time',
    neededWood:woodReserve+qty,actualWood:run('S.res.wood'),
    coin:run('S.res.coin')};break;}
  sales.push(trade('wood','coin',qty,`第${sales.length+1}笔木材出售`));
}
let deedTrade=null,expansion=null,birth=null,assignment=null;
if(!block){
  assert.ok(run('S.res.coin')>=targetCoin);
  deedTrade=trade('coin','deed',targetCoin,'购买23张地契');
  assert.equal(deedTrade.credited,neededDeeds);
  const beforeExpansion=state(run);
  const preview=plain(run("settlementBatchPreview('village',2,S.settlements.village)"));
  assert.equal(preview.ok,true,`聚落扩容报价失败：${JSON.stringify(preview)}`);
  assert.equal(preview.cost,neededDeeds);
  const action=plain(run(`upgradeSettlementBatch('village',2,${beforeExpansion.settlements.village},${neededDeeds})`));
  assert.equal(action.ok,true,`真实聚落扩容失败：${JSON.stringify(action)}`);
  const expanded=reload(run,'村庄扩建两级');run=expanded.run;
  const afterExpansion=state(run);
  assert.equal(afterExpansion.capacity,22);assert.equal(afterExpansion.population,20);
  assert.equal(afterExpansion.resources.deed,0);
  expansion={preview,action,before:beforeExpansion,after:afterExpansion,
    saveSha256:expanded.saveSha256};
  const beforeBirth=state(run),tickBefore=onlineSeconds;
  while(run('popCurrent()')<22&&onlineSeconds<maxOnlineSeconds)tickOne();
  if(run('popCurrent()')<22)block={reason:'birth-time',
    population:run('popCurrent()'),capacity:run('maxPop()')};
  else{
    const born=reload(run,'22人口自然出生');run=born.run;
    birth={seconds:onlineSeconds-tickBefore,before:beforeBirth,
      after:state(run),saveSha256:born.saveSha256};
    assert.equal(birth.after.population,22);
    assert.equal(birth.after.free,2);
    const beforeAssign=state(run);
    const action=plain(run("setPopAlloc('food',7)"));
    assert.equal(action.ok,true,`真实新增粮工分配失败：${JSON.stringify(action)}`);
    const assigned=reload(run,'保留煤铜石岗位并增加两粮工');run=assigned.run;
    const afterAssign=state(run);
    assert.deepEqual({wood:afterAssign.workers.wood,stone:afterAssign.workers.stone,
      food:afterAssign.workers.food,coal:afterAssign.workers.coal,
      copper:afterAssign.workers.copper},
      {wood:3,stone:3,food:7,coal:6,copper:3});
    assert.equal(afterAssign.population,22);assert.equal(afterAssign.capacity,22);
    assignment={action,before:beforeAssign,after:afterAssign,
      saveSha256:assigned.saveSha256};
  }
}
const final=state(run);
const comparator=p190.profiles.find(p=>p.seed===1&&p.route==='secondBackFood7');
assert.ok(comparator,'P190缺少7粮工满73人真实样本');
const l30=comparator.stages.find(s=>s.stage===30);
assert.ok(l30?.recovery.ready,'P190 73人第30关战前未真实补齐');
const full73Upkeep=l30.recovery.economyAfter.armyUpkeep;
const hypothetical73=assignment?{
  foodOutput:final.foodRate,populationFood:final.populationFood,
  armyUpkeepFromP190Paid73:full73Upkeep,
  netFood:final.foodRate-final.populationFood-full73Upkeep,
  p190CoalShiftNetFood:l30.recovery.economyAfter.netFood,
  difference:final.foodRate-final.populationFood-full73Upkeep-
    l30.recovery.economyAfter.netFood,
  soldiersGranted:false}:null;
const woodSold=sales.reduce((sum,s)=>sum+s.qty,0);
const coinFromSales=sales.reduce((sum,s)=>sum+s.credited,0);
const totals={onlineSeconds,minFoodTickEnd,woodSold,coinFromSales,
  initialCoin:start.resources.coin,coinSpentOnDeeds:deedTrade?.qty||0,
  deedBought:deedTrade?.credited||0,
  endingWood:final.resources.wood,
  coalProductionPerSecondBefore:start.coalRate,
  coalProductionPerSecondAfter:final.coalRate,
  copperProductionPerSecondBefore:start.copperRate,
  copperProductionPerSecondAfter:final.copperRate,
  stoneProductionPerSecondBefore:start.stoneRate,
  stoneProductionPerSecondAfter:final.stoneRate};
const marketPricing={woodToCoin:woodRate.rate,
  coinToWood:run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='wood').rate"),
  coinToDeed:deedRate.rate,
  deedToCoin:run("CFG.market.rates.find(x=>x.from==='deed'&&x.to==='coin').rate"),
  woodToCoinRoundingLoss:sales.reduce((sum,s)=>sum+s.roundingLoss,0),
  deedPurchaseRoundingLoss:deedTrade?.roundingLoss||0,
  earlyTradesUsed:sales.length+(deedTrade?1:0),
  dailyLimitedTradesUsed:final.marketDaily.counts.market||0};
assert.equal(marketPricing.woodToCoinRoundingLoss,0);
assert.equal(marketPricing.deedPurchaseRoundingLoss,0);
assert.equal(marketPricing.dailyLimitedTradesUsed,0);
const finalSave=run("localStorage.getItem('rts_save')");
const finalSaveSha256=sha(finalSave);
assert.deepEqual(state(restore(finalSave)),final,'P193完整终档重载状态不一致');
function numericTrace(d){
  return{gates:d.gates,start:d.start,steps:d.steps.map(s=>({
    label:s.label,tick:s.tick,from:s.from,to:s.to,qty:s.qty,
    credited:s.credited,roundingLoss:s.roundingLoss,
    before:s.before,after:s.after})),
    expansion:d.expansion&&{preview:d.expansion.preview,
      action:d.expansion.action,before:d.expansion.before,after:d.expansion.after},
    birth:d.birth&&{seconds:d.birth.seconds,before:d.birth.before,after:d.birth.after},
    assignment:d.assignment&&{action:d.assignment.action,
      before:d.assignment.before,after:d.assignment.after},
    totals:d.totals,marketPricing:d.marketPricing,
    final:d.final,block:d.block,hypothetical73:d.hypothetical73};
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p189-current-third-chapter.json',
  'docs/codex/reports/data/p190-current-third-chapter-second-back.json',
  'tools/verify/probe-current-third-chapter-population-p193.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P193',unit:'simulated online seconds, resources, residents',
  sourceHead:head.stdout.trim(),sourceSaveSha256:p189.l21Rebuilt.saveSha256,
  method:'Load P189/P190 exact paid L21 save; quote and commit real early wood-to-coin sales, real coin-to-deed purchase, preview and commit two village upgrades, tick online until two births and assign two food workers while retaining all original wood/stone/coal/copper jobs; save/reload after every milestone; do not grant soldiers or fight',
  scope:{maxOnlineSeconds,woodReserve,sourcePopulation:20,targetPopulation:22,
    noOffline:true,noCombat:true,noGarrison:true},gates,start,steps,sales,
  deedTrade,expansion,birth,assignment,totals,marketPricing,
  final,finalSaveSha256,finalSave,block,hypothetical73,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
if(priorData){
  assert.equal(priorData.batch,'P193');
  if(priorData.marketPricing)
    assert.deepEqual(numericTrace(artifact),numericTrace(priorData),
      'P193复跑数值轨迹不一致');
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P193',sourceSaveSha256:artifact.sourceSaveSha256,
  gates:{initialQuote:gates.villageQuote,foodRate:start.foodRate,
    woodRate:start.woodRate,marketDailyLimit:gates.marketDailyLimit},
  sales:sales.map(s=>({qty:s.qty,coin:s.credited,tick:s.tick,
    roundingLoss:s.roundingLoss})),deedTrade:deedTrade&&{
    coinSpent:deedTrade.qty,deeds:deedTrade.credited},
  expansion:expansion&&{cost:expansion.action.cost,
    capacity:expansion.after.capacity},
  birth:birth&&{seconds:birth.seconds,population:birth.after.population},
  assignment:assignment&&{workers:assignment.after.workers,
    foodRate:assignment.after.foodRate},totals,marketPricing,
  finalSaveSha256,block,hypothetical73,
  rawData:outputPath},null,2));
