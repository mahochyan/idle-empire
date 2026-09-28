'use strict';
// Replenish the paid level-5 victory through real production, training and formation actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p277-awakening-energy3-opt-single-seed10-0312-2130-level5-win-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),pop:popCurrent(),food:S.res.food,starPool:S.pool.star_trooper||0,starCap:unitCap('star_trooper'),res:{...S.res},formation:JSON.parse(JSON.stringify(S.formation))})");
assert.equal(initial.army,459);assert.equal(initial.deployed,429);assert.equal(initial.starPool,0);assert.equal(initial.starCap,101);
assert.equal(run('S.awakening.star_trooper.level'),5);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
run("globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}");
const targets={electro_trooper:48,alloy_special:55,armored_trooper:55};
const totalCost={};
for(const [unit,count] of Object.entries(targets))
  for(const [k,v] of Object.entries(run(`CFG.units.${unit}.cost`)))totalCost[k]=(totalCost[k]||0)+v*count;
assert.deepEqual(totalCost,{copper:494000,iron:494000,steel:499500,food:82500});
let elapsed=0,minFood=initial.food,phase=null;
const phases={stone:0,coal:0,iron:0,copper:0,steel:0,training:0};
function assign(resource){
  for(const [rk,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  elapsed+=result.n;minFood=Math.min(minFood,result.min);if(phase)phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetStock){
  if(run(`S.res.${resource}`)>=targetStock)return;
  assert.ok(targetStock<=run(`resCap('${resource}')`));
  assign(resource);assert.equal(advanceUntil(`S.res.${resource}>=${targetStock}`,10000).done,true,`${resource} fill timed out`);
}
function fillProcessed(resource,targetStock){
  if(run(`S.res.${resource}`)>=targetStock)return;
  assert.ok(targetStock<=run(`resCap('${resource}')`));
  let cycles=0;
  while(run(`S.res.${resource}`)<targetStock&&cycles++<100){
    if(run('S.res.stone')<100000)fillBasic('stone',Math.min(1200000,run("resCap('stone')")));
    if(run('S.res.coal')<100000)fillBasic('coal',Math.min(450000,run("resCap('coal')")));
    if(resource==='steel'&&run('S.res.iron')<100000)fillProcessed('iron',Math.min(1000000,run("resCap('iron')")));
    const before=run(`S.res.${resource}`);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    const result=advanceUntil(`S.res.${resource}>=${targetStock}`,5000,stop);
    assert.ok(run(`S.res.${resource}`)>before,`${resource} stalled`);
    if(result.done)break;
  }
  assert.ok(run(`S.res.${resource}`)>=targetStock,`${resource} fill exhausted`);
}
for(const resource of ['steel','iron','copper'])fillProcessed(resource,totalCost[resource]);
const beforeTraining=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food})");
assign('stone');phase='training';
run("globalThis.__paid={};globalThis.__basePayTrainingCost=payTrainingCost;payTrainingCost=(cost,n)=>{for(const [rk,amount] of Object.entries(cost))__paid[rk]=(__paid[rk]||0)+amount*n;return __basePayTrainingCost(cost,n)}");
const queued={};
for(const [unit,count] of Object.entries(targets)){
  queued[unit]=run(`train('${unit}',${count})`);
  assert.equal(queued[unit]?.ok,true,unit+' queue');assert.equal(queued[unit].qty,count);
}
assert.equal(advanceUntil('(S.pool.electro_trooper||0)>=48&&(S.pool.alloy_special||0)>=55&&(S.pool.armored_trooper||0)>=55',1000).done,true);
run('payTrainingCost=__basePayTrainingCost');
const afterTraining=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food,paid:{...__paid},pool:{...S.pool}})");
for(const [rk,cost] of Object.entries(totalCost)){
  assert.equal(afterTraining.paid[rk],cost);
  if(rk!=='food')assert.equal(beforeTraining[rk]-afterTraining[rk],cost);
}
const targetFormation=JSON.parse(JSON.stringify(initial.formation));
targetFormation.front=[{type:'electro_trooper',count:55},{type:'armored_trooper',count:55},
  {type:'electro_trooper',count:46},{type:'alloy_special',count:55}];
run("clrForm('expedition')");
for(const row of ['front','mid','back'])targetFormation[row].forEach((unit,slot)=>{
  assert.ok(run(`poolAvail('${unit.type}')`)>=unit.count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit.type}';S._formModalQty=${unit.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),unit.count);
});
assert.deepEqual(Array.from(run('S.formation.front.map(u=>u.count)')),[55,55,46,55]);
assert.equal(run('Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0)'),587);
assert.equal(run('armyCount()'),617);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),617);
assert.equal(reload.run("expeditionCount('star_trooper')"),101);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const final=run("({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),starDeployed:expeditionCount('star_trooper'),starPool:S.pool.star_trooper||0,food:S.res.food,resource:{copper:S.res.copper,iron:S.res.iron,steel:S.res.steel},sciences:S.sciences.length,defeated:S.defeated.length})");
const saveFile='docs/codex/reports/data/p277-awakening-level5-replenished-save.json';
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P277',sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds, resource units and soldiers',initial,targets,totalCost,beforeTraining,queued,afterTraining,elapsedOnlineSec:elapsed,phases,minFood,final,saveFile,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p277-awakening-level5-replenish.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,totalCost,elapsedOnlineSec:elapsed,phases,minFood,final,saveFile,saveSha256:report.saveSha256}));
