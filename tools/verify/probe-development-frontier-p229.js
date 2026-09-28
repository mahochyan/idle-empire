'use strict';
// P229: isolated battle pressure scan for the proposed development expedition.
// Only the VM's ordinary enemy entry is replaced. This is a combat surrogate,
// not an implementation of a second expedition, collection point or reward.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p166Path=path.join(__dirname,'probe-current-first-clear-population-p166.js');
const p167Path=path.join(root,'docs/codex/reports/data/p167-current-first-clear-campaign.json');
const p184Path=path.join(root,'docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const outputPath=path.join(root,'docs/codex/reports/data/p229-development-frontier.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const p167=JSON.parse(fs.readFileSync(p167Path,'utf8'));
const p184=JSON.parse(fs.readFileSync(p184Path,'utf8'));
assert.equal(p167.batch,'P167');
assert.equal(p184.batch,'P184');
assert.equal(sha(p184.preparedSave),p184.scope.preparedSaveSha256);

// Return P166's real paid P101/P102 preparation before its scenario branches.
// Source scripts are read only and never rewritten on disk.
function earlyPreparation(){
  const source=fs.readFileSync(p166Path,'utf8');
  const marker='const prepared=capturePreparation();';
  const at=source.indexOf(marker);
  assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0);
  const isolated=source.slice(0,at)+
    'return {capturePreparation,installBattleHarness,formArmy};\n'+source.slice(at);
  const helper=new Function('require','console','__dirname',isolated)(
    createRequire(p166Path),{log(){},error:console.error},path.dirname(p166Path));
  // P101/P102 derive save timestamps and formation IDs from Date.now(). Freeze
  // the source reconstruction so the output JSON itself is reproducible.
  const RealDate=global.Date,fixed=1790400000000;
  global.Date=class extends RealDate {
    constructor(...args){super(...(args.length?args:[fixed]))}
    static now(){return fixed}
  };
  try{return {prepared:helper.capturePreparation(),helper}}
  finally{global.Date=RealDate}
}
const early=earlyPreparation();
assert.equal(early.prepared.battleState.population,18);
assert.equal(early.prepared.battleState.army,36);
assert.deepEqual(early.prepared.battleState,p167.battleStartState,
  'P167 paid preparation state changed; raw save timestamps may differ');
assert.equal(early.prepared.battleState.resources.deed,0);

const cases=[
  {id:'border-r1',stage:1,role:'border',units:{infantry:[5,4],archer:[2]}},
  {id:'border-r2',stage:1,role:'border',units:{infantry:[6,5],archer:[3,2]}},
  {id:'border-r3',stage:1,role:'border',units:{infantry:[7,5,3],archer:[5,3]}},
  {id:'border-r4',stage:1,role:'border',units:{infantry:[8,6,4],archer:[6,4,2]}},
  {id:'village-v1',stage:20,role:'village',units:{infantry:[6,4,3],archer:[6,4,3],cavalry_t1:[4,3]}},
  {id:'village-v2',stage:20,role:'village',units:{infantry:[7,5,3],archer:[7,5,3],cavalry_t1:[5,4,2]}},
  {id:'village-v3',stage:20,role:'village',units:{infantry:[8,6,4],archer:[8,6,4],cavalry_t1:[6,4,2]}},
  {id:'village-chief',stage:20,role:'village',units:{bronze_guard:[2],infantry:[7,5,3],archer:[7,5,3],cavalry_t1:[5,4,2]}}
];
const flows=Array.from({length:16},(_,i)=>i+1);
const owned=(run,type)=>run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);

function place(run,row,type,count,slot){
  assert.ok(run(`rowSlots('${row}')`)>slot);
  assert.ok(run(`poolAvail('${type}')`)>=count);
  run(`openFormModal('expedition','${row}',${slot});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),count);
}
function formLate(run){
  run("clrForm('expedition')");
  place(run,'front','bronze_guard',15,0);
  place(run,'front','cavalry_t1',15,1);
  place(run,'back','archer_t1',13,0);
  assert.equal(run('armyCount()'),43);
}
function boot(entry){
  const save=entry.role==='border'?early.prepared.battleSave:p184.preparedSave;
  const world=environment({rts_save:save});
  const run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  early.helper.installBattleHarness(run);
  run(`globalThis.Date=class extends Date {static now(){return ${JSON.parse(save).ts+1}}}`);
  if(entry.role==='border')early.helper.formArmy(run);
  else formLate(run);
  const original=plain(run(`CFG.enemies[${entry.stage-1}]`));
  assert.equal(original.id,entry.stage);
  // Reward is intentionally empty: the proposed point/village reward path does
  // not exist yet. Existing challenge progression side effects stay in this VM.
  run(`CFG.enemies[${entry.stage-1}]={...CFG.enemies[${entry.stage-1}],
    name:${JSON.stringify(entry.id)},units:${JSON.stringify(entry.units)},
    reward:{},boss:false,bossMult:null,drops:null,firstClearReward:null}`);
  const targets=entry.role==='border'
    ?{infantry:15,archer:13,bronze_guard:8}
    :{bronze_guard:15,cavalry_t1:15,archer_t1:13};
  assert.deepEqual(Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)])),targets);
  const initial=plain(run(`({tick:S.tick,res:{...S.res},workers:{...S.popAlloc},
    pop:popCurrent(),capacity:maxPop(),formation:S.formation,defeated:[...S.defeated],
    foodRate:prodRate('food'),upkeep:totalUpkeep(),
    metalRates:{copper:prodRate('copper'),iron:prodRate('iron')},
    metalCaps:{copper:resCap('copper'),iron:resCap('iron')},
    metalLocks:{copper:workerLockReason('copper'),iron:workerLockReason('iron')},
    productionNext:{copper:productionSecond(1,false).copper,
      iron:productionSecond(1,false).iron}})`));
  return {world,run,save,targets,initial,original};
}
function seedRng(run,flow,stage){
  const seed=(flow*1009+stage*9176)>>>0;
  run(`globalThis.__p229Rng=${seed};globalThis.__p229Draws=0;
    Math.random=()=>{__p229Draws++;let x=__p229Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;__p229Rng=x>>>0;
      return __p229Rng/4294967296}`);
}
function recover(world,targets,woodSwap=false){
  const {run}=world;
  const staffing=[];
  if(woodSwap){
    assert.equal(run('S.popAlloc.wood'),0);
    assert.equal(run('S.popAlloc.stone'),6);
    const release=plain(run("setPopAlloc('stone',5)"));
    const assign=plain(run("setPopAlloc('wood',1)"));
    assert.equal(release.ok,true);
    assert.equal(assign.ok,true);
    staffing.push({release,assign,jobs:plain(run('({...S.popAlloc})'))});
  }
  const before=plain(run('({...S.res})'));
  const requested={};
  for(const [type,target] of Object.entries(targets)){
    const missing=target-owned(run,type)-(run(`S.queue['${type}']?.count||0`));
    requested[type]=Math.max(0,missing);
    if(missing>0){
      const result=plain(run(`train('${type}',${missing})`));
      assert.equal(result.ok,true,`${type} queue ${JSON.stringify(result)}`);
      assert.equal(result.qty,missing);
    }
  }
  run(`globalThis.__p229Paid={};globalThis.__p229PayMin=S.res.food;
    globalThis.__p229RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__p229RealPay(cost,n);
      __p229PayMin=Math.min(__p229PayMin,S.res.food);
      for(const [k,v] of Object.entries(cost))
        __p229Paid[k]=(__p229Paid[k]||0)+v*n}`);
  let seconds=0,minFood=run('S.res.food');
  const pauses={};
  const ready=()=>Object.entries(targets).every(([k,n])=>owned(run,k)>=n);
  while(!ready()&&seconds<3600){
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    for(const [type,q] of Object.entries(plain(run('S.queue'))))
      if(q.count>0&&q.reason)pauses[type+': '+q.reason]=(pauses[type+': '+q.reason]||0)+1;
  }
  const after=plain(run('({...S.res})'));
  const finalOwned=Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)]));
  const saveStatus=plain(run('save()'));
  const next=environment({rts_save:world.world.store.get('rts_save')});
  const reloadStatus=next.run('loadSaveAndApply().status');
  assert.equal(reloadStatus,'ok');
  assert.deepEqual(plain(next.run('({...S.res})')),after);
  assert.deepEqual(Object.fromEntries(Object.keys(targets).map(k=>[k,owned(next.run,k)])),finalOwned);
  return {ready:ready(),seconds,minFoodTickEnd:minFood,staffing,
    minFoodAfterPayment:run('__p229PayMin'),requested,
    paid:plain(run('({...__p229Paid})')),pauses,
    resBefore:before,resAfter:after,
    finalOwned,saveStatus,reloadStatus};
}
function fight(entry,flow,doRecovery){
  const world=boot(entry),{run,targets,initial}=world;
  const beforeOwned=Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)]));
  const before=plain(run(`({res:{...S.res},merit:S.merit,defeated:[...S.defeated],
    formation:JSON.parse(JSON.stringify(S.formation))})`));
  seedRng(run,flow,entry.stage);
  run(`selEnemy(${entry.stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({groups:B.enemyUnits.length,
    troops:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0),0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p166Step()'),true,entry.id+' lost callback');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,entry.id+' unsettled');
  const won=run(`S.defeated.includes(${entry.stage})`);
  const round=run('B.round'),draws=run('__p229Draws');
  const after=plain(run(`({res:{...S.res},merit:S.merit,defeated:[...S.defeated],
    formation:JSON.parse(JSON.stringify(S.formation))})`));
  const lossByType=Object.fromEntries(Object.keys(targets).map(k=>[k,beforeOwned[k]-owned(run,k)]));
  assert.ok(Object.values(lossByType).every(x=>x>=0));
  const actualResourceDelta=Object.fromEntries(Object.keys(before.res).map(k=>[k,after.res[k]-before.res[k]]).filter(([,v])=>v));
  run('exitBattle()');
  assert.equal(run('save().ok'),true);
  const settled=world.world.store.get('rts_save');
  const reloaded=environment({rts_save:settled});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  const row={case:entry.id,flow,role:entry.role,won,round,draws,callbacks,
    enemy,lossByType,lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
    actualResourceDelta,meritGain:after.merit-before.merit,
    challengeDefeatedAdded:after.defeated.includes(entry.stage),
    foodStart:initial.res.food,foodAfterBattle:after.res.food,
    foodRate:initial.foodRate,upkeep:initial.upkeep,
    metalRates:initial.metalRates,metalCaps:initial.metalCaps,
    metalLocks:initial.metalLocks,productionNext:initial.productionNext,
    formation:initial.formation,settledSaveSha256:sha(settled)};
  if(doRecovery||entry.id==='border-r1'){
    if(entry.role==='border'){
      const alternate=environment({rts_save:settled});
      assert.equal(alternate.run('loadSaveAndApply().status'),'ok');
      early.helper.installBattleHarness(alternate.run);
      row.recoveryWithWoodSwap=recover({world:alternate,run:alternate.run},targets,true);
    }
    if(doRecovery)row.recovery=recover(world,targets);
  }
  return row;
}
const selectedRecovery=new Set(['border-r1:4','border-r1:9','border-r1:14',
  'border-r2:1','border-r2:6','border-r2:11','border-r2:15',
  'border-r3:1','border-r3:15',
  'village-v1:1','village-v1:12','village-v1:15',
  'village-v2:1','village-v2:4','village-v2:7','village-v2:15']);
const rows=[];
for(const entry of cases)for(const flow of flows)
  rows.push(fight(entry,flow,selectedRecovery.has(entry.id+':'+flow)));
const summary=cases.map(entry=>{
  const sample=rows.filter(row=>row.case===entry.id);
  return {case:entry.id,role:entry.role,units:entry.units,
    wins:sample.filter(x=>x.won).length,samples:sample.length,
    losses:sample.map(x=>x.lossTotal),
    winningFlows:sample.filter(x=>x.won).map(x=>x.flow),
    woodSwapRecoveries:sample.filter(x=>x.recoveryWithWoodSwap)
      .map(x=>({flow:x.flow,lossTotal:x.lossTotal,ready:x.recoveryWithWoodSwap.ready,
        seconds:x.recoveryWithWoodSwap.seconds,
        minFoodAfterPayment:x.recoveryWithWoodSwap.minFoodAfterPayment,
        paid:x.recoveryWithWoodSwap.paid})),
    recoveries:sample.filter(x=>x.recovery).map(x=>({flow:x.flow,...x.recovery}))};
});
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'docs/codex/reports/data/p167-current-first-clear-campaign.json',
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json',
  '210(1)_unpacked/_analysis/entities_table.json'];
const data={batch:'P229',unit:'game seconds',head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  method:{kind:'Node VM real current battle functions; isolated ordinary-battle surrogate',
    challengeRewardNeutral:true,developmentProgressImplemented:false,
    seeds:flows,sourceEarlyBattleSaveSha256:sha(early.prepared.battleSave),
    sourceEarlyP167Sha256:p167.battleStartSaveSha256,
    sourceL20SaveSha256:sha(p184.preparedSave)},
  inputs:files.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
  cases,summary,rows};
fs.writeFileSync(outputPath,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({batch:data.batch,summary:summary.map(x=>({case:x.case,wins:x.wins,losses:x.losses,
  recoveries:x.recoveries.map(y=>({flow:y.flow,ready:y.ready,seconds:y.seconds,minFood:y.minFoodTickEnd,paid:y.paid}))}))}));
