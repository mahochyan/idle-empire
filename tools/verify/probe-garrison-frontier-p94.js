'use strict';
// P94: 在P81共同晚期快照中，用当前驻军编队、战斗、结算和tick真实回放静态侵袭模板。
// 空驻军、1名最低攻击兵、10名最高攻击兵、以及把原远征整军转驻军分别对照。
// 所有写入仅发生在各自独立的开发harness内存存档，不读取或修改玩家浏览器档。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const inputArg=process.argv.find(x=>x.startsWith('--input='));
const input=path.resolve(inputArg?inputArg.slice('--input='.length):path.resolve(__dirname,'../../docs/codex/reports/data/p81-stock-scroll-paid.json'));
const raw=fs.readFileSync(input,'utf8');
const templatesArg=process.argv.find(x=>x.startsWith('--templates='));
const seedCountArg=process.argv.find(x=>x.startsWith('--seeds='));
const templateFilter=templatesArg?templatesArg.slice('--templates='.length).split(','):null;
const seedCount=Math.max(1,Math.min(20,Number(seedCountArg?.split('=')[1])||4));
const replenish=process.argv.includes('--replenish');
const {run:readRun}=environment({rts_save:raw},{garrison:true});
assert.ok(['ok','migrated'].includes(readRun('loadSaveAndApply().status')),'P81开发档无法读取');
const templateIds=readRun('CFG.invasions.map(x=>x.id)');
const selectedTemplates=templateFilter||templateIds;
for(const id of selectedTemplates)assert.ok(templateIds.includes(id),`未知驻军模板：${id}`);
const source=readRun("(()=>({tick:S.tick,population:popCurrent(),army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},resources:{...S.res},merit:S.merit||0}))()");
assert.equal(source.population,214,'本探针依赖P81的214人口晚期开发档');
assert.equal(source.army,437,'本探针依赖P81的437名现役兵');
const sourceCounts={};
for(const row of ['front','mid','back'])for(const u of source.formation[row]||[])sourceCounts[u.type]=(sourceCounts[u.type]||0)+u.count;
assert.equal(Object.values(sourceCounts).reduce((a,b)=>a+b,0),source.army,'P81存在未编入远征队的后备兵');
const availableTypes=Object.keys(sourceCounts).filter(type=>sourceCounts[type]>0);
const attackByType=Object.fromEntries(availableTypes.map(type=>[type,readRun(`weaponAttack('${type}')`)]));
const sortedTypes=[...availableTypes].sort((a,b)=>attackByType[a]-attackByType[b]||a.localeCompare(b));
const weakest=sortedTypes[0],strongest=sortedTypes.at(-1);
const fixedForm=JSON.parse(JSON.stringify(source.formation));

const invasionNames=Object.fromEntries(readRun('CFG.invasions.map(x=>[x.id,x.name])').map(([id,name])=>[id,name]));
const scenarios=['empty','one-weak','ten-strong','full-roster'];
const lines={front:'前排',mid:'中排',back:'后排'};

function makeRng(run,seed){
  run(`globalThis.__rng=${seed>>>0};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
}
function total(form){
  return ['front','mid','back'].reduce((sum,row)=>sum+(form[row]||[]).reduce((n,u)=>n+u.count,0),0);
}
function counts(form){
  const out={};
  for(const row of ['front','mid','back'])for(const u of form[row]||[])out[u.type]=(out[u.type]||0)+u.count;
  return out;
}
function addGarrisonUnit(run,row,type,qty,index){
  run(`openFormModal('garrison','${row}',${index});S._formModalSel='${type}';S._formModalQty=${qty}`);
  const result=run('confirmForm()');
  assert.notEqual(result,false,`无法通过真实编队函数配置${type}×${qty}`);
}
function setup(run,scenario){
  run("clrForm('expedition')");
  if(scenario==='empty')return;
  if(scenario==='one-weak'){
    addGarrisonUnit(run,'front',weakest,1,0);
    return;
  }
  if(scenario==='ten-strong'){
    assert.ok((sourceCounts[strongest]||0)>=10,`最强兵种${strongest}不足10人`);
    addGarrisonUnit(run,'front',strongest,10,0);
    return;
  }
  for(const row of ['front','mid','back']){
    for(let index=0;index<fixedForm[row].length;index++){
      const {type,count}=fixedForm[row][index];
      addGarrisonUnit(run,row,type,count,index);
    }
  }
  assert.equal(run('garrisonTotal()'),source.army,'转入驻军的人数没有保持原总兵力');
}

function resource(run,key){return Number(run(`S.res['${key}']||0`));}
function capacity(run,key){return Number(run(`resCap('${key}')`));}
function blocked(message){const error=new Error(message);error.routeBlocked=true;throw error;}
function advance(run,condition,max=200000){
  const before=run('S.tick');
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  if(!result.ok)blocked(`等待${condition}超时，当前库存=${JSON.stringify(run('({...S.res})'))}`);
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
  const pop=run('popCurrent()');
  const foodWorkers=Math.min(90,pop);
  assert.equal(run(`setPopAlloc('food',${foodWorkers})`)?.ok,true,'无法保障军粮岗位');
  if(role&&role!=='food'){
    assert.equal(run(`setPopAlloc('${role}',${pop-foodWorkers})`)?.ok,true,`无法分配${role}岗位`);
    assert.ok(run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')>0,
      `分配${role}后军粮净产非正`);
  }else if(role==='food')assert.equal(run(`setPopAlloc('food',${pop})`)?.ok,true,'无法切换粮食岗位');
  assert.equal(run('popAllocTotal()'),pop,'岗位分配未覆盖现有人口');
}
function ensureDirect(run,key,need){
  if(resource(run,key)>=need)return;
  if(need>capacity(run,key)+1e-7)blocked(`${key}仓容${capacity(run,key)}不足以存入补兵所需${need}`);
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
    const rawCondition=key==='copper'?'S.res.stone>=248&&S.res.coal>=248':'S.res.stone>=248&&S.res.coal>=124';
    advanceWhile(run,`S.res['${key}']<${need}&&${rawCondition}`);
    if(resource(run,key)<=before+1e-7&&resource(run,key)+1e-7<need)blocked(`${key}本轮生产无增量，无法补兵`);
  }
}
function ensureSteel(run,need,ironReserve){
  if(resource(run,'steel')>=need)return;
  if(need>capacity(run,'steel')+1e-7)blocked(`钢仓容${capacity(run,'steel')}不足以存入补兵所需${need}`);
  const ironCap=capacity(run,'iron'),ironBuffer=Math.min(260000,ironCap-ironReserve);
  if(ironBuffer<124)blocked('铁仓容不足以保留训练铁料并支撑冶钢');
  let cycles=0;
  while(resource(run,'steel')+1e-7<need){
    if(++cycles>300)blocked('冶钢补产循环超过300轮');
    ensureInputs(run);
    if(resource(run,'iron')<ironReserve+124){
      const target=Math.min(ironCap,ironReserve+ironBuffer);
      if(target<=resource(run,'iron')+1e-7)blocked('铁仓无法补足冶钢缓冲且保留补兵铁料');
      ensureCopperOrIron(run,'iron',target);
      ensureInputs(run);
    }
    const before=resource(run,'steel');
    allocation(run,'steel');
    advanceWhile(run,`S.res.steel<${need}&&S.res.stone>=124&&S.res.coal>=124&&S.res.iron>=${ironReserve+124}`);
    if(resource(run,'iron')+125<ironReserve)blocked('冶钢消耗突破训练铁料保留线');
    if(resource(run,'steel')<=before+1e-7&&resource(run,'steel')+1e-7<need)blocked('本轮冶钢无增量，无法补兵');
  }
}
function replacementCost(run,losses){
  const cost={};
  for(const [unit,count] of Object.entries(losses)){
    const unitCost=run(`CFG.units['${unit}'].cost||{}`);
    for(const [key,amount] of Object.entries(unitCost))cost[key]=(cost[key]||0)+amount*count;
  }
  return cost;
}
function ensureTrainingCosts(run,costs){
  for(const key of ['wood','stone','food'])if((costs[key]||0)>resource(run,key))ensureDirect(run,key,costs[key]);
  if((costs.copper||0)>resource(run,'copper'))ensureCopperOrIron(run,'copper',costs.copper);
  if((costs.iron||0)>resource(run,'iron'))ensureCopperOrIron(run,'iron',costs.iron);
  if((costs.steel||0)>resource(run,'steel'))ensureSteel(run,costs.steel,costs.iron||0);
  for(const [key,amount] of Object.entries(costs))if(resource(run,key)+1e-7<amount)blocked(`${key}仍不足：库存${resource(run,key)}，补兵需要${amount}`);
}
function restoreGarrison(run,losses,originalForm){
  const refillStart=run('S.tick');
  // 隔离补兵时长，避免验证中的自然随机侵袭插入第二场战斗并污染同一阵容的恢复结果。
  run('CFG.garrisonInvade.chance=0');
  const startingResources=run('({...S.res})');
  const cost=replacementCost(run,losses);
  ensureTrainingCosts(run,cost);
  allocation(run,'tech');
  const poolBefore=run('({...S.pool})');
  for(const [unit,count] of Object.entries(losses)){
    const queued=run(`train('${unit}',${count})`);
    if(!queued?.ok||queued.qty!==count)blocked(`${unit}训练队列不足：${JSON.stringify(queued)}`);
  }
  const complete=Object.entries(losses).map(([unit,count])=>`S.pool['${unit}']>=${(poolBefore[unit]||0)+count}`).join('&&')||'true';
  const trainingSeconds=advance(run,complete,10000);
  let current=run('JSON.parse(JSON.stringify(S._garrisonForm))');
  for(const [unit,count] of Object.entries(losses)){
    let remaining=count;
    for(const row of ['front','mid','back']){
      for(let index=0;index<(current[row]||[]).length&&remaining>0;index++){
        const now=current[row][index],original=originalForm[row]?.[index];
        if(now?.type!==unit||original?.type!==unit)continue;
        const deficit=Math.max(0,original.count-now.count);
        const add=Math.min(remaining,deficit,run('regMax()')-now.count);
        if(add<=0)continue;
        run(`openFormModal('garrison','${row}',${index});S._formModalSel='${unit}';S._formModalQty=${add}`);
        assert.notEqual(run('confirmForm()'),false,`无法将${unit}×${add}编回驻军`);
        remaining-=add;
        current=run('JSON.parse(JSON.stringify(S._garrisonForm))');
      }
    }
    if(remaining>0)blocked(`${unit}损失无法映射回原驻军阵位，剩余${remaining}`);
  }
  const finish=run("(()=>({army:armyCount(),garrison:garrisonTotal(),form:JSON.parse(JSON.stringify(S._garrisonForm)),pool:{...S.pool}}))()");
  if(finish.army!==source.army||finish.garrison!==source.army)
    blocked(`驻军补兵后总量未恢复：${JSON.stringify({expected:source.army,finish,losses})}`);
  return{seconds:run('S.tick')-refillStart,trainingSeconds,trained:{...losses},cost,
    startingResources,endingResources:run('({...S.res})'),army:finish.army,garrison:finish.garrison};
}

const trials=[];
for(const scenario of scenarios){
  for(const templateId of selectedTemplates){
    for(let seed=1;seed<=seedCount;seed++){
      const {run}=environment({rts_save:raw},{garrison:true});
      const loadStatus=run('loadSaveAndApply().status');
      assert.ok(['ok','migrated'].includes(loadStatus),`P81开发档无法读取：${loadStatus}`);
      makeRng(run,seed);
      setup(run,scenario);
      const deployedBefore=run("JSON.parse(JSON.stringify(S._garrisonForm))");
      const start={tick:run('S.tick'),soldiers:run('armyCount()'),garrisonSoldiers:run('garrisonTotal()'),resources:run('({...S.res})'),merit:run('S.merit||0')};
      assert.equal(run(`triggerGarrisonInvasion('${templateId}')`),true,`${templateId}未能触发`);
      let ticks=0;
      while(!run('S.garrison.result')&&ticks<40){run('tick()');ticks++;}
      const result=run('JSON.parse(JSON.stringify(S.garrison.result))');
      assert.ok(result,`${templateId}在40个tick内未完成结算`);
      const deployedAfter=run("JSON.parse(JSON.stringify(S._garrisonForm))");
      const beforeCounts=counts(deployedBefore),afterCounts=counts(deployedAfter),losses={};
      for(const [type,count] of Object.entries(beforeCounts)){
        const loss=count-(afterCounts[type]||0);
        if(loss>0)losses[type]=loss;
      }
      const end={tick:run('S.tick'),soldiers:run('armyCount()'),garrisonSoldiers:run('garrisonTotal()'),resources:run('({...S.res})'),merit:run('S.merit||0')};
      assert.equal(start.soldiers-end.soldiers,total(deployedBefore)-total(deployedAfter),'驻军阵型损失与总兵力变化不一致');
      let replenishment=null,replenishmentBlocked=null;
      if(replenish&&scenario==='full-roster'&&Object.keys(losses).length){
        try{replenishment=restoreGarrison(run,losses,deployedBefore)}
        catch(error){if(!error.routeBlocked)throw error;replenishmentBlocked=error.message;}
      }
      trials.push({scenario,templateId,templateName:invasionNames[templateId],seed,loadStatus,
        start:{tick:start.tick,soldiers:start.soldiers,garrisonSoldiers:start.garrisonSoldiers},
        result:{outcome:result.outcome,rounds:result.rounds,ourLeft:result.ourLeft,enemyLeft:result.enemyLeft,
          reward:result.reward,loss:result.loss,towerShots:result.towerShots,towerDmg:result.towerDmg},
        battleFormation:replenish&&scenario==='full-roster'?deployedAfter:undefined,
        actualTroopLoss:Object.values(losses).reduce((sum,count)=>sum+count,0),lossByUnit:losses,
        tickElapsed:end.tick-start.tick,meritDelta:end.merit-start.merit,replenishment,replenishmentBlocked,
        ending:{soldiers:end.soldiers,garrisonSoldiers:end.garrisonSoldiers,
          resources:Object.fromEntries(['wood','stone','food'].map(k=>[k,end.resources[k]]))}});
    }
  }
}

console.log(JSON.stringify({kind:'P94 same-checkpoint live garrison template battle frontier',
  source:path.relative(process.cwd(),input),sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  sourceState:{tick:source.tick,population:source.population,army:source.army,
    deployedUnitCounts:sourceCounts,weakestType:weakest,weakestAttack:attackByType[weakest],
    strongestType:strongest,strongestAttack:attackByType[strongest],
    resources:Object.fromEntries(['wood','stone','food'].map(k=>[k,source.resources[k]]))},
  setup:'原远征编队用clrForm释放后，通过openFormModal+confirmForm真实转入驻军；空驻军/最低攻击兵1名/最高攻击兵10名/原437人整军四组。',
  selectedTemplates,seedCount,trials,
  replenishmentRequested:replenish,
  scope:'只测当前工作区五个固定驻军模板在P81后期快照、同源437人军队下的战斗/损兵/奖励或掠夺。启用--replenish时，仅对整军模式中的实际损兵沿岗位→资源→train队列→驻军编队动作回补。模板/种子不代表自然触发概率、玩家到达时间或长期平衡；每条试验独立载入harness内存档。'
},null,2));
