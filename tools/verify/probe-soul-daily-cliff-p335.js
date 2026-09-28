'use strict';
// Cross the local day from the P334 elite-clear save, then test whether refreshed elites can fund the next star.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p334-soul-six-queue-elite-cleared-save.json';
const sourceText=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(sourceText),'55bcfc8a8e53a46322fc05600f32d852c5df16c6727534cc40545cb3e6e0dd3d');
const previous=JSON.parse(fs.readFileSync(path.join(root,data+'p334-soul-six-queue-route.json'),'utf8'));
assert.equal(previous.eliteCheckpoint.sha256,sha(sourceText));
assert.equal(previous.eliteCheckpoint.state.rng,2528873696);
const rosterFile=data+'p329-soul-refreshed-save.json',rosterText=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterText),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const origin=JSON.parse(sourceText),target=JSON.parse(rosterText).formation,targetByType={};
for(const groups of Object.values(target))for(const unit of groups)targetByType[unit.type]=(targetByType[unit.type]||0)+unit.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);
const env=environment({rts_save:sourceText}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${previous.eliteCheckpoint.state.rng};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid}return result};`);
const stock=()=>run("Object.fromEntries(['food','stone','coal','copper','iron','steel'].map(k=>[k,S.res[k]]))");
const state=()=>run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,slots:[...S.soulRealmTeam.slots],rng:__rng})');
const initial=state(),initialStock=stock();
assert.equal(initial.army,672);assert.equal(initial.deployed,626);assert.equal(initial.stone,71);assert.equal(initial.alert,6850);
let seconds=0,minFood=initialStock.food;
const phases={wood:0,stone:0,coal:0,iron:0,steel:0,copper:0,gold:0,food:0,tech:0};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food')assert.equal(run("setPopAlloc('food',999)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food must stay positive');
}
function advanceUntil(expression,max,stop='false',resource='tech'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=x.n;phases[resource]+=x.n;minFood=Math.min(minFood,x.min);
  assert.ok(x.min>0,'food depleted');return x;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000,'false',resource).done,resource+' fill timeout');
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
    advanceUntil(`S.res.${resource}>=${targetValue}`,7000,stop,resource);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){
  if(val(resource)>=targetValue)return;
  if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue);
}
function restoreRoster(){
  const before=state(),beforeStock=stock(),paymentStart=run('({...__actualTraining})'),losses={},expected={};
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  for(const[unit,wanted]of Object.entries(targetByType)){
    const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));losses[unit]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');assert.equal(run(`train('${unit}',${short})`)?.ok,true,unit+' training');
    assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','tech').done,unit+' training timeout');
  }
  for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const paymentEnd=run('({...__actualTraining})'),actual={};
  for(const[k,n]of Object.entries(expected)){
    actual[k]=(paymentEnd[k]||0)-(paymentStart[k]||0);assert.ok(Math.abs(n-actual[k])<1e-6,k+' payment');
  }
  const after=state(),afterStock=stock();
  assert.equal(after.army,672);assert.equal(after.deployed,626);
  assert.equal(after.stone,before.stone);assert.equal(after.alert,before.alert);
  return{before,beforeStock,losses,expected,actual,after,afterStock,seconds:after.tick-before.tick};
}
function fight(slot,tierId){
  const before=state();assert.equal(before.slots[slot],tierId);
  assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,mass:B.enemyUnits[0].attackMass})');
  assert.equal(enemy.mass,6);
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");assert.ok(['win','lose'].includes(result));
  const enemyHp=run('B.enemyUnits[0].hp'),after=state();
  if(result==='win'){
    assert.equal(after.slots[slot],null);assert.ok(after.stone>before.stone);
    assert.equal(after.alert,before.alert+run(`soulRealmTier(${tierId}).alert`));
  }else{
    assert.equal(after.slots[slot],tierId);assert.equal(after.stone,before.stone);assert.equal(after.alert,before.alert);
  }
  run('exitBattle()');
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('armyCount()'),after.army);assert.equal(reload.run('S.items.soulStone'),after.stone);
  assert.equal(reload.run('S.killValues.soulRealm'),after.alert);
  return{slot,tierId,before,enemy,result,enemyHp,after,callbacks,saveSha256:sha(saved)};
}
const originalDay=run('soulRealmDay()');assert.equal(originalDay,run('S.soulRealmTeam.day'));
assert.equal(run('refreshSoulRealmTeam().reason'),'refresh-locked');
assign('tech');
const dayWait=advanceUntil('soulRealmDay()>S.soulRealmTeam.day',86401,'false','tech');
assert.ok(dayWait.done);assert.equal(run('soulRealmDay()'),originalDay+1);
const refreshResult=run('refreshSoulRealmTeam()');assert.equal(refreshResult.ok,true);
const refresh={ok:refreshResult.ok,slots:[...refreshResult.slots]};
const refreshed=state(),refreshedStock=stock();
assert.equal(refreshed.stone,71);assert.equal(refreshed.alert,6850);
assert.equal(refreshed.slots.length,9);
assert.ok(refreshed.slots.filter(id=>id===540399).length>=4,'four elite wins must remain reachable on this daily draw');
const rounds=[],maxBattles=20;
let alert7050Checkpoint=null;
for(let n=0;n<maxBattles&&state().stone<100;n++){
  const slot=state().slots.indexOf(540399);
  if(slot<0)break;
  const restoration=restoreRoster();
  if(state().alert>=7000&&!alert7050Checkpoint){
    assert.equal(run('save().ok'),true);
    const text=env.store.get('rts_save'),file=data+'p335-soul-alert7050-full-save.json';
    const reload=environment({rts_save:text});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('armyCount()'),672);
    fs.writeFileSync(path.join(root,file),text,'utf8');
    alert7050Checkpoint={file,sha256:sha(text),state:state(),stock:stock(),seconds};
  }
  const battle=fight(slot,540399);
  rounds.push({restoration,battle});
}
// Pay the final casualties before buying a star, so the source and destination roster are comparable.
const terminalRestoration=state().deployed===626?null:restoreRoster();
assert.equal(run('save().ok'),true);
const preStar=state(),preStarStock=stock(),preStarText=env.store.get('rts_save');
assert.equal(preStar.army,672);assert.equal(preStar.deployed,626);
const preStarFile=preStar.stone>=100?data+'p335-soul-daily-pre-star-save.json':null;
if(preStarFile)fs.writeFileSync(path.join(root,preStarFile),preStarText,'utf8');
const preStarReload=environment({rts_save:preStarText});assert.equal(preStarReload.run('loadSaveAndApply().status'),'ok');
assert.equal(preStarReload.run('S.items.soulStone'),preStar.stone);
let paidStar=null;
if(preStar.stone>=100){
  const before=run('({hp:battleVitals("star_trooper",1,true).hpPerSoldier,atk:weaponAttack("star_trooper"),def:weaponDefense("star_trooper"),cost:soulRankCost("star_trooper"),rank:S.soulRanks.star_trooper??null,arcane:{...S.soulRanks.arcane_mage}})');
  assert.equal(before.cost,100);assert.equal(before.rank,null);
  const action=run("upgradeSoulRank('star_trooper')");assert.equal(action.ok,true);assert.equal(action.cost,100);
  const after=run('({hp:battleVitals("star_trooper",1,true).hpPerSoldier,atk:weaponAttack("star_trooper"),def:weaponDefense("star_trooper"),rank:{...S.soulRanks.star_trooper},arcane:{...S.soulRanks.arcane_mage},stone:S.items.soulStone})');
  assert.deepEqual(after.rank,{rank:0,stars:1});assert.deepEqual(after.arcane,before.arcane);
  assert.ok(after.hp>before.hp);assert.equal(after.atk,before.atk);assert.equal(after.def,before.def);
  assert.equal(after.stone,preStar.stone-100);
  paidStar={before,action,after};
}
assert.equal(run('save().ok'),true);
const final=state(),finalStock=stock(),finalText=env.store.get('rts_save');
assert.equal(final.army,672);assert.equal(final.deployed,626);
assert.ok(Object.values(finalStock).every(x=>Number.isFinite(x)&&x>=0));
const finalReload=environment({rts_save:finalText});assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('armyCount()'),final.army);
assert.equal(finalReload.run('S.items.soulStone'),final.stone);
assert.equal(finalReload.run('S.killValues.soulRealm'),final.alert);
if(paidStar)assert.deepEqual(finalReload.run('S.soulRanks.star_trooper'),{rank:0,stars:1});
const finalFile=data+'p335-soul-daily-cliff-save.json';
fs.writeFileSync(path.join(root,finalFile),finalText,'utf8');
const reportFile=data+'p335-soul-daily-cliff.json';
const report={batch:'P335',kind:'cross local day by online tick, real nine-slot refresh, lower-tier battles/recovery and conditional deployed-unit soul-star payment',
  sourceFile,sourceSha256:sha(sourceText),rosterFile,rosterSha256:sha(rosterText),
  rngStart:previous.eliteCheckpoint.state.rng,unit:'simulated online seconds, actual resource stocks, soldiers and soul stones',
  initial,initialStock,originalDay,dayWait,refresh,refreshed,refreshedStock,rounds,alert7050Checkpoint,terminalRestoration,
  preStar,preStarStock,preStarFile,preStarSha256:sha(preStarText),paidStar,final,finalStock,seconds,phases,minFood,
  actualTraining:run('({...__actualTraining})'),maxBattles,finalFile,finalSha256:sha(finalText),
  limits:['Source is a historical selected paid ancestor, not a natural player sample.',
    'The harness uses its local calendar and online tick; this does not validate offline or Android rollover.',
    'Stops at 100 stones, exhaustion of current elite slots or 20 battles; RNG is never reset and each prebattle roster is truly replenished.']};
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(sourceText));
assert.equal(sha(fs.readFileSync(path.join(root,rosterFile),'utf8')),sha(rosterText));
console.log(JSON.stringify({initial,dayWait,refresh,rounds:rounds.map(({restoration:r,battle:b})=>({slot:b.slot,trained:Object.values(r.losses).reduce((a,c)=>a+c,0),paid:r.actual,seconds:r.seconds,result:b.result,casualties:r.after.army-b.after.army,stone:b.after.stone,alert:b.after.alert,enemyHp:b.enemyHp})),
  terminalRestoration:terminalRestoration&&{trained:Object.values(terminalRestoration.losses).reduce((a,c)=>a+c,0),paid:terminalRestoration.actual,seconds:terminalRestoration.seconds},
  alert7050Checkpoint,preStar,paidStar,final,seconds,phases,minFood,actualTraining:report.actualTraining,reportFile,finalFile,finalSha256:report.finalSha256},null,2));
