'use strict';
// 人口链批量动作回归：直接调用真实市场、聚落与存档函数。DOM/存储仅用既有 VM 替身。
// 运行：node tests/progression/population_batch.js
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function test(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+': '+error.stack)}
}
function result(e,expression){return JSON.parse(e.run(`JSON.stringify(${expression})`))}
function readyMarket(e,advanced=false){
  e.run(`S.sciences=['sci_prospect','sci_coal','sci_copper'${advanced?",'sci_metal','sci_iron','sci_mint','sci_coin'":''}];S.buildings.market={lv:1,state:'idle'};S.res.wood=5000;S.res.stone=5000;S.res.food=5000;S.res.coin=50;S.res.deed=0`);
}
function failWrites(e,key){
  e.run(`const originalSetItem=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${key}')throw Error('quota');originalSetItem(k,v)}`);
}
function oldV3Text(){
  const e=environment();
  return e.run(`(()=>{const d=serializeSave();d.v=3;d.townLv=3;d.popAlloc={wood:25,stone:5,food:0};d.res.wood=60000;d.res.deed=70;d.res.coin=0;delete d.settlements;delete d.townPolicies;delete d.population;delete d.metalRecipeMode;delete d.res.coal;delete d.popAlloc.coal;delete d.offline.populationFoodRule;return JSON.stringify(d)})()`);
}

test('四级村庄预览纯读，动作一次保存，总费26且不追补人口',()=>{
  const e=environment();
  assert.equal(e.run('save().ok'),true);
  const masterBefore=e.store.get('rts_save');
  const stateBefore=e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population,daily:S.daily})');
  e.run('globalThis.__masterWrites=0;const originalWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")__masterWrites++;originalWrite(k,v)}');
  const preview=result(e,"settlementBatchPreview('village',4,0)");
  assert.equal(preview.ok,true);
  assert.equal(preview.cost,26);
  assert.equal(preview.gain,4);
  assert.equal(preview.level,4);
  assert.equal(preview.remainingDeed,4);
  assert.equal(e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population,daily:S.daily})'),stateBefore);
  assert.equal(e.store.get('rts_save'),masterBefore);
  const action=result(e,"upgradeSettlementBatch('village',4,0,30)");
  assert.equal(action.ok,true);
  assert.equal(action.cost,26);
  assert.equal(action.gain,4);
  assert.equal(action.level,4);
  assert.equal(action.remainingDeed,4);
  assert.equal(e.run('S.settlements.village'),4);
  assert.equal(e.run('S.res.deed'),4);
  assert.equal(e.run('maxPop()'),8);
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.run('__masterWrites'),1,'多级扩建应只写一次主档');
  assert.equal(result(e,"upgradeSettlementBatch('village',4,0)").ok,false,'旧按钮二次触发不得重复扣地契');
  assert.equal(e.run('__masterWrites'),1);
  assert.equal(e.run('S.res.deed'),4);
  assert.equal(e.store.get('rts_save_backup_1'),masterBefore);
  const reload=environment(Object.fromEntries(e.store));
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.settlements.village'),4);
  assert.equal(reload.run('S.res.deed'),4);
  assert.equal(reload.run('maxPop()'),8);
});

test('小镇高等级按旧单级浮点口径逐级累计，不改写历史价格',()=>{
  const e=environment();
  e.run("S.sciences.push('sci_urbanization');S.settlements.smallTown=36;S.res.deed=1000");
  assert.equal(e.run("settlementCost('smallTown')"),122);
  const preview=result(e,"settlementBatchPreview('smallTown',2,36)");
  assert.equal(preview.ok,true);
  assert.equal(preview.cost,248,'Lv36 与 Lv37 必须按现有价格 122+126');
  assert.equal(preview.gain,4);
  assert.equal(preview.level,38);
  assert.equal(preview.remainingDeed,752);
  const action=result(e,"upgradeSettlementBatch('smallTown',2,36,1000)");
  assert.equal(action.ok,true);
  assert.equal(action.cost,248);
  assert.equal(e.run('S.settlements.smallTown'),38);
  assert.equal(e.run('S.res.deed'),752);
});

test('科技锁、总地契不足、旧等级与无效数量均拒绝整笔扩容',()=>{
  const e=environment();
  const baseline=e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})');
  assert.equal(result(e,"settlementBatchPreview('smallTown',1,0)").ok,false);
  assert.equal(result(e,"upgradeSettlementBatch('city',1,1)").ok,false);
  assert.equal(result(e,"settlementBatchPreview('village',5,0)").ok,false,'第五级总费35而新档仅30地契');
  assert.equal(result(e,"upgradeSettlementBatch('village',5,0)").ok,false);
  assert.equal(result(e,"upgradeSettlementBatch('village',1,1)").ok,false);
  for(const count of ['0','-1','1.5','NaN','Infinity'])
    assert.equal(result(e,`upgradeSettlementBatch('village',${count},0)`).ok,false,count);
  assert.equal(result(e,"upgradeSettlementBatch('unknown',1,0)").ok,false);
  assert.equal(e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})'),baseline);
  assert.equal(e.store.has('rts_save'),false,'所有预检失败都不应写主档');
});

test('批量扩容备份写入或主档写入失败时全额回滚',()=>{
  for(const key of ['rts_save_backup_1','rts_save']){
    const e=environment();assert.equal(e.run('save().ok'),true);
    const master=e.store.get('rts_save');
    const before=e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})');
    failWrites(e,key);
    assert.equal(result(e,"upgradeSettlementBatch('village',4,0,30)").ok,false,key);
    assert.equal(e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})'),before,key);
    assert.equal(e.store.get('rts_save'),master,key);
  }
});

test('旧 v3 档超仓库存、合法零与历史人口在批量扩容后完整保留',()=>{
  const original=oldV3Text();
  const e=environment({rts_save:original});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.run('settleOffline().checkpoint'),true);
  const oldPopulation=e.run('popCurrent()');
  const oldCapacity=e.run('maxPop()');
  const oldBonus=e.run('S.population.legacyBonus');
  const oldAllocated=e.run('popAllocTotal()');
  assert.ok(e.run('S.res.wood>resCap("wood")'));
  assert.equal(e.run('S.res.coin'),0);
  assert.equal(result(e,"upgradeSettlementBatch('village',2,0,70)").ok,true);
  assert.equal(e.run('S.res.wood'),60000);
  assert.equal(e.run('S.res.coin'),0);
  assert.equal(e.run('S.res.deed'),59);
  assert.equal(e.run('S.population.legacyBonus'),oldBonus);
  assert.equal(e.run('popCurrent()'),oldPopulation);
  assert.equal(e.run('popAllocTotal()'),oldAllocated);
  assert.equal(e.run('maxPop()'),oldCapacity+2);
  assert.equal(e.store.get('rts_save_premigration'),original);
  const reload=environment(Object.fromEntries(e.store));
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.wood'),60000);
  assert.equal(reload.run('S.res.coin'),0);
  assert.equal(reload.run('S.res.deed'),59);
});

test('木材购契报价纯读，组合动作等于现有两笔兑换且只保存一次',()=>{
  const combo=environment(),separate=environment();
  readyMarket(combo);readyMarket(separate);
  assert.equal(combo.run('save().ok'),true);
  const before=combo.run('JSON.stringify({res:S.res,daily:S.daily})');
  const masterBefore=combo.store.get('rts_save');
  combo.run('globalThis.__masterWrites=0;const originalWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")__masterWrites++;originalWrite(k,v)}');
  const quote=result(combo,"previewDeedPurchase('wood',2)");
  assert.equal(quote.ok,true);
  assert.equal(quote.coinCost,200);
  assert.equal(quote.coinUsed,50);
  assert.equal(quote.sourceCost,1500);
  assert.equal(quote.remainingDeed,2);
  assert.equal(combo.run('JSON.stringify({res:S.res,daily:S.daily})'),before);
  assert.equal(combo.store.get('rts_save'),masterBefore);
  const action=result(combo,`buyDeedsWithResource('wood',2,${quote.sourceCost},${quote.startingDeed})`);
  assert.equal(action.ok,true);
  assert.equal(action.sourceCost,1500);
  assert.equal(combo.run('__masterWrites'),1);
  assert.equal(separate.run("exchangeResource('wood','coin',1500).ok"),true);
  assert.equal(separate.run("exchangeResource('coin','deed',200).ok"),true);
  assert.equal(combo.run('JSON.stringify(S.res)'),separate.run('JSON.stringify(S.res)'));
  assert.equal(combo.run("dailyCount('market')"),0);
  assert.equal(separate.run("dailyCount('market')"),0);
});

test('组合购契不消耗已用完的高级兑换日限',()=>{
  const e=environment();readyMarket(e,true);
  e.run("S.daily={day:localDay(),counts:{market:5}}");
  const quote=result(e,"previewDeedPurchase('wood',1)");
  assert.equal(quote.ok,true);
  assert.equal(result(e,`buyDeedsWithResource('wood',1,${quote.sourceCost},${quote.startingDeed})`).ok,true);
  assert.equal(e.run("dailyCount('market')"),5);
});

test('金币减少导致快捷购契所需出售量增加时拒绝旧报价',()=>{
  const e=environment();readyMarket(e);
  const quote=result(e,"previewDeedPurchase('wood',2)");
  assert.equal(quote.ok,true);
  assert.equal(quote.sourceCost,1500);
  e.run('S.res.coin=40;save()');
  assert.equal(result(e,"previewDeedPurchase('wood',2)").sourceCost,1600);
  const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
  const master=e.store.get('rts_save');
  assert.equal(result(e,`buyDeedsWithResource('wood',2,${quote.sourceCost},${quote.startingDeed})`).reason,'stale-quote');
  assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),before);
  assert.equal(e.store.get('rts_save'),master);
});

test('购契坏数量、未知路线与未建市场均拒绝整笔',()=>{
  const e=environment();
  const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
  assert.equal(result(e,"previewDeedPurchase('wood',1)").ok,false);
  assert.equal(result(e,"buyDeedsWithResource('wood',1,1000)").ok,false);
  readyMarket(e);
  const ready=e.run('JSON.stringify({res:S.res,daily:S.daily})');
  for(const count of ['0','-1','1.5','NaN','Infinity'])
    assert.equal(result(e,`previewDeedPurchase('wood',${count})`).ok,false,count);
  for(const from of ['iron','deed','unknown'])
    assert.equal(result(e,`previewDeedPurchase('${from}',1)`).ok,false,from);
  assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),ready);
  assert.notEqual(before,ready);
  assert.equal(e.store.has('rts_save'),false);
});

test('购契来源不足、金币中间仓容不足、地契满仓均拒绝且不裁剪',()=>{
  const e=environment();readyMarket(e);
  e.run('S.res.wood=0;S.res.coin=0');
  assert.equal(result(e,"previewDeedPurchase('wood',1)").ok,false);
  e.run("S.res.wood=5000;S.res.coin=resCap('coin')-50");
  assert.equal(result(e,"previewDeedPurchase('wood',201)").ok,false);
  e.run("S.res.coin=0;S.res.deed=resCap('deed')");
  const overcap=e.run('JSON.stringify(S.res)');
  assert.equal(result(e,"previewDeedPurchase('wood',1)").ok,false);
  assert.equal(e.run('JSON.stringify(S.res)'),overcap);
});

test('组合购契备份或主档写入失败时来源、金币、地契一并回滚',()=>{
  for(const key of ['rts_save_backup_1','rts_save']){
    const e=environment();readyMarket(e);assert.equal(e.run('save().ok'),true);
    const quote=result(e,"previewDeedPurchase('wood',2)");
    assert.equal(quote.ok,true);
    const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
    const master=e.store.get('rts_save');
    failWrites(e,key);
    assert.equal(result(e,`buyDeedsWithResource('wood',2,${quote.sourceCost},${quote.startingDeed})`).ok,false,key);
    assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),before,key);
    assert.equal(e.store.get('rts_save'),master,key);
  }
});

test('三种基础资源同篮子购契等价四笔真实兑换，日限已满也不旁路高级交易',()=>{
  const combo=environment(),separate=environment();
  for(const e of [combo,separate]){
    readyMarket(e,true);
    e.run("S.res.wood=1000;S.res.stone=1000;S.res.food=1500;S.res.coin=0;S.daily={day:localDay(),counts:{market:5}}");
  }
  assert.equal(combo.run('save().ok'),true);
  const sales="[{from:'wood',qty:500},{from:'stone',qty:500},{from:'food',qty:1000}]";
  const before=combo.run('JSON.stringify({res:S.res,daily:S.daily})');
  combo.run('globalThis.__basketMasterWrites=0;const originalWrite=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==="rts_save")__basketMasterWrites++;originalWrite(k,v)}');
  const quote=result(combo,`previewDeedBasket(${sales},2)`);
  assert.equal(quote.ok,true);
  assert.equal(quote.coinCost,200);
  assert.equal(quote.coinGained,200);
  assert.equal(quote.remainingDeed,2);
  const gains=quote.trades.slice(0,-1).map(t=>t.get);
  assert.deepEqual(gains,[50,70,80]);
  assert.equal(combo.run('JSON.stringify({res:S.res,daily:S.daily})'),before,'篮子报价不得改状态');
  const action=result(combo,`buyDeedsBasket(${sales},2,${quote.coinCost},${JSON.stringify(gains)},${quote.startingDeed})`);
  assert.equal(action.ok,true);
  assert.equal(combo.run('__basketMasterWrites'),1);
  assert.equal(separate.run("exchangeResource('wood','coin',500).ok"),true);
  assert.equal(separate.run("exchangeResource('stone','coin',500).ok"),true);
  assert.equal(separate.run("exchangeResource('food','coin',1000).ok"),true);
  assert.equal(separate.run("exchangeResource('coin','deed',200).ok"),true);
  assert.equal(combo.run('JSON.stringify(S.res)'),separate.run('JSON.stringify(S.res)'));
  assert.equal(combo.run("dailyCount('market')"),5);
  assert.equal(separate.run("dailyCount('market')"),5);
  assert.equal(result(combo,"exchangeResource('wood','coin',10)").ok,true);
  assert.equal(result(combo,"exchangeResource('coin','wood',1)").reason,'daily-limit','篮子不能重置或绕过高级交易日限');
});

test('篮子无效来源、单项资源不足与过时报价均不成交',()=>{
  const e=environment();readyMarket(e);
  const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
  assert.equal(result(e,"previewDeedBasket([{from:'coin',qty:100}],1)").ok,false);
  assert.equal(result(e,"previewDeedBasket([{from:'wood',qty:10},{from:'wood',qty:10}],1)").ok,false);
  assert.equal(result(e,"previewDeedBasket([{from:'wood',qty:500},{from:'stone',qty:100000}],1)").ok,false);
  const sales="[{from:'wood',qty:500},{from:'stone',qty:500}]";
  const quote=result(e,`previewDeedBasket(${sales},1)`);
  assert.equal(quote.ok,true);
  assert.equal(result(e,`buyDeedsBasket(${sales},1,${quote.coinCost},[51,70],${quote.startingDeed})`).reason,'stale-quote');
  assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),before);
  assert.equal(e.store.has('rts_save'),false);
});

test('篮子主档写失败无部分成交，历史超仓来源可支出而不被裁剪',()=>{
  const e=environment();readyMarket(e);
  e.run('S.res.wood=60000;S.res.coin=0;save()');
  assert.equal(e.run("S.res.wood>resCap('wood')"),true);
  const master=e.store.get('rts_save');
  const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
  const quote=result(e,"previewDeedBasket([{from:'wood',qty:1000}],1)");
  assert.equal(quote.ok,true);
  failWrites(e,'rts_save');
  assert.equal(result(e,`buyDeedsBasket([{from:'wood',qty:1000}],1,${quote.coinCost},[100],${quote.startingDeed})`).ok,false);
  assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),before);
  assert.equal(e.store.get('rts_save'),master);
  e.run('localStorage.setItem=originalSetItem');
  assert.equal(result(e,`buyDeedsBasket([{from:'wood',qty:1000}],1,${quote.coinCost},[100],${quote.startingDeed})`).ok,true);
  assert.equal(e.run('S.res.wood'),59000);
  assert.equal(e.run('S.res.coin'),0);
  assert.equal(e.run('S.res.deed'),1);
  e.run("S.res.coin=resCap('coin')+200;S.res.deed=0");
  const overcapQuote=result(e,"previewDeedPurchase('wood',2)");
  assert.equal(overcapQuote.sourceCost,0);
  assert.equal(result(e,`buyDeedsWithResource('wood',2,0,${overcapQuote.startingDeed})`).ok,true);
  assert.equal(e.run('S.res.coin'),e.run("resCap('coin')"));
  assert.equal(e.run('S.res.wood'),59000);
  assert.equal(e.run('S.res.deed'),2);
});

test('同一购契报价重复点击只能成交一次，缺少预览地契余额不能提交',()=>{
  const quick=environment();readyMarket(quick);
  quick.run('S.res.coin=0;save()');
  const quickQuote=result(quick,"previewDeedPurchase('wood',1)");
  assert.equal(quickQuote.sourceCost,1000);
  assert.equal(quickQuote.startingDeed,0);
  assert.equal(result(quick,"buyDeedsWithResource('wood',1,1000)").ok,false,'动作必须携带报价时的地契余额');
  assert.equal(result(quick,`buyDeedsWithResource('wood',1,1000,${quickQuote.startingDeed})`).ok,true);
  const quickAfter=quick.run('JSON.stringify({res:S.res,daily:S.daily})');
  const quickMaster=quick.store.get('rts_save');
  assert.equal(result(quick,`buyDeedsWithResource('wood',1,1000,${quickQuote.startingDeed})`).reason,'stale-quote');
  assert.equal(quick.run('JSON.stringify({res:S.res,daily:S.daily})'),quickAfter);
  assert.equal(quick.store.get('rts_save'),quickMaster);

  const basket=environment();readyMarket(basket);
  basket.run('S.res.coin=0;save()');
  const sales="[{from:'wood',qty:1000}]";
  const basketQuote=result(basket,`previewDeedBasket(${sales},1)`);
  const gains=basketQuote.trades.slice(0,-1).map(t=>t.get);
  assert.equal(basketQuote.startingDeed,0);
  assert.equal(result(basket,`buyDeedsBasket(${sales},1,100,[100])`).ok,false,'篮子也必须携带预览余额');
  assert.equal(result(basket,`buyDeedsBasket(${sales},1,${basketQuote.coinCost},${JSON.stringify(gains)},${basketQuote.startingDeed})`).ok,true);
  const basketAfter=basket.run('JSON.stringify({res:S.res,daily:S.daily})');
  const basketMaster=basket.store.get('rts_save');
  assert.equal(result(basket,`buyDeedsBasket(${sales},1,${basketQuote.coinCost},${JSON.stringify(gains)},${basketQuote.startingDeed})`).reason,'stale-quote');
  assert.equal(basket.run('JSON.stringify({res:S.res,daily:S.daily})'),basketAfter);
  assert.equal(basket.store.get('rts_save'),basketMaster);
});

test('扩建预览后地契余额变化，即使仍可支付也拒绝原报价',()=>{
  const e=environment();
  const quote=result(e,"settlementBatchPreview('village',4,0)");
  assert.equal(quote.ok,true);
  assert.equal(quote.cost,26);
  const quotedDeed=e.run('S.res.deed');
  e.run('S.res.deed=29;save()');
  const before=e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})');
  const master=e.store.get('rts_save');
  assert.equal(result(e,`upgradeSettlementBatch('village',4,0,${quotedDeed})`).ok,false);
  assert.equal(e.run('JSON.stringify({res:S.res,settlements:S.settlements,population:S.population})'),before);
  assert.equal(e.store.get('rts_save'),master);
  const fresh=result(e,"settlementBatchPreview('village',4,0)");
  assert.equal(fresh.cost,26);
  assert.equal(fresh.remainingDeed,3);
  assert.equal(result(e,"upgradeSettlementBatch('village',4,0,29)").ok,true);
  assert.equal(e.run('S.res.deed'),3);
});

test('购契预览后金币微增且价格不变，快捷和篮子仍可按原报价成交',()=>{
  const quick=environment();readyMarket(quick);
  const quickQuote=result(quick,"previewDeedPurchase('wood',2)");
  assert.equal(quickQuote.coinCost,200);
  assert.equal(quickQuote.sourceCost,1500);
  assert.equal(quickQuote.startingCoin,50);
  quick.run('S.res.coin=50.1;save()');
  assert.equal(result(quick,"previewDeedPurchase('wood',2)").sourceCost,1500,'金币小变动并未改变本次出售数量');
  const quickAction=result(quick,`buyDeedsWithResource('wood',2,${quickQuote.sourceCost},${quickQuote.startingDeed})`);
  assert.equal(quickAction.ok,true);
  assert.equal(quickAction.sourceCost,1500);
  assert.equal(quick.run('S.res.wood'),3500);
  assert.equal(quick.run('S.res.deed'),2);
  assert.ok(Math.abs(quick.run('S.res.coin')-0.1)<1e-9);

  const basket=environment();readyMarket(basket);
  const sales="[{from:'wood',qty:1500}]";
  const basketQuote=result(basket,`previewDeedBasket(${sales},2)`);
  assert.equal(basketQuote.ok,true);
  assert.equal(basketQuote.startingCoin,50);
  basket.run('S.res.coin=50.1;save()');
  const refreshed=result(basket,`previewDeedBasket(${sales},2)`);
  assert.equal(refreshed.ok,true);
  assert.equal(refreshed.coinCost,basketQuote.coinCost);
  assert.equal(refreshed.coinGained,basketQuote.coinGained);
  assert.equal(result(basket,`buyDeedsBasket(${sales},2,${basketQuote.coinCost},[150],${basketQuote.startingDeed})`).ok,true);
  assert.equal(basket.run('S.res.wood'),3500);
  assert.equal(basket.run('S.res.deed'),2);
  assert.ok(Math.abs(basket.run('S.res.coin')-0.1)<1e-9);
});

test('金币增长降低快捷购契所需出售量时按较低实际花费成交',()=>{
  const e=environment();readyMarket(e);
  const quote=result(e,"previewDeedPurchase('wood',2)");
  assert.equal(quote.sourceCost,1500);
  e.run('S.res.coin=60;save()');
  assert.equal(result(e,"previewDeedPurchase('wood',2)").sourceCost,1400);
  const action=result(e,`buyDeedsWithResource('wood',2,${quote.sourceCost},${quote.startingDeed})`);
  assert.equal(action.ok,true);
  assert.equal(action.sourceCost,1400);
  assert.equal(e.run('S.res.wood'),3600);
  assert.equal(e.run('S.res.coin'),0);
  assert.equal(e.run('S.res.deed'),2);
});

console.log(`${passed} passed / ${failed} failed`);
process.exitCode=failed?1:0;
