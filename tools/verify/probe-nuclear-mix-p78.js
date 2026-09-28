'use strict';
// P78：在一次性丢弃的VM副本中枚举知识仓组合；建筑/图纸/研究等级均为未付款条件值。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const raw=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p76-stock-scroll-paid.json'),'utf8');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({techCap:resCap('tech'),scroll:S.beastExchange.scrollUsed,electric:S.eraStorage.electricKnowledge,library:S.buildings.library.lv,institute:S.buildings.institute.lv,woodCap:resCap('wood'),stoneCap:resCap('stone'),wood:S.res.wood,stone:S.res.stone,guardianStone:S.items.guardianStone})");
const target=100000000;
const materialStock=run("Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]]))");
const totalMaterials=Object.values(materialStock).reduce((a,b)=>a+b,0);
const electricPayments=[];
let electricTech=0,electricStones=0;
for(let level=initial.electric;level<20;level++){
  run(`S.eraStorage.electricKnowledge=${level}`);
  const cost=run("eraStorageCost('electricKnowledge')");
  electricTech+=cost.tech;electricStones+=cost.guardianStone||0;
  electricPayments.push({toLevel:level+1,cost,cumulative:{tech:electricTech,guardianStone:electricStones}});
}
function buildingCostTable(key,start,end){
  const cumulative=[0],maxSingle=[0];
  for(let lv=start;lv<end;lv++){
    run(`S.buildings.${key}.lv=${lv}`);
    const c=run(`upCost('${key}')`);
    assert.equal(c.wood,c.stone);
    cumulative.push(cumulative.at(-1)+c.wood);
    maxSingle.push(Math.max(maxSingle.at(-1),c.wood));
  }
  return{cumulative,maxSingle};
}
const lib=buildingCostTable('library',initial.library,1000);
const ins=buildingCostTable('institute',initial.institute,1000);
function capAt(libLv,insLv,scroll,electric){
  return run(`(()=>{S.buildings.library.lv=${libLv};S.buildings.institute.lv=${insLv};S.beastExchange.scrollUsed=${scroll};S.eraStorage.electricKnowledge=${electric};return resCap('tech')})()`);
}
const scrollTargets=[80,100,120,140,160,180,200,240,280];
const electricTargets=[15,16,18,20];
const stockOnlyBestDiscountScrolls=Math.floor(totalMaterials/(run('CFG.beastExchange.heartPerScroll')*0.1));
const stockOnlyUpper={assumption:'all six material stocks convertible at 10% quality; no new battles or drops; both knowledge buildings conditionally Lv1000; electric knowledge stays Lv15',
  extraScroll:stockOnlyBestDiscountScrolls,totalScroll:initial.scroll+stockOnlyBestDiscountScrolls,
  cap:capAt(1000,1000,initial.scroll+stockOnlyBestDiscountScrolls,initial.electric)};
assert.ok(stockOnlyUpper.cap<target);
const frontier=[];
for(const electric of electricTargets){
  for(const scroll of scrollTargets){
    let best=null;
    for(let library=initial.library;library<=1000;library++){
      if(capAt(library,1000,scroll,electric)<target)continue;
      let lo=initial.institute,hi=1000;
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(capAt(library,mid,scroll,electric)>=target)hi=mid;else lo=mid+1}
      const institute=lo;
      const libCost=lib.cumulative[library-initial.library];
      const insCost=ins.cumulative[institute-initial.institute];
      const candidate={library,institute,scroll,electric,cap:capAt(library,institute,scroll,electric),
        extraScroll:scroll-initial.scroll,extraElectric:electric-initial.electric,
        buildingCostEach:libCost+insCost,
        maxSinglePayment:Math.max(lib.maxSingle[library-initial.library],ins.maxSingle[institute-initial.institute])};
      if(!best||candidate.buildingCostEach<best.buildingCostEach)best=candidate;
    }
    frontier.push(best||{scroll,electric,reachableEvenAtMaxBuildings:false,maximumCap:capAt(1000,1000,scroll,electric)});
  }
}
assert.equal(e.store.get('rts_save'),raw,'条件枚举不得写回实付档');
console.log(JSON.stringify({kind:'unpaid mixed frontier only',unit:'resource units; levels; no time estimate',initial,target,materialStock,totalMaterials,
  minimumScrollPrice:run('CFG.beastExchange.heartPerScroll*0.1'),stockOnlyUpper,electricPayments,frontier},null,2));
