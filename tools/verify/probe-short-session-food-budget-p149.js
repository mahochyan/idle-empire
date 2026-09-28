'use strict';
// P149: attribute the first short-session campaign offline food clamp by
// instrumenting (without replacing) P102's real queue and production functions.
// Only an isolated harness save is loaded; the temporary P102 copy is removed.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
const baselinePath=path.join(root,'docs/codex/reports/data/p145-short-session-food-budget.json');
const rawPath=path.join(root,'docs/codex/reports/data/p149-short-session-food-budget.json');

function child(script,args,input){
  return spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:20*1024*1024});
}
function childJson(script,args,input){
  const result=child(script,args,input);
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function replaceExactlyOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P149无法定位${label}插桩点`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P149找到多个${label}插桩点`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

const population=childJson(populationProbe,
  ['--research-priority','--research-workers=4','--session-profile=600:28800','--capture-final-save']);
assert.equal(population.battleWins,0,'人口起点必须是零胜场路线');
assert.equal(population.milestones.find(x=>x.label==='population-18')?.population,18);
assert.equal(typeof population.finalStateSave,'string','缺少真实save()生成的人口终档');

let instrumented=fs.readFileSync(campaignProbe,'utf8');
const wrapperNeedle="    const snapshot=()=>({tick:S.tick,population:popCurrent(),capacity:maxPop(),resources:{food:S.res.food,";
const wrapperSource=[
  '    globalThis.__p149TrackFood=false;',
  '    globalThis.__p149FoodTotals={productionCalls:0,successfulOfflineSteps:0,queueCalls:0,queueTrainingFoodSpent:0,',
  '      theoreticalFarmFood:0,populationFood:0,armyMaintenanceFood:0,foodPhaseNet:0,',
  '      industrialFoodInput:0,productionNetFood:0,firstRejectedStep:null};',
  '    globalThis.__p149FoodPendingQueue=0;',
  '    const __p149OriginalProcessQueue=processQueue;',
  '    processQueue=function(){',
  '      const beforeFood=S.res.food||0;',
  '      const result=__p149OriginalProcessQueue.apply(this,arguments);',
  '      if(globalThis.__p149TrackFood){',
  '        globalThis.__p149FoodTotals.queueCalls++;',
  '        globalThis.__p149FoodPendingQueue=Math.max(0,beforeFood-(S.res.food||0));',
  '      }',
  '      return result;',
  '    };',
  '    const __p149OriginalProductionSecond=productionSecond;',
  '    productionSecond=function(ratio=1,ignoreCaps=false,populationFoodRule="all"){',
  '      if(!globalThis.__p149TrackFood||ignoreCaps)',
  '        return __p149OriginalProductionSecond(ratio,ignoreCaps,populationFoodRule);',
  '      const beforeFood=S.res.food||0;',
  '      const populationCost=popCurrent()*(CFG.popFoodCost??0.1)*ratio;',
  '      const armyCost=totalUpkeep()*ratio;',
  '      const farmFood=prodRate("food")*ratio;',
  '      const foodLimit=Math.max(beforeFood,resCap("food"));',
  '      const afterFoodPhase=Math.min(foodLimit,beforeFood-populationCost-armyCost+farmFood);',
  '      const queueFood=globalThis.__p149FoodPendingQueue||0;',
  '      const next=__p149OriginalProductionSecond(ratio,ignoreCaps,populationFoodRule);',
  '      const trace=globalThis.__p149FoodTotals;',
  '      trace.productionCalls++;',
  '      if(next.food < -1e-9){',
  '        if(!trace.firstRejectedStep)trace.firstRejectedStep={beforeProductionFood:beforeFood,',
  '          queueTrainingFood:queueFood,farmFood,populationFood:populationCost,armyMaintenanceFood:armyCost,',
  '          foodAfterPopulationArmyAndFarm:afterFoodPhase,candidateFoodAfterProduction:next.food};',
  '      }else{',
  '        trace.successfulOfflineSteps++;trace.queueTrainingFoodSpent+=queueFood;',
  '        trace.theoreticalFarmFood+=farmFood;trace.populationFood+=populationCost;',
  '        trace.armyMaintenanceFood+=armyCost;trace.foodPhaseNet+=afterFoodPhase-beforeFood;',
  '        trace.industrialFoodInput+=afterFoodPhase-next.food;trace.productionNetFood+=next.food-beforeFood;',
  '      }',
  '      globalThis.__p149FoodPendingQueue=0;',
  '      return next;',
  '    };',
  wrapperNeedle
].join('\n');
instrumented=replaceExactlyOnce(instrumented,wrapperNeedle,wrapperSource,'离线生产观测');

const stageNeedle="function battle(stage){\n    assert.equal(run('S.defeated.length'),stage-1,";
const stageReplacement="function battle(stage){\n    run(`globalThis.__p149Stage=${stage}`);\n    assert.equal(run('S.defeated.length'),stage-1,";
instrumented=replaceExactlyOnce(instrumented,stageNeedle,stageReplacement,'关卡编号观测');

const trackNeedle='      try{settled=settleOffline()}finally{g.__p102Settling=false;}';
const trackReplacement=[
  '      g.__p149FoodTotals={productionCalls:0,successfulOfflineSteps:0,queueCalls:0,queueTrainingFoodSpent:0,',
  '        theoreticalFarmFood:0,populationFood:0,armyMaintenanceFood:0,foodPhaseNet:0,',
  '        industrialFoodInput:0,productionNetFood:0,firstRejectedStep:null};',
  '      g.__p149FoodPendingQueue=0;g.__p149TrackFood=true;',
  '      try{settled=settleOffline()}finally{g.__p102Settling=false;g.__p149TrackFood=false;}'
].join('\n');
instrumented=replaceExactlyOnce(instrumented,trackNeedle,trackReplacement,'离线窗口计数');

const saveNeedle='      const before=snapshot();';
instrumented=replaceExactlyOnce(instrumented,saveNeedle,
  '      const before=snapshot();const p149StartSave=localStorage.getItem("rts_save");','战后检查点存档');

const settleNeedle=[
  'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec})',
  "        throw Error('短时战役离线结算失败：'+JSON.stringify(settled));"
].join('\n');
const settleReplacement=[
  'if(!settled?.ok||settled.durationSec!==${sessionProfile.offlineSec}){',
  '        const diagnostic={stage:globalThis.__p149Stage??null,reason,settled,before,after:snapshot(),',
  '          startSave:p149StartSave,',
  '          foodTotals:globalThis.__p149FoodTotals,foodAfter:S.res.food,foodCap:resCap("food"),',
  '          workers:{...S.popAlloc},population:popCurrent(),army:{count:armyCount(),upkeep:totalUpkeep()},',
  '          queue:JSON.parse(JSON.stringify(S.queue)),report:S.offline?.pendingReport??null};',
  "        throw Error('P149_DIAGNOSTIC:'+JSON.stringify(diagnostic));",
  '      }'
].join('\n');
instrumented=replaceExactlyOnce(instrumented,settleNeedle,settleReplacement,'粮食截断观测');

const tempPath=path.join(__dirname,`.p149-p102-${process.pid}.js`);
const expectedTempPath=path.resolve(root,'tools/verify',path.basename(tempPath));
assert.equal(path.resolve(tempPath),expectedTempPath,'临时探针必须留在仓库的开发验证目录');
let campaign;
try{
  fs.writeFileSync(tempPath,instrumented,'utf8');
  campaign=child(tempPath,[
    '--input-save-stdin','--session-profile=600:28800',
    `--session-elapsed-active=${population.activeOnlineSeconds}`,
    `--session-elapsed-offline=${population.settledOfflineSeconds}`,
    '--retry-stage6-after-loss','--recovery-wait-seconds=600'
  ],population.finalStateSave);
}finally{
  if(fs.existsSync(tempPath))fs.unlinkSync(tempPath);
}
const diagnosticMatch=String(campaign.stderr||'').match(/P149_DIAGNOSTIC:(\{[^\r\n]+\})/);
assert.ok(diagnosticMatch,`战役没有到达预期截断插桩点；exit=${campaign.status}; ${campaign.stderr||campaign.stdout}`);
assert.equal(campaign.status,1,'诊断插桩应在截断处停止隔离回放');
const diagnostic=JSON.parse(diagnosticMatch[1]);
assert.equal(diagnostic.settled.ok,true,'settleOffline应返回已结算结果');
assert.equal(diagnostic.settled.truncated,true,'目标事件应是食物截断');
assert.ok(diagnostic.settled.durationSec>0&&diagnostic.settled.durationSec<28800);
assert.equal(diagnostic.foodTotals.successfulOfflineSteps,diagnostic.settled.durationSec,
  '逐秒记录数必须覆盖全部成功离线步');
assert.equal(diagnostic.foodTotals.productionCalls,diagnostic.settled.durationSec+1,
  '还必须记录导致截断的首个失败步');
assert.ok(diagnostic.foodTotals.firstRejectedStep,'缺少第一个无法支付的候选秒');
assert.ok(Math.abs(diagnostic.settled.gains.food-diagnostic.foodTotals.productionNetFood+
  diagnostic.foodTotals.queueTrainingFoodSpent)<1e-6,
  '逐秒粮食分项必须与真实结算总粮差额一致');

const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const compareFields=['stage','before','after','foodAfter','foodTotals','workers','population','army','queue','settled'];
for(const field of compareFields)assert.deepEqual(diagnostic[field],baseline.diagnostic[field],
  `四学者路线的${field}应与同档P145顺序扩建路线对照`);

const inputFiles=[
  'config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-short-session-food-budget-p149.js',
  'docs/codex/reports/data/p145-short-session-food-budget.json'
];
const artifact={batch:'P149',unit:'offline seconds; food; people; workers; army upkeep; queue training; industrial food inputs',
  method:'replay the P112 four-scholar research-priority fresh-save route with P102 real battle, queue, save and settleOffline functions; wrap productionSecond/processQueue only to total their actual per-second food deltas; stop at the first truncated offline window and compare its checkpoint/ledger with P145',
  scope:'four-scholar research-priority route; 18-person zero-win entry; 600 active seconds followed by an 8-hour offline request; fixed P102 battle random 0.5; isolated harness only; no browser save',
  sourceHead:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
  inputs:inputFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),
  baselineComparison:{baseline:'P145 sequential expansion',equalFields:compareFields,equal:true},
  populationEntry:{activeOnlineSeconds:population.activeOnlineSeconds,settledOfflineSeconds:population.settledOfflineSeconds,
    population:population.milestones.find(x=>x.label==='population-18').population,
    capacity:population.milestones.find(x=>x.label==='population-18').capacity},
  diagnostic};
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P149',stage:diagnostic.stage,requestedOfflineSeconds:28800,
  actualOfflineSeconds:diagnostic.settled.durationSec,foodBefore:diagnostic.before.resources.food,
  foodAfter:diagnostic.foodAfter,foodGains:diagnostic.settled.gains.food,
  foodTotals:diagnostic.foodTotals,rawData:rawPath},null,2));
