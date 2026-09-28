'use strict';
// Two paid core returns, two full replenishments, then a paid nano-armor upgrade.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p314-crystal-alert5000-energy5-full-roster-paid-save.json';
const targetName='p311-crystal-alert5000-recovered-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),targetRaw=fs.readFileSync(path.join(data,targetName),'utf8');
assert.equal(sha(raw),'9c07b789517ba6b29ffe0fa7d2e164cdccff2a5037e1aab7b7504e7e5aa4332e');
assert.equal(sha(targetRaw),'cd8f150a7400007094c400deebfc338a82c5f5b9d255ac9c50ebb3dfc1b507a9');
const original=JSON.parse(raw),target=JSON.parse(targetRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
const e=environment({rts_save:raw}),r=e.run;
assert.equal(r('loadSaveAndApply().status'),'ok');
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${original.ts}+(S.tick-${original.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=315;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
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
const snap=()=>r('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,coreAlert:S.killValues.godSlaughter,crystalAlert:S.killValues.godRevival,nanoLevel:S.weaponForge.nanoArmor.level,nanoProgress:S.weaponForge.nanoArmor.progress,electroDef:weaponDefense(\'electro_trooper\'),medal:S.res.medal,food:S.res.food,coal:S.res.coal,stone:S.res.stone,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,marketCycles:S.marketSpecial.cycles,marketClock:S.marketSpecial.clockSec})');
const initial=snap();assert.equal(initial.army,671);assert.equal(initial.deployed,626);
assert.equal(initial.core,33);assert.equal(initial.nanoLevel,10);assert.equal(initial.coreAlert,5000);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={};
function val(k){return r(`S.res.${k}`)}
function cap(k){return r(`resCap('${k}')`)}
function assign(resource){
  for(const[key,count]of Object.entries(r('({...S.popAlloc})')))if(count>0)assert.equal(r(`setPopAlloc('${key}',0)`)?.ok,true,key);
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
function marketCleanse(cycle){
  const before=snap();
  r(`__rng=${291+cycle}`);
  let waitSeconds=0,refreshes=0,marketMinFood=before.food;
  while(r('S.marketSpecial.offers.domainCleanser')<1&&waitSeconds<300000){
    const moved=r('offlineAdvanceSec(1200,1)');assert.equal(moved.elapsed,1200);
    waitSeconds+=1200;refreshes++;
    marketMinFood=Math.min(marketMinFood,val('food'));
    assert.ok(marketMinFood>0,'market food depleted');
  }
  assert.ok(r('S.marketSpecial.offers.domainCleanser')>=1,'no cleanser offer');
  const bought=r("buyMarketSpecial('domainCleanser')");assert.equal(bought?.ok,true,JSON.stringify(bought));
  const used=r("useDomainCleanser('medal')");assert.equal(used?.ok,true,JSON.stringify(used));
  const after=snap();assert.equal(after.coreAlert,4900);assert.equal(after.blood,before.blood-3);
  assert.equal(after.cleanser,before.cleanser);
  return{marketSeed:291+cycle,waitSeconds,refreshes,marketMinFood,before,bought,used,after};
}
function fightCore(cycle){
  const before=snap();assert.equal(before.coreAlert,4900);assert.equal(before.deployed,626);
  r('__rng=89');
  r("openMaterialDomain('medal')");assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'core battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=snap();r('exitBattle()');
  assert.equal(result,'win',`core cycle ${cycle} ${JSON.stringify({enemy,after})}`);
  assert.equal(after.core,before.core+58);assert.equal(after.blood,before.blood+3);
  assert.equal(after.coreAlert,5000);assert.equal(after.medal,before.medal+2352);
  assert.equal(r('save().ok'),true);
  const name=`p315-core-cycle${cycle}-win-save.json`,saveText=e.store.get('rts_save');
  const reload=environment({rts_save:saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  fs.writeFileSync(path.join(data,name),saveText);
  return{seed:89,enemy,callbacks,result,before,after,loss:before.army-after.army,save:name,sha256:sha(saveText)};
}
function replenish(cycle){
  const before=snap(),startPaid=r('({...__actualTraining})');
  r("clrForm('expedition')");assert.equal(r('formSoldierCount()'),0);
  const losses={},paidTraining={},timeBefore=onlineSeconds;
  for(const[unit,wanted]of Object.entries(targetByType)){
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
  const after=snap(),actual=r('({...__actualTraining})');
  assert.equal(after.army,671);assert.equal(after.deployed,626);
  assert.equal(after.core,before.core);assert.equal(after.coreAlert,5000);
  assert.equal(Object.values(losses).reduce((a,b)=>a+b,0),671-before.army);
  for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-((actual[key]||0)-(startPaid[key]||0)))<1e-6,key+' paid');
  assert.equal(r('save().ok'),true);
  const name=`p315-core-cycle${cycle}-recovered-save.json`,saveText=e.store.get('rts_save');
  const reload=environment({rts_save:saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('armyCount()'),671);assert.equal(reload.run('formSoldierCount()'),626);
  fs.writeFileSync(path.join(data,name),saveText);
  return{before,after,losses,paidTraining,actualTraining:Object.fromEntries(Object.entries(paidTraining).map(([key])=>[key,(actual[key]||0)-(startPaid[key]||0)])),onlineSeconds:onlineSeconds-timeBefore,save:name,sha256:sha(saveText)};
}
const cycles=[];
for(let cycle=1;cycle<=2;cycle++){
  const market=marketCleanse(cycle),fight=fightCore(cycle),refill=replenish(cycle);
  cycles.push({cycle,market,fight,refill});
}
const preForge=snap();assert.equal(preForge.core,149);assert.equal(preForge.nanoLevel,10);
const forgeSteps=r("weaponForgeSteps('nanoArmor')"),forgeCost=r("weaponForgeStepCost('nanoArmor')");
assert.equal(forgeSteps,30);assert.equal(forgeCost.godCore,4);
for(let i=0;i<forgeSteps;i++){
  const result=r("forgeWeapon('nanoArmor')");assert.equal(result?.ok,true,`nano step ${i+1}: ${JSON.stringify(result)}`);
}
const final=snap();assert.equal(final.core,29);assert.equal(final.nanoLevel,11);
assert.equal(final.nanoProgress,0);assert.equal(final.electroDef,preForge.electroDef+5);
assert.equal(final.army,671);assert.equal(final.deployed,626);
assert.equal(r('save().ok'),true);
const finalText=e.store.get('rts_save'),finalName='p315-crystal-alert5000-nano11-full-roster-paid-save.json';
const finalReload=environment({rts_save:finalText});assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('S.weaponForge.nanoArmor.level'),11);
assert.equal(finalReload.run('armyCount()'),671);
fs.writeFileSync(path.join(data,finalName),finalText);
function probeBattle(domain,seed){
  const trial=environment({rts_save:finalText}),run=trial.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const saved=JSON.parse(finalText);
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
  assert.ok(callbacks<3000,'probe callbacks');
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,crystal:S.items.godCrystal,enemyHp:B.enemyUnits[0].hp})');
  run('exitBattle()');return{domain,seed,enemy,result,after,callbacks};
}
const trials=[];
for(let seed=1;seed<=256;seed++)trials.push(probeBattle('godCrystal',seed));
for(let seed=1;seed<=128;seed++)trials.push(probeBattle('medal',seed));
const byDomain=['godCrystal','medal'].map(domain=>{
  const rows=trials.filter(x=>x.domain===domain);
  return{domain,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length,
    minArmy:Math.min(...rows.map(x=>x.after.army)),maxArmy:Math.max(...rows.map(x=>x.after.army))};
});
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,targetName),'utf8')),sha(targetRaw));
const report={batch:'P315',kind:'two paid market/core/replenishment cycles and paid nano-armor 11',
  unit:'resource units, soldier counts, simulated online seconds and ratio-1 offline market seconds; fixed streams are not player odds',
  source,sourceSha256:sha(raw),formationSource:targetName,formationSourceSha256:sha(targetRaw),
  initial,cycles,onlineSeconds,allocationSeconds,minFood,preForge,forgeSteps,forgeCost,final,
  finalSave:finalName,finalSaveSha256:sha(finalText),byDomain,trials,
  limitations:['Market RNG seeds and battle seed 89 are selected fixed streams, not a natural continuous player run.',
    'The 384 final battles branch independently from the paid safe save; none of their losses overwrites it.',
    'Online and ratio-1 offline production seconds exclude operation and animation wall time.']};
const output='p315-crystal-alert5000-nano11-paid.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,cycles:cycles.map(x=>({cycle:x.cycle,market:{waitSeconds:x.market.waitSeconds,refreshes:x.market.refreshes,marketMinFood:x.market.marketMinFood,before:x.market.before,after:x.market.after},fight:x.fight,refill:x.refill})),onlineSeconds,minFood,preForge,forgeSteps,forgeCost,final,finalSave:finalName,finalSaveSha256:report.finalSaveSha256,byDomain,report:output},null,2));
