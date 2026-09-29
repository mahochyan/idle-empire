'use strict';
// Complete the paid quantum training queue, then fight the formal L100.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const dir=path.resolve(__dirname,'../../docs/codex/reports/data');
const sourceFile='p397-quantum-two-stores-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'c057701bbbfcf6d4763696e47cba0d10e37704b75f8f4cd5031a3cb050e7bea8');
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[${source.ts}+(S.tick-${source.tick})*1000]))}
  static now(){return ${source.ts}+(S.tick-${source.tick})*1000}
};
globalThis.__timers=new Map();globalThis.__nextTimer=1;
globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
globalThis.clearTimeout=id=>__timers.delete(id);
globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
  __timers.delete(first[0]);first[1].fn();return true};
globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};
globalThis.__trainingPaid=[];const __realPay=payTrainingCost;
payTrainingCost=function(cost,n){
  const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
  __realPay(cost,n);
  __trainingPaid.push(Object.fromEntries(trainingCostKeys(cost).map(k=>[k,before[k]-S.res[k]])));
};`);
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,
  cap:resCap('tech'),army:armyCount(),deployed:formSoldierCount(),
  quantumPool:poolAvail('quantum_trooper'),quantumQueue:queueTotal('quantum_trooper'),
  copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,
  unlocked:scienceUnlocked('sci_quantum_age'),starArray:scienceUnlocked('sci_star_array'),
  clear99:S.defeated.includes(99),clear100:S.defeated.includes(100)})`);
const result={sourceFile,sourceHash:sha(raw),clock:{onlineSeconds:0,offlineSeconds:0},start:state()};
assert.equal(result.start.unlocked,true);
assert.equal(result.start.starArray,true);
assert.equal(result.start.clear99,true);
assert.equal(result.start.clear100,false);
assert.equal(result.start.quantumQueue,1);
assert.equal(result.start.quantumPool,0);
assert.ok(result.start.steel<8000,'expected natural steel shortage from prior paid path');
assert.equal(run("setPopAlloc('tech',0)")?.ok,true);
assert.equal(run("setPopAlloc('steel',902)")?.ok,true);
assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
let trainingSeconds=0;
while(run("poolAvail('quantum_trooper')")<1&&trainingSeconds<1000){
  run('tick()');trainingSeconds++;result.clock.onlineSeconds++;
}
assert.ok(trainingSeconds<1000,'paid quantum training did not finish');
result.afterTraining=state();
result.trainingSeconds=trainingSeconds;
assert.equal(result.afterTraining.quantumPool,1);
assert.equal(result.afterTraining.quantumQueue,0);
result.trainingPaid=run('(__trainingPaid)');
assert.equal(result.trainingPaid.length,1);
for(const k of ['copper','iron','steel'])assert.equal(result.trainingPaid[0][k],8000);
assert.equal(run('save().ok'),true);
const trainedRaw=env.store.get('rts_save');
const trainedReload=environment({rts_save:trainedRaw});
assert.equal(trainedReload.run('loadSaveAndApply().status'),'ok');
assert.equal(trainedReload.run("poolAvail('quantum_trooper')"),1);
result.trainedSaveHash=sha(trainedRaw);
result.formalEnemy=run(`({id:CFG.enemies[99].id,groups:Object.keys(CFG.enemies[99].units).length,
  people:Object.values(CFG.enemies[99].units).flat().reduce((a,b)=>a+b,0),
  needSciences:CFG.enemies[99].needSciences})`);
assert.equal(result.formalEnemy.id,100);
assert.equal(result.formalEnemy.people,1100);
assert.equal(run('campaignStageSelectable(99)'),true);
assert.equal(run('selEnemy(99)'),true);
result.beforeBattle=state();
run('openBattle()');
assert.equal(run('S.battleActive'),true);
result.actualEnemy=run(`({id:B.enemyCfg.id,groups:B.enemyUnits.length,
  people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
  hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
assert.equal(result.actualEnemy.id,100);
assert.equal(result.actualEnemy.people,1100);
let callbacks=0;
while(run('S.battleActive')&&callbacks<4000){
  assert.equal(run('__step()'),true,'battle callback missing');callbacks++;
}
assert.ok(callbacks<4000);
result.outcome=run("document.getElementById('battle-result').className");
result.afterBattle=state();
result.battle={callbacks,round:run('B.round'),loss:result.beforeBattle.deployed-result.afterBattle.deployed,
  enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')};
assert.equal(result.outcome,'win');
assert.equal(result.afterBattle.clear100,true);
assert.equal(result.afterBattle.unlocked,true);
run('exitBattle()');
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.defeated.includes(100)'),true);
assert.equal(reload.run("poolAvail('quantum_trooper')"),1);
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),result.sourceHash);
result.finalHash=sha(finalRaw);
result.finalFile='p397-quantum-stage100-paid-save.json';
fs.writeFileSync(path.join(dir,result.finalFile),finalRaw);
fs.writeFileSync(path.join(dir,'p397-quantum-stage100.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start:result.start,afterTraining:result.afterTraining,
  trainingSeconds:result.trainingSeconds,trainingPaid:result.trainingPaid,
  formalEnemy:result.formalEnemy,actualEnemy:result.actualEnemy,
  outcome:result.outcome,battle:result.battle,afterBattle:result.afterBattle,
  clock:result.clock,finalFile:result.finalFile,finalHash:result.finalHash},null,2));
