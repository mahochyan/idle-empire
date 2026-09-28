'use strict';
// P202: continue three paid, saved L31 victories through the real L32-L40 CFG.
// The historical P197 artifact supplies only old saves; this script never edits CFG.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p197-current-l30-l31-handoff.json');
const outputPath=path.join(root,'docs/codex/reports/data/p202-fourth-chapter-paid.json');
const sourceText=fs.readFileSync(sourcePath,'utf8');
const source=JSON.parse(sourceText);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const plain=v=>JSON.parse(JSON.stringify(v));
assert.equal(source.batch,'P197');
assert.equal(source.profiles.length,3);
const sourceHashes={
  p197:sha(sourceText),
  levels:sha(fs.readFileSync(path.join(root,'levels.js'))),
  math:sha(fs.readFileSync(path.join(root,'math.js'))),
  config:sha(fs.readFileSync(path.join(root,'config.js'))),
  technology:sha(fs.readFileSync(path.join(root,'technology.js')))
};

function boot(save,saveSha,label){
  assert.equal(sha(save),saveSha,`${label}: input save SHA`);
  const run=environment({rts_save:save}).run;
  assert.equal(run('loadSaveAndApply().status'),'ok',`${label}: load`);
  run(`globalThis.__p202Timers=new Map();globalThis.__p202TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p202TimerId++;
      __p202Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p202Timers.delete(id);
    globalThis.__p202Step=()=>{const next=__p202Timers.entries().next().value;
      if(!next)return false;__p202Timers.delete(next[0]);next[1]();return true};
    globalThis.__p202Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p202Nodes.has(id))__p202Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __p202Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return run;
}
function owned(run,type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function checkpoint(run){return plain(run(`({tick:S.tick,resources:{...S.res},
  pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue)),
  formation:JSON.parse(JSON.stringify(S.formation)),defeated:[...S.defeated],
  essence:{...S.essence},merit:S.merit,workers:{...S.popAlloc},
  population:JSON.parse(JSON.stringify(S.population)),
  settlements:JSON.parse(JSON.stringify(S.settlements)),
  buildings:JSON.parse(JSON.stringify(S.buildings)),
  sciences:[...S.sciences],upgradedUnits:{...S.upgradedUnits},
  army:armyCount(),upkeepPerSecond:totalUpkeep(),
  caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
  slots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')},
  regMax:regMax()})`))}
function compact(run){const s=checkpoint(run);return{
  tick:s.tick,resources:s.resources,merit:s.merit,workers:s.workers,
  army:s.army,upkeepPerSecond:s.upkeepPerSecond,caps:s.caps,
  slots:s.slots,regMax:s.regMax,population:run('popCurrent()'),
  capacity:run('maxPop()'),defeatedCount:s.defeated.length,
  owned:Object.fromEntries(['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
    .map(type=>[type,owned(run,type)])),queue:s.queue};}
function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}: save`);
  const save=run("localStorage.getItem('rts_save')");
  const next=boot(save,sha(save),`${label}: reload`);
  assert.deepEqual(checkpoint(next),checkpoint(run),`${label}: persisted state`);
  return{run:next,saveSha256:sha(save),save};
}
function foodEconomy(run){return plain(run(`({foodOutput:prodRate('food'),
  populationFood:popCurrent()*(CFG.popFoodCost??0.1),
  armyUpkeep:totalUpkeep(),
  netFood:prodRate('food')-popCurrent()*(CFG.popFoodCost??0.1)-totalUpkeep(),
  rates:{wood:prodRate('wood'),stone:prodRate('stone'),food:prodRate('food'),
    coal:prodRate('coal'),copper:prodRate('copper')},
  workers:{...S.popAlloc},army:armyCount(),food:S.res.food})`));}
function recover(run,stage,targets){
  const before=compact(run),requested={},produced={},paid={},paused={};
  const economyBefore=foodEconomy(run);
  let minFood=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const resources=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)return{ready:false,seconds:0,before,
      requested,produced,paid,paused,minFood,economyBefore,
      economyAfter:foodEconomy(run),after:compact(run),
      block:{type,action,lock:run(`trainLockReason('${type}')`),
        cap:run(`unitCap('${type}')`),have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),resources,
      `L${stage}: queue payment must wait for production`);
    produced[type]=0;
  }
  const ready=()=>Object.entries(targets).every(([type,n])=>owned(run,type)>=n);
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const k=`${type}: ${q.reason}`;
        paused[k]=(paused[k]||0)+1;}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`L${stage}: unexpected queue ${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,cost] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        paid[rk]=(paid[rk]||0)+made*cost;
    }
  }
  const result={ready:ready(),seconds,before,requested,produced,paid,
    paused,minFood,economyBefore,economyAfter:foodEconomy(run),after:compact(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage}: ${type} paid production`);
  else result.block={reason:'7200-second-recovery-limit',queue:plain(run('S.queue')),
    deficits:Object.fromEntries(Object.entries(targets).map(([type,n])=>
      [type,Math.max(0,n-owned(run,type))]))};
  return result;
}
function place(run,row,type,count,index){
  assert.ok(run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
    S.formation.${row}[${index}]?.count===${count}`),true);
}
function form(run,targets,stage){
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15,`L${stage}: regiment cap`);
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'front','infantry_t1',15,2);
  place(run,'back','archer_t1',13,0);
  if(targets.archer_t1===28)place(run,'back','archer_t1',15,1);
  else assert.equal(targets.archer_t1,13);
  const deployed=plain(run(`Object.fromEntries(['bronze_guard','cavalry_t1',
    'infantry_t1','archer_t1'].map(type=>[type,['front','mid','back']
    .flatMap(row=>S.formation[row]).filter(u=>u.type===type)
    .reduce((n,u)=>n+u.count,0)]))`));
  assert.deepEqual(deployed,targets,`L${stage}: deployed`);
  return{deployed,formation:plain(run('S.formation'))};
}
function enemy(stage,save,saveSha){
  const run=boot(save,saveSha,`L${stage}: enemy inspection`);
  const cfg=plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(cfg.id,stage);
  const stats=plain(run(`S.selEnemy=${stage-1};S.battleEncounter=null;
    B.isTraining=false;initBattleState();
    ({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound,
      byType:Object.fromEntries([...new Set(B.enemyUnits.map(u=>u.type))]
        .map(t=>[t,{groups:B.enemyUnits.filter(u=>u.type===t).length,
          hp:B.enemyUnits.filter(u=>u.type===t).reduce((n,u)=>n+u.hp,0),
          attackMass:B.enemyUnits.filter(u=>u.type===t)
            .reduce((n,u)=>n+u.atk*combatAttackMass(u),0)}]))})`));
  return{id:cfg.id,name:cfg.name,boss:!!cfg.boss,units:cfg.units,
    reward:cfg.reward,drops:cfg.drops||{},stats};
}
function setRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p202Rng=${initial};Math.random=()=>{
    let x=__p202Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p202Rng=x>>>0;return __p202Rng/4294967296;}`);
}
function battle(run,stage,seed,targets,label){
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:stage-1},(_,i)=>i+1),`${label}: sequential wins`);
  const preOwned=Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)]));
  const preRes=plain(run('({...S.res})'));
  const preEssence=plain(run('({...S.essence})'));
  setRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`${label}: open`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p202Step()'),true,`${label}: async callback`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${label}: settled`);
  const won=run(`S.defeated.includes(${stage})`);
  const round=run('B.round'),winner=run('B.winner');
  const postRes=plain(run('({...S.res})'));
  const postEssence=plain(run('({...S.essence})'));
  run('exitBattle()');
  const loaded=reload(run,label);
  const lossByType=Object.fromEntries(Object.entries(preOwned)
    .map(([type,n])=>[type,n-owned(loaded.run,type)]));
  assert.ok(Object.values(lossByType).every(n=>n>=0));
  const actualReward=Object.fromEntries(Object.keys(enemy(stage,loaded.save,
    loaded.saveSha256).reward).map(key=>[key,postRes[key]-preRes[key]]));
  const essenceDelta=Object.fromEntries(Object.keys(postEssence)
    .filter(key=>postEssence[key]!==preEssence[key])
    .map(key=>[key,postEssence[key]-(preEssence[key]||0)]));
  if(!won){assert.deepEqual(actualReward,{wood:0,stone:0,food:0});
    assert.deepEqual(essenceDelta,{});}
  return{run:loaded.run,record:{won,round,winner,callbacks,
    lossByType,lossTotal:Object.values(lossByType).reduce((n,v)=>n+v,0),
    actualReward,essenceDelta,post:compact(loaded.run),
    postSaveSha256:loaded.saveSha256}};
}
function fourthFront(save,saveSha,targets,label){
  let run=boot(save,saveSha,`${label}: fourth front source`);
  assert.equal(run("rowSlots('front')"),4,`${label}: fourth front unlocked`);
  const before=compact(run),economyBefore=foodEconomy(run);
  assert.equal(owned(run,'infantry_t1'),15);
  const extraTargets={...targets,infantry_t1:30};
  const trained=recover(run,36,extraTargets);
  if(!trained.ready)return{before,economyBefore,trained,block:trained.block};
  let saved=reload(run,`${label}: fourth front trained`);
  run=saved.run;
  run("clrForm('expedition')");
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'front','infantry_t1',15,2);
  place(run,'front','infantry_t1',15,3);
  place(run,'back','archer_t1',13,0);
  if(targets.archer_t1===28)place(run,'back','archer_t1',15,1);
  saved=reload(run,`${label}: fourth front formation`);
  run=saved.run;
  const after=compact(run),economyAfter=foodEconomy(run);
  assert.equal(after.army,before.army+15);
  assert.equal(after.slots.front,4);
  const foodBefore60=run('S.res.food');
  for(let i=0;i<60;i++)run('tick()');
  const after60=compact(run);
  const persisted=reload(run,`${label}: fourth front 60-second upkeep`);
  return{before,economyBefore,trained,after,economyAfter,
    extraUpkeepPerSecond:economyAfter.armyUpkeep-economyBefore.armyUpkeep,
    netFoodDeltaPerSecond:economyAfter.netFood-economyBefore.netFood,
    sixtySecondOnline:{foodBefore:foodBefore60,foodAfter:after60.resources.food,
      foodDelta:after60.resources.food-foodBefore60,
      savedSha256:persisted.saveSha256}};
}
function route(profile){
  const label=`${profile.sourceKind}流${profile.combatSeed}`;
  const save=profile.l31.postSave,saveSha=profile.l31.postSaveSha256;
  let run=boot(save,saveSha,`${label}: L31 win`);
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:31},(_,i)=>i+1),`${label}: old win history`);
  const targets=profile.targets;
  assert.deepEqual(Object.fromEntries(Object.keys(targets)
    .map(type=>[type,owned(run,type)])),
    Object.fromEntries(Object.keys(targets).map(type=>
      [type,targets[type]-(profile.l31.battle.lossByType[type]||0)])),
    `${label}: persisted battle losses`);
  const stages=[],start=compact(run);
  let fourthFrontCost=null;
  let block=null;
  for(let stage=32;stage<=40;stage++){
    const recovered=recover(run,stage,targets);
    if(!recovered.ready){block={stage,phase:'paid-recovery',detail:recovered.block};
      stages.push({stage,recovered});break;}
    let reloaded=reload(run,`${label} L${stage}: refill`);
    run=reloaded.run;
    if(stage===36)fourthFrontCost=fourthFront(reloaded.save,
      reloaded.saveSha256,targets,label);
    const formation=form(run,targets,stage);
    reloaded=reload(run,`${label} L${stage}: formation`);
    run=reloaded.run;
    const foe=enemy(stage,reloaded.save,reloaded.saveSha256);
    const fought=battle(run,stage,profile.combatSeed,targets,
      `${label} L${stage}`);
    run=fought.run;
    stages.push({stage,recovered,formation,enemy:foe,
      ...(stage>=39?{prepared:{save:reloaded.save,
        saveSha256:reloaded.saveSha256}}:{}),
      battle:fought.record});
    if(!fought.record.won){block={stage,phase:'battle',detail:{round:fought.record.round,
      winner:fought.record.winner,loss:fought.record.lossByType}};break;}
  }
  return{sourceKind:profile.sourceKind,seed:profile.combatSeed,
    sourceSaveSha256:saveSha,targets,start,stages,fourthFrontCost,block,
    final:compact(run)};
}
const profiles=source.profiles.map(route);
assert.deepEqual(profiles.map(p=>[p.sourceKind,p.seed]),
  [['P190',19],['P194',1],['P194',15]]);
const result={batch:'P202',unit:'simulated online seconds',
  sourceHead:source.sourceHead,inputs:sourceHashes,
  method:'Real current CFG; historical P197 complete L31-win saves; real queue, tick, formation, async battle, settlement, save and reload. No resource, soldier or victory injection.',
  profiles};
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P202',inputs:sourceHashes,
  profiles:profiles.map(p=>({sourceKind:p.sourceKind,seed:p.seed,
    completed:p.stages.filter(s=>s.battle?.won).map(s=>s.stage),block:p.block,
    fourthFront:p.fourthFrontCost&&{ready:p.fourthFrontCost.trained.ready,
      seconds:p.fourthFrontCost.trained.seconds,
      paid:p.fourthFrontCost.trained.paid,
      minFood:p.fourthFrontCost.trained.minFood,
      extraUpkeepPerSecond:p.fourthFrontCost.extraUpkeepPerSecond,
      netFoodDeltaPerSecond:p.fourthFrontCost.netFoodDeltaPerSecond,
      sixtySecondOnline:p.fourthFrontCost.sixtySecondOnline},
    stages:p.stages.map(s=>({stage:s.stage,refillSeconds:s.recovered.seconds,
      refillReady:s.recovered.ready,minFood:s.recovered.minFood,
      paid:s.recovered.paid,enemy:s.enemy&&{hp:s.enemy.stats.totalHp,
        attackMass:s.enemy.stats.attackMass},
      won:s.battle?.won,round:s.battle?.round,loss:s.battle?.lossTotal,
      foodAfter:s.battle?.post.resources.food}))}))},null,2));
