'use strict';
// 新档零战斗先扩人口：早期市场出售基础资源，不研究铸币术，不直接注入资源。
// 可选 --session-profile=600:28800 把每600在线秒后接8小时真实离线结算；
// --capture-final-save 通过真实save()把终档JSON写入探针输出，不写玩家浏览器存档。
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const captureHeadroomSave=process.argv.includes('--capture-headroom-save');
const captureFinalSave=process.argv.includes('--capture-final-save');
const capturePopulation14Save=process.argv.includes('--capture-population14-save');
const researchWorkersArg=process.argv.find(arg=>arg.startsWith('--research-workers='));
const researchPriority=process.argv.includes('--research-priority')||!!researchWorkersArg;
const researchWorkers=researchWorkersArg?Number(researchWorkersArg.split('=')[1]):researchPriority?4:2;
assert.ok(Number.isInteger(researchWorkers)&&researchWorkers>=2&&researchWorkers<=7,'研究岗位数须为2–7');
const sessionArg=process.argv.find(arg=>arg.startsWith('--session-profile='));
let sessionProfile=null;
if(sessionArg){
  const [activeSec,offlineSec]=sessionArg.slice('--session-profile='.length).split(':').map(Number);
  assert.ok(Number.isSafeInteger(activeSec)&&activeSec>=60,'每次在线时长须为至少60模拟秒');
  assert.ok(Number.isSafeInteger(offlineSec)&&offlineSec>=120,'离线时长须为至少120模拟秒');
  sessionProfile={activeSec,offlineSec};
}
const e=environment();
const run=expression=>e.run(expression);
if(sessionProfile){
  run(`(()=>{
    const g=globalThis;
    g.__p101RawTick=tick;
    g.__p101OriginalDateNow=Date.now;
    g.__p101VirtualNow=Date.now();
    Date.now=()=>g.__p101VirtualNow;
    g.__p101ActiveSeconds=0;
    g.__p101OfflineSeconds=0;
    g.__p101MinFood=Number(S.res.food)||0;
    g.__p101OfflineSessions=[];
    g.__p101Settling=false;
    let nextPause=${sessionProfile.activeSec};
    g.tick=function(){
      if(g.__p101Settling){
        const result=g.__p101RawTick();
        if(Number.isFinite(S.res.food))g.__p101MinFood=Math.min(g.__p101MinFood,S.res.food);
        return result;
      }
      const result=g.__p101RawTick();
      g.__p101ActiveSeconds++;
      g.__p101VirtualNow+=1000;
      if(Number.isFinite(S.res.food))g.__p101MinFood=Math.min(g.__p101MinFood,S.res.food);
      if(g.__p101ActiveSeconds>=nextPause){
        const saved=save();
        if(!saved?.ok)throw Error('短时上线检查点保存失败：'+JSON.stringify(saved));
        const savedTs=Number(_loadedTs);
        if(!Number.isFinite(savedTs))throw Error('短时上线检查点缺少有效保存时间');
        const beforeOffline={population:popCurrent(),capacity:maxPop(),growthClock:S.population.growthClock,
          resources:{...S.res}};
        g.__p101VirtualNow=savedTs+${sessionProfile.offlineSec}*1000;
        g.__p101Settling=true;
        let settled;
        try{settled=settleOffline();}finally{g.__p101Settling=false;}
        if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})
          throw Error('短时上线离线结算失败：'+JSON.stringify(settled));
        if(popCurrent()!==beforeOffline.population||maxPop()!==beforeOffline.capacity||
          S.population.growthClock!==beforeOffline.growthClock)
          throw Error('离线推进错误地改变了人口/住房/出生钟：'+JSON.stringify({beforeOffline,
            after:{population:popCurrent(),capacity:maxPop(),growthClock:S.population.growthClock}}));
        g.__p101OfflineSeconds+=settled.durationSec;
        g.__p101OfflineSessions.push({activeSeconds:g.__p101ActiveSeconds,before:beforeOffline,
          durationSec:settled.durationSec,gains:settled.gains,population:popCurrent(),capacity:maxPop(),
          growthClock:S.population.growthClock,resources:{...S.res}});
        nextPause+=${sessionProfile.activeSec};
      }
      return result;
    };
  })()`);
}
const actions={build:0,allocate:0,research:0,settlement:0,exchange:0};
const milestones=[];
let minFood=run('S.res.food');
let population14IndustryCheck=null;
function timing(){
  if(!sessionProfile)return{activeOnlineSeconds:run('S.tick'),offlineSeconds:0};
  return run('({activeOnlineSeconds:globalThis.__p101ActiveSeconds,offlineSeconds:globalThis.__p101OfflineSeconds})');
}
function snapshot(label){
  const x=JSON.parse(JSON.stringify(run(`({second:S.tick,capacity:maxPop(),population:popCurrent(),
    allocated:popAllocTotal(),free:popFree(),popAlloc:{...S.popAlloc},res:{...S.res},
    caps:{basic:storageCapacity(),tech:resCap('tech'),coal:resCap('coal'),copper:resCap('copper'),iron:resCap('iron')},
    science:[...S.sciences],settlements:{...S.settlements},battleWins:S.defeated.length})`)));
  const elapsed=timing();
  const stateSave=captureHeadroomSave&&label==='expand-smallTown-1'
    ?run("(()=>{const result=save();if(!result?.ok)throw Error('人口空位检查点存档失败');return localStorage.getItem('rts_save')})()")
    :null;
  milestones.push({label,...x,...elapsed,actions:{...actions},...(stateSave?{stateSave}:{})});
}
function auditPopulation14Package(saveText,packageAllocation){
  const isolated=environment({rts_save:saveText});
  isolated.run('load()');
  const loaded=JSON.parse(JSON.stringify(isolated.run('({tick:S.tick,population:popCurrent(),capacity:maxPop(),food:S.res.food})')));
  assert.equal(loaded.population,14);
  assert.equal(loaded.capacity,14);
  const target=JSON.stringify(packageAllocation);
  const setResult=JSON.parse(JSON.stringify(isolated.run(`(()=>{
    const target=${target};
    for(const rk of Object.keys(S.popAlloc)){
      const value=target[rk]||0;
      if(value<(S.popAlloc[rk]||0)){
        const r=setPopAlloc(rk,value);
        if(!r||!r.ok)throw Error('岗位撤回失败：'+rk+' '+JSON.stringify(r));
      }
    }
    for(const rk of Object.keys(target)){
      if(target[rk]>(S.popAlloc[rk]||0)){
        const r=setPopAlloc(rk,target[rk]);
        if(!r||!r.ok)throw Error('岗位分配失败：'+rk+' '+JSON.stringify(r));
      }
    }
    return{allocated:popAllocTotal(),free:popFree(),allocation:{...S.popAlloc}};
  })()`)));
  const trace=JSON.parse(JSON.stringify(isolated.run(`(()=>{
    const before={...S.res};let minFood=S.res.food;
    for(let i=0;i<120;i++){tick();minFood=Math.min(minFood,S.res.food)}
    const after={...S.res};const next=productionSecond(1,false);
    const uncappedNext=productionSecond(1,true);const stableNet={};const uncappedPotential={};
    for(const rk of ['wood','stone','food','tech','coal','copper','iron']){
      stableNet[rk]=Number(((next[rk]||0)-(S.res[rk]||0)).toFixed(4));
      uncappedPotential[rk]=Number(((uncappedNext[rk]||0)-(S.res[rk]||0)).toFixed(4));
    }
    const coinResult=setPopAlloc('coin',1);
    return{tick:S.tick,population:popCurrent(),capacity:maxPop(),minFood:Number(minFood.toFixed(4)),
      before,after,stableNetPerSecond:stableNet,uncappedPotentialPerSecond:uncappedPotential,
      coinGate:{ok:coinResult?.ok??false,reason:coinResult?.reason||null,lock:workerLockReason('coin'),
        coinWorkers:S.popAlloc.coin||0,free:popFree()}};
  })()`)));
  assert.equal(trace.tick-loaded.tick,120);
  assert.equal(trace.population,14);
  assert.equal(trace.capacity,14);
  assert.ok(trace.minFood>0);
  for(const rk of ['wood','food','tech','coal','copper','iron'])
    assert.ok(trace.uncappedPotentialPerSecond[rk]>0,
      `${rk} 产业包在排除仓容截断后的下一秒产能不为正：${JSON.stringify(trace)}`);
  assert.equal(trace.coinGate.ok,false);
  return{loaded,setResult,...trace,...(capturePopulation14Save?{stateSave:saveText}:{})};
}
function until(condition,max=20000){
  const r=run(`(()=>{let n=0,minFood=S.res.food;while(!(${condition})&&n<${max}){
    tick();n++;if(S.res.food<minFood)minFood=S.res.food;
  }return{n,minFood,reached:!!(${condition})}})()`);
  minFood=Math.min(minFood,r.minFood);
  assert.equal(r.reached,true,`第 ${run('S.tick')} 秒未达 ${condition}; ${JSON.stringify(run('({res:S.res,pop:S.population,settlements:S.settlements})'))}`);
}
function action(expression,kind,label){
  const r=run(expression);
  assert.equal(r?.ok,true,`${label}: ${JSON.stringify(r)}`);
  actions[kind]++;
  return r;
}
function assign(target){
  const current=run('({...S.popAlloc})');
  const keys=[...new Set([...Object.keys(current),...Object.keys(target)])];
  for(const rk of keys)if((target[rk]||0)<(current[rk]||0))
    action(`setPopAlloc('${rk}',${target[rk]||0})`,'allocate',`减少 ${rk}`);
  for(const rk of keys)if((target[rk]||0)>(current[rk]||0))
    action(`setPopAlloc('${rk}',${target[rk]||0})`,'allocate',`增加 ${rk}`);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function study(id){
  const cost=run(`activeSciences()['${id}'].cost.tech`);
  assert.ok(run("resCap('tech')")>=cost,`${id} 超出科技仓容`);
  until(`S.res.tech>=${cost}`);
  action(`researchScience('${id}')`,'research',id);
  snapshot(id);
}
function sellForCoin(rk,qty){
  assert.ok(Number.isSafeInteger(qty)&&qty>0);
  const r=action(`exchangeResource('${rk}','coin',${qty})`,'exchange',`出售 ${rk} ${qty}`);
  assert.ok(r.get>0);
}
function buyDeed(count){
  assert.ok(Number.isSafeInteger(count)&&count>0);
  const r=action(`exchangeResource('coin','deed',${count*100})`,'exchange',`购买 ${count} 地契`);
  assert.equal(r.get,count);
}
function fundDeeds(count){
  const target=count*100;
  const rates={wood:0.1,stone:0.14,food:0.08};
  const reserve={wood:100,stone:1000,food:1000};
  // 每次尽量卖够本次扩建缺口；仓库仅 10000，满仓时可多轮出售。
  let attempts=0;
  while(run('S.res.coin')+1e-7<target){
    assert.ok(++attempts<100,'筹币循环次数异常');
    let sold=false;
    for(const rk of ['wood','stone','food']){
      const balance=run(`S.res.${rk}`);
      const available=Math.floor(balance-reserve[rk]);
      if(available<1000)continue;
      const missing=target-run('S.res.coin');
      const qty=Math.min(available,Math.max(1000,Math.ceil((missing+0.01)/rates[rk])));
      sellForCoin(rk,qty);
      sold=true;
      if(run('S.res.coin')+1e-7>=target)break;
    }
    if(!sold){
      const missing=target-run('S.res.coin');
      const threshold=Math.min(run("resCap('wood')"),Math.max(1100,Math.ceil((missing+0.01)/rates.wood)+reserve.wood));
      until(`S.res.wood>=${threshold}`);
    }
  }
  buyDeed(count);
}
function expand(key){
  const cost=run(`settlementCost('${key}')`);
  const shortage=Math.max(0,cost-run('S.res.deed'));
  if(shortage>0)fundDeeds(shortage);
  action(`upgradeSettlement('${key}')`,'settlement',`扩建 ${key}`);
  snapshot(`expand-${key}-${run(`S.settlements.${key}`)}`);
}

snapshot('new-game');
assert.equal(run('S.metalRecipeMode'),'coal');
action("buildAct('academy')",'build','学院');
action("buildAct('farm')",'build','农田');
for(let i=0;i<4;i++)expand('village');
until("popCurrent()===4&&bldSt('academy').lv===1&&bldSt('farm').lv===1",40);
assign({wood:1,stone:1,food:1,tech:1});
until('popCurrent()===8',30);
assign({wood:3,stone:2,food:1,tech:2});
snapshot('eight-working');

for(const id of ['sci_prospect','sci_coal','sci_copper'])study(id);
study('sci_wood_store');
until('S.res.wood>=800');
action("buildAct('warehouse')",'build','木石仓库');
until("bldSt('warehouse').lv===1");
snapshot('wood-stone-store-ready');
until('S.res.wood>=400&&S.res.stone>=400&&S.res.food>=300');
action("buildAct('market')",'build','市场');
until("bldSt('market').lv===1");
snapshot('market-open');
if(researchPriority){
  // Controlled route variant: after the market is ready, temporarily move workers into research; restore the baseline mix after urbanization.
  const stoneWorkers=researchWorkers>=7?0:researchWorkers>=3?1:2;
  const woodWorkers=8-researchWorkers-stoneWorkers-1;
  assign({wood:woodWorkers,stone:stoneWorkers,food:1,tech:researchWorkers});
  snapshot('research-priority-allocation');
}
study('sci_urbanization');
if(researchPriority){
  assign({wood:3,stone:2,food:1,tech:2});
  snapshot('baseline-allocation-restored');
}

// 城镇化一开放，先用已有木石换地契扩到 10；随后边积科技边产可出售的木材。
expand('smallTown');
until('popCurrent()===10',30);
assign({wood:6,stone:1,food:1,tech:2});
snapshot('ten-population');
study('sci_iron');

for(let target=12;target<=18;target+=2){
  expand('smallTown');
  until(`popCurrent()===${target}`,30);
  assign({wood:target-4,stone:1,food:1,tech:2});
  snapshot(`population-${target}`);
  if(target===14){
    const stateSave=run("(()=>{const result=save();if(!result?.ok)throw Error('14人口工作包检查点保存失败');return localStorage.getItem('rts_save')})()");
    const package14={wood:1,stone:3,food:2,tech:1,coal:4,copper:1,iron:1};
    population14IndustryCheck=auditPopulation14Package(stateSave,package14);
  }
}
assert.equal(run('maxPop()'),18);
assert.equal(run('popCurrent()'),18);
assert.equal(run("S.sciences.includes('sci_mint')||S.sciences.includes('sci_coin')"),false);
assert.equal(run('bldSt(\'mint\').lv'),0);
assert.equal(run('S.defeated.length'),0);

// 16/18 岗即可同时生产铜与铁；上游石、煤及粮均有正净流量。
assign({wood:1,stone:4,food:2,tech:1,coal:5,copper:1,iron:2});
assert.equal(run('popAllocTotal()'),16);
const before=JSON.parse(JSON.stringify(run('S.res')));
const next=run('productionSecond(1,true)');
const net={};
for(const rk of ['wood','stone','food','tech','coal','copper','iron']){
  net[rk]=Number((next[rk]-before[rk]).toFixed(4));
  assert.ok(net[rk]>0,`${rk} 无正净产: ${JSON.stringify(net)}`);
}
snapshot('metal-jobs-ready');
until('S.res.copper>=100',101);
snapshot('first-100-copper');
until('S.res.iron>=100',101);
snapshot('first-100-iron');
assert.ok(run('S.res.food>=500'));
assert.equal(run('S.defeated.length'),0);
assert.ok(minFood>0);
const sustainedStart=JSON.parse(JSON.stringify(run('S.res')));
const sustainedEndSecond=run('S.tick')+120;
until(`S.tick>=${sustainedEndSecond}`,120);
const sustainedEnd=JSON.parse(JSON.stringify(run('S.res')));
const sustainedCaps=Object.fromEntries(['coal','copper','iron'].map(rk=>[rk,run(`resCap('${rk}')`)]));
for(const rk of ['coal','copper','iron']){
  assert.ok(sustainedEnd[rk]>=0,`${rk} 在120秒连续生产后为负`);
  if(sustainedStart[rk]<sustainedCaps[rk]-1e-7)
    assert.ok(sustainedEnd[rk]>sustainedStart[rk],
      `${rk} 未满仓却未增长：${JSON.stringify({start:sustainedStart[rk],end:sustainedEnd[rk],cap:sustainedCaps[rk]})}`);
}
// 石材靠近仓容时可在同一库存位平衡；驻军重放还会扣走库存。
assert.ok(sustainedEnd.food>0&&sustainedEnd.stone>0,
  JSON.stringify({sustainedStart,sustainedEnd,stoneCap:run("resCap('stone')")}));
assert.equal(run('S.defeated.length'),0);
snapshot('metal-sustained-120s');

const finalTiming=timing();
const routeMinFood=sessionProfile?Math.min(minFood,run('globalThis.__p101MinFood')):minFood;
const offlineSessions=sessionProfile?JSON.parse(run('JSON.stringify(globalThis.__p101OfflineSessions)')):[];
if(sessionProfile)run('Date.now=globalThis.__p101OriginalDateNow');
const finalStateSave=captureFinalSave
  ?run("(()=>{const result=save();if(!result?.ok)throw Error('人口路线终档保存失败');return localStorage.getItem('rts_save')})()")
  :null;
console.log(JSON.stringify({unit:sessionProfile?'active online and settled offline seconds':'online seconds',
  route:researchPriority?`research-priority-${researchWorkers}-after-market`:'sequential-expansion',sessionProfile,
  activeOnlineSeconds:finalTiming.activeOnlineSeconds,settledOfflineSeconds:finalTiming.offlineSeconds,
  metalSustainabilityWindow:{seconds:120,start:sustainedStart,end:sustainedEnd,caps:sustainedCaps},
  elapsedSimulationSeconds:run('S.tick'),offlineSessions,battleWins:0,actions,minFood:Number(routeMinFood.toFixed(3)),
  population14IndustryCheck,
  ...(finalStateSave?{finalStateSave}:{}),
  noMintScience:true,finalMetalNetPerSecond:net,
  milestones:milestones.map(({label,second,activeOnlineSeconds,offlineSeconds,capacity,population,allocated,free,popAlloc,res,caps,settlements,actions,stateSave})=>({
    label,second,activeOnlineSeconds,offlineSeconds,capacity,population,allocated,free,popAlloc,
    resources:{wood:Number(res.wood.toFixed(2)),stone:Number(res.stone.toFixed(2)),food:Number(res.food.toFixed(2)),
      tech:Number(res.tech.toFixed(2)),coal:res.coal,copper:res.copper,iron:res.iron,coin:Number(res.coin.toFixed(2)),deed:res.deed},
    caps,settlements,actions,...(stateSave?{stateSave}:{})
  }))},null,2));
