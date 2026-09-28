'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p265-nuclear-wyrm-twice-recovered-scroll-save.json';
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const before=run(`({tick:S.tick,tech:S.res.tech,cap:resCap('tech'),wood:S.res.wood,woodCap:resCap('wood'),stone:S.res.stone,stoneCap:resCap('stone'),food:S.res.food,foodCap:resCap('food'),army:armyCount(),pop:S.population.current,alloc:{...S.popAlloc},warehouse:bldSt('warehouse').lv,stoneStore:bldSt('stone_store').lv,library:bldSt('library').lv,institute:bldSt('institute').lv,scrollUsed:S.beastExchange.scrollUsed,steamKnowledge:S.eraStorage.steamKnowledge,electricKnowledge:S.eraStorage.electricKnowledge,crystal:S.items.godCrystal,guardian:S.items.guardianStone,warehouseCost:upCost('warehouse'),stoneStoreCost:upCost('stone_store'),libraryCost:upCost('library'),instituteCost:upCost('institute'),steamCost:eraStorageCost('steamKnowledge'),electricCost:eraStorageCost('electricKnowledge')})`);
const ceilings=run(`(()=>{const oldLibrary=bldSt('library').lv,oldInstitute=bldSt('institute').lv;S.buildings.library.lv=1000;S.buildings.institute.lv=1000;const buildings=resCap('tech');S.buildings.library.lv=oldLibrary;S.buildings.institute.lv=oldInstitute;return{buildings}})()`);
assert.equal(run("resCap('tech')"),before.cap);
const balancedRates=run(`(()=>{const old=S.popAlloc;S.popAlloc={food:250,wood:376,stone:376};const rates={food:prodRate('food')-totalUpkeep()-popCurrent()*(CFG.popFoodCost??0.1),wood:prodRate('wood'),stone:prodRate('stone')};S.popAlloc=old;return rates})()`);
const report={batch:'P268',sourceFile,sourceSha256:sha256(source),unit:'resource units and simulated online seconds',before,ceilings,balancedRates};
if(process.argv.includes('--inspect')){console.log(JSON.stringify(report));process.exit(0)}

assert.equal(run('S._fastBuild'),false);
let elapsed=0,minFood=before.food,actions=0;
const paid={wood:0,stone:0,food:0},phases={farm:0,lumber_mill:0,quarry:0,warehouse:0,stone_store:0,library:0,institute:0};
function advance(n){
  assert.ok(Number.isSafeInteger(n)&&n>=0);
  const result=run(`(()=>{let min=S.res.food;for(let i=0;i<${n};i++){tick();min=Math.min(min,S.res.food)}return{min}})()`);
  elapsed+=n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');
}
function assign(key,count){
  const result=run(`setPopAlloc('${key}',${count})`);
  assert.equal(result?.ok,true,`allocate ${key}=${count}: ${JSON.stringify(result)}`);
}
assign('stone',0);assign('food',250);assign('wood',376);assign('stone',376);
assert.equal(run('popAllocTotal()'),1002);
function nextCost(key){return run(`bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}')`)}
function waitFor(cost){
  const needed=Object.fromEntries(Object.entries(cost).filter(([key])=>key!=='time'));
  const result=run(`(()=>{const need=${JSON.stringify(needed)};let n=0,min=S.res.food;while(Object.entries(need).some(([rk,amount])=>S.res[rk]<amount)&&n<10000){tick();n++;min=Math.min(min,S.res.food)}return{n,min,ok:Object.entries(need).every(([rk,amount])=>S.res[rk]>=amount)}})()`);
  elapsed+=result.n;minFood=Math.min(minFood,result.min);
  assert.equal(result.ok,true,`wait for ${JSON.stringify(needed)}: ${JSON.stringify(result)}`);
  assert.ok(result.min>0,'food depleted while saving materials');
}
function upgrade(key,capacityCheck=true){
  const old=run(`bldSt('${key}').lv`),cost=nextCost(key);
  if(capacityCheck){
    for(const rk of ['wood','stone','food'])if(cost[rk])assert.ok(run(`resCap('${rk}')`)>=cost[rk],`${key} ${rk} single payment exceeds cap`);
  }
  waitFor(cost);
  const start=run(`buildAct('${key}')`);
  assert.equal(start?.ok,true,`${key} Lv${old}: ${JSON.stringify(start)}`);
  for(const rk of ['wood','stone','food'])paid[rk]+=cost[rk]||0;
  const timer=run(`bldSt('${key}').timerEnd`);
  advance(timer);
  assert.equal(run(`bldSt('${key}').lv`),old+1,`${key} completion`);
  assert.equal(run(`bldSt('${key}').state`),'idle');
  phases[key]++;actions++;
}
for(const key of ['farm','lumber_mill','quarry'])while(run(`bldSt('${key}').lv`)<50)upgrade(key);
assign('food',80);assign('wood',461);assign('stone',461);
assert.equal(run('popAllocTotal()'),1002);
const improvedRates=run(`({food:prodRate('food')-totalUpkeep()-popCurrent()*(CFG.popFoodCost??0.1),wood:prodRate('wood'),stone:prodRate('stone')})`);
assert.ok(improvedRates.food>0);
const maxInstituteCost=run(`(()=>{const old=bldSt('institute').lv;S.buildings.institute.lv=999;const cost=upCost('institute');S.buildings.institute.lv=old;return cost})()`);
while(run("resCap('wood')")<maxInstituteCost.wood)upgrade('warehouse',false);
while(run("resCap('stone')")<maxInstituteCost.stone)upgrade('stone_store',false);
for(const key of ['institute','library'])while(run(`bldSt('${key}').lv`)<1000)upgrade(key);
const after=run(`({tick:S.tick,tech:S.res.tech,cap:resCap('tech'),wood:S.res.wood,woodCap:resCap('wood'),stone:S.res.stone,stoneCap:resCap('stone'),food:S.res.food,army:armyCount(),pop:S.population.current,warehouse:bldSt('warehouse').lv,stoneStore:bldSt('stone_store').lv,library:bldSt('library').lv,institute:bldSt('institute').lv,scrollUsed:S.beastExchange.scrollUsed,steamKnowledge:S.eraStorage.steamKnowledge,electricKnowledge:S.eraStorage.electricKnowledge})`);
assert.equal(after.cap,ceilings.buildings);
assert.equal(after.tick,before.tick+elapsed);
assert.equal(after.army,before.army);
assert.equal(after.pop,before.pop);
assert.ok(after.cap<100000000);
assert.ok(Number.isFinite(minFood)&&minFood>0);
assert.equal(run('S.res.medal'),810836);
assert.equal(run('S.items.godCrystal'),before.crystal);
assert.equal(run('S.items.guardianStone'),before.guardian);
assert.equal(run('S.beastExchange.scrollUsed'),before.scrollUsed);
assert.equal(run("upgradeLockReason('library')"),'已达等级上限 Lv.1000');
assert.equal(run("upgradeLockReason('institute')"),'已达等级上限 Lv.1000');
assert.equal(run('JSON.stringify(S.defeated)'),JSON.stringify(JSON.parse(source).defeated));
assert.equal(run('JSON.stringify(S.sciences)'),JSON.stringify(JSON.parse(source).sciences));
assert.ok(run('Object.values(S.res).every(Number.isFinite)&&Object.values(S.res).every(n=>n>=0)'));
const conditional=run(`(()=>{
  const target=CFG.sciencesLong.sci_nuclear_age.cost;
  const oldScroll=S.beastExchange.scrollUsed,oldSteam=S.eraStorage.steamKnowledge,oldElectric=S.eraStorage.electricKnowledge;
  let scrollCount=0;
  while(resCap('tech')<target.tech&&S.beastExchange.scrollUsed<CFG.beastExchange.scrollUseLimit){S.beastExchange.scrollUsed++;scrollCount++}
  const scrollCap=resCap('tech');S.beastExchange.scrollUsed=oldScroll;
  const steamCost={tech:0,godCrystal:0};let steamCount=0;
  while(resCap('tech')<target.tech&&S.eraStorage.steamKnowledge<CFG.eraStorage.steamKnowledge.maxLevel){
    const cost=eraStorageCost('steamKnowledge');steamCost.tech+=cost.tech;steamCost.godCrystal+=cost.godCrystal||0;
    S.eraStorage.steamKnowledge++;steamCount++;
  }
  const steamCap=resCap('tech');S.eraStorage.steamKnowledge=oldSteam;
  const electricCost={tech:0,guardianStone:0};let electricCount=0;
  while(resCap('tech')<target.tech&&S.eraStorage.electricKnowledge<CFG.eraStorage.electricKnowledge.maxLevel){
    const cost=eraStorageCost('electricKnowledge');electricCost.tech+=cost.tech;electricCost.guardianStone+=cost.guardianStone||0;
    S.eraStorage.electricKnowledge++;electricCount++;
  }
  const electricCap=resCap('tech');S.eraStorage.electricKnowledge=oldElectric;
  return{target,scrolls:{additional:scrollCount,cap:scrollCap,materialAtBasePrice:scrollCount*CFG.beastExchange.heartPerScroll},steam:{additional:steamCount,cap:steamCap,cost:steamCost},electric:{additional:electricCount,cap:electricCap,cost:electricCost}};
})()`);
assert.equal(run("resCap('tech')"),after.cap);
assert.equal(run('save().ok'),true);
const save=e.store.get('rts_save');
const reload=environment({rts_save:save});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),after.cap);
assert.equal(reload.run('armyCount()'),after.army);
assert.equal(reload.run('S.res.medal'),810836);
assert.equal(sha256(fs.readFileSync(path.join(root,sourceFile),'utf8')),report.sourceSha256);
report.paidRoute={elapsedOnlineSec:elapsed,minFood,actions,phases,paid,improvedRates,maxInstituteCost,after,conditional,saveFile:'docs/codex/reports/data/p268-nuclear-capacity-buildings-save.json',saveSha256:sha256(save)};
fs.writeFileSync(path.join(root,report.paidRoute.saveFile),save,'utf8');
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p268-nuclear-capacity-buildings.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify(report));
