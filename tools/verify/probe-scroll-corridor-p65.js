'use strict';
// 从同一实战存档用六类郊野材料买图纸、扩知识仓并支付下一笔科研；不预置资源。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const saveArg=process.argv.find(x=>x.startsWith('--save='));
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
assert.ok(saveArg,'须提供 --save=真实实战存档');
const raw=fs.readFileSync(saveArg.slice('--save='.length),'utf8');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok','输入档须可安全重载');
assert.equal(run('S.defeated.length'),45);
assert.ok(run('S.beastExchange.level')>=run('CFG.beastExchange.scrollLevel'));
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const seed=seedArg?Number(seedArg.slice('--seed='.length)):9;
assert.ok(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff);
const targetArg=process.argv.find(x=>x.startsWith('--target-level='));
const targetLevel=targetArg?Number(targetArg.slice('--target-level='.length)):5;
assert.ok(Number.isSafeInteger(targetLevel)&&targetLevel>=1&&targetLevel<=100);
run(`globalThis.__scrollSeed=${seed};Math.random=()=>{let x=__scrollSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__scrollSeed=x>>>0;return __scrollSeed/4294967296}`);
const keys=run('CFG.beastExchange.scrollMaterials');
const before=run("({second:S.tick,cap:resCap('tech'),tech:S.res.tech,scrollUsed:S.beastExchange.scrollUsed,scrollStock:S.items.storageScroll,charges:S.beastExchange.refreshCharges,clock:S.beastExchange.refreshClock,electric:S.eraStorage.electricKnowledge,material:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]]))})");
const nextCost=run("eraStorageCost('electricKnowledge')");
assert.ok(nextCost&&nextCost.tech>before.cap,'此档的下一笔电力知识升级应有仓容缺口');
assert.equal(before.electric+1,targetLevel,'目标级须为当前电力知识科研的下一等级');
let refreshes=0,onlineWait=0,scrollsBought=0,materialPaid=0,offersSeen=0;
const purchased=Object.fromEntries(keys.map(k=>[k,{count:0,cost:0}]));
function buyVisibleOffers(){
  let bought=0;
  for(const key of keys){
    const offers=run(`beastScrollOfferCount('${key}')`);
    if(offers>0)offersSeen+=offers;
    const price=run(`beastScrollTradeCost('${key}')`);
    const stock=run(`S.items.${key}`);
    const count=Math.min(offers,Math.floor(stock/price));
    if(count<=0)continue;
    const old=run(`({stock:S.items.${key},scroll:S.items.storageScroll,offers:beastScrollOfferCount('${key}')})`);
    const trade=run(`exchangeWildMaterialForScrolls('${key}',${count})`);
    assert.equal(trade?.ok,true,`${key} 图纸实付失败：${JSON.stringify(trade)}`);
    assert.equal(old.stock-run(`S.items.${key}`),trade.cost);
    assert.equal(run('S.items.storageScroll')-old.scroll,count);
    assert.equal(old.offers-run(`beastScrollOfferCount('${key}')`),count);
    const use=run(`useStorageScroll(${count})`);
    assert.equal(use?.ok,true,`${key} 图纸使用失败：${JSON.stringify(use)}`);
    purchased[key].count+=count;purchased[key].cost+=trade.cost;
    scrollsBought+=count;materialPaid+=trade.cost;bought+=count;
    if(run("resCap('tech')")>=nextCost.tech)break;
  }
  return bought;
}
buyVisibleOffers();
while(run("resCap('tech')")<nextCost.tech&&refreshes<120){
  if(run('S.beastExchange.refreshCharges')<1){
    const waited=run('(()=>{let n=0;while(S.beastExchange.refreshCharges<1&&n<CFG.beastExchange.refreshSeconds){tick();n++}return n})()');
    onlineWait+=waited;
    assert.ok(run('S.beastExchange.refreshCharges')>=1,'刷新次数未按在线时间恢复');
  }
  const refreshed=run('refreshBeastExchange()');
  assert.equal(refreshed?.ok,true,`边贸行刷新失败：${JSON.stringify(refreshed)}`);
  refreshes++;
  buyVisibleOffers();
}
const capAfterScrolls=run("resCap('tech')");
assert.ok(capAfterScrolls>=nextCost.tech,`120次刷新未跨过知识付款仓容：${capAfterScrolls}`);
for(const key of keys)assert.equal(before.material[key]-run(`S.items.${key}`),purchased[key].cost,`${key} 材料实扣不符`);
assert.equal(run('S.beastExchange.scrollUsed')-before.scrollUsed,scrollsBought);
assert.ok(scrollsBought>0);
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退${key}岗位失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配${key}岗位失败`);
}
assign({food:20,tech:82});
const studySeconds=run(`(()=>{let n=0;while(S.res.tech<${nextCost.tech}&&n<100000){tick();n++}return n})()`);
assert.ok(run('S.res.tech')>=nextCost.tech,'100000在线秒内未攒足付款知识');
const paymentBefore=run('({second:S.tick,tech:S.res.tech,stone:S.items.guardianStone,electric:S.eraStorage.electricKnowledge})');
const paid=run("upgradeEraStorage('electricKnowledge')");
assert.equal(paid?.ok,true,`电力知识${targetLevel}级实付失败：${JSON.stringify(paid)}`);
assert.equal(paymentBefore.tech-run('S.res.tech'),nextCost.tech,'知识实扣不符');
assert.equal(paymentBefore.stone-run('S.items.guardianStone'),nextCost.guardianStone||0,'守御之石实扣不符');
assert.equal(run('S.eraStorage.electricKnowledge'),paymentBefore.electric+1);
const final=JSON.parse(env.store.get('rts_save'));
assert.equal(final.v,29);
const reload=environment({rts_save:JSON.stringify(final)});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),run("resCap('tech')"));
assert.equal(reload.run('S.eraStorage.electricKnowledge'),final.eraStorage.electricKnowledge);
if(finalArg)fs.writeFileSync(finalArg.slice('--snapshot-final='.length),JSON.stringify(final),'utf8');
console.log(JSON.stringify({unit:'online seconds; resource units',seed,before,nextCost,refreshes,offersSeen,onlineWait,scrollsBought,materialPaid,purchased,capAfterScrolls,studySeconds,paymentBefore,finish:{second:final.tick,cap:run("resCap('tech')"),tech:final.res.tech,electric:final.eraStorage.electricKnowledge,scrollUsed:final.beastExchange.scrollUsed,medal:final.res.medal,material:Object.fromEntries(keys.map(k=>[k,final.items[k]]))}},null,2));
