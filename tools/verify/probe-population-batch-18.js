'use strict';
// 新档零战斗批量扩人口：使用真实批量市场和扩建动作，不注入资源或修改公式。
// 运行：node tools/verify/probe-population-batch-18.js
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const birthPolicyRoute=process.argv.includes('--birth-policy');
const currencyLateRoute=process.argv.includes('--copper-currency-late');
const currencyRoute=currencyLateRoute||process.argv.includes('--copper-currency');
const batchExpansion=birthPolicyRoute||process.argv.includes('--batch-without-policy');
const e=environment();
const run=expression=>e.run(expression);
let saveWrites=0,actionSaveWrites=0;
const originalStoreSet=e.store.set.bind(e.store);
e.store.set=(key,value)=>{
  if(key==='rts_save')saveWrites++;
  return originalStoreSet(key,value);
};
const actions={build:0,allocate:0,research:0,settlement:0,policy:0,market:0,marketFallback:0};
const milestones=[];
let minFood=run('S.res.food');
function snapshot(label){
  const x=JSON.parse(JSON.stringify(run(`({second:S.tick,capacity:maxPop(),population:popCurrent(),
    allocated:popAllocTotal(),free:popFree(),res:{...S.res},
    caps:{basic:storageCapacity(),tech:resCap('tech'),coal:resCap('coal'),copper:resCap('copper'),iron:resCap('iron')},
    science:[...S.sciences],settlements:{...S.settlements},battleWins:S.defeated.length})`)));
  milestones.push({label,...x,actions:{...actions},saveWrites,actionSaveWrites});
}
function until(condition,max=20000){
  const r=run(`(()=>{let n=0,minFood=S.res.food;while(!(${condition})&&n<${max}){
    tick();n++;if(S.res.food<minFood)minFood=S.res.food;
  }return{n,minFood,reached:!!(${condition})}})()`);
  minFood=Math.min(minFood,r.minFood);
  assert.equal(r.reached,true,`第 ${run('S.tick')} 秒未达 ${condition}; ${JSON.stringify(run('({res:S.res,pop:S.population,settlements:S.settlements})'))}`);
}
function action(expression,kind,label){
  const before=saveWrites;
  const r=run(expression);
  assert.equal(r?.ok,true,`${label}: ${JSON.stringify(r)}`);
  actions[kind]++;
  actionSaveWrites+=saveWrites-before;
  return r;
}
function assign(target){
  const current=run('({...S.popAlloc})');
  const keys=[...new Set([...Object.keys(current),...Object.keys(target)])];
  for(const rk of keys)if((target[rk]||0)<(current[rk]||0))
    action(`setPopAlloc('${rk}',${target[rk]||0})`,'allocate',`减少 ${rk}`);
  for(const rk of keys)if((target[rk]||0)>(current[rk]||0))
    action(`setPopAlloc('${rk}',${target[rk]||0})`,'allocate',`增加 ${rk}`);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function study(id){
  const cost=run(`activeSciences()['${id}'].cost.tech`);
  assert.ok(run("resCap('tech')")>=cost,`${id} 超出科技仓容`);
  until(`S.res.tech>=${cost}`);
  action(`researchScience('${id}')`,'research',id);
  snapshot(id);
}
function sellForCoin(rk,qty){
  assert.ok(Number.isSafeInteger(qty)&&qty>0);
  const r=action(`exchangeResource('${rk}','coin',${qty})`,'market',`出售 ${rk} ${qty}`);
  actions.marketFallback++;
  assert.ok(r.get>0);
}
function buyDeedsFromBasket(sales,count){
  assert.ok(Number.isSafeInteger(count)&&count>0);
  const quote=run(`previewDeedBasket(${JSON.stringify(sales)},${count})`);
  assert.equal(quote?.ok,true,`购契预览: ${JSON.stringify(quote)}`);
  const gains=quote.trades.slice(0,-1).map(t=>t.get);
  const r=action(`buyDeedsBasket(${JSON.stringify(sales)},${count},${quote.coinCost},${JSON.stringify(gains)},${quote.startingDeed},${quote.startingCoin})`,
    'market',`合并购契 ${count}`);
  assert.equal(r.deeds,count);
}
function fundDeeds(count){
  const target=count*100;
  const rates={wood:0.1,stone:0.14,food:0.08};
  const reserve={wood:100,stone:1000,food:1000};
  // 沿用原路线出售顺序、最低保留量和等待门槛；当下能筹足时合并为一笔市场动作。
  let attempts=0;
  while(true){
    assert.ok(++attempts<100,'筹币循环次数异常');
    let virtualCoin=run('S.res.coin');
    if(virtualCoin+1e-7>=target){buyDeedsFromBasket([],count);return;}
    const sales=[];
    for(const rk of ['wood','stone','food']){
      const balance=run(`S.res.${rk}`);
      const available=Math.floor(balance-reserve[rk]);
      if(available<1000)continue;
      const missing=target-virtualCoin;
      const qty=Math.min(available,Math.max(1000,Math.ceil((missing+0.01)/rates[rk])));
      sales.push({from:rk,qty});
      virtualCoin+=Math.floor(qty*rates[rk]);
      if(virtualCoin+1e-7>=target)break;
    }
    if(virtualCoin+1e-7>=target){buyDeedsFromBasket(sales,count);return;}
    // 不足以购契时先卖已有富余资源，保持原路线对仓容和产能的处理。
    if(sales.length){for(const sale of sales)sellForCoin(sale.from,sale.qty);}
    else{
      const missing=target-run('S.res.coin');
      const threshold=Math.min(run("resCap('wood')"),Math.max(1100,Math.ceil((missing+0.01)/rates.wood)+reserve.wood));
      until(`S.res.wood>=${threshold}`);
    }
  }
}
function expand(key,count=1){
  let quote=run(`settlementBatchPreview('${key}',${count})`);
  assert.ok(quote.ok||quote.cost!=null,`扩建预览: ${JSON.stringify(quote)}`);
  const shortage=Math.max(0,quote.cost-run('S.res.deed'));
  if(shortage>0)fundDeeds(shortage);
  quote=run(`settlementBatchPreview('${key}',${count})`);
  assert.equal(quote.ok,true,`扩建复核: ${JSON.stringify(quote)}`);
  action(`upgradeSettlementBatch('${key}',${count},${quote.startLevel},${run('S.res.deed')})`,
    'settlement',`扩建 ${key} ×${count}`);
  snapshot(`expand-${key}-${run(`S.settlements.${key}`)}`);
}

snapshot('new-game');
assert.equal(run('S.metalRecipeMode'),'coal');
action("buildAct('academy')",'build','学院');
action("buildAct('farm')",'build','农田');
expand('village',4);
until("popCurrent()===4&&bldSt('academy').lv===1&&bldSt('farm').lv===1",40);
assign({wood:1,stone:1,food:1,tech:1});
until('popCurrent()===8',30);
assign({wood:3,stone:2,food:1,tech:2});
snapshot('eight-working');

for(const id of ['sci_prospect','sci_coal','sci_copper'])study(id);
study('sci_wood_store');
until('S.res.wood>=800');
action("buildAct('warehouse')",'build','木石仓库');
until("bldSt('warehouse').lv===1");
snapshot('wood-stone-store-ready');
until('S.res.wood>=400&&S.res.stone>=400&&S.res.food>=300');
action("buildAct('market')",'build','市场');
until("bldSt('market').lv===1");
snapshot('market-open');
study('sci_urbanization');

// 城镇化一开放，先用已有木石换地契扩到 10；随后边积科技边产可出售的木材。
expand('smallTown');
until('popCurrent()===10',30);
assign({wood:6,stone:1,food:1,tech:2});
snapshot('ten-population');
if(birthPolicyRoute){
  study('sci_birth_policy');
  action("setSmallTownPolicy(0,'birth')",'policy','小镇推行鼓励生育');
  assert.equal(run('popGrowthPer10s()'),7);
  snapshot('birth-policy-active');
}
study('sci_iron');
if(currencyRoute&&!currencyLateRoute){
  study('sci_currency');
  snapshot('copper-currency-open');
}

if(batchExpansion){
  expand('smallTown',4);
  until('popCurrent()===18',50);
  assign({wood:14,stone:1,food:1,tech:2});
  snapshot('population-18');
}else{
  for(let target=12;target<=18;target+=2){
    expand('smallTown');
    until(`popCurrent()===${target}`,30);
    if(currencyLateRoute&&target===12){
      assign({wood:8,stone:1,food:1,tech:2});
      study('sci_currency');
      snapshot('copper-currency-open');
    }
    assign(currencyRoute?{wood:target-8,stone:1,food:1,tech:2,coal:2,copper:1,coin:1}
      :{wood:target-4,stone:1,food:1,tech:2});
    snapshot(`population-${target}`);
  }
}
assert.equal(run('maxPop()'),18);
assert.equal(run('popCurrent()'),18);
assert.equal(run("S.sciences.includes('sci_mint')||S.sciences.includes('sci_coin')"),false);
assert.equal(run('bldSt(\'mint\').lv'),0);
assert.equal(run('S.defeated.length'),0);

// 16/18 岗即可同时生产铜与铁；上游石、煤及粮均有正净流量。
assign({wood:1,stone:4,food:2,tech:1,coal:5,copper:1,iron:2});
assert.equal(run('popAllocTotal()'),16);
const before=JSON.parse(JSON.stringify(run('S.res')));
const next=run('productionSecond(1,true)');
const net={};
for(const rk of ['wood','stone','food','tech','coal','copper','iron']){
  net[rk]=Number((next[rk]-before[rk]).toFixed(4));
  assert.ok(net[rk]>0,`${rk} 无正净产: ${JSON.stringify(net)}`);
}
snapshot('metal-jobs-ready');
until('S.res.copper>=100',101);
snapshot('first-100-copper');
until('S.res.iron>=100',101);
snapshot('first-100-iron');
assert.ok(run('S.res.food>=500'));
assert.equal(run('S.defeated.length'),0);
assert.ok(minFood>0);
const sustainedStart=JSON.parse(JSON.stringify(run('S.res')));
const sustainedEndSecond=run('S.tick')+120;
until(`S.tick>=${sustainedEndSecond}`,120);
const sustainedEnd=JSON.parse(JSON.stringify(run('S.res')));
for(const rk of ['coal','copper','iron'])
  assert.ok(sustainedEnd[rk]>sustainedStart[rk],`${rk} 在 120 秒连续生产中没有增长`);
// 石材靠近仓容时可在同一库存位平衡；驻军重放还会扣走库存。
assert.ok(sustainedEnd.food>0&&sustainedEnd.stone>0,
  JSON.stringify({sustainedStart,sustainedEnd,stoneCap:run("resCap('stone')")}));
assert.equal(run('S.defeated.length'),0);
snapshot('metal-sustained-120s');

const at18=milestones.find(m=>m.label==='population-18');
assert.ok(at18&&at18.capacity===18&&at18.population===18);
const at18Actions=at18.actions;
const at18Result={onlineSeconds:at18.second,
  economicActions:at18Actions.build+at18Actions.research+at18Actions.settlement+at18Actions.policy+at18Actions.market,
  allPlayerActions:Object.values(at18Actions).reduce((n,v)=>n+v,0)-at18Actions.marketFallback,
  marketActions:at18Actions.market,marketFallbackActions:at18Actions.marketFallback,
  settlementActions:at18Actions.settlement,saveWrites:at18.saveWrites,actionSaveWrites:at18.actionSaveWrites};
console.log(JSON.stringify({unit:'online seconds',route:currencyLateRoute?'copper-currency-late':currencyRoute?'copper-currency':birthPolicyRoute?'birth-policy-batch':batchExpansion?'batch-without-policy':'baseline',battleWins:0,at18:at18Result,actions,
  saveWrites,actionSaveWrites,minFood:Number(minFood.toFixed(3)),
  noMintScience:true,finalMetalNetPerSecond:net,
  milestones:milestones.map(({label,second,capacity,population,allocated,free,res,caps,settlements,actions,saveWrites,actionSaveWrites})=>({
    label,second,capacity,population,allocated,free,
    resources:{wood:Number(res.wood.toFixed(2)),stone:Number(res.stone.toFixed(2)),food:Number(res.food.toFixed(2)),
      tech:Number(res.tech.toFixed(2)),coal:res.coal,copper:res.copper,iron:res.iron,coin:Number(res.coin.toFixed(2)),deed:res.deed},
    caps,settlements,actions,saveWrites,actionSaveWrites
  }))},null,2));
