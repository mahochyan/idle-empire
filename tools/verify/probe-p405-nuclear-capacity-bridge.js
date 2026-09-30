'use strict';
// Continue the P405 paid Lv9 save through a real nuclear-knowledge storage payment.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceName='p405-quantum-lv9-paid-save.json';
const sourceRaw=fs.readFileSync(path.join(dir,sourceName),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceHash='8099c84008d2aff938bb0ae47472f2a3e8cbfbcc4d362f18b8e8ab4043c5fc30';
assert.equal(sha(sourceRaw),sourceHash,'P405 Lv9 input changed');
const formationName='p402-high-scroll-followup-save.json';
const formationRaw=fs.readFileSync(path.join(dir,formationName),'utf8');
assert.equal(sha(formationRaw),'b615a8158c53eaa1c2b0603f619fe17dcdaa86980b8967e647c0abd83340aa6c');
const target=JSON.parse(formationRaw).formation;
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const source=JSON.parse(sourceRaw),env=environment({rts_save:sourceRaw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
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
  if(id.startsWith('ou-')||id.startsWith('eu-')||id==='battle-vfx-layer')return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=2643554181;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};
globalThis.__trainingDebits={calls:0,units:0,resources:{}};
globalThis.__originalPayTrainingCost=payTrainingCost;
payTrainingCost=(cost,n)=>{
  const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
  __originalPayTrainingCost(cost,n);
  __trainingDebits.calls++;__trainingDebits.units+=n;
  for(const k of trainingCostKeys(cost)){
    const actual=before[k]-S.res[k],expected=cost[k]*n;
    if(Math.abs(actual-expected)>0.000001)throw Error('training debit mismatch '+k);
    __trainingDebits.resources[k]=(__trainingDebits.resources[k]||0)+actual;
  }
};`);
const snap=()=>JSON.parse(JSON.stringify(run(`({tick:S.tick,clockMs:Date.now(),army:armyCount(),
  deployed:formSoldierCount(),food:S.res.food,tech:S.res.tech,techCap:resCap('tech'),
  techRate:prodRate('tech'),leaf:S.items.revivalLeaf,blood:S.items.sacredBlood,
  cleanser:S.items.domainCleanser,alert:S.killValues.godRebirth,
  store:S.eraStorage.nuclearKnowledge,rng:__rng,
  resources:Object.fromEntries(['stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]]))})`)));
const cost={...run("eraStorageCost('nuclearKnowledge')")};
assert.deepEqual(cost,{tech:440000000,revivalLeaf:2200});
const report={baselineHead:'9fd54b76e3587aed069bdc4d5df61a0fd2b97778',sourceName,sourceHash,
  formationName,formationHash:sha(formationRaw),runtimeHash,
  policy:'P405 Lv9 xorshift32 continuation, original 486-soldier formation, paid work and training; at most 30 revival battles and 70000 simulated online seconds, no seed search or state injection',
  initial:snap(),cost,clock:{onlineSeconds:0,offlineSeconds:0,battleCallbackMilliseconds:0},
  training:[],battles:[],stopReason:null,minimumFood:snap().food};
const maxSeconds=70000,maxBattles=30;
const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap(${JSON.stringify(k)})`);
function advanceUntil(expression,max,stop='false'){
  const allowed=Math.max(0,Math.min(max,maxSeconds-report.clock.onlineSeconds));
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${allowed}){
    tick();__clockMs+=1000;n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  report.clock.onlineSeconds+=x.n;
  report.minimumFood=Math.min(report.minimumFood,x.min);
  assert.ok(x.min>0,'food exhausted');
  return x;
}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  if(resource==='tech')assert.equal(run("setPopAlloc('tech',999)")?.ok,true);
  else{
    assert.equal(run(`setPopAlloc(${JSON.stringify(resource)},902)`)?.ok,true);
    assert.equal(run("setPopAlloc('tech',372)")?.ok,true);
  }
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  assert.ok(run("prodRate('tech')")>0);
}
function fillBasic(resource,amount){
  if(val(resource)>=amount)return true;
  assert.ok(amount<=cap(resource),`${resource} cap`);
  assign(resource);
  return advanceUntil(`S.res.${resource}>=${amount}`,20000).done;
}
function fillProcessed(resource,amount){
  if(val(resource)>=amount)return true;
  assert.ok(amount<=cap(resource),`${resource} cap`);
  let cycles=0;
  while(val(resource)<amount&&cycles++<100&&report.clock.onlineSeconds<maxSeconds){
    if(val('stone')<100000&&!fillBasic('stone',Math.min(1200000,cap('stone'))))return false;
    if(val('coal')<100000&&!fillBasic('coal',Math.min(450000,cap('coal'))))return false;
    if(resource==='steel'&&val('iron')<100000&&
      !fillProcessed('iron',Math.min(1000000,cap('iron'))))return false;
    const prior=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${amount}`,10000,stop);
    assert.ok(val(resource)>prior||report.clock.onlineSeconds>=maxSeconds,`${resource} stalled`);
  }
  return val(resource)>=amount;
}
function fill(resource,amount){
  if(val(resource)>=amount)return true;
  return ['copper','iron','steel'].includes(resource)?fillProcessed(resource,amount):fillBasic(resource,amount);
}
function replenish(label){
  const before=snap(),wanted={};
  for(const group of Object.values(target))for(const u of group)wanted[u.type]=(wanted[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need=Object.fromEntries(Object.entries(wanted).map(([type,n])=>
    [type,Math.max(0,n-run(`poolAvail(${JSON.stringify(type)})`))]));
  const paid={},order={steel:0,iron:1,copper:2,gold:3,food:4,stone:5,wood:6};
  const secondsBefore=report.clock.onlineSeconds;
  for(const [type,count] of Object.entries(need)){
    if(!count)continue;
    const unitCost=run(`({...CFG.units[${JSON.stringify(type)}].cost})`);
    for(const [resource,each] of Object.entries(unitCost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=each*count;
      if(!fill(resource,amount))return{ok:false,reason:'online-seconds-or-resource',resource,type,amount};
      paid[resource]=(paid[resource]||0)+amount;
    }
    const action=run(`train(${JSON.stringify(type)},${count})`);
    if(!action?.ok)return{ok:false,reason:'train-refusal',type,count,action};
    if(!advanceUntil(`poolAvail(${JSON.stringify(type)})>=${wanted[type]}`,2000).done)
      return{ok:false,reason:'training-timeout',type};
  }
  for(const [row,group] of Object.entries(target))group.forEach((u,slot)=>{
    assert.ok(run(`poolAvail(${JSON.stringify(u.type)})`)>=u.count);
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=snap();assert.equal(after.deployed,486);
  report.training.push({label,before,need,paid,onlineSeconds:report.clock.onlineSeconds-secondsBefore,after});
  return{ok:true};
}
for(let i=0;i<maxBattles&&snap().leaf<cost.revivalLeaf;i++){
  const prep=replenish(`before-battle-${i+1}`);
  if(!prep.ok){report.stopReason={kind:'replenishment',battle:i+1,...prep};break}
  const beforeCleanse=snap();
  if(beforeCleanse.alert>=4100){
    const exchange=run('exchangeDomainCleanser(1)');
    if(!exchange.ok||exchange.repeat){report.stopReason={kind:'cleanser-exchange',battle:i+1,exchange:{...exchange}};break}
    const use=run("useDomainCleanser('revivalLeaf')");
    if(!use.ok||use.repeat){report.stopReason={kind:'cleanser-use',battle:i+1,use:{...use}};break}
  }
  const entry=snap(),preview=run("materialDomainEncounter('revivalLeaf').reward.revivalLeaf");
  run("openMaterialDomain('revivalLeaf')");
  if(!run('S.battleActive')){report.stopReason={kind:'battle-open',battle:i+1};break}
  let callbacks=0,callbackMs=0;
  while(run('S.battleActive')&&callbacks<10000){
    const step=run(`(()=>{const first=__timers.entries().next().value;return first?first[1].delay:null})()`);
    assert.equal(run('__step()'),true);callbacks++;callbackMs+=Number(step)||0;
  }
  assert.ok(callbacks<10000);
  report.clock.battleCallbackMilliseconds+=callbackMs;
  const outcome=run("document.getElementById('battle-result').className");
  run('exitBattle()');
  const after=snap();
  const row={battle:i+1,entry,outcome,callbacks,callbackMs,preview,after,
    leafGain:after.leaf-entry.leaf,armyLoss:entry.army-after.army,
    bloodBefore:beforeCleanse.blood,bloodEntry:entry.blood,bloodAfter:after.blood,
    bloodSpent:beforeCleanse.blood-entry.blood,bloodReward:after.blood-entry.blood};
  report.battles.push(row);
  if(outcome==='win')assert.equal(row.leafGain,preview);
  else if(report.battles.slice(-2).every(x=>x.outcome!=='win')&&report.battles.length>=2){
    report.stopReason={kind:'two-consecutive-battle-losses',battle:i+1};break;
  }
  if(report.clock.onlineSeconds>=maxSeconds){report.stopReason={kind:'online-seconds',battle:i+1};break}
  // Real production/timers between actions, continuing the P405 policy.
  advanceUntil('false',6);
  if(i%10===9)console.log(`progress battles=${i+1} wins=${report.battles.filter(x=>x.outcome==='win').length} leaf=${snap().leaf} knowledge=${Math.floor(snap().tech)} onlineSec=${report.clock.onlineSeconds}`);
}
if(!report.stopReason&&snap().leaf<cost.revivalLeaf)
  report.stopReason={kind:report.battles.length>=maxBattles?'battle-bound':'material-shortfall'};
if(!report.stopReason&&snap().leaf>=cost.revivalLeaf&&snap().tech<cost.tech){
  assign('tech');
  report.knowledgePhase={start:snap(),chunks:[]};
  while(snap().tech<cost.tech&&report.clock.onlineSeconds<maxSeconds){
    const x=advanceUntil(`S.res.tech>=${cost.tech}`,20000);
    report.knowledgePhase.chunks.push({seconds:x.n,afterTech:snap().tech});
    if(!x.n)break;
  }
  report.knowledgePhase.end=snap();
  if(snap().tech<cost.tech)report.stopReason={kind:'online-seconds-before-knowledge'};
}
const beforeUpgrade=snap(),beforeRaw=env.store.get('rts_save');
const upgrade=run("upgradeEraStorage('nuclearKnowledge')");
report.upgrade={...upgrade};
if(upgrade.ok){
  assert.equal(beforeUpgrade.store,21);assert.equal(snap().store,22);
  assert.equal(beforeUpgrade.leaf-snap().leaf,cost.revivalLeaf);
  assert.ok(Math.abs(beforeUpgrade.tech-snap().tech-cost.tech)<0.001);
  report.stopReason={kind:'paid-nuclear-lv22'};
}else{
  assert.equal(env.store.get('rts_save'),beforeRaw,'rejected upgrade changed save');
  assert.equal(snap().store,21);
  if(!report.stopReason)report.stopReason={kind:'upgrade-refusal',reason:upgrade.reason};
}
report.final=snap();report.trainingDebits=run('JSON.parse(JSON.stringify(__trainingDebits))');
const engineCost={...run("activeSciences().sci_astral_engine.cost")};
const engineBeforeRaw=env.store.get('rts_save');
const engineRefusal=run("researchScience('sci_astral_engine')");
assert.equal(engineRefusal.ok,false);
assert.equal(env.store.get('rts_save'),engineBeforeRaw,'rejected engine changed save');
report.postUpgrade={nextStorageCost:{...run("eraStorageCost('nuclearKnowledge')")},
  knowledgeCap:run("resCap('tech')"),medals:run('S.res.medal'),engineCost,
  engineRefusal:{...engineRefusal},
  engineCapacityGap:Math.max(0,engineCost.tech-run("resCap('tech')")),
  engineMedalGap:Math.max(0,engineCost.medal-run('S.res.medal'))};
const planned={};
for(const x of report.training)for(const [k,n] of Object.entries(x.paid))planned[k]=(planned[k]||0)+n;
for(const [k,n] of Object.entries(planned))
  assert.ok(Math.abs(n-report.trainingDebits.resources[k])<0.001,`${k} true debit`);
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save'),reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const [field,expr] of [['leaf','S.items.revivalLeaf'],['army','armyCount()'],
  ['tech','S.res.tech'],['store','S.eraStorage.nuclearKnowledge']])
  assert.equal(reload.run(expr),report.final[field]);
assert.equal(sha(fs.readFileSync(path.join(dir,sourceName),'utf8')),sourceHash);
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),runtimeHash[f]);
report.finalName='p405-nuclear-lv22-paid-save.json';report.finalHash=sha(finalRaw);
fs.writeFileSync(path.join(dir,report.finalName),finalRaw);
const ledger=[];
for(let i=0;i<Math.max(report.training.length,report.battles.length);i++){
  const t=report.training[i],b=report.battles[i];
  if(t)ledger.push({kind:'training',battle:i+1,onlineSeconds:t.onlineSeconds,
    need:t.need,paid:t.paid,armyBefore:t.before.army,armyAfter:t.after.army,
    knowledgeBefore:t.before.tech,knowledgeAfter:t.after.tech,
    rngBefore:t.before.rng,rngAfter:t.after.rng});
  if(b)ledger.push({kind:'battle',battle:b.battle,outcome:b.outcome,
    callbacks:b.callbacks,callbackMs:b.callbackMs,preview:b.preview,
    leafGain:b.leafGain,leafAfter:b.after.leaf,armyLoss:b.armyLoss,
    armyAfter:b.after.army,alertBefore:b.entry.alert,alertAfter:b.after.alert,
    bloodBefore:b.bloodBefore,bloodSpent:b.bloodSpent,bloodReward:b.bloodReward,
    bloodAfter:b.bloodAfter,
    rngBefore:b.entry.rng,rngAfter:b.after.rng});
}
const ledgerName='p405-nuclear-lv22-paid-ledger.jsonl';
const ledgerRaw=ledger.map(x=>JSON.stringify(x)).join('\n')+'\n';
fs.writeFileSync(path.join(dir,ledgerName),ledgerRaw);
const summary={baselineHead:report.baselineHead,sourceName,sourceHash,
  formationName,formationHash:report.formationHash,runtimeHash,policy:report.policy,
  initial:report.initial,cost,clock:report.clock,minimumFood:report.minimumFood,
  battles:report.battles.length,wins:report.battles.filter(x=>x.outcome==='win').length,
  losses:report.battles.filter(x=>x.outcome!=='win').length,
  totalLeafGain:report.battles.reduce((n,x)=>n+x.leafGain,0),
  totalArmyLoss:report.battles.reduce((n,x)=>n+x.armyLoss,0),
  totalBloodSpent:report.battles.reduce((n,x)=>n+x.bloodSpent,0),
  totalBloodReward:report.battles.reduce((n,x)=>n+x.bloodReward,0),
  trainingCount:report.training.length,trainingSeconds:report.training.reduce((n,x)=>n+x.onlineSeconds,0),
  trainingPlanned:planned,trainingDebits:report.trainingDebits,
  knowledgePhase:report.knowledgePhase?{
    start:report.knowledgePhase.start,end:report.knowledgePhase.end,
    onlineSeconds:report.knowledgePhase.chunks.reduce((n,x)=>n+x.seconds,0),
    chunks:report.knowledgePhase.chunks}:null,
  upgrade:report.upgrade,postUpgrade:report.postUpgrade,
  stopReason:report.stopReason,final:report.final,
  finalName:report.finalName,finalHash:report.finalHash,ledgerName,ledgerHash:sha(ledgerRaw)};
fs.writeFileSync(path.join(dir,'p405-nuclear-lv22-paid.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({sourceHash,clock:report.clock,battles:report.battles.length,
  wins:report.battles.filter(x=>x.outcome==='win').length,losses:report.battles.filter(x=>x.outcome!=='win').length,
  training:report.training.length,minimumFood:report.minimumFood,upgrade:report.upgrade,
  stopReason:report.stopReason,initial:report.initial,final:report.final,trainingDebits:report.trainingDebits,
  postUpgrade:report.postUpgrade,finalName:report.finalName,finalHash:report.finalHash,
  ledgerName,ledgerHash:summary.ledgerHash},null,2));
