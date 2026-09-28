'use strict';
// P76：只在丢弃的 VM 副本里计算仓容边界，不保存、不把条件等级写成实付。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const raw=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p76-stock-scroll-paid.json'),'utf8');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const current=run("({cap:resCap('tech'),used:S.beastExchange.scrollUsed,library:S.buildings.library.lv,institute:S.buildings.institute.lv,stoneStore:S.buildings.stone_store.lv,stoneCap:resCap('stone'),woodCap:resCap('wood')})");
assert.equal(current.used,80);
const threshold=100000000;
function scrollThreshold(){
  const start=run('S.beastExchange.scrollUsed');
  for(let n=start;n<=run('CFG.beastExchange.scrollUseLimit');n++){
    run(`S.beastExchange.scrollUsed=${n}`);
    if(run("resCap('tech')")>=threshold){run(`S.beastExchange.scrollUsed=${start}`);return n}
  }
  run(`S.beastExchange.scrollUsed=${start}`);return null;
}
const currentBuildingScrollNeed=scrollThreshold();
function conditionallyMax(key){
  const max=run(`ownMaxFor('${key}')`);
  assert.equal(max,1000);
  const start=run(`S.buildings.${key}.lv`);
  let wood=0,stone=0,maxSingleWood=0,maxSingleStone=0;
  for(let lv=start;lv<max;lv++){
    const cost=run(`upCost('${key}')`);
    wood+=cost.wood||0;stone+=cost.stone||0;
    maxSingleWood=Math.max(maxSingleWood,cost.wood||0);
    maxSingleStone=Math.max(maxSingleStone,cost.stone||0);
    run(`S.buildings.${key}.lv++`);
  }
  return{start,max,levels:max-start,cost:{wood,stone},largestSinglePayment:{wood:maxSingleWood,stone:maxSingleStone}};
}
const library=conditionallyMax('library');
const institute=conditionallyMax('institute');
const conditionalCap=run("resCap('tech')");
const maxBuildingScrollNeed=scrollThreshold();
const conditionalCapAtThreshold=run(`(()=>{S.beastExchange.scrollUsed=${maxBuildingScrollNeed};return resCap('tech')})()`);
run(`S.beastExchange.scrollUsed=${current.used}`);
const biggestPayment=Math.max(library.largestSinglePayment.stone,institute.largestSinglePayment.stone);
let requiredStoneStore=current.stoneStore;
let stoneStoreCost=0;
while(run("resCap('stone')")<biggestPayment||run("resCap('wood')")<biggestPayment){
  stoneStoreCost+=run("upCost('stone_store').stone")||0;
  run('S.buildings.stone_store.lv++');requiredStoneStore++;
  assert.ok(requiredStoneStore<1000);
}
const paymentCaps=run("({stone:resCap('stone'),wood:resCap('wood')})");
assert.ok(conditionalCap<threshold&&conditionalCapAtThreshold>=threshold);
assert.equal(e.store.get('rts_save'),raw,'条件计算不得写回存档');
console.log(JSON.stringify({kind:'unpaid sensitivity only',unit:'resource units; no time estimate',current,currentBuildingScrollNeed,
  currentBuildingExtraScrolls:currentBuildingScrollNeed-current.used,library,institute,
  conditionalCapWithMaxBuildings:conditionalCap,maxBuildingScrollNeed,
  maxBuildingExtraScrolls:maxBuildingScrollNeed-current.used,conditionalCapAtThreshold,
  requiredStoneStoreAtCurrentScroll:{level:requiredStoneStore,extraLevels:requiredStoneStore-current.stoneStore,conditionalStoneCost:stoneStoreCost,paymentCaps,biggestPayment},
  nuclearKnowledgePayment:threshold},null,2));
