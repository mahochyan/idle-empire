'use strict';
// P170: obtain the real P167 state immediately after the first L5 clear.
// The historical P167 route is instrumented in memory; no player state or
// resource is injected. All later actions use the live VM functions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p167Path=path.join(__dirname,'probe-current-first-clear-campaign-p167.js');
const outputPath=path.join(root,'docs/codex/reports/data/p170-t1-handoff-feasibility.json');
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P170找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P170的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
function reuseP167(){
  let source=fs.readFileSync(p167Path,'utf8');
  source=replaceOnce(source,
    '    if(!row.won)break;\n    const training=stage>=3?queueToTarget(run,stage):[];',
    `    if(!row.won)break;
    if(stage===5){
      checked(run,'save()','P170首通L5存档');
      const checkpointSave=run("localStorage.getItem('rts_save')");
      return{seed,workerPolicy:workerPolicy.name,branch:disableReward?'no-L3-reward':'current-L3-plus-six',
        battles,checkpoint:snapshot(run),checkpointSave,checkpointSaveSha256:sha(checkpointSave)};
    }
    const training=stage>=3?queueToTarget(run,stage):[];`,
    'L5真实首胜返回点');
  source=replaceOnce(source,'const profiles=workerPolicies.flatMap',
    'return {runBranch,workerPolicies,seeds,prepared,snapshot,installBattleHarness,checked,plain,battleRng};\nconst profiles=workerPolicies.flatMap',
    'P167同源路线返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p167Path),{log(){},error:console.error},path.dirname(p167Path));
}
const {runBranch,workerPolicies,snapshot,installBattleHarness,battleRng}=reuseP167();
function state(run){
  return plain(run(`({tick:S.tick,defeated:[...S.defeated],population:popCurrent(),capacity:maxPop(),
    resources:{...S.res},merit:S.merit,workers:{...S.popAlloc},sciences:[...S.sciences],
    upgradedUnits:{...S.upgradedUnits},buildings:JSON.parse(JSON.stringify(S.buildings)),
    pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    queue:JSON.parse(JSON.stringify(S.queue)),maxTrainableT1:{infantry:maxTrainable('infantry_t1'),archer:maxTrainable('archer_t1')},
    tierLocks:{infantry:tierUpgradeLockReason('infantry_camp'),archer:tierUpgradeLockReason('archer_range')},
    trainingLocks:{infantry:trainLockReason('infantry_t1'),archer:trainLockReason('archer_t1')},
    caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food'),tech:resCap('tech')},
    army:armyCount(),upkeepPerSecond:totalUpkeep(),recentLog:S.log.slice(-8)})`));
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function compact(run){
  const s=state(run);
  return{tick:s.tick,population:s.population,resources:s.resources,merit:s.merit,
    workers:s.workers,tiers:Object.fromEntries(['infantry_camp','archer_range']
      .map(k=>[k,{tier:s.buildings[k].tier,state:s.buildings[k].state,timer:s.buildings[k].timer}])),
    owned:Object.fromEntries(['infantry','archer','bronze_guard','infantry_t1','archer_t1']
      .map(k=>[k,owned(run,k)])),queue:s.queue,tierLocks:s.tierLocks,
    trainingLocks:s.trainingLocks,recentLog:s.recentLog};
}
function place(run,row,type,count,index){
  assert.ok(count>0&&run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),true);
}
function formT1(run){
  run("clrForm('expedition')");
  let frontIndex=0,bronze=run('S.pool.bronze_guard||0'),infantry=run('S.pool.infantry_t1||0');
  if(bronze>0){const n=Math.min(10,bronze);place(run,'front','bronze_guard',n,frontIndex++);bronze-=n}
  while(infantry>0&&frontIndex<run("rowSlots('front')")){
    const n=Math.min(10,infantry);place(run,'front','infantry_t1',n,frontIndex++);infantry-=n;
  }
  while(bronze>0&&frontIndex<run("rowSlots('front')")){
    const n=Math.min(10,bronze);place(run,'front','bronze_guard',n,frontIndex++);bronze-=n;
  }
  let archer=run('S.pool.archer_t1||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archer>0;i++){
    const n=Math.min(10,archer);place(run,row,'archer_t1',n,i);archer-=n;
  }
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function deployed(formation){
  const out={bronze_guard:0,infantry_t1:0,archer_t1:0};
  for(const row of ['front','mid','back'])for(const unit of formation[row])
    if(Object.hasOwn(out,unit.type))out[unit.type]+=unit.count;
  return out;
}
function attemptBattle(run,seed,stage){
  assert.equal(run('S.defeated.length'),stage-1,`L${stage}不可跳关`);
  const formation=formT1(run);
  const before=compact(run);
  battleRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p166Step()'),true,`L${stage}战斗回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage}未结算`);
  const battle={stage,won:run(`S.defeated.includes(${stage})`),round:run('B.round'),callbacks,
    before,formation,beforeDeployed:deployed(formation),after:compact(run)};
  run('exitBattle()');
  return battle;
}
function handoff(run,seed){
  const start=compact(run),ledger=[];
  let minFood=start.resources.food;
  function observe(){minFood=Math.min(minFood,run('S.res.food'))}
  function action(label,expression,validate=true){
    const before=compact(run),result=run(expression);
    if(validate)assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
    const after=compact(run);
    ledger.push({label,expression,result:plain(result??null),before,after});
    observe();
    return result;
  }
  function waitFor(label,predicate,maxSeconds){
    const before=compact(run);
    let seconds=0;
    while(!predicate()&&seconds<maxSeconds){run('tick()');observe();seconds++}
    const after=compact(run);
    ledger.push({label,seconds,met:predicate(),before,after});
    return predicate();
  }
  function waitExactly(label,seconds){
    const before=compact(run),paused={};
    for(let i=0;i<seconds;i++){
      run('tick()');observe();
      for(const [type,q] of Object.entries(plain(run('S.queue'))))
        if(q.count>0&&q.reason)paused[`${type}: ${q.reason}`]=(paused[`${type}: ${q.reason}`]||0)+1;
    }
    const after=compact(run);
    ledger.push({label,seconds,pausedQueueSeconds:paused,before,after});
  }
  function assertPayment(item,cost,tech=0,merit=0){
    for(const [rk,amount] of Object.entries(cost)){
      if(rk==='time')continue;
      const paid=item.before.resources[rk]-item.after.resources[rk];
      assert.ok(Math.abs(paid-amount)<1e-7,`${item.label}/${rk} 实扣${paid}，应扣${amount}`);
    }
    assert.equal(item.before.resources.tech-item.after.resources.tech,tech,`${item.label} 科技扣费错误`);
    assert.equal(item.before.merit-item.after.merit,merit,`${item.label} 战功扣费错误`);
  }
  // These are real controls. Old pending troops would otherwise consume the
  // wood reserved for camp upgrades, and the upgrades cancel them anyway.
  for(const type of ['infantry','archer']){
    const queued=run(`S.queue['${type}']?.count||0`);
    if(queued>0){
      const before=compact(run);
      run(`cancelQueue('${type}')`);
      assert.equal(run(`S.queue['${type}']?.count||0`),0);
      ledger.push({label:`取消旧${type}队列`,expression:`cancelQueue('${type}')`,
        queued,before,after:compact(run)});
    }
  }
  action('调离2名石工',"setPopAlloc('stone',4)");
  action('安排2名木工',"setPopAlloc('wood',2)");
  const upgrades=[{key:'infantry_camp',type:'infantry',cost:{wood:500,stone:300,food:200,time:20}},
    {key:'archer_range',type:'archer',cost:{wood:600,stone:300,food:200,time:20}}];
  for(const up of upgrades){
    const afforded=waitFor(`等待${up.key}升级资源`,()=>run(`tierUpgradeLockReason('${up.key}')`)=== '',1200);
    if(!afforded)return{start,ledger,block:{at:up.key,gate:run(`tierUpgradeLockReason('${up.key}')`)},minFood};
    const beforeCount=owned(run,up.type);
    action(`支付${up.key} T1升级`, `buildTierUpgradeAct('${up.key}')`);
    assertPayment(ledger.at(-1),up.cost);
    assert.equal(run(`S.buildings.${up.key}.state`),'tier_upgrading');
    const completed=waitFor(`等待${up.key}升级完成`,()=>run(`S.buildings.${up.key}.tier`)===1,up.cost.time+1);
    if(!completed)return{start,ledger,block:{at:`${up.key}-completion`},minFood};
    assert.equal(owned(run,up.type),0,`${up.type}旧兵未退还`);
    const expectedRefund=Object.fromEntries(['wood','stone','food']
      .map(rk=>[rk,beforeCount*run(`CFG.units.${up.type}.cost.${rk}`)]));
    const refundLog=`退还${beforeCount}名旧时代士兵，木${expectedRefund.wood}石${expectedRefund.stone}食${expectedRefund.food}`;
    assert.equal(plain(run('S.log')).filter(item=>item===refundLog).length,1,
      `${up.key}退款日志应恰有一次`);
    ledger.push({label:`${up.key}旧兵返还核对`,oldOwnedBefore:beforeCount,
      oldOwnedAfter:owned(run,up.type),expectedRefund,refundLog,after:compact(run)});
  }
  const research=[{from:'infantry',to:'infantry_t1'},
    {from:'archer',to:'archer_t1'}];
  for(const item of research){
    const ready=waitFor(`等待${item.to}研究材料`,()=>{
      const cost=run(`CFG.unitUpgrades.${item.from}.tree.${item.from}.branches[0].cost`);
      return Object.entries(cost).every(([rk,n])=>run(`S.res.${rk}`)>=n);
    },1200);
    if(!ready)return{start,ledger,block:{at:item.to,gate:'research-resources'},minFood};
    action(`研究${item.to}`,`upgradeUnit('${item.from}','${item.to}')`);
    const branch=plain(run(`CFG.unitUpgrades.${item.from}.tree.${item.from}.branches[0]`));
    assertPayment(ledger.at(-1),branch.cost,branch.needTech,branch.needMerit);
    assert.equal(run(`S.upgradedUnits.${item.to}`),true);
    assert.equal(run(`trainLockReason('${item.to}')`),'');
  }
  for(const item of [{type:'infantry_t1',count:15},{type:'archer_t1',count:13}]){
    action(`排队${item.count}名${item.type}`,`train('${item.type}',${item.count})`);
    assertPayment(ledger.at(-1),{});
  }
  const trained=waitFor('等待两线T1补训完成',()=>
    owned(run,'infantry_t1')>=15&&owned(run,'archer_t1')>=13,1200);
  const beforeBattle=compact(run);
  const battle=trained?attemptBattle(run,seed,6):null;
  const laterBattles=[];
  if(battle?.won){
    for(let stage=7;stage<=10;stage++){
      const replacements=[];
      for(const [type,target] of [['bronze_guard',10],['infantry_t1',15],['archer_t1',13]]){
        const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
        const missing=target-have-queued;
        if(missing>0){
          action(`L${stage}补训${type}`,`train('${type}',${missing})`);
          assertPayment(ledger.at(-1),{});
          replacements.push({type,target,have,queued,missing});
        }
      }
      waitExactly(`L${stage}战前补给`,600);
      const row=attemptBattle(run,seed,stage);
      laterBattles.push({replacements,battle:row});
      if(!row.won)break;
    }
  }
  return{start,ledger,trained,beforeBattle,battle,laterBattles,minFood,
    firstLoss:!battle?.won?6:laterBattles.find(x=>!x.battle.won)?.battle.stage||null,
    L10Cleared:run('S.defeated.includes(10)'),
    block:trained?null:{at:'training',gate:beforeBattle.queue}};
}
const policy=workerPolicies.find(p=>p.name==='food-food');
assert.ok(policy);
const profiles=[];
for(const seed of [1,42])for(const disableReward of [false,true]){
  const checkpoint=runBranch(seed,disableReward,policy);
  assert.equal(checkpoint.battles.length,5);
  assert.ok(checkpoint.battles.every(b=>b.won));
  const e=environment({rts_save:checkpoint.checkpointSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  installBattleHarness(run);
  assert.deepEqual(snapshot(run),checkpoint.checkpoint,'L5 checkpoint save did not reload');
  const atCheckpoint=state(run);
  const route=handoff(run,seed);
  assert.ok(route.minFood>=0,'在线口径下食物不得为负');
  const final=snapshot(run);
  const finalSave=run("localStorage.getItem('rts_save')");
  const reload=environment({rts_save:finalSave});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(snapshot(reload.run),final,'P170路线终档重载不一致');
  profiles.push({seed,branch:checkpoint.branch,checkpointSaveSha256:checkpoint.checkpointSaveSha256,
    checkpoint:atCheckpoint,route,finalSaveSha256:sha(finalSave),battleL5:{round:checkpoint.battles[4].round,
      beforeOwned:checkpoint.battles[4].beforeArmy,
      beforeDeployed:checkpoint.battles[4].beforeDeployed,
      afterOwned:checkpoint.battles[4].afterArmy}});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P170',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),method:'in-memory P167 return immediately after real seeded L5 first clear; reload actual save, cancel pending old unit queues through cancelQueue, reassign two stone workers to wood through setPopAlloc, pay both T1 camp upgrades, wait for completion and old-line refund, pay both real unit research nodes, queue and produce 15 infantry_t1 plus 13 archer_t1, place them through real expedition formation actions, attempt L6 with the original seeded battle stream; no resource injection, no offline or garrison',
  scope:'food-food worker policy, seeds 1 and 42, current L3+6 and isolated no-reward control; 1200-second ceiling at each affordability/training wait; after L6 victory queue bronze to 10, infantry_t1 to 15 and archer_t1 to 13, wait exactly 600 online seconds then fight next stage through L10 or first loss',
  profiles,inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P170',profiles:profiles.map(p=>({seed:p.seed,branch:p.branch,
  checkpointTick:p.checkpoint.tick,checkpointResources:p.checkpoint.resources,
  checkpointMerit:p.checkpoint.merit,trained:p.route.trained,blocked:p.route.block,
  elapsed:p.route.beforeBattle?.tick-p.checkpoint.tick,
  minFood:p.route.minFood,L6Won:p.route.battle?.won??null,
  L6Round:p.route.battle?.round??null,
  firstLoss:p.route.firstLoss,L10Cleared:p.route.L10Cleared,
  laterBattles:p.route.laterBattles.map(x=>({stage:x.battle.stage,won:x.battle.won,
    round:x.battle.round,beforeOwned:x.battle.before.owned,
    beforeDeployed:x.battle.beforeDeployed,replacements:x.replacements})),
  beforeBattleOwned:p.route.beforeBattle?.owned,
  actions:p.route.ledger.filter(x=>x.expression).map(x=>({label:x.label,
    tick:x.after?.tick,result:x.result||null})),
  waits:p.route.ledger.filter(x=>x.seconds!==undefined)
    .map(x=>({label:x.label,seconds:x.seconds,met:x.met}))})),rawData:outputPath},null,2));
