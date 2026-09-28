'use strict';
// Restore the actual P308 win losses, then test the next crystal alert without free cleanser.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p308-crystal-alert4700-win-save.json',rosterSource='p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),rosterRaw=fs.readFileSync(path.join(data,rosterSource),'utf8');
assert.equal(sha(raw),'5aea072197120aa347a7b80e0e7991c06fb5ccb8af64128aa2fe96154809bb65');
assert.equal(sha(rosterRaw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const original=JSON.parse(raw),target=JSON.parse(rosterRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${original.ts}+(S.tick-${original.tick})*1000}};
  globalThis.__productionRng=309;Math.random=()=>{let x=__productionRng;x^=x<<13;x^=x>>>17;x^=x<<5;__productionRng=x>>>0;return __productionRng/4294967296};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){
    const before=Object.fromEntries(trainingCostKeys(cost).map(key=>[key,S.res[key]]));
    const result=__originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const charged=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(charged-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+charged;
    }
    return result;
  };`);
const snap=()=>run("({tick:S.tick,alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,tech:S.res.tech,food:S.res.food,stone:S.res.stone,coal:S.res.coal,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})");
const initial=snap();
assert.equal(initial.alert,4800);assert.equal(initial.army,547);assert.equal(initial.deployed,502);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',resource='training'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=result.n;allocationSeconds[resource]=(allocationSeconds[resource]||0)+result.n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000,'false',resource).done,resource+' fill timeout');
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
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue);
}
run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
const losses={},paidTraining={};
for(const [unit,wanted] of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000,'false','training').done,unit+' training');
}
for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' form');
});
const recovered=snap();assert.equal(recovered.army,671);assert.equal(recovered.deployed,626);
assert.equal(recovered.alert,4800);assert.equal(recovered.crystal,initial.crystal);
assert.equal(recovered.medal,initial.medal);assert.equal(recovered.cleanser,initial.cleanser);
assert.equal(assertAmount(losses),124);assert.ok(minFood>0);
function assertAmount(object){return Object.values(object).reduce((a,b)=>a+b,0)}
const actualTraining=run('({...__actualTraining})');
for(const [key,amount] of Object.entries(paidTraining))assert.ok(Math.abs(amount-actualTraining[key])<1e-6,key+' actual training debit');
assert.equal(run('save().ok'),true);
const restoredRaw=e.store.get('rts_save'),restoredName='p309-crystal-alert4800-recovered-save.json';
const reload=environment({rts_save:restoredRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),626);assert.equal(reload.run('S.killValues.godRevival'),4800);
function battle(seed,alert=4800,captureSave=false){
  const trial=environment({rts_save:restoredRaw}),r=trial.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(restoredRaw).ts}+(S.tick-${recovered.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  if(alert!==4800)r(`S.killValues.godRevival=${alert}`); // conditional control only; no trial is saved
  r("openMaterialDomain('godCrystal')");assert.equal(r('S.battleActive'),true);
  const enemy=r("({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})");
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r("({alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood,enemyHp:B.enemyUnits[0].hp})");
  r('exitBattle()');
  return{seed,alert,enemy,callbacks,result,after,...(captureSave?{saveText:trial.store.get('rts_save')}:{} )};
}
const control=battle(10,4700),trials=[];
assert.equal(control.result,'win');
for(let seed=1;seed<=64;seed++)trials.push(battle(seed));
const wins=trials.filter(x=>x.result==='win');
assert.equal(wins.length,30);
let selected=null,wonName=null;
if(wins.length){
  const chosen=wins.reduce((best,x)=>x.after.army>best.after.army?x:best);
  assert.equal(chosen.seed,10);
  selected=battle(chosen.seed,4800,true);
  assert.equal(selected.result,'win');
  assert.equal(JSON.stringify(selected.after),JSON.stringify(chosen.after));
  assert.ok(typeof selected.saveText==='string');
  const wonSave=JSON.parse(selected.saveText);wonName='p309-crystal-alert4800-win-save.json';
  assert.equal(wonSave.killValues.godRevival,4900);
  assert.equal(wonSave.items.godCrystal,recovered.crystal+58);
  assert.equal(wonSave.res.medal,recovered.medal+2324);
  assert.equal(wonSave.items.sacredBlood,recovered.blood+3);
  assert.equal(wonSave.items.domainCleanser,recovered.cleanser);
  assert.equal(recovered.deployed-selected.after.deployed,125);
  const wonReload=environment({rts_save:selected.saveText});
  assert.equal(wonReload.run('loadSaveAndApply().status'),'ok');
  assert.equal(wonReload.run('armyCount()'),selected.after.army);
  assert.equal(wonReload.run('formSoldierCount()'),selected.after.deployed);
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,rosterSource),'utf8')),sha(rosterRaw));
fs.writeFileSync(path.join(data,restoredName),restoredRaw);
if(selected)fs.writeFileSync(path.join(data,wonName),selected.saveText);
const report={batch:'P309',kind:'real paid recovery from P308 win, then isolated real battle sensitivity at alert 4800',
  unit:'resource units, soldier counts, simulated online seconds; 64 fixed independent RNG seeds are not a player win-rate estimate',
  source,sourceSha256:sha(raw),rosterSource,rosterSourceSha256:sha(rosterRaw),productionSeed:309,initial,losses,paidTraining,actualTraining,onlineSeconds,allocationSeconds,minFood,recovered,
  restoredSave:restoredName,restoredSaveSha256:sha(restoredRaw),control,trials,winSeeds:wins.map(x=>x.seed),
  selectedPaidWin:selected?{seed:selected.seed,after:selected.after,callbacks:selected.callbacks,save:wonName,saveSha256:sha(selected.saveText)}:null,
  limitations:['Seed 10 at 4700 is a condition-only battle control, not a paid alert reduction.',
    'The 4800 trials share the paid recovered roster but branch independently; their wins cannot be chained.',
    'The selected seed, if any, was chosen after checking the 64 independent fixed streams; it does not estimate a natural player outcome.',
    'No market purchase, cleanser use or further research is performed in this batch.']};
const out='p309-crystal-alert4800-paid-recovery.json';
fs.writeFileSync(path.join(data,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({initial,losses,paidTraining,actualTraining,onlineSeconds,minFood,recovered,control,
  trialCount:trials.length,wins:wins.length,winSeeds:report.winSeeds,
  closestLosses:trials.filter(x=>x.result!=='win').sort((a,b)=>a.after.enemyHp-b.after.enemyHp).slice(0,5).map(x=>({seed:x.seed,enemyHp:x.after.enemyHp,army:x.after.army})),
  restoredSave:restoredName,restoredSaveSha256:report.restoredSaveSha256,selectedPaidWin:report.selectedPaidWin,report:out},null,2));
