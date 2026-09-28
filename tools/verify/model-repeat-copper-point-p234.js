'use strict';
// P234: read-only sensitivity model. A win is assumed to add one collection
// level for comparison; this behavior is not asserted as a verified mother rule.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p229-development-frontier.json');
const outputPath=path.join(root,'docs/codex/reports/data/p234-repeat-copper-point-model.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const input=fs.readFileSync(sourcePath);
assert.equal(sha(input),'f94911c7841558708b394d1c51427f65c11f7b54aa360100e49f249a263f7904');
const p229=JSON.parse(input);
assert.equal(p229.batch,'P229');
const rows=p229.rows.filter(x=>x.case==='border-r1').sort((a,b)=>a.flow-b.flow);
assert.deepEqual(rows.map(x=>x.flow),Array.from({length:16},(_,i)=>i+1));
assert.ok(rows.every(x=>x.won&&x.recoveryWithWoodSwap?.ready));
const cap=800,startCopper=57,workerRate=3,pulseSeconds=60,baseCopperPerLevel=2;

function repeat(row,count){
  const recoverySeconds=row.recoveryWithWoodSwap.seconds;
  const copperCost=row.recoveryWithWoodSwap.paid.copper||0;
  let copperBill=0,grossPoint=0,clock=0,elapsed=0;
  const cycles=[];
  for(let level=1;level<=count;level++){
    copperBill+=copperCost;
    const before=grossPoint;
    for(let s=0;s<recoverySeconds;s++){
      elapsed++;clock++;
      if(clock===pulseSeconds){grossPoint+=baseCopperPerLevel*level;clock=0}
    }
    cycles.push({win:level,level,copperBill,
      grossPointFromThisRecovery:grossPoint-before,
      grossPointCumulative:grossPoint,
      balanceBeforeWorkerAndCap:grossPoint-copperBill});
  }
  const grossAtN=grossPoint;
  let extraSeconds=0;
  while(grossPoint<copperBill){
    extraSeconds++;clock++;
    if(clock===pulseSeconds){grossPoint+=baseCopperPerLevel*count;clock=0}
    assert.ok(extraSeconds<1e7,'payback guard');
  }
  const workerCopperDuringRecovery=workerRate*elapsed;
  return {flow:row.flow,count,finalPointLevel:count,
    costPerWinCopper:copperCost,copperBill,
    lossPerWin:row.lossTotal,cumulativeLossProxy:count*row.lossTotal,
    paidFoodProxy:count*(row.recoveryWithWoodSwap.paid.food||0),
    paidWoodProxy:count*(row.recoveryWithWoodSwap.paid.wood||0),
    recoverySecondsPerWin:recoverySeconds,
    cumulativeRecoverySecondsProxy:elapsed,
    grossPointCopperDuringRecovery:grossAtN,
    pointMinusCopperBillAtN:grossAtN-copperBill,
    extraNoCapSecondsAtFinalLevelToOffsetCopper:extraSeconds,
    totalNoCapSecondsThroughOffset:elapsed+extraSeconds,
    workerCopperDuringRecovery,
    hypotheticalCopperWithoutCap:startCopper+workerCopperDuringRecovery-copperBill+grossAtN,
    minimumCombinedProductionOverflowIfCapped:
      Math.max(0,startCopper+workerCopperDuringRecovery-copperBill+grossAtN-cap),
    cycles};
}
const stat=(xs,project)=>{const values=xs.map(project);return{
  min:Math.min(...values),mean:values.reduce((a,b)=>a+b,0)/values.length,
  max:Math.max(...values)};};
const budgets=[5,10,30].map(count=>{
  const perFlow=rows.map(row=>repeat(row,count));
  return {count,perFlow,summary:{
    finalPointCopperPerMinute:2*count,
    pointToThreeCopperWorkersRateRatio:(2*count/60)/3,
    copperBill:stat(perFlow,x=>x.copperBill),
    cumulativeLossProxy:stat(perFlow,x=>x.cumulativeLossProxy),
    paidFoodProxy:stat(perFlow,x=>x.paidFoodProxy),
    cumulativeRecoverySecondsProxy:stat(perFlow,x=>x.cumulativeRecoverySecondsProxy),
    grossPointCopperDuringRecovery:stat(perFlow,x=>x.grossPointCopperDuringRecovery),
    pointMinusCopperBillAtN:stat(perFlow,x=>x.pointMinusCopperBillAtN),
    extraNoCapHoursAtFinalLevelToOffsetCopper:
      stat(perFlow,x=>x.extraNoCapSecondsAtFinalLevelToOffsetCopper/3600),
    hypotheticalCopperWithoutCap:stat(perFlow,x=>x.hypotheticalCopperWithoutCap),
    minimumCombinedProductionOverflowIfCapped:
      stat(perFlow,x=>x.minimumCombinedProductionOverflowIfCapped)}
  };
});

function noSpendHour(level,initialCopper=startCopper){
  let copper=initialCopper,nominalPoint=0,creditedPoint=0,firstCapSecond=null;
  const pulses=[];
  for(let second=1;second<=3600;second++){
    copper=Math.min(cap,copper+workerRate);
    if(second%pulseSeconds===0){
      const nominal=baseCopperPerLevel*level;
      const credited=Math.min(nominal,cap-copper);
      nominalPoint+=nominal;creditedPoint+=credited;copper+=credited;
      if(second<=360)pulses.push({second,nominal,credited,copper});
    }
    if(copper===cap&&firstCapSecond===null)firstCapSecond=second;
  }
  return {level,initialCopper,firstCapSecond,
    nominalPointFirstHour:nominalPoint,creditedPointFirstHour:creditedPoint,
    pulsesFirstSixMinutes:pulses};
}
const capCounterexamples=[1,5,10,30].map(level=>noSpendHour(level));
const fullCapAfterRepeats=[5,10,30].map(level=>noSpendHour(level,cap));
const data={batch:'P234',kind:'read-only upper-bound sensitivity model',
  source:{p229Sha256:sha(input),head:p229.head,
    frozenMathSha256:p229.inputs.find(x=>x.file==='math.js').sha256},
  hypothesis:{pointLevelsPerWin:1,firstClearOnly:false,
    sourceCaveat:'winMiddleWar traverses Get on every win; actual point level caps/probabilities are not verified',
    activeOneCopperPoint:true,baseCopperPerLevelPerPulse:2,
    pulseSeconds:60,pointClockPersistsBetweenWins:true,
    pointClockStartsAtZero:true,noBattleTimeOrDangerGrowth:true,
    sameFirstBattleLossAndPaidRecoveryRepeated:true,
    pointPulsesDuringRecoveryAllReceivedInGrossModel:true},
  start:{copper:startCopper,cap,workerRate,copperWorkers:3,
    food:p229.rows[0].foodStart},
  budgets,capCounterexamples,fullCapAfterRepeats};
fs.writeFileSync(outputPath,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({batch:data.batch,
  budgets:budgets.map(x=>({count:x.count,...x.summary})),
  capCounterexamples:capCounterexamples.map(x=>({level:x.level,firstCapSecond:x.firstCapSecond,
    nominal:x.nominalPointFirstHour,actual:x.creditedPointFirstHour}))}));
