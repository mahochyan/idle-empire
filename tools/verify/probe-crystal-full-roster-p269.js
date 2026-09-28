'use strict';
// Pay for the unused existing army cap, then fight and replenish until defeat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p268-nuclear-capacity-buildings-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const requestedSeed=process.argv.find(arg=>arg.startsWith('--seed='));
const seed=requestedSeed?Number(requestedSeed.slice('--seed='.length)):13;
assert.ok(Number.isSafeInteger(seed)&&seed>=1&&seed<=16);
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const originalFormation=JSON.parse(JSON.stringify(run('S.formation')));
const targetFormation=JSON.parse(JSON.stringify(originalFormation));
for(const type of ['electro_trooper','alloy_special','armored_trooper','gold_cavalry']){
  const row=run(`CFG.units.${type}.row`),cap=run(`unitCap('${type}')`),regimentMax=run('regMax()');
  let owned=0;
  for(const line of ['front','mid','back'])for(const unit of targetFormation[line])if(unit.type===type)owned+=unit.count;
  let left=cap-owned;
  for(const unit of targetFormation[row])if(unit.type===type&&left>0){
    const add=Math.min(left,regimentMax-unit.count);unit.count+=add;left-=add;
  }
  if(left>0)assert.equal(targetFormation[row].length,run(`rowSlots('${row}')`));
}
for(const row of ['front','mid','back'])originalFormation[row]=targetFormation[row];
const targetArmy=Object.values(targetFormation).flat().reduce((n,unit)=>n+unit.count,0);
assert.equal(targetArmy,516);
const targetCounts={};
for(const row of ['front','mid','back'])for(const unit of originalFormation[row])targetCounts[unit.type]=(targetCounts[unit.type]||0)+unit.count;
const source=run("({tick:S.tick,army:armyCount(),crystal:S.items.godCrystal,alert:S.killValues.godRevival,food:S.res.food,techCap:resCap('tech'),medal:S.res.medal})");
assert.equal(source.army,437);assert.equal(source.alert,4000);
let elapsed=0,minFood=source.food,activePhase=null;
const phases={wood:0,stone:0,food:0,coal:0,copper:0,iron:0,silver:0,gold:0,steel:0,training:0};
function assign(resource){
  const jobs=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(jobs))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',80)")?.ok,true);
  if(resource!=='food')assert.equal(run(`setPopAlloc('${resource}',922)`)?.ok,true);
  else assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*(CFG.popFoodCost??0.1)")>0);
}
function advanceUntil(expression,max=10000,stopExpression='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stopExpression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression}),stopped:!!(${stopExpression})}})()`);
  elapsed+=result.n;minFood=Math.min(minFood,result.min);
  if(activePhase)phases[activePhase]+=result.n;
  assert.ok(result.min>0,'food depleted');
  return result;
}
function fillBasic(resource,target){
  if(!(target>run(`S.res.${resource}`)))return;
  assert.ok(target<=run(`resCap('${resource}')`),`${resource} payment exceeds current cap`);
  assign(resource);activePhase=resource;
  const result=advanceUntil(`S.res.${resource}>=${target}`,10000);
  assert.equal(result.done,true,`${resource} fill timed out`);
}
function fillProcessed(resource,target){
  if(!(target>run(`S.res.${resource}`)))return;
  assert.ok(target<=run(`resCap('${resource}')`),`${resource} payment exceeds current cap`);
  let cycles=0;
  while(run(`S.res.${resource}`)<target&&cycles++<100){
    if(run('S.res.stone')<100000)fillBasic('stone',Math.min(1200000,run("resCap('stone')")));
    if(run('S.res.coal')<100000)fillBasic('coal',Math.min(450000,run("resCap('coal')")));
    if(resource==='steel'&&run('S.res.iron')<100000)fillProcessed('iron',Math.min(1000000,run("resCap('iron')")));
    const before=run(`S.res.${resource}`);
    assign(resource);activePhase=resource;
    const result=advanceUntil(`S.res.${resource}>=${target}`,5000,'S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':''));
    assert.ok(run(`S.res.${resource}`)>before,`${resource} production stalled`);
    if(result.done)break;
  }
  assert.ok(run(`S.res.${resource}`)>=target,`${resource} production exhausted`);
}
function missingAndCost(){
  const owned={};
  const formation=run('S.formation'),pool=run('S.pool');
  for(const row of ['front','mid','back'])for(const unit of formation[row])owned[unit.type]=(owned[unit.type]||0)+unit.count;
  for(const [type,count] of Object.entries(pool))owned[type]=(owned[type]||0)+count;
  const missing={},cost={};
  for(const [type,count] of Object.entries(targetCounts))if(count>(owned[type]||0))missing[type]=count-(owned[type]||0);
  for(const [type,count] of Object.entries(missing))for(const [rk,amount] of Object.entries(run(`CFG.units.${type}.cost`)))cost[rk]=(cost[rk]||0)+count*amount;
  return{missing,cost};
}
function recover(missing,cost){
  const start=elapsed,phaseStart={...phases};
  for(const [rk,amount] of Object.entries(cost))assert.ok(amount<=run(`resCap('${rk}')`),`${rk} whole recovery cost exceeds cap`);
  for(const resource of ['silver','gold','steel','iron','copper'])if(cost[resource])fillProcessed(resource,cost[resource]);
  for(const resource of ['wood','stone','coal'])if(cost[resource])fillBasic(resource,cost[resource]);
  if(cost.food&&run('S.res.food')<cost.food)fillBasic('food',cost.food);
  for(const [rk,amount] of Object.entries(cost))assert.ok(run(`S.res.${rk}`)>=amount,`${rk} not stocked`);
  assign('stone');activePhase='training';
  run(`globalThis.__trainingPaid={};globalThis.__basePayTrainingCost=payTrainingCost;
    payTrainingCost=(cost,n)=>{for(const [rk,amount] of Object.entries(cost))__trainingPaid[rk]=(__trainingPaid[rk]||0)+amount*n;return __basePayTrainingCost(cost,n)}`);
  for(const [type,count] of Object.entries(missing)){
    const result=run(`train('${type}',${count})`);
    assert.equal(result?.ok,true,`${type}: ${JSON.stringify(result)}`);
    assert.equal(result.qty,count);
  }
  for(const [type,count] of Object.entries(missing))assert.equal(advanceUntil(`(S.pool.${type}||0)>=${count}`,1000).done,true,`${type} queue timed out`);
  for(const [rk,amount] of Object.entries(cost))assert.equal(run(`__trainingPaid.${rk}`),amount,`${rk} training payment`);
  run('payTrainingCost=__basePayTrainingCost');
  run("clrForm('expedition')");
  for(const row of ['front','mid','back'])originalFormation[row].forEach((unit,slot)=>{
    assert.ok(run(`poolAvail('${unit.type}')`)>=unit.count);
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit.type}';S._formModalQty=${unit.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),unit.count);
  });
  assert.equal(run('armyCount()'),targetArmy);
  assert.equal(run('save().ok'),true);
  const rawSave=e.store.get('rts_save');
  const reload=environment({rts_save:rawSave});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('armyCount()'),targetArmy);
  const seconds=elapsed-start,stepPhases=Object.fromEntries(Object.keys(phases).map(key=>[key,phases[key]-phaseStart[key]]));
  return{seconds,phases:stepPhases,saveSha256:sha(rawSave)};
}
const initialMissing=missingAndCost();
assert.equal(Object.values(initialMissing.missing).reduce((n,x)=>n+x,0),79);
const initialTraining=recover(initialMissing.missing,initialMissing.cost);
const rows=[];
let lastRecoveredSave=e.store.get('rts_save');
for(let fight=1;fight<=12;fight++){
  const before=run("({tick:S.tick,army:armyCount(),crystal:S.items.godCrystal,alert:S.killValues.godRevival,medal:S.res.medal})");
  assert.equal(before.army,targetArmy);
  run("openMaterialDomain('godCrystal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const after=run("({tick:S.tick,army:armyCount(),crystal:S.items.godCrystal,alert:S.killValues.godRevival,medal:S.res.medal,round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})");
  const win=run("document.getElementById('battle-result').className")==='win';
  assert.equal(after.tick,before.tick);
  assert.equal(after.alert,before.alert+(win?100:0));
  const entry={fight,before,after,win,loss:before.army-after.army,drop:after.crystal-before.crystal,callbacks};
  if(win){
    assert.ok(entry.drop>0);
    const {missing,cost}=missingAndCost();
    assert.equal(Object.values(missing).reduce((n,x)=>n+x,0),entry.loss);
    entry.missing=missing;entry.cost=cost;
    entry.recovery=recover(missing,cost);
    lastRecoveredSave=e.store.get('rts_save');
  }
  rows.push(entry);
  if(!win)break;
}
const final=run("({tick:S.tick,army:armyCount(),crystal:S.items.godCrystal,alert:S.killValues.godRevival,medal:S.res.medal,techCap:resCap('tech'),scrollUsed:S.beastExchange.scrollUsed})");
assert.ok(minFood>0);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const suffix=seed===13?'':`-seed${seed}`;
const saveFile=`docs/codex/reports/data/p269-crystal-full-roster-last-recovered${suffix}-save.json`;
fs.writeFileSync(path.join(root,saveFile),lastRecoveredSave,'utf8');
const report={batch:'P269',sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds, resource units, soldiers and alert points',seed,
  source,targetArmy,initialMissing,initialTraining,elapsedOnlineSec:elapsed,minFood,rows,final,lastRecovered:{saveFile,sha256:sha(lastRecoveredSave)}};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/p269-crystal-full-roster-continuous${suffix}.json`),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({source,targetArmy,initialMissing,initialTraining,elapsedOnlineSec:elapsed,minFood,rows:rows.map(row=>({fight:row.fight,alert:row.before.alert,win:row.win,loss:row.loss,drop:row.drop,recoverySec:row.recovery?.seconds})),final,lastRecovered:report.lastRecovered}));
