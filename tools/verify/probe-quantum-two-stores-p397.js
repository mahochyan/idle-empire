'use strict';
// Reinvest paid guardian/crystal encounters toward a 3-billion quantum cap.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const dir=path.resolve(__dirname,'../../docs/codex/reports/data');
const sourceFile='p397-quantum-bounded-cycle-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'c8b71c92ad325efec241fba561e852c448c5d2c156ceb30bd9673a7f23e3afe1');
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const rosterRaw=fs.readFileSync(path.join(dir,'p395-quantum-storage-medal-combined-paid-save.json'),'utf8');
assert.equal(sha(rosterRaw),'ecf78293015e46e05e70c38916a834c7063345f8ef11cb7ac29a337b0774b75e');
const targetFormation=JSON.parse(rosterRaw).formation;
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
  __rng=x>>>0;return __rng/4294967296};`);
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  army:armyCount(),deployed:formSoldierCount(),blood:S.items.sacredBlood,
  crystal:S.items.godCrystal,guardian:S.items.guardianStone,
  crystalAlert:S.killValues.godRevival,guardianAlert:S.killValues.godGuardian,
  steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
  nuclear:S.eraStorage.nuclearKnowledge,quantum:scienceUnlocked('sci_quantum_age')})`);
const result={sourceFile,sourceHash:sha(raw),start:state(),targets:{electric:63,steam:64},
  clock:{onlineSeconds:0,offlineSeconds:0},battles:[],cleanses:[],replenishments:[],payments:[],
  firstFailure:null,checkpoints:[]};
assert.equal(result.start.nuclear,21);
assert.equal(result.start.electric,19);
assert.equal(result.start.steam,34);
function replenish(){
  const before=state(),target={};
  for(const groups of Object.values(targetFormation))for(const u of groups)
    target[u.type]=(target[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need=Object.fromEntries(Object.entries(target).map(([type,wanted])=>
    [type,Math.max(0,wanted-run(`poolAvail(${JSON.stringify(type)})`))]));
  const phases={stone:0,coal:0,copper:0,iron:0,steel:0,wood:0,gold:0,food:0,training:0};
  let phase='training',seconds=0,minFood=run('S.res.food');
  const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap(${JSON.stringify(k)})`);
  function assign(resource){
    for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc(${JSON.stringify(resource)},902)`)?.ok,true);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
    phase=resource;
  }
  function advanceUntil(expression,max,stop='false'){
    const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
      tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
    seconds+=x.n;result.clock.onlineSeconds+=x.n;
    minFood=Math.min(minFood,x.min);phases[phase]+=x.n;
    assert.ok(x.min>0,'food depleted during recovery');return x;
  }
  function fillBasic(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource),`${resource} amount exceeds cap`);
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,20000).done,resource+' timeout');
  }
  function fillProcessed(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource),`${resource} amount exceeds cap`);
    let cycles=0;
    while(val(resource)<amount&&cycles++<100){
      if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
      if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
      if(resource==='steel'&&val('iron')<100000)
        fillProcessed('iron',Math.min(1000000,cap('iron')));
      const prior=val(resource);assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+
        (resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${amount}`,10000,stop);
      assert.ok(val(resource)>prior,resource+' stalled');
    }
    assert.ok(val(resource)>=amount,resource+' exhausted');
  }
  function fill(resource,amount){
    if(val(resource)>=amount)return;
    if(['copper','iron','steel'].includes(resource))fillProcessed(resource,amount);
    else fillBasic(resource,amount);
  }
  const trainingCost={},order={steel:0,iron:1,copper:2,gold:3,food:4,stone:5,wood:6};
  for(const [type,short]of Object.entries(need)){
    if(!short)continue;
    const cost=run(`({...CFG.units[${JSON.stringify(type)}].cost})`);
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=perUnit*short;fill(resource,amount);
      trainingCost[resource]=(trainingCost[resource]||0)+amount;
    }
    assert.equal(run(`train(${JSON.stringify(type)},${short})`)?.ok,true);
    phase='training';
    assert.ok(advanceUntil(`poolAvail(${JSON.stringify(type)})>=${target[type]}`,2000).done,
      type+' training timeout');
  }
  for(const [row,groups]of Object.entries(targetFormation))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail(${JSON.stringify(u.type)})`)>=u.count);
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=state();
  assert.equal(after.deployed,626);
  assert.equal(after.army,672);
  result.replenishments.push({before,need,trainingCost,seconds,minFood,phases,after});
}
function fillTech(amount){
  if(state().tech>=amount)return 0;
  if(state().cap<amount)return null;
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run("setPopAlloc('tech',902)")?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  let seconds=0;
  while(state().tech<amount&&seconds<150000){
    run('for(let j=0;j<100;j++)tick()');
    seconds+=100;result.clock.onlineSeconds+=100;
  }
  assert.ok(state().tech>=amount,'knowledge fill timed out');
  assert.ok(run('S.res.food')>0,'food depleted while filling knowledge');
  return seconds;
}
let battleCount=0;
for(const track of [
  {field:'electric',storageKey:'electricKnowledge',materialKey:'guardianStone',stock:'guardian',alert:'guardianAlert',target:result.targets.electric},
  {field:'steam',storageKey:'steamKnowledge',materialKey:'godCrystal',stock:'crystal',alert:'crystalAlert',target:result.targets.steam}
]){
while(state()[track.field]<track.target&&!result.firstFailure){
  const level=state()[track.field]+1,cost=run(`eraStorageCost(${JSON.stringify(track.storageKey)})`);
  assert.ok(cost[track.materialKey]>0);
  while(state()[track.stock]<cost[track.materialKey]&&battleCount<1000){
    if(state().army<672)replenish();
    const before=state();
    // Keep existing 4900/5000 alert at the tier where one win replaces
    // the three blood vials paid for one cleanser.
    if(before[track.alert]>=200){
      const exchange=run('exchangeDomainCleanser(1)');
      if(!exchange.ok||exchange.repeat){
        result.firstFailure={type:'cleanser-exchange',track:track.field,level,before,result:exchange};break;
      }
      const use=run(`useDomainCleanser(${JSON.stringify(track.materialKey)})`);
      if(!use.ok||use.repeat){
        result.firstFailure={type:'cleanser-use',track:track.field,level,before,result:use};break;
      }
      result.cleanses.push({track:track.field,level,before,exchange,use,after:state()});
    }
    const expected=run(`materialDomainEncounter(${JSON.stringify(track.materialKey)}).reward.${track.materialKey}`);
    const opened=run(`openMaterialDomain(${JSON.stringify(track.materialKey)})`);
    if(!run('S.battleActive')){
      result.firstFailure={type:'battle-open',track:track.field,level,before,result:opened};break;
    }
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
    assert.ok(callbacks<10000);
    const outcome=run("document.getElementById('battle-result').className");
    run('exitBattle()');
    const after=state();
    result.battles.push({track:track.field,level,before,expected,outcome,callbacks,after,
      materialGain:after[track.stock]-before[track.stock],armyLoss:before.army-after.army});
    battleCount++;
    if(outcome!=='win'){
      result.firstFailure={type:'battle-loss',track:track.field,level,before,after,callbacks};break;
    }
    assert.equal(after[track.stock]-before[track.stock],expected);
    run('for(let i=0;i<6;i++)tick()');
    result.clock.onlineSeconds+=6;
  }
  if(result.firstFailure)break;
  if(battleCount>=1000){result.firstFailure={type:'probe-bound',track:track.field,level,state:state()};break}
  const fillSeconds=fillTech(cost.tech);
  if(fillSeconds===null){result.firstFailure={type:'knowledge-cap',track:track.field,level,cost,state:state()};break}
  const before=state(),paid=run(`upgradeEraStorage(${JSON.stringify(track.storageKey)})`);
  if(!paid.ok){result.firstFailure={type:'storage-payment',track:track.field,level,cost,before,result:paid};break}
  const after=state();
  assert.equal(after[track.field],level);
  assert.equal(after.tech,before.tech-cost.tech);
  assert.equal(after[track.stock],before[track.stock]-cost[track.materialKey]);
  assert.ok(after.cap>before.cap);
  result.payments.push({track:track.field,level,cost,fillSeconds,before,paid,after});
  assert.equal(run('save().ok'),true);
  const checkpoint=env.store.get('rts_save');
  const reload=environment({rts_save:checkpoint});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("resCap('tech')"),after.cap);
  result.checkpoints.push({track:track.field,level,sha256:sha(checkpoint),state:after});
  console.error(`paid ${track.field} storage ${level}: cap=${after.cap}, wins=${battleCount}, online=${result.clock.onlineSeconds}s`);
}
}
if(!result.firstFailure){
  result.capBeforeQuantum=state().cap;
  assert.ok(result.capBeforeQuantum>=3000000000);
  result.fillQuantumSeconds=fillTech(3000000000);
  if(result.fillQuantumSeconds===null)result.firstFailure={type:'knowledge-cap-quantum',state:state()};
  else{
    result.beforeQuantum=state();
    result.quantumResearch=run("researchScience('sci_quantum_age')");
    if(!result.quantumResearch.ok)result.firstFailure={type:'quantum-research',before:result.beforeQuantum,result:result.quantumResearch};
    else{
      assert.equal(state().tech,result.beforeQuantum.tech-3000000000);
      assert.equal(state().medal,result.beforeQuantum.medal-3000000);
      assert.equal(state().quantum,true);
      result.quantumRepeat=run("researchScience('sci_quantum_age')");
      assert.equal(state().tech,result.beforeQuantum.tech-3000000000);
      assert.equal(state().medal,result.beforeQuantum.medal-3000000);
      result.quantumTrainingBefore=run("({pool:poolAvail('quantum_trooper'),queue:queueTotal('quantum_trooper'),copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})");
      result.trainingAttempt=run("train('quantum_trooper',1)");
      assert.equal(result.trainingAttempt.ok,true,JSON.stringify(result.trainingAttempt));
      result.quantumTrainingQueued=run("({pool:poolAvail('quantum_trooper'),queue:queueTotal('quantum_trooper'),copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})");
      assert.equal(result.quantumTrainingQueued.queue,result.quantumTrainingBefore.queue+1);
    }
  }
}
result.final=state();
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),result.final.cap);
assert.equal(reload.run('S.eraStorage.electricKnowledge'),result.final.electric);
assert.equal(reload.run('S.eraStorage.steamKnowledge'),result.final.steam);
assert.equal(reload.run("scienceUnlocked('sci_quantum_age')"),result.final.quantum);
if(result.quantumTrainingQueued)
  assert.equal(reload.run("queueTotal('quantum_trooper')"),result.quantumTrainingQueued.queue);
result.finalHash=sha(finalRaw);
result.finalFile='p397-quantum-two-stores-save.json';
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),result.sourceHash);
fs.writeFileSync(path.join(dir,result.finalFile),finalRaw);
fs.writeFileSync(path.join(dir,'p397-quantum-two-stores.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start:result.start,battles:result.battles.length,
  lastBattle:result.battles.at(-1),payments:result.payments.map(x=>({track:x.track,level:x.level,cost:x.cost,cap:x.after.cap})),
  replenishments:result.replenishments.length,firstFailure:result.firstFailure,
  capBeforeQuantum:result.capBeforeQuantum,fillQuantumSeconds:result.fillQuantumSeconds,
  quantumResearch:result.quantumResearch,trainingAttempt:result.trainingAttempt,
  quantumTrainingBefore:result.quantumTrainingBefore,quantumTrainingQueued:result.quantumTrainingQueued,
  final:result.final,clock:result.clock,finalFile:result.finalFile,finalHash:result.finalHash},null,2));
