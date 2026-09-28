'use strict';
// Restore the paid six-queue first-win roster, then test the next elite slot without resetting RNG.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p333-soul-six-queue-first-win-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),'28486c06b21b8deecd276365a45ad3de666b7908df3a6cc4334d6c00dfec8760');
const winReport=JSON.parse(fs.readFileSync(path.join(root,data+'p333-soul-six-queue-first-win.json'),'utf8'));
assert.equal(winReport.saveSha256,sha(raw));
assert.equal(winReport.after.rng,2142749435);
const rosterFile=data+'p329-soul-refreshed-save.json';
const rosterRaw=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterRaw),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const origin=JSON.parse(raw),target=JSON.parse(rosterRaw).formation,targetByType={};
for(const row of Object.values(target))for(const u of row)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  addLog=msg=>{S.log.push({time:'probe',msg:String(msg)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${winReport.after.rng};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;}return result};`);
const initial=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,
  alert:S.killValues.soulRealm,defStars:S.armsUp.star_trooper.def.stars,
  food:S.res.food,slots:[...S.soulRealmTeam.slots]})`);
const stock=()=>run("Object.fromEntries(['food','stone','coal','copper','iron','steel'].map(k=>[k,S.res[k]]))");
const initialStock=stock();
assert.equal(initial.army,637);assert.equal(initial.deployed,591);
assert.equal(initial.stone,47);assert.equal(initial.alert,6250);assert.equal(initial.defStars,0);
let seconds=0,minFood=initial.food;
const phases={wood:0,stone:0,coal:0,iron:0,steel:0,copper:0,gold:0,food:0,tech:0},paidTraining={},losses={};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food')assert.equal(run("setPopAlloc('food',999)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
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
run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
for(const[unit,wanted]of Object.entries(targetByType)){
  const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));losses[unit]=short;
  if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  assign('tech');assert.equal(run(`train('${unit}',${short})`)?.ok,true,unit+' training');
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','tech').done,unit+' training timeout');
}
assert.equal(Object.values(losses).reduce((a,b)=>a+b,0),35);
for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
});
for(const[k,n]of Object.entries(paidTraining))assert.ok(Math.abs(n-(run(`__actualTraining.${k}`)||0))<1e-6,k+' payment');
const recovered=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,
  alert:S.killValues.soulRealm,defStars:S.armsUp.star_trooper.def.stars,food:S.res.food,
  slots:[...S.soulRealmTeam.slots]})`);
const recoveredStock=stock();
assert.equal(recovered.army,672);assert.equal(recovered.deployed,626);
assert.equal(recovered.stone,47);assert.equal(recovered.alert,6250);assert.equal(recovered.defStars,0);
assert.equal(run('save().ok'),true);
const fullText=env.store.get('rts_save'),full=JSON.parse(fullText);
const fullFile=data+'p333-soul-six-queue-refilled-save.json';
fs.writeFileSync(path.join(root,fullFile),fullText,'utf8');
const reload=environment({rts_save:fullText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),672);assert.equal(reload.run('formSoldierCount()'),626);
const slot=full.soulRealmTeam.slots.indexOf(540399);assert.ok(slot>=0);
function battle(seed){
  const e=environment({rts_save:fullText}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${full.ts}+(S.tick-${full.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  assert.equal(r(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after=r(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
    stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}]})`);
  if(result==='win'){assert.equal(after.slot,null);assert.ok(after.stone>47);assert.equal(after.alert,6450)}
  else{assert.equal(after.slot,540399);assert.equal(after.alert,6250);assert.equal(after.stone,47)}
  r('exitBattle()');return{seed,enemy,result,after,callbacks};
}
const trials=[];for(let seed=1;seed<=32;seed++)trials.push(battle(seed));
// Resume the first P333 victory RNG through actual production/training and the next battle.
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};`);
const rngBefore=run('__rng');
assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
const continuousEnemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
let continuousCallbacks=0;
while(run('S.battleActive')&&continuousCallbacks++<3000)assert.equal(run('__step()'),true);
assert.ok(continuousCallbacks<3000);
const continuousResult=run("document.getElementById('battle-result').className");
assert.ok(['win','lose'].includes(continuousResult));
const continuousAfter=run(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
  stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}]})`);
if(continuousResult==='win'){assert.equal(continuousAfter.slot,null);assert.equal(continuousAfter.alert,6450);assert.ok(continuousAfter.stone>47)}
else{assert.equal(continuousAfter.slot,540399);assert.equal(continuousAfter.alert,6250);assert.equal(continuousAfter.stone,47)}
run('exitBattle()');
const continuousText=env.store.get('rts_save'),continuousFile=data+'p333-soul-six-queue-continuous-next-save.json';
const continuousReload=environment({rts_save:continuousText});
assert.equal(continuousReload.run('loadSaveAndApply().status'),'ok');
assert.equal(continuousReload.run('armyCount()'),continuousAfter.army);
fs.writeFileSync(path.join(root,continuousFile),continuousText,'utf8');
const continuous={rngBefore,rngEnd:run('__rng'),enemy:continuousEnemy,result:continuousResult,
  callbacks:continuousCallbacks,after:continuousAfter,file:continuousFile,sha256:sha(continuousText)};
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(root,rosterFile),'utf8')),sha(rosterRaw));
const report={batch:'P333',kind:'real paid recovery from first six-queue 6050 elite victory, then independent and continuous 6250 elite fights',
  sourceFile,sourceSha256:sha(raw),rosterFile,rosterSha256:sha(rosterRaw),
  unit:'simulated online seconds, training resources, soldiers, soul stones and combat HP',
  initial,recovered,initialStock,recoveredStock,seconds,phases,minFood,losses,paidTraining,actualTraining:run('({...__actualTraining})'),
  fullFile,fullSha256:sha(fullText),seedRule:'independent xorshift32 1..32 from refilled save',slot,trials,continuous,
  limits:['The first win continues an earlier selected paid P329 roster; the continuation keeps its RNG through production and training, but the ancestor is not a natural player stream.',
    '32 fixed seeds are a conditional pressure test, not a player win-rate estimate.']};
const reportFile=data+'p333-soul-six-queue-recovery.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),seconds,phases,minFood,losses,paidTraining,
  initialStock,recoveredStock,fullFile,fullSha256:sha(fullText),wins:trials.filter(x=>x.result==='win').length,
  minEnemyHp:Math.min(...trials.map(x=>x.after.enemyHp)),continuous,reportFile},null,2));
