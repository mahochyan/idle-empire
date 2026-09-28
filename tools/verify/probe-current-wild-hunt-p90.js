'use strict';
// P90: 当前工作区在同一P81已付款开发档上，各自重放六条郊野猎场的12个固定种子。
// 各种子独立重载；不把不同种子的战损、奖励或警戒值串成一条玩家路线。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const input=path.resolve(__dirname,'../../docs/codex/reports/data/p81-stock-scroll-paid.json');
const raw=fs.readFileSync(input,'utf8');
const keys=['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'];
const attempts=Array.from({length:12},(_,i)=>i+1);

function formCounts(form){
  const counts={};
  for(const row of ['front','mid','back'])for(const unit of form[row]||[])
    counts[unit.type]=(counts[unit.type]||0)+unit.count;
  return counts;
}

function runTrial(key,seed){
  const {run}=environment({rts_save:raw});
  const loaded=run('loadSaveAndApply().status');
  assert.ok(['ok','migrated'].includes(loaded),`P81开发快照无法读取：${loaded}`);
  const cfg=run(`specialEncounterConfig('${key}')`);
  assert.ok(cfg?.wildHunt,`${key} 不是郊野猎场配置`);
  const before=run(`(()=>({
    kill:S.killValues['${cfg.killValueKey}']||0,
    army:armyCount(),
    formation:JSON.parse(JSON.stringify(S.formation)),
    bone:S.res.bone,
    medal:S.res.medal,
    item:S.items['${cfg.dropItem}']||0
  }))()`);

  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const next=__timers.entries().next().value;
      if(!next)return false;__timers.delete(next[0]);next[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=message=>S.log.push(String(message));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};
    openMaterialDomain('${key}')`);
  assert.equal(run('S.battleActive'),true,`${key} 未开始`);

  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__step()'),true,`${key} 战斗回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`${key} 超过1000个战斗回调`);

  const after=run(`(()=>({
    kill:S.killValues['${cfg.killValueKey}']||0,
    army:armyCount(),
    formation:JSON.parse(JSON.stringify(S.formation)),
    bone:S.res.bone,
    medal:S.res.medal,
    item:S.items['${cfg.dropItem}']||0,
    round:B.round
  }))()`);
  const initial=formCounts(before.formation),survivors=formCounts(after.formation),lossByUnit={};
  for(const [unit,count] of Object.entries(initial)){
    const loss=count-(survivors[unit]||0);
    if(loss>0)lossByUnit[unit]=loss;
  }
  const deployedLoss=Object.values(lossByUnit).reduce((sum,count)=>sum+count,0);
  assert.equal(before.army-after.army,deployedLoss,
    `${key} #${seed}: 编队战损与兵力池变化不一致`);

  const replacementCost={};
  for(const [unit,count] of Object.entries(lossByUnit)){
    const unitCost=run(`CFG.units['${unit}'].cost||{}`);
    for(const [resource,amount] of Object.entries(unitCost))
      replacementCost[resource]=(replacementCost[resource]||0)+amount*count;
  }
  return{
    seed,
    win:after.kill>before.kill,
    round:after.round,
    deployedLoss,
    lossByUnit,
    boneGain:after.bone-before.bone,
    medalGain:after.medal-before.medal,
    itemGain:after.item-before.item,
    replacementCost
  };
}

const result=[];
for(const key of keys){
  const fixture=environment({rts_save:raw});
  assert.ok(['ok','migrated'].includes(fixture.run('loadSaveAndApply().status')));
  const config=fixture.run(`specialEncounterConfig('${key}')`);
  const initial=fixture.run(`({kill:S.killValues['${config.killValueKey}']||0,
    bone:S.res.bone,army:armyCount()})`);
  const trials=attempts.map(seed=>runTrial(key,seed));
  const wins=trials.filter(trial=>trial.win);
  const totals={deployedLoss:0,boneGain:0,medalGain:0,itemGain:0,replacementCost:{}};
  for(const trial of trials){
    totals.deployedLoss+=trial.deployedLoss;
    totals.boneGain+=trial.boneGain;
    totals.medalGain+=trial.medalGain;
    totals.itemGain+=trial.itemGain;
    for(const [resource,amount] of Object.entries(trial.replacementCost))
      totals.replacementCost[resource]=(totals.replacementCost[resource]||0)+amount;
  }
  const meanReplacementCost=Object.fromEntries(Object.entries(totals.replacementCost)
    .map(([resource,amount])=>[resource,amount/trials.length]));
  result.push({
    key,
    name:config.name,
    startingKillValue:initial.kill,
    startingBone:initial.bone,
    startingArmy:initial.army,
    attempts:trials.length,
    wins:wins.length,
    winSeeds:wins.map(trial=>trial.seed),
    dropWins:wins.filter(trial=>trial.itemGain>0).length,
    fullArmyLosses:trials.filter(trial=>trial.deployedLoss===initial.army).length,
    totalDeployedLoss:totals.deployedLoss,
    meanDeployedLossPerAttempt:totals.deployedLoss/trials.length,
    totalBoneGain:totals.boneGain,
    meanBoneGainPerAttempt:totals.boneGain/trials.length,
    totalMedalGain:totals.medalGain,
    totalMaterialGain:totals.itemGain,
    meanReplacementCostPerAttempt:meanReplacementCost,
    ...(process.argv.includes('--detail')?{trials}:{})
  });
}

console.log(JSON.stringify({
  kind:'six independent 12-seed paid-state hunt replays; no replenishment between trials',
  source:path.relative(process.cwd(),input),
  unit:'soldiers and resource units; material items by item count',
  result
},null,2));
