'use strict';
// From the paid capacity save, produce 100m knowledge, research nuclear, and train the first star soldier.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p270-nuclear-scroll-exchange-tiger-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,army:armyCount(),pop:popCurrent(),food:S.res.food,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,scrollUsed:S.beastExchange.scrollUsed,starScience:scienceUnlocked('sci_nuclear_age'),starPool:S.pool.star_trooper||0})");
assert.equal(initial.army,516);assert.equal(initial.pop,1002);assert.ok(initial.techCap>=100000000);assert.equal(initial.starScience,false);
let elapsed=0,minFood=initial.food,phase=null;
const phases={tech:0,stone:0,coal:0,iron:0,copper:0,steel:0,training:0};
function assign(resource){
  const jobs=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(jobs))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',80)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',922)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stopExpression='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stopExpression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression}),stopped:!!(${stopExpression})}})()`);
  elapsed+=result.n;minFood=Math.min(minFood,result.min);if(phase)phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,target){
  if(run(`S.res.${resource}`)>=target)return;
  assert.ok(target<=run(`resCap('${resource}')`));
  assign(resource);
  assert.equal(advanceUntil(`S.res.${resource}>=${target}`,10000).done,true,`${resource} fill timed out`);
}
function fillProcessed(resource,target){
  if(run(`S.res.${resource}`)>=target)return;
  assert.ok(target<=run(`resCap('${resource}')`));
  let cycles=0;
  while(run(`S.res.${resource}`)<target&&cycles++<100){
    if(run('S.res.stone')<100000)fillBasic('stone',Math.min(1200000,run("resCap('stone')")));
    if(run('S.res.coal')<100000)fillBasic('coal',Math.min(450000,run("resCap('coal')")));
    if(resource==='steel'&&run('S.res.iron')<100000)fillProcessed('iron',Math.min(1000000,run("resCap('iron')")));
    const before=run(`S.res.${resource}`);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    const result=advanceUntil(`S.res.${resource}>=${target}`,5000,stop);
    assert.ok(run(`S.res.${resource}`)>before,`${resource} stalled`);
    if(result.done)break;
  }
  assert.ok(run(`S.res.${resource}`)>=target,`${resource} fill exhausted`);
}
const scienceCost=run('activeSciences().sci_nuclear_age.cost');
assert.equal(scienceCost.tech,100000000);assert.equal(scienceCost.medal,800000);
assign('tech');
const knowledgeWait=advanceUntil('S.res.tech>=100000000',10000);
assert.equal(knowledgeWait.done,true);
const preResearch=run("({tick:S.tick,tech:S.res.tech,medal:S.res.medal,cap:resCap('tech')})");
assert.ok(preResearch.tech>=scienceCost.tech&&preResearch.medal>=scienceCost.medal);
const researched=run("researchScience('sci_nuclear_age')");
assert.equal(researched?.ok,true);
const postResearch=run("({tick:S.tick,tech:S.res.tech,medal:S.res.medal,starScience:scienceUnlocked('sci_nuclear_age'),starCap:unitCap('star_trooper')})");
assert.equal(preResearch.tech-postResearch.tech,scienceCost.tech);
assert.equal(preResearch.medal-postResearch.medal,scienceCost.medal);
assert.equal(postResearch.starScience,true);assert.ok(postResearch.starCap>=1);
const secondResearch=run("researchScience('sci_nuclear_age')");
assert.ok(secondResearch?.repeat||secondResearch?.ok===false);
assert.equal(run('S.res.tech'),postResearch.tech);assert.equal(run('S.res.medal'),postResearch.medal);
const unitCost=run('CFG.units.star_trooper.cost');
for(const resource of ['steel','iron','copper'])fillProcessed(resource,unitCost[resource]);
const preTrain=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,pool:S.pool.star_trooper||0})");
assign('stone');phase='training';
run("globalThis.__paid={};globalThis.__basePayTrainingCost=payTrainingCost;payTrainingCost=(cost,n)=>{for(const [rk,amount] of Object.entries(cost))__paid[rk]=(__paid[rk]||0)+amount*n;return __basePayTrainingCost(cost,n)}");
const queued=run("train('star_trooper',1)");assert.equal(queued?.ok,true);assert.equal(queued.qty,1);
assert.equal(advanceUntil('(S.pool.star_trooper||0)>=1',1000).done,true);
run('payTrainingCost=__basePayTrainingCost');
const postTrain=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,pool:S.pool.star_trooper||0,paid:{...__paid}})");
for(const [rk,amount] of Object.entries(unitCost)){
  assert.equal(postTrain.paid[rk],amount);
  assert.equal(preTrain[rk]-postTrain[rk],amount);
}
assert.equal(postTrain.pool,preTrain.pool+1);
assert.equal(run('armyCount()'),initial.army+1);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
const final=run("({tick:S.tick,army:armyCount(),pop:popCurrent(),food:S.res.food,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,scrollUsed:S.beastExchange.scrollUsed,starScience:scienceUnlocked('sci_nuclear_age'),starPool:S.pool.star_trooper||0})");
assert.equal(final.starScience,true);assert.equal(final.starPool,1);assert.equal(final.techCap,preResearch.cap);
assert.equal(reload.run("scienceUnlocked('sci_nuclear_age')"),true);assert.equal(reload.run('S.pool.star_trooper'),1);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const saveFile='docs/codex/reports/data/p270-nuclear-research-paid-save.json';
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P270',sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds and resource units',initial,scienceCost,knowledgeWait,preResearch,researched,postResearch,secondResearch,unitCost,preTrain,queued,postTrain,elapsedOnlineSec:elapsed,phases,minFood,final,saveFile,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p270-nuclear-research-paid.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({initial,knowledgeWait,preResearch,postResearch,secondResearch,unitCost,preTrain,postTrain,elapsedOnlineSec:elapsed,phases,minFood,final,saveFile}));
