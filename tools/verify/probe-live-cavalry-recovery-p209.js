'use strict';
// P209: paid L29 defeat recovery and independent retries from frozen P208 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p208-live-cavalry-formal.json');
const outputPath=path.join(root,'docs/codex/reports/data/p209-live-cavalry-recovery.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const seeds=[1,15];
assert.equal(source.batch,'P208');
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p208-live-cavalry-formal.json',
  'tools/verify/probe-live-cavalry-recovery-p209.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
for(const file of ['config.js','levels.js','math.js','garrison.js',
  'technology.js','tests/progression/harness.js']){
  assert.equal(inputs.find(x=>x.file===file).sha256,
    source.inputs.find(x=>x.file===file)?.sha256,
    `${file} 与P208正式基线不同`);
}
assert.equal(inputs.find(x=>x.file==='docs/codex/reports/data/p208-live-cavalry-formal.json').sha256,
  '14b77b3da51a534ef1ba6abb4161aa769a94cecf2b4b1580b3355fac662ec132');
const sourceBattle=source.runs.find(x=>x.originSeed===1&&x.seed===1&&x.stage===29);
assert.ok(sourceBattle&&!sourceBattle.battle.won);
assert.equal(sourceBattle.after.army,0);
assert.equal(sourceBattle.after.defeated.at(-1),28);
assert.equal(sha(sourceBattle.afterSave),sourceBattle.afterSaveSha256);
const enemy=source.scope.origins.find(x=>x.originSeed===1)?.enemy;
assert.ok(enemy?.id===29);
function installHarness(run){
  run(`globalThis.__p209Timers=new Map();globalThis.__p209TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p209TimerId++;__p209Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p209Timers.delete(id);
    globalThis.__p209Step=()=>{const next=__p209Timers.entries().next().value;
      if(!next)return false;__p209Timers.delete(next[0]);next[1]();return true};
    globalThis.__p209Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p209Nodes.has(id))__p209Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p209Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installHarness(run);
  return{world,run};
}
function snapshot(run){
  return plain(run(`({tick:S.tick,resources:{...S.res},merit:S.merit,
    essence:{...S.essence},defeated:[...S.defeated],
    workers:{...S.popAlloc},queue:JSON.parse(JSON.stringify(S.queue)),
    army:armyCount(),owned:Object.fromEntries(
      ['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
        .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    formation:JSON.parse(JSON.stringify(S.formation))})`));
}
function formPaidArmy(run){
  run('Math.random=()=>0.5');run("clrForm('expedition')");
  assert.equal(run('regMax()'),15);
  assert.ok(run("rowSlots('front')")>=3&&run("rowSlots('back')")>=2);
  function place(row,index,type,count){
    assert.ok(run(`S.pool.${type}||0`)>=count,`${type} 实付兵池不足`);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
      S.formation.${row}[${index}]?.count===${count}`),true);
  }
  place('front',0,'bronze_guard',15);place('front',1,'cavalry_wind',15);
  place('front',2,'infantry_t1',15);place('back',0,'archer_t1',13);
  place('back',1,'archer_t1',15);
  const formed=plain(run('JSON.parse(JSON.stringify(S.formation))'));
  const deployed={};
  for(const row of ['front','mid','back'])for(const u of formed[row])
    deployed[u.type]=(deployed[u.type]||0)+u.count;
  assert.deepEqual(deployed,{bronze_guard:15,cavalry_wind:15,
    infantry_t1:15,archer_t1:28});
  assert.equal(run('armyCount()'),73);
  return{formed,deployed};
}
function installObservation(run){
  run(`globalThis.__p209WindCritCount=0;
    globalThis.__p209WindTargets={front:0,mid:0,back:0,none:0,
      bypassFront:0,byType:{}};
    globalThis.__p209OriginalGetTarget=getTarget;
    getTarget=(attacker,enemies)=>{
      const target=__p209OriginalGetTarget(attacker,enemies);
      if(attacker.type==='cavalry_wind'){
        __p209WindTargets[target?.row||'none']++;
        if(target){
          __p209WindTargets.byType[target.type]=
            (__p209WindTargets.byType[target.type]||0)+1;
          const order={front:0,mid:1,back:2};
          const alive=enemies.filter(u=>u.alive!==false);
          const leading=Math.min(...alive.map(u=>order[u.row]));
          if(order[target.row]>leading)__p209WindTargets.bypassFront++;
        }
      }
      return target};
    globalThis.__p209OriginalCalcDmg=calcDmg;
    calcDmg=(attacker,defender,isOur)=>{
      const result=__p209OriginalCalcDmg(attacker,defender,isOur);
      if(attacker.type==='cavalry_wind'&&result.crit)__p209WindCritCount++;
      return result};
    globalThis.__p209BattleResult=null;
    globalThis.__p209OriginalEndBattle=endBattle;
    endBattle=result=>{__p209BattleResult=result;
      return __p209OriginalEndBattle(result)};`);
  const gates=plain(run(`({ranged:isRanged('cavalry_wind'),
    critChance:combatBaseCritChance({type:'cavalry_wind',tag:'wind'})})`));
  assert.equal(gates.ranged,true);
  assert.equal(gates.critChance,0.1);
  return gates;
}
function seedRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p209Rng=${initial};Math.random=()=>{
    let x=__p209Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p209Rng=x>>>0;return __p209Rng/4294967296;}`);
}
function battle(origin,seed,stage){
  let active=restore(origin.save),run=active.run;
  const original=snapshot(run);
  assert.equal(original.defeated.at(-1),origin.allowReplay?stage:stage-1);
  assert.equal(original.army,73);
  const currentEnemy=plain(run(`(()=>{const e=CFG.enemies[${stage-1}];
    return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
      bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(currentEnemy,origin.enemy,`L${stage}敌阵较P201时变化`);
  const {formed,deployed}=formPaidArmy(run);
  const before=snapshot(run);
  assert.deepEqual(before.resources,original.resources,'编队改了资源');
  const gates=installObservation(run);
  seedRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('B.enemyCfg.id'),stage);
  assert.equal(run("B.ourUnits.find(u=>u.type==='cavalry_wind')?.row"),'front');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p209Step()'),true,'异步回调丢失');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'战斗未结算');
  assert.equal(run('B.settled'),true);
  const round=run('B.round'),won=run("__p209BattleResult==='win'");
  assert.equal(run('S.defeated.includes(29)'),won||!!origin.allowReplay);
  const windCritCount=run('__p209WindCritCount');
  const windTargetRows=plain(run('__p209WindTargets'));
  const enemyRemaining=plain(run(`({groups:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0).length,
    hp:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0)
      .reduce((n,u)=>n+u.hp,0),
    soldiers:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0)
      .reduce((n,u)=>n+combatSurvivors(u),0),
    byType:Object.fromEntries([...new Set(B.enemyUnits.map(u=>u.type))]
      .map(k=>[k,B.enemyUnits.filter(u=>u.type===k&&u.alive!==false&&u.hp>0)
        .reduce((n,u)=>n+u.hp,0)]))})`));
  run('exitBattle()');
  const after=snapshot(run);
  const lossByType=Object.fromEntries(Object.entries(deployed)
    .map(([type,n])=>[type,n-after.owned[type]]));
  for(const [type,n] of Object.entries(lossByType))
    assert.ok(n>=0&&n<=deployed[type],`${type}战损超界`);
  const actualReward=Object.fromEntries(Object.keys(currentEnemy.reward)
    .map(rk=>[rk,after.resources[rk]-before.resources[rk]]));
  const essenceDrops=Object.fromEntries([...new Set([
    ...Object.keys(before.essence),...Object.keys(after.essence)])]
    .map(k=>[k,(after.essence[k]||0)-(before.essence[k]||0)])
    .filter(([,n])=>n>0));
  const afterSave=active.world.store.get('rts_save');
  assert.equal(typeof afterSave,'string');
  active=restore(afterSave);
  assert.deepEqual(snapshot(active.run),after,'结算存档重载不一致');
  assert.equal(sha(origin.save),origin.saveSha256,'源战前档被改动');
  return{originSeed:origin.originSeed,seed,stage,mode:'formal',gates,
    inputSaveSha256:origin.saveSha256,formation:formed,deployed,
    battle:{won,round,callbacks,windCritCount,windTargetRows,
      enemyRemaining,lossByType,
      lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
      nominalReward:currentEnemy.reward,actualReward,
      meritGain:after.merit-before.merit,essenceDrops},
    before:{resources:before.resources,queue:before.queue,army:before.army,
      owned:before.owned,merit:before.merit,essence:before.essence,
      defeated:before.defeated},
    after:{resources:after.resources,queue:after.queue,army:after.army,
      owned:after.owned,merit:after.merit,essence:after.essence,
      defeated:after.defeated,formation:after.formation},
    afterSaveSha256:sha(afterSave),afterSave,reloaded:true};
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label}保存失败`);
  const saved=active.world.store.get('rts_save');
  assert.equal(typeof saved,'string');
  const reloaded=restore(saved);
  assert.deepEqual(snapshot(reloaded.run),before,`${label}重载状态不一致`);
  return{...reloaded,save:saved,saveSha256:sha(saved)};
}
function replenish(inputSave,expectedLastDefeated,label){
  const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
  let active=restore(inputSave),run=active.run;
  assert.equal(run('S.defeated.at(-1)'),expectedLastDefeated);
  const before=snapshot(run),requested={},produced={},pausedQueueSeconds={};
  const caps=plain(run(`({wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')})`));
  let minFoodTickEnd=before.resources.food,tickEndZeroFoodSeconds=0;
  let block=null;
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;produced[type]=0;
    if(!need)continue;
    const lock=run(`trainLockReason('${type}')`);
    if(lock){block={type,phase:'lock',reason:lock,have,queued};break}
    const resourceBefore=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need){
      block={type,phase:'queue',action,have,queued,cap:run(`unitCap('${type}')`)};
      break;
    }
    assert.deepEqual(plain(run('({...S.res})')),resourceBefore,'排队提前扣资源');
  }
  run(`globalThis.__p209Paid=[];globalThis.__p209MinFoodAfterPay=S.res.food;
    globalThis.__p209PaymentZeroFoodCount=0;
    globalThis.__p209OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p209OriginalPay(cost,n);
      __p209MinFoodAfterPay=Math.min(__p209MinFoodAfterPay,S.res.food);
      if(S.res.food<=0)__p209PaymentZeroFoodCount++;
      __p209Paid.push({type,count:n,cost:{...cost},foodAfter:S.res.food})};`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!block&&!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    const food=run('S.res.food');
    minFoodTickEnd=Math.min(minFoodTickEnd,food);
    if(food<=0)tickEndZeroFoodSeconds++;
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p209Paid'));
  const trainingDue={};
  for(const item of paid){
    assert.ok(Object.hasOwn(targets,item.type),`未知训练付款 ${item.type}`);
    for(const [rk,c] of Object.entries(item.cost))
      trainingDue[rk]=(trainingDue[rk]||0)+c*item.count;
  }
  for(const [type,count] of Object.entries(produced))
    assert.equal(paid.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count,
      `${type} 实产与付款人数不符`);
  if(!block&&ready())for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`${type} 未实产到目标`);
  if(!block&&!ready())block={phase:'training-time-or-resource',seconds,
    queue:plain(run('S.queue')),resources:plain(run('S.res'))};
  active=saveReload(active,label);
  assert.deepEqual(snapshot(active.run).workers,before.workers,
    `${label}岗位意外变化`);
  assert.deepEqual(plain(active.run(`({wood:resCap('wood'),stone:resCap('stone'),
    food:resCap('food')})`)),caps,`${label}仓容意外变化`);
  return{active,summary:{targets,caps,before,requested,produced,paid,
    trainingDue,pausedQueueSeconds,minFoodTickEnd,tickEndZeroFoodSeconds,
    minFoodAfterPayment:run('__p209MinFoodAfterPay'),
    paymentZeroFoodCount:run('__p209PaymentZeroFoodCount'),seconds,
    ready:!block&&ready(),block,after:snapshot(active.run),
    afterSaveSha256:active.saveSha256,
    afterSave:active.save}};
}
const recovery=replenish(sourceBattle.afterSave,28,'L29败后补编');
const attempts=[];
let repeatRecovery=null,repeatAttempt=null;
if(recovery.summary.ready){
  for(const seed of seeds){
    attempts.push(battle({originSeed:1,save:recovery.active.save,
      saveSha256:recovery.active.saveSha256,enemy},seed,29));
  }
  const won=attempts.find(x=>x.seed===15&&x.battle.won);
  if(won){
    const branch=replenish(won.afterSave,29,'L29胜后重战补编');
    repeatRecovery=branch.summary;
    if(branch.summary.ready)
      repeatAttempt=battle({originSeed:1,save:branch.active.save,
        saveSha256:branch.active.saveSha256,enemy,allowReplay:true},15,29);
  }
}
assert.equal(sha(sourceBattle.afterSave),sourceBattle.afterSaveSha256,
  'P208 败后源档被改动');
const rewardBoundary=attempts.map(a=>({seed:a.seed,won:a.battle.won,
  stage29Before:a.before.defeated.filter(x=>x===29).length,
  stage29After:a.after.defeated.filter(x=>x===29).length,
  meritGain:a.battle.meritGain,actualReward:a.battle.actualReward,
  essenceDrops:a.battle.essenceDrops}));
if(repeatAttempt)rewardBoundary.push({seed:15,repeat:true,
  won:repeatAttempt.battle.won,
  stage29Before:repeatAttempt.before.defeated.filter(x=>x===29).length,
  stage29After:repeatAttempt.after.defeated.filter(x=>x===29).length,
  meritGain:repeatAttempt.battle.meritGain,
  actualReward:repeatAttempt.battle.actualReward,
  essenceDrops:repeatAttempt.battle.essenceDrops});
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
if(prior){
  assert.equal(prior.batch,'P209');
  const compact=list=>list.map(r=>({originSeed:r.originSeed,seed:r.seed,
    stage:r.stage,battle:r.battle,before:r.before,
    after:{...r.after,formation:Object.fromEntries(['front','mid','back']
      .map(row=>[row,r.after.formation[row].map(({id,...unit})=>unit)]))}}));
  assert.deepEqual(compact(attempts),compact(prior.attempts),'P209复跑战果不一致');
  assert.deepEqual(compact(repeatAttempt?[repeatAttempt]:[]),
    compact(prior.repeatAttempt?[prior.repeatAttempt]:[]),
    'P209复跑重复战果不一致');
  const nonSave=summary=>summary&&Object.fromEntries(Object.entries(summary)
    .filter(([k])=>!['afterSave','afterSaveSha256'].includes(k)));
  const stripDynamicIds=value=>JSON.parse(JSON.stringify(value,
    (key,item)=>key==='id'&&typeof item==='number'?undefined:item));
  assert.deepEqual(stripDynamicIds(nonSave(recovery.summary)),
    stripDynamicIds(nonSave(prior.recovery)),
    'P209复跑补编数值不一致');
  assert.deepEqual(stripDynamicIds(nonSave(repeatRecovery)),
    stripDynamicIds(nonSave(prior.repeatRecovery)),
    'P209复跑二次补编数值不一致');
  assert.deepEqual(rewardBoundary,prior.rewardBoundary,
    'P209复跑奖励边界不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const report={batch:'P209',sourceHead:head.stdout.trim(),
  method:'Exact frozen P208 origin1/flow1 formal L29 full defeat save. Keep jobs/caps. Live train, per-second tick, payTrainingCost, save/reload up to 7200s; independent fixed-flow 1/15 L29 retries. If flow15 wins, paid refill and repeat L29 once from its winning save to observe repeat reward/progress boundary. No resource/troop/stage injection.',
  scope:{seeds,sourceBattle:{originSeed:1,seed:1,
      afterSaveSha256:sourceBattle.afterSaveSha256,
      after:sourceBattle.after,battle:sourceBattle.battle},
    noOffline:true,noGarrison:true,noResourceInjection:true,
    rng:'xorshift32 initial=(seed*1009+29*9176)>>>0',
    inferenceLimit:'fixed streams, not player win rates'},
  recovery:recovery.summary,attempts,repeatRecovery,repeatAttempt,
  rewardBoundary,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:'P209',recovery:{ready:recovery.summary.ready,
  seconds:recovery.summary.seconds,block:recovery.summary.block,
  minFoodTickEnd:recovery.summary.minFoodTickEnd,
  tickEndZeroFoodSeconds:recovery.summary.tickEndZeroFoodSeconds},
  attempts:attempts.map(r=>({seed:r.seed,won:r.battle.won,
    round:r.battle.round,loss:r.battle.lossTotal,
    enemyHp:r.battle.enemyRemaining.hp,merit:r.battle.meritGain})),
  repeatRecovery:repeatRecovery&&{ready:repeatRecovery.ready,
    seconds:repeatRecovery.seconds,block:repeatRecovery.block},
  repeatAttempt:repeatAttempt&&{won:repeatAttempt.battle.won,
    loss:repeatAttempt.battle.lossTotal,
    merit:repeatAttempt.battle.meritGain},
  output:outputPath},null,2));
