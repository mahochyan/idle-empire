'use strict';
// P240: development-only pricing probe. The VM adds hypothetical coin to a
// true copper-border victory immediately before that victory's real save().
// All trading, village upgrades, births, staffing, training and combat use
// the current game functions. No player save or runtime file is changed.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p166Path=path.join(__dirname,'probe-current-first-clear-population-p166.js');
const p167Path=path.join(root,'docs/codex/reports/data/p167-current-first-clear-campaign.json');
const outPath=path.join(root,'docs/codex/reports/data/p240-border-economy.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const p167=JSON.parse(fs.readFileSync(p167Path,'utf8'));
const arms=['zero','fixed200','fixed400','motherMapped'];
const targets={infantry:15,archer:13,bronze_guard:8};
const stoneReserve=300,woodReserve=800,recoveryLimitSeconds=3600;
const newWorkerCycle=['food','wood','food','copper'];

function preparation(){
  const source=fs.readFileSync(p166Path,'utf8'),marker='const prepared=capturePreparation();';
  const at=source.indexOf(marker);
  assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0);
  const isolated=source.slice(0,at)+'return {capturePreparation,installBattleHarness,formArmy};\n'+source.slice(at);
  const helper=new Function('require','console','__dirname',isolated)(
    createRequire(p166Path),{log(){},error:console.error},path.dirname(p166Path));
  const RealDate=global.Date,fixed=1790400000000;
  global.Date=class extends RealDate {
    constructor(...args){super(...(args.length?args:[fixed]))}
    static now(){return fixed}
  };
  try{return{prepared:helper.capturePreparation(),helper}}
  finally{global.Date=RealDate}
}
const early=preparation();
assert.deepEqual(early.prepared.battleState,p167.battleStartState);
assert.equal(early.prepared.battleState.population,18);
assert.equal(early.prepared.battleState.resources.coin,97);
assert.equal(early.prepared.battleState.resources.deed,0);
const initialSaveSha256=hash(early.prepared.battleSave);
const owned=(run,type)=>run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
const state=run=>plain(run(`({tick:S.tick,res:{...S.res},workers:{...S.popAlloc},
  population:popCurrent(),capacity:maxPop(),growthClock:S.population.growthClock,
  settlements:{...S.settlements},site:{...S.development.border.sites.copper},
  defeated:[...S.defeated]})`));

function verifyReload(ctx,label){
  const saved=ctx.world.store.get('rts_save');
  assert.equal(typeof saved,'string',label+' save missing');
  const restored=environment({rts_save:saved});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok',label+' reload');
  assert.deepEqual(state(restored.run),state(ctx.run),label+' reload mismatch');
  return hash(saved);
}

function boot(arm,flow){
  const world=environment({rts_save:early.prepared.battleSave}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  early.helper.installBattleHarness(run);
  run(`globalThis.Date=class extends Date {static now(){return ${JSON.parse(early.prepared.battleSave).ts+1}}}`);
  early.helper.formArmy(run);
  assert.equal(run('S.sciences.includes("sci_copper")'),true);
  assert.equal(run('S.buildings.market.state'), 'idle');
  assert.ok(run('S.buildings.market.lv')>=1);
  assert.deepEqual(Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)])),targets);
  const seed=(flow*1009+9176)>>>0;
  run(`globalThis.__p240Rng=${seed};globalThis.__p240Draws=0;
    Math.random=()=>{__p240Draws++;let x=__p240Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __p240Rng=x>>>0;return __p240Rng/4294967296};
    globalThis.__p240Paid={};globalThis.__p240MinPayFood=S.res.food;
    globalThis.__p240RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__p240RealPay(cost,n);__p240MinPayFood=Math.min(__p240MinPayFood,S.res.food);
      for(const[k,v]of Object.entries(cost))__p240Paid[k]=(__p240Paid[k]||0)+v*n};
    globalThis.__p240Pulse={nominal:0,gained:0,count:0};
    globalThis.__p240RealProd=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=(...args)=>{const out=__p240RealProd(...args);
      if(out.collected){const lv=S.development.border.sites[out.resource].level;
        __p240Pulse.nominal+=lv*CFG.developmentCollection.yieldPerLevel[out.resource];
        __p240Pulse.gained+=out.gained;__p240Pulse.count++}return out};
    globalThis.__p240Arm='${arm}';globalThis.__p240Settlement=null;
    globalThis.__p240LastReward=null;globalThis.__p240RewardCount=0;
    globalThis.__p240RealEndBattle=endBattle;globalThis.__p240RealSave=save;
    endBattle=function(result){
      const valid=result==='win'&&!B.settled&&S.battleEncounter===CFG.developmentBorder.copper.key;
      const tx=valid?{beforeWins:S.development.border.sites.copper.wins,applied:false}:null;
      __p240Settlement=tx;
      try{return __p240RealEndBattle.call(this,result)}
      finally{if(tx?.applied){__p240LastReward=tx;__p240RewardCount++}__p240Settlement=null}
    };
    save=function(...args){
      const tx=__p240Settlement;
      if(tx&&!tx.applied&&B.settled&&S.development.border.sites.copper.wins===tx.beforeWins+1){
        const pre=tx.beforeWins*CFG.developmentBorder.copper.alertPerWin,post=pre+CFG.developmentBorder.copper.alertPerWin;
        tx.requested=__p240Arm==='zero'?0:__p240Arm==='fixed200'?200:__p240Arm==='fixed400'?400:
          Math.floor(400*(1+pre*40/5000)*godDomainTier(post,CFG.godDomain.rewardTiers));
        tx.coinBefore=S.res.coin;tx.coinCap=resCap('coin');
        tx.gained=tx.requested?creditResourceReward('coin',tx.requested):0;
        tx.coinAfter=S.res.coin;tx.applied=true;
      }
      const outcome=__p240RealSave.apply(this,args);
      if(tx?.applied)tx.saved=outcome.ok;
      return outcome;
    };`);
  const initial=state(run);
  assert.deepEqual(initial.defeated,[]);
  assert.equal(initial.population,18);
  assert.equal(initial.capacity,18);
  assert.equal(initial.res.coin,97);
  assert.equal(initial.res.deed,0);
  return{world,run,arm,flow,initial,seed,assigned:0};
}

function fight(ctx){
  const {run}=ctx;
  early.helper.formArmy(run);
  const ownedBefore=Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)]));
  const before=state(run);
  run('__p240LastReward=null');
  run("openDevelopmentBorder('copper')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p166Step()'),true,'lost combat callback');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle not settled');
  const after=state(run),won=after.site.wins===before.site.wins+1;
  const reward=plain(run('__p240LastReward'));
  if(won){
    assert.ok(reward?.applied&&reward.saved,'true win must reward in same battle save');
    assert.equal(reward.coinAfter-reward.coinBefore,reward.gained);
    assert.equal(after.res.coin,reward.coinAfter);
  }else{assert.equal(reward,null);assert.equal(after.res.coin,before.res.coin)}
  assert.deepEqual(after.defeated,before.defeated);
  const battleSaveSha256=verifyReload(ctx,'battle '+ctx.arm+'/'+ctx.flow+'/'+(before.site.wins+1));
  const lossByType=Object.fromEntries(Object.keys(targets).map(k=>[k,ownedBefore[k]-owned(run,k)]));
  run('exitBattle()');
  verifyReload(ctx,'exit '+ctx.arm+'/'+ctx.flow+'/'+(before.site.wins+1));
  return{won,round:run('B.round'),callbacks,enemy,lossByType,
    lossTotal:Object.values(lossByType).reduce((n,v)=>n+v,0),before,after,reward,
    battleSaveSha256};
}

function checked(run,expression,label){
  const result=plain(run(expression));
  assert.equal(result?.ok,true,label+': '+JSON.stringify(result));
  return result;
}

function finance(ctx){
  const {run}=ctx,before=state(run),sales=[];
  const villageCost=run("settlementCost('village')");
  assert.ok(Number.isSafeInteger(villageCost)&&villageCost>0);
  const missingDeeds=Math.max(0,villageCost-run('S.res.deed'));
  const coinsNeeded=missingDeeds*100;
  for(const [resource,reserve] of [['stone',stoneReserve],['wood',woodReserve]]){
    if(run('S.res.coin')>=coinsNeeded)break;
    const available=Math.max(0,Math.floor(run(`S.res.${resource}`)-reserve));
    if(!available)continue;
    const rate=run(`CFG.market.rates.find(r=>r.from==='${resource}'&&r.to==='coin'&&r.early).rate`);
    const deficit=coinsNeeded-run('S.res.coin');
    const qty=Math.min(available,Math.ceil(deficit/rate)+1);
    if(qty<Math.ceil(1/rate))continue;
    const coinBefore=run('S.res.coin');
    const sale=checked(run,`exchangeResource('${resource}','coin',${qty})`,resource+' sale');
    sales.push({resource,qty,coinBefore,coinReceived:sale.get,coinAfter:run('S.res.coin')});
  }
  let purchase=null,upgrade=null;
  if(missingDeeds>0&&run('S.res.coin')>=coinsNeeded){
    purchase=checked(run,`exchangeResource('coin','deed',${coinsNeeded})`,'coin to deed');
    assert.equal(purchase.get,missingDeeds);
  }
  if(run('S.res.deed')>=villageCost){
    upgrade=checked(run,"upgradeSettlement('village')",'village upgrade');
    assert.equal(upgrade.cost,villageCost);
    assert.equal(run('maxPop()'),before.capacity+1);
  }
  const after=state(run);
  if(after.tick===before.tick&&JSON.stringify(after)!==JSON.stringify(before))verifyReload(ctx,'finance');
  return{villageCost,missingDeeds,coinsNeeded,sales,purchase,upgrade,before,after};
}

function staffNewborns(ctx,assignments){
  const {run}=ctx;
  while(run('popFree()')>0){
    const resource=newWorkerCycle[ctx.assigned%newWorkerCycle.length];
    const old=run(`S.popAlloc.${resource}||0`);
    checked(run,`setPopAlloc('${resource}',${old+1})`,'new '+resource+' worker');
    ctx.assigned++;
    assignments.push({resource,workers:old+1,population:run('popCurrent()'),tick:run('S.tick')});
  }
}

function refill(ctx,stage){
  const {run}=ctx;
  const paidBefore=plain(run('({...__p240Paid})'));
  const pulseBefore=plain(run('({...__p240Pulse})'));
  const staffing=[],assignments=[];
  if(stage===1&&run('S.popAlloc.wood')===0){
    assert.equal(run('S.popAlloc.stone'),6);
    checked(run,"setPopAlloc('stone',5)",'stone reassignment');
    checked(run,"setPopAlloc('wood',1)",'wood reassignment');
    staffing.push({stone:5,wood:1});
  }
  const requests={};
  for(const[type,target]of Object.entries(targets)){
    const missing=Math.max(0,target-owned(run,type)-run(`S.queue['${type}']?.count||0`));
    requests[type]=missing;
    if(missing)checked(run,`train('${type}',${missing})`,type+' queue');
  }
  let seconds=0,minFood=run('S.res.food'),maxCopper=run('S.res.copper'),copperAtCapSeconds=0;
  const pauses={};
  const ready=()=>Object.entries(targets).every(([k,n])=>owned(run,k)>=n);
  // Ten real online seconds allow an eligible natural birth even when no
  // troop was lost; otherwise wait for both the birth and the paid roster.
  while((!ready()||run('popCurrent()')<run('maxPop()')||seconds<10)&&seconds<recoveryLimitSeconds){
    run('tick()');seconds++;
    staffNewborns(ctx,assignments);
    minFood=Math.min(minFood,run('S.res.food'));
    maxCopper=Math.max(maxCopper,run('S.res.copper'));
    if(run('S.res.copper>=resCap("copper")'))copperAtCapSeconds++;
    for(const[type,q]of Object.entries(plain(run('S.queue'))))
      if(q.count>0&&q.reason)pauses[type+': '+q.reason]=(pauses[type+': '+q.reason]||0)+1;
  }
  const paidAfter=plain(run('({...__p240Paid})'));
  const paid={};
  for(const key of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)]))
    if(paidAfter[key]!==paidBefore[key])paid[key]=(paidAfter[key]||0)-(paidBefore[key]||0);
  const pulseAfter=plain(run('({...__p240Pulse})'));
  const pulses={count:pulseAfter.count-pulseBefore.count,
    nominal:pulseAfter.nominal-pulseBefore.nominal,gained:pulseAfter.gained-pulseBefore.gained};
  assert.equal(run('save().ok'),true,'recovery save');
  const savedSha256=verifyReload(ctx,'recovery '+ctx.arm+'/'+ctx.flow+'/'+stage);
  return{ready:ready(),populationFilled:run('popCurrent()')===run('maxPop()'),seconds,
    minFoodTickEnd:minFood,minFoodAfterPayment:run('__p240MinPayFood'),
    requests,paid,pauses,staffing,assignments,pulses,maxCopper,copperAtCapSeconds,
    after:state(run),savedSha256};
}

function flow(arm,n){
  const ctx=boot(arm,n),rows=[];
  for(let stage=1;stage<=30;stage++){
    const row=fight(ctx);row.stage=stage;
    if(!row.won){rows.push(row);break}
    if(stage===1)checked(ctx.run,"selectDevelopmentSite('copper')",'select copper site');
    row.finance=finance(ctx);
    row.recovery=refill(ctx,stage);
    assert.ok(row.recovery.after.population<=row.recovery.after.capacity);
    assert.ok(Object.values(row.recovery.after.workers).reduce((a,b)=>a+b,0)<=row.recovery.after.population);
    rows.push(row);
    if(!row.recovery.ready||!row.recovery.populationFilled)break;
  }
  const final=state(ctx.run);
  assert.deepEqual(final.defeated,[]);
  assert.equal(ctx.run('__p240RewardCount'),final.site.wins);
  return{arm,flow:n,seed:ctx.seed,initial:ctx.initial,rows,
    wins:final.site.wins,stop:rows.length>=30&&rows.at(-1).won?'stage-30':
      rows.at(-1).won?'recovery-stall':'battle-defeat',
    final,pulses:plain(ctx.run('({...__p240Pulse})')),
    totalPaid:plain(ctx.run('({...__p240Paid})')),
    minPaymentFood:ctx.run('__p240MinPayFood'),
    rngDraws:ctx.run('__p240Draws')};
}

const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-border-continuous-p239.js',
  'docs/codex/reports/data/p167-current-first-clear-campaign.json',
  'docs/codex/reports/data/p239-border-continuous.json',
  '210(1)_unpacked/_analysis/entities_table.json',
  '210(1)_unpacked/_analysis/out_kill.txt',
  'tools/verify/probe-border-economy-p240.js'];
const inputs=inputFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const flows=arms.flatMap(arm=>Array.from({length:16},(_,i)=>flow(arm,i+1)));
for(const input of inputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file))),input.sha256,
  input.file+' changed during P240 run');
function compactState(x){return{tick:x.tick,population:x.population,capacity:x.capacity,
  workers:x.workers,settlements:x.settlements,site:x.site,
  res:{wood:x.res.wood,stone:x.res.stone,food:x.res.food,copper:x.res.copper,
    coin:x.res.coin,deed:x.res.deed},defeated:x.defeated}}
function compactFlow(x){return{arm:x.arm,flow:x.flow,seed:x.seed,wins:x.wins,stop:x.stop,
  final:compactState(x.final),pulses:x.pulses,totalPaid:x.totalPaid,
  minPaymentFood:x.minPaymentFood,rngDraws:x.rngDraws,
  rows:x.rows.map(r=>({stage:r.stage,won:r.won,round:r.round,callbacks:r.callbacks,
    enemy:r.enemy,lossByType:r.lossByType,lossTotal:r.lossTotal,
    battle:{site:r.after.site,coin:r.after.res.coin,deed:r.after.res.deed,
      population:r.after.population,capacity:r.after.capacity},
    reward:r.reward,battleSaveSha256:r.battleSaveSha256,
    finance:r.finance&&{villageCost:r.finance.villageCost,
      missingDeeds:r.finance.missingDeeds,coinsNeeded:r.finance.coinsNeeded,
      sales:r.finance.sales,purchase:r.finance.purchase,upgrade:r.finance.upgrade,
      after:{coin:r.finance.after.res.coin,deed:r.finance.after.res.deed,
        population:r.finance.after.population,capacity:r.finance.after.capacity}},
    recovery:r.recovery&&{ready:r.recovery.ready,populationFilled:r.recovery.populationFilled,
      seconds:r.recovery.seconds,minFoodTickEnd:r.recovery.minFoodTickEnd,
      minFoodAfterPaymentCumulative:r.recovery.minFoodAfterPayment,
      requests:r.recovery.requests,paid:r.recovery.paid,pauses:r.recovery.pauses,
      staffing:r.recovery.staffing,assignments:r.recovery.assignments,
      pulses:r.recovery.pulses,maxCopper:r.recovery.maxCopper,
      copperAtCapSeconds:r.recovery.copperAtCapSeconds,
      after:compactState(r.recovery.after),savedSha256:r.recovery.savedSha256}}))}}
for(const item of flows)assert.deepEqual(item.initial,flows[0].initial,'arms must share one paid save');
const report={batch:'P240',unit:'simulated online seconds',
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  method:'P167 real paid save; 16 seeded continuous flows per arm; hypothetical coin via real capped credit immediately before copper victory settlement save; real early-market sales and coin-to-deed exchange, one real village upgrade at most per win, real 10-second-minimum natural births and legal food/wood/food/copper staffing, real training/payment/tick/battle/save; no mainline wins',
  limitation:'The P239 army targets and formation are fixed across arms (15 infantry, 13 archers, 8 bronze guards). Extra population can shorten recovery and change resource sustainability, but this probe cannot show an improved single-battle win rate or passage through the approximately 500-alert enemy tier.',
  policies:{arms,coin:{zero:'0 per win',fixed200:'200 per win',fixed400:'400 per win (mother static base)',motherMapped:'floor(400*(1+preAlert*40/5000)*rewardTier(postAlert)), player bonus 1; local +20 alert/win'},
    resourceSaleOrder:['stone','wood'],stoneReserve,woodReserve,
    expansion:'up to one village level immediately after each victory; sell surplus only if coin short; retain food; no extra market-only wait',
    newWorkerCycle,recoveryLimitSeconds,minRecoverySeconds:10},
  initialSaveSha256,initial:compactState(flows[0].initial),inputs,flows:flows.map(compactFlow)};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:'P240',output:path.relative(root,outPath),initialSaveSha256,
  summary:arms.map(arm=>{const xs=flows.filter(f=>f.arm===arm);return{arm,
    wins:xs.map(f=>f.wins),population:xs.map(f=>f.final.population),
    capacity:xs.map(f=>f.final.capacity),
    earnedCoin:xs.map(f=>f.rows.reduce((n,r)=>n+(r.reward?.gained||0),0)),
    soldStone:xs.map(f=>f.rows.reduce((n,r)=>n+(r.finance?.sales||[]).filter(s=>s.resource==='stone').reduce((a,s)=>a+s.qty,0),0)),
    soldWood:xs.map(f=>f.rows.reduce((n,r)=>n+(r.finance?.sales||[]).filter(s=>s.resource==='wood').reduce((a,s)=>a+s.qty,0),0)),
    minPaymentFood:xs.map(f=>f.minPaymentFood)}})}));
