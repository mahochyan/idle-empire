'use strict';
// 从 P71 真实存档续跑城镇扩容；只调用现有市场、扩建、分配及在线 tick 动作。
// node tools/verify/probe-late-population-p72.js [--snapshot-final=路径]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const source=path.resolve(__dirname,'../../docs/codex/reports/data/p71-medal800k-paid.json');
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:fs.readFileSync(source,'utf8')});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('maxPop()'),102);
const initialArmy=run('armyCount()');
assert.equal(initialArmy,203);
const start=run('S.tick');
let markets=0,expansions=0,allocations=0,ticks=0,deedsSpent=0,stoneSold=0;
const steps=[];
const snap=label=>JSON.parse(JSON.stringify(run(`({label:${JSON.stringify(label)},tick:S.tick,pop:popCurrent(),capacity:maxPop(),
  allocations:{...S.popAlloc},city:S.settlements.city,
  res:{stone:S.res.stone,food:S.res.food,coal:S.res.coal,iron:S.res.iron,steel:S.res.steel,coin:S.res.coin,deed:S.res.deed},
  caps:{stone:resCap('stone'),steel:resCap('steel'),coin:resCap('coin')}})`)));
steps.push(snap('start'));
const action=(expr,label)=>{
  const result=run(expr);
  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
  return result;
};
const wait=(expr,limit)=>{
  const result=run(`(()=>{let n=0;while(!(${expr})&&n<${limit}){tick();n++}return{n,ok:!!(${expr})}})()`);
  ticks+=result.n;
  assert.ok(result.ok,`超时 ${expr}: ${JSON.stringify(snap('timeout'))}`);
};
// 原档军队每秒耗粮125.56，10名粮工远不够。扩容期间暂停冶炼，先保障出生。
for(const [rk,n] of [['steel',0],['iron',0],['coal',23]]){
  action(`setPopAlloc('${rk}',${n})`,`暂调${rk}岗位`);allocations++;
}
action("setPopAlloc('food',45)",'保障军粮与出生');allocations++;
for(let i=0;i<6;i++){
  const cityLv=run('S.settlements.city');
  const cost=run("settlementCost('city')");
  assert.ok(cost<=Math.floor(run("resCap('coin')")/100),'购契单笔超过金币仓容');
  const stoneNeeded=Math.ceil(Math.max(0,cost*100-run('S.res.coin'))/0.14)+10;
  wait(`S.res.stone>=${stoneNeeded}`,50000);
  const quote=run(`previewDeedPurchase('stone',${cost})`);
  assert.equal(quote.ok,true,`第${cityLv}级购契: ${JSON.stringify(quote)}`);
  action(`buyDeedsWithResource('stone',${cost},${quote.sourceCost},${quote.startingDeed})`,'购契');markets++;
  action(`upgradeSettlementBatch('city',1,${cityLv},${run('S.res.deed')})`,'扩建城市');expansions++;
  deedsSpent+=cost;stoneSold+=quote.sourceCost;
  wait('popCurrent()===maxPop()',40);
  action(`setPopAlloc('stone',${run('S.popAlloc.stone')+4})`,'增加采石工');allocations++;
  steps.push(snap(`city-${cityLv+1}`));
}
assert.equal(run('maxPop()'),126);
assert.equal(run('popCurrent()'),126);
assert.ok(run('S.res.food')>0,'扩容后必须保持粮食正库存');
const pop126=steps.at(-1);
// 126人后恢复长时间可持续的军粮、矿石、煤、铁和钢流水。
for(const [rk,n] of [['stone',24],['food',43]]){
  action(`setPopAlloc('${rk}',${n})`,`调整${rk}岗位`);allocations++;
}
for(const [rk,n] of [['coal',24],['iron',12],['steel',23]]){
  action(`setPopAlloc('${rk}',${n})`,`增加${rk}岗位`);allocations++;
}
const balanced=snap('balanced-start');steps.push(balanced);
wait(`S.tick>=${balanced.tick+1000}`,1000);
const sustained=snap('balanced-1000s');steps.push(sustained);
const delta=Object.fromEntries(['stone','food','coal','iron','steel'].map(k=>[k,Number(((sustained.res[k]-balanced.res[k])/1000).toFixed(4))]));
for(const rk of Object.keys(delta))assert.ok(delta[rk]>0,`${rk} 未持续净增长: ${JSON.stringify(delta)}`);
assert.equal(run('S.defeated.length'),45);
assert.equal(run('armyCount()'),initialArmy);
assert.equal(run('S.res.medal'),800056);
assert.equal(run('S.eraStorage.steamKnowledge'),14);
assert.equal(run('S.eraStorage.electricKnowledge'),14);
assert.equal(run('S.items.godCrystal'),41);
assert.equal(run('S.items.guardianStone'),102);
assert.equal(run('save().ok'),true,'最终在线状态须实际写入主档');
const raw=e.store.get('rts_save');
assert.ok(raw);
const persisted=JSON.parse(raw);
assert.equal(persisted.tick,run('S.tick'));
assert.equal(persisted.res.steel,sustained.res.steel);
const reload=environment({rts_save:raw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('popCurrent()'),126);
assert.equal(reload.run('maxPop()'),126);
assert.equal(reload.run('S.defeated.length'),45);
if(finalArg)fs.writeFileSync(path.resolve(finalArg.slice('--snapshot-final='.length)),raw);
console.log(JSON.stringify({unit:'simulated online seconds',source,sourceTick:start,elapsed:run('S.tick')-start,
  actions:{market:markets,settlement:expansions,allocation:allocations},cost:{deeds:deedsSpent,stoneSold},pop126At:pop126.tick-start,
  balancedNetPerSecond:delta,finalSha256:crypto.createHash('sha256').update(raw).digest('hex'),steps},null,2));
