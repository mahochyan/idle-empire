'use strict';
// P265: continue the exact P264 second-win save; pay for all casualties and one real scroll.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p264-nuclear-wyrm-second-save.json';
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__tradeSeed=9;Math.random=()=>{let x=__tradeSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__tradeSeed=x>>>0;return __tradeSeed/4294967296}`);
const original=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p262-nuclear-pop1002-paid-save.json'),'utf8'));
const target=original.formation;
const targetCounts={};
for(const row of ['front','mid','back'])for(const u of target[row])targetCounts[u.type]=(targetCounts[u.type]||0)+u.count;
const before=run("({tick:S.tick,army:armyCount(),res:{...S.res},items:{...S.items},cap:resCap('tech'),used:S.beastExchange.scrollUsed,wild:S.killValues.wildWyrm})");
assert.equal(before.army,363);
assert.equal(before.wild,3020);
assert.equal(before.items.wyrmSinew,122);
const owned={};
const formation=run('S.formation'),pool=run('S.pool');
for(const row of ['front','mid','back'])for(const u of formation[row])owned[u.type]=(owned[u.type]||0)+u.count;
for(const [key,count] of Object.entries(pool))owned[key]=(owned[key]||0)+count;
const missing={};
for(const [key,count] of Object.entries(targetCounts))if(count>(owned[key]||0))missing[key]=count-(owned[key]||0);
assert.equal(Object.values(missing).reduce((a,b)=>a+b,0),74);
const cost={};
for(const [key,count] of Object.entries(missing))for(const [rk,amount] of Object.entries(run(`CFG.units.${key}.cost`)))cost[rk]=(cost[rk]||0)+count*amount;
if(process.argv.includes('--inspect')){console.log(JSON.stringify({before,missing,cost,coalTarget:Math.ceil(Math.max(before.res.coal,(cost.steel||0)*0.65+10000))}));process.exit(0)}
assert.ok(before.res.food>=cost.food);
assert.ok(before.res.iron>=cost.iron);
let elapsed=0,minFood=before.res.food;
const phases={copper:0,coal:0,stone:0,steel:0,training:0};
function assign(key){
  for(const [rk,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',159)")?.ok,true);
  assert.equal(run(`setPopAlloc('${key}',843)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function waitFor(expression,phase,max=5000){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,ok:!!(${expression}),min}})()`);
  assert.equal(result.ok,true,`${phase} timed out`);
  elapsed+=result.n;phases[phase]+=result.n;minFood=Math.min(minFood,result.min);
}
const coalTarget=250000,stoneTarget=500000;
function makeProcessed(key,target){
  let cycles=0;
  while(run(`S.res.${key}`)<target&&cycles++<30){
    if(run('S.res.stone')<stoneTarget){assign('stone');waitFor(`S.res.stone>=${stoneTarget}`,'stone')}
    if(run('S.res.coal')<coalTarget){assign('coal');waitFor(`S.res.coal>=${coalTarget}`,'coal')}
    const start=run(`S.res.${key}`);
    assign(key);
    const chunk=run(`(()=>{let n=0,min=S.res.food;while(S.res.${key}<${target}&&S.res.stone>20000&&S.res.coal>20000&&n<1500){tick();n++;min=Math.min(min,S.res.food)}return{n,min}})()`);
    assert.ok(run(`S.res.${key}`)>start,`${key} did not advance`);
    elapsed+=chunk.n;phases[key]+=chunk.n;minFood=Math.min(minFood,chunk.min);
  }
  assert.ok(run(`S.res.${key}`)>=target,`${key} cycles exhausted`);
}
makeProcessed('copper',cost.copper||0);
makeProcessed('steel',cost.steel||0);
const atTraining=run('({...S.res})');
assign('stone');
run(`globalThis.__trainingPaid={};globalThis.__originalPayTrainingCost=payTrainingCost;
  payTrainingCost=(cost,n)=>{for(const [key,value] of Object.entries(cost))__trainingPaid[key]=(__trainingPaid[key]||0)+value*n;return __originalPayTrainingCost(cost,n)}`);
for(const [key,count] of Object.entries(missing)){
  const result=run(`train('${key}',${count})`);
  assert.equal(result?.ok,true,`${key}: ${JSON.stringify(result)}`);
  assert.equal(result.qty,count);
}
for(const [key,count] of Object.entries(missing))waitFor(`(S.pool.${key}||0)>=${count}`,'training',300);
for(const [key,value] of Object.entries(cost))assert.equal(run(`__trainingPaid.${key}`),value,`paid ${key}`);
for(const rk of ['copper','iron','steel'])assert.ok(Math.abs(atTraining[rk]-run(`S.res.${rk}`)-(cost[rk]||0))<1e-5,`paid ${rk}`);
assert.equal(run('armyCount()'),437);
run("clrForm('expedition')");
for(const row of ['front','mid','back'])target[row].forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
});
assert.equal(run('armyCount()'),437);
assert.equal(run('save().ok'),true);
const recovered=e.store.get('rts_save');
const recoveredFile='docs/codex/reports/data/p265-nuclear-wyrm-twice-recovered-save.json';
const recoveredReload=environment({rts_save:recovered});
assert.equal(recoveredReload.run('loadSaveAndApply().status'),'ok');
assert.equal(recoveredReload.run('armyCount()'),437);
fs.writeFileSync(path.join(root,recoveredFile),recovered,'utf8');
let refreshes=0,tradeWait=0;
while(run("beastScrollOfferCount('bullHorn')")<1&&refreshes<120){
  if(run('S.beastExchange.refreshCharges')<1){
    const waited=run('(()=>{let n=0;while(S.beastExchange.refreshCharges<1&&n<CFG.beastExchange.refreshSeconds){tick();n++}return n})()');
    assert.ok(run('S.beastExchange.refreshCharges')>=1);
    tradeWait+=waited;
  }
  assert.equal(run('refreshBeastExchange()')?.ok,true);
  refreshes++;
}
const beforeTrade=run("({tick:S.tick,cap:resCap('tech'),scroll:S.items.storageScroll,used:S.beastExchange.scrollUsed,bull:S.items.bullHorn,sinew:S.items.wyrmSinew,bullOffer:beastScrollOfferCount('bullHorn'),bullCost:beastScrollTradeCost('bullHorn'),sinewOffer:beastScrollOfferCount('wyrmSinew'),sinewCost:beastScrollTradeCost('wyrmSinew')})");
assert.ok(beforeTrade.bullOffer>=1);
assert.ok(beforeTrade.bull>=beforeTrade.bullCost);
const purchase=run("exchangeWildMaterialForScrolls('bullHorn',1)");
assert.equal(purchase?.ok,true);
assert.equal(purchase.cost,beforeTrade.bullCost);
assert.equal(run('useStorageScroll(1)')?.ok,true);
const afterTrade=run("({tick:S.tick,cap:resCap('tech'),scroll:S.items.storageScroll,used:S.beastExchange.scrollUsed,bull:S.items.bullHorn,sinew:S.items.wyrmSinew,army:armyCount(),wild:S.killValues.wildWyrm})");
assert.equal(afterTrade.bull,beforeTrade.bull-beforeTrade.bullCost);
assert.equal(afterTrade.used,beforeTrade.used+1);
assert.ok(afterTrade.cap>beforeTrade.cap);
assert.equal(afterTrade.army,437);
const final=e.store.get('rts_save');
const finalFile='docs/codex/reports/data/p265-nuclear-wyrm-twice-recovered-scroll-save.json';
const finalReload=environment({rts_save:final});
assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('armyCount()'),437);
assert.equal(finalReload.run("resCap('tech')"),afterTrade.cap);
fs.writeFileSync(path.join(root,finalFile),final,'utf8');
const report={batch:'P265',sourceFile,sourceSha256:sha(source),unit:'simulated online seconds, resource units and soldiers',before,missing,cost,
  recovery:{elapsedOnlineSeconds:elapsed,phases,minFood,coalTarget,atTraining,saveFile:recoveredFile,saveSha256:sha(recovered)},
  trade:{seed:9,refreshes,onlineWaitSeconds:tradeWait,before:beforeTrade,after:afterTrade,material:'bullHorn',paid:purchase.cost,saveFile:finalFile,saveSha256:sha(final)}};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p265-nuclear-wyrm-second-recovery.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({missing,cost,recovery:report.recovery,trade:report.trade}));
process.exit(0);
