'use strict';
// P354: branch only worker allocation from the same paid P352 second logout.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data='docs/codex/reports/data/';
const fixtureFile=data+'p352-birth-deed-five-policy-optimal-base-workers-two-window-second-logout-save.json';
const p352File=data+'p352-birth-deed-five-policy-optimal-base-workers-two-window.json';
const p352AllFile=data+'p352-birth-deed-five-policy-optimal-two-window.json';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const codeHashes={config:sha(fs.readFileSync(path.join(root,'config.js'))),math:sha(fs.readFileSync(path.join(root,'math.js')))};
assert.equal(codeHashes.config,'8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675');
assert.equal(codeHashes.math,'dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95');
const fixtureText=fs.readFileSync(path.join(root,fixtureFile),'utf8');
const fixtureSha256=sha(fixtureText);
assert.equal(fixtureSha256,'61c40aa04c38fa91fe19a297570dc348a8ebdf6033b4e55ea1c0dad3747d5154');
const fixture=JSON.parse(fixtureText);
const p352=JSON.parse(fs.readFileSync(path.join(root,p352File),'utf8'));
const p352All=JSON.parse(fs.readFileSync(path.join(root,p352AllFile),'utf8'));
assert.equal(p352.secondLogoutSaveSha256,fixtureSha256);
assert.equal(p352.secondWindow.before.queueCount,626);
assert.equal(p352.secondWindow.produced,345);
assert.equal(p352All.secondWindow.produced,382);
assert.equal(p352.policySlots,5);
assert.equal(p352.workerMode,'base');
assert.equal(p352All.policySlots,5);
assert.equal(p352All.workerMode,'all');
assert.equal(fixture.population.current,1122);
assert.equal(fixture.res.deed,46);
assert.equal(Object.values(fixture.queue).reduce((n,q)=>n+(q?.count||0),0),626);

const plans=[
  {name:'p352-base-1002',workers:{food:100,copper:300,iron:300,steel:302}},
  {name:'p352-all-no-coal',workers:{food:100,copper:330,iron:330,steel:302,gold:60}},
  {name:'coal-5-gold-60',workers:{food:100,copper:327,iron:328,steel:302,coal:5,gold:60}},
  {name:'coal-10-gold-60',workers:{food:100,copper:325,iron:325,steel:302,coal:10,gold:60}},
  {name:'coal-20-gold-60',workers:{food:100,copper:320,iron:320,steel:302,coal:20,gold:60}},
  {name:'coal-30-gold-60',workers:{food:100,copper:315,iron:315,steel:302,coal:30,gold:60}},
  {name:'coal-40-gold-60',workers:{food:100,copper:310,iron:310,steel:302,coal:40,gold:60}},
  {name:'coal-120-no-gold',workers:{food:100,copper:300,iron:300,steel:302,coal:120}},
  {name:'coal-60-gold-60',workers:{food:100,copper:300,iron:300,steel:302,coal:60,gold:60}},
  {name:'coal-80-gold-40',workers:{food:100,copper:300,iron:300,steel:302,coal:80,gold:40}},
  {name:'coal-100-gold-40',workers:{food:100,copper:290,iron:290,steel:302,coal:100,gold:40}},
  {name:'coal-120-gold-60',workers:{food:100,copper:280,iron:280,steel:282,coal:120,gold:60}},
  {name:'coal-180-no-gold',workers:{food:100,copper:280,iron:280,steel:282,coal:180}},
  {name:'stone-100-coal-20-gold-60',workers:{food:100,stone:100,coal:20,copper:280,iron:280,steel:282,gold:60}},
  {name:'stone-120-coal-20-gold-40',workers:{food:100,stone:120,coal:20,copper:280,iron:280,steel:282,gold:40}},
  {name:'stone-160-coal-20-gold-40',workers:{food:100,stone:160,coal:20,copper:260,iron:260,steel:282,gold:40}},
  {name:'stone-200-coal-20-gold-40',workers:{food:100,stone:200,coal:20,copper:250,iron:250,steel:262,gold:40}},
  {name:'stone-120-coal-10-gold-40',workers:{food:100,stone:120,coal:10,copper:285,iron:285,steel:282,gold:40}},
  {name:'stone-200-coal-10-gold-40',workers:{food:100,stone:200,coal:10,copper:260,iron:260,steel:252,gold:40}},
  {name:'stone-180-coal-30-gold-40',workers:{food:100,stone:180,coal:30,copper:260,iron:260,steel:252,gold:40}},
  {name:'stone-250-coal-10-gold-40',workers:{food:100,stone:250,coal:10,copper:240,iron:240,steel:242,gold:40}},
  {name:'stone-80-coal-80-copper-330',workers:{food:100,stone:80,coal:80,copper:330,iron:250,steel:242,gold:40}},
  {name:'stone-80-coal-120-copper-310',workers:{food:100,stone:80,coal:120,copper:310,iron:240,steel:232,gold:40}},
  {name:'stone-100-coal-100-copper-320',workers:{food:100,stone:100,coal:100,copper:320,iron:230,steel:232,gold:40}},
  {name:'stone-80-coal-160-copper-300',workers:{food:100,stone:80,coal:160,copper:300,iron:220,steel:222,gold:40}},
  {name:'stone-120-coal-120-copper-320',workers:{food:100,stone:120,coal:120,copper:320,iron:220,steel:202,gold:40}},
  {name:'stone-100-coal-80-copper-350-gold-10',workers:{food:100,stone:100,coal:80,copper:350,iron:240,steel:242,gold:10}},
  {name:'stone-100-coal-120-copper-342-gold-10',workers:{food:100,stone:100,coal:120,copper:342,iron:230,steel:220,gold:10}},
  {name:'stone-100-coal-140-copper-322-gold-10',workers:{food:100,stone:100,coal:140,copper:322,iron:230,steel:220,gold:10}},
  {name:'stone-120-coal-120-copper-322-gold-10',workers:{food:100,stone:120,coal:120,copper:322,iron:230,steel:220,gold:10}},
  {name:'stone-80-coal-140-copper-342-gold-10',workers:{food:100,stone:80,coal:140,copper:342,iron:230,steel:220,gold:10}},
  {name:'stone-80-coal-180-copper-330-gold-10',workers:{food:100,stone:80,coal:180,copper:330,iron:200,steel:222,gold:10}},
  {name:'stone-80-coal-200-copper-310-gold-10',workers:{food:100,stone:80,coal:200,copper:310,iron:200,steel:222,gold:10}},
  {name:'stone-80-coal-220-copper-290-gold-10',workers:{food:100,stone:80,coal:220,copper:290,iron:200,steel:222,gold:10}},
  {name:'stone-100-coal-180-copper-310-gold-10',workers:{food:100,stone:100,coal:180,copper:310,iron:200,steel:222,gold:10}},
  {name:'stone-60-coal-180-copper-350-gold-10',workers:{food:100,stone:60,coal:180,copper:350,iron:200,steel:222,gold:10}},
  {name:'stone-80-coal-240-copper-280-gold-10',workers:{food:100,stone:80,coal:240,copper:280,iron:190,steel:222,gold:10}},
  {name:'wood-5-stone-80-coal-235',workers:{food:100,wood:5,stone:80,coal:235,copper:280,iron:190,steel:222,gold:10}},
  {name:'wood-10-stone-80-coal-230',workers:{food:100,wood:10,stone:80,coal:230,copper:280,iron:190,steel:222,gold:10}},
  {name:'wood-20-stone-80-coal-220',workers:{food:100,wood:20,stone:80,coal:220,copper:280,iron:190,steel:222,gold:10}},
  {name:'wood-40-stone-80-coal-200',workers:{food:100,wood:40,stone:80,coal:200,copper:280,iron:190,steel:222,gold:10}},
];
const legalKeys=new Set(['food','wood','stone','coal','copper','iron','steel','gold']);
const settledSaves=new Map();
for(const plan of plans){
  assert.ok(Object.keys(plan.workers).every(k=>legalKeys.has(k)));
  const count=Object.values(plan.workers).reduce((n,v)=>n+v,0);
  assert.ok(count<=1122&&count>=1002,plan.name+' legal population');
  assert.ok(Object.values(plan.workers).every(v=>Number.isSafeInteger(v)&&v>=0));
}

function probe(plan){
  const env=environment({rts_save:fixtureText}),run=env.run;
  run(`globalThis.__clockMs=${fixture.ts};globalThis.__RealDate=Date;
    globalThis.Date=class extends __RealDate {static now(){return __clockMs}};
    globalThis.__rng=${p352.secondWindow.before.rng};
    Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    globalThis.__trainingPaid={};const originalPayTrainingCost=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      originalPayTrainingCost(cost,n);
      for(const key of trainingCostKeys(cost)){
        const paid=before[key]-S.res[key];
        if(Math.abs(paid-cost[key]*n)>1e-6)throw Error('training debit mismatch '+key);
        __trainingPaid[key]=(__trainingPaid[key]||0)+paid;
      }
    };
  `);
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('popCurrent()'),1122);
  assert.equal(run('maxPop()'),1122);
  assert.equal(run('popAllocTotal()'),1002);
  assert.equal(run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),626);
  const startStock=run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]]))");
  const startArmy=run('armyCount()');
  for(const [key,value] of Object.entries(run('({...S.popAlloc})'))){
    if(value>0)assert.equal(run('setPopAlloc('+JSON.stringify(key)+',0)')?.ok,true,key+' remove');
  }
  for(const [key,value] of Object.entries(plan.workers)){
    assert.equal(run('setPopAlloc('+JSON.stringify(key)+','+value+')')?.ok,true,key+' assign');
  }
  const allocation=run('({...S.popAlloc})');
  assert.equal(run('popAllocTotal()'),Object.values(plan.workers).reduce((n,v)=>n+v,0));
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'positive initial food net');
  assert.equal(run('save().ok'),true);
  const logoutSave=env.store.get('rts_save');
  const logoutReload=environment({rts_save:logoutSave});
  assert.equal(logoutReload.run('loadSaveAndApply().status'),'ok');
  assert.equal(logoutReload.run('popAllocTotal()'),run('popAllocTotal()'));
  const startTick=run('S.tick');
  run('__clockMs+=14400000');
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const result=run('settleOffline()');
  assert.equal(result?.ok,true,plan.name+' settled');
  assert.equal(result.durationSec,14400);
  assert.equal(result.truncated,false,plan.name+' no food clamp');
  assert.equal(run('S.tick')-startTick,14400);
  const stock=run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]]))");
  const queue=run('Object.fromEntries(Object.entries(S.queue).filter(([,q])=>q?.count>0).map(([key,q])=>[key,{count:q.count,reason:q.reason||""}]))');
  const queueCount=Object.values(queue).reduce((n,q)=>n+q.count,0);
  const army=run('armyCount()');
  const produced=626-queueCount;
  assert.equal(army-startArmy,produced);
  assert.equal(run('S.offline.pendingReport.advance.produced'),produced);
  assert.ok(Object.values(stock).every(v=>Number.isFinite(v)&&v>=0));
  assert.equal(run('S.res.deed'),4582);
  assert.equal(result.gains.deed,4536);
  assert.equal(run('popCurrent()'),1122);
  assert.equal(run('maxPop()'),1122);
  const settledSave=env.store.get('rts_save');
  const arrivalReload=environment({rts_save:settledSave});
  assert.equal(arrivalReload.run('loadSaveAndApply().status'),'ok');
  assert.equal(arrivalReload.run('S.tick'),run('S.tick'));
  assert.equal(arrivalReload.run('armyCount()'),army);
  assert.equal(arrivalReload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),queueCount);
  assert.equal(arrivalReload.run('S.res.coal'),stock.coal);
  settledSaves.set(plan.name,settledSave);
  return{name:plan.name,workers:plan.workers,allocation,workerCount:run('popAllocTotal()'),
    startStock,logoutSaveSha256:sha(logoutSave),result,
    produced,queueCount,queue,army,stock,trainingPaid:run('({...__trainingPaid})'),
    settledSaveSha256:sha(settledSave),foodClamped:result.truncated};
}

const outcomes=plans.map(probe);
assert.equal(outcomes[0].produced,345,'P352 1002-worker baseline');
assert.equal(outcomes[1].produced,382,'P352 1122-worker baseline');
const selected=outcomes.find(o=>o.name==='wood-5-stone-80-coal-235');
assert.ok(selected);
assert.equal(selected.produced,626);
assert.equal(selected.queueCount,0);
for(const key of ['food','wood','stone','coal','copper','iron','steel','gold'])
  assert.ok(selected.stock[key]>selected.startStock[key],key+' positive full-window stock change');
const selectedSaveFile=data+'p354-wood-5-coal-235-full-queue-4h-save.json';
const selectedSaveText=settledSaves.get(selected.name);
assert.equal(sha(selectedSaveText),selected.settledSaveSha256);
fs.writeFileSync(path.join(root,selectedSaveFile),selectedSaveText,'utf8');
const report={batch:'P354',date:'2026-09-29',unit:'seconds, resources, soldiers',
  fixtureFile,fixtureSha256,codeHashes,
  reference:{p352BaseProduced:345,p352AllProduced:382},outcomes,
  selected:{name:selected.name,saveFile:selectedSaveFile,saveSha256:selected.settledSaveSha256},
  limits:['One P352 paid five-birth-policy save, one four-hour offline window, deterministic market RNG.',
    'Only workers are reassigned with shipped actions; no new resource, population, research, or queue is injected.',
    'Stone-and-coal balance in one window is not proof of sustainable multi-window growth; the queue and source stock change.',
    'VM localStorage and DOM do not prove browser or Android behavior.']};
const outputFile=path.join(root,data+'p354-wild-coal-balance.json');
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({outputFile,selected:report.selected,fixtureSha256,comparison:outcomes.map(o=>({name:o.name,workers:o.workers,
  produced:o.produced,pending:o.queueCount,coal:o.stock.coal,stone:o.stock.stone,
  copper:o.stock.copper,iron:o.stock.iron,steel:o.stock.steel,gold:o.stock.gold,
  food:o.stock.food,foodClamped:o.foodClamped}))},null,2));
