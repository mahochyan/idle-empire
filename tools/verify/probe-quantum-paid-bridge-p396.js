'use strict';
// Continue one P395 paid save through actual material encounters and storage research.
// No resource edits, free troops, or conditional candidates are counted as payments.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceFile='p395-quantum-steam32-medal-combined-paid-save.json';
const sourcePath=path.join(dir,sourceFile);
const raw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceSha256=sha(raw);
assert.equal(sourceSha256,'f66e754ae19d5d23c1c1540aec102392f79b81fc78c210c1b4dd9ea1e8fba28b');
const source=JSON.parse(raw);
const rosterSourceFile='p395-quantum-storage-medal-combined-paid-save.json';
const rosterRaw=fs.readFileSync(path.join(dir,rosterSourceFile),'utf8');
assert.equal(sha(rosterRaw),'ecf78293015e46e05e70c38916a834c7063345f8ef11cb7ac29a337b0774b75e');
const targetFormation=JSON.parse(rosterRaw).formation;
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
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
    __rng=x>>>0;return __rng/4294967296};
  globalThis.__trainingPaid={};const __realPay=payTrainingCost;
  payTrainingCost=function(cost,n){
    const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__realPay(cost,n);
    for(const k of trainingCostKeys(cost)){
      const spent=before[k]-S.res[k];
      if(Math.abs(spent-cost[k]*n)>1e-6)throw Error('training debit mismatch '+k);
      __trainingPaid[k]=(__trainingPaid[k]||0)+spent;
    }
    return result;
  };`);
function state(r=run){return r(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,
  cap:resCap('tech'),food:S.res.food,army:armyCount(),deployed:formSoldierCount(),
  crystal:S.items.godCrystal,guardian:S.items.guardianStone,leaf:S.items.revivalLeaf,
  blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
  scroll:S.beastExchange.scrollUsed,
  alert:{crystal:S.killValues.godRevival,guardian:S.killValues.godGuardian,
    leaf:S.killValues.godRebirth},
  storage:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
    nuclear:S.eraStorage.nuclearKnowledge}})`)}
const out={sourceFile,sourceSha256,runtimeSha256,clock:{onlineSeconds:0,offlineSeconds:0,
  wallClockNote:'Execution time is not player elapsed time; online seconds are simulated tick() calls.'},
  start:state(),costs:{quantum:run('activeSciences().sci_quantum_age.cost'),
    steam:run("eraStorageCost('steamKnowledge')"),
    electric:run("eraStorageCost('electricKnowledge')"),
    nuclear:run("eraStorageCost('nuclearKnowledge')")},
  battles:[],payments:[],replenishments:[],cleansers:[],scrollTrades:[],
  marketRefreshes:[],checkpoints:[]};
function checkpoint(label){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save');
  const loaded=environment({rts_save:saved});
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(JSON.stringify(state(loaded.run)),JSON.stringify(state()),'reload mismatch');
  const row={label,sha256:sha(saved),state:state()};out.checkpoints.push(row);
  return saved;
}
function tickSeconds(n){
  assert.ok(Number.isSafeInteger(n)&&n>=0);
  run(`for(let j=0;j<${n};j++)tick()`);
  out.clock.onlineSeconds+=n;
}
function fillTech(amount){
  const before=state();
  if(before.tech>=amount)return{seconds:0,before:before.tech,after:before.tech};
  let seconds=0;
  while(run('S.res.tech')<amount&&seconds<30000){tickSeconds(100);seconds+=100}
  assert.ok(run('S.res.tech')>=amount,'knowledge fill did not reach cost');
  assert.ok(run('S.res.food')>0,'food exhausted');
  return{seconds,before:before.tech,after:run('S.res.tech')};
}
function replenish(){
  const before=state();
  const targetByType={};
  for(const groups of Object.values(targetFormation))for(const u of groups)
    targetByType[u.type]=(targetByType[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need={};
  for(const [type,wanted]of Object.entries(targetByType))
    need[type]=Math.max(0,wanted-run(`poolAvail(${JSON.stringify(type)})`));
  let seconds=0,minFood=before.food,phase='training';
  const phases={stone:0,coal:0,copper:0,iron:0,steel:0,wood:0,gold:0,food:0,training:0};
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
    seconds+=x.n;out.clock.onlineSeconds+=x.n;
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
    assert.ok(advanceUntil(`poolAvail(${JSON.stringify(type)})>=${targetByType[type]}`,2000).done,
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
  const row={before,need,trainingCost,seconds,minFood,phases,after,
    checkpoint:sha(checkpoint(`replenish-${out.replenishments.length+1}`))};
  out.replenishments.push(row);
  return row;
}
function cleanse(key){
  const before=state();
  let exchange=run('exchangeDomainCleanser(1)');
  if(exchange.repeat){tickSeconds(6);exchange=run('exchangeDomainCleanser(1)')}
  assert.equal(exchange.ok,true,JSON.stringify(exchange));
  assert.notEqual(exchange.repeat,true,'cleanser exchange did not pay');
  let use=run(`useDomainCleanser(${JSON.stringify(key)})`);
  if(use.repeat){tickSeconds(6);use=run(`useDomainCleanser(${JSON.stringify(key)})`)}
  assert.equal(use.ok,true,JSON.stringify(use));
  assert.notEqual(use.repeat,true,'cleanser use did not pay');
  const after=state(),field={godCrystal:'crystal',guardianStone:'guardian',revivalLeaf:'leaf'}[key];
  assert.equal(after.alert[field],before.alert[field]-100);
  const row={key,before,exchange,use,after,
    checkpoint:sha(checkpoint(`cleanse-${key}-${out.cleansers.length+1}`))};
  out.cleansers.push(row);
  return row;
}
function battle(key){
  const before=state(),encounter=run(`materialDomainEncounter(${JSON.stringify(key)})`);
  run(`openMaterialDomain(${JSON.stringify(key)})`);
  assert.equal(run('S.battleActive'),true,`${key} did not open`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000,`${key} timed out`);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  run('exitBattle()');
  const after=state();
  const field={godCrystal:'crystal',guardianStone:'guardian',revivalLeaf:'leaf'}[key];
  const row={key,result,callbacks,enemyHpLeft,before,after,
    gain:after[field]-before[field],loss:before.army-after.army,
    expectedReward:encounter.reward[key]??null};
  row.checkpoint=sha(checkpoint(`${key}-${out.battles.length+1}`));
  out.battles.push(row);
  return row;
}
function payStorage(key){
  const before=state(),cost=run(`eraStorageCost(${JSON.stringify(key)})`);
  const fill=fillTech(cost.tech);
  const paid=run(`upgradeEraStorage(${JSON.stringify(key)})`);
  assert.equal(paid.ok,true,`${key}: ${JSON.stringify(paid)}`);
  const after=state(),field={steamKnowledge:'steam',electricKnowledge:'electric',
    nuclearKnowledge:'nuclear'}[key];
  assert.equal(after.storage[field],before.storage[field]+1);
  assert.equal(after.tech,fill.after-cost.tech);
  const row={key,before,cost,fill,paid,after,checkpoint:sha(checkpoint(`${key}-${after.storage[field]}`))};
  out.payments.push(row);return row;
}

// Restore the paid pre-crystal roster from the same save chain before fighting.
replenish();
// Leaf and guardian each use a paid cleanser at their current high alert.
for(let i=0;i<16&&state().leaf<out.costs.nuclear.revivalLeaf;i++){
  cleanse('revivalLeaf');
  const row=battle('revivalLeaf');
  if(row.result!=='win')break;
  if(row.loss>0)replenish();
  tickSeconds(6);
}
if(state().leaf>=out.costs.nuclear.revivalLeaf)payStorage('nuclearKnowledge');
// Then sample a different real source for the electric storage material.
for(let i=0;i<6&&state().guardian<out.costs.electric.guardianStone;i++){
  cleanse('guardianStone');
  const row=battle('guardianStone');
  if(row.result!=='win')break;
  if(row.loss>0)replenish();
  tickSeconds(6);
}
if(state().guardian>=out.costs.electric.guardianStone)payStorage('electricKnowledge');
// A third paid research can use the established crystal domain, after its losses
// are replenished and alert is actually reduced for each attempt.
for(let i=0;i<8&&state().crystal<out.costs.steam.godCrystal;i++){
  cleanse('godCrystal');
  const row=battle('godCrystal');
  if(row.result!=='win')break;
  if(row.loss>0)replenish();
  tickSeconds(6);
}
if(state().crystal>=out.costs.steam.godCrystal)payStorage('steamKnowledge');
// The randomized side market is only credited when it offers a material that
// this same save can actually afford; buying a scroll and applying it are both paid.
const wildKeys=['boarHeart','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'];
function buyAffordableScrolls(){
  let bought=0;
  for(const key of wildKeys){
    while(run(`beastScrollOfferCount(${JSON.stringify(key)})`)>0){
      const price=run(`beastScrollTradeCost(${JSON.stringify(key)})`);
      const stock=run(`S.items.${key}`);
      if(stock<price)break;
      const before=state();
      const trade=run(`exchangeWildMaterialForScrolls(${JSON.stringify(key)},1)`);
      assert.equal(trade.ok,true,JSON.stringify(trade));
      const use=run('useStorageScroll(1)');
      assert.equal(use.ok,true,JSON.stringify(use));
      const after=state();
      assert.equal(after.scroll,before.scroll+1);
      assert.ok(after.cap>before.cap);
      out.scrollTrades.push({key,price,stockBefore:stock,trade,use,before,after,
        checkpoint:sha(checkpoint(`scroll-${out.scrollTrades.length+1}`))});
      bought++;
    }
  }
  return bought;
}
buyAffordableScrolls();
for(let i=0;i<5&&out.scrollTrades.length<2;i++){
  if(run('S.beastExchange.refreshCharges')<1)break;
  const refreshed=run('refreshBeastExchange()');
  assert.equal(refreshed.ok,true,JSON.stringify(refreshed));
  const beforeCount=out.scrollTrades.length;
  const bought=buyAffordableScrolls();
  out.marketRefreshes.push({refreshed,bought,
    checkpoint:sha(checkpoint(`market-refresh-${i+1}`)),
    newTrades:out.scrollTrades.length-beforeCount});
}
// Fill the actual new cap, then prove the single 3-billion payment is still blocked.
for(const [key,n]of Object.entries(run('({...S.popAlloc})')))
  if(n>0)assert.equal(run(`setPopAlloc(${JSON.stringify(key)},0)`)?.ok,true);
assert.equal(run("setPopAlloc('food',100)")?.ok,true);
assert.equal(run("setPopAlloc('tech',902)")?.ok,true);
assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
out.knowledgeRatePerOnlineSecond=run("prodRate('tech')");
assert.ok(out.knowledgeRatePerOnlineSecond>0);
out.fillToCap=fillTech(state().cap);
assert.equal(state().tech,state().cap);
const expectedTrainingPaid={};
for(const recovery of out.replenishments)
  for(const [resource,n]of Object.entries(recovery.trainingCost))
    expectedTrainingPaid[resource]=(expectedTrainingPaid[resource]||0)+n;
out.trainingPaid=run('({...__trainingPaid})');
const canonical=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
assert.equal(canonical(out.trainingPaid),canonical(expectedTrainingPaid),'training debit mismatch');
const beforeAttempt=state();
out.quantumAttempt=run("researchScience('sci_quantum_age')");
assert.equal(out.quantumAttempt.ok,false);
assert.deepEqual(state(),beforeAttempt);
out.final=state();
out.remainingTechCapGap=out.costs.quantum.tech-out.final.cap;
out.nextCosts={steam:run("eraStorageCost('steamKnowledge')"),
  electric:run("eraStorageCost('electricKnowledge')"),
  nuclear:run("eraStorageCost('nuclearKnowledge')")};
const finalRaw=checkpoint('final');
out.saveFile='p396-quantum-paid-bridge-save.json';
out.saveSha256=sha(finalRaw);
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sourceSha256,'source changed');
assert.equal(sha(fs.readFileSync(path.join(dir,rosterSourceFile),'utf8')),sha(rosterRaw),'roster source changed');
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),
  runtimeSha256[f],`${f} changed during run`);
fs.writeFileSync(path.join(dir,out.saveFile),finalRaw);
fs.writeFileSync(path.join(dir,'p396-quantum-paid-bridge.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({start:out.start,costs:out.costs,
  battles:out.battles.map(x=>({key:x.key,result:x.result,gain:x.gain,loss:x.loss})),
  payments:out.payments.map(x=>({key:x.key,cost:x.cost,cap:x.after.cap,fill:x.fill})),
  scrollTrades:out.scrollTrades.map(x=>({key:x.key,price:x.price,cap:x.after.cap})),
  replenishments:out.replenishments.map(x=>({need:x.need,trainingCost:x.trainingCost,
    seconds:x.seconds})),
  trainingPaid:out.trainingPaid,fillToCap:out.fillToCap,
  quantumAttempt:out.quantumAttempt,onlineSeconds:out.clock.onlineSeconds,
  final:out.final,remainingTechCapGap:out.remainingTechCapGap,saveSha256:out.saveSha256},null,2));
