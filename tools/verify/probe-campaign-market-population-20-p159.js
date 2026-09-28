'use strict';
// P159 extends the real no-deed L1-L11 short-session campaign with market-funded housing to 20.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p101Path='tools/verify/probe-population-early-18.js';
const p102Path='tools/verify/probe-population-first-clear-replenish-p102.js';
const p154Path='docs/codex/reports/data/p154-short-session-food-staffing-continuation.json';
const p156Path='tools/verify/probe-short-session-no-deed-campaign-p156.js';
const p157Path='tools/verify/probe-population-18-to-20-p157.js';
const p158Path='tools/verify/probe-population-short-session-18-to-20-p158.js';
const outputPath=path.join(root,'docs/codex/reports/data/p159-campaign-market-population-18-to-20.json');
const profile={activeSec:600,offlineSec:28800};
const reserves={wood:100,stone:1000,food:1000};

function replaceExactlyOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P159无法定位${label}插桩点`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P159发现多个${label}插桩点`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function child(script,args=[],input){
  return spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8',input,
    maxBuffer:64*1024*1024});
}
function hash(file){
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
}
function verifyInputs(data,label){
  for(const input of data.inputs||[])
    assert.equal(hash(input.file),input.sha256,`${label}输入SHA已变化：${input.file}`);
}

const headResult=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(headResult.status,0,`读取HEAD失败：${headResult.stderr||''}`);
const head=headResult.stdout.trim();
const p154=JSON.parse(fs.readFileSync(path.join(root,p154Path),'utf8'));
assert.equal(p154.sourceHead,head,'P154人口／战役入口必须与当前HEAD一致');
verifyInputs(p154,'P154');
const p154Route=p154.routes.find(route=>route.foodSource==='stone');
const p154Branch=p154Route?.branches.find(branch=>branch.rewardMode==='current');
assert.equal(p154Route?.status,'stage-11-captured','P154未提供可复用的顺序扩建L11路线');
assert.ok(p154Branch?.postStage10Continuation?.outcome?.win,'P154顺序扩建L11结果缺失');

// Run an isolated P156 variant that captures its post-L11 local save. The
// canonical P156 probe and artifact stay untouched and are SHA-checked as input.
const tempVariantPath=path.join(__dirname,`.p159-campaign-capture-${process.pid}.js`);
const tempDataPath=path.join(root,'docs/codex/reports/data',`.p159-campaign-capture-${process.pid}.json`);
assert.equal(path.resolve(tempVariantPath),path.resolve(root,'tools/verify',path.basename(tempVariantPath)),
  'P159临时验证脚本必须留在tools/verify目录');
assert.equal(path.resolve(tempDataPath),path.resolve(root,'docs/codex/reports/data',path.basename(tempDataPath)),
  'P159临时战役数据必须留在reports/data目录');
let campaignCapture;
try{
  let source=fs.readFileSync(path.join(root,p156Path),'utf8');
  const outputNeedle="const outputPath=path.join(root,'docs/codex/reports/data/p156-short-session-no-deed-campaign.json');";
  const tempRelative=path.relative(root,tempDataPath).replace(/\\/g,'/');
  source=replaceExactlyOnce(source,outputNeedle,
    `const outputPath=path.join(root,${JSON.stringify(tempRelative)});`,'临时原始数据路径');
  const returnNeedle="    '  return branch;'\n  ].join('\\n');";
  const returnReplacement=[
    "    \"  if(branch.rewardMode==='current'&&branch.postStage10Continuation?.outcome?.win){\",",
    "    \"    const saved=run('save()');if(!saved?.ok)throw Error('P159 L11终档保存失败：'+JSON.stringify(saved));\",",
    "    \"    branch.finalStateSave=run(\\\"localStorage.getItem('rts_save')\\\");\",",
    "    '  }',",
    "    '  return branch;'",
  ].join('\n')+"\n  ].join('\\n');";
  source=replaceExactlyOnce(source,returnNeedle,returnReplacement,'战役后保存序列化状态');
  const branchNeedle='        postStage10Continuation:branch.postStage10Continuation,';
  source=replaceExactlyOnce(source,branchNeedle,
    '        postStage10Continuation:branch.postStage10Continuation,sessionClock:branch.sessionClock,finalStateSave:branch.finalStateSave,',
    '保留P102战役时钟与L11终档');
  const normalizeNeedle='const normalize=branch=>{const {rewardMode,...rest}=branch;return rest;};';
  source=replaceExactlyOnce(source,normalizeNeedle,
    'const normalize=branch=>{const {rewardMode,...rest}=branch;delete rest.finalStateSave;return rest;};',
    '忽略P159专用的终档捕获字段');
  fs.writeFileSync(tempVariantPath,source,'utf8');
  const result=child(tempVariantPath);
  assert.equal(result.status,0,`P156无地契战役捕获失败：${result.stderr||result.stdout}`);
  assert.ok(fs.existsSync(tempDataPath),'P156临时战役原始数据未生成');
  campaignCapture=JSON.parse(fs.readFileSync(tempDataPath,'utf8'));
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.batch,'P156');
}finally{
  if(fs.existsSync(tempVariantPath))fs.unlinkSync(tempVariantPath);
  if(fs.existsSync(tempDataPath))fs.unlinkSync(tempDataPath);
}

assert.equal(campaignCapture.sourceHead,head,'无地契战役回放必须与当前HEAD一致');
const campaignRoute=campaignCapture.routes[0];
assert.equal(campaignRoute?.status,'through-stage-11','零地契战役路线未抵达L11');
const campaign=campaignRoute.branches.find(branch=>branch.rewardMode==='current');
assert.ok(campaign,'缺少当前岗位无地契路线');
assert.equal(campaign.wins,8,'L9首败前胜场应复现P156');
assert.equal(campaign.blockedAt,9,'当前固定流首败点应复现P156');
assert.equal(campaign.defeatRecovery?.retryWon,true,'无地契路线应重试胜L9');
assert.equal(campaign.postRetryContinuation?.outcome?.win,true,'无地契路线应胜L10');
assert.equal(campaign.postStage10Continuation?.outcome?.win,true,'无地契路线应胜L11');
assert.equal(campaign.offlineWindows.length,9,'P156无地契战役应完整经过9个离线窗');
assert.ok(campaign.offlineWindows.every(window=>window.durationSec===profile.offlineSec),
  'P156战役阶段存在不完整离线窗');
assert.ok(campaign.deedBalancesAfterEachBattle.every(row=>row.deed===0),
  'P156无地契战役不应注入地契');
assert.equal(typeof campaign.finalStateSave,'string','缺少真实保存的L11战后存档');
assert.ok(campaign.sessionClock?.activeOnlineSeconds>0,'P102短时战役缺少累计在线时钟');
assert.ok(Array.isArray(campaign.sessionClock?.offlineWindows),'P102短时战役缺少离线窗时钟');

const e=environment({rts_save:campaign.finalStateSave});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok','P159不能重载真实L11战后终档');
function state(){
  return JSON.parse(JSON.stringify(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    allocated:popAllocTotal(),free:popFree(),growthClock:S.population.growthClock,
    workers:{...S.popAlloc},resources:{...S.res},settlements:{...S.settlements},
    battleWins:S.defeated.length,queue:{...S.queue}})`)));
}
const start=state();
assert.equal(start.population,18,'L11战后人口应为18');
assert.equal(start.capacity,18,'无地契L11战后住房容量应为18');
assert.equal(start.resources.deed,0,'无地契战后终档不应有地契');
assert.equal(start.battleWins,11,'L11战后应记录11个普通关胜利（含L9重试）');

const originalDateNow=Date.now;
let virtualNow=Math.max(originalDateNow(),Number(run('_loadedTs'))||0);
Date.now=()=>virtualNow;
run(`(()=>{const g=globalThis;g.__p159MinFoodCandidate=Number(S.res.food)||0;
  const original=productionSecond;
  productionSecond=function(...args){const next=original(...args);
    if(Number.isFinite(next.food))g.__p159MinFoodCandidate=Math.min(g.__p159MinFoodCandidate,next.food);
    return next;};})()`);
let activeSeconds=0;
let nextPause=profile.activeSec-(campaign.sessionClock.activeOnlineSeconds%profile.activeSec);
if(nextPause===0)nextPause=profile.activeSec;
let minObservedFood=run('S.res.food');
const offlineSessions=[];
const expansionSteps=[];
function observeFood(){
  minObservedFood=Math.min(minObservedFood,run('S.res.food'),run('globalThis.__p159MinFoodCandidate'));
}
function tickOne(){
  run('tick()');
  activeSeconds++;
  virtualNow+=1000;
  observeFood();
  if(activeSeconds>=nextPause){
    const saved=run('save()');
    assert.equal(saved?.ok,true,`P159短会话保存失败：${JSON.stringify(saved)}`);
    const savedTs=Number(run('_loadedTs'));
    assert.ok(Number.isFinite(savedTs),'P159离线边界缺少有效存档时间');
    const before=state();
    virtualNow=savedTs+profile.offlineSec*1000;
    const settled=run('settleOffline()');
    assert.equal(settled?.ok,true,`P159离线结算调用失败：${JSON.stringify(settled)}`);
    const after=state();
    assert.equal(after.population,before.population,'P159离线改变了实际人口');
    assert.equal(after.capacity,before.capacity,'P159离线改变了住房容量');
    assert.equal(after.growthClock,before.growthClock,'P159离线推进了自然出生时钟');
    observeFood();
    offlineSessions.push({activeAt:campaign.sessionClock.activeOnlineSeconds+activeSeconds,
      requestedSeconds:profile.offlineSec,actualSeconds:settled.durationSec,
      truncated:!!settled.truncated,before,after});
    nextPause+=profile.activeSec;
  }
}
function sellSurplus(key,tradeLog,segment){
  const amount=Math.floor(run(`S.res.${key}`)-reserves[key]);
  if(amount<1000)return false;
  const coinBefore=run('S.res.coin');
  const sale=run(`exchangeResource('${key}','coin',${amount})`);
  if(!sale?.ok)throw Error(`${segment}出售${key}失败：${JSON.stringify(sale)}`);
  observeFood();
  tradeLog.push({from:key,amount,coinBefore,coinAfter:run('S.res.coin'),coinReceived:sale.get,
    resourcesAfter:{wood:run('S.res.wood'),stone:run('S.res.stone'),food:run('S.res.food')}});
  return true;
}
function expandAndBirth(target,segment){
  const segmentStart=state();
  const activeStart=activeSeconds;
  const offlineStart=offlineSessions.length;
  const quote=run("settlementBatchPreview('village',1)");
  assert.equal(quote.ok,false,`${segment}必须由真实地契不足报价开始`);
  const deedCost=quote.cost;
  const rate=run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
  assert.ok(Number.isFinite(rate)&&rate>0,'缺少有效的早期金币购地契汇率');
  const coinTarget=Math.ceil(deedCost/rate);
  assert.equal(coinTarget,deedCost*100,'地契价格须重现当前100金币/张汇率');
  const sales=[];
  let guard=0;
  while(run('S.res.coin')+1e-7<coinTarget){
    assert.ok(++guard<100,`${segment}筹币动作循环异常`);
    let sold=false;
    for(const key of ['wood','stone','food'])if(sellSurplus(key,sales,segment))sold=true;
    if(run('S.res.coin')+1e-7>=coinTarget)break;
    if(sold)continue;
    const possible=['wood','stone','food'].filter(key=>
      reserves[key]+1000<=run(`resCap('${key}')`));
    if(possible.length===0)return{status:'blocked-storage',segment,segmentStart,deedCost,coinTarget,sales,
      activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
    let waited=0;
    while(!possible.some(key=>run(`S.res.${key}>=${reserves[key]+1000}`))){
      if(waited++>=20000)return{status:'blocked-production',segment,segmentStart,deedCost,coinTarget,sales,
        activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})'),possible};
      tickOne();
    }
  }
  const bought=run(`exchangeResource('coin','deed',${coinTarget})`);
  assert.equal(bought?.ok,true,`${segment}真实市场购契失败：${JSON.stringify(bought)}`);
  assert.equal(bought.get,deedCost,`${segment}购入地契数错误`);
  const beforeExpansion=state();
  const expansion=run("upgradeSettlement('village')");
  assert.equal(expansion?.ok,true,`${segment}真实村庄升级失败：${JSON.stringify(expansion)}`);
  assert.equal(run('maxPop()'),target,`${segment}住房容量未达目标`);
  const beforeBirthTick=run('S.tick');
  let birthSeconds=0;
  while(run('popCurrent()')<target){
    if(birthSeconds>=20)return{status:'blocked-birth',segment,segmentStart,deedCost,coinTarget,sales,
      activeSeconds:activeSeconds-activeStart,resources:run('({...S.res})')};
    tickOne();birthSeconds++;
  }
  const woodWorkers=run('S.popAlloc.wood||0')+1;
  const assigned=run(`setPopAlloc('wood',${woodWorkers})`);
  assert.equal(assigned?.ok,true,`${segment}新增村民真实岗位分配失败：${JSON.stringify(assigned)}`);
  const end=state();
  assert.equal(end.population,target);
  assert.equal(end.capacity,target);
  assert.equal(end.battleWins,start.battleWins,'P159扩容阶段发生了额外战斗胜场');
  const saved=run('save()');
  assert.equal(saved?.ok,true,`${segment}隔离存档写入失败`);
  const savedText=run("localStorage.getItem('rts_save')");
  const reloaded=environment({rts_save:savedText});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok',`${segment}隔离存档重载失败`);
  const reloadedState=JSON.parse(JSON.stringify(reloaded.run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    allocated:popAllocTotal(),free:popFree(),growthClock:S.population.growthClock,workers:{...S.popAlloc},
    resources:{...S.res},settlements:{...S.settlements},battleWins:S.defeated.length,queue:{...S.queue}})`)));
  assert.deepEqual(reloadedState,end,`${segment}保存重载状态不一致`);
  const result={status:'complete',segment,segmentStart,deedCost,coinTarget,sales,
    deedTrade:{coinSpent:coinTarget,deedsReceived:bought.get},expansion,
    activeSeconds:activeSeconds-activeStart,offlineWindows:offlineSessions.length-offlineStart,
    offlineSeconds:offlineSessions.slice(offlineStart).reduce((sum,window)=>sum+window.actualSeconds,0),
    elapsedSimulationSeconds:end.tick-segmentStart.tick,birthSeconds,beforeBirthTick,
    beforeExpansion,afterBirth:end,woodRate:run("prodRate('wood')"),resourcesAfter:end.resources};
  expansionSteps.push(result);
  return result;
}

let finalStatus='population-20-reached';
try{
  for(const [target,label] of [[19,'18-to-19'],[20,'19-to-20']]){
    const result=expandAndBirth(target,label);
    if(result.status!=='complete'){finalStatus=result.status;expansionSteps.push(result);break;}
  }
}finally{
  Date.now=originalDateNow;
}
const final=state();
const finalStateSave=run("localStorage.getItem('rts_save')");
assert.equal(typeof finalStateSave,'string','P159未保留真实20人口隔离终档');
const serializedFinal=JSON.parse(finalStateSave);
assert.equal(serializedFinal.res?.deed,0,'P159隔离终档地契余额应为0');
assert.equal(serializedFinal.population?.current,20,'P159隔离终档人口应为20');
assert.equal(final.population,20,'P159终点必须为20人口');
const foodReserveMaintained=minObservedFood>=reserves.food-1e-9;
assert.equal(finalStatus,'population-20-reached','无地契短会话战役路线必须续接至20人口');
assert.equal(final.capacity,20,'P159终点住房容量必须为20');
assert.equal(foodReserveMaintained,true,'P159扩容续接期间粮食不得跌破1000保留线');
assert.ok(offlineSessions.every(window=>window.actualSeconds===profile.offlineSec&&!window.truncated),
  'P159扩容期间所有离线窗必须完整结算');
assert.equal(final.battleWins,start.battleWins,'P159住房续接不得增加战役胜场');
if(finalStatus==='population-20-reached'&&!foodReserveMaintained)
  finalStatus='population-20-reached-food-reserve-breached';
const campaignElapsed={activeOnlineSeconds:campaign.sessionClock.activeOnlineSeconds,
  offlineWindows:Math.floor(p154.populationEntry.settledOfflineSeconds/profile.offlineSec)+
    campaign.sessionClock.offlineWindows.length,
  offlineSeconds:campaign.sessionClock.settledOfflineSeconds};
const totalElapsed={activeOnlineSeconds:campaignElapsed.activeOnlineSeconds+activeSeconds,
  offlineWindows:campaignElapsed.offlineWindows+offlineSessions.length,
  offlineSeconds:campaignElapsed.offlineSeconds+offlineSessions.reduce((sum,window)=>sum+window.actualSeconds,0)};

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  p101Path,p102Path,p154Path,p156Path,p157Path,p158Path,
  'tools/verify/probe-campaign-market-population-20-p159.js',
  'docs/codex/reports/data/p157-zero-win-population-18-to-20.json',
  'docs/codex/reports/data/p158-short-session-population-18-to-20.json'
];
const artifact={batch:'P159',unit:'active online seconds; settled offline seconds; battles won; residents; housing capacity; deeds; resources',
  method:'from the P101 sequential-expansion short-session fresh save, replay P156 actual no-deed L1-L11 campaign, capture the isolated serialized post-L11 save, then continue 600-active-second/28800-offline-second cadence through real market sales, deed purchases, village upgrades, natural births, saves, and isolated reloads',
  scope:'single sequential-expansion route; fixed P156 battle stream; no deed reward injection or resource injection; no direct game-state edits; ordinary current resource rewards and real game functions; test state only, never player rts_save',
  sourceHead:head,sessionProfile:profile,reservePolicy:reserves,
  populationEntry:p154.populationEntry,
  campaign:{status:campaignRoute.status,firstLoss:campaign.blockedAt,winsBeforeFirstLoss:campaign.wins,
    retryWon:campaign.defeatRecovery?.retryWon,
    stage10Won:campaign.postRetryContinuation?.outcome?.win,
    stage11Won:campaign.postStage10Continuation?.outcome?.win,
    deedBalancesAfterEachBattle:campaign.deedBalancesAfterEachBattle,
    start:{activeOnlineSeconds:p154.populationEntry.activeOnlineSeconds,
      settledOfflineSeconds:p154.populationEntry.settledOfflineSeconds,population:18,capacity:18},
    terminal:campaignElapsed,postCampaignState:start},
  expansion:{status:finalStatus,foodReserveMaintained,steps:expansionSteps,offlineSessions,minObservedFood,
    finalState:final,finalStateSave,totalElapsed},
  comparison:{p157ContinuousOnlineTotalSeconds:[8049,7769,7818],
    p158ShortSessionTotalsSeconds:[5697,5697,6345],
    note:'P159 includes the no-deed L1-L11 military campaign and starts the second market-funded housing segment after L11; do not compare its active seconds as if the battle work were absent.'},
  campaignCaptureInputs:campaignCapture.inputs,
  inputs:inputFiles.map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P159',status:finalStatus,campaign:campaignElapsed,
  expansionSteps:expansionSteps.map(step=>({status:step.status,segment:step.segment,
    activeSeconds:step.activeSeconds,offlineWindows:step.offlineWindows,offlineSeconds:step.offlineSeconds,
    deedCost:step.deedCost,coinTarget:step.coinTarget,birthSeconds:step.birthSeconds})),
  totalElapsed,final:{population:final.population,capacity:final.capacity,battleWins:final.battleWins,
    food:final.resources.food,wood:final.resources.wood,stone:final.resources.stone,deed:final.resources.deed},
  minObservedFood,rawData:outputPath},null,2));
