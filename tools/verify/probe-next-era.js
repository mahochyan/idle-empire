'use strict';
// 接续同目录真实动作探针的新档：不注入资源、人口、科技或战斗胜利。
// 复用已断言的 18 人路线，避免在第二份探针里重写市场/生产/扩建算法。
// 运行：node tools/verify/probe-next-era.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const baseSource=fs.readFileSync(path.join(__dirname,'probe-population-batch-18.js'),'utf8');
assert.ok(baseSource.includes("study('sci_urbanization');"),'基础探针应采用铜→城镇化→铁直链');
const base=new Function('require','console',baseSource+'\nreturn {run,actions,milestones,until,action,assign,study,expand,firstRouteMinFood:minFood};')(
  require,{log(){}}
);
const {run,actions,until,action,assign,study,expand}=base;
const extraActions={train:0};
const points=[];
// 旁路只观察原 tick 的结果，游戏的产出、扣费、存档仍由原实现完成。
run(`globalThis.__nextEraFoodMin={amount:S.res.food,second:S.tick};
  tick=((original)=>function(){const result=original();
    if(S.res.food<globalThis.__nextEraFoodMin.amount)
      globalThis.__nextEraFoodMin={amount:S.res.food,second:S.tick};
    return result;})(tick);`);
function point(label,extra={}){
  const state=run(`({onlineSeconds:S.tick,population:popCurrent(),capacity:maxPop(),
    free:popFree(),allocated:popAllocTotal(),battleWins:S.defeated.length,
    resources:{...S.res},caps:{basic:storageCapacity(),food:resCap('food'),tech:resCap('tech'),
      coal:resCap('coal'),copper:resCap('copper'),iron:resCap('iron'),silver:resCap('silver'),gold:resCap('gold'),steel:resCap('steel'),
      coin:resCap('coin'),silverCoin:resCap('silverCoin')},
    buildings:{academy:bldSt('academy').lv,library:bldSt('library').lv,largeGranary:bldSt('large_granary').lv,
      copperStore:bldSt('copper_store').lv,
      ironStore:bldSt('iron_store').lv,silverStore:bldSt('silver_store').lv,goldStore:bldSt('gold_store').lv,steelStore:bldSt('steel_store').lv,
      silverRefinery:bldSt('silver_refinery').lv,goldRefinery:bldSt('gold_refinery').lv,steelRefinery:bldSt('steel_refinery').lv,
      bronzeWorkshop:bldSt('bronze_workshop').lv,ironForge:bldSt('iron_forge').lv,
      silverArmory:bldSt('silver_armory').lv,goldArmory:bldSt('gold_armory').lv,alloyArmory:bldSt('alloy_armory').lv,mint:bldSt('mint').lv},
    settlements:{...S.settlements},storageMasteryLv:S.storageMasteryLv,sciences:[...S.sciences],
    soldiers:{bronzeGuard:S.pool.bronze_guard||0,ironSpearman:S.pool.iron_spearman||0,
      silverHeavy:S.pool.silver_heavy||0,goldCavalry:S.pool.gold_cavalry||0,alloySpecial:S.pool.alloy_special||0}})`);
  points.push({label,...JSON.parse(JSON.stringify(state)),actions:{...actions,...extraActions},...extra});
}
function waitFor(condition,max=20000){
  const outcome=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++;}
    return {n,reached:!!(${condition})}})()`);
  assert.equal(outcome.reached,true,`${condition} 未达：${JSON.stringify(run('({second:S.tick,res:S.res})'))}`);
  return outcome.n;
}
function ensureBasicCapacity(cost,label){
  let attempts=0;
  while(['wood','stone'].some(rk=>cost[rk]>run(`resCap('${rk}')`))){
    assert.ok(++attempts<=50,`${label} 扩仓次数异常`);
    const level=run("bldSt('warehouse').lv");
    const storageCost=run("upCost('warehouse')");
    const payments=Object.entries(storageCost).filter(([rk,amount])=>rk!=='time'&&amount>0);
    assert.ok(payments.every(([rk,amount])=>amount<=run(`resCap('${rk}')`)),`${label} 所需仓库升级本身超仓`);
    waitFor(payments.map(([rk,amount])=>`S.res.${rk}>=${amount}`).join('&&'));
    action("buildAct('warehouse')",'build',`扩仓以支付${label}`);
    waitFor(`bldSt('warehouse').lv===${level+1}&&bldSt('warehouse').state==='idle'`,120);
  }
}
function build(key){
  const cost=run(`CFG.buildings['${key}'].build`);
  const payment=Object.entries(cost).filter(([rk])=>rk!=='time'&&cost[rk]>0);
  waitFor(payment.map(([rk,amount])=>`S.res.${rk}>=${amount}`).join('&&'));
  action(`buildAct('${key}')`,'build',`建造 ${key}`);
  waitFor(`bldSt('${key}').lv===1&&bldSt('${key}').state==='idle'`,120);
}
function trainOne(key,metal){
  assert.equal(run(`trainLockReason('${key}')`),'',`${key} 尚未可训练`);
  const before=JSON.parse(JSON.stringify(run('S.res')));
  const r=run(`train('${key}',1)`);
  assert.equal(r?.ok,true,`训练 ${key}: ${JSON.stringify(r)}`);
  extraActions.train++;
  waitFor(`S.pool['${key}']===1`,10);
  assert.equal(before[metal]-run(`S.res.${metal}`),100,`${key} 金属未扣 100`);
}

// 18 人与百单位煤铜铁来自已有真实动作路线，不把“已有金属”误报为“已研究军备”。
const at18=base.milestones.find(p=>p.label==='population-18');
assert.ok(at18&&at18.population===18&&at18.capacity===18);
assert.equal(run("S.sciences.includes('sci_metal')"),false,'不应付费旧冶金术');
assert.equal(run("S.sciences.includes('sci_bronze_age')"),false);
assert.equal(run("S.sciences.includes('sci_iron_age')"),false);
point('18-population-and-metal-stock',{at18OnlineSeconds:at18.second,
  at18Tech:at18.res.tech,at18Deed:at18.res.deed,at18Coin:at18.res.coin});

const militaryScienceCosts={granary:run('activeSciences().sci_large_granary.cost.tech'),
  bronze:run('activeSciences().sci_bronze_age.cost.tech'),
  ironWarehouse:run('activeSciences().sci_iron_warehouse.cost.tech'),
  iron:run('activeSciences().sci_iron_age.cost.tech')};
assert.equal(run("researchScience('sci_bronze_age').reason"),'science-prerequisite');
assert.equal(run("researchScience('sci_iron_age').reason"),'science-prerequisite');
study('sci_large_granary');
study('sci_bronze_age');
study('sci_iron_warehouse');
study('sci_iron_age');
point('both-military-sciences',{militaryScienceCosts});
build('bronze_workshop');
build('iron_forge');
point('both-workshops-ready');
// 暂停工人可把训练秒的金属扣费与生产进账明确区分；岗位可随后合法重分配。
assign({});
trainOne('bronze_guard','copper');
trainOne('iron_spearman','iron');
point('both-soldiers-trained');

// 仓储研究是军备前置，但实体仓库仍需另付材料并等候建成。
assign({wood:4,stone:4,food:2,tech:1,coal:4,iron:3});
build('large_granary');
build('iron_store');
assert.equal(run("resCap('food')"),run("CFG.basicStorage.food.base")+2000);
assert.equal(run("resCap('iron')"),800);
point('both-stores-ready');

// 下一人口容量：城市化研究后，按当前实际汇率筹足城市 Lv.1→2 的地契。
assign({wood:13,stone:1,food:2,tech:2});
study('sci_city');
const cityCost=run("settlementCost('city')");
const beforeFund={onlineSeconds:run('S.tick'),actions:{...actions},resources:JSON.parse(JSON.stringify(run('S.res')))};
expand('city');
const afterFund={onlineSeconds:run('S.tick'),actions:{...actions},resources:JSON.parse(JSON.stringify(run('S.res')))};
waitFor('popCurrent()===22',30);
assert.equal(run('maxPop()'),22);
point('22-population',{cityCost,cityFunding:{before:beforeFund,after:afterFund}});

// 先付清铸币术前置，在科技点已装满旧仓容时真实尝试货币铸造。
const nextScienceCost=run('activeSciences().sci_coin.cost.tech');
const firstScienceCap=run("resCap('tech')");
assert.ok(nextScienceCost>firstScienceCap);
const mintPreCost=run('activeSciences().sci_mint.cost.tech');
assign({wood:3,stone:2,food:3,tech:10});
study('sci_currency');
study('sci_mint');
waitFor("S.res.tech>=resCap('tech')");
assert.equal(run("S.sciences.includes('sci_mint')"),true);
const beforeBlockedResearch=run('S.res.tech');
const blockedResearch=run("researchScience('sci_coin')");
assert.equal(blockedResearch?.ok,false,'科技仓容不足时不应完成货币铸造');
assert.equal(run("S.sciences.includes('sci_coin')"),false);
assert.equal(run('S.res.tech'),beforeBlockedResearch,'失败研究不得扣费');
point('science-cap-wall-at-full-stock',{nextScienceCost,firstScienceCap,mintPreCost,
  blockedResearch});
// 学院 Lv.1→5 的每次费用要在真实建筑动作前置里交付，科技点不得凭空注入。
assign({wood:7,stone:6,food:3,tech:2});
const academyCosts=[];
for(let level=2;level<=5;level++){
  const cost=run("upCost('academy')");
  academyCosts.push({toLevel:level,wood:cost.wood,stone:cost.stone,food:cost.food});
  ensureBasicCapacity(cost,`学院升至${level}级`);
  waitFor(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}&&S.res.food>=${cost.food}`);
  action("buildAct('academy')",'build',`学院升至 ${level}`);
  waitFor(`bldSt('academy').lv===${level}&&bldSt('academy').state==='idle'`,120);
}
assert.equal(run("resCap('tech')"),13000);
point('science-cap-raised',{academyCosts});
assign({wood:3,stone:2,food:3,tech:10});
study('sci_coin');
point('mint-science-chain-complete');
build('mint');
assign({wood:3,stone:2,food:3,tech:9,coin:1});
const coinBefore=run('S.res.coin');
waitFor(`S.res.coin>${coinBefore}`,10);
assert.equal(run('S.defeated.length'),0);
point('coin-worker-running');

// 继续走城市化后的白银产业，不注入银、银两或地契；仓容须能装下一笔购契款。
study('sci_silver');
point('silver-worker-unlocked');
const silverCityCost=run("settlementCost('city')");
const neededSilverDeeds=Math.max(0,silverCityCost-run('S.res.deed'));
const neededSilverMoney=neededSilverDeeds*200;
assert.ok(neededSilverDeeds>0&&neededSilverMoney<=run("resCap('silverCoin')"),'银两购契费用超出初始银两仓容');
assign({stone:5,food:2,coal:5,silver:5,silverCoin:5});
waitFor(`S.res.silverCoin>=${neededSilverMoney}`,12000);
assert.ok(run('S.res.stone')>=0&&run('S.res.coal')>=0&&run('S.res.food')>0,'冶银链原料或口粮断供');
point('silver-money-ready',{neededSilverMoney,neededSilverDeeds});
const marketCountBefore=run("dailyCount('market')");
action(`exchangeResource('silverCoin','deed',${neededSilverMoney})`,'market','银两购买地契');
assert.equal(run("dailyCount('market')"),marketCountBefore,'主线地契交易不应吞共享日限');
assert.ok(run('S.res.deed')>=silverCityCost,'银两购契未覆盖城市扩建费');
action("upgradeSettlement('city',S.settlements.city)",'settlement','用银两所购地契扩建城市');
waitFor('popCurrent()===26',30);
assert.equal(run('maxPop()'),26);
point('26-population-after-silver-deeds',{silverCityCost,neededSilverMoney,neededSilverDeeds});

// 白银支线：仓库／工坊与军备并行；所有研究、材料、兵员都沿用真实动作和在线生产。
assign({wood:4,stone:5,food:2,coal:5,silver:4,tech:6});
study('sci_silver_store');
waitFor('S.res.silver>=150');
build('silver_store');
assert.equal(run("resCap('silver')"),400);
point('silver-store-ready');
study('sci_silver_refinery');
study('sci_silver_age');
assign({wood:5,stone:5,food:2,coal:5,iron:4,tech:5});
build('silver_refinery');
assert.equal(run("buildingBuff('silver')"),0.1);
point('silver-refinery-ready');
build('silver_armory');
assign({stone:5,food:2,coal:5,silver:5,tech:9});
waitFor('S.res.silver>=100&&S.res.food>=800');
assign({});
trainOne('silver_heavy','silver');
assert.equal(run('S.defeated.length'),0);
point('silver-heavy-trained');

// 黄金直链与并行仓厂：金属金不等于钱币，冶金厂的银500必须先扩银仓。
assign({wood:4,stone:5,food:2,coal:5,tech:10});
study('sci_gold');
point('gold-worker-unlocked');
assign({stone:5,food:2,coal:5,gold:5,tech:9});
study('sci_gold_store');
waitFor('S.res.gold>=150');
build('gold_store');
assert.equal(run("resCap('gold')"),400);
point('gold-store-ready');
study('sci_gold_refinery');
study('sci_gold_age');
assert.equal(run("resCap('silver')"),400);
const silverStoreUpgrade=run("upCost('silver_store')");
assert.equal(silverStoreUpgrade.silver,180);
action("buildAct('silver_store')",'build','小银库升至2级');
waitFor("bldSt('silver_store').lv===2&&bldSt('silver_store').state==='idle'",120);
assert.equal(run("resCap('silver')"),500);
point('silver-cap-500-before-gold-refinery',{silverStoreUpgrade});
assign({stone:5,food:2,coal:5,silver:5,tech:9});
build('gold_refinery');
assert.equal(run("buildingBuff('gold')"),0.1);
point('gold-refinery-ready');
assign({wood:8,stone:3,food:3,tech:12});
build('gold_armory');
assert.ok(run('S.res.gold')>=100,'黄金军备金料不足');
assign({});
trainOne('gold_cavalry','gold');
assert.equal(run('S.defeated.length'),0);
point('gold-cavalry-trained');

// 合金直链与钢仓厂支线：钢仓铁200+钢200，冶钢厂金500须先将金库升2级。
assign({stone:6,coal:5,iron:3,food:2,tech:10});
study('sci_steel');
point('steel-worker-unlocked');
study('sci_steel_store');
study('sci_steel_refinery');
study('sci_alloy_age');
assert.equal(run("resCap('iron')"),800);
assign({steel:5,stone:5,coal:5,food:2,tech:9});
waitFor('S.res.steel>=200');
assert.ok(run('S.res.iron')<=1,'钢200生产应消耗约铁800');
assign({stone:6,coal:5,iron:3,food:2,tech:10});
waitFor('S.res.iron>=200');
build('steel_store');
assert.equal(run("resCap('steel')"),450,'已有铁仓Lv1供钢+50，钢仓Lv1再加100');
point('steel-store-ready');
assert.equal(run("resCap('gold')"),400);
const goldStoreUpgrade=run("upCost('gold_store')");
assert.equal(goldStoreUpgrade.gold,180);
action("buildAct('gold_store')",'build','小金库升至2级');
waitFor("bldSt('gold_store').lv===2&&bldSt('gold_store').state==='idle'",120);
assert.equal(run("resCap('gold')"),500);
point('gold-cap-500-before-steel-refinery',{goldStoreUpgrade});
assign({wood:2,stone:5,coal:5,gold:5,food:2,tech:7});
build('steel_refinery');
assert.equal(run("buildingBuff('steel')"),0.1);
point('steel-refinery-ready');
assign({stone:6,coal:5,iron:3,food:2,tech:10});
waitFor('S.res.iron>=500');
assign({steel:3,stone:4,coal:3,food:2,tech:14});
waitFor('S.res.steel>=100');
assign({wood:7,stone:4,food:3,tech:12});
build('alloy_armory');
assign({});
trainOne('alloy_special','steel');
assert.equal(run('S.defeated.length'),0);
point('alloy-special-trained');

// 母本公共容量分支：图书馆→工坊技术→储存精通前五级，均走研究/建造/逐级付款真实动作。
study('sci_library');
study('sci_workshop');
build('library');
assert.equal(run("resCap('tech')"),13200);
point('library-ready');
for(let lv=1;lv<=5;lv++){
  const techCost=run('storageMasteryCost().tech');
  assert.equal(techCost,500*lv);
  action('upgradeStorageMastery()','research',`储存精通 Lv${lv}`);
}
assert.equal(run('S.storageMasteryLv'),5);
assert.equal(run("resCap('tech')"),19800);
assert.equal(run("resCap('steel')"),675);
assert.equal(run('storageMasteryCost().steel'),6000);
point('storage-mastery-5');

// 对照分支：在冶钢技术已解锁的同一自然档逐笔购买前5级冶钢精通。
// 默认路线保持原样，便于与 --steel-mastery-early 作同源比较。
if(process.argv.includes('--steel-mastery-early')){
  const firstSecond=run('S.tick'),firstMedal=run('S.res.medal');
  assign({food:5,tech:21});
  for(let level=1;level<=5;level++){
    const cost=run('steelMasteryCost()');
    assert.equal(cost.tech,1500*level);
    assert.equal(cost.medal,undefined);
    waitFor(`S.res.tech>=${cost.tech}`,20000);
    const before=run('S.res.tech');
    action('upgradeSteelMastery()','research',`冶钢精通 Lv${level}`);
    assert.equal(run('S.res.tech'),before-cost.tech);
    assert.equal(run('S.steelMasteryLv'),level);
  }
  assert.equal(run('S.res.medal'),firstMedal);
  point('steel-mastery-5',{extraOnlineSeconds:run('S.tick')-firstSecond});
}
if(process.argv.includes('--steel-mastery-hunt-10'))
  assert.ok(process.argv.includes('--steel-mastery-20'),'10人猎队只用于20级兽骨储备路线');
if(process.argv.includes('--steel-mastery-hunt-13')||process.argv.includes('--steel-mastery-20')){
  assert.ok(process.argv.includes('--steel-mastery-early'),'郊野精通路线须先购买冶钢精通前5级');
  const boneTarget=process.argv.includes('--steel-mastery-20')?2930:1140;
  const fighters=process.argv.includes('--steel-mastery-hunt-10')?10:8;
  const hunt=require(path.join(__dirname,'steel-mastery-hunt-step.js'))({run,assign,waitFor,build,action,extraActions},0.5,fighters,boneTarget);
  point('steel-mastery-13',{hunt});
}

const observedFoodMin=run('globalThis.__nextEraFoodMin');
console.log(JSON.stringify({unit:'online seconds',battleWins:0,
  firstRouteMinFood:Number(base.firstRouteMinFood.toFixed(3)),
  minFoodAfterBase:Number(observedFoodMin.amount.toFixed(3)),minFoodAtOnlineSecond:observedFoodMin.second,
  derivedFrom:'probe-population-batch-18.js (real actions + per-second tick)',
  at18OnlineSeconds:at18.second,militaryScienceCosts,cityCost,nextScienceCost,
  firstScienceCap,actions:{...actions,...extraActions},points},null,2));
