'use strict';
// P189: rebuild P187's missing full L21 save under current official L20
// roster, then carry the same paid cavalry formation toward L30.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p180Path=path.join(__dirname,'probe-current-l18-l20-cavalry-p180.js');
const p182DataPath=path.join(root,'docs/codex/reports/data/p182-current-l20-boss-roster.json');
const p184DataPath=path.join(root,'docs/codex/reports/data/p184-current-l20-boss-seeds.json');
const p187DataPath=path.join(root,'docs/codex/reports/data/p187-current-l20-worst-recovery.json');
const outputPath=path.join(root,'docs/codex/reports/data/p189-current-third-chapter.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p182=JSON.parse(fs.readFileSync(p182DataPath,'utf8'));
const p184=JSON.parse(fs.readFileSync(p184DataPath,'utf8'));
const p187=JSON.parse(fs.readFileSync(p187DataPath,'utf8'));
const targets={bronze_guard:15,cavalry_t1:15,archer_t1:13};
const seeds=[1,15],maxStage=30;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P189找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P189的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p182.batch,'P182');assert.equal(p184.batch,'P184');assert.equal(p187.batch,'P187');
for(const item of p187.inputs)
  if(item.file!=='levels.js')
    assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
      `P187非关卡文案/敌阵来源已变化：${item.file}`);
assert.equal(sha(p187.l20.finalSave),p187.l20.finalSaveSha256,
  'P187完整L20真实胜档SHA不符');
assert.equal(sha(p184.preparedSave),p184.scope.preparedSaveSha256,
  'P184完整L20战前档SHA不符');
function reuseP180(){
  let source=fs.readFileSync(p180Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return{restore,recovery,formCavalry,fight,owned,reload,state,snapshot};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P180真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p180Path),{log(){},error:console.error},path.dirname(p180Path));
}
const {restore,recovery,formCavalry,fight,owned,reload,state}=reuseP180();
function withoutVisibleAndUnits(cfg){
  const row=plain(cfg);
  delete row.name;delete row.desc;delete row.units;
  return row;
}
const officialL20=plain(restore(p184.preparedSave)('CFG.enemies[19]'));
assert.equal(officialL20.id,20);
assert.deepEqual(officialL20.units,
  {infantry:[8,6,4],archer:[8,6,4],cavalry_t1:[8,6,4]});
assert.deepEqual(withoutVisibleAndUnits(officialL20),
  withoutVisibleAndUnits(p182.originalEnemy),
  'L20正式配置除可见名/敌阵之外发生了变化');
function enemyStats(save,stage){
  const run=restore(save);
  const cfg=plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(cfg.id,stage);
  const battle=plain(run(`S.selEnemy=${stage-1};S.battleEncounter=null;B.isTraining=false;
    initBattleState();({groups:B.enemyUnits.length,
      totalHp:B.enemyUnits.reduce((sum,u)=>sum+u.hp,0),
      attackMass:B.enemyUnits.reduce((sum,u)=>sum+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound})`));
  return{config:{id:cfg.id,name:cfg.name,units:cfg.units,boss:!!cfg.boss,
    bossMult:cfg.bossMult||null,reward:cfg.reward},battle};
}
const officialL20Stats=enemyStats(p184.preparedSave,20);
assert.deepEqual(officialL20Stats.battle,
  {groups:p187.l20.enemyStats.groups,
    totalHp:p187.l20.enemyStats.totalHp,
    attackMass:p187.l20.enemyStats.actualAttackMass,
    maxRound:p187.l20.enemyStats.maxRound},
  '正式L20当前敌阵初始化与P187隔离[8,6,4]不一致');
const officialRun=restore(p184.preparedSave);
const officialEssenceBefore=plain(officialRun('({...S.essence})'));
const officialBattle=fight(officialRun,15,20,formCavalry);
const officialLoss=Object.fromEntries(Object.entries(targets).map(([type,target])=>
  [type,target-owned(officialRun,type)]));
const officialReward=Object.fromEntries(Object.keys(officialL20.reward).map(key=>
  [key,officialBattle.after.resources[key]-officialBattle.before.resources[key]]));
const officialEssenceAfter=plain(officialRun('({...S.essence})'));
const officialDrops=Object.fromEntries([...new Set([
  ...Object.keys(officialEssenceBefore),...Object.keys(officialEssenceAfter)])]
  .map(key=>[key,(officialEssenceAfter[key]||0)-(officialEssenceBefore[key]||0)])
  .filter(([,n])=>n>0));
const officialFinal=reload(officialRun,'P189当前正式L20');
const l20Reference=p187.l20.battle;
for(const [actual,expected,label] of [
  [officialBattle.won,l20Reference.won,'胜负'],
  [officialBattle.round,l20Reference.round,'回合'],
  [officialBattle.callbacks,l20Reference.callbacks,'回调'],
  [officialBattle.beforeDeployed,l20Reference.beforeDeployed,'入场'],
  [officialLoss,l20Reference.lossByType,'战损'],
  [officialReward,l20Reference.actualReward,'资源奖励'],
  [officialBattle.after.merit-officialBattle.before.merit,l20Reference.meritGain,'战功'],
  [officialDrops,l20Reference.essenceDrops,'精魄'],
  [state(officialFinal.run),p187.l20.postBattle,'战后重载']])
  assert.deepEqual(actual,expected,`正式L20与P187隔离结果${label}不一致`);
// P187 saved the full post-L20 state but only L21's hash. Recreate the actual
// L21 action chain with the current code and retain its full serialized save.
let l21Run=restore(p187.l20.finalSave);
assert.deepEqual(state(l21Run),p187.l20.postBattle,
  'P187旧完整L20胜档无法在当前配置下完整重载');
const l21Refill=recovery(l21Run,21);
assert.equal(l21Refill.ready,true);
assert.deepEqual(l21Refill.after,p187.recovery.after,
  '当前L21实付补兵轨迹与P187不一致');
const l21Before=reload(l21Run,'P189重建L21战前');
l21Run=l21Before.run;
const l21Enemy=enemyStats(l21Before.save,21);
assert.deepEqual({id:l21Enemy.config.id,name:l21Enemy.config.name,
  units:l21Enemy.config.units,reward:l21Enemy.config.reward,
  boss:l21Enemy.config.boss},p187.l21Enemy,
  '当前L21敌阵/奖励与P187历史不一致');
const l21Battle=fight(l21Run,15,21,formCavalry);
const l21After=reload(l21Run,'P189重建L21战后');
const l21Loss=Object.fromEntries(Object.entries(targets).map(([type,target])=>
  [type,target-owned(l21After.run,type)]));
const l21Reward=Object.fromEntries(Object.keys(l21Enemy.config.reward).map(key=>
  [key,l21Battle.after.resources[key]-l21Battle.before.resources[key]]));
for(const [actual,expected,label] of [
  [l21Battle.won,p187.l21.battle.won,'胜负'],
  [l21Battle.round,p187.l21.battle.round,'回合'],
  [l21Battle.callbacks,p187.l21.battle.callbacks,'回调'],
  [l21Battle.beforeDeployed,p187.l21.battle.beforeDeployed,'入场'],
  [l21Loss,p187.l21.battle.lossByType,'战损'],
  [l21Reward,p187.l21.battle.actualReward,'资源奖励'],
  [state(l21After.run),p187.l21.postBattle,'战后重载']])
  assert.deepEqual(actual,expected,`当前L21完整终档重建${label}不一致`);
assert.equal(l21Battle.won,true);
assert.equal(sha(l21After.save),l21After.saveSha256);
const l21SourceSave=l21After.save;
const mageGateRun=restore(l21SourceSave);
const mageGateBefore=plain(mageGateRun(`({bossCount:bossDefeatedCount(),
  mageUiVisible:mageOk(),mageTower:{...bldSt('mage_tower')},
  mageRootResearched:!!S.upgradedUnits.mage_t1,
  mageTrainingLock:trainLockReason('mage_t1'),
  enemyMageFirstStage:CFG.enemies.find(e=>e.units.mage_t1)?.id})`));
const mageGateActions={
  unlockRoot:mageGateRun("unlockUnitRoot('mage_t1')")??null,
  buildTower:mageGateRun("buildAct('mage_tower')")??null,
  trainMage:mageGateRun("train('mage_t1',1)")??null};
const mageGateAfter=plain(mageGateRun(`({bossCount:bossDefeatedCount(),
  mageTower:{...bldSt('mage_tower')},mageRootResearched:!!S.upgradedUnits.mage_t1,
  mageTrainingLock:trainLockReason('mage_t1'),resources:{...S.res},
  merit:S.merit})`));
assert.equal(mageGateBefore.bossCount,2);
assert.equal(mageGateBefore.enemyMageFirstStage,29);
assert.equal(mageGateBefore.mageTower.lv,0);
assert.equal(mageGateAfter.mageRootResearched,false);
assert.equal(mageGateActions.buildTower.ok,false);
assert.equal(mageGateActions.buildTower.reason,'need-boss');
assert.equal(mageGateActions.trainMage.ok,false);
assert.equal(mageGateActions.trainMage.reason,'locked');
assert.deepEqual(mageGateAfter.resources,state(restore(l21SourceSave)).checkpoint.resources);
const mageGate={before:mageGateBefore,actions:mageGateActions,after:mageGateAfter};
function route(seed){
  let run=restore(l21SourceSave),minFoodTickEnd=run('S.res.food');
  assert.deepEqual(state(run),p187.l21.postBattle,
    `随机流${seed} L21共同起点重载不一致`);
  const stages=[];
  for(let stage=22;stage<=maxStage;stage++){
    const enemy=enemyStats(run("localStorage.getItem('rts_save')"),stage);
    const refill=recovery(run,stage);
    minFoodTickEnd=Math.min(minFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){
      stages.push({stage,enemy,recovery:refill,battle:null,
        block:'training-time-or-resource'});
      break;
    }
    const before=reload(run,`P189种子${seed} L${stage}战前`);
    run=before.run;
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,formCavalry);
    for(const [type,target] of Object.entries(targets))
      assert.equal(battle.beforeDeployed[type],target,
        `P189种子${seed} L${stage} ${type}真实入场不符`);
    assert.equal(battle.beforeDeployed.infantry_t1,0);
    const after=reload(run,`P189种子${seed} L${stage}战后`);
    const losses=Object.fromEntries(Object.entries(targets).map(([type,target])=>
      [type,target-owned(after.run,type)]));
    const actualReward=Object.fromEntries(Object.keys(enemy.config.reward).map(key=>
      [key,battle.after.resources[key]-battle.before.resources[key]]));
    const essenceAfter=plain(after.run('({...S.essence})'));
    const essenceDrops=Object.fromEntries([...new Set([
      ...Object.keys(essenceBefore),...Object.keys(essenceAfter)])]
      .map(key=>[key,(essenceAfter[key]||0)-(essenceBefore[key]||0)])
      .filter(([,n])=>n>0));
    stages.push({stage,enemy,recovery:refill,
      beforeSaveSha256:before.saveSha256,
      battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
        formation:battle.formation,beforeDeployed:battle.beforeDeployed,
        lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
        nominalReward:enemy.config.reward,actualReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterSaveSha256:after.saveSha256,postBattle:state(after.run)});
    run=after.run;
    if(!battle.won)break;
  }
  const totals={recoverySeconds:stages.reduce((n,s)=>n+s.recovery.seconds,0),
    trainingDueByProduced:{},minimumFoodTickEnd:minFoodTickEnd,
    lastCleared:run('S.defeated.at(-1)'),
    firstBlockedStage:stages.find(s=>s.block||!s.battle?.won)?.stage||null};
  for(const stage of stages)for(const [key,value] of Object.entries(
    stage.recovery.dueByProduced||{}))
    totals.trainingDueByProduced[key]=(totals.trainingDueByProduced[key]||0)+value;
  return{seed,stages,totals,final:state(run)};
}
const profiles=seeds.map(route);
// A paid use of the third front slot unlocked by the same L20 save. This is a
// separate route from exactly the same L21 save; the baseline above stays intact.
const thirdTargets={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:13};
function thirdFront(run){
  run("clrForm('expedition')");
  assert.equal(run("rowSlots('front')"),3);
  assert.equal(run('regMax()'),15);
  function place(row,type,count,index){
    assert.ok(count>0&&run(`rowSlots('${row}')`)>index);
    assert.ok(run(`S.pool['${type}']||0`)>=count);
    run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),true);
  }
  place('front','bronze_guard',15,0);
  place('front','cavalry_t1',15,1);
  place('front','infantry_t1',15,2);
  place('back','archer_t1',13,0);
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function thirdRecovery(run,stage){
  const before=state(run),requested={},produced={},dueByProduced={},pausedQueueSeconds={};
  const gates=plain(run(`({frontSlots:rowSlots('front'),regMax:regMax(),
    infantryOwned:(S.pool.infantry_t1||0)+expeditionCount('infantry_t1')+garrisonCount('infantry_t1'),
    infantryCap:unitCap('infantry_t1'),infantryLock:trainLockReason('infantry_t1'),
    infantryCamp:{...bldSt('infantry_camp')},infantryResearch:!!S.upgradedUnits.infantry_t1,
    bossCount:bossDefeatedCount(),mageTower:{...bldSt('mage_tower')},
    mageLock:trainLockReason('mage_t1')})`));
  let minFoodTickEnd=run('S.res.food');
  for(const [type,target] of Object.entries(thirdTargets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)
      return{before,gates,seconds:0,ready:false,requested,produced,dueByProduced,
        pausedQueueSeconds,minFoodTickEnd,after:state(run),
        block:{type,action,lock:run(`trainLockReason('${type}')`),
          cap:run(`unitCap('${type}')`),owned:have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),pre,`L${stage}排队不应提前扣资源`);
    produced[type]=0;
  }
  function ready(){return Object.entries(thirdTargets).every(([type,n])=>owned(run,type)>=n)}
  let seconds=0;
  while(!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(thirdTargets,type),`L${stage}未知产出队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,c] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        dueByProduced[rk]=(dueByProduced[rk]||0)+made*c;
    }
  }
  const result={before,gates,seconds,ready:ready(),requested,produced,dueByProduced,
    pausedQueueSeconds,minFoodTickEnd,after:state(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type}实产数量与请求不一致`);
  return result;
}
function thirdRoute(seed){
  let run=restore(l21SourceSave),minimumFoodTickEnd=run('S.res.food');
  assert.deepEqual(state(run),p187.l21.postBattle);
  const stages=[];
  for(let stage=22;stage<=maxStage;stage++){
    const enemy=enemyStats(run("localStorage.getItem('rts_save')"),stage);
    const refill=thirdRecovery(run,stage);
    minimumFoodTickEnd=Math.min(minimumFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){
      stages.push({stage,enemy,recovery:refill,battle:null,
        block:refill.block||'training-time-or-resource'});
      break;
    }
    const before=reload(run,`P189第三前排种子${seed} L${stage}战前`);
    run=before.run;
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,thirdFront);
    for(const [type,target] of Object.entries(thirdTargets))
      assert.equal(battle.beforeDeployed[type],target,
        `P189第三前排种子${seed} L${stage} ${type}真实入场不符`);
    const after=reload(run,`P189第三前排种子${seed} L${stage}战后`);
    const losses=Object.fromEntries(Object.entries(thirdTargets).map(([type,target])=>
      [type,target-owned(after.run,type)]));
    const actualReward=Object.fromEntries(Object.keys(enemy.config.reward).map(key=>
      [key,battle.after.resources[key]-battle.before.resources[key]]));
    const essenceAfter=plain(after.run('({...S.essence})'));
    const essenceDrops=Object.fromEntries([...new Set([
      ...Object.keys(essenceBefore),...Object.keys(essenceAfter)])]
      .map(key=>[key,(essenceAfter[key]||0)-(essenceBefore[key]||0)])
      .filter(([,n])=>n>0));
    stages.push({stage,enemy,recovery:refill,
      beforeSaveSha256:before.saveSha256,
      battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
        formation:battle.formation,beforeDeployed:battle.beforeDeployed,
        lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
        nominalReward:enemy.config.reward,actualReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterSaveSha256:after.saveSha256,postBattle:state(after.run)});
    run=after.run;
    if(!battle.won)break;
  }
  const totals={recoverySeconds:stages.reduce((n,s)=>n+s.recovery.seconds,0),
    trainingDueByProduced:{},minimumFoodTickEnd,
    lastCleared:run('S.defeated.at(-1)'),
    firstBlockedStage:stages.find(s=>s.block||!s.battle?.won)?.stage||null};
  for(const stage of stages)for(const [key,value] of Object.entries(
    stage.recovery.dueByProduced||{}))
    totals.trainingDueByProduced[key]=(totals.trainingDueByProduced[key]||0)+value;
  const growth=plain(run(`({bossCount:bossDefeatedCount(),
    essence:{...S.essence},resources:{...S.res},
    barracks:{...bldSt('barracks')},barracksUpgrade:{
      lock:upgradeLockReason('barracks'),cost:upCost('barracks')},
    infantryCamp:{...bldSt('infantry_camp')},
    infantryTierUpgrade:{lock:tierUpgradeLockReason('infantry_camp'),
      cost:tierUpgradeCost('infantry_camp')},
    archerRange:{...bldSt('archer_range')},
    archerTierUpgrade:{lock:tierUpgradeLockReason('archer_range'),
      cost:tierUpgradeCost('archer_range')},
    mageTower:{...bldSt('mage_tower')},mageTrainingLock:trainLockReason('mage_t1'),
    frontSlots:rowSlots('front'),regMax:regMax(),
    infantryCap:unitCap('infantry_t1'),cavalryCap:unitCap('cavalry_t1'),
    archerCap:unitCap('archer_t1')})`));
  return{seed,stages,totals,final:state(run),growth};
}
const thirdFrontProfiles=seeds.map(thirdRoute);
function numericTrace(profile){
  return{seed:profile.seed,totals:profile.totals,final:profile.final,
    stages:profile.stages.map(s=>{
      const {formation,...battle}=s.battle||{};
      return{stage:s.stage,enemy:s.enemy,
        recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
          requested:s.recovery.requested,produced:s.recovery.produced,
          dueByProduced:s.recovery.dueByProduced,
          minFoodTickEnd:s.recovery.minFoodTickEnd,
          after:s.recovery.after},
        battle:s.battle?battle:null,postBattle:s.postBattle,block:s.block||null};
    })};
}
if(priorData){
  assert.equal(priorData.batch,'P189');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    'P189复跑数值轨迹不一致');
  if(priorData.thirdFrontProfiles)
    assert.deepEqual(thirdFrontProfiles.map(numericTrace),
      priorData.thirdFrontProfiles.map(numericTrace),
      'P189第三前排复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l18-l20-cavalry-p180.js',
  'docs/codex/reports/data/p182-current-l20-boss-roster.json',
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json',
  'docs/codex/reports/data/p187-current-l20-worst-recovery.json',
  'tools/verify/probe-current-third-chapter-p189.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P189',unit:'simulated online tick seconds, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'Check current official L20 8-6-4 boss by real battle against P187 isolated numeric result; load P187 genuine post-L20 save under current code, redo its real refill and L21 win, preserve this full serialized L21 save; fork seeds 1/15 from the same L21 save for 43-soldier baseline and separately pay/train/deploy 15 additional infantry T1 in the unlocked third front slot, refill via real queue/tick before each L22-L30 stage, use real formation, asynchronous battle callbacks, settlement and save/reload, stopping at first loss or training block',
  scope:{seeds,targets,thirdFrontTargets:thirdTargets,maxRecoverySeconds:7200,maxStage,
    noOffline:true,noGarrison:true,sourceConfigChanged:false},
  officialL20:officialL20Stats,
  officialL20Combat:{seed:15,won:officialBattle.won,round:officialBattle.round,
    callbacks:officialBattle.callbacks,lossByType:officialLoss,
    actualReward:officialReward,essenceDrops:officialDrops,
    postBattle:state(officialFinal.run)},
  l21Rebuilt:{sourceL20SaveSha256:p187.l20.finalSaveSha256,
    recoverySeconds:l21Refill.seconds,enemy:l21Enemy,
    battle:{won:l21Battle.won,round:l21Battle.round,
      lossByType:l21Loss,actualReward:l21Reward},
    saveSha256:l21After.saveSha256,save:l21SourceSave,
    state:state(l21After.run)},
  mageGate,
  profiles,thirdFrontProfiles,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P189',l21SaveSha256:l21After.saveSha256,
  officialL20:{hp:officialL20Stats.battle.totalHp,
    attackMass:officialL20Stats.battle.attackMass,
    won:officialBattle.won,round:officialBattle.round,
    loss:officialLoss},
  profiles:profiles.map(p=>({seed:p.seed,totals:p.totals,
    stages:p.stages.map(s=>({stage:s.stage,hp:s.enemy.battle.totalHp,
      attackMass:s.enemy.battle.attackMass,
      recoverySeconds:s.recovery.seconds,
      foodMin:s.recovery.minFoodTickEnd,
      won:s.battle?.won,round:s.battle?.round,
      loss:s.battle?.lossTotal,block:s.block||null}))})),
  thirdFrontProfiles:thirdFrontProfiles.map(p=>({seed:p.seed,totals:p.totals,
    stages:p.stages.map(s=>({stage:s.stage,hp:s.enemy.battle.totalHp,
      attackMass:s.enemy.battle.attackMass,
      recoverySeconds:s.recovery.seconds,
      foodMin:s.recovery.minFoodTickEnd,
      won:s.battle?.won,round:s.battle?.round,
      loss:s.battle?.lossTotal,block:s.block||null}))})),
  rawData:outputPath},null,2));
