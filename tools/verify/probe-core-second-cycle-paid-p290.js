'use strict';
// Continue the P289 paid save through actual worker, training, market, battle and forge actions.
// The fixed market/battle RNG and ratio-1 production are development assumptions, not player timing.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p289-gold-market-core-win-paid-save.json';
const sourceRaw=fs.readFileSync(path.join(data,source),'utf8');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(hash(sourceRaw),'290390dc40699f98bf0422911a8142e65687007a28f95f02e67bd4f18ed1cf6f');
const targetRaw=fs.readFileSync(path.join(data,'p285-awakening-stage6-full-roster-paid-save.json'),'utf8');
assert.equal(hash(targetRaw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const target=JSON.parse(targetRaw).formation;
const e=environment({rts_save:sourceRaw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.items.godCore'),105);
assert.equal(run('formSoldierCount()'),353);
assert.equal(run('S.killValues.godSlaughter'),5000);
const originalWorkers=JSON.parse(run('JSON.stringify(S.popAlloc)'));
const startTick=run('S.tick'),startTs=JSON.parse(sourceRaw).ts;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${startTs}+(S.tick-${startTick})*1000}};
  globalThis.__marketSeed=290;Math.random=()=>{let x=__marketSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__marketSeed=x>>>0;return __marketSeed/4294967296}`);
let seconds=0,phase='none',minFood=run('S.res.food');
const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0,market:0};
const value=key=>run(`S.res.${key}`),cap=key=>run(`resCap('${key}')`);
function assign(resource){
  for(const [key,count] of Object.entries(JSON.parse(run('JSON.stringify(S.popAlloc)'))))
    if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key+' clear');
  assert.equal(run("setPopAlloc('food',100)")?.ok,true,'food allocation');
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true,resource+' allocation');
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;minFood=Math.min(minFood,result.min);phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');
  return result;
}
function fillBasic(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),`${resource} target ${needed} > cap ${cap(resource)}`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${needed}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),`${resource} target ${needed} > cap ${cap(resource)}`);
  let cycles=0;
  while(value(resource)<needed&&cycles++<100){
    if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&value('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=value(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${needed}`,5000,stop);
    assert.ok(value(resource)>before,resource+' stalled');
  }
  assert.ok(value(resource)>=needed,resource+' fill exhausted');
}
function fill(resource,needed){
  if(value(resource)>=needed)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,needed);
  else fillBasic(resource,needed);
}
const before={army:run('armyCount()'),deployed:run('formSoldierCount()'),core:run('S.items.godCore'),coin:value('goldCoin'),food:value('food'),market:JSON.parse(run('JSON.stringify(S.marketSpecial)'))};
run("clrForm('expedition')");
assert.equal(run('formSoldierCount()'),0);
const targetByType={};
for(const groups of Object.values(target))for(const group of groups)targetByType[group.type]=(targetByType[group.type]||0)+group.count;
const losses={},paidTraining={};
const resourceOrder={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
for(const [unit,wanted] of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;
  if(!short)continue;
  const cost=JSON.parse(run(`JSON.stringify(CFG.units.${unit}.cost)`));
  for(const [resource,perUnit] of Object.entries(cost).sort((a,b)=>(resourceOrder[a[0]]??9)-(resourceOrder[b[0]]??9))){
    const amount=perUnit*short;
    fill(resource,amount);
    paidTraining[resource]=(paidTraining[resource]||0)+amount;
  }
  const queued=run(`train('${unit}',${short})`);
  assert.equal(queued?.ok,true,unit+' queue '+JSON.stringify(queued));
  assert.equal(queued.qty,short);
  phase='training';
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,1000).done,unit+' training timed out');
}
for(const [row,groups] of Object.entries(target))groups.forEach((group,slot)=>{
  assert.ok(run(`poolAvail('${group.type}')`)>=group.count,row+slot+' reserve');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${group.type}';S._formModalQty=${group.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),group.count,row+slot+' formation');
});
assert.equal(Object.values(losses).reduce((sum,n)=>sum+n,0),273);
assert.equal(run('formSoldierCount()'),626);
assert.equal(run("expeditionCount('star_trooper')"),155);
const afterRefill={army:run('armyCount()'),deployed:run('formSoldierCount()'),seconds,minFood,res:JSON.parse(run('JSON.stringify(S.res)')),market:JSON.parse(run('JSON.stringify(S.marketSpecial)'))};
// Restore the P289 food/stone/coal/gold/coin staffing through player actions.
for(const [key,count] of Object.entries(JSON.parse(run('JSON.stringify(S.popAlloc)'))))
  if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key+' restore clear');
for(const [key,count] of Object.entries(originalWorkers))
  if(count>0)assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,key+' restore');
assert.deepEqual(JSON.parse(run('JSON.stringify(S.popAlloc)')),originalWorkers);
const marketStart=seconds,purchases=[];
let boughtBlood=0,boughtCleanser=0;
for(let block=0;block<5000&&boughtCleanser===0;block++){
  const offers=JSON.parse(run('JSON.stringify(S.marketSpecial.offers)'));
  if(offers.sacredBlood>0&&value('goldCoin')>=9999&&boughtBlood<3){
    const action=run("buyMarketSpecial('sacredBlood')");
    assert.equal(action?.ok,true,'blood purchase '+JSON.stringify(action));
    boughtBlood++;
    purchases.push({atSec:seconds,item:'sacredBlood',coin:value('goldCoin'),blood:run('S.items.sacredBlood')});
  }
  if(offers.domainCleanser>0&&run('S.items.sacredBlood')>=3){
    const action=run("buyMarketSpecial('domainCleanser')");
    assert.equal(action?.ok,true,'cleanser purchase '+JSON.stringify(action));
    boughtCleanser++;
    purchases.push({atSec:seconds,item:'domainCleanser',blood:run('S.items.sacredBlood')});
    break;
  }
  const result=run('offlineAdvanceSec(60,1)');
  assert.equal(result.elapsed,60,'market food clamp');
  seconds+=60;phases.market+=60;
  minFood=Math.min(minFood,value('food'));
  assert.ok(value('goldCoin')<=10000+1e-9);
}
assert.equal(boughtBlood,3,'three paid blood items');
assert.equal(boughtCleanser,1,'one paid second cleanser');
assert.equal(run('save().ok'),true);
const beforeSecondBattle={core:run('S.items.godCore'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godSlaughter'),cleanser:run('S.items.domainCleanser')};
const used=run("useDomainCleanser('medal')");
assert.equal(used?.ok,true);
assert.equal(used?.repeat,undefined);
assert.equal(used?.alert,4900);
const repeatedUse=run("useDomainCleanser('medal')");
assert.equal(repeatedUse?.repeat,true);
assert.equal(run('S.items.domainCleanser'),0);
assert.equal(run('S.killValues.godSlaughter'),4900);
run(`globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__battleSeed=1;Math.random=()=>{let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296};`);
run("openMaterialDomain('medal')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
const battle={result:run("document.getElementById('battle-result').className"),callbacks,
  after:{core:run('S.items.godCore'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godSlaughter'),cleanser:run('S.items.domainCleanser')}};
assert.equal(battle.result,'win','second core victory');
assert.equal(battle.after.core,163);
assert.equal(battle.after.alert,5000);
assert.equal(battle.after.cleanser,0);
const beforeForge={level:run('S.weaponForge.nanoArmor.level'),progress:run('S.weaponForge.nanoArmor.progress'),core:run('S.items.godCore'),steps:run("weaponForgeSteps('nanoArmor')"),stepCost:JSON.parse(run("JSON.stringify(weaponForgeStepCost('nanoArmor'))"))};
assert.equal(beforeForge.level,10);
assert.equal(beforeForge.steps,30);
assert.equal(beforeForge.stepCost.godCore,4);
for(let i=0;i<beforeForge.steps;i++)assert.equal(run("forgeWeapon('nanoArmor')")?.ok,true,'nano forge '+(i+1));
const afterForge={level:run('S.weaponForge.nanoArmor.level'),progress:run('S.weaponForge.nanoArmor.progress'),core:run('S.items.godCore')};
assert.equal(afterForge.level,11);
assert.equal(afterForge.core,43);
assert.equal(run('save().ok'),true);
const terminalSave=e.store.get('rts_save');
const reload=environment({rts_save:terminalSave});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.weaponForge.nanoArmor.level'),11);
assert.equal(reload.run('S.items.godCore'),43);
assert.equal(reload.run('S.killValues.godSlaughter'),5000);
assert.equal(hash(fs.readFileSync(path.join(data,source),'utf8')),hash(sourceRaw),'source mutated');
const savePath='p290-second-core-nano11-paid-save.json',reportPath='p290-second-core-nano11-paid-report.json';
const report={batch:'P290',kind:'paid replenishment, second weighted-market cleanser, real core battle and nano armor 11',
  source,sourceSha256:hash(sourceRaw),targetSha256:hash(targetRaw),unit:'simulated seconds and stock units',before,
  losses,paidTraining,refill:{...afterRefill,phases:{...phases,market:0}},market:{startSec:marketStart,seconds:seconds-marketStart,purchases,boughtBlood,boughtCleanser},
  seconds,minFood,beforeSecondBattle,used:{alert:used.alert,spent:used.spent,repeatWasIdempotent:repeatedUse.repeat},battle,beforeForge,afterForge,
  savePath,saveSha256:hash(terminalSave)};
fs.writeFileSync(path.join(data,savePath),terminalSave,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,losses,paidTraining,refillSeconds:marketStart,marketSeconds:report.market.seconds,
  purchases,battle,beforeForge,afterForge,seconds,minFood,savePath,saveSha256:report.saveSha256},null,2));
