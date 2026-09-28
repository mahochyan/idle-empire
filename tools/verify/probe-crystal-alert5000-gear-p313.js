'use strict';
// Paid alternative forge upgrades from the same recovered alert-5000 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p311-crystal-alert5000-recovered-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'cd8f150a7400007094c400deebfc338a82c5f5b9d255ac9c50ebb3dfc1b507a9');
const original=JSON.parse(raw);
const formationReportName='p312-crystal-alert5000-formation.json';
const formationReportText=fs.readFileSync(path.join(data,formationReportName),'utf8');
assert.equal(sha(formationReportText),'3b3f271a756d91ddab44b59fd448dc2ab036b4ce89452654945e5a6322af1b2b');
const formationReport=JSON.parse(formationReportText);
const baseline=formationReport.trials.filter(x=>x.variant==='original');
assert.equal(baseline.length,256);
function setup(r,seed,ts,tick){
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${ts}+(S.tick-${tick})*1000}};
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
}
function prepare(key){
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  setup(r,313,original.ts,original.tick);
  const before=r("({core:S.items.godCore,steel:S.res.steel,atk:weaponAttack('armored_trooper'),level:S.weaponForge['"+key+"'].level,progress:S.weaponForge['"+key+"'].progress,army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.godRevival})");
  assert.equal(before.core,47);assert.equal(before.steel,50599);assert.equal(before.level,1);assert.equal(before.progress,0);
  const steps=r(`weaponForgeSteps('${key}')`),cost=r(`weaponForgeStepCost('${key}')`);
  assert.equal(steps,12);assert.equal(cost.godCore,2);
  for(let i=0;i<steps;i++){
    const result=r(`forgeWeapon('${key}')`);
    assert.equal(result?.ok,true,`${key} step ${i+1}: ${JSON.stringify(result)}`);
  }
  const after=r("({core:S.items.godCore,steel:S.res.steel,atk:weaponAttack('armored_trooper'),level:S.weaponForge['"+key+"'].level,progress:S.weaponForge['"+key+"'].progress,army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.godRevival})");
  assert.equal(after.core,before.core-steps*cost.godCore);
  assert.equal(after.steel,before.steel-steps*cost.steel);
  assert.equal(after.level,2);assert.equal(after.progress,0);
  assert.equal(after.atk,before.atk+1);
  assert.equal(after.army,before.army);assert.equal(after.deployed,before.deployed);assert.equal(after.alert,5000);
  const saveText=e.store.get('rts_save');
  const reload=environment({rts_save:saveText});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run(`S.weaponForge.${key}.level`),2);
  assert.equal(reload.run('S.items.godCore'),after.core);
  assert.equal(reload.run('S.res.steel'),after.steel);
  const saveName=`p313-crystal-alert5000-${key}2-paid-save.json`;
  fs.writeFileSync(path.join(data,saveName),saveText);
  return{key,steps,cost,before,after,saveName,saveSha256:sha(saveText),saveText};
}
function battle(candidate,seed,capture=false,domain='godCrystal',conditionAlert=null,beforeBattle=null){
  const e=environment({rts_save:candidate.saveText}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  const saved=JSON.parse(candidate.saveText);
  setup(r,seed,saved.ts,saved.tick);
  if(conditionAlert!==null){
    assert.equal(domain,'medal');
    r(`S.killValues.godSlaughter=${conditionAlert}`); // Isolated condition only: no purchase or save.
  }
  const preparation=beforeBattle?beforeBattle(r):null;
  r(`openMaterialDomain('${domain}')`);assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter,crystal:S.items.godCrystal,core:S.items.godCore,medal:S.res.medal,blood:S.items.sacredBlood,enemyHp:B.enemyUnits[0].hp})');
  r('exitBattle()');
  return{key:candidate.key,domain,seed,conditionAlert,preparation,enemy,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}:{} )};
}
const candidates=['gatling','mortar'].map(prepare);
const trials=[];
for(const candidate of candidates)for(let seed=1;seed<=256;seed++)trials.push(battle(candidate,seed));
const byGear=candidates.map(c=>{
  const rows=trials.filter(x=>x.key===c.key);
  let better=0,worse=0,tied=0;
  for(let i=0;i<rows.length;i++){
    assert.equal(rows[i].seed,baseline[i].seed);
    const delta=rows[i].after.enemyHp-baseline[i].after.enemyHp;
    if(delta<0)better++;else if(delta>0)worse++;else tied++;
  }
  return{key:c.key,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length,
    minArmy:Math.min(...rows.map(x=>x.after.army)),maxArmy:Math.max(...rows.map(x=>x.after.army)),
    versusOriginal:{better,worse,tied}};
});
const wins=trials.filter(x=>x.result==='win');
let selectedWin=null;
if(wins.length){
  const first=wins[0],candidate=candidates.find(x=>x.key===first.key),paid=battle(candidate,first.seed,true);
  assert.equal(paid.result,'win');assert.ok(paid.after.crystal>original.items.godCrystal);
  const name=`p313-crystal-alert5000-${first.key}2-win-save.json`;
  const reload=environment({rts_save:paid.saveText});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  fs.writeFileSync(path.join(data,name),paid.saveText);
  selectedWin={gear:first.key,seed:first.seed,after:paid.after,save:name,sha256:sha(paid.saveText)};
}
const coreCandidates=[{key:'original',saveText:raw},candidates.find(x=>x.key==='gatling')];
const coreTrials=[];
for(const candidate of coreCandidates)for(let seed=1;seed<=128;seed++)coreTrials.push(battle(candidate,seed,false,'medal'));
const conditionalCore4900=[];
for(const candidate of coreCandidates)for(let seed=1;seed<=128;seed++)conditionalCore4900.push(battle(candidate,seed,false,'medal',4900));
const byCoreGear=coreCandidates.map(candidate=>{
  const rows=coreTrials.filter(x=>x.key===candidate.key);
  return{key:candidate.key,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length,
    minArmy:Math.min(...rows.map(x=>x.after.army)),maxArmy:Math.max(...rows.map(x=>x.after.army))};
});
const conditionalCoreSummary=coreCandidates.map(candidate=>{
  const rows=conditionalCore4900.filter(x=>x.key===candidate.key);
  return{key:candidate.key,conditionAlert:4900,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length};
});
let selectedCoreWin=null;
const coreWins=coreTrials.filter(x=>x.result==='win');
if(coreWins.length){
  const first=coreWins[0],candidate=coreCandidates.find(x=>x.key===first.key),paid=battle(candidate,first.seed,true,'medal');
  assert.equal(paid.result,'win');
  assert.ok(paid.after.core>JSON.parse(candidate.saveText).items.godCore);
  const name=`p313-core-alert5000-${first.key}-win-save.json`;
  const reload=environment({rts_save:paid.saveText});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  fs.writeFileSync(path.join(data,name),paid.saveText);
  selectedCoreWin={gear:first.key,seed:first.seed,after:paid.after,save:name,sha256:sha(paid.saveText)};
}
function buyAndUseCoreCleanser(r){
  r('__rng=291');
  const before=r('({blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,alert:S.killValues.godSlaughter,offers:S.marketSpecial.offers.domainCleanser,cycles:S.marketSpecial.cycles,food:S.res.food,coal:S.res.coal})');
  assert.equal(before.alert,5000);assert.equal(before.cleanser,0);
  let marketSeconds=0,refreshes=0,minFood=before.food;
  while(r('S.marketSpecial.offers.domainCleanser')<1&&marketSeconds<300000){
    const moved=r('offlineAdvanceSec(1200,1)');assert.equal(moved.elapsed,1200);
    marketSeconds+=1200;refreshes++;
    minFood=Math.min(minFood,r('S.res.food'));
    assert.ok(minFood>0,'food depleted');
  }
  assert.ok(r('S.marketSpecial.offers.domainCleanser')>=1,'no paid market offer');
  const bought=r("buyMarketSpecial('domainCleanser')");assert.equal(bought?.ok,true,JSON.stringify(bought));
  const cleansed=r("useDomainCleanser('medal')");assert.equal(cleansed?.ok,true,JSON.stringify(cleansed));
  const after=r('({blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,alert:S.killValues.godSlaughter,offers:S.marketSpecial.offers.domainCleanser,cycles:S.marketSpecial.cycles,food:S.res.food,coal:S.res.coal})');
  assert.equal(after.alert,4900);assert.equal(after.blood,before.blood-3);
  assert.equal(after.cleanser,before.cleanser);
  r('__rng=89');
  return{marketSeconds,refreshes,minFood,before,bought,cleansed,after};
}
const paidCoreCleanse=battle(coreCandidates[0],89,true,'medal',null,buyAndUseCoreCleanser);
assert.equal(paidCoreCleanse.result,'win');
assert.equal(paidCoreCleanse.after.core,original.items.godCore+58);
assert.equal(paidCoreCleanse.after.blood,original.items.sacredBlood);
assert.equal(paidCoreCleanse.after.coreAlert,5000);
assert.equal(paidCoreCleanse.after.medal,original.res.medal+2352);
assert.equal(paidCoreCleanse.after.army,460);
const paidCoreCleanseName='p313-core-alert5000-cleanse-win-save.json';
const paidCoreReload=environment({rts_save:paidCoreCleanse.saveText});
assert.equal(paidCoreReload.run('loadSaveAndApply().status'),'ok');
assert.equal(paidCoreReload.run('S.items.godCore'),paidCoreCleanse.after.core);
assert.equal(paidCoreReload.run('S.killValues.godSlaughter'),5000);
fs.writeFileSync(path.join(data,paidCoreCleanseName),paidCoreCleanse.saveText);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,formationReportName),'utf8')),sha(formationReportText));
const report={batch:'P313',kind:'two alternative real paid weapon forges from the same full-roster alert-5000 save',
  source,sourceSha256:sha(raw),baselineReport:formationReportName,baselineSha256:sha(formationReportText),
  unit:'material units, soldier counts and battle HP; 256 fixed independent seeds per gear branch are not player win odds',
  baseline:{tested:256,wins:baseline.filter(x=>x.result==='win').length,
    meanEnemyHp:baseline.reduce((sum,x)=>sum+x.after.enemyHp,0)/baseline.length},
  candidates:candidates.map(({saveText,...rest})=>rest),byGear,
  trials:trials.map(({key,domain,seed,enemy,result,after,callbacks})=>({key,domain,seed,enemy,result,after,callbacks})),selectedWin,
  byCoreGear,coreTrials:coreTrials.map(({key,domain,seed,enemy,result,after,callbacks})=>({key,domain,seed,enemy,result,after,callbacks})),selectedCoreWin,
  conditionalCoreSummary,conditionalCore4900:conditionalCore4900.map(({key,domain,seed,conditionAlert,enemy,result,after,callbacks})=>({key,domain,seed,conditionAlert,enemy,result,after,callbacks})),
  paidCoreCleanse:{gear:'original',seed:89,preparation:paidCoreCleanse.preparation,enemy:paidCoreCleanse.enemy,
    after:paidCoreCleanse.after,callbacks:paidCoreCleanse.callbacks,save:paidCoreCleanseName,sha256:sha(paidCoreCleanse.saveText)},
  limitations:['Each gear branch spends the same source inventory independently; they are not sequential purchases.',
    'Fixed RNG streams are independent trial branches, not a natural continuous player run.',
    'Conditional 4900 core trials set a kill-value inside isolated VM without paying for cleanser, and are not a playable route.',
    'The paid market stream 291 and battle stream 89 were selected fixed streams, not a natural continuous RNG or a typical market wait.',
    'No production time was required for the paid one-level upgrades because the source stock already covered each alternative.']};
const output='p313-crystal-alert5000-gear.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,candidates:report.candidates,baseline:report.baseline,byGear,selectedWin,byCoreGear,selectedCoreWin,conditionalCoreSummary,paidCoreCleanse:report.paidCoreCleanse,report:output},null,2));
