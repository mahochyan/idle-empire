'use strict';
// P363: rebuild the paid P359 army, then test the live high-alert god-crystal route without injecting stock.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceName='p359-quantum-stock-cap-paid-save.json';
const rosterName='p329-soul-refreshed-save.json';
const sourceRaw=fs.readFileSync(path.join(data,sourceName),'utf8');
const rosterRaw=fs.readFileSync(path.join(data,rosterName),'utf8');
assert.equal(sha(sourceRaw),'600a951a3612bbd7965fd1e208024dd7b0224f47013da7542ab1c38d6ffd9199');
assert.equal(sha(rosterRaw),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const target=JSON.parse(rosterRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);
const source=JSON.parse(sourceRaw),env=environment({rts_save:sourceRaw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
function setup(testRun,origin){
  testRun(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
      static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=123456789;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
}
setup(run,source);
run(`globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid}
    return result};`);
const state=()=>run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),food:S.res.food,
  tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,
  alert:S.killValues.godRevival,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
  steam:S.eraStorage.steamKnowledge,quantum:scienceUnlocked('sci_quantum_age')})`);
const stock=()=>run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]]))");
const initial=state();assert.equal(initial.army,101);assert.equal(initial.deployed,55);
assert.equal(initial.crystal,66);assert.equal(initial.alert,5200);assert.equal(initial.steam,23);
const phases={food:0,wood:0,stone:0,coal:0,copper:0,iron:0,steel:0,gold:0,tech:0,training:0};
let onlineSeconds=0,minFood=initial.food,phase='tech';
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [key,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food');
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=result.n;phases[phase]+=result.n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000).done,resource+' fill timeout');
}
function fillProcessed(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  let cycles=0;
  while(val(resource)<targetValue&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetValue}`,7000,stop);
    assert.ok(val(resource)>before,resource+' fill exhausted');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){if(val(resource)>=targetValue)return;
  if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue)}
function restoreRoster(){
  const before=state(),beforeStock=stock(),paymentStart=run('({...__actualTraining})'),shortages={},expected={};
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  for(const [unit,wanted] of Object.entries(targetByType)){
    const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));shortages[unit]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');
    const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
    phase='training';assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000).done,unit+' train timeout');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const paymentEnd=run('({...__actualTraining})'),actual={};
  for(const [key,n] of Object.entries(expected)){
    actual[key]=(paymentEnd[key]||0)-(paymentStart[key]||0);assert.ok(Math.abs(n-actual[key])<1e-6,key+' paid');
  }
  const after=state(),afterStock=stock();
  assert.equal(after.army,672);assert.equal(after.deployed,626);assert.equal(after.queue,0);
  assert.equal(after.alert,before.alert);
  return{before,beforeStock,shortages,trained:Object.values(shortages).reduce((a,b)=>a+b,0),expected,actual,
    after,afterStock,seconds:after.tick-before.tick};
}
const restoration=restoreRoster();
assert.equal(restoration.trained,571);
assert.equal(run('save().ok'),true);
const rosterSave=env.store.get('rts_save');
const rosterReload=environment({rts_save:rosterSave});
assert.equal(rosterReload.run('loadSaveAndApply().status'),'ok');
assert.equal(rosterReload.run('formSoldierCount()'),626);
assert.equal(sha(fs.readFileSync(path.join(data,sourceName),'utf8')),sha(sourceRaw));
const rosterSaveFile='p363-full-roster-paid-save.json';
fs.writeFileSync(path.join(data,rosterSaveFile),rosterSave);
// A trial is an independent replay of this genuinely paid roster; it never alters the main branch.
function trial(seed,raw=rosterSave){
  const saved=JSON.parse(raw),clone=environment({rts_save:raw}),r=clone.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');setup(r,saved);
  r(`__rng=${seed};openMaterialDomain('godCrystal')`);
  assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,alert:S.killValues.godRevival})');
  assert.ok(['win','lose'].includes(result));
  assert.equal(r('loadSaveAndApply().status'),'ok');
  return{seed,result,enemy,after,callbacks};
}
const trials=[];
for(let seed=1;seed<=256;seed++)trials.push(trial(seed));
const summary={tested:trials.length,wins:trials.filter(x=>x.result==='win').length,
  firstWinSeed:trials.find(x=>x.result==='win')?.seed||null};
const sourceHashes=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-quantum-crystal-recovery-p363.js']
  .map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const report={batch:'P363',kind:'paid restoration and independent current-alert god-crystal trials',
  sourceName,sourceSha256:sha(sourceRaw),rosterName,rosterSha256:sha(rosterRaw),sourceHashes,
  initial,restoration,onlineSeconds,phases,minFood,rosterSaveFile,rosterSaveSha256:sha(rosterSave),
  summary,trials};
const reportFile='p363-crystal-paid-pilot.json';
fs.writeFileSync(path.join(data,reportFile),JSON.stringify(report,null,2)+'\n');
function fightMain(seed){
  const before=state();assert.equal(before.deployed,626);
  run(`__rng=${seed};openMaterialDomain('godCrystal')`);
  assert.equal(run('S.battleActive'),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);
  assert.equal(run("document.getElementById('battle-result').className"),'win');
  const after=state();
  assert.ok(after.crystal>before.crystal);
  assert.equal(after.alert,before.alert+100);
  assert.equal(after.army,before.army-(before.deployed-after.deployed));
  run('exitBattle()');
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.godCrystal'),after.crystal);
  assert.equal(reload.run('S.killValues.godRevival'),after.alert);
  return{seed,before,enemy,after,callbacks,saveSha256:sha(saved)};
}
const route=[];
let blocked=null;
for(let battle=1;battle<=3;battle++){
  const raw=env.store.get('rts_save');
  const currentTrials=battle===1?trials:Array.from({length:256},(_,i)=>trial(i+1,raw));
  const winners=currentTrials.filter(x=>x.result==='win');
  const chosen=winners.sort((a,b)=>b.after.army-a.after.army||a.seed-b.seed)[0];
  const pilot={tested:currentTrials.length,wins:winners.length,
    chosenSeed:chosen?.seed||null,chosenLoss:chosen?672-chosen.after.army:null,
    enemy:currentTrials[0].enemy,rows:currentTrials};
  if(!chosen){blocked={battle,alert:state().alert,reason:'no-win-in-256-fixed-streams',pilot};break}
  const outcome=fightMain(chosen.seed);
  assert.equal(outcome.after.army,chosen.after.army);
  assert.equal(outcome.after.crystal,chosen.after.crystal);
  const recovery=restoreRoster();
  assert.equal(run('save().ok'),true);
  const recovered=env.store.get('rts_save'),reload=environment({rts_save:recovered});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),626);
  route.push({battle,pilot,outcome,recovery,recoveredSha256:sha(recovered)});
  console.error(JSON.stringify({battle,alert:outcome.before.alert,seed:chosen.seed,
    pilotWins:pilot.wins,crystalGain:outcome.after.crystal-outcome.before.crystal,
    battleLoss:outcome.before.army-outcome.after.army,recoverySeconds:recovery.seconds,
    onlineSeconds,crystal:state().crystal}));
}
let upgraded=null,terminal=null,finalSave=null,finalSaveFile=null;
if(!blocked){
  const cost=run("eraStorageCost('steamKnowledge')");
  assert.equal(cost.tech,7200000);assert.equal(cost.godCrystal,240);
  const beforeUpgrade=state();assert.ok(beforeUpgrade.crystal>=cost.godCrystal);
  upgraded=run("upgradeEraStorage('steamKnowledge')");assert.equal(upgraded?.ok,true);
  terminal=state();assert.equal(terminal.steam,24);
  assert.equal(terminal.crystal,beforeUpgrade.crystal-cost.godCrystal);
  assert.equal(terminal.tech,beforeUpgrade.tech-cost.tech);
  assert.equal(terminal.deployed,626);assert.equal(terminal.queue,0);
  assert.equal(run('save().ok'),true);
  finalSave=env.store.get('rts_save');
  const reload=environment({rts_save:finalSave});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.eraStorage.steamKnowledge'),24);
  assert.equal(reload.run('formSoldierCount()'),626);
  finalSaveFile='p363-crystal-steam24-paid-save.json';
  fs.writeFileSync(path.join(data,finalSaveFile),finalSave);
}
assert.equal(sha(fs.readFileSync(path.join(data,sourceName),'utf8')),sha(sourceRaw));
assert.equal(sha(fs.readFileSync(path.join(data,rosterName),'utf8')),sha(rosterRaw));
const routeReport={batch:'P363',kind:'paid full-roster high-alert crystal fights, real recovery, and attempted steam knowledge 23->24',
  sourceName,sourceSha256:sha(sourceRaw),rosterName,rosterSha256:sha(rosterRaw),sourceHashes,
  initial,restoration,rosterSaveFile,rosterSaveSha256:sha(rosterSave),route,blocked,
  upgraded,terminal,finalSaveFile,finalSaveSha256:finalSave?sha(finalSave):null,
  onlineSeconds,offlineSeconds:0,phases,minFood,
  caveat:'Each battle chooses the lowest-loss winning seed among 256 independent fixed streams; this proves an existence route, not a natural win rate or uninterrupted PRNG stream.'};
const routeReportFile='p363-crystal-paid-route.json';
fs.writeFileSync(path.join(data,routeReportFile),JSON.stringify(routeReport,null,2)+'\n');
console.log(JSON.stringify({routeReportFile,reportFile,rosterSaveFile,rosterSaveSha256:sha(rosterSave),
  restored:restoration.trained,route:route.map(x=>({battle:x.battle,pilotWins:x.pilot.wins,seed:x.outcome.seed,
    alert:x.outcome.before.alert,crystalGain:x.outcome.after.crystal-x.outcome.before.crystal,
    battleLoss:x.outcome.before.army-x.outcome.after.army,recoverySeconds:x.recovery.seconds,
    recoveredSha256:x.recoveredSha256})),blocked,upgraded,terminal,finalSaveFile,
  finalSaveSha256:routeReport.finalSaveSha256,onlineSeconds,offlineSeconds:0,phases,minFood},null,2));
