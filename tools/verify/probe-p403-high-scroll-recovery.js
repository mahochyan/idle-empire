'use strict';
// Paid recovery of the original P402 formation after the P403 first defeat; two-battle bound.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const sourceName='p403-high-scroll-leaf-bounded-save.json';
const raw=fs.readFileSync(path.join(dir,sourceName),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(raw);
assert.equal(sourceHash,'55806ac7f023bccc836bab84ddf4aa7f0a07fdf70c665a8e1a3a672dff28aae4');
const formationRaw=fs.readFileSync(path.join(dir,'p402-high-scroll-followup-save.json'),'utf8');
assert.equal(sha(formationRaw),'b615a8158c53eaa1c2b0603f619fe17dcdaa86980b8967e647c0abd83340aa6c');
const target=JSON.parse(formationRaw).formation;
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
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
globalThis.__rng=646549655;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};
globalThis.__trainingDebits={calls:0,units:0,resources:{}};
globalThis.__originalPayTrainingCost=payTrainingCost;
payTrainingCost=(cost,n)=>{
  const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
  __originalPayTrainingCost(cost,n);
  __trainingDebits.calls++;__trainingDebits.units+=n;
  for(const k of trainingCostKeys(cost)){
    const expected=cost[k]*n,actual=before[k]-S.res[k];
    if(Math.abs(actual-expected)>0.000001)throw Error('training debit mismatch '+k);
    __trainingDebits.resources[k]=(__trainingDebits.resources[k]||0)+actual;
  }
};`);
const snap=()=>JSON.parse(JSON.stringify(run(`({tick:S.tick,clockMs:Date.now(),army:armyCount(),
  deployed:formSoldierCount(),food:S.res.food,tech:S.res.tech,leaf:S.items.revivalLeaf,
  blood:S.items.sacredBlood,alert:S.killValues.godRebirth,
  resources:Object.fromEntries(['wood','stone','coal','copper','iron','steel','gold'].map(k=>[k,S.res[k]])),
  rng:__rng})`)));
const report={baselineHead:'3c856bc43bca4f9e84f8c7439e8f48db0b9dc91c',sourceName,sourceHash,
  runtimeHash,formationSource:'p402-high-scroll-followup-save.json',
  random:'continue P403 fixed xorshift32 stream after first defeat, no seed search',
  policy:'restore original 486-person formation with production and real queues; then at most two revival battles, paid cleanse at 4100 alert; replenish between wins',
  start:snap(),clock:{onlineSeconds:0,offlineSeconds:0},replenishments:[],battles:[],stopReason:null,
  minimumFood:snap().food};
const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap(${JSON.stringify(k)})`);
function advanceUntil(expression,max,stop='false'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();__clockMs+=1000;n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  report.clock.onlineSeconds+=x.n;
  report.minimumFood=Math.min(report.minimumFood,x.min);
  assert.ok(x.min>0,'food exhausted during paid recovery');
  return x;
}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  if(resource!=='food')assert.equal(run(`setPopAlloc(${JSON.stringify(resource)},902)`)?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function fillBasic(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} cap`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,20000).done,`${resource} timeout`);
}
function fillProcessed(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} cap`);
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
    assert.ok(val(resource)>prior,`${resource} stalled`);
  }
  assert.ok(val(resource)>=amount,`${resource} exhausted`);
}
function fill(resource,amount){
  if(val(resource)>=amount)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,amount);
  else fillBasic(resource,amount);
}
function replenish(label){
  const before=snap(),wanted={};
  for(const group of Object.values(target))for(const u of group)wanted[u.type]=(wanted[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need=Object.fromEntries(Object.entries(wanted).map(([type,n])=>
    [type,Math.max(0,n-run(`poolAvail(${JSON.stringify(type)})`))]));
  const costPaid={},order={steel:0,iron:1,copper:2,gold:3,food:4,stone:5,wood:6};
  const secondsBefore=report.clock.onlineSeconds;
  for(const [type,count] of Object.entries(need)){
    if(!count)continue;
    const cost=run(`({...CFG.units[${JSON.stringify(type)}].cost})`);
    for(const [resource,each] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=each*count;fill(resource,amount);
      costPaid[resource]=(costPaid[resource]||0)+amount;
    }
    const action=run(`train(${JSON.stringify(type)},${count})`);
    if(!action?.ok){report.stopReason={kind:'train-refusal',type,count,result:action};return false}
    assert.ok(advanceUntil(`poolAvail(${JSON.stringify(type)})>=${wanted[type]}`,2000).done,
      `${type} training timeout`);
  }
  for(const [row,group] of Object.entries(target))group.forEach((u,slot)=>{
    assert.ok(run(`poolAvail(${JSON.stringify(u.type)})`)>=u.count);
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=snap();
  assert.equal(after.deployed,486);
  report.replenishments.push({label,before,need,costPaid,onlineSeconds:report.clock.onlineSeconds-secondsBefore,
    minimumFood:report.minimumFood,after});
  return true;
}
if(replenish('after-first-defeat'))for(let i=0;i<2;i++){
  const before=snap();
  if(before.alert>=4100){
    const exchange=run('exchangeDomainCleanser(1)');
    if(!exchange.ok||exchange.repeat){report.stopReason={kind:'cleanser-exchange',result:exchange};break}
    const use=run("useDomainCleanser('revivalLeaf')");
    if(!use.ok||use.repeat){report.stopReason={kind:'cleanser-use',result:use};break}
    report.battles.push({kind:'cleanse',exchange:{...exchange},use:{...use}});
  }
  const entry=snap(),preview=run("materialDomainEncounter('revivalLeaf').reward.revivalLeaf");
  run("openMaterialDomain('revivalLeaf')");
  if(!run('S.battleActive')){report.stopReason={kind:'battle-open'};break}
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000);
  const outcome=run("document.getElementById('battle-result').className");
  run('exitBattle()');
  const after=snap();
  report.battles.push({kind:'battle',entry,preview,outcome,callbacks,after,
    leafGain:after.leaf-entry.leaf,armyLoss:entry.army-after.army});
  if(outcome!=='win'){report.stopReason={kind:'battle-loss',at:i+1};break}
  assert.equal(after.leaf-entry.leaf,preview);
  advanceUntil('false',6);
  if(i<1&&!replenish('between-battles'))break;
}
if(!report.stopReason)report.stopReason={kind:'two-battle-bound'};
report.final=snap();
report.trainingDebits=run('JSON.parse(JSON.stringify(__trainingDebits))');
const planned={};
for(const x of report.replenishments)for(const [k,n] of Object.entries(x.costPaid))planned[k]=(planned[k]||0)+n;
for(const [k,n] of Object.entries(planned))
  assert.ok(Math.abs(n-report.trainingDebits.resources[k])<0.0001,`${k} true debit`);
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save'),reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const [field,expr] of [['leaf','S.items.revivalLeaf'],['blood','S.items.sacredBlood'],
  ['army','armyCount()']])assert.equal(reload.run(expr),report.final[field]);
assert.equal(sha(fs.readFileSync(path.join(dir,sourceName),'utf8')),sourceHash);
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),runtimeHash[f]);
report.finalName='p403-high-scroll-recovery-save.json';report.finalHash=sha(finalRaw);
fs.writeFileSync(path.join(dir,report.finalName),finalRaw);
fs.writeFileSync(path.join(dir,'p403-high-scroll-recovery.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({start:report.start,replenishments:report.replenishments.map(x=>({label:x.label,
  need:x.need,costPaid:x.costPaid,onlineSeconds:x.onlineSeconds,minimumFood:x.minimumFood,
  army:x.after.army,deployed:x.after.deployed})),battles:report.battles.filter(x=>x.kind==='battle').map(x=>({outcome:x.outcome,
  leafGain:x.leafGain,armyLoss:x.armyLoss,after:x.after})),stopReason:report.stopReason,
  clock:report.clock,minimumFood:report.minimumFood,final:report.final,
  trainingDebits:report.trainingDebits,
  finalName:report.finalName,finalHash:report.finalHash},null,2));
