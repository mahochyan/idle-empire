'use strict';
// P227: isolated L20 first-clear deed candidates on the current combat rules.
// The player CFG and all real browser saves remain untouched.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataPath=path.join(root,'docs/codex/reports/data/p227-l20-population-candidate.json');
const sourcePath=path.join(root,'docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const priorPath=path.join(root,'docs/codex/reports/data/p216-combat-order-downstream.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const p216=JSON.parse(fs.readFileSync(priorPath,'utf8'));
const maxStage=Number(process.argv[2]||22);
assert.ok(Number.isInteger(maxStage)&&maxStage>=22&&maxStage<=29);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
assert.equal(source.batch,'P184');
assert.equal(p216.batch,'P216');
assert.equal(sha(source.preparedSave),source.scope.preparedSaveSha256);
assert.equal(source.scope.preparedSaveSha256,
  p216.sources.find(x=>x.stage===20).sha256);
const inputTs=JSON.parse(source.preparedSave).ts;
const fixedNow=inputTs+1;
const target21={bronze_guard:15,cavalry_t1:15,archer_t1:13};
const target22={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28};

function boot(save,grant,label){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok',label+' load');
  assert.equal(run('saveProtected()'),false,label+' protected');
  assert.equal(run('CFG.enemies[19].firstClearReward'),undefined,
    'L20 award must still be absent from official CFG');
  run(`globalThis.Date=class extends Date {static now(){return ${fixedNow}}};
    globalThis.__p227Timers=new Map();globalThis.__p227TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p227TimerId++;
      __p227Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p227Timers.delete(id);
    globalThis.__p227Step=()=>{const next=__p227Timers.entries().next().value;
      if(!next)return false;__p227Timers.delete(next[0]);next[1]();return true};
    globalThis.__p227Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p227Nodes.has(id))__p227Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p227Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  if(grant>0)run(`CFG.enemies[19].firstClearReward={deed:${grant}};
    CFG.enemies[19].firstClearRewardName='拓居令'`);
  return {world,run,grant};
}
function snapshot(run){
  return plain(run(`({tick:S.tick,res:{...S.res},population:{...S.population},
    capacity:maxPop(),settlements:{...S.settlements},jobs:{...S.popAlloc},
    pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    queue:JSON.parse(JSON.stringify(S.queue)),defeated:[...S.defeated],
    essence:{...S.essence},merit:S.merit,army:armyCount(),
    foodRate:prodRate('food'),foodUpkeep:totalUpkeep()})`));
}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,label+' save');
  const save=active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const next=boot(save,active.grant,label+' reload');
  assert.deepEqual(snapshot(next.run),before,label+' state');
  return {...next,save,sha256:sha(save)};
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function form(run,targets){
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15);
  const rows=[['front','bronze_guard',15],['front','cavalry_t1',15]];
  if(targets.infantry_t1)rows.push(['front','infantry_t1',15]);
  rows.push(['back','archer_t1',13]);
  if(targets.archer_t1===28)rows.push(['back','archer_t1',15]);
  for(const [row,type,count] of rows){
    const slot=run(`S.formation.${row}.length`);
    assert.ok(slot<run(`rowSlots('${row}')`));
    assert.ok(run(`poolAvail('${type}')`)>=count);
    run(`openFormModal('expedition','${row}',${slot})`);
    run(`selModalUnit({classList:{add(){}}},'${type}',poolAvail('${type}'));
      setModalQty(${count});confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].type`),type);
    assert.equal(run(`S.formation.${row}[${slot}].count`),count);
  }
  assert.equal(run('armyCount()'),Object.values(targets).reduce((a,b)=>a+b,0));
}
function rng(run,flow,stage){
  const seed=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p227Rng=${seed};globalThis.__p227Draws=0;
    Math.random=()=>{__p227Draws++;let x=__p227Rng;x^=x<<13;
      x^=x>>>17;x^=x<<5;__p227Rng=x>>>0;
      return __p227Rng/4294967296}`);
}
function fight(active,flow,stage,targets,label){
  const {run}=active;
  form(run,targets);
  active=saveReload(active,label+' prepared');
  const before=snapshot(active.run);
  const saveBefore=active.save;
  rng(active.run,flow,stage);
  active.run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(active.run('S.battleActive'),true,label+' battle start');
  let callbacks=0;
  while(active.run('S.battleActive')&&callbacks<1500){
    assert.equal(active.run('__p227Step()'),true,label+' callback');
    callbacks++;
  }
  assert.equal(active.run('S.battleActive'),false,label+' settlement');
  const round=active.run('B.round');
  const draws=active.run('__p227Draws');
  const won=active.run(`S.defeated.includes(${stage})`);
  const ownedAfter=Object.fromEntries(Object.keys(targets).map(type=>
    [type,owned(active.run,type)]));
  const lossByType=Object.fromEntries(Object.entries(targets).map(([type,count])=>
    [type,count-ownedAfter[type]]));
  assert.ok(Object.values(lossByType).every(n=>n>=0));
  const resultText=active.run("document.getElementById('battle-result').innerHTML");
  active.run('exitBattle()');
  active=saveReload(active,label+' settled');
  const after=snapshot(active.run);
  const actualReward=Object.fromEntries(['wood','stone','food','deed'].map(key=>
    [key,after.res[key]-before.res[key]]));
  const battle={stage,flow,won,round,callbacks,draws,
    deployed:targets,lossByType,
    lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
    nominalReward:plain(active.run(`CFG.enemies[${stage-1}].reward`)),
    actualReward,meritGain:after.merit-before.merit,
    firstClearDisplay:resultText.includes('拓居令'),
    before,after,preparedSaveSha256:sha(saveBefore),
    settledSaveSha256:active.sha256};
  return {active,battle};
}
function tickOne(active,trace){
  active.run('tick()');trace.onlineSeconds++;
  trace.minFoodTickEnd=Math.min(trace.minFoodTickEnd,active.run('S.res.food'));
}
function marketTrade(active,trade,label){
  const plan=plain(active.run(`marketTradePlan(${JSON.stringify([trade])})`));
  assert.equal(plan.ok,true,label+' plan '+JSON.stringify(plan));
  assert.equal(plan.trades.length,1);
  const action=plain(active.run(`commitMarketTradePlan(${JSON.stringify(plan)})`));
  assert.equal(action.ok,true,label+' action '+JSON.stringify(action));
  const next=saveReload(active,label);
  return {active:next,plan,action};
}
function expand(active,label){
  const {run}=active,trace={onlineSeconds:0,
    minFoodTickEnd:run('S.res.food'),sales:[],purchases:[]};
  const start=snapshot(run);
  assert.equal(start.population.current,20);
  assert.equal(start.capacity,20);
  assert.equal(start.settlements.village,6);
  assert.equal(start.res.deed,active.grant);
  const cost=plain(run("settlementBatchPreview('village',2)"));
  assert.equal(cost.cost,23);
  assert.deepEqual(cost.costs,[11,12]);
  const missing=23-active.grant;
  if(missing>0){
    const targetCoin=missing*100;
    while(active.run('S.res.coin')<targetCoin){
      const coin=active.run('S.res.coin');
      const woodQty=Math.min((targetCoin-coin)*10,4400);
      while(active.run('S.res.wood')<400+woodQty){
        assert.ok(trace.onlineSeconds<7200,label+' sale wait');
        tickOne(active,trace);
      }
      const sold=marketTrade(active,{from:'wood',to:'coin',qty:woodQty},
        label+' wood sale '+(trace.sales.length+1));
      active=sold.active;
      trace.sales.push({wood:woodQty,coin:sold.plan.trades[0].get});
    }
    const bought=marketTrade(active,{from:'coin',to:'deed',qty:targetCoin},
      label+' buy '+missing+' deeds');
    active=bought.active;
    trace.purchases.push({coin:targetCoin,deed:bought.plan.trades[0].get});
  }
  assert.equal(active.run('S.res.deed'),23,label+' deeds ready');
  const expanded=plain(active.run("upgradeSettlementBatch('village',2,6,23)"));
  assert.equal(expanded.ok,true,label+' expansion');
  active=saveReload(active,label+' expansion');
  assert.equal(active.run('maxPop()'),22);
  assert.equal(active.run('S.population.current'),20);
  for(let i=0;i<10;i++)tickOne(active,trace);
  assert.equal(active.run('S.population.current'),22,label+' birth');
  assert.equal(active.run('setPopAlloc(\'food\',7).ok'),true);
  active=saveReload(active,label+' staffing');
  const end=snapshot(active.run);
  assert.equal(end.jobs.food,7);
  assert.equal(end.jobs.coal,6);
  assert.equal(end.res.deed,0);
  assert.equal(end.foodRate,17.325000000000003);
  trace.start=start;trace.end=end;
  trace.woodSold=trace.sales.reduce((n,s)=>n+s.wood,0);
  trace.coinSpent=trace.purchases.reduce((n,p)=>n+p.coin,0);
  trace.finalSaveSha256=active.sha256;
  return {active,trace};
}
function replenish(active,targets,label){
  const {run}=active,requested={},produced={},paused={};
  const before=snapshot(run);
  let minFoodTickEnd=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;produced[type]=0;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'',label+' lock '+type);
    const prior=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action.ok,true,label+' queue '+type);
    assert.equal(action.qty,need);
    assert.deepEqual(plain(run('({...S.res})')),prior);
  }
  run(`globalThis.__p227Paid=[];globalThis.__p227FoodPayMin=S.res.food;
    globalThis.__p227RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p227RealPay(cost,n);
      __p227Paid.push({type,count:n,cost:{...cost},foodAfter:S.res.food});
      __p227FoodPayMin=Math.min(__p227FoodPayMin,S.res.food)}`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const next=plain(run('S.queue'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){const key=type+': '+q.reason;
        paused[key]=(paused[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const payments=plain(run('__p227Paid'));
  const due={};
  for(const item of payments)for(const [rk,n] of Object.entries(item.cost))
    due[rk]=(due[rk]||0)+item.count*n;
  for(const [type,count] of Object.entries(produced))
    assert.equal(payments.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count);
  return {before,requested,produced,due,paused,seconds,ready:ready(),
    minFoodTickEnd,minFoodAfterPayment:run('__p227FoodPayMin'),
    after:snapshot(run)};
}
function checkRepeat(save,grant,label){
  const active=boot(save,grant,label);
  const before=snapshot(active.run);
  assert.equal(before.defeated.includes(20),true);
  active.run(`S.selEnemy=19;S.battleEncounter=null;
    S._preForm={front:[],mid:[],back:[]};
    S.formation={front:[],mid:[],back:[]};
    B={settled:false,isTraining:false,ourUnits:[],enemyUnits:[],
      trainingStats:{},round:0};endBattle('win')`);
  const resultText=active.run("document.getElementById('battle-result').innerHTML");
  assert.equal(active.run('S.res.deed'),before.res.deed,label+' no replay grant');
  assert.equal(resultText.includes('拓居令'),false,label+' no replay display');
  assert.equal(active.run('S.defeated.filter(x=>x===20).length'),1);
  return {deedBefore:before.res.deed,deedAfter:active.run('S.res.deed'),
    showedReward:resultText.includes('拓居令')};
}
function route(flow,grant){
  const label=`flow${flow}/grant${grant}`;
  let active=boot(source.preparedSave,grant,label);
  assert.deepEqual(plain(active.run('S.defeated')),
    Array.from({length:19},(_,i)=>i+1));
  assert.equal(active.run('S.res.deed'),0);
  let first=fight(active,flow,20,target21,label+'/L20');
  active=first.active;
  assert.equal(first.battle.won,true);
  assert.equal(first.battle.actualReward.deed,grant);
  assert.equal(first.battle.firstClearDisplay,grant>0);
  const l20Save=active.save;
  const repeat=checkRepeat(l20Save,grant,label+'/repeat');
  let growth=expand(active,label+'/expand');
  active=growth.active;
  const l22EntrySave=active.save;
  const stages=[];
  for(let stage=21;stage<=maxStage;stage++){
    const targets=stage===21?target21:target22;
    const refill=replenish(active,targets,label+'/L'+stage);
    if(!refill.ready){stages.push({stage,refill,battle:null,
      blocked:'not-full-within-7200-online-seconds'});break;}
    active=saveReload(active,label+'/L'+stage+' refill');
    const result=fight(active,flow,stage,targets,label+'/L'+stage);
    active=result.active;
    stages.push({stage,refill,battle:result.battle});
    if(!result.battle.won)break;
  }
  return {flow,grant,l20:first.battle,repeat,expansion:growth.trace,
    l20SaveSha256:sha(l20Save),l22EntrySaveSha256:sha(l22EntrySave),
    stages,totals:{onlineSeconds:snapshot(active.run).tick-
      JSON.parse(source.preparedSave).tick,
      expansionSeconds:growth.trace.onlineSeconds,
      recoverySeconds:stages.reduce((n,s)=>n+s.refill.seconds,0),
      minFoodTickEnd:Math.min(growth.trace.minFoodTickEnd,
        ...stages.map(s=>s.refill.minFoodTickEnd)),
      minFoodAfterPayment:Math.min(...stages.map(s=>s.refill.minFoodAfterPayment)),
      lastCleared:active.run('S.defeated.at(-1)')},
    final:snapshot(active.run),finalSaveSha256:sha(active.save),
    finalSave:active.save};
}
const oldSave=p216.cases.find(x=>x.stage===20&&x.flow===1).post.save;
const oldWinNoRetro=checkRepeat(oldSave,23,'old L20 win');
assert.equal(oldWinNoRetro.deedBefore,0);
const routes=[];
for(const flow of [1,15])for(const grant of [0,11,23])
  routes.push(route(flow,grant));
for(const flow of [1,15]){
  const same=routes.filter(x=>x.flow===flow);
  const formal=p216.cases.find(x=>x.stage===20&&x.flow===flow)?.battle;
  assert.ok(formal);
  assert.deepEqual({won:same[0].l20.won,round:same[0].l20.round,
    callbacks:same[0].l20.callbacks,draws:same[0].l20.draws,
    losses:same[0].l20.lossByType},
  {won:formal.won,round:formal.round,callbacks:formal.callbacks,
    draws:formal.rngDraws,losses:formal.lossByType},
  'P227 current L20 control differs from P216 formal replay');
  for(const x of same.slice(1)){
    assert.deepEqual({won:x.l20.won,round:x.l20.round,draws:x.l20.draws,
      losses:x.l20.lossByType},
    {won:same[0].l20.won,round:same[0].l20.round,draws:same[0].l20.draws,
      losses:same[0].l20.lossByType});
    for(const stage of same[0].stages){
      const candidate=x.stages.find(y=>y.stage===stage.stage);
      assert.ok(candidate);
      assert.deepEqual({won:candidate.battle?.won,round:candidate.battle?.round,
        losses:candidate.battle?.lossByType},
      {won:stage.battle?.won,round:stage.battle?.round,
        losses:stage.battle?.lossByType},
      `L${stage.stage}/flow${flow} growth candidates changed combat result`);
    }
  }
}
const inputFiles=['config.js','levels.js','math.js','garrison.js',
  'technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json',
  'docs/codex/reports/data/p216-combat-order-downstream.json',
  'tools/verify/probe-l20-population-candidate-p227.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P227',sourceHead:head.stdout.trim(),
  scope:{maxStage,flows:[1,15],grants:[0,11,23],
    candidateOnlyInIsolatedVm:true,officialChallengeL20Unchanged:true,
    developmentDungeonPopulationRewardsNotCovered:true,
    rng:'xorshift32 (flow*1009+stage*9176)>>>0',
    clock:'simulated online tick seconds; battle callbacks instantaneous',
    noGarrison:true,noOffline:true},
  sourceSaveSha256:source.scope.preparedSaveSha256,
  oldWinNoRetro,routes,inputs};
fs.writeFileSync(dataPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P227',maxStage,sourceSaveSha256:artifact.sourceSaveSha256,
  oldWinNoRetro,routes:routes.map(r=>({flow:r.flow,grant:r.grant,
    l20:{won:r.l20.won,loss:r.l20.lossTotal,reward:r.l20.actualReward},
    expansion:{seconds:r.expansion.onlineSeconds,woodSold:r.expansion.woodSold,
      coinSpent:r.expansion.coinSpent,minFood:r.expansion.minFoodTickEnd},
    stages:r.stages.map(s=>({stage:s.stage,refillSeconds:s.refill.seconds,
      refillReady:s.refill.ready,foodMinTick:s.refill.minFoodTickEnd,
      foodMinPayment:s.refill.minFoodAfterPayment,
      won:s.battle?.won,loss:s.battle?.lossTotal})),
    totals:r.totals})),output:dataPath},null,2));
