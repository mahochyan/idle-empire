'use strict';
// From P304's paid save: repeat the existing crystal-material battle with real cleanser purchases,
// troop replenishment and production, then pay steam knowledge 16->22. Fixed RNG is an existence route.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p304-electric-knowledge17-guardian-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'596abcd27b71e8c90f1bac53b9fe5bca1b7a1b30f4c9c085d7b69fe3562eda99');
const rosterSource='p285-awakening-stage6-full-roster-paid-save.json';
const rosterRaw=fs.readFileSync(path.join(data,rosterSource),'utf8');
assert.equal(sha(rosterRaw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const original=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const target=JSON.parse(rosterRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${original.ts}+(S.tick-${original.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__actualTraining={};
  const __originalPayTrainingCost=payTrainingCost;
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
const rng=seed=>run(`globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
const snapshot=()=>run("({tick:S.tick,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,crystal:S.items.godCrystal,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,crystalAlert:S.killValues.godRevival,steamKnowledge:S.eraStorage.steamKnowledge,army:armyCount(),deployed:formSoldierCount(),food:S.res.food,steel:S.res.steel,iron:S.res.iron,copper:S.res.copper})");
const initial=snapshot();
assert.equal(initial.army,620);assert.equal(initial.deployed,575);assert.equal(initial.crystalAlert,4600);
assert.equal(initial.crystal,54);assert.equal(initial.steamKnowledge,16);assert.equal(initial.techCap,166765547);
function fight(domain,seed){
  rng(seed);run(`openMaterialDomain('${domain}')`);assert.equal(run('S.battleActive'),true,domain+' opens');
  const enemy=run("({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,domain+' callbacks');
  const result=run("document.getElementById('battle-result').className");
  assert.equal(result,'win',domain+' fixed seed '+seed);
  const after=snapshot();run('exitBattle()');
  return{domain,seed,enemy,callbacks,after};
}
let seconds=0,minFood=initial.food;
const phases={market:0,food:0,stone:0,coal:0,copper:0,iron:0,steel:0,tech:0,training:0};
let phase='market';
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;phases[phase]+=result.n;minFood=Math.min(minFood,result.min);
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
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){if(val(resource)>=targetValue)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue)}
function replenish(){
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
    phase='training';assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000).done,unit+' training');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' form');
  });
  assert.equal(run('formSoldierCount()'),626);
  return{losses,paidTraining,after:snapshot()};
}
const cycles=[];
for(let cycle=1;cycle<=20;cycle++){
  const before=snapshot(),recovery=replenish();
  let marketSeconds=0,bought=null,cleansed=null;
  if(cycle>1){
    assert.ok(run('S.items.sacredBlood')>=3,'blood cost before cleanser');
    rng(291);phase='market';
    while(run('S.marketSpecial.offers.domainCleanser')<1&&marketSeconds<300000){
      const moved=run('offlineAdvanceSec(1200,1)');assert.equal(moved.elapsed,1200);
      marketSeconds+=1200;seconds+=1200;phases.market+=1200;minFood=Math.min(minFood,val('food'));
    }
    assert.ok(run('S.marketSpecial.offers.domainCleanser')>=1,'market cleanser offer');
    bought=run("buyMarketSpecial('domainCleanser')");assert.equal(bought?.ok,true,JSON.stringify(bought));
    assert.equal(run('S.items.domainCleanser'),1);
    cleansed=run("useDomainCleanser('godCrystal')");assert.equal(cleansed?.ok,true,JSON.stringify(cleansed));
    assert.equal(cleansed.alert,4600);
  }
  const beforeFight=snapshot(),crystal=fight('godCrystal',4);
  assert.equal(crystal.after.crystal-beforeFight.crystal,56);
  assert.equal(crystal.after.blood-beforeFight.blood,3,'crystal blood refund funds next cleanser');
  assert.equal(crystal.after.crystalAlert,4700);
  cycles.push({cycle,before,recovery,marketSeconds,bought,cleansed,beforeFight,crystal,after:snapshot()});
  console.log(`battle ${cycle}/20: crystal=${crystal.after.crystal} army=${crystal.after.army} marketSeconds=${marketSeconds}`);
}
assert.ok(run('S.items.godCrystal')>=1170,'crystal for steam knowledge 22');
assert.equal(run('S.eraStorage.steamKnowledge'),16);
assign('tech');
assert.ok(advanceUntil('S.res.tech>=35100000',15000).done,'knowledge production');
const upgrades=[];
for(let level=17;level<=22;level++){
  const cost=run("eraStorageCost('steamKnowledge')"),before=snapshot();
  const upgraded=run("upgradeEraStorage('steamKnowledge')");
  assert.equal(upgraded?.ok,true,JSON.stringify(upgraded));
  assert.equal(run('S.eraStorage.steamKnowledge'),level);
  assert.equal(before.tech-run('S.res.tech'),cost.tech);
  assert.equal(before.crystal-run('S.items.godCrystal'),cost.godCrystal);
  upgrades.push({level,cost,before,after:snapshot()});
}
assert.ok(run("resCap('tech')")>=200000000);
assert.equal(run('save().ok'),true);
const terminal=snapshot(),out=e.store.get('rts_save'),reload=environment({rts_save:out});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.eraStorage.steamKnowledge'),22);
assert.equal(reload.run('S.items.godCrystal'),terminal.crystal);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,rosterSource),'utf8')),sha(rosterRaw));
const totals={battleLoss:0,recovered:0,trainingCost:{},marketSeconds:phases.market,
  boughtCleansers:cycles.filter(x=>x.bought?.ok).length,crystalEarned:0,medalEarned:terminal.medal-initial.medal,
  upgradeCost:{tech:0,godCrystal:0}};
for(const cycle of cycles){
  totals.battleLoss+=cycle.beforeFight.army-cycle.crystal.after.army;
  totals.crystalEarned+=cycle.crystal.after.crystal-cycle.beforeFight.crystal;
  for(const n of Object.values(cycle.recovery.losses))totals.recovered+=n;
  for(const [key,n] of Object.entries(cycle.recovery.paidTraining))totals.trainingCost[key]=(totals.trainingCost[key]||0)+n;
}
for(const step of upgrades){totals.upgradeCost.tech+=step.cost.tech;totals.upgradeCost.godCrystal+=step.cost.godCrystal}
assert.equal(totals.boughtCleansers,19);
assert.equal(totals.crystalEarned,1120);
assert.equal(totals.upgradeCost.tech,35100000);
assert.equal(totals.upgradeCost.godCrystal,1170);
assert.equal(terminal.crystal,initial.crystal+totals.crystalEarned-totals.upgradeCost.godCrystal);
assert.equal(totals.recovered,2160);
assert.equal(totals.battleLoss,2220);
const actualTraining=run('({...__actualTraining})');
for(const [key,amount] of Object.entries(totals.trainingCost))
  assert.ok(Math.abs(amount-actualTraining[key])<1e-6,`${key} actual training debit`);
assert.ok(minFood>0);
const saveFile='p306-steam-knowledge22-crystal-paid-save.json',reportFile='p306-steam-knowledge22-crystal-paid.json';
const report={batch:'P306',kind:'fixed deterministic paid crystal source and steam knowledge levels17-22',
  unit:'resource units, soldier counts, seconds; market uses offlineAdvanceSec(1200,1), all other production/training uses tick(); browser animation and player clicks excluded',
  source,sourceSha256:sha(raw),rosterSource,rosterSourceSha256:sha(rosterRaw),initial,cycles,upgrades,totals,actualTraining,terminal,
  simulatedSeconds:seconds,marketRatio1Seconds:phases.market,onlineTickSeconds:seconds-phases.market,phases,minFood,saveFile,saveSha256:sha(out)};
fs.writeFileSync(path.join(data,saveFile),out,'utf8');
fs.writeFileSync(path.join(data,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,cycles:cycles.map(x=>({cycle:x.cycle,
  marketSeconds:x.marketSeconds,crystalLoss:x.beforeFight.army-x.crystal.after.army,crystal:x.after.crystal,recovered:!!x.recovery})),
  upgrades:upgrades.map(x=>({level:x.level,cost:x.cost,cap:x.after.techCap})),totals,terminal,simulatedSeconds:seconds,marketRatio1Seconds:phases.market,
  onlineTickSeconds:seconds-phases.market,phases,minFood,saveFile,saveSha256:report.saveSha256},null,2));
