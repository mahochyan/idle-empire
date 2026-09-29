'use strict';
// Continue one paid P397 quantum/L100 save through the real 5b armament gate.
// Only the probe clock and deterministic battle RNG are controlled.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sourceName='p397-quantum-stage100-paid-save.json';
const sourcePath=path.join(dataDir,sourceName);
const sourceRaw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(sourceRaw);
assert.equal(sourceHash,'ba8602a98d0d927c96cabb2d2074807c9b0ec46183aae4534e5486055c6125c4');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const source=JSON.parse(sourceRaw);
const env=environment({rts_save:sourceRaw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(env.store.get('rts_save_premigration'),sourceRaw);
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[__clockMs]))}
  static now(){return __clockMs}
};
globalThis.__timers=new Map();globalThis.__nextTimer=1;
globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
globalThis.clearTimeout=id=>__timers.delete(id);
globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
  __timers.delete(first[0]);first[1].fn();return true};
globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};`);
const rosterRaw=fs.readFileSync(path.join(dataDir,'p395-quantum-storage-medal-combined-paid-save.json'),'utf8');
assert.equal(sha(rosterRaw),'ecf78293015e46e05e70c38916a834c7063345f8ef11cb7ac29a337b0774b75e');
const targetFormation=JSON.parse(rosterRaw).formation;
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,bone:S.res.bone,
  cap:resCap('tech'),food:S.res.food,army:armyCount(),deployed:formSoldierCount(),
  level:S.eraStorage.quantumKnowledge,leaf:S.items.revivalLeaf,blood:S.items.sacredBlood,
  alert:S.killValues.godRebirth,science:scienceUnlocked('sci_astral_armament'),
  scroll:S.beastExchange.scrollUsed,stage100:S.defeated.includes(100)})`);
const report={baseline:'202dbda1d0e7085b84a5ad0b1dd653aa4fdd27d9',sourceName,sourceHash,
  runtimeHash,start:state(),clock:{offlineSeconds:0,onlineSeconds:0},medalTrades:[],
  offlineWindows:[],storagePayments:[],battles:[],cleanses:[],replenishments:[],failure:null};
assert.equal(report.start.cap,3017311895);
assert.equal(report.start.stage100,true);
assert.equal(report.start.science,false);
assert.equal(report.start.level,0);
const target=run('({...activeSciences().sci_astral_armament.cost})');
assert.equal(target.tech,5000000000);
assert.equal(target.medal,5000000);

// Exchange only existing, legitimately earned bones at the current exchange level.
const perTrade=run('beastBoneTradeReward()');
const trades=Math.ceil((target.medal-state().medal)/perTrade);
assert.ok(trades>0);
const medalBefore=state();
const medalPaid=run(`exchangeBonesForMedals(${trades})`);
assert.equal(medalPaid.ok,true,JSON.stringify(medalPaid));
assert.equal(state().medal,medalBefore.medal+trades*perTrade);
assert.equal(state().bone,medalBefore.bone-medalPaid.boneCost);
report.medalTrades.push({count:trades,perTrade,before:medalBefore,result:medalPaid,after:state()});

function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  if(resource!=='food')assert.equal(run(`setPopAlloc(${JSON.stringify(resource)},902)`)?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function fillKnowledge(amount){
  assert.ok(state().cap>=amount,`knowledge cap ${state().cap} < ${amount}`);
  if(state().tech>=amount)return;
  assign('tech');
  let windows=0;
  while(state().tech<amount&&windows++<80){
    const before=state(),rate=run("prodRate('tech')"),seconds=Math.min(28800,
      Math.max(120,Math.ceil((amount-before.tech)/(rate*run('CFG.offline.ratio')))+5));
    assert.ok(rate>0);
    run(`__clockMs+=${seconds*1000}`);
    const settled=run('settleOffline()');
    assert.equal(settled.ok,true,JSON.stringify(settled));
    assert.equal(settled.durationSec,seconds);
    assert.equal(settled.truncated,false,'offline food/time truncated');
    assert.ok(state().food>0,'offline food exhausted');
    report.clock.offlineSeconds+=seconds;
    report.offlineWindows.push({purpose:'knowledge',target:amount,seconds,before,after:state(),gains:settled.gains});
  }
  assert.ok(state().tech>=amount,'knowledge window bound');
}
function payNextStorage(){
  const cost=run("eraStorageCost('quantumKnowledge')");
  assert.ok(cost);
  if(cost.revivalLeaf&&state().leaf<cost.revivalLeaf)return false;
  fillKnowledge(cost.tech);
  const before=state(),payment=run("upgradeEraStorage('quantumKnowledge')");
  assert.equal(payment.ok,true,JSON.stringify(payment));
  const after=state();
  assert.equal(after.level,before.level+1);
  assert.equal(after.tech,before.tech-cost.tech);
  assert.equal(after.leaf,before.leaf-(cost.revivalLeaf||0));
  assert.ok(after.cap>before.cap);
  report.storagePayments.push({cost,before,payment,after});
  console.error(`P400 warehouse ${after.level}: cap ${after.cap}, leaf ${after.leaf}, simulated offline ${report.clock.offlineSeconds}s`);
  return true;
}
while(state().level<5)assert.equal(payNextStorage(),true);
assert.equal(state().cap,4525967842);
assert.equal(run("researchScience('sci_astral_armament')").reason,'insufficient-tech');

// Rebuild the proven P397 domain formation, paying production and queue costs.
function advanceUntil(expression,max,stop='false'){
  const out=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  report.clock.onlineSeconds+=out.n;
  run(`__clockMs+=${out.n*1000}`);
  assert.ok(out.min>0,'food depleted during recovery');
  return out;
}
const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap(${JSON.stringify(k)})`);
function fillBasic(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} amount exceeds cap`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,20000).done,resource+' timeout');
}
function fillProcessed(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} amount exceeds cap`);
  let cycles=0;
  while(val(resource)<amount&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)
      fillProcessed('iron',Math.min(1000000,cap('iron')));
    const prior=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+
      (resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${amount}`,10000,stop);
    assert.ok(val(resource)>prior,resource+' stalled');
  }
  assert.ok(val(resource)>=amount,resource+' exhausted');
}
function fill(resource,amount){
  if(val(resource)>=amount)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,amount);
  else fillBasic(resource,amount);
}
function replenish(){
  const before=state(),targetFormationCounts={};
  for(const groups of Object.values(targetFormation))for(const u of groups)
    targetFormationCounts[u.type]=(targetFormationCounts[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need=Object.fromEntries(Object.entries(targetFormationCounts).map(([type,wanted])=>
    [type,Math.max(0,wanted-run(`poolAvail(${JSON.stringify(type)})`))]));
  const trainingCost={},order={steel:0,iron:1,copper:2,gold:3,food:4,stone:5,wood:6};
  for(const [type,short]of Object.entries(need)){
    if(!short)continue;
    const cost=run(`({...CFG.units[${JSON.stringify(type)}].cost})`);
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=perUnit*short;fill(resource,amount);
      trainingCost[resource]=(trainingCost[resource]||0)+amount;
    }
    assert.equal(run(`train(${JSON.stringify(type)},${short})`)?.ok,true);
    assert.ok(advanceUntil(`poolAvail(${JSON.stringify(type)})>=${targetFormationCounts[type]}`,2000).done,
      type+' training timeout');
  }
  for(const [row,groups]of Object.entries(targetFormation))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail(${JSON.stringify(u.type)})`)>=u.count);
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=state();
  assert.equal(after.deployed,626);
  report.replenishments.push({before,need,trainingCost,after});
  console.error(`P400 replenished ${Object.values(need).reduce((a,b)=>a+b,0)} soldiers`);
}
replenish();

let battleCount=0;
while(state().level<7&&!report.failure){
  const next=run("eraStorageCost('quantumKnowledge')");
  while(state().leaf<(next.revivalLeaf||0)&&battleCount<160){
    if(state().deployed<626)replenish();
    const before=state();
    if(before.alert>=4100){
      const exchange=run('exchangeDomainCleanser(1)');
      if(!exchange.ok||exchange.repeat){report.failure={type:'cleanser-exchange',before,result:exchange};break}
      const use=run("useDomainCleanser('revivalLeaf')");
      if(!use.ok||use.repeat){report.failure={type:'cleanser-use',before,result:use};break}
      report.cleanses.push({before,exchange,use,after:state()});
    }
    const expected=run("materialDomainEncounter('revivalLeaf').reward.revivalLeaf");
    const opened=run("openMaterialDomain('revivalLeaf')");
    if(!run('S.battleActive')){report.failure={type:'battle-open',before,result:opened};break}
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
    assert.ok(callbacks<10000);
    const outcome=run("document.getElementById('battle-result').className");
    run('exitBattle()');
    const after=state();
    report.battles.push({before,expected,outcome,callbacks,after,
      leafGain:after.leaf-before.leaf,armyLoss:before.army-after.army});
    battleCount++;
    if(outcome!=='win'){report.failure={type:'battle-loss',before,after};break}
    assert.equal(after.leaf-before.leaf,expected);
    run('for(let i=0;i<6;i++)tick()');
    report.clock.onlineSeconds+=6;
    run('__clockMs+=6000');
  }
  if(report.failure)break;
  if(battleCount>=160){report.failure={type:'battle-bound',at:state()};break}
  assert.equal(payNextStorage(),true);
}
if(!report.failure&&state().cap>=target.tech){
  fillKnowledge(target.tech);
  const before=state(),paid=run("researchScience('sci_astral_armament')");
  if(!paid.ok)report.failure={type:'research-payment',before,result:paid};
  else{
    const after=state();
    assert.equal(after.tech,before.tech-target.tech);
    assert.equal(after.medal,before.medal-target.medal);
    assert.equal(after.science,true);
    const repeat=run("researchScience('sci_astral_armament')");
    assert.equal(repeat.repeat,true);
    assert.equal(state().tech,after.tech);
    report.research={before,paid,after,repeat};
  }
}
report.final=state();
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),report.final.cap);
assert.equal(reload.run("S.eraStorage.quantumKnowledge"),report.final.level);
assert.equal(reload.run("scienceUnlocked('sci_astral_armament')"),report.final.science);
assert.equal(env.store.get('rts_save_premigration'),sourceRaw);
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sourceHash);
for(const file of runtimeFiles)
  assert.equal(sha(fs.readFileSync(path.join(root,file),'utf8')),runtimeHash[file],`${file} changed`);
report.finalName='p400-armament-natural-route-save.json';
report.finalHash=sha(finalRaw);
fs.writeFileSync(path.join(dataDir,report.finalName),finalRaw);
fs.writeFileSync(path.join(dataDir,'p400-armament-natural-route.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({start:report.start,medalTrades:report.medalTrades.length,
  storagePayments:report.storagePayments.map(x=>({level:x.after.level,cost:x.cost,cap:x.after.cap})),
  battleWins:report.battles.filter(x=>x.outcome==='win').length,replenishments:report.replenishments.length,
  failure:report.failure,clock:report.clock,research:report.research&&{before:report.research.before,
  paid:report.research.paid,after:report.research.after},final:report.final,
  finalName:report.finalName,finalHash:report.finalHash},null,2));
