'use strict';
// Real two-level steam knowledge payment and stock-only border exchange from P269's paid roster.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p269-crystal-full-roster-last-recovered-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const selectedSeed=process.argv.find(x=>x.startsWith('--seed='));
const seed=selectedSeed?Number(selectedSeed.slice(7)):13;
assert.ok(Number.isSafeInteger(seed)&&seed>=1&&seed<=16);
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const initial=run("({tick:S.tick,army:armyCount(),pop:popCurrent(),food:S.res.food,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,steam:S.eraStorage.steamKnowledge,scrollUsed:S.beastExchange.scrollUsed,items:{...S.items},refreshClock:S.beastExchange.refreshClock,refreshCharges:S.beastExchange.refreshCharges})");
assert.equal(initial.army,516);assert.equal(initial.pop,1002);assert.equal(initial.steam,14);
let elapsed=0,minFood=initial.food;
function tickUntil(condition,max){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${condition})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${condition})}})()`);
  elapsed+=result.n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');
  assert.equal(result.done,true,`tick condition timed out: ${condition}`);
  return result.n;
}
for(const [rk,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
assert.equal(run("setPopAlloc('food',80)")?.ok,true);
assert.equal(run("setPopAlloc('tech',922)")?.ok,true);
assert.equal(run('popAllocTotal()'),1002);
const scholar=run("({rate:prodRate('tech'),netFood:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost})");
assert.ok(scholar.rate>0&&scholar.netFood>0);
const upgrades=[];
for(const target of [15,16]){
  const cost=run("eraStorageCost('steamKnowledge')");
  assert.equal(cost.godCrystal,target*10);
  const waited=tickUntil(`S.res.tech>=${cost.tech}`,100000);
  const before=run("({tech:S.res.tech,crystal:S.items.godCrystal,cap:resCap('tech')})");
  const result=run("upgradeEraStorage('steamKnowledge')");
  assert.equal(result?.ok,true);
  const after=run("({tech:S.res.tech,crystal:S.items.godCrystal,cap:resCap('tech'),level:S.eraStorage.steamKnowledge})");
  assert.equal(after.level,target);assert.equal(before.tech-after.tech,cost.tech);assert.equal(before.crystal-after.crystal,cost.godCrystal);
  upgrades.push({target,cost,waited,before,after});
}
const capAfterUpgrades=run("resCap('tech')");
let conditionalScrolls=0;
while(run("resCap('tech')")<100000000&&conditionalScrolls<30){conditionalScrolls++;run('S.beastExchange.scrollUsed+=1')}
const conditionalCap=run("resCap('tech')");
run(`S.beastExchange.scrollUsed-=${conditionalScrolls}`);
assert.equal(run("resCap('tech')"),capAfterUpgrades);
// Advance refreshes only while any source stock remains; trades use real offers, prices, save and capacity checks.
const materials=run('CFG.beastExchange.scrollMaterials.slice()');
const offers=[];let purchases=0;
for(let refresh=1;refresh<=60&&run('S.beastExchange.scrollUsed')<initial.scrollUsed+conditionalScrolls;refresh++){
  if(run('S.beastExchange.refreshCharges')<1)tickUntil('S.beastExchange.refreshCharges>=1',1500);
  const result=run('refreshBeastExchange()');assert.equal(result?.ok,true);
  const state=run("({heartOffers:S.beastExchange.heartOffers,heartQuality:S.beastExchange.heartQuality,wildOffers:JSON.parse(JSON.stringify(S.beastExchange.wildOffers)),items:{...S.items},refreshCharges:S.beastExchange.refreshCharges})");
  const trades=[];
  for(const key of materials){
    const count=run(`beastScrollOfferCount('${key}')`),cost=run(`beastScrollTradeCost('${key}')`);
    const affordable=Math.min(count,Math.floor(run(`S.items.${key}`)/cost),initial.scrollUsed+conditionalScrolls-run('S.beastExchange.scrollUsed'));
    if(affordable>0){
      const bought=run(`exchangeWildMaterialForScrolls('${key}',${affordable})`);assert.equal(bought?.ok,true);
      const used=run(`useStorageScroll(${affordable})`);assert.equal(used?.ok,true);
      trades.push({key,count:affordable,costEach:cost});purchases+=affordable;
    }
  }
  offers.push({refresh,elapsedOnlineSec:elapsed,state,trades,scrollUsed:run('S.beastExchange.scrollUsed'),techCap:run("resCap('tech')")});
  if(materials.every(key=>run(`S.items.${key}`)<20))break;
}
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
const final=run("({tick:S.tick,army:armyCount(),pop:popCurrent(),food:S.res.food,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,steam:S.eraStorage.steamKnowledge,scrollUsed:S.beastExchange.scrollUsed,items:{...S.items},refreshClock:S.beastExchange.refreshClock,refreshCharges:S.beastExchange.refreshCharges})");
assert.equal(final.army,initial.army);assert.equal(final.pop,initial.pop);assert.equal(final.steam,16);
assert.equal(final.scrollUsed,initial.scrollUsed+purchases);assert.equal(final.techCap,reload.run("resCap('tech')"));
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const suffix=seed===13?'':`-seed${seed}`;
const saveFile=`docs/codex/reports/data/p270-nuclear-mixed${suffix}-save.json`;
const dataFile=`docs/codex/reports/data/p270-nuclear-mixed${suffix}.json`;
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P270',sourceFile,sourceSha256:sha(raw),seed,unit:'simulated online seconds and resource units',initial,scholar,upgrades,capAfterUpgrades,conditionalScrolls,conditionalCap,offers,purchases,elapsedOnlineSec:elapsed,minFood,final,saveFile,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({seed,sourceSha256:report.sourceSha256,scholar,upgrades:upgrades.map(x=>({target:x.target,cost:x.cost,waited:x.waited,cap:x.after.cap})),conditionalScrolls,conditionalCap,purchases,refreshes:offers.length,elapsedOnlineSec:elapsed,minFood,final,saveFile}));
