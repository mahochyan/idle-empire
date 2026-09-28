'use strict';
// P232 is an accounting model derived from P229 paid outcomes. It does not
// execute a battle, create a save, or credit copper to a game state.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p229-development-frontier.json');
const outputPath=path.join(root,'docs/codex/reports/data/p232-border-copper-point-model.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceBytes=fs.readFileSync(sourcePath);
const sourceSha=sha(sourceBytes);
assert.equal(sourceSha,'f94911c7841558708b394d1c51427f65c11f7b54aa360100e49f249a263f7904',
  'P229 input changed; review before pricing again');
const p229=JSON.parse(sourceBytes);
assert.equal(p229.batch,'P229');
const rows=p229.rows.filter(x=>x.case==='border-r1').sort((a,b)=>a.flow-b.flow);
assert.equal(rows.length,16);
assert.deepEqual(rows.map(x=>x.flow),Array.from({length:16},(_,i)=>i+1));
assert.ok(rows.every(x=>x.won&&x.recoveryWithWoodSwap?.ready));
assert.ok(rows.every(x=>x.metalRates.copper===3&&x.metalCaps.copper===800));
assert.ok(rows.every(x=>x.foodStart===p229.rows[0].foodStart));
const point={firstWinOnly:true,level:1,activeOnePoint:true,
  baseCopperPerPulse:2,pulseSeconds:60};
const start={copper:57,copperCap:800,copperWorkerRatePerSecond:3,
  copperWorkers:3,food:p229.rows[0].foodStart,foodWorkers:3,
  population:18};
const simple=rows.map(row=>{
  const r=row.recoveryWithWoodSwap;
  const copperPaid=r.paid.copper||0;
  const workerCopperDuringRecovery=3*r.seconds;
  assert.equal(start.copper+workerCopperDuringRecovery-copperPaid,r.resAfter.copper,
    `P229 flow ${row.flow} copper ledger diverged`);
  return {flow:row.flow,won:row.won,lossByType:row.lossByType,
    lossTotal:row.lossTotal,recoverySeconds:r.seconds,
    paid:{wood:r.paid.wood||0,stone:r.paid.stone||0,
      food:r.paid.food||0,copper:copperPaid},
    minFoodAfterPayment:r.minFoodAfterPayment,
    copperEndWithoutPoint:r.resAfter.copper,
    workerCopperDuringRecovery,
    workerCopperSurplusBeforeCap:workerCopperDuringRecovery-copperPaid,
    possiblePointPulsesDuringFirstRecovery:Math.floor(r.seconds/60),
    grossPointCopperDuringFirstRecovery:2*Math.floor(r.seconds/60),
    firstRunWouldStayBelowCopperCap:
      r.resAfter.copper+2*Math.floor(r.seconds/60)<=800};
});
assert.ok(simple.every(x=>x.workerCopperSurplusBeforeCap>0));
assert.ok(simple.every(x=>x.firstRunWouldStayBelowCopperCap));

const summarize=(xs,key)=>{
  const values=xs.map(x=>key(x));
  return {min:Math.min(...values),mean:values.reduce((n,v)=>n+v,0)/values.length,
    max:Math.max(...values)};
};
const budgets=[5,10,30].map(count=>{
  const perFlow=simple.map(row=>{
    const copperPaid=count*row.paid.copper;
    return {flow:row.flow,challengeCount:count,
      casualties:count*row.lossTotal,
      paid:Object.fromEntries(Object.entries(row.paid).map(([k,v])=>[k,count*v])),
      recoverySecondsStressProxy:count*row.recoverySeconds,
      grossPointPaybackOnlineHours:copperPaid/120,
      grossPointPaybackOfflineHoursIfRatio06:copperPaid/72,
      pointCopperWhileRecoveringGrossUpper:
        2*Math.floor(count*row.recoverySeconds/60),
      capCycleWithoutPointModel:Math.ceil((800-57)/row.workerCopperSurplusBeforeCap)};
  });
  return {count,formula:'repeat one frozen P229 flow count times; NOT an actual replay',
    range:{casualties:summarize(perFlow,x=>x.casualties),
      copperPaid:summarize(perFlow,x=>x.paid.copper),
      foodPaid:summarize(perFlow,x=>x.paid.food),
      woodPaid:summarize(perFlow,x=>x.paid.wood),
      recoverySecondsStressProxy:summarize(perFlow,x=>x.recoverySecondsStressProxy),
      grossPointPaybackOnlineHours:summarize(perFlow,x=>x.grossPointPaybackOnlineHours),
      grossPointPaybackOfflineHoursIfRatio06:summarize(perFlow,x=>x.grossPointPaybackOfflineHoursIfRatio06),
      capCycleWithoutPointModel:summarize(perFlow,x=>x.capCycleWithoutPointModel)},
    perFlow};
});

// No copper spend and no warehouse upgrade: this deliberately isolates the
// saturation boundary; actual repeated battles have timed training payments.
let stock=start.copper,credited=0,nominal=0,firstCapSecond=null;
const noSpendPulseTrace=[];
for(let second=1;second<=3600;second++){
  stock=Math.min(start.copperCap,stock+start.copperWorkerRatePerSecond);
  if(second%point.pulseSeconds===0){
    nominal+=point.baseCopperPerPulse;
    const gain=Math.min(point.baseCopperPerPulse,start.copperCap-stock);
    stock+=gain;credited+=gain;
    if(second<=360)noSpendPulseTrace.push({second,nominal:2,credited:gain,stock});
  }
  if(stock===start.copperCap&&firstCapSecond===null)firstCapSecond=second;
}
const noSpend={firstCapSecond,pointCreditedByFirstCap:credited,
  nominalPointCopperByHour:nominal,actualPointCopperByHour:credited,
  pulseTraceFirstSixMinutes:noSpendPulseTrace};
assert.equal(firstCapSecond,245);
assert.equal(credited,8);

const data={batch:'P232',kind:'read-only accounting model, not game execution',
  source:{p229Sha256:sourceSha,p229Head:p229.head,
    frozenConfigSha256:p229.inputs.find(x=>x.file==='config.js').sha256,
    frozenMathSha256:p229.inputs.find(x=>x.file==='math.js').sha256},
  point,start,
  assumptions:[
    'One level granted on first win only; repeating does not level the point.',
    'The copper point stays selected 100% of elapsed online time.',
    'Base output is 2 copper every 60 seconds; no science multiplier, tax or cap loss in gross payback.',
    'Each budget repeats one frozen P229 battle/paid-recovery flow independently; no continuous battle sequence is simulated.',
    'Offline 0.6 figures are conditional on applying the current generic offline ratio to this new feature; no point offline rule exists.'
  ],
  perFlow:simple,
  perBattleSummary:{casualties:summarize(simple,x=>x.lossTotal),
    copperPaid:summarize(simple,x=>x.paid.copper),
    foodPaid:summarize(simple,x=>x.paid.food),
    woodPaid:summarize(simple,x=>x.paid.wood),
    recoverySeconds:summarize(simple,x=>x.recoverySeconds),
    minFoodAfterPayment:summarize(simple,x=>x.minFoodAfterPayment),
    workerCopperSurplusBeforeCap:summarize(simple,x=>x.workerCopperSurplusBeforeCap)},
  budgets,noSpend};
fs.writeFileSync(outputPath,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({batch:data.batch,perBattle:data.perBattleSummary,
  budgets:budgets.map(x=>({count:x.count,copper:x.range.copperPaid,
    onlineHours:x.range.grossPointPaybackOnlineHours,
    recoverySeconds:x.range.recoverySecondsStressProxy})),noSpend}));
