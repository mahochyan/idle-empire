'use strict';
// Pay for energy armor 5 and replenish the full expedition after the paid core win.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p313-core-alert5000-cleanse-win-save.json',targetName='p311-crystal-alert5000-recovered-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),targetRaw=fs.readFileSync(path.join(data,targetName),'utf8');
assert.equal(sha(raw),'dd5af5af4420320306b67c8d430770ede9f0674bc4ea084e4fad796777bf6ae3');
assert.equal(sha(targetRaw),'cd8f150a7400007094c400deebfc338a82c5f5b9d255ac9c50ebb3dfc1b507a9');
const origin=JSON.parse(raw),target=JSON.parse(targetRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
const e=environment({rts_save:raw}),r=e.run;
assert.equal(r('loadSaveAndApply().status'),'ok');
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__productionRng=314;Math.random=()=>{let x=__productionRng;x^=x<<13;x^=x>>>17;x^=x<<5;__productionRng=x>>>0;return __productionRng/4294967296};
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
const snap=()=>r('({tick:S.tick,core:S.items.godCore,crystal:S.items.godCrystal,blood:S.items.sacredBlood,medal:S.res.medal,energyLevel:S.weaponForge.energyArmor.level,energyProgress:S.weaponForge.energyArmor.progress,electroDef:weaponDefense(\'electro_trooper\'),army:armyCount(),deployed:formSoldierCount(),crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter,food:S.res.food,stone:S.res.stone,coal:S.res.coal,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})');
const initial=snap();assert.equal(initial.core,105);assert.equal(initial.army,460);assert.equal(initial.deployed,415);
assert.equal(initial.energyLevel,4);assert.equal(initial.energyProgress,0);assert.equal(initial.coreAlert,5000);
const forgeSteps=r("weaponForgeSteps('energyArmor')"),forgeCost=r("weaponForgeStepCost('energyArmor')");
assert.equal(forgeSteps,18);assert.equal(forgeCost.godCore,4);
for(let i=0;i<forgeSteps;i++){
  const result=r("forgeWeapon('energyArmor')");
  assert.equal(result?.ok,true,`forge step ${i+1}: ${JSON.stringify(result)}`);
}
const forged=snap();assert.equal(forged.core,33);assert.equal(forged.energyLevel,5);
assert.equal(forged.energyProgress,0);assert.equal(forged.electroDef,initial.electroDef+5);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={};
function val(k){return r(`S.res.${k}`)}
function cap(k){return r(`resCap('${k}')`)}
function assign(resource){
  for(const [key,count] of Object.entries(r('({...S.popAlloc})')))if(count>0)assert.equal(r(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(r("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(r("setPopAlloc('food',100)")?.ok,true);assert.equal(r(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(r('popAllocTotal()'),1002);
  assert.ok(r("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',resource='training'){
  const result=r(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
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
r("clrForm('expedition')");assert.equal(r('formSoldierCount()'),0);
const losses={},paidTraining={};
for(const [unit,wanted]of Object.entries(targetByType)){
  const available=r(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;if(!short)continue;
  const cost=r(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  const queued=r(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000,'false','training').done,unit+' training');
}
for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(r(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  r(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(r(`S.formation.${row}[${slot}]?.type`),u.type,row+slot+' type');
  assert.equal(r(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' count');
});
const recovered=snap();assert.equal(recovered.army,671);assert.equal(recovered.deployed,626);
assert.equal(recovered.core,33);assert.equal(recovered.coreAlert,5000);assert.equal(recovered.crystalAlert,5000);
assert.equal(Object.values(losses).reduce((a,b)=>a+b,0),211);
const actualTraining=r('({...__actualTraining})');
for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-actualTraining[key])<1e-6,key+' training debit');
assert.equal(r('save().ok'),true);
const safeText=e.store.get('rts_save'),safeName='p314-crystal-alert5000-energy5-full-roster-paid-save.json';
const reload=environment({rts_save:safeText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.weaponForge.energyArmor.level'),5);assert.equal(reload.run('armyCount()'),671);
fs.writeFileSync(path.join(data,safeName),safeText);
function battle(domain,seed){
  const trial=environment({rts_save:safeText}),run=trial.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const saved=JSON.parse(safeText);
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${saved.ts}+(S.tick-${saved.tick})*1000}};
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
  run(`openMaterialDomain('${domain}')`);assert.equal(run('S.battleActive'),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),deployed:formSoldierCount(),crystal:S.items.godCrystal,core:S.items.godCore,medal:S.res.medal,blood:S.items.sacredBlood,crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter,enemyHp:B.enemyUnits[0].hp})');
  run('exitBattle()');
  return{domain,seed,enemy,result,after,callbacks};
}
const trials=[];
for(let seed=1;seed<=256;seed++)trials.push(battle('godCrystal',seed));
for(let seed=1;seed<=128;seed++)trials.push(battle('medal',seed));
const byDomain=['godCrystal','medal'].map(domain=>{
  const rows=trials.filter(x=>x.domain===domain);
  return{domain,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length,
    minArmy:Math.min(...rows.map(x=>x.after.army)),maxArmy:Math.max(...rows.map(x=>x.after.army))};
});
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,targetName),'utf8')),sha(targetRaw));
const report={batch:'P314',kind:'paid core-to-energy-armor upgrade and real replenishment after one core victory',
  unit:'resource units, soldier counts, simulated online seconds, battle HP; fixed seeds are not player win odds',
  source,sourceSha256:sha(raw),formationSource:targetName,formationSourceSha256:sha(targetRaw),
  productionSeed:314,initial,forgeSteps,forgeCost,forged,losses,paidTraining,actualTraining,
  onlineSeconds,allocationSeconds,minFood,recovered,safeSave:safeName,safeSaveSha256:sha(safeText),byDomain,trials,
  limitations:['This chain starts from P313 paid selected market and battle streams, not a natural continuous player run.',
    'The full-roster battle trials branch independently from one paid safe save; none of their losses is written over it.',
    'Simulated online seconds exclude operation and animation wall time.']};
const output='p314-crystal-alert5000-energy5-paid.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,forgeSteps,forgeCost,forged,losses,paidTraining,actualTraining,onlineSeconds,allocationSeconds,minFood,recovered,safeSave:safeName,safeSaveSha256:report.safeSaveSha256,byDomain,report:output},null,2));
