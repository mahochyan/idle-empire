'use strict';
// 在P61真实付费存档的隔离VM中计算材料预算容量上界；条件等级绝不写回存档。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const input=process.argv.find(x=>x.startsWith('--save='))?.slice('--save='.length);
assert.ok(input,'须提供 --save=真实实付存档');
const raw=fs.readFileSync(input,'utf8');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),45);
assert.equal(run("ownMaxFor('library')"),1000);
assert.equal(run("ownMaxFor('institute')"),1000);
const start=run("({second:S.tick,cap:resCap('tech'),library:bldSt('library').lv,institute:bldSt('institute').lv,steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,crystal:S.items.godCrystal,stone:S.items.guardianStone,medal:S.res.medal})");
const studies=[];
for(const [key,material] of [['steamKnowledge','godCrystal'],['electricKnowledge','guardianStone']]){
  let budget=run(`S.items.${material}`),techCost=0;
  while(run(`S.eraStorage.${key}`)<run(`CFG.eraStorage.${key}.maxLevel`)){
    const cost=run(`eraStorageCost('${key}')`);
    if((cost[material]||0)>budget)break;
    budget-=cost[material]||0;techCost+=cost.tech;
    run(`S.eraStorage.${key}++`);
  }
  studies.push({key,conditionalLevel:run(`S.eraStorage.${key}`),remainingMaterial:budget,unpaidTechCost:techCost,nextCost:run(`eraStorageCost('${key}')`)});
}
const currentBuildingsCap=run("resCap('tech')");
run("S.buildings.library.lv=1000;S.buildings.institute.lv=1000");
const fullBuildingsCap=run("resCap('tech')");
assert.equal(e.store.get('rts_save'),raw,'条件等级意外写回主档');
assert.ok(fullBuildingsCap>=currentBuildingsCap&&currentBuildingsCap>=start.cap);
console.log(JSON.stringify({unit:'resource units; conditional ceilings only',start,studies,currentBuildingsCap,fullBuildingsCap,nuclearTechCost:100000000,shortfall:100000000-fullBuildingsCap,condition:'忽略每笔知识费与中途容量；未造建筑、未研究、未取得产业或卷轴'},null,2));
