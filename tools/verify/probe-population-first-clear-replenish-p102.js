'use strict';
// P102: isolate whether the proposed post-clear housing/population nudge can
// become battle power through real resource production and troop replenishment.
// Optional --input-save-stdin reloads a serialized developer rts_save from stdin;
// --session-profile=600:28800 and elapsed offsets test save/settleOffline cadence;
// session mode advances real battle callbacks and CFG.tickMs. No player save is written.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {environment}=require('../../tests/progression/harness');

const battleRandomArg=process.argv.find(arg=>arg.startsWith('--battle-random='));
const battleSeedArg=process.argv.find(arg=>arg.startsWith('--battle-seed='));
assert.ok(!(battleRandomArg&&battleSeedArg),'固定战斗随机值与种子只能二选一');
const battleSeed=battleSeedArg?Number(battleSeedArg.slice('--battle-seed='.length)):null;
assert.ok(battleSeed===null||Number.isSafeInteger(battleSeed)&&battleSeed>0&&battleSeed<=0xffffffff,
  '--battle-seed须为非零32位整数');
const battleRandom=battleSeedArg?null:(battleRandomArg?Number(battleRandomArg.slice('--battle-random='.length)):0.5);
assert.ok(battleSeedArg||Number.isFinite(battleRandom)&&battleRandom>=0&&battleRandom<1,
  '--battle-random须为[0,1)内的有限数值');
const battleRandomSetup=battleSeed===null
  ?`Math.random=()=>${battleRandom};`
  :`globalThis.__p102Rng=${battleSeed};Math.random=()=>{
    let x=__p102Rng;x^=x<<13;x^=x>>>17;x^=x<<5;__p102Rng=x>>>0;return __p102Rng/4294967296;};`;

const inputSaveArg=process.argv.find(arg=>arg.startsWith('--input-save-file='));
const inputSaveStdin=process.argv.includes('--input-save-stdin');
assert.ok(!(inputSaveArg&&inputSaveStdin),'只允许一种外部新档输入方式');
const sessionArg=process.argv.find(arg=>arg.startsWith('--session-profile='));
const sessionProfile=sessionArg
  ?(()=>{const [activeSec,offlineSec]=sessionArg.slice('--session-profile='.length).split(':').map(Number);
    assert.ok(Number.isSafeInteger(activeSec)&&activeSec>=60,'在线会话时长须为至少60模拟秒');
    assert.ok(Number.isSafeInteger(offlineSec)&&offlineSec>=120,'离线窗口须为至少120模拟秒');
    return{activeSec,offlineSec}})()
  :null;
function numericOption(prefix,fallback){
  const arg=process.argv.find(x=>x.startsWith(prefix));
  if(!arg)return fallback;
  const value=Number(arg.slice(prefix.length));
  assert.ok(Number.isSafeInteger(value)&&value>=0,`${prefix}须为非负整数`);
  return value;
}
const sessionStartActive=numericOption('--session-elapsed-active=',0);
const sessionStartOffline=numericOption('--session-elapsed-offline=',0);
assert.ok(sessionProfile||(!sessionStartActive&&!sessionStartOffline),'会话偏移必须与--session-profile一起使用');
assert.ok(!sessionProfile||inputSaveArg||inputSaveStdin,'短时会话模拟必须显式传入序列化起点');
const retryStage6AfterLoss=process.argv.includes('--retry-stage6-after-loss');
const retryFirstLoss=process.argv.includes('--retry-first-loss');
const includeWoodBranch=process.argv.includes('--include-wood-branch');
assert.ok(!(retryStage6AfterLoss&&retryFirstLoss),'只允许一种败后重试策略');
const recoveryWaitSeconds=numericOption('--recovery-wait-seconds=',0);
const recoveryWoodWorkers=numericOption('--recovery-wood-workers=',0);
const recoveryWoodFromArg=process.argv.find(arg=>arg.startsWith('--recovery-wood-from='));
const recoveryWoodFrom=recoveryWoodFromArg?recoveryWoodFromArg.slice('--recovery-wood-from='.length):'coal';
assert.ok(['coal','copper','food','stone'].includes(recoveryWoodFrom),
  '--recovery-wood-from只支持coal/copper/food/stone');
const campaignMaxStage=numericOption('--campaign-max-stage=',6);
assert.ok(campaignMaxStage>=1&&campaignMaxStage<=100,'--campaign-max-stage须为1到100');
const waitWindowsArg=process.argv.find(arg=>arg.startsWith('--wait-windows='));
const waitWindows=waitWindowsArg
  ?waitWindowsArg.slice('--wait-windows='.length).split(',').map(Number)
  :[0,60,180,600];
assert.ok(waitWindows.length>0&&waitWindows.every(value=>Number.isSafeInteger(value)&&value>=0),
  '--wait-windows须为逗号分隔的非负整数秒');
assert.equal(new Set(waitWindows).size,waitWindows.length,'--wait-windows不能重复');
assert.ok(retryStage6AfterLoss||retryFirstLoss||recoveryWaitSeconds===0,
  '恢复等待必须与败后重试策略一起使用');
assert.ok(retryFirstLoss||recoveryWoodWorkers===0,'伐木恢复配置只用于首次败战重试');
let startSave,sourceRun;
if(inputSaveArg||inputSaveStdin){
  const raw=inputSaveStdin?fs.readFileSync(0,'utf8'):
    fs.readFileSync(path.resolve(inputSaveArg.slice('--input-save-file='.length)),'utf8');
  assert.ok(raw.trim().startsWith('{'),'输入存档必须是rts_save JSON');
  const input=environment({rts_save:raw.trim()});
  sourceRun=input.run;
  assert.ok(['ok','migrated'].includes(sourceRun('loadSaveAndApply().status')),'外部人口路线终档无法读取');
  startSave=sourceRun("localStorage.getItem('rts_save')");
}else{
  const sourcePath=path.join(__dirname,'probe-population-early-18.js');
  const source=fs.readFileSync(sourcePath,'utf8');
  const sourceRequire=createRequire(sourcePath);
  const natural=new Function('require','console','__dirname',
    source+String.fromCharCode(10)+'return {run};')(
      sourceRequire,{log(){},error:console.error},__dirname);
  sourceRun=natural.run;
  startSave=sourceRun("localStorage.getItem('rts_save')");
}
assert.equal(sourceRun('S.population.current'),18);
assert.equal(sourceRun('maxPop()'),18);
assert.equal(sourceRun('S.defeated.length'),0);
assert.equal(sourceRun('S.res.deed'),0);

function checked(run,expression,label){
  const result=run(expression);
  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
  return result;
}
function installSessionClock(run,activeStart,offlineStart){
  if(!sessionProfile)return null;
  run(`(()=>{
    const g=globalThis;
    g.__p102RawTick=tick;
    g.__p102OriginalDateNow=Date.now;
    g.__p102VirtualNow=Date.now();
    Date.now=()=>g.__p102VirtualNow;
    g.__p102SessionStats={profile:{activeSec:${sessionProfile.activeSec},offlineSec:${sessionProfile.offlineSec}},
      activeOnlineSeconds:${activeStart},settledOfflineSeconds:${offlineStart},
      nextPauseActiveSecond:(Math.floor(${activeStart}/${sessionProfile.activeSec})+1)*${sessionProfile.activeSec},
      pausePending:false,offlineWindows:[]};
    g.__p102Settling=false;
    g.__p102InBattle=false;
    g.__p102SchedulerAdvancing=false;
    const snapshot=()=>({tick:S.tick,population:popCurrent(),capacity:maxPop(),resources:{food:S.res.food,
      coal:S.res.coal,copper:S.res.copper},army:{infantry:S.pool.infantry||0,archer:S.pool.archer||0,
      bronze_guard:S.pool.bronze_guard||0},queue:Object.fromEntries(['infantry','archer','bronze_guard']
        .map(k=>[k,S.queue[k]?.count||0]))});
    g.__p102SettlePending=function(reason='session-break'){
      const stats=g.__p102SessionStats;
      if(!stats.pausePending||g.__p102InBattle)return null;
      const saved=save();
      if(!saved?.ok)throw Error('短时战役检查点保存失败：'+JSON.stringify(saved));
      const savedTs=Number(_loadedTs);
      if(!Number.isFinite(savedTs))throw Error('短时战役检查点缺少有效保存时间');
      const before=snapshot();
      g.__p102VirtualNow=savedTs+${sessionProfile.offlineSec}*1000;
      g.__p102Settling=true;
      let settled;
      try{settled=settleOffline()}finally{g.__p102Settling=false;}
      if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})
        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));
      stats.settledOfflineSeconds+=settled.durationSec;
      stats.offlineWindows.push({reason,activeOnlineSeconds:stats.activeOnlineSeconds,
        durationSec:settled.durationSec,gains:settled.gains,before,after:snapshot()});
      stats.nextPauseActiveSecond=(Math.floor(stats.activeOnlineSeconds/${sessionProfile.activeSec})+1)*${sessionProfile.activeSec};
      stats.pausePending=false;
      return settled;
    };
    g.tick=function(){
      if(g.__p102Settling||_saveProtected)return g.__p102RawTick();
      const result=g.__p102RawTick();
      g.__p102SessionStats.activeOnlineSeconds++;
      if(!g.__p102SchedulerAdvancing)g.__p102VirtualNow+=1000;
      if(g.__p102SessionStats.activeOnlineSeconds>=g.__p102SessionStats.nextPauseActiveSecond)
        g.__p102SessionStats.pausePending=true;
      if(g.__p102SessionStats.pausePending&&!g.__p102InBattle)g.__p102SettlePending('tick-boundary');
      return result;
    };
  })()`);
  return ()=>run('JSON.parse(JSON.stringify(globalThis.__p102SessionStats))');
}
function installSessionBattleClock(run){
  if(!sessionProfile)return;
  run(`(()=>{
    const g=globalThis;
    g.__p102Timers=new Map();
    g.__p102TimerId=1;
    g.__p102TimerNow=0;
    g.__p102NextGameTickMs=CFG.tickMs;
    g.setTimeout=(fn,delay=0)=>{const id=g.__p102TimerId++;
      g.__p102Timers.set(id,{fn,at:g.__p102TimerNow+Math.max(0,Number(delay)||0)});return id};
    g.clearTimeout=id=>g.__p102Timers.delete(id);
    g.__p102Step=()=>{
      let selected=null;
      for(const [id,timer] of g.__p102Timers){
        if(!selected||timer.at<selected.timer.at||(timer.at===selected.timer.at&&id<selected.id))selected={id,timer};
      }
      if(!selected)return false;
      while(g.__p102NextGameTickMs<=selected.timer.at){
        const delta=g.__p102NextGameTickMs-g.__p102TimerNow;
        g.__p102TimerNow=g.__p102NextGameTickMs;
        g.__p102VirtualNow+=delta;
        g.__p102SchedulerAdvancing=true;
        try{g.tick()}finally{g.__p102SchedulerAdvancing=false;}
        g.__p102NextGameTickMs+=CFG.tickMs;
      }
      if(selected.timer.at>g.__p102TimerNow){
        const delta=selected.timer.at-g.__p102TimerNow;
        g.__p102TimerNow=selected.timer.at;
        g.__p102VirtualNow+=delta;
      }
      g.__p102Timers.delete(selected.id);
      selected.timer.fn();
      return true;
    };
  })()`);
}
function assign(run,target){
  const previous=run('({...S.popAlloc})');
  for(const key of Object.keys({...previous,...target}))if((previous[key]||0)>0)
    checked(run,`setPopAlloc('${key}',0)`,`清退${key}`);
  for(const [key,count] of Object.entries(target))if(count>0)
    checked(run,`setPopAlloc('${key}',${count})`,`分配${key}`);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function prepareEconomy(){
  const e=environment({rts_save:startSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const getSessionStats=installSessionClock(run,sessionStartActive,sessionStartOffline);
  assign(run,{wood:10,stone:3,food:5});
  checked(run,"buildAct('barracks')",'建营帐');
  checked(run,"buildAct('infantry_camp')",'建步兵营地');
  checked(run,"buildAct('archer_range')",'建猎人营地');
  while(!run("bldSt('barracks').lv===1&&bldSt('infantry_camp').lv===1&&bldSt('archer_range').lv===1"))run('tick()');
  while(!run('S.res.wood>=1490&&S.res.stone>=410&&S.res.food>=690'))run('tick()');
  checked(run,"train('infantry',15)",'训练基础步兵');
  checked(run,"train('archer',13)",'训练猎人');
  while(!run('S.pool.infantry>=15&&S.pool.archer>=13'))run('tick()');
  checked(run,"researchScience('sci_large_granary')",'研究大粮仓');
  checked(run,"researchScience('sci_bronze_age')",'研究青铜时代');
  while(!run('S.res.wood>=600&&S.res.stone>=560&&S.res.food>=300'))run('tick()');
  checked(run,"buildAct('copper_store')",'建铜仓');
  checked(run,"buildAct('bronze_workshop')",'建青铜工坊');
  while(!run("bldSt('copper_store').lv===1&&bldSt('bronze_workshop').lv===1"))run('tick()');
  assign(run,{stone:6,food:3,coal:6,copper:3});
  checked(run,"train('bronze_guard',8)",'训练青铜刀盾兵');
  while(!run('S.pool.bronze_guard>=8'))run('tick()');
  assert.equal(run('regMax()'),10);
  assert.equal(run('popCurrent()'),18);
  checked(run,'save()','保存战前军备档');
  const prepared={save:run("localStorage.getItem('rts_save')"),tick:run('S.tick'),resources:run('({...S.res})'),
    workers:run('({...S.popAlloc})'),population:run('popCurrent()'),capacity:run('maxPop()'),
    army:{infantry:run('S.pool.infantry'),archer:run('S.pool.archer'),bronze_guard:run('S.pool.bronze_guard')}};
  if(getSessionStats)prepared.sessionClock=getSessionStats();
  return prepared;
}

let battleStart=prepareEconomy();
const preparationSessionClock=battleStart.sessionClock||null;
let preBattleHoldSeconds=0;
let matchedResourceFloor=null;
let preBattleHoldStartResources=null;
let preBattleHoldFoodDeltaByWorkers=null;
let preBattleHoldFoodRange=null;
const entryResourceFloorArg=process.argv.find(arg=>arg.startsWith('--entry-resource-floor='));
if(entryResourceFloorArg){
  matchedResourceFloor=JSON.parse(entryResourceFloorArg.slice('--entry-resource-floor='.length));
  assert.ok(matchedResourceFloor&&typeof matchedResourceFloor==='object'&&!Array.isArray(matchedResourceFloor),
    '战前资源目标须为对象');
  assert.ok(Object.keys(matchedResourceFloor).length>0,'战前资源目标不能为空');
  for(const [key,target] of Object.entries(matchedResourceFloor)){
    assert.ok(['food','coal','copper'].includes(key),`不支持以${key}作补兵资源对齐目标`);
    assert.ok(Number.isFinite(target)&&target>=0,`${key}资源目标非法`);
  }
  const equalized=environment({rts_save:battleStart.save});
  const run=equalized.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  preBattleHoldStartResources=run('({...S.res})');
  for(const [key,target] of Object.entries(matchedResourceFloor))assert.ok(target<=run(`resCap('${key}')`),
    `${key}资源目标超过当前仓容`);
  assert.ok(matchedResourceFloor.copper===undefined||preBattleHoldStartResources.copper>=matchedResourceFloor.copper,
    '共同资源目标中的铜不能高于四学者路线当前库存');
  const foodDeltaAfterOneTick=workers=>{
    const trial=environment({rts_save:battleStart.save});
    const trialRun=trial.run;
    assert.equal(trialRun('loadSaveAndApply().status'),'ok');
    assign(trialRun,{...battleStart.workers,food:workers,coal:0,copper:0});
    const before=trialRun('S.res.food');trialRun('tick()');
    return trialRun('S.res.food')-before;
  };
  preBattleHoldFoodDeltaByWorkers={1:foodDeltaAfterOneTick(1),2:foodDeltaAfterOneTick(2)};
  assert.ok(preBattleHoldFoodDeltaByWorkers[1]<0&&preBattleHoldFoodDeltaByWorkers[2]>0,
    '需要用真实tick测得一人粮工净消耗、两人粮工净增长以稳定库存');
  preBattleHoldFoodRange={min:preBattleHoldStartResources.food,max:preBattleHoldStartResources.food};
  while(Object.entries(matchedResourceFloor).some(([key,target])=>run(`S.res.${key}<${target}`))){
    assert.ok(preBattleHoldSeconds<20000,'战前资源对齐超过20000秒');
    const coalWorkers=matchedResourceFloor.coal!==undefined&&run(`S.res.coal<${matchedResourceFloor.coal}`)
      ?battleStart.workers.coal:0;
    if(matchedResourceFloor.food!==undefined){
      const food=run('S.res.food'),target=matchedResourceFloor.food;
      let foodWorkers;
      if(food<target-4)foodWorkers=2;
      else if(food>target+4)foodWorkers=1;
      else foodWorkers=Math.abs(food+preBattleHoldFoodDeltaByWorkers[1]-target)
        <=Math.abs(food+preBattleHoldFoodDeltaByWorkers[2]-target)?1:2;
      assign(run,{...battleStart.workers,food:foodWorkers,coal:coalWorkers,copper:0});
    }else assign(run,{...battleStart.workers,coal:coalWorkers,copper:0});
    run('tick()');preBattleHoldSeconds++;
    assert.ok(run('Number.isFinite(S.res.food)&&S.res.food>=0'),'战前资源对齐期间粮食耗尽');
    preBattleHoldFoodRange.min=Math.min(preBattleHoldFoodRange.min,run('S.res.food'));
    preBattleHoldFoodRange.max=Math.max(preBattleHoldFoodRange.max,run('S.res.food'));
  }
  for(const [key,target] of Object.entries(matchedResourceFloor))assert.ok(run(`S.res.${key}>=${target}`));
  assign(run,battleStart.workers);
  checked(run,'save()','保存共同战前资源档');
  battleStart={save:run("localStorage.getItem('rts_save')"),tick:run('S.tick'),resources:run('({...S.res})'),
    workers:run('({...S.popAlloc})'),population:run('popCurrent()'),capacity:run('maxPop()'),
    army:{infantry:run('S.pool.infantry'),archer:run('S.pool.archer'),bronze_guard:run('S.pool.bronze_guard')}};
}
const rosterTarget={infantry:15,archer:13,bronze_guard:15};

function makeBranch(rewardMode,extraSecondsPerWin){
  const e=environment({rts_save:battleStart.save});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const getSessionStats=sessionProfile
    ?installSessionClock(run,preparationSessionClock.activeOnlineSeconds,preparationSessionClock.settledOfflineSeconds)
    :null;
  if(sessionProfile)installSessionBattleClock(run);
  else run(`globalThis.__p102Timers=new Map();globalThis.__p102TimerId=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__p102TimerId++;__p102Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p102Timers.delete(id);
    globalThis.__p102Step=()=>{const first=__p102Timers.entries().next().value;
      if(!first)return false;__p102Timers.delete(first[0]);first[1]();return true};`);
  run(`globalThis.__p102Nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__p102Nodes.has(id))__p102Nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __p102Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));${battleRandomSetup}`);

  function place(row,type,count,idx=0){
    if(count<=0)return;
    assert.ok(run(`rowSlots('${row}')`)>idx,`${row}[${idx}]尚未开放`);
    assert.ok(run(`S.pool['${type}']||0`)>=count,`${type}余量不足`);
    run(`openFormModal('expedition','${row}',${idx});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true,
      `${type}未编入${row}[${idx}]`);
  }
  function formArmy(){
    run("clrForm('expedition')");
    let bronze=run('S.pool.bronze_guard||0');
    for(let i=0;i<run("rowSlots('front')")&&bronze>0;i++){
      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;
    }
    let infantry=run('S.pool.infantry||0');
    for(let i=0;i<run("rowSlots('front')")&&infantry>0;i++){
      if(run(`S.formation.front[${i}]`))continue;
      const n=Math.min(run('regMax()'),infantry);place('front','infantry',n,i);infantry-=n;
    }
    let archers=run('S.pool.archer||0');
    for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
      const n=Math.min(run('regMax()'),archers);place(row,'archer',n,i);archers-=n;
    }
  }
  function owned(type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
  function recoverySnapshot(){
    const trainingBudget=Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,{
      cost:run(`({...CFG.units['${k}'].cost})`),
      maxAffordable:run(`maxUnitsByTrainingCost(CFG.units['${k}'].cost)`),
      unitCapLeft:run(`unitCapLeft('${k}')`)
    }]));
    return{tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      army:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,owned(k)])),
      queue:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,run(`S.queue['${k}']?.count||0`)])),
      queueReasons:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,run(`S.queue['${k}']?.reason||''`)])),
      trainingBudget,resources:run('({...S.res})')};
  }
  function queueToTarget(){
    for(const [type,target] of Object.entries(rosterTarget)){
      const queued=run(`S.queue['${type}']?.count||0`);
      const missing=target-owned(type)-queued;
      if(missing>0)checked(run,`train('${type}',${missing})`,`补训${type}`);
    }
  }
  function battle(stage){
    assert.equal(run('S.defeated.length'),stage-1,`第${stage}关不可跳关`);
    formArmy();
    const battleStartMs=sessionProfile?run('globalThis.__p102TimerNow'):0;
    const before=run(`({deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),
      army:armyCount(),byType:{infantry:(S.pool.infantry||0)+expeditionCount('infantry'),
      archer:(S.pool.archer||0)+expeditionCount('archer'),bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard')},
      resources:{...S.res},workers:{...S.popAlloc},population:popCurrent(),capacity:maxPop(),tick:S.tick})`);
    run(`${sessionProfile?'globalThis.__p102InBattle=true;':''}selEnemy(${stage-1});openBattle()`);
    assert.equal(run('S.battleActive'),true,`第${stage}关未开战`);
    const enemy=run(`({id:B.enemyCfg.id,name:B.enemyCfg.name,boss:!!B.enemyCfg.boss,
      groups:B.enemyUnits.map(u=>({type:u.type,row:u.row,count:u.initialCount,hp:u.maxHp,
        hpPerSoldier:u.hpPerSoldier,atk:u.atk,def:u.def,spd:u.spd})),
      totalTroops:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0),0),
      totalHp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0),
      troopWeightedAttack:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0)*(u.atk||0),0)})`);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){
      assert.equal(run('__p102Step()'),true,`第${stage}关战斗回调丢失`);callbacks++;
    }
    assert.equal(run('S.battleActive'),false,`第${stage}关未结算`);
    const outcome=run(`({win:S.defeated.includes(${stage}),round:B.round,army:armyCount(),
      byType:{infantry:(S.pool.infantry||0)+expeditionCount('infantry'),
      archer:(S.pool.archer||0)+expeditionCount('archer'),bronze_guard:(S.pool.bronze_guard||0)+expeditionCount('bronze_guard')}})`);
    run('exitBattle()');
    if(sessionProfile)run('globalThis.__p102InBattle=false');
    return {stage,before,outcome,enemy,callbacks,...(sessionProfile?{battleActiveMs:run('globalThis.__p102TimerNow')-battleStartMs}:{})};
  }
  function clearReward(stage,win){
    if(!win)return {award:0,bonus:0,spent:0};
    const baseAward=Math.ceil(stage/10);
    const bonus=rewardMode.startsWith('frontloaded')&&stage===3?6:0;
    const saved=run(`(()=>{S.res.deed+=${baseAward+bonus};return save()})()`);
    assert.equal(saved?.ok,true,'隔离候选地契必须可保存');
    let spent=0;
    while(run("settlementBatchPreview('village',1).ok")){
      const quote=run("settlementBatchPreview('village',1)");
      const result=run(`upgradeSettlement('village',${quote.startLevel})`);
      assert.equal(result?.ok,true,`真实扩容失败：${JSON.stringify(result)}`);spent+=result.cost;
    }
    return {award:baseAward+bonus,bonus,spent};
  }
  function wait(seconds){
    if(sessionProfile)run("globalThis.__p102SettlePending('post-battle-break')");
    run(`for(let i=0;i<${seconds};i++)tick()`);
  }

  const rows=[];
  for(let stage=1;stage<=campaignMaxStage;stage++){
    const fought=battle(stage);
    const reward=clearReward(stage,fought.outcome.win);
    let workforceChange=null;
    if(stage===3&&fought.outcome.win&&rewardMode.startsWith('frontloaded')){
      // 现有三种岗位选择；可选木工支线检验新增劳动力转成弓手补员的效果。
      wait(10);
      assert.equal(run('popCurrent()'),19,'首胜扩容应自然出生第19人');
      const foodPolicy=rewardMode==='frontloaded-food';
      const woodPolicy=rewardMode==='frontloaded-wood';
      const workers=foodPolicy?{stone:6,food:4,coal:6,copper:3}
        :woodPolicy?{stone:6,food:3,coal:6,copper:3,wood:1}
          :{stone:5,food:2,coal:8,copper:4};
      assign(run,workers);
      workforceChange={policy:foodPolicy?'new worker assigned to food'
          :woodPolicy?'new worker assigned to wood; preserve the previous 18-person production mix'
            :'one former food worker to copper; new worker to coal; one stone worker to coal',
        rates:{wood:run("prodRate('wood')"),food:run("prodRate('food')"),stone:run("prodRate('stone')"),
          coal:run("prodRate('coal')"),copper:run("prodRate('copper')")}};
    }else wait(10);

    let replenishment=null;
    if(stage>=3&&fought.outcome.win){
      const beforeQueue=Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,owned(k)]));
      queueToTarget();
      const queuedAtStart=run('JSON.parse(JSON.stringify(S.queue))');
      wait(extraSecondsPerWin);
      replenishment={beforeQueue,afterArmy:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,owned(k)])),
        queuedAtStart:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,queuedAtStart[k]?.count||0])),
        remainingQueue:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,run(`S.queue['${k}']?.count||0`)])),
        queueReasons:Object.fromEntries(Object.keys(rosterTarget).map(k=>[k,run(`S.queue['${k}']?.reason||''`)])),
        resources:{wood:run('S.res.wood'),food:run('S.res.food'),coal:run('S.res.coal'),copper:run('S.res.copper')},
        capLeft:{bronze_guard:run("unitCapLeft('bronze_guard')")}};
    }
    rows.push({...fought,reward,workforceChange,replenishment,afterTick:run('S.tick')});
    if(!fought.outcome.win)break;
  }
  const branch={rewardMode,extraSecondsPerWin,startTick:battleStart.tick,
    attempted:rows.length,wins:rows.filter(r=>r.outcome.win).length,blockedAt:rows.find(r=>!r.outcome.win)?.stage||null,
    elapsedBeforeBlock:run('S.tick')-battleStart.tick,population:run('popCurrent()'),capacity:run('maxPop()'),
    ...(battleSeed!==null?{battleTrace:rows.map(r=>({stage:r.stage,enemy:r.enemy,win:r.outcome.win,
      round:r.outcome.round,armyBefore:r.before.byType,armyAfter:r.outcome.byType,
      resourcesBefore:{wood:r.before.resources.wood,stone:r.before.resources.stone,
        food:r.before.resources.food,coal:r.before.resources.coal,copper:r.before.resources.copper}}))}:{}),
    rows:rows.filter(r=>r.stage>=3).map(r=>({stage:r.stage,win:r.outcome.win,round:r.outcome.round,callbacks:r.callbacks,
      ...(sessionProfile?{battleActiveMs:r.battleActiveMs}:{}),
      deployed:r.before.deployed,armyBefore:r.before.army,armyAfter:r.outcome.army,
      byTypeBefore:r.before.byType,byTypeAfter:r.outcome.byType,reward:r.reward,
      populationBefore:r.before.population,capacityBefore:r.before.capacity,
      workforceChange:r.workforceChange,replenishment:r.replenishment,
      resourcesBefore:{food:r.before.resources.food,coal:r.before.resources.coal,copper:r.before.resources.copper},
      tickBefore:r.before.tick,afterTick:r.afterTick}))};
  if(retryStage6AfterLoss||retryFirstLoss){
    const failed=retryFirstLoss
      ?rows.find(row=>!row.outcome.win)
      :rows.find(row=>row.stage===6&&!row.outcome.win);
    if(failed){
      const afterDefeat=recoverySnapshot();
      const activeAtDefeat=sessionProfile?run('globalThis.__p102SessionStats.activeOnlineSeconds'):run('S.tick');
      let recoveryWorkforceChange=null;
      if(recoveryWoodWorkers>0){
        const before=run('({...S.popAlloc})');
        assert.ok(before[recoveryWoodFrom]>=recoveryWoodWorkers,
          `败后伐木需从${recoveryWoodFrom}岗位转调${recoveryWoodWorkers}人，当前人数不足`);
        const next={...before,[recoveryWoodFrom]:before[recoveryWoodFrom]-recoveryWoodWorkers,
          wood:(before.wood||0)+recoveryWoodWorkers};
        assign(run,next);
        recoveryWorkforceChange={from:recoveryWoodFrom,to:'wood',count:recoveryWoodWorkers,
          before,after:run('({...S.popAlloc})')};
      }
      const trainingAttempts=[];
      for(const [type,target] of Object.entries(rosterTarget)){
        const queued=run(`S.queue['${type}']?.count||0`);
        const missing=target-owned(type)-queued;
        if(missing>0){
          const result=run(`train('${type}',${missing})`);
          trainingAttempts.push({type,requested:missing,result});
        }
      }
      const afterTraining=recoverySnapshot();
      wait(recoveryWaitSeconds);
      const beforeRetry=recoverySnapshot();
      const activeAtRetry=sessionProfile?run('globalThis.__p102SessionStats.activeOnlineSeconds'):run('S.tick');
      const retry=battle(failed.stage);
      const retryReward=clearReward(failed.stage,retry.outcome.win);
      wait(10);
      const afterRetry=recoverySnapshot();
      branch.defeatRecovery={stage:failed.stage,recoveryWaitSeconds,activeWaitSeconds:activeAtRetry-activeAtDefeat,
        firstLoss:{stage:failed.stage,round:failed.outcome.round,
          armyBefore:failed.before.byType,armyAfter:failed.outcome.byType,
          populationBefore:failed.before.population,populationAfterDefeat:afterDefeat.population},
        afterDefeat,recoveryWorkforceChange,trainingAttempts,afterTraining,beforeRetry,retry:{outcome:retry.outcome,
          battleActiveMs:retry.battleActiveMs??null,callbacks:retry.callbacks,reward:retryReward},afterRetry};
    }
  }
  if(getSessionStats)branch.sessionClock=getSessionStats();
  return branch;
}

function combatSnapshot(row){
  return JSON.parse(JSON.stringify({stage:row.stage,win:row.win,round:row.round,deployed:row.deployed,
    armyBefore:row.armyBefore,armyAfter:row.armyAfter,byTypeBefore:row.byTypeBefore,byTypeAfter:row.byTypeAfter}));
}

const windows=waitWindows;
const results=[];
for(const seconds of windows){
  const current=makeBranch('current',seconds);
  const frontloaded=makeBranch('frontloaded-metal',seconds);
  const foodSafe=makeBranch('frontloaded-food',seconds);
  const woodSafe=includeWoodBranch?makeBranch('frontloaded-wood',seconds):null;
  const currentStage3=current.rows.find(row=>row.stage===3);
  for(const candidate of [frontloaded,foodSafe,...(woodSafe?[woodSafe]:[])]){
    const candidateStage3=candidate.rows.find(row=>row.stage===3);
    assert.equal(!!candidateStage3,!!currentStage3,'发奖敏感度不得改变是否抵达第3关');
    if(currentStage3&&candidateStage3)
      assert.deepEqual(combatSnapshot(candidateStage3),combatSnapshot(currentStage3),
        '第3关战后发奖不得改变已经结算的战斗');
  }
  for(const candidate of [frontloaded,foodSafe,...(woodSafe?[woodSafe]:[])]){
    const stage3=candidate.rows.find(row=>row.stage===3);
    if(stage3?.win){
      assert.equal(stage3.reward.spent,9,'第3关+6须在真实扩容动作中支付9地契');
      assert.equal(stage3.populationBefore,18);
      assert.equal(stage3.capacityBefore,18);
    }
  }
  if(currentStage3?.win){
    assert.equal(frontloaded.rows.find(row=>row.stage===3)?.workforceChange?.rates?.copper,4);
    assert.ok(foodSafe.rows.find(row=>row.stage===3)?.workforceChange?.rates?.food>
      frontloaded.rows.find(row=>row.stage===3)?.workforceChange?.rates?.food);
    if(woodSafe)assert.ok(woodSafe.rows.find(row=>row.stage===3)?.workforceChange?.rates?.wood>0);
  }
  results.push({extraSecondsPerWin:seconds,current,frontloadedMetal:frontloaded,frontloadedFood:foodSafe,
    ...(woodSafe?{frontloadedWood:woodSafe}:{}),
    stage6Delta:{currentWon:current.rows.find(r=>r.stage===6)?.win||false,
      metalWon:frontloaded.rows.find(r=>r.stage===6)?.win||false,foodWon:foodSafe.rows.find(r=>r.stage===6)?.win||false,
      ...(woodSafe?{woodWon:woodSafe.rows.find(r=>r.stage===6)?.win||false,
        woodArmy:woodSafe.rows.find(r=>r.stage===6)?.armyBefore||null,
        woodByType:woodSafe.rows.find(r=>r.stage===6)?.byTypeBefore||null}:{}),
      currentArmy:current.rows.find(r=>r.stage===6)?.armyBefore||null,
      metalArmy:frontloaded.rows.find(r=>r.stage===6)?.armyBefore||null,
      foodArmy:foodSafe.rows.find(r=>r.stage===6)?.armyBefore||null,
      currentByType:current.rows.find(r=>r.stage===6)?.byTypeBefore||null,
      metalByType:frontloaded.rows.find(r=>r.stage===6)?.byTypeBefore||null,
      foodByType:foodSafe.rows.find(r=>r.stage===6)?.byTypeBefore||null}});
}
console.log(JSON.stringify({batch:'P102',unit:'simulated online seconds; people; resources; soldiers',
  ...(campaignMaxStage!==6?{campaignMaxStage}:{}),
  ...(waitWindowsArg?{waitWindows}:{}),
  source:inputSaveArg||inputSaveStdin
    ?'serialized fresh zero-win population-route save; real build/train/role-allocation/production/tick/battle/settlement functions'
    :'real zero-win 18-pop route; real build/train/role-allocation/production/tick/battle/settlement functions',
  entryState:{tick:battleStart.tick,resources:battleStart.resources,workers:battleStart.workers,
    population:battleStart.population,capacity:battleStart.capacity,army:battleStart.army,
    preBattleHoldSeconds,preBattleHoldStartResources,preBattleHoldFoodDeltaByWorkers,
    preBattleHoldFoodRange,matchedResourceFloor},
  branches:'same ordinary first-clear candidate vs stage-3 +6 deed sensitivity; +6 is post-victory only',
  adaptiveRolePolicies:{metal:'stone 5 / food 2 / coal 8 / copper 4; test accelerated bronze replenishment',
    food:'stone 6 / food 4 / coal 6 / copper 3; preserve the previous metal-chain balance and add food output',
    ...(includeWoodBranch?{wood:'stone 6 / food 3 / coal 6 / copper 3 / wood 1; add one wood worker after the +6 deed expansion'}:{})},
  recoveryPolicy:'after stage 3/4/5 wins, both branches queue actual replacements to infantry 15 / archer 13 / bronze guard 15; same extra wait per win',
  ...(sessionProfile?{sessionProfile,preparationSessionClock}:{}),
  ...(retryStage6AfterLoss||retryFirstLoss?{defeatRecovery:{
    stage:retryFirstLoss?'first-loss-stage':6,recoveryWaitSeconds,
    policy:retryFirstLoss
      ?'after the first campaign loss, queue real replacements to the standard roster target, wait once, then retry that same stage'
      :'after the first stage-6 loss, queue real replacements to the standard roster target, wait once, then retry stage 6'}}:{}),
  windows,battleRandom,...(battleSeed!==null?{battleSeed}:{}),results},null,2));
