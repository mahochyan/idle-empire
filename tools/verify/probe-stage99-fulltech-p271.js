'use strict';
// P271: from the P270 paid nuclear checkpoint, pay for every casualty on stages 46–99.
// 每个种子独立重载开发档；不触碰玩家浏览器存档或运行时代码。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const inputArg=process.argv.find(x=>x.startsWith('--input='));
const input=path.resolve(inputArg?inputArg.slice('--input='.length):path.resolve(__dirname,'../../docs/codex/reports/data/p270-nuclear-research-paid-save.json'));
const labelArg=process.argv.find(x=>x.startsWith('--label='));
const label=labelArg?labelArg.slice('--label='.length):'fulltech';
assert.ok(['fulltech','prenuclear'].includes(label));
const raw=fs.readFileSync(input,'utf8');
const sourceSave=JSON.parse(raw);
const stageArg=process.argv.find(x=>x.startsWith('--stage='));
const stage=stageArg?Number(stageArg.slice('--stage='.length)):46;
assert.ok(Number.isSafeInteger(stage)&&stage>=1&&stage<=100,'关卡须为1～100');
const throughArg=process.argv.find(x=>x.startsWith('--through-stage='));
const throughStage=throughArg?Number(throughArg.slice('--through-stage='.length)):99;
assert.ok(Number.isSafeInteger(throughStage)&&throughStage>=stage&&throughStage<=100,'结束关卡须不早于起始关卡且不高于100');
const seedCountArg=process.argv.find(x=>x.startsWith('--seeds='));
const seedCount=Math.max(1,Math.min(20,Number(seedCountArg?.split('=')[1])||1));
const replenish=true;
const {run:baseRun}=environment({rts_save:raw});
assert.ok(['ok','migrated'].includes(baseRun('loadSaveAndApply().status')),'P271开发档无法读取');
const startBase=baseRun("(()=>({tick:S.tick,population:popCurrent(),army:armyCount(),defeated:S.defeated.length,formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},resources:{...S.res},items:{...S.items},merit:S.merit||0,starScience:scienceUnlocked('sci_nuclear_age')}))()");
assert.equal(startBase.population,1002,'本探针依赖P270的1002人口快照');
assert.equal(startBase.army,label==='fulltech'?517:516,'预备兵或军力与输入类型不符');
assert.equal(startBase.starScience,label==='fulltech');
assert.ok(startBase.defeated>=stage-1,`存档尚未解锁第${stage}关`);
const startUnitCounts={};
for(const row of ['front','mid','back'])for(const u of startBase.formation[row]||[])startUnitCounts[u.type]=(startUnitCounts[u.type]||0)+u.count;
assert.equal(Object.values(startUnitCounts).reduce((a,b)=>a+b,0),516,'应有516名现役');
assert.equal(startBase.pool.star_trooper||0,label==='fulltech'?1:0);

function countFormation(form){
  const counts={};
  for(const row of ['front','mid','back'])for(const u of form[row]||[])counts[u.type]=(counts[u.type]||0)+u.count;
  return counts;
}
function replacementCost(run,losses){
  const cost={};
  for(const [unit,count] of Object.entries(losses)){
    const unitCost=run(`CFG.units['${unit}'].cost||{}`);
    for(const [key,amount] of Object.entries(unitCost))cost[key]=(cost[key]||0)+amount*count;
  }
  return cost;
}
function resource(run,key){return Number(run(`S.res['${key}']||0`));}
function capacity(run,key){return Number(run(`resCap('${key}')`));}
function blocked(message){const error=new Error(message);error.routeBlocked=true;throw error;}
function advance(run,condition,max=200000){
  const before=run('S.tick');
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  if(!result.ok)blocked(`等待${condition}超时；库存=${JSON.stringify(run('({...S.res})'))}`);
  return run('S.tick')-before;
}
function advanceWhile(run,condition,max=200000){
  const result=run(`(()=>{let n=0;while((${condition})&&n<${max}){tick();n++}return n})()`);
  if(result>=max)blocked(`阶段循环超过${max}秒：${condition}`);
  return result;
}
function allocation(run,role){
  const current=run('({...S.popAlloc})');
  for(const [key,value] of Object.entries(current))if(value>0){
    const result=run(`setPopAlloc('${key}',0)`);
    assert.equal(result?.ok,true,`无法撤出${key}岗位`);
  }
  const pop=run('popCurrent()'),foodWorkers=Math.min(90,pop);
  assert.equal(run(`setPopAlloc('food',${foodWorkers})`)?.ok,true,'无法保障军粮岗位');
  if(role&&role!=='food'){
    assert.equal(run(`setPopAlloc('${role}',${pop-foodWorkers})`)?.ok,true,`无法分配${role}岗位`);
    assert.ok(run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')>0,
      `分配${role}后军粮净产非正`);
  }
  assert.equal(run('popAllocTotal()'),pop,'岗位分配未覆盖现有人口');
}
function ensureDirect(run,key,need){
  if(resource(run,key)>=need)return;
  if(need>capacity(run,key)+1e-7)blocked(`${key}仓容不足：需${need}，容量${capacity(run,key)}`);
  const lock=run(`workerLockReason('${key}')`);
  if(lock)blocked(`${key}岗位未开放：${lock}`);
  allocation(run,key);
  advance(run,`S.res['${key}']+1e-7>=${need}`);
}
function ensureInputs(run){ensureDirect(run,'stone',260000);ensureDirect(run,'coal',250000);}
function ensureCopperOrIron(run,key,need){
  if(resource(run,key)>=need)return;
  if(need>capacity(run,key)+1e-7)blocked(`${key}仓容不足：需${need}，容量${capacity(run,key)}`);
  let cycles=0;
  while(resource(run,key)+1e-7<need){
    if(++cycles>300)blocked(`${key}补产循环超过300轮`);
    ensureInputs(run);
    const before=resource(run,key);
    allocation(run,key);
    const raw=key==='copper'?'S.res.stone>=248&&S.res.coal>=248':'S.res.stone>=248&&S.res.coal>=124';
    advanceWhile(run,`S.res['${key}']<${need}&&${raw}`);
    if(resource(run,key)<=before+1e-7&&resource(run,key)+1e-7<need)blocked(`${key}本轮生产无增量`);
  }
}
function ensureSilverOrGold(run,key,need){
  if(resource(run,key)>=need)return;
  if(need>capacity(run,key)+1e-7)blocked(`${key}仓容不足：需${need}，容量${capacity(run,key)}`);
  let cycles=0;
  while(resource(run,key)+1e-7<need){
    if(++cycles>300)blocked(`${key}补产循环超过300轮`);
    ensureInputs(run);
    const before=resource(run,key);
    allocation(run,key);
    advanceWhile(run,`S.res['${key}']<${need}&&S.res.stone>=248&&S.res.coal>=124`);
    if(resource(run,key)<=before+1e-7&&resource(run,key)+1e-7<need)blocked(`${key}本轮生产无增量`);
  }
}
function ensureSteel(run,need,ironReserve){
  if(resource(run,'steel')>=need)return;
  if(need>capacity(run,'steel')+1e-7)blocked(`钢仓容不足：需${need}，容量${capacity(run,'steel')}`);
  const ironCap=capacity(run,'iron'),ironBuffer=Math.min(260000,ironCap-ironReserve);
  if(ironBuffer<124)blocked('铁仓容不足以保留补兵铁料并支撑冶钢');
  let cycles=0;
  while(resource(run,'steel')+1e-7<need){
    if(++cycles>300)blocked('冶钢补产循环超过300轮');
    ensureInputs(run);
    if(resource(run,'iron')<ironReserve+124){
      const target=Math.min(ironCap,ironReserve+ironBuffer);
      if(target<=resource(run,'iron')+1e-7)blocked('铁仓无法补足冶钢缓冲');
      ensureCopperOrIron(run,'iron',target);
      ensureInputs(run);
    }
    const before=resource(run,'steel');
    allocation(run,'steel');
    advanceWhile(run,`S.res.steel<${need}&&S.res.stone>=124&&S.res.coal>=124&&S.res.iron>=${ironReserve+124}`);
    // At 1002 population one tick can spend more than the old P95 124-iron guard.
    // Refill the training reserve after steel production instead of assuming a one-worker tick.
    if(resource(run,'steel')<=before+1e-7&&resource(run,'steel')+1e-7<need)blocked('冶钢本轮无增量');
  }
}
function ensureTrainingCosts(run,costs){
  for(const key of ['wood','stone','food'])if((costs[key]||0)>resource(run,key))ensureDirect(run,key,costs[key]);
  if((costs.copper||0)>resource(run,'copper'))ensureCopperOrIron(run,'copper',costs.copper);
  if((costs.iron||0)>resource(run,'iron'))ensureCopperOrIron(run,'iron',costs.iron);
  if((costs.silver||0)>resource(run,'silver'))ensureSilverOrGold(run,'silver',costs.silver);
  if((costs.gold||0)>resource(run,'gold'))ensureSilverOrGold(run,'gold',costs.gold);
  if((costs.steel||0)>resource(run,'steel'))ensureSteel(run,costs.steel,costs.iron||0);
  if((costs.iron||0)>resource(run,'iron'))ensureCopperOrIron(run,'iron',costs.iron);
  for(const [key,amount] of Object.entries(costs))if(resource(run,key)+1e-7<amount)blocked(`${key}不足：${resource(run,key)} < ${amount}`);
}
function restoreFormation(run,losses,originalForm){
  const start=run('S.tick'),startingResources=run('({...S.res})'),cost=replacementCost(run,losses);
  ensureTrainingCosts(run,cost);
  allocation(run,'tech');
  const spendStart=run('__trainingSpendEvents.length');
  const poolBefore=run('({...S.pool})');
  for(const [unit,count] of Object.entries(losses)){
    const queued=run(`train('${unit}',${count})`);
    if(!queued?.ok||queued.qty!==count)blocked(`${unit}训练队列失败：${JSON.stringify(queued)}`);
  }
  const complete=Object.entries(losses).map(([unit,count])=>`S.pool['${unit}']>=${(poolBefore[unit]||0)+count}`).join('&&')||'true';
  const trainingSeconds=advance(run,complete,10000);
  let current=run('JSON.parse(JSON.stringify(S.formation))');
  for(const [unit,count] of Object.entries(losses)){
    let remaining=count;
    for(const row of ['front','mid','back'])for(let index=0;index<(current[row]||[]).length&&remaining>0;index++){
      const now=current[row][index],original=originalForm[row]?.[index];
      if(now?.type!==unit||original?.type!==unit)continue;
      const add=Math.min(remaining,Math.max(0,original.count-now.count),run('regMax()')-now.count);
      if(add<=0)continue;
      run(`openFormModal('expedition','${row}',${index});S._formModalSel='${unit}';S._formModalQty=${add}`);
      assert.notEqual(run('confirmForm()'),false,`无法将${unit}×${add}编回远征编队`);
      remaining-=add;
      current=run('JSON.parse(JSON.stringify(S.formation))');
    }
    if(remaining>0)blocked(`${unit}损失无法映射回原编队阵位，剩余${remaining}`);
  }
  const finish=run("(()=>({army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool}}))()");
  assert.equal(finish.army,startBase.army,'普通战役补兵后总兵力未恢复');
  assert.deepEqual(countFormation(finish.formation),startUnitCounts,'普通战役补兵后兵种未恢复');
  const paidCost=JSON.parse(JSON.stringify(run(`(()=>{const paid={};for(const event of __trainingSpendEvents.slice(${spendStart}))paid[event.resource]=(paid[event.resource]||0)+event.amount;return paid})()`)));
  assert.deepEqual(paidCost,cost,'真实训练队列扣款与补招成本不一致');
  return{seconds:run('S.tick')-start,trainingSeconds,cost,paidCost,startingResources,
    endingResources:run('({...S.res})'),army:finish.army};
}
function makeBattleHarness(seed){
  const world=environment({rts_save:raw}),{run}=world;
  const loadStatus=run('loadSaveAndApply().status');
  assert.ok(['ok','migrated'].includes(loadStatus),'P271开发档无法读取');
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${sourceSave.ts}+(S.tick-${startBase.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1]();return true};
     globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
     globalThis.addLog=m=>S.log.push(String(m));
     globalThis.__trainingSpendEvents=[];
     const __basePayTrainingCost=payTrainingCost;
     globalThis.payTrainingCost=(cost,count)=>{
       for(const [resource,unitCost] of Object.entries(cost||{})){
         if(Object.prototype.hasOwnProperty.call(CFG.res,resource))
           __trainingSpendEvents.push({resource,amount:unitCost*count});
       }
       return __basePayTrainingCost(cost,count);
     };
     globalThis.__rng=${seed>>>0};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  return{run,loadStatus,world};
}

const trials=[];
const finalSaves=[];
for(let seed=1;seed<=seedCount;seed++){
  const {run,loadStatus,world}=makeBattleHarness(seed);
  for(let currentStage=stage;currentStage<=throughStage;currentStage++){
    assert.equal(run('S.defeated.length'),currentStage-1,'连续普通关卡路线出现跳关或未结算');
    const currentIndex=currentStage-1;
    const before=run("(()=>({tick:S.tick,army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},resources:{...S.res},items:{...S.items},merit:S.merit||0,essence:{...S.essence},defeated:S.defeated.slice()}))()");
    const cfg=run(`JSON.parse(JSON.stringify(CFG.enemies[${currentIndex}]))`);
    run(`selEnemy(${currentIndex});openBattle()`);
    assert.equal(run('S.battleActive'),true,`第${currentStage}关未开始`);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<2000){
      assert.equal(run('__step()'),true,`第${currentStage}关战斗回调丢失`);
      callbacks++;
    }
    assert.equal(run('S.battleActive'),false,`第${currentStage}关超过2000个战斗回调仍未结算`);
    const after=run("(()=>({tick:S.tick,army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},resources:{...S.res},items:{...S.items},merit:S.merit||0,essence:{...S.essence},defeated:S.defeated.slice(),round:B.round}))()");
    const beforeUnits=countFormation(before.formation),afterUnits=countFormation(after.formation),lossByUnit={};
    for(const [unit,count] of Object.entries(beforeUnits)){
      const lost=count-(afterUnits[unit]||0);
      if(lost>0)lossByUnit[unit]=lost;
    }
    const deployedLoss=Object.values(lossByUnit).reduce((sum,n)=>sum+n,0);
    assert.equal(before.army-after.army,deployedLoss,'普通战役阵型战损与兵力变化不一致');
    const win=after.defeated.includes(cfg.id);
    assert.equal(after.tick,before.tick,'战斗动画不应推进在线生产时钟');
    const rewardResources={};
    for(const key of Object.keys(before.resources)){
      const gain=(after.resources[key]||0)-(before.resources[key]||0);
      if(gain)rewardResources[key]=gain;
    }
    const rewardItems={};
    for(const key of Object.keys(before.items)){
      const gain=(after.items[key]||0)-(before.items[key]||0);
      if(gain)rewardItems[key]=gain;
    }
    run('exitBattle()');
    let replenishment=null,replenishmentBlocked=null;
    if(replenish&&win&&Object.keys(lossByUnit).length){
      try{replenishment=restoreFormation(run,lossByUnit,before.formation)}
      catch(error){if(!error.routeBlocked)throw error;replenishmentBlocked=error.message;}
    }
    trials.push({stage:currentStage,enemyId:cfg.id,name:cfg.name,seed,loadStatus,
      win,round:after.round,callbacks,
      start:{tick:before.tick,army:before.army,deployed:Object.values(beforeUnits).reduce((sum,n)=>sum+n,0)},
      end:{tick:run('S.tick'),army:run('armyCount()'),defeated:after.defeated.length},
      actualTroopLoss:deployedLoss,lossByUnit,
      reward:{resources:rewardResources,items:rewardItems,merit:after.merit-before.merit,essence:Object.fromEntries(Object.entries(rewardItems).filter(([key])=>key.includes('essence')))},
      configuredReward:cfg.reward,configuredDrops:cfg.drops||{},
      replacementCost:replacementCost(run,lossByUnit),
      replenishment,replenishmentBlocked,
      stockBefore:Object.fromEntries(['wood','stone','food','copper','iron','steel'].map(key=>[key,before.resources[key]||0])),
      stockAfter:Object.fromEntries(['wood','stone','food','copper','iron','steel'].map(key=>[key,after.resources[key]||0]))});
    if(!win||replenishmentBlocked)break;
  }
  const finalStage=run('S.defeated.length');
  if(finalStage===throughStage){
    assert.equal(run('save().ok'),true);
    const finalRaw=world.store.get('rts_save');
    const reload=environment({rts_save:finalRaw});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.defeated.length'),throughStage);
    assert.equal(reload.run('armyCount()'),startBase.army);
    const saveFile=`docs/codex/reports/data/p271-stage99-${label}-seed${seed}-save.json`;
    fs.writeFileSync(path.resolve(__dirname,'../../',saveFile),finalRaw,'utf8');
    finalSaves.push({seed,saveFile,sha256:crypto.createHash('sha256').update(finalRaw).digest('hex'),tick:run('S.tick'),army:run('armyCount()')});
  }
}

const report={kind:`P271 real paid ${label} campaign stages 46–99`,
  source:path.relative(process.cwd(),input),sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  inputState:{tick:startBase.tick,population:startBase.population,army:startBase.army,
    defeated:startBase.defeated,formationUnitCounts:startUnitCounts,
    stock:Object.fromEntries(['wood','stone','food','copper','iron','steel'].map(key=>[key,startBase.resources[key]||0]))},
  stage,throughStage,seedCount,label,trials,finalSaves,
  replenishRequested:replenish,
  scope:'Each fixed seed loads the same paid input save and sequentially battles 46–99. Every victory loss is replenished via real jobs, dynamic tick, train queue and formation. Any star soldier stays in reserve. Natural garrison is frozen by the VM harness; no browser or Android validation.'
};
const reportFile=path.resolve(__dirname,`../../docs/codex/reports/data/p271-stage46-99-${label}.json`);
fs.writeFileSync(reportFile,JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({source:report.source,sourceSha256:report.sourceSha256,stage,throughStage,seedCount,
  wins:trials.filter(x=>x.win).length,losses:trials.filter(x=>!x.win).map(x=>({stage:x.stage,seed:x.seed})),
  blocked:trials.filter(x=>x.replenishmentBlocked).map(x=>({stage:x.stage,reason:x.replenishmentBlocked})),
  onlineSeconds:finalSaves.map(x=>x.tick-startBase.tick),finalSaves,reportFile}));
