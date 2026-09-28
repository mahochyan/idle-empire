'use strict';
// P80：从P79同一已付档逐级扩城市与铸币厂，真实市场购契、出生与岗位分配。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p79-electric16-paid.json'),'utf8');
const outArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.settlements.city'),28);
assert.equal(run('popCurrent()'),126);
assert.equal(run('S.killValues.godGuardian'),4500);
assert.equal(run('S.eraStorage.electricKnowledge'),16);
const start=run('S.tick');
const initial=run("({tick:S.tick,pop:popCurrent(),capacity:maxPop(),city:S.settlements.city,mint:bldSt('mint').lv,stone:S.res.stone,food:S.res.food,coin:S.res.coin,coinCap:resCap('coin'),army:armyCount(),medal:S.res.medal,knowledgeCap:resCap('tech')})");
let ticks=0,allocationActions=0,marketActions=0,cityActions=0,mintActions=0,deeds=0,stoneSold=0;
const mintPayments=[];
const action=(expr,label)=>{const x=run(expr);assert.equal(x?.ok,true,`${label}: ${JSON.stringify(x)}`);return x};
function wait(condition,max=50000){
  const x=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  ticks+=x.n;assert.equal(x.ok,true,`等待超时 ${condition}: ${JSON.stringify(run("({tick:S.tick,pop:popCurrent(),max:maxPop(),res:S.res,alloc:S.popAlloc})"))}`);
  return x.n;
}
function setAlloc(key,count){action(`setPopAlloc('${key}',${count})`,`分配${key}`);allocationActions++}
setAlloc('tech',0);
setAlloc('stone',36);
assert.equal(run('popAllocTotal()'),126);
assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
for(let target=2;target<=4;target++){
  const cost=run("upCost('mint')");
  const before=run('({...S.res})');
  action("buildAct('mint')",`铸币厂${target}`);
  for(const key of ['wood','stone','food'])assert.equal(Math.round(before[key]-run(`S.res.${key}`)),cost[key]);
  wait("bldSt('mint').state==='idle'",1000);
  assert.equal(run("bldSt('mint').lv"),target);
  mintPayments.push({level:target,cost});mintActions++;
}
assert.ok(run("resCap('coin')")>=33000);
const rate=run("CFG.market.rates.find(r=>r.from==='stone'&&r.to==='coin'&&r.early).rate");
assert.equal(rate,0.14);
const citySteps=[];
while(run('S.settlements.city')<50){
  const city=run('S.settlements.city');
  const cost=run("settlementCost('city')");
  assert.ok(cost*100<=run("resCap('coin')"),`城市${city}单笔超过金币仓`);
  const stoneNeeded=Math.ceil(Math.max(0,cost*100-run('S.res.coin'))/rate)+10;
  assert.ok(stoneNeeded<run("resCap('stone')"),`城市${city}所需石超过仓容`);
  wait(`S.res.stone>=${stoneNeeded}`);
  const quote=run(`previewDeedPurchase('stone',${cost})`);
  assert.equal(quote.ok,true,`城市${city}购契报价：${JSON.stringify(quote)}`);
  const beforeStone=run('S.res.stone');
  action(`buyDeedsWithResource('stone',${cost},${quote.sourceCost},${quote.startingDeed})`,'购契');
  assert.equal(Math.round(beforeStone-run('S.res.stone')),quote.sourceCost);
  marketActions++;deeds+=cost;stoneSold+=quote.sourceCost;
  const beforePop=run('popCurrent()');
  action(`upgradeSettlementBatch('city',1,${city},${run('S.res.deed')})`,'扩建城市');cityActions++;
  assert.equal(run('maxPop()'),initial.capacity+4*cityActions);
  wait('popCurrent()===maxPop()',100);
  assert.equal(run('popCurrent()')-beforePop,4);
  setAlloc('stone',run('S.popAlloc.stone')+4);
  assert.equal(run('popAllocTotal()'),run('popCurrent()'));
  assert.ok(run('S.res.food')>0,'扩容时粮食必须为正');
  citySteps.push({city:city+1,tick:run('S.tick'),pop:run('popCurrent()'),stoneWorkers:run('S.popAlloc.stone'),stonePaid:quote.sourceCost,coinCap:run("resCap('coin')")});
}
assert.equal(run('popCurrent()'),214);
assert.equal(run('maxPop()'),214);
const beforeSustain=run("({tick:S.tick,stone:S.res.stone,food:S.res.food,stoneRate:prodRate('stone'),foodRate:prodRate('food'),upkeep:totalUpkeep(),popFood:popCurrent()*CFG.popFoodCost})");
// 粮仓原已满；仍须验证毛粮超过军粮与人口耗粮，石料真实进仓。
assert.ok(beforeSustain.foodRate-beforeSustain.upkeep-beforeSustain.popFood>0);
wait(`S.tick>=${beforeSustain.tick+1000}`,1000);
const afterSustain=run("({tick:S.tick,stone:S.res.stone,food:S.res.food})");
assert.ok(afterSustain.stone>beforeSustain.stone);
assert.ok(afterSustain.food>0);
setAlloc('stone',0);
setAlloc('tech',124);
const beforeScholars=run("({tick:S.tick,tech:S.res.tech,food:S.res.food,techRate:prodRate('tech'),foodRate:prodRate('food'),upkeep:totalUpkeep(),popFood:popCurrent()*CFG.popFoodCost})");
assert.ok(beforeScholars.foodRate-beforeScholars.upkeep-beforeScholars.popFood>0);
wait(`S.tick>=${beforeScholars.tick+1000}`,1000);
const afterScholars=run("({tick:S.tick,tech:S.res.tech,food:S.res.food})");
assert.equal(Math.round(afterScholars.tech-beforeScholars.tech),Math.round(beforeScholars.techRate*1000));
assert.ok(afterScholars.food>0);
assert.equal(run('armyCount()'),initial.army);
assert.equal(run('S.killValues.godGuardian'),4500);
assert.equal(run('S.eraStorage.electricKnowledge'),16);
assert.equal(run('S.res.medal'),initial.medal);
assert.equal(run('save().ok'),true);
const final=e.store.get('rts_save'),saved=JSON.parse(final);
const check=environment({rts_save:final});
assert.equal(check.run('loadSaveAndApply().status'),'ok');
assert.equal(check.run('popCurrent()'),214);
assert.equal(check.run('maxPop()'),214);
assert.equal(check.run('S.killValues.godGuardian'),4500);
assert.equal(saved.tick,run('S.tick'));
if(outArg)fs.writeFileSync(path.resolve(outArg.slice('--snapshot-final='.length)),final);
console.log(JSON.stringify({unit:'simulated online seconds; resources; workers',initial,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
  finalTick:saved.tick,elapsed:saved.tick-start,ticks,actions:{allocation:allocationActions,market:marketActions,city:cityActions,mint:mintActions},
  payments:{deeds,stoneSold,mint:mintPayments},beforeSustain,afterSustain,beforeScholars,afterScholars,
  final:{city:saved.settlements.city,pop:saved.population.current,mint:saved.buildings.mint.lv,coinCap:check.run("resCap('coin')"),scholars:saved.popAlloc.tech,foodWorkers:saved.popAlloc.food,knowledgeCap:check.run("resCap('tech')")},
  finalSha256:crypto.createHash('sha256').update(final).digest('hex'),citySteps},null,2));
