'use strict';
// P394: bounded, reproducible material-supply probe from an immutable paid save.
// Every credited item, battle loss and research payment uses the current game actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sourceFile='p393-tier3-city-star10-prebattle-paid-save.json';
const sourceRaw=fs.readFileSync(path.join(dataDir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceSha='df515a38dca073d7ff5fde1c235a48574b395041903b083f87d901c350380d51';
assert.equal(sha(sourceRaw),sourceSha,'P393 source changed');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const initialNow=JSON.parse(sourceRaw).ts;
let probeNow=initialNow;
const NativeDate=Date;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[probeNow]));}
  static now(){return probeNow;}
};

function boot(raw,seed=1){
  const env=environment({rts_save:raw}),run=env.run;
  const loaded=run('loadSaveAndApply()');
  assert.equal(loaded.status,'ok');
  const initialTick=run('S.tick');
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{
      constructor(...args){super(...(args.length?args:[${initialNow}+(S.tick-${initialTick})*1000]))}
      static now(){return ${initialNow}+(S.tick-${initialTick})*1000}
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
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
  return{env,run};
}
const items=['godCrystal','guardianStone','revivalLeaf','boarHeart','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew','storageScroll','sacredBlood','domainCleanser'];
function state(run){return run(`({tick:S.tick,resources:{tech:S.res.tech,medal:S.res.medal,food:S.res.food,
  copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,stone:S.res.stone,coal:S.res.coal},
  cap:resCap('tech'),items:Object.fromEntries(${JSON.stringify(items)}.map(k=>[k,S.items[k]])),
  kills:{godCrystal:S.killValues.godRevival,guardianStone:S.killValues.godGuardian,
    revivalLeaf:S.killValues.godRebirth,wildBoar:S.killValues.wildBoar,
    wildBull:S.killValues.wildBull,wildSnake:S.killValues.wildSnake,wildTiger:S.killValues.wildTiger,
    wildTurtle:S.killValues.wildTurtle,wildWyrm:S.killValues.wildWyrm},
  army:armyCount(),deployed:formSoldierCount(),
  storage:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
    nuclear:S.eraStorage.nuclearKnowledge},scrollUsed:S.beastExchange.scrollUsed,
  offers:{heart:S.beastExchange.heartOffers,
    wild:Object.fromEntries(Object.entries(S.beastExchange.wildOffers).map(([k,v])=>[k,{count:v.count,quality:v.quality}]))},
  refreshCharges:S.beastExchange.refreshCharges,refreshClock:S.beastExchange.refreshClock,
  battleEncounter:S.battleEncounter})`)}
function checkpoint(env,run){
  assert.equal(run('save().ok'),true);
  const raw=env.store.get('rts_save'),reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(JSON.stringify(state(reload.run)),JSON.stringify(state(run)));
  return{raw,sha256:sha(raw)};
}
function battle(world,key){
  const {env,run}=world,before=state(run);
  const encounter=run(`materialDomainEncounter(${JSON.stringify(key)})`);
  run(`openMaterialDomain(${JSON.stringify(key)})`);
  assert.equal(run('S.battleActive'),true,`${key} failed to open`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000,`${key} timed out`);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const after=state(run);
  const rewardKey=key==='godCrystal'||key==='guardianStone'||key==='revivalLeaf'?key:
    run(`specialEncounterConfig(${JSON.stringify(key)}).dropItem`);
  const alertKey={godCrystal:'godCrystal',guardianStone:'guardianStone',
    revivalLeaf:'revivalLeaf',bone:'wildBoar',bullHorn:'wildBull',
    snakeGall:'wildSnake',tigerPelt:'wildTiger',turtleShell:'wildTurtle',
    wyrmSinew:'wildWyrm'}[key];
  run('exitBattle()');
  const saved=checkpoint(env,run);
  const row={key,result,callbacks,enemyHpLeft,before:{army:before.army,deployed:before.deployed,
      stock:before.items[rewardKey],alert:before.kills[alertKey]},
    after:{army:after.army,deployed:after.deployed,stock:after.items[rewardKey],
      alert:after.kills[alertKey]},
    loss:before.army-after.army,gain:after.items[rewardKey]-before.items[rewardKey],
    expectedReward:encounter.reward[rewardKey]??null,saveSha256:saved.sha256};
  return row;
}

const base=boot(sourceRaw),start=state(base.run);
const cost=base.run(`({steam:eraStorageCost('steamKnowledge'),
  electric:eraStorageCost('electricKnowledge'),nuclear:eraStorageCost('nuclearKnowledge'),
  quantum:activeSciences().sci_quantum_age.cost})`);
const domainKeys=['godCrystal','guardianStone','revivalLeaf'];
const wildKeys=['boarHeart','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'];
const wildDomains={boarHeart:'bone',bullHorn:'bullHorn',snakeGall:'snakeGall',
  tigerPelt:'tigerPelt',turtleShell:'turtleShell',wyrmSinew:'wyrmSinew'};
const trials={};
for(const key of [...domainKeys,...wildKeys]){
  trials[key]=[];
  for(let seed=1;seed<=4;seed++){
    const world=boot(sourceRaw,seed);
    trials[key].push({...battle(world,wildDomains[key]||key),seed});
  }
}
const episodes={};
for(const [label,key,limit] of [['guardianStone','guardianStone',8],
    ['revivalLeaf','revivalLeaf',16],['wyrmSinew','wyrmSinew',5],
    ['godCrystal','godCrystal',8]]){
  const world=boot(sourceRaw,1),rows=[];
  for(let i=0;i<limit;i++){
    if(world.run('formSoldierCount()')<100)break;
    const row=battle(world,key);rows.push(row);
    if(row.result!=='win')break;
  }
  episodes[label]={rows,final:state(world.run),checkpointSha256:checkpoint(world.env,world.run).sha256};
}
const marketWorld=boot(sourceRaw,1),marketRun=marketWorld.run;
const market={startingStock:Object.fromEntries(wildKeys.map(k=>[k,marketRun(`S.items.${k}`)])),rounds:[],trades:[]};
function buyOffered(){
  const row=[];
  for(const key of wildKeys){
    while(marketRun(`beastScrollOfferCount(${JSON.stringify(key)})`)>0){
      const quoted=marketRun(`beastScrollTradeCost(${JSON.stringify(key)})`);
      const stock=marketRun(`S.items.${key}`);
      if(stock<quoted)break;
      const trade=marketRun(`exchangeWildMaterialForScrolls(${JSON.stringify(key)},1)`);
      assert.equal(trade.ok,true);
      const use=marketRun('useStorageScroll(1)');
      assert.equal(use.ok,true);
      const saved=checkpoint(marketWorld.env,marketRun);
      const entry={key,quoted,stockBefore:stock,stockAfter:marketRun(`S.items.${key}`),
        scrollUsed:marketRun('S.beastExchange.scrollUsed'),cap:marketRun("resCap('tech')"),
        saveSha256:saved.sha256};
      row.push(entry);market.trades.push(entry);
    }
  }
  return row;
}
market.rounds.push({kind:'initial-offers',purchases:buyOffered()});
for(let i=0;i<5;i++){
  const refreshed=marketRun('refreshBeastExchange()');
  assert.equal(refreshed.ok,true);
  market.rounds.push({kind:'charged-refresh',refreshed,
    offers:state(marketRun).offers,purchases:buyOffered()});
}
market.final=state(marketRun);
market.finalSaveSha256=checkpoint(marketWorld.env,marketRun).sha256;
function assignTech(run){
  for(const [key,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)
    assert.equal(run(`setPopAlloc(${JSON.stringify(key)},0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run("setPopAlloc('tech',902)")?.ok,true);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function fillTech(run,amount){
  assignTech(run);
  const before=state(run),rate=run("prodRate('tech')");
  const result=run(`(()=>{let n=0,minFood=S.res.food;
    while(S.res.tech<${amount}&&n<30000){tick();n++;minFood=Math.min(minFood,S.res.food)}
    return{seconds:n,done:S.res.tech>=${amount},minFood}})()`);
  assert.ok(result.done,'tech fill failed');
  assert.ok(result.minFood>0,'food exhausted during tech fill');
  return{before:before.resources.tech,after:run('S.res.tech'),rate,...result};
}
function replenish(world,target){
  const {run}=world,before=state(run),resBefore=run('({...S.res})');
  const targetByType={};
  for(const groups of Object.values(target))for(const u of groups)
    targetByType[u.type]=(targetByType[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need={};
  for(const [type,wanted]of Object.entries(targetByType))
    need[type]=Math.max(0,wanted-run(`poolAvail(${JSON.stringify(type)})`));
  let seconds=0,minFood=resBefore.food;
  const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
  let phase='training';
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
    seconds+=x.n;minFood=Math.min(minFood,x.min);phases[phase]+=x.n;
    assert.ok(x.min>0,'food depleted in recovery');return x;
  }
  function fillBasic(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource));
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,20000).done,resource+' timeout');
  }
  function fillProcessed(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource));
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
  const trainingCost={},order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
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
  for(const [row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail(${JSON.stringify(u.type)})`)>=u.count);
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=state(run),saved=checkpoint(world.env,run);
  assert.equal(after.deployed,626);assert.equal(after.army,672);
  assert.deepEqual(after.items,before.items);
  return{before:{army:before.army,deployed:before.deployed},need,trainingCost,seconds,minFood,
    phases,after:{army:after.army,deployed:after.deployed},saveSha256:saved.sha256};
}
// Separate source branch: replenish wild material after the first paid scroll.
const wildWorld=boot(sourceRaw,1),wildRun=wildWorld.run;
const wildSupply={cycles:[],marketRounds:[]};
assert.equal(wildRun("exchangeWildMaterialForScrolls('wyrmSinew',1)").ok,true);
assert.equal(wildRun('useStorageScroll(1)').ok,true);
wildSupply.afterFirstScroll=state(wildRun);
wildSupply.cleanseAttempt=wildRun("useDomainCleanser('wyrmSinew')");
assert.equal(wildSupply.cleanseAttempt.reason,'domain-locked');
for(let i=0;i<12&&wildRun('S.items.wyrmSinew')<200;i++){
  const cycle={before:state(wildRun)};
  cycle.hunt=battle(wildWorld,'wyrmSinew');
  if(cycle.hunt.result!=='win'){
    wildSupply.stop='wild battle lost';wildSupply.cycles.push(cycle);break;
  }
  if(cycle.hunt.loss>0)cycle.recovery=replenish(wildWorld,JSON.parse(sourceRaw).formation);
  cycle.after=state(wildRun);
  cycle.saveSha256=checkpoint(wildWorld.env,wildRun).sha256;
  wildSupply.cycles.push(cycle);
}
wildSupply.replenished=wildRun('S.items.wyrmSinew')>=200;
if(wildSupply.replenished){
  // Existing charges are spent through the real random shelf action. If the matching
  // offer is absent, a 1200-second tick interval earns one charge before retrying.
  for(let i=0;i<30&&wildRun('S.beastExchange.scrollUsed')<132;i++){
    const offers=wildRun("beastScrollOfferCount('wyrmSinew')");
    const price=wildRun("beastScrollTradeCost('wyrmSinew')");
    if(offers>0&&wildRun('S.items.wyrmSinew')>=price){
      const trade=wildRun("exchangeWildMaterialForScrolls('wyrmSinew',1)");
      assert.equal(trade.ok,true);
      const use=wildRun('useStorageScroll(1)');assert.equal(use.ok,true);
      wildSupply.marketRounds.push({kind:'paid',price,trade,use,
        saveSha256:checkpoint(wildWorld.env,wildRun).sha256});
      break;
    }
    if(wildRun('S.beastExchange.refreshCharges')<1){
      const beforeTick=wildRun('S.tick');
      wildRun('for(let j=0;j<1200;j++)tick()');
      wildSupply.marketRounds.push({kind:'wait-for-charge',seconds:wildRun('S.tick')-beforeTick});
    }
    const refreshed=wildRun('refreshBeastExchange()');
    assert.equal(refreshed.ok,true);
    wildSupply.marketRounds.push({kind:'refresh',offers:state(wildRun).offers,
      saveSha256:checkpoint(wildWorld.env,wildRun).sha256});
  }
}
wildSupply.final=state(wildRun);
wildSupply.finalSaveSha256=checkpoint(wildWorld.env,wildRun).sha256;
wildSupply.trainingPaid=wildRun('({...__trainingPaid})');
const wildCost=wildSupply.cycles.reduce((total,cycle)=>{
  for(const [key,amount]of Object.entries(cycle.recovery?.trainingCost||{}))
    total[key]=(total[key]||0)+amount;
  return total;
},{});
const canonicalCost=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
assert.equal(canonicalCost(wildSupply.trainingPaid),canonicalCost(wildCost));
fs.writeFileSync(path.join(dataDir,'p394-quantum-scroll-continuous-paid-save.json'),
  wildWorld.env.store.get('rts_save'));
const paidWorld=boot(sourceRaw,1),paidRun=paidWorld.run;
const paid={steps:[]};
function paidCheckpoint(label){
  const c=checkpoint(paidWorld.env,paidRun);
  paid.steps.push({label,state:state(paidRun),sha256:c.sha256});
  return c;
}
const scrollCost=paidRun("beastScrollTradeCost('wyrmSinew')");
assert.equal(scrollCost,160);
assert.equal(paidRun("exchangeWildMaterialForScrolls('wyrmSinew',1)").ok,true);
assert.equal(paidRun('useStorageScroll(1)').ok,true);
paid.firstScroll={materialCost:scrollCost,checkpoint:paidCheckpoint('first-scroll').sha256};
paid.leafBattles=[];
for(let i=0;i<8;i++){
  const row=battle(paidWorld,'revivalLeaf');paid.leafBattles.push(row);
  assert.equal(row.result,'win','leaf stream failed');
}
assert.ok(paidRun('S.items.revivalLeaf')>=cost.nuclear.revivalLeaf);
paid.leafCheckpoint=paidCheckpoint('eight-leaf-wins').sha256;
paid.nuclearTechFill=fillTech(paidRun,cost.nuclear.tech);
const nuclearBefore=state(paidRun);
paid.nuclearUpgrade=paidRun("upgradeEraStorage('nuclearKnowledge')");
assert.equal(paid.nuclearUpgrade.ok,true);
const nuclearAfter=state(paidRun);
assert.equal(nuclearAfter.storage.nuclear,nuclearBefore.storage.nuclear+1);
assert.equal(nuclearAfter.items.revivalLeaf,nuclearBefore.items.revivalLeaf-cost.nuclear.revivalLeaf);
paid.nuclearCheckpoint=paidCheckpoint('nuclear-upgrade').sha256;
paid.guardianBattles=[];
for(let i=0;i<5&&paidRun('S.items.guardianStone')<cost.electric.guardianStone;i++){
  const row=battle(paidWorld,'guardianStone');paid.guardianBattles.push(row);
  if(row.result!=='win')break;
}
paid.guardianReady=paidRun('S.items.guardianStone')>=cost.electric.guardianStone;
if(paid.guardianReady){
  paid.guardianCheckpoint=paidCheckpoint('guardian-wins').sha256;
  paid.electricTechFill=fillTech(paidRun,cost.electric.tech);
  const electricBefore=state(paidRun);
  paid.electricUpgrade=paidRun("upgradeEraStorage('electricKnowledge')");
  assert.equal(paid.electricUpgrade.ok,true);
  const electricAfter=state(paidRun);
  assert.equal(electricAfter.storage.electric,electricBefore.storage.electric+1);
  assert.equal(electricAfter.items.guardianStone,electricBefore.items.guardianStone-cost.electric.guardianStone);
  paid.electricCheckpoint=paidCheckpoint('electric-upgrade').sha256;
}
paid.beforeCrystal=state(paidRun);
paid.crystal={cycles:[],recoveryBefore:replenish(paidWorld,JSON.parse(sourceRaw).formation)};
for(let i=0;i<8&&paidRun('S.items.godCrystal')<cost.steam.godCrystal;i++){
  const beforeAlert=paidRun('S.killValues.godRevival');
  const beforeCleanse=state(paidRun);
  assert.ok(beforeAlert>=5000);
  const exchange=paidRun('exchangeDomainCleanser(1)');
  assert.equal(exchange.ok,true,'cleanser exchange failed');
  const cleanse=paidRun("useDomainCleanser('godCrystal')");
  assert.equal(cleanse.ok,true,'crystal alert cleanse failed');
  if(exchange.repeat||cleanse.repeat){
    const afterCleanse=state(paidRun);
    paid.crystal.blocked={iteration:i,reason:'future-op-idempotency',
      nowMs:paidRun('Date.now()'),sourceTs:JSON.parse(sourceRaw).ts,
      relevantOps:paidRun("S.ops.filter(o=>o.key==='domain-cleanser-exchange:market'||o.key==='domain-cleanser:godCrystal')"),
      exchange,cleanse,before:beforeCleanse,after:afterCleanse};
    assert.equal(JSON.stringify(afterCleanse),JSON.stringify(beforeCleanse));
    break;
  }
  assert.equal(paidRun('S.killValues.godRevival'),beforeAlert-100);
  if(i===0){
    const sameWindowBefore=state(paidRun);
    const repeatedExchange=paidRun('exchangeDomainCleanser(1)');
    const repeatedCleanse=paidRun("useDomainCleanser('godCrystal')");
    assert.equal(repeatedExchange.repeat,true);
    assert.equal(repeatedCleanse.repeat,true);
    assert.equal(JSON.stringify(state(paidRun)),JSON.stringify(sameWindowBefore));
    paid.crystal.sameWindowRepeat={exchange:repeatedExchange,cleanse:repeatedCleanse,
      stateUnchanged:true};
  }
  const row=battle(paidWorld,'godCrystal');
  const cycle={cleanser:{exchange,cleanse},battle:row};
  paid.crystal.cycles.push(cycle);
  if(row.result!=='win')break;
  if(paidRun('S.items.godCrystal')<cost.steam.godCrystal){
    if(row.loss>0)cycle.recovery=replenish(paidWorld,JSON.parse(sourceRaw).formation);
    if((cycle.recovery?.seconds||0)<6){paidRun('for(let j=0;j<6;j++)tick()');cycle.cooldownSeconds=6;}
  }
  cycle.saveSha256=paidCheckpoint('crystal-cycle-'+(i+1)).sha256;
}
paid.crystal.ready=paidRun('S.items.godCrystal')>=cost.steam.godCrystal;
if(paid.crystal.ready){
  paid.steamTechFill=fillTech(paidRun,cost.steam.tech);
  const steamBefore=state(paidRun);
  paid.steamUpgrade=paidRun("upgradeEraStorage('steamKnowledge')");
  assert.equal(paid.steamUpgrade.ok,true);
  const steamAfter=state(paidRun);
  assert.equal(steamAfter.storage.steam,steamBefore.storage.steam+1);
  assert.equal(steamAfter.items.godCrystal,steamBefore.items.godCrystal-cost.steam.godCrystal);
  paid.steamCheckpoint=paidCheckpoint('steam-upgrade').sha256;
}
paid.nextCosts=paidRun(`({steam:eraStorageCost('steamKnowledge'),
  electric:eraStorageCost('electricKnowledge'),nuclear:eraStorageCost('nuclearKnowledge')})`);
const beforeQuantumAttempt=state(paidRun);
paid.quantumAttempt=paidRun("researchScience('sci_quantum_age')");
assert.equal(paid.quantumAttempt.ok,false);
assert.equal(JSON.stringify(state(paidRun)),JSON.stringify(beforeQuantumAttempt));
paid.final=state(paidRun);
paid.trainingPaid=paidRun('({...__trainingPaid})');
const finalCheckpoint=checkpoint(paidWorld.env,paidRun);
paid.finalSaveSha256=finalCheckpoint.sha256;
fs.writeFileSync(path.join(dataDir,'p394-quantum-material-paid-save.json'),finalCheckpoint.raw);
assert.deepEqual(runtimeSha256,Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])));
const out={batch:'P394',source:{file:sourceFile,sha256:sourceSha},
  runtimeSha256,
  start,cost,trials,episodes,market,wildSupply,paid};
const outputPath=path.join(dataDir,'p394-quantum-material.json');
fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
assert.equal(sha(fs.readFileSync(path.join(dataDir,sourceFile),'utf8')),sourceSha);
console.log(JSON.stringify({sourceSha,summary:Object.fromEntries(Object.entries(trials).map(([k,rows])=>
  [k,{wins:rows.filter(r=>r.result==='win').length,losses:rows.map(r=>r.loss),
    gains:rows.map(r=>r.gain),closest:Math.min(...rows.map(r=>r.enemyHpLeft))}])),
  episodes:Object.fromEntries(Object.entries(episodes).map(([k,v])=>[k,{
    results:v.rows.map(r=>r.result),gains:v.rows.map(r=>r.gain),losses:v.rows.map(r=>r.loss),
    finalArmy:v.final.army,finalStock:v.final.items[k]}])),
  market:{trades:market.trades,refreshes:market.rounds.length-1,used:market.final.scrollUsed},
  wildSupply:{cycles:wildSupply.cycles.map(x=>({hunt:x.hunt&&{result:x.hunt.result,
    gain:x.hunt.gain,loss:x.hunt.loss},recoverySeconds:x.recovery?.seconds})),
    stop:wildSupply.stop,replenished:wildSupply.replenished,
    paid: wildSupply.marketRounds.find(x=>x.kind==='paid'),
    finalStock:wildSupply.final.items.wyrmSinew,scrollUsed:wildSupply.final.scrollUsed},
  paid:{leafWins:paid.leafBattles.length,leafLosses:paid.leafBattles.map(x=>x.loss),
    nuclearUpgrade:paid.nuclearUpgrade,guardianBattles:paid.guardianBattles.map(x=>({result:x.result,loss:x.loss,gain:x.gain})),
    electricUpgrade:paid.electricUpgrade,crystal:paid.crystal.cycles.map(x=>({result:x.battle.result,
      loss:x.battle.loss,gain:x.battle.gain,recoverySeconds:x.recovery?.seconds})),
    blocked:paid.crystal.blocked&&{nowMs:paid.crystal.blocked.nowMs,
      relevantOps:paid.crystal.blocked.relevantOps,exchange:paid.crystal.blocked.exchange,
      cleanse:paid.crystal.blocked.cleanse},steamUpgrade:paid.steamUpgrade,final:paid.final}},null,2));
