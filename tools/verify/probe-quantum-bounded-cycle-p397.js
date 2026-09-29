'use strict';
// Bounded paid revival-domain/storage cycles from the same P397 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const dir=path.resolve(__dirname,'../../docs/codex/reports/data');
const sourceFile='p397-quantum-leaf-step-paid-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'b83d5b17de1a8df4a829b0ddbeb630fde2508afb006aa2dbe6912fe85b13451d');
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const rosterRaw=fs.readFileSync(path.join(dir,'p395-quantum-storage-medal-combined-paid-save.json'),'utf8');
assert.equal(sha(rosterRaw),'ecf78293015e46e05e70c38916a834c7063345f8ef11cb7ac29a337b0774b75e');
const targetFormation=JSON.parse(rosterRaw).formation;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[${source.ts}+(S.tick-${source.tick})*1000]))}
  static now(){return ${source.ts}+(S.tick-${source.tick})*1000}
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
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  army:armyCount(),deployed:formSoldierCount(),blood:S.items.sacredBlood,
  leaf:S.items.revivalLeaf,alert:S.killValues.godRebirth,nuclear:S.eraStorage.nuclearKnowledge})`);
const result={sourceFile,sourceHash:sha(raw),start:state(),targetNuclearLevel:21,
  clock:{onlineSeconds:0,offlineSeconds:0},battles:[],cleanses:[],replenishments:[],payments:[],
  firstFailure:null,checkpoints:[]};
assert.equal(result.start.nuclear,9);
function replenish(){
  const before=state(),target={};
  for(const groups of Object.values(targetFormation))for(const u of groups)
    target[u.type]=(target[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need=Object.fromEntries(Object.entries(target).map(([type,wanted])=>
    [type,Math.max(0,wanted-run(`poolAvail(${JSON.stringify(type)})`))]));
  const phases={stone:0,coal:0,copper:0,iron:0,steel:0,wood:0,gold:0,food:0,training:0};
  let phase='training',seconds=0,minFood=run('S.res.food');
  const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap(${JSON.stringify(k)})`);
  function assign(resource){
    for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc(${JSON.stringify(resource)},902)`)?.ok,true);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
    phase=resource;
  }
  function advanceUntil(expression,max,stop='false'){
    const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
      tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
    seconds+=x.n;result.clock.onlineSeconds+=x.n;
    minFood=Math.min(minFood,x.min);phases[phase]+=x.n;
    assert.ok(x.min>0,'food depleted during recovery');return x;
  }
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
  const trainingCost={},order={steel:0,iron:1,copper:2,gold:3,food:4,stone:5,wood:6};
  for(const [type,short]of Object.entries(need)){
    if(!short)continue;
    const cost=run(`({...CFG.units[${JSON.stringify(type)}].cost})`);
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=perUnit*short;fill(resource,amount);
      trainingCost[resource]=(trainingCost[resource]||0)+amount;
    }
    assert.equal(run(`train(${JSON.stringify(type)},${short})`)?.ok,true);
    phase='training';
    assert.ok(advanceUntil(`poolAvail(${JSON.stringify(type)})>=${target[type]}`,2000).done,
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
  assert.equal(after.army,672);
  result.replenishments.push({before,need,trainingCost,seconds,minFood,phases,after});
}
function fillTech(amount){
  if(state().tech>=amount)return 0;
  if(state().cap<amount)return null;
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run("setPopAlloc('tech',902)")?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  let seconds=0;
  while(state().tech<amount&&seconds<30000){
    run('for(let j=0;j<100;j++)tick()');
    seconds+=100;result.clock.onlineSeconds+=100;
  }
  assert.ok(state().tech>=amount,'knowledge fill timed out');
  assert.ok(run('S.res.food')>0,'food depleted while filling knowledge');
  return seconds;
}
let battleCount=0;
while(state().nuclear<result.targetNuclearLevel&&!result.firstFailure){
  const level=state().nuclear+1,cost=run("eraStorageCost('nuclearKnowledge')");
  assert.equal(cost.revivalLeaf,level*100);
  while(state().leaf<cost.revivalLeaf&&battleCount<400){
    if(state().army<672)replenish();
    const before=state();
    // Blood reward rises at *next* alert 4001, so hold at 4100 after the
    // first seven uncleaned wins. At 4000 the reward is still only two.
    if(before.alert>=4100){
      const exchange=run('exchangeDomainCleanser(1)');
      if(!exchange.ok||exchange.repeat){
        result.firstFailure={type:'cleanser-exchange',level,before,result:exchange};break;
      }
      const use=run("useDomainCleanser('revivalLeaf')");
      if(!use.ok||use.repeat){
        result.firstFailure={type:'cleanser-use',level,before,result:use};break;
      }
      result.cleanses.push({level,before,exchange,use,after:state()});
    }
    const expected=run("materialDomainEncounter('revivalLeaf').reward.revivalLeaf");
    const opened=run("openMaterialDomain('revivalLeaf')");
    if(!run('S.battleActive')){
      result.firstFailure={type:'battle-open',level,before,result:opened};break;
    }
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
    assert.ok(callbacks<10000);
    const outcome=run("document.getElementById('battle-result').className");
    run('exitBattle()');
    const after=state();
    result.battles.push({level,before,expected,outcome,callbacks,after,
      leafGain:after.leaf-before.leaf,armyLoss:before.army-after.army});
    battleCount++;
    if(outcome!=='win'){
      result.firstFailure={type:'battle-loss',level,before,after,callbacks};break;
    }
    assert.equal(after.leaf-before.leaf,expected);
    run('for(let i=0;i<6;i++)tick()');
    result.clock.onlineSeconds+=6;
  }
  if(result.firstFailure)break;
  if(battleCount>=400){result.firstFailure={type:'probe-bound',level,state:state()};break}
  const fillSeconds=fillTech(cost.tech);
  if(fillSeconds===null){result.firstFailure={type:'knowledge-cap',level,cost,state:state()};break}
  const before=state(),paid=run("upgradeEraStorage('nuclearKnowledge')");
  if(!paid.ok){result.firstFailure={type:'storage-payment',level,cost,before,result:paid};break}
  const after=state();
  assert.equal(after.nuclear,level);
  assert.equal(after.tech,before.tech-cost.tech);
  assert.equal(after.leaf,before.leaf-cost.revivalLeaf);
  assert.ok(after.cap>before.cap);
  result.payments.push({level,cost,fillSeconds,before,paid,after});
  assert.equal(run('save().ok'),true);
  const checkpoint=env.store.get('rts_save');
  const reload=environment({rts_save:checkpoint});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run("resCap('tech')"),after.cap);
  result.checkpoints.push({level,sha256:sha(checkpoint),state:after});
  console.error(`paid nuclear storage ${level}: cap=${after.cap}, wins=${battleCount}, online=${result.clock.onlineSeconds}s`);
}
result.final=state();
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),result.final.cap);
assert.equal(reload.run('S.eraStorage.nuclearKnowledge'),result.final.nuclear);
result.finalHash=sha(finalRaw);
result.finalFile='p397-quantum-bounded-cycle-save.json';
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),result.sourceHash);
fs.writeFileSync(path.join(dir,result.finalFile),finalRaw);
fs.writeFileSync(path.join(dir,'p397-quantum-bounded-cycle.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start:result.start,battles:result.battles.length,
  lastBattle:result.battles.at(-1),payments:result.payments.map(x=>({level:x.level,cost:x.cost,cap:x.after.cap})),
  replenishments:result.replenishments.length,firstFailure:result.firstFailure,
  final:result.final,clock:result.clock,finalFile:result.finalFile,finalHash:result.finalHash},null,2));
