'use strict';
// 新档零战斗 18 人口 + 煤铜铁币并行探针。
// 只通过游戏动作函数和逐秒 tick 推进；运行：node tools/verify/probe-metal-population.js
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const e=environment();
const run=expression=>e.run(expression);
const actions={build:0,allocate:0,research:0,settlement:0,exchange:0};
const milestones=[];
let minFood=run('S.res.food');
let maxFoodDemand=0;

function snapshot(label){
  const state=run(`({second:S.tick,capacity:maxPop(),population:popCurrent(),allocated:popAllocTotal(),
    resources:{wood:S.res.wood,stone:S.res.stone,food:S.res.food,tech:S.res.tech,coal:S.res.coal,
      copper:S.res.copper,iron:S.res.iron,coin:S.res.coin,deed:S.res.deed},
    caps:{basic:storageCapacity(),tech:resCap('tech'),coal:resCap('coal'),copper:resCap('copper'),
      iron:resCap('iron'),coin:resCap('coin')},
    buildings:{academy:bldSt('academy').lv,market:bldSt('market').lv,mint:bldSt('mint').lv},
    settlements:{...S.settlements},sciences:[...S.sciences],battleWins:S.defeated.length})`);
  milestones.push({label,...JSON.parse(JSON.stringify(state)),actions:{...actions}});
}
function until(condition,max=20000){
  const result=run(`(()=>{let n=0,minFood=S.res.food,maxDemand=0;
    while(!(${condition})&&n<${max}){
      const demand=potentialFoodCostSecond();
      if(demand>maxDemand)maxDemand=demand;
      tick();n++;
      if(S.res.food<minFood)minFood=S.res.food;
    }
    return {n,minFood,maxDemand,reached:!!(${condition})};})()`);
  minFood=Math.min(minFood,result.minFood);
  maxFoodDemand=Math.max(maxFoodDemand,result.maxDemand);
  assert.equal(result.reached,true,`第 ${run('S.tick')} 秒尚未达到 ${condition}; 状态 ${JSON.stringify(run('({res:S.res,pop:S.population,settlements:S.settlements,buildings:S.buildings})'))}`);
}
function build(key){
  const result=run(`buildAct('${key}')`);
  assert.equal(result?.ok,true,`建造/升级 ${key}: ${JSON.stringify(result)}`);
  actions.build++;
}
function assign(target){
  const current=run('({...S.popAlloc})');
  const keys=new Set([...Object.keys(current),...Object.keys(target)]);
  // 先释放旧岗位再增加新岗位，避免暂时超出实际村民数。
  for(const rk of keys){
    const next=target[rk]||0;
    if(next>=current[rk])continue;
    const result=run(`setPopAlloc('${rk}',${next})`);
    assert.equal(result?.ok,true,`减少岗位 ${rk}: ${JSON.stringify(result)}`);
    actions.allocate++;
  }
  for(const rk of keys){
    const next=target[rk]||0;
    if(next<=(current[rk]||0))continue;
    const result=run(`setPopAlloc('${rk}',${next})`);
    assert.equal(result?.ok,true,`增加岗位 ${rk}: ${JSON.stringify(result)}`);
    actions.allocate++;
  }
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function study(id){
  const cost=run(`activeSciences()['${id}'].cost.tech`);
  assert.ok(run("resCap('tech')")>=cost,`${id} 科技 ${cost} 超出当前科技仓容`);
  until(`S.res.tech>=${cost}`);
  const result=run(`researchScience('${id}')`);
  assert.equal(result?.ok,true,`研究 ${id}: ${JSON.stringify(result)}`);
  actions.research++;
  snapshot(id);
}
function expand(key){
  const result=run(`upgradeSettlement('${key}')`);
  assert.equal(result?.ok,true,`扩建 ${key}: ${JSON.stringify(result)}`);
  actions.settlement++;
}
function buyDeed(quantity){
  assert.ok(Number.isSafeInteger(quantity)&&quantity>0);
  until(`S.res.coin>=${quantity*100}`);
  const result=run(`exchangeResource('coin','deed',${quantity*100})`);
  assert.equal(result?.ok,true,`兑换 ${quantity} 地契: ${JSON.stringify(result)}`);
  actions.exchange++;
  assert.equal(result.get,quantity);
}

snapshot('new-game');
assert.equal(run('S.metalRecipeMode'),'coal');
assert.equal(run('S.population.current'),0);
assert.equal(run('S.defeated.length'),0);
build('academy');
build('farm');
for(let i=0;i<4;i++)expand('village');
snapshot('starter-capacity-eight');

until("popCurrent()===4&&bldSt('academy').lv===1&&bldSt('farm').lv===1",40);
assign({wood:1,stone:1,food:1,tech:1});
until('popCurrent()===8',30);
assign({wood:3,stone:2,food:1,tech:2});
snapshot('eight-working');

for(const id of ['sci_prospect','sci_coal','sci_copper'])study(id);
study('sci_wood_store');
until('S.res.wood>=800');
build('warehouse');
until("bldSt('warehouse').lv===1");
snapshot('wood-stone-store-ready');
until("S.res.wood>=400&&S.res.stone>=400&&S.res.food>=300");
build('market');
until("bldSt('market').lv===1");
snapshot('market-open');

for(const id of ['sci_urbanization','sci_iron','sci_city','sci_mint'])study(id);
assert.equal(run("resCap('tech')"),5000);
assert.ok(run("activeSciences().sci_coin.cost.tech>resCap('tech')"));
snapshot('coin-science-blocked-by-tech-cap');

for(let level=2;level<=5;level++){
  until("S.res.wood>=upCost('academy').wood&&S.res.stone>=upCost('academy').stone&&S.res.food>=upCost('academy').food");
  build('academy');
  until(`bldSt('academy').lv===${level}&&bldSt('academy').state==='idle'`);
  snapshot(`academy-level-${level}`);
}
assert.equal(run("resCap('tech')"),13000);
assign({food:1,tech:7});
study('sci_coin');
assign({wood:1,stone:1,food:1,tech:5});
until("S.res.wood>=600&&S.res.stone>=400&&S.res.food>=500");
build('mint');
until("bldSt('mint').lv===1");
snapshot('mint-open');

// 初始余额仅 4 地契。铸币收入依次支付小镇 +2、城市 +4、城市 +4。
assign({food:2,coin:6});
buyDeed(11);
expand('smallTown');
until('popCurrent()===10',30);
snapshot('ten-population');

assign({food:3,coin:7});
buyDeed(36);
expand('city');
until('popCurrent()===14',40);
snapshot('fourteen-population');

assign({food:4,coin:10});
buyDeed(42);
expand('city');
until('popCurrent()===18',40);
snapshot('eighteen-population');

assign({wood:1,stone:3,food:2,tech:1,coal:4,copper:1,iron:1,coin:1});
const before=JSON.parse(JSON.stringify(run('S.res')));
until('S.tick>0&&S.res.iron>0&&S.res.copper>0&&S.res.coin>0',1);
const after=JSON.parse(JSON.stringify(run('S.res')));
const uncapped=run('productionSecond(1,true)');
const net={};
for(const rk of ['wood','stone','food','tech','coal','copper','iron','coin'])
  net[rk]=Number((uncapped[rk]-after[rk]).toFixed(4));
for(const rk of ['wood','stone','food','tech','coal','copper','iron','coin'])
  assert.ok(net[rk]>0,`${rk} 不能与其他岗位保持正净产: ${JSON.stringify(net)}`);
assert.ok(after.copper>before.copper&&after.iron>before.iron&&after.coin>before.coin);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('popAllocTotal()'),14);
assert.equal(run('popFree()'),4);
assert.ok(minFood>0,`出现粮食归零: ${minFood}`);
snapshot('four-resources-running');

// 为铜/铁各 100 的军备材料备料：从 14 人基线加石 1、煤 1、铁 1；
// 17/18 岗仍留一人可调，石/煤/粮均为正净流量，铸币不中断。
assign({wood:1,stone:4,food:2,tech:1,coal:5,copper:1,iron:2,coin:1});
assert.equal(run('popAllocTotal()'),18);
assert.equal(run('popFree()'),1);
const boostedBefore=JSON.parse(JSON.stringify(run('S.res')));
const boostedNext=run('productionSecond(1,true)');
const boostedNet={};
for(const rk of ['wood','stone','food','tech','coal','copper','iron','coin']){
  boostedNet[rk]=Number((boostedNext[rk]-boostedBefore[rk]).toFixed(4));
  assert.ok(boostedNet[rk]>0,`${rk} 在 17 人备料配置下不能正净产`);
}
snapshot('metal-preparation-17-jobs');
until('S.res.copper>=100',100);
snapshot('first-100-copper');
until('S.res.iron>=100',100);
snapshot('first-100-iron');
const parallelStart=JSON.parse(JSON.stringify(run('S.res')));
const parallelUntil=milestones.find(x=>x.label==='four-resources-running').second+120;
until(`S.tick>=${parallelUntil}`,120);
const parallelEnd=JSON.parse(JSON.stringify(run('S.res')));
for(const rk of ['coal','copper','iron','coin'])
  assert.ok(parallelEnd[rk]>parallelStart[rk],`${rk} 在并行 120 秒后没有增长`);
assert.ok(parallelEnd.food>0);
assert.equal(run('S.defeated.length'),0);
snapshot('parallel-after-120s');

// 从同一新档继续走时代研究、工坊建造、逐人金属招募，不直接注入研究或材料。
study('sci_large_granary');
study('sci_bronze_age');
study('sci_iron_warehouse');
study('sci_iron_age');
for(const [key,unit] of [['bronze_workshop','bronze_guard'],['iron_forge','iron_spearman']]){
  until(`S.res.wood>=CFG.buildings['${key}'].build.wood&&S.res.stone>=CFG.buildings['${key}'].build.stone&&S.res.food>=CFG.buildings['${key}'].build.food`);
  build(key);
  until(`bldSt('${key}').lv===1&&bldSt('${key}').state==='idle'`);
  assert.equal(run(`trainLockReason('${unit}')`),'');
}
snapshot('military-workshops-open');
// 临时撤岗使训练秒的产出项为0，便于逐笔核对金属和粮费；这是合法分工操作。
assign({});
for(const [unit,metal,food] of [['bronze_guard','copper',300],['iron_spearman','iron',500]]){
  assert.equal(run(`train('${unit}',1).ok`),true,`无法排队训练 ${unit}`);
  const resourcesBefore=JSON.parse(JSON.stringify(run('S.res')));
  const foodDue=run('potentialFoodCostSecond()');
  run('tick()');
  assert.equal(run(`S.pool['${unit}']`),1,`${unit} 未入后备兵池`);
  assert.equal(resourcesBefore[metal]-run(`S.res.${metal}`),100,`${unit} 金属未逐人扣 100`);
  assert.ok(Math.abs(resourcesBefore.food-run('S.res.food')-foodDue)<1e-8,`${unit} 粮食与人口口粮结算不符`);
  assert.ok(foodDue>=food,`${unit} 逐人粮费未计入训练秒`);
}
assert.equal(run('S.defeated.length'),0);
snapshot('first-bronze-and-iron-soldiers');

console.log(JSON.stringify({unit:'online seconds',battleWins:0,actions,
  minFood:Number(minFood.toFixed(3)),peakPotentialFoodDemandPerSecond:Number(maxFoodDemand.toFixed(3)),
  soldiers:run('({bronze_guard:S.pool.bronze_guard||0,iron_spearman:S.pool.iron_spearman||0})'),
  baseline14JobNetPerSecond:net,metalPreparation17JobNetPerSecond:boostedNet,
  milestones:milestones.map(({label,second,capacity,population,allocated,resources,caps,buildings,settlements,actions})=>({
    label,second,capacity,population,allocated,
    resources:{food:Number(resources.food.toFixed(3)),tech:Number(resources.tech.toFixed(3)),
      coal:resources.coal,copper:resources.copper,iron:resources.iron,coin:Number(resources.coin.toFixed(3)),deed:resources.deed},
    caps,buildings,settlements,actions
  }))},null,2));
