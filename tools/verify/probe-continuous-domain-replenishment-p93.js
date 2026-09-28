'use strict';
// P93: 从同一张P81晚期检查点对机巧遗迹/电力挑战做连续实战，并逐次真实生产/训练战损。
// 用--encounter=godCrystal|guardianStone|phantomFlower|medal选择挑战；默认首败停止。
// 每次战斗后可恢复战前编成；可用--resume-after-defeat验证战败后的实训与复试。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const inputArg=process.argv.find(x=>x.startsWith('--input='));
const input=path.resolve(inputArg?inputArg.slice('--input='.length):path.resolve(__dirname,'../../docs/codex/reports/data/p81-stock-scroll-paid.json'));
const raw=fs.readFileSync(input,'utf8');
const encounterArg=process.argv.find(x=>x.startsWith('--encounter='));
const encounterKey=encounterArg?encounterArg.slice('--encounter='.length):'godCrystal';
const supportedEncounters=['godCrystal','guardianStone','phantomFlower','medal'];
assert.ok(supportedEncounters.includes(encounterKey),`不支持的挑战键：${encounterKey}`);
const maxWinsArg=process.argv.find(x=>x.startsWith('--max-attempts='))||process.argv.find(x=>x.startsWith('--max-wins='));
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const resumeAfterDefeat=process.argv.includes('--resume-after-defeat');
const attemptLimit=maxWinsArg?Math.max(1,Math.min(30,Number(maxWinsArg.split('=')[1])||1)):12;
let rng=seedArg?(Number(seedArg.split('=')[1])>>>0):1;
if(!rng)rng=1;

const {run}=environment({rts_save:raw});
const loadStatus=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loadStatus),`P81开发档无法读取：${loadStatus}`);
const baseConfig=run(`specialEncounterConfig('${encounterKey}')`);
assert.ok(baseConfig&&!baseConfig.wildHunt,`未知或非材料挑战：${encounterKey}`);
const killValueKey=baseConfig.killValueKey||'godRevival';
const rewardNames=[...new Set([
  ...Object.keys(baseConfig.reward||{}),
  ...Object.keys(baseConfig.bonusReward||{}),
  ...Object.keys(baseConfig.bonusItemReward||{})
])];
const availableKeys=run('({resources:Object.keys(S.res),items:Object.keys(S.items)})');
const rewardSpec={resources:rewardNames.filter(k=>availableKeys.resources.includes(k)),
  items:rewardNames.filter(k=>availableKeys.items.includes(k))};
function rewardSnapshot(){return run('(()=>({resources:{...S.res},items:{...S.items}}))()')}
function rewardGain(before,after){
  return{
    resources:Object.fromEntries(rewardSpec.resources.map(k=>[k,(after.resources[k]||0)-(before.resources[k]||0)])),
    items:Object.fromEntries(rewardSpec.items.map(k=>[k,(after.items[k]||0)-(before.items[k]||0)]))
  };
}
const start=run(`(()=>({tick:S.tick,kill:S.killValues['${killValueKey}']||0,army:armyCount(),population:popCurrent(),
  resources:{...S.res},items:{...S.items},
  formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},alloc:{...S.popAlloc}}))()`);
start.rewards=rewardSnapshot();
assert.equal(start.population,214,'本验证依赖P81的214人口开发快照');
assert.equal(start.army,437,'P81回补档应为437名现役兵');

const lines={front:'前排',mid:'中排',back:'后排'};
function countFormation(form){
  const counts={};
  for(const row of Object.keys(lines))for(const unit of form[row]||[])
    counts[unit.type]=(counts[unit.type]||0)+unit.count;
  return counts;
}
const template=Object.fromEntries(Object.entries(start.formation).map(([row,units])=>[
  row,units.map(({type,count})=>({type,count}))
]));
const deployedAtStart=countFormation(template);
assert.equal(Object.values(deployedAtStart).reduce((a,b)=>a+b,0),start.army,
  '快照中存在未部署后备兵，不能用此阵容做整军回补验证');

run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const next=__timers.entries().next().value;if(!next)return false;
    __timers.delete(next[0]);next[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=message=>S.log.push(String(message));
  globalThis.__rng=${rng};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __rng=x>>>0;return __rng/4294967296};`);

const phaseSeconds={stone:0,coal:0,copper:0,iron:0,silver:0,gold:0,steel:0,wood:0,food:0,training:0};
let simulatedSeconds=0;
function blocked(message){const error=new Error(message);error.routeBlocked=true;throw error;}
function advance(condition,phase,max=200000){
  const before=run('S.tick');
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}
    return{n,ok:!!(${condition})}})()`);
  const elapsed=run('S.tick')-before;
  simulatedSeconds+=elapsed;phaseSeconds[phase]=(phaseSeconds[phase]||0)+elapsed;
  if(!result.ok)blocked(`等待${condition}超时；当前库存=${JSON.stringify(run('({...S.res})'))}`);
  return result.n;
}
function advanceWhile(condition,phase,max=200000){
  const before=run('S.tick');
  const result=run(`(()=>{let n=0;while((${condition})&&n<${max}){tick();n++}return n})()`);
  const elapsed=run('S.tick')-before;
  simulatedSeconds+=elapsed;phaseSeconds[phase]=(phaseSeconds[phase]||0)+elapsed;
  if(result>=max)blocked(`阶段循环超过${max}秒：${condition}`);
  return result;
}
function resource(key){return Number(run(`S.res['${key}']||0`));}
function capacity(key){return Number(run(`resCap('${key}')`));}
function allocation(role){
  const current=run('({...S.popAlloc})');
  for(const [key,value] of Object.entries(current))if(value>0){
    const result=run(`setPopAlloc('${key}',0)`);
    assert.equal(result?.ok,true,`无法撤出${key}岗位`);
  }
  const pop=run('popCurrent()');
  const foodWorkers=Math.min(90,pop);
  assert.equal(run(`setPopAlloc('food',${foodWorkers})`)?.ok,true,'无法保障军粮岗位');
  if(role==='food'){
    const remaining=pop-foodWorkers;
    assert.equal(run(`setPopAlloc('food',${pop})`)?.ok,true,'无法切换粮食岗位');
    return;
  }
  if(role){
    const workers=pop-foodWorkers;
    assert.equal(run(`setPopAlloc('${role}',${workers})`)?.ok,true,`无法分配${role}岗位`);
  }
  assert.equal(run('popAllocTotal()'),pop,'岗位分配未覆盖现有人口');
  if(role&&role!=='food')assert.ok(run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')>0,
    `分配${role}后军粮净产非正`);
}
function ensureDirect(key,need){
  if(resource(key)>=need)return;
  if(need>capacity(key)+1e-7)blocked(`${key}仓容${capacity(key)}不足以存入补兵所需${need}`);
  const lock=run(`workerLockReason('${key}')`);
  if(lock)blocked(`${key}岗位未开放：${lock}`);
  allocation(key);
  advance(`S.res['${key}']+1e-7>=${need}`,key);
}
function ensureInputs(){
  ensureDirect('stone',260000);
  ensureDirect('coal',250000);
}
function ensureCopperOrIron(key,need){
  if(resource(key)>=need)return;
  if(need>capacity(key)+1e-7)blocked(`${key}仓容不足：需${need}，容量${capacity(key)}`);
  let cycles=0;
  while(resource(key)+1e-7<need){
    if(++cycles>300)blocked(`${key}补产循环超过300轮`);
    ensureInputs();
    const before=resource(key);
    allocation(key);
    const rawCondition=key==='copper'
      ?'S.res.stone>=248&&S.res.coal>=248'
      :'S.res.stone>=248&&S.res.coal>=124';
    advanceWhile(`S.res['${key}']<${need}&&${rawCondition}`,key);
    if(resource(key)<=before+1e-7&&resource(key)+1e-7<need)
      blocked(`${key}本轮生产无增量，无法补兵`);
  }
}
function ensureSilverOrGold(key,need){
  if(resource(key)>=need)return;
  if(need>capacity(key)+1e-7)blocked(`${key}仓容不足：需${need}，容量${capacity(key)}`);
  let cycles=0;
  while(resource(key)+1e-7<need){
    if(++cycles>300)blocked(`${key}补产循环超过300轮`);
    ensureInputs();
    const before=resource(key);
    allocation(key);
    advanceWhile(`S.res['${key}']<${need}&&S.res.stone>=248&&S.res.coal>=124`,key);
    if(resource(key)<=before+1e-7&&resource(key)+1e-7<need)
      blocked(`${key}本轮生产无增量，无法补兵`);
  }
}
function ensureSteel(need,ironReserve){
  if(resource('steel')>=need)return;
  if(need>capacity('steel')+1e-7)blocked(`钢仓容${capacity('steel')}不足以存入补兵所需${need}`);
  const ironCap=capacity('iron');
  const ironBuffer=Math.min(260000,ironCap-ironReserve);
  if(ironBuffer<124)blocked(`铁仓容不足以保留训练铁料${ironReserve}并支撑冶钢`);
  let cycles=0;
  while(resource('steel')+1e-7<need){
    if(++cycles>300)blocked('冶钢补产循环超过300轮');
    ensureInputs();
    if(resource('iron')<ironReserve+124){
      const target=Math.min(ironCap,ironReserve+ironBuffer);
      if(target<=resource('iron')+1e-7)blocked('铁仓无法补足冶钢缓冲且保留补兵铁料');
      ensureCopperOrIron('iron',target);
      // 补铁岗位会消耗刚备好的石料与煤；冶钢前必须重新备料。
      ensureInputs();
    }
    const before=resource('steel');
    allocation('steel');
    advanceWhile(`S.res.steel<${need}&&S.res.stone>=124&&S.res.coal>=124&&S.res.iron>=${ironReserve+124}`,'steel');
    assert.ok(resource('iron')+125>=ironReserve,
      `冶钢消耗突破了为补兵保留的铁料：${resource('iron')} < ${ironReserve}`);
    if(resource('steel')<=before+1e-7&&resource('steel')+1e-7<need)
      blocked('本轮冶钢无增量，无法补兵');
  }
}
function ensureTrainingCosts(costs){
  for(const key of ['wood','stone','food'])if(costs[key]>resource(key))ensureDirect(key,costs[key]);
  if(costs.copper>resource('copper'))ensureCopperOrIron('copper',costs.copper);
  if(costs.iron>resource('iron'))ensureCopperOrIron('iron',costs.iron);
  if(costs.silver>resource('silver'))ensureSilverOrGold('silver',costs.silver);
  if(costs.gold>resource('gold'))ensureSilverOrGold('gold',costs.gold);
  if(costs.steel>resource('steel'))ensureSteel(costs.steel,costs.iron||0);
  for(const [key,amount] of Object.entries(costs))if(resource(key)+1e-7<amount)
    blocked(`${key}仍不足：库存${resource(key)}，补兵需要${amount}`);
}
function replacementCost(lossByUnit){
  const total={};
  for(const [unit,count] of Object.entries(lossByUnit)){
    const costs=run(`CFG.units['${unit}'].cost||{}`);
    for(const [key,amount] of Object.entries(costs))total[key]=(total[key]||0)+amount*count;
  }
  return total;
}
function restoreArmy(lossByUnit,costs){
  const refillStart=run('S.tick');
  const phasesBefore={...phaseSeconds};
  const startingResources=run('({...S.res})');
  ensureTrainingCosts(costs);
  allocation('tech');
  const poolBefore=run('({...S.pool})');
  for(const [unit,count] of Object.entries(lossByUnit)){
    const result=run(`train('${unit}',${count})`);
    if(!result?.ok||result.qty!==count)blocked(`${unit}训练队列不足：${JSON.stringify(result)}`);
  }
  const complete=Object.entries(lossByUnit).map(([unit,count])=>
    `S.pool['${unit}']>=${(poolBefore[unit]||0)+count}`).join('&&')||'true';
  advance(complete,'training',10000);
  run("clrForm('expedition')");
  for(const [row,units] of Object.entries(template))for(let slot=0;slot<units.length;slot++){
    const {type,count}=units[slot];
    const placed=run(`(()=>{openFormModal('expedition','${row}',${slot});
      S._formModalSel='${type}';S._formModalQty=${count};return confirmForm()})()`);
    assert.notEqual(placed,false,`无法恢复${lines[row]}${slot+1}号位 ${type}×${count}`);
  }
  const finish=run(`(()=>({army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool}}))()`);
  assert.equal(finish.army,start.army,'真实补兵后总兵力没有恢复到战前值');
  assert.deepEqual(countFormation(finish.formation),deployedAtStart,'真实补兵后兵种数量与战前阵容不一致');
  return{
    seconds:run('S.tick')-refillStart,
    startingResources,
    endingResources:run('({...S.res})'),
    trained:{...lossByUnit},
    army:finish.army,
    phaseSeconds:Object.fromEntries(Object.keys(phaseSeconds).map(key=>[
      key,phaseSeconds[key]-(phasesBefore[key]||0)
    ]))
  };
}

const attempts=[];
let wins=0,stopReason='达到本探针尝试上限',stoppedEarly=false;
for(let attempt=1;attempt<=attemptLimit;attempt++){
  const config=baseConfig;
  const before=run(`(()=>({tick:S.tick,kill:S.killValues['${killValueKey}']||0,army:armyCount(),
    formation:JSON.parse(JSON.stringify(S.formation))}))()`);
  before.rewards=rewardSnapshot();
  run(`openMaterialDomain('${encounterKey}')`);
  assert.equal(run('S.battleActive'),true,`${encounterKey}挑战未启动`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__step()'),true,`${encounterKey}战斗回调丢失`);callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${encounterKey}单场战斗超过1000个回调`);
  const after=run(`(()=>({tick:S.tick,kill:S.killValues['${killValueKey}']||0,army:armyCount(),
    formation:JSON.parse(JSON.stringify(S.formation)),round:B.round}))()`);
  after.rewards=rewardSnapshot();
  const beforeUnits=countFormation(before.formation),afterUnits=countFormation(after.formation),lossByUnit={};
  for(const [unit,count] of Object.entries(beforeUnits)){
    const loss=count-(afterUnits[unit]||0);
    if(loss>0)lossByUnit[unit]=loss;
  }
  const deployedLoss=Object.values(lossByUnit).reduce((sum,count)=>sum+count,0);
  assert.equal(before.army-after.army,deployedLoss,'编队战损与兵力池变化不一致');
  const win=after.kill>before.kill;
  const record={attempt,beforeKill:before.kill,afterKill:after.kill,win,round:after.round,
    callbacks,deployedLoss,lossByUnit,rewardGain:rewardGain(before.rewards,after.rewards),
    replacementCost:replacementCost(lossByUnit)};
  attempts.push(record);
  if(!win&&!resumeAfterDefeat){
    stopReason=`首次战败于警戒值${before.kill}，按本轮边界停止；未模拟战败后复试`;
    stoppedEarly=true;break;
  }
  if(win)wins++;
  if(Object.keys(lossByUnit).length){
    try{
      record.replenishment=restoreArmy(lossByUnit,record.replacementCost);
      if(!win)record.recoveredAfterDefeat=true;
    }
    catch(error){
      if(!error.routeBlocked)throw error;
      record.replenishmentBlocked=error.message;
      record.blockingSnapshot=run(`(()=>({tick:S.tick,army:armyCount(),resources:{...S.res},
        capacities:Object.fromEntries(['stone','coal','copper','iron','steel'].map(k=>[k,resCap(k)])),
        allocation:{...S.popAlloc},pool:{...S.pool}}))()`);
      record.blockedPhaseSeconds={...phaseSeconds};
      stopReason=`胜利后无法继续真实补齐战损：${error.message}`;
      stoppedEarly=true;
      break;
    }
  }else record.replenishment={seconds:0,trained:{},army:after.army,phaseSeconds:{...phaseSeconds}};
  if(!win)stopReason=`战败于警戒值${before.kill}后已真实补满，继续复试`;
}
if(!stoppedEarly&&attempts.length>=attemptLimit)stopReason='达到本探针尝试上限';

const paidReplacementCost={},unpaidVictoryReplacementEstimate={},defeatReplacementEstimate={};
let totalDeployedLoss=0,totalWinDeployedLoss=0,totalReplenishmentSeconds=0;
for(const trial of attempts){
  totalDeployedLoss+=trial.deployedLoss;
  totalReplenishmentSeconds+=trial.replenishment?.seconds||0;
  const target=trial.replenishment?paidReplacementCost
    :(trial.win?unpaidVictoryReplacementEstimate:defeatReplacementEstimate);
  if(trial.win)totalWinDeployedLoss+=trial.deployedLoss;
  for(const [key,amount] of Object.entries(trial.replacementCost))
    target[key]=(target[key]||0)+amount;
}
const finish=run(`(()=>({tick:S.tick,kill:S.killValues['${killValueKey}']||0,army:armyCount(),
  resources:Object.fromEntries(['stone','coal','copper','iron','steel','food','gold','silver','wood']
    .map(k=>[k,S.res[k]]))}))()`);
const detail=process.argv.includes('--detail');
const compactAttempts=attempts.map(trial=>{
  if(detail)return trial;
  const result={...trial};
  delete result.blockingSnapshot;
  if(trial.replenishment){
    const r=trial.replenishment;
    result.replenishment={seconds:r.seconds,trained:r.trained,army:r.army,
      endingStocks:Object.fromEntries(['stone','coal','copper','iron','steel','food']
        .map(key=>[key,r.endingResources?.[key]??null])),phaseSeconds:r.phaseSeconds};
  }
  return result;
});
console.log(JSON.stringify({
  kind:'continuous fixed-seed material challenge with real replacement production and training after each attempt',
  source:path.relative(process.cwd(),input),sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  encounter:encounterKey,rewardSpec,loadStatus,seed:rng,attemptLimit,start:{tick:start.tick,kill:start.kill,army:start.army,population:start.population,
    rewardStocks:{resources:Object.fromEntries(rewardSpec.resources.map(k=>[k,start.rewards.resources[k]])),
      items:Object.fromEntries(rewardSpec.items.map(k=>[k,start.rewards.items[k]]))},
    resources:detail?start.resources:Object.fromEntries(['stone','coal','copper','iron','steel','food']
      .map(key=>[key,start.resources[key]]))},
  wins,attempts:compactAttempts,totalDeployedLoss,totalWinDeployedLoss,
  paidReplacementCost,unpaidVictoryReplacementEstimate,defeatReplacementEstimate,
  totalReplenishmentSeconds,simulatedSeconds,
  phaseSeconds,finish,stopReason,
  scope:`Same 437-soldier formation is restored using live costs, jobs, ticks, queues and formation actions. ${resumeAfterDefeat?'Defeat is also actually replenished before retrying at the unchanged alert value.':'Stops at the first defeat.'} Stops on an actual replenishment block or attempt cap; no player browser storage is accessed.`
},null,2));
