'use strict';
// Candidate model only: first-clear deed rewards are not live game behavior.
// It combines the proposed chapter curve with the real CFG.enemies layout and
// settlementCostAt() from math.js. It reports a village-only baseline and an
// all-settlement-tier upper bound funded by starting deeds plus chapter rewards.
// The upper bound assumes every settlement tier is unlocked by each checkpoint.
// It does not simulate battles, food, market income, research, or population birth time.
const assert = require('node:assert/strict');
const {environment} = require('../../tests/progression/harness');

const candidate = {stagesPerChapter:10, deedsPerChapter:1, bossBonus:5};
const e = environment();
const rows = JSON.parse(JSON.stringify(e.run(`(()=>{
  const cfg=${JSON.stringify(candidate)};
  const reward=enemy=>{
    if(!Number.isSafeInteger(enemy?.id)||enemy.id<1)return 0;
    const chapter=Math.ceil(enemy.id/cfg.stagesPerChapter);
    return chapter*cfg.deedsPerChapter+(enemy.boss?cfg.bossBonus:0);
  };
  let cumulative=0;
  const startingDeeds=S.res.deed;
  const startingCapacity=maxPop();
  let stageRewardTotal=0,stageVillageSpent=0,stageVillageLevels=0;
  while(startingDeeds-stageVillageSpent>=settlementCostAt('village',stageVillageLevels)){
    stageVillageSpent+=settlementCostAt('village',stageVillageLevels);
    stageVillageLevels++;
  }
  const stageExpansionMilestones=[],bossSnapshots=[];
  for(const enemy of CFG.enemies){
    const stageReward=reward(enemy);
    const beforeBalance=startingDeeds+stageRewardTotal-stageVillageSpent;
    const beforeCapacity=startingCapacity+stageVillageLevels;
    const nextVillageCost=settlementCostAt('village',stageVillageLevels);
    const canExpandBefore=beforeBalance>=nextVillageCost;
    stageRewardTotal+=stageReward;
    let addedLevels=0;
    while(startingDeeds+stageRewardTotal-stageVillageSpent>=
      settlementCostAt('village',stageVillageLevels)){
      stageVillageSpent+=settlementCostAt('village',stageVillageLevels);
      stageVillageLevels++;
      addedLevels++;
    }
    if(addedLevels)stageExpansionMilestones.push({stage:enemy.id,reward:stageReward,
      cumulativeReward:stageRewardTotal,addedLevels,villageLevel:stageVillageLevels,
      capacity:startingCapacity+stageVillageLevels,deedsLeft:startingDeeds+stageRewardTotal-stageVillageSpent});
    if(enemy.boss){
      const afterBalance=startingDeeds+stageRewardTotal-stageVillageSpent;
      bossSnapshots.push({stage:enemy.id,reward:stageReward,beforeCapacity,
        beforeDeeds:beforeBalance,nextVillageCost,canExpandBefore,
        afterCapacity:startingCapacity+stageVillageLevels,afterDeeds:afterBalance,
        capacityAddedByReward:startingCapacity+stageVillageLevels-beforeCapacity,
        rewardCrossesNextCapacity:!canExpandBefore&&addedLevels>0});
    }
  }
  const result=[];
  for(let chapter=1;chapter<=10;chapter++){
    const stages=CFG.enemies.filter(enemy=>Math.ceil(enemy.id/cfg.stagesPerChapter)===chapter);
    const chapterReward=stages.reduce((sum,enemy)=>sum+reward(enemy),0);
    cumulative+=chapterReward;
    const available=startingDeeds+cumulative;
    let villageLevels=0,spent=0;
    while(available-spent>=settlementCostAt('village',villageLevels)){
      spent+=settlementCostAt('village',villageLevels);
      villageLevels++;
    }
    const keys=Object.keys(CFG.settlements);
    const costs={};
    for(const key of keys){
      costs[key]=[0];
      for(let i=0;i<available;i++){
        const each=settlementCostAt(key,S.settlements[key]+i);
        if(each==null||costs[key][i]+each>available)break;
        costs[key].push(costs[key][i]+each);
      }
    }
    let upper={gain:-1,cost:0,levels:{}};
    for(let village=0;village<costs.village.length&&costs.village[village]<=available;village++)
      for(let smallTown=0;smallTown<costs.smallTown.length&&costs.smallTown[smallTown]<=available;smallTown++)
        for(let city=0;city<costs.city.length&&costs.city[city]<=available;city++){
          const cost=costs.village[village]+costs.smallTown[smallTown]+costs.city[city];
          if(cost>available)continue;
          const gain=village*CFG.settlements.village.popPerLv+
            smallTown*CFG.settlements.smallTown.popPerLv+city*CFG.settlements.city.popPerLv;
          if(gain>upper.gain||(gain===upper.gain&&available-cost>available-upper.cost))
            upper={gain,cost,levels:{village,smallTown,city}};
        }
    result.push({chapter,stageCount:stages.length,bossIds:stages.filter(enemy=>enemy.boss).map(enemy=>enemy.id),
      chapterReward,cumulativeReward:cumulative,availableDeeds:available,villageLevels,
      capacity:startingCapacity+villageLevels,villageOnlySpent:spent,deedsLeft:available-spent,
      allTypesUnlockedUpperCapacity:startingCapacity+upper.gain,upperPlan:upper.levels,
      upperSpent:upper.cost,upperDeedsLeft:available-upper.cost});
  }
  return {stageCount:CFG.enemies.length,startingDeeds,startingCapacity,
    rewardAt:{1:reward(CFG.enemies[0]),10:reward(CFG.enemies[9]),11:reward(CFG.enemies[10]),100:reward(CFG.enemies[99])},
    stageExpansionMilestones,bossSnapshots,rows:result};
})()`)));
// Budget sensitivity only: move an additional six first-clear deeds into stage 3.
// Real expansion/birth/worker allocation is exercised by probe-population-first-clear-feedback.js.
const earlyMilestone = JSON.parse(JSON.stringify(e.run(`(()=>{
  let villageLevel=0,villageSpent=0,rewardTotal=0;
  const startingDeeds=S.res.deed,startingCapacity=maxPop(),milestones=[];
  while(startingDeeds-villageSpent>=settlementCostAt('village',villageLevel)){
    villageSpent+=settlementCostAt('village',villageLevel++);
  }
  for(const enemy of CFG.enemies){
    const reward=Math.ceil(enemy.id/10)+(enemy.boss?5:0)+(enemy.id===3?6:0);
    rewardTotal+=reward;
    const beforeLevel=villageLevel;
    while(startingDeeds+rewardTotal-villageSpent>=settlementCostAt('village',villageLevel)){
      villageSpent+=settlementCostAt('village',villageLevel++);
    }
    if(villageLevel>beforeLevel)milestones.push({stage:enemy.id,capacity:startingCapacity+villageLevel,
      deedsLeft:startingDeeds+rewardTotal-villageSpent});
  }
  return{bonusStage:3,bonusDeeds:6,totalReward:rewardTotal,firstMilestones:milestones.slice(0,3),
    capacityAtStage100:startingCapacity+villageLevel,deedsLeft:startingDeeds+rewardTotal-villageSpent};
})()`)));

assert.equal(rows.stageCount,100);
assert.equal(rows.startingDeeds,30);
assert.equal(rows.startingCapacity,4);
assert.deepEqual(rows.rewardAt,{1:1,10:6,11:2,100:15});
assert.deepEqual(rows.rows.map(row=>row.stageCount),Array(10).fill(10));
assert.deepEqual(rows.rows.map(row=>row.bossIds),Array.from({length:10},(_,index)=>[(index+1)*10]));
assert.deepEqual(rows.rows.map(row=>row.chapterReward),[15,25,35,45,55,65,75,85,95,105]);
assert.equal(rows.rows.at(-1).cumulativeReward,600);
assert.deepEqual(rows.rows.map(row=>row.capacity),[10,12,14,17,20,23,26,29,32,35]);
assert.deepEqual(rows.rows.map(row=>row.allTypesUnlockedUpperCapacity),[10,13,17,21,26,31,37,43,49,55]);
assert.deepEqual(rows.rows.map(row=>row.upperSpent),[41,68,104,146,200,260,339,425,518,617]);
assert.equal(rows.stageExpansionMilestones[0].stage,5);
assert.equal(rows.stageExpansionMilestones[0].capacity,9);
assert.equal(rows.stageExpansionMilestones[1].stage,10);
assert.equal(rows.stageExpansionMilestones[1].capacity,10);
assert.ok(rows.stageExpansionMilestones.some(row=>row.stage===50&&row.capacity===20));
assert.ok(rows.stageExpansionMilestones.some(row=>row.stage===100&&row.capacity===35));
assert.equal(rows.stageExpansionMilestones.at(-1).capacity,35);
assert.equal(rows.bossSnapshots.length,10);
assert.deepEqual(rows.bossSnapshots.slice(0,2).map(row=>[row.stage,row.beforeCapacity,row.afterCapacity,row.rewardCrossesNextCapacity]),
  [[10,9,10,true],[20,11,12,true]]);
assert.deepEqual(rows.bossSnapshots.map(row=>row.rewardCrossesNextCapacity),
  [true,true,false,true,true,true,true,true,true,true]);
assert.deepEqual(rows.bossSnapshots.filter(row=>row.stage===30).map(row=>[
  row.beforeDeeds,row.nextVillageCost,row.reward,row.afterDeeds,row.capacityAddedByReward
]),[[2,15,8,10,0]]);
assert.equal(earlyMilestone.totalReward,606);
assert.deepEqual(earlyMilestone.firstMilestones.slice(0,2).map(row=>[row.stage,row.capacity]),[[3,9],[9,10]]);
assert.equal(earlyMilestone.capacityAtStage100,35,'前置6张提高早期反馈但不抬高本模型末关村庄容量');
console.log(JSON.stringify({candidate,rows:rows.rows,totalFirstClearDeeds:rows.rows.at(-1).cumulativeReward,
  earlyMilestoneSensitivity:earlyMilestone,
  stageExpansionMilestones:rows.stageExpansionMilestones,bossSnapshots:rows.bossSnapshots,
  limits:'No battle, food, market, birth-time simulation; upper bound assumes village, small-town, and city tiers are all unlocked by each checkpoint.'},null,2));
