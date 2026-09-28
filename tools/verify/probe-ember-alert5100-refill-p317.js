'use strict';
// Continue the actual P317 alert-5000 win: pay to restore the roster, then inspect the next cliff.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p317-electro20-godCrystal-alert5000-win-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
assert.equal(sha(raw),'f5085beb4722eed858e1eea4059c6a326c35286c189005b3c1af4c1dfac94a5a');
const rosterSource='p311-crystal-alert5000-recovered-save.json';
const rosterRaw=fs.readFileSync(path.join(data,rosterSource),'utf8');
assert.equal(sha(rosterRaw),'cd8f150a7400007094c400deebfc338a82c5f5b9d255ac9c50ebb3dfc1b507a9');
const origin=JSON.parse(raw),target=JSON.parse(rosterRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__rng=317;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){
    const before=Object.fromEntries(trainingCostKeys(cost).map(key=>[key,S.res[key]]));
    const result=__originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;
    }
    return result;
  };`);
const snap=()=>run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),ember:S.items.emberElixir,infusions:{...S.attackInfusions},crystal:S.items.godCrystal,crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter,medal:S.res.medal,food:S.res.food,coal:S.res.coal,stone:S.res.stone,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})');
const initial=snap();assert.equal(initial.army,460);assert.equal(initial.deployed,415);
assert.equal(initial.crystalAlert,5100);assert.equal(initial.ember,0);assert.equal(initial.infusions.electro_trooper,20);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[key,count]of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
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
for(const[unit,wanted]of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000,'false','training').done,unit+' training');
}
for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type,row+slot+' type');
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' count');
});
const final=snap(),actual=run('({...__actualTraining})');
assert.equal(Object.values(losses).reduce((a,b)=>a+b,0),671-initial.army);
assert.equal(final.army,671);assert.equal(final.deployed,626);
assert.equal(final.ember,0);assert.equal(final.infusions.electro_trooper,20);
assert.equal(final.crystalAlert,5100);assert.equal(final.coreAlert,5000);
for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-(actual[key]||0))<1e-6,key+' actual training debit');
assert.equal(run('save().ok'),true);
const finalText=e.store.get('rts_save');
const reload=environment({rts_save:finalText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),626);
const finalName='p317-electro20-crystal-alert5100-recovered-save.json';
fs.writeFileSync(path.join(data,finalName),finalText);
function fight(domain,seed){
  const trial=environment({rts_save:finalText}),r=trial.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(finalText).ts}}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  r(`openMaterialDomain('${domain}')`);assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),enemyHp:B.enemyUnits[0].hp,crystal:S.items.godCrystal,core:S.items.godCore,medal:S.res.medal,crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter})');
  r('exitBattle()');
  return{domain,seed,enemy,result,after,callbacks,...(result==='win'?{saveText:trial.store.get('rts_save')}:{})};
}
const trials=[];
for(let seed=1;seed<=256;seed++)trials.push(fight('godCrystal',seed));
for(let seed=1;seed<=128;seed++)trials.push(fight('medal',seed));
const byDomain=['godCrystal','medal'].map(domain=>{
  const rows=trials.filter(t=>t.domain===domain);
  return{domain,tested:rows.length,wins:rows.filter(t=>t.result==='win').length,
    minEnemyHp:Math.min(...rows.map(t=>t.after.enemyHp)),meanEnemyHp:rows.reduce((sum,t)=>sum+t.after.enemyHp,0)/rows.length,
    minRemainingArmy:Math.min(...rows.map(t=>t.after.army))};
});
const winners=trials.filter(t=>t.result==='win');
let selectedWin=null;
if(winners.length){
  const chosen=winners[0];
  assert.ok(chosen.saveText,'winning branch has a stored save');
  const loaded=environment({rts_save:chosen.saveText});assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  const name=`p317-electro20-${chosen.domain}-alert5100-win-save.json`;
  fs.writeFileSync(path.join(data,name),chosen.saveText);
  selectedWin={domain:chosen.domain,seed:chosen.seed,after:chosen.after,save:name,sha256:sha(chosen.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,rosterSource),'utf8')),sha(rosterRaw));
const report={batch:'P317',kind:'actual refill of 211 soldiers after the paid alert-5000 ember win, then independent next-alert trials',
  source,sourceSha256:sha(raw),rosterSource,rosterSourceSha256:sha(rosterRaw),initial,losses,paidTraining,actualTraining:actual,
  onlineSeconds,allocationSeconds,minFood,final,finalSave:finalName,finalSaveSha256:sha(finalText),byDomain,selectedWin,
  trials:trials.map(({domain,seed,enemy,result,after,callbacks})=>({domain,seed,enemy,result,after,callbacks})),
  limitations:['The 211-soldier refill uses chosen assignments and excludes player operation/animation wall time.',
    'Each next-alert battle branches from the same paid full-roster save; losses do not overwrite it.',
    'Fixed battle streams locate pressure points and are not population win-rate estimates.']};
const output='p317-ember-alert5100-refill.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,losses,paidTraining,onlineSeconds,minFood,final,finalSave:finalName,
  finalSaveSha256:report.finalSaveSha256,byDomain,selectedWin,report:output},null,2));
