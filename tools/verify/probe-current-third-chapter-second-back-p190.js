'use strict';
// P190: from P189's exact real L21 save, pay for a second ranger backline.
// Run both the 58- and 73-soldier routes through the same live game actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p180Path=path.join(__dirname,'probe-current-l18-l20-cavalry-p180.js');
const p189Path=path.join(root,'docs/codex/reports/data/p189-current-third-chapter.json');
const outputPath=path.join(root,'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p189=JSON.parse(fs.readFileSync(p189Path,'utf8'));
const seeds=[1,15],maxRecoverySeconds=7200,maxStage=30;
const targetsByRoute={
  thirdFront:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:13},
  secondBack:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28},
  secondBackFood6:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28},
  secondBackFood7:{bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28}
};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P190找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P190的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
assert.equal(p189.batch,'P189');
for(const item of p189.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P189输入已变：${item.file}`);
assert.equal(sha(p189.l21Rebuilt.save),p189.l21Rebuilt.saveSha256,
  'P189完整L21真实胜档SHA不符');
function reuseP180(){
  let source=fs.readFileSync(p180Path,'utf8');
  source=replaceOnce(source,
    'const profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'return{restore,fight,owned,reload,state,snapshot};\nconst profiles=[];\nfor(const seed of seeds)for(const disableReward of [false,true])',
    'P180真实动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p180Path),{log(){},error:console.error},path.dirname(p180Path));
}
const {restore,fight,owned,reload,state,snapshot}=reuseP180();
const sourceSave=p189.l21Rebuilt.save;
const sourceRun=restore(sourceSave);
assert.deepEqual(state(sourceRun),p189.l21Rebuilt.state,
  'P189完整L21胜档当前重载状态不一致');
const sourceGates=plain(sourceRun(`({frontSlots:rowSlots('front'),backSlots:rowSlots('back'),
  regMax:regMax(),archerOwned:(S.pool.archer_t1||0)+expeditionCount('archer_t1')+garrisonCount('archer_t1'),
  archerCap:unitCap('archer_t1'),archerLock:trainLockReason('archer_t1'),
  archerRange:{...bldSt('archer_range')},archerResearch:!!S.upgradedUnits.archer_t1,
  farm:{...bldSt('farm')},foodAlignedBasePerWorker:alignedResBase('food'),
  foodBuildingBuff:buildingBuff('food'),foodProductionRate:prodRate('food'),
  resources:{...S.res},workers:{...S.popAlloc},bossCount:bossDefeatedCount()})`));
assert.equal(sourceGates.frontSlots,3);
assert.equal(sourceGates.backSlots,2);
assert.equal(sourceGates.regMax,15);
assert.ok(sourceGates.archerCap>=28);
assert.equal(sourceGates.archerLock,'');
assert.equal(sourceGates.archerResearch,true);
assert.equal(sourceGates.archerRange.tier,1);
assert.equal(sourceGates.farm.lv,1);
assert.equal(sourceGates.farm.state,'idle');
assert.equal(sourceGates.foodAlignedBasePerWorker,2.25);
assert.ok(Math.abs(sourceGates.foodBuildingBuff-0.1)<1e-10);
assert.ok(Math.abs(sourceGates.foodProductionRate-12.375)<1e-10);

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
function foodEconomy(run){
  return plain(run(`({foodOutput:prodRate('food'),
    populationFood:popCurrent()*(CFG.popFoodCost??0.1),
    armyUpkeep:totalUpkeep(),
    netFood:prodRate('food')-popCurrent()*(CFG.popFoodCost??0.1)-totalUpkeep(),
    rates:{wood:prodRate('wood'),stone:prodRate('stone'),
      food:prodRate('food'),coal:prodRate('coal'),copper:prodRate('copper')},
    workers:{...S.popAlloc},army:armyCount(),food:S.res.food})`));
}
function recovery(run,stage,targets){
  const before=state(run),requested={},produced={},dueByProduced={},pausedQueueSeconds={};
  const economyBefore=foodEconomy(run);
  let minFoodTickEnd=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)
      return{before,seconds:0,ready:false,requested,produced,dueByProduced,
        pausedQueueSeconds,minFoodTickEnd,after:state(run),economyBefore,
        economyAfter:foodEconomy(run),
        block:{type,action,lock:run(`trainLockReason('${type}')`),
          cap:run(`unitCap('${type}')`),owned:have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),pre,`L${stage}排队不应提前扣资源`);
    produced[type]=0;
  }
  function ready(){return Object.entries(targets).every(([type,n])=>owned(run,type)>=n)}
  let seconds=0;
  while(!ready()&&seconds<maxRecoverySeconds){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`L${stage}未知产出队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,c] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        dueByProduced[rk]=(dueByProduced[rk]||0)+made*c;
    }
  }
  const result={before,seconds,ready:ready(),requested,produced,dueByProduced,
    pausedQueueSeconds,minFoodTickEnd,after:state(run),economyBefore,
    economyAfter:foodEconomy(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type}实产数量与请求不一致`);
  return result;
}
function formation(run,targets){
  run("clrForm('expedition')");
  assert.equal(run("rowSlots('front')"),3);
  assert.equal(run("rowSlots('back')"),2);
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
  if(targets.archer_t1===28)place('back','archer_t1',15,1);
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function route(seed,routeName){
  const targets=targetsByRoute[routeName];
  let run=restore(sourceSave),minimumFoodTickEnd=run('S.res.food');
  assert.deepEqual(state(run),p189.l21Rebuilt.state);
  let staffing=null;
  if(routeName==='secondBackFood6'||routeName==='secondBackFood7'){
    const moved=routeName==='secondBackFood7'?2:1;
    const before=foodEconomy(run);
    const coal=plain(run(`setPopAlloc('coal',${6-moved})`));
    const food=plain(run(`setPopAlloc('food',${5+moved})`));
    assert.equal(coal?.ok,true,`P190煤岗位调出${moved}人失败`);
    assert.equal(food?.ok,true,`P190粮岗位调入${moved}人失败`);
    const after=reload(run,`P190 ${routeName}岗位调整`);
    run=after.run;
    staffing={source:'coal',moved,actions:{coal,food},
      before,after:foodEconomy(run),saveSha256:after.saveSha256};
  }
  const stages=[];
  for(let stage=22;stage<=maxStage;stage++){
    const enemy=enemyStats(run("localStorage.getItem('rts_save')"),stage);
    const refill=recovery(run,stage,targets);
    minimumFoodTickEnd=Math.min(minimumFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){
      stages.push({stage,enemy,recovery:refill,battle:null,
        block:refill.block||'training-time-or-resource'});
      break;
    }
    const before=reload(run,`P190 ${routeName}种子${seed} L${stage}战前`);
    run=before.run;
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,active=>formation(active,targets));
    for(const [type,target] of Object.entries(targets))
      assert.equal(battle.beforeDeployed[type],target,
        `P190 ${routeName}种子${seed} L${stage} ${type}真实入场不符`);
    const after=reload(run,`P190 ${routeName}种子${seed} L${stage}战后`);
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
      ...(stage===30?{l30PreparedSave:before.save}:{}),
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
  return{seed,route:routeName,targets,staffing,stages,totals,final:state(run),
    finalSaveSha256:sha(run("localStorage.getItem('rts_save')"))};
}
const profiles=[];
for(const seed of seeds)for(const routeName of Object.keys(targetsByRoute)){
  profiles.push(route(seed,routeName));
}
for(const profile of profiles.filter(p=>p.route==='thirdFront'&&[1,15].includes(p.seed))){
  const prior=p189.thirdFrontProfiles.find(p=>p.seed===profile.seed);
  assert.ok(prior,`P189缺少种子${profile.seed}第三前排历史结果`);
  assert.deepEqual(profile.totals,prior.totals,
    `P190种子${profile.seed}第三前排总账与P189不一致`);
  assert.deepEqual(profile.stages.map(s=>({stage:s.stage,enemy:s.enemy,
    seconds:s.recovery.seconds,ready:s.recovery.ready,
    requested:s.recovery.requested,produced:s.recovery.produced,
    dueByProduced:s.recovery.dueByProduced,minFoodTickEnd:s.recovery.minFoodTickEnd,
    battle:s.battle&&{won:s.battle.won,round:s.battle.round,
      callbacks:s.battle.callbacks,beforeDeployed:s.battle.beforeDeployed,
      lossByType:s.battle.lossByType,nominalReward:s.battle.nominalReward,
      actualReward:s.battle.actualReward,meritGain:s.battle.meritGain,
      essenceDrops:s.battle.essenceDrops}})),
    prior.stages.map(s=>({stage:s.stage,enemy:s.enemy,
      seconds:s.recovery.seconds,ready:s.recovery.ready,
      requested:s.recovery.requested,produced:s.recovery.produced,
      dueByProduced:s.recovery.dueByProduced,minFoodTickEnd:s.recovery.minFoodTickEnd,
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        callbacks:s.battle.callbacks,beforeDeployed:s.battle.beforeDeployed,
        lossByType:s.battle.lossByType,nominalReward:s.battle.nominalReward,
        actualReward:s.battle.actualReward,meritGain:s.battle.meritGain,
        essenceDrops:s.battle.essenceDrops}})),
    `P190种子${profile.seed}第三前排逐关数值与P189不一致`);
}
const l30Prepared=profiles.flatMap(p=>p.stages
  .filter(s=>s.stage===30&&s.l30PreparedSave)
  .map(s=>({seed:p.seed,route:p.route,saveSha256:s.beforeSaveSha256,
    save:s.l30PreparedSave,enemy:s.enemy,battle:s.battle,
    preBattle:state(restore(s.l30PreparedSave))})));
for(const item of l30Prepared)
  assert.equal(sha(item.save),item.saveSha256,
    `P190 ${item.route}种子${item.seed} L30战前档SHA不符`);
function numericTrace(p){
  return{seed:p.seed,route:p.route,targets:p.targets,staffing:p.staffing&&{
    source:p.staffing.source,moved:p.staffing.moved,
    before:p.staffing.before,after:p.staffing.after},
    totals:p.totals,final:p.final,
    stages:p.stages.map(s=>({stage:s.stage,enemy:s.enemy,
      recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
        requested:s.recovery.requested,produced:s.recovery.produced,
        dueByProduced:s.recovery.dueByProduced,
        pausedQueueSeconds:s.recovery.pausedQueueSeconds,
        minFoodTickEnd:s.recovery.minFoodTickEnd,after:s.recovery.after,
        economyBefore:s.recovery.economyBefore,
        economyAfter:s.recovery.economyAfter,
        block:s.recovery.block||null},
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        callbacks:s.battle.callbacks,beforeDeployed:s.battle.beforeDeployed,
        lossByType:s.battle.lossByType,lossTotal:s.battle.lossTotal,
        nominalReward:s.battle.nominalReward,actualReward:s.battle.actualReward,
        meritGain:s.battle.meritGain,essenceDrops:s.battle.essenceDrops},
      postBattle:s.postBattle,block:s.block||null}))};
}
if(priorData){
  assert.equal(priorData.batch,'P190');
  if(profiles.length===priorData.profiles.length&&
      profiles.every((p,i)=>p.seed===priorData.profiles[i].seed&&
        p.route===priorData.profiles[i].route))
    assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
      'P190复跑数值轨迹不一致');
}
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-current-l18-l20-cavalry-p180.js',
  'docs/codex/reports/data/p189-current-third-chapter.json',
  'tools/verify/probe-current-third-chapter-second-back-p190.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P190',unit:'simulated online tick seconds, resources and soldiers',
  sourceHead:head.stdout.trim(),sourceSaveSha256:p189.l21Rebuilt.saveSha256,
  method:'Restore the exact full P189 post-L21 rts_save in isolated VM; compare live paid 58-soldier third-front baseline with 73-soldier second-back archer routes at original staffing, one coal-to-food worker shift, and two coal-to-food worker shifts, using true setPopAlloc/train/second ticks/formation/async battle/settlement/save/reload, stopping on first loss or 7200-second per-stage training block; fixed stage-specific combat RNG',
  scope:{seeds,maxRecoverySeconds,maxStage,targetsByRoute,noOffline:true,
    noGarrison:true,sourceConfigChanged:false},sourceGates,
  profiles,l30Prepared,
  inputs:inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P190',sourceSaveSha256:artifact.sourceSaveSha256,
  sourceGates,profiles:profiles.map(p=>({seed:p.seed,route:p.route,totals:p.totals,
    stages:p.stages.map(s=>({stage:s.stage,hp:s.enemy.battle.totalHp,
      attackMass:s.enemy.battle.attackMass,recoverySeconds:s.recovery.seconds,
      foodMin:s.recovery.minFoodTickEnd,won:s.battle?.won,
      round:s.battle?.round,loss:s.battle?.lossTotal,
      block:s.block||null}))})),
  l30Prepared:l30Prepared.map(({seed,route,saveSha256,battle})=>
    ({seed,route,saveSha256,won:battle.won,round:battle.round})),
  rawData:outputPath},null,2));
