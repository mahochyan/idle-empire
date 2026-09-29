'use strict';
// P375 rerun of P368's paid checkpoint: frozen historical 6 vs current 48.
// Original P368 data files remain untouched; historical 6 exists only in VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sourceFile='p368-stage64-natural-paid-save.json';
const entryFile='p375-stage65-hightech-paid-entry.json';
const reportFile='p375-stage65-hightech-comparison.json';
const sourceRaw=fs.readFileSync(path.join(dataDir,sourceFile),'utf8');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const sourceHashes=Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage65-paid-p368.js']
  .map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const target={alloy_special:40,archer:40};

function newWorld(raw,seed=null){
  const world=environment({rts_save:raw}),{run}=world;
  assert.equal(run('loadSaveAndApply().status'),'ok','付费检查点无法读取');
  const initialTick=run('S.tick'),initialTs=JSON.parse(raw).ts;
  assert.ok(Number.isSafeInteger(initialTs)&&Number.isSafeInteger(initialTick));
  run(`globalThis.__RealDate=Date;
    globalThis.Date=class extends __RealDate {static now(){return ${initialTs}+(S.tick-${initialTick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const item=__timers.entries().next().value;if(!item)return false;
      __timers.delete(item[0]);item[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__trainingSpend=[];
    const originalPay=payTrainingCost;
    globalThis.payTrainingCost=(cost,count)=>{
      for(const [resource,unitCost] of Object.entries(cost||{}))
        if(Object.prototype.hasOwnProperty.call(CFG.res,resource))
          __trainingSpend.push({resource,amount:unitCost*count});
      return originalPay(cost,count);
    };
    ${seed===null?'':`globalThis.__rng=${seed};Math.random=()=>{let x=__rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`}`);
  return world;
}
function state(run){
  return run(`({tick:S.tick,defeated:S.defeated.length,army:armyCount(),deployed:formSoldierCount(),
    formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},resources:{...S.res},
    camp:S.buildings.infantry_camp?{...S.buildings.infantry_camp}:null})`);
}
function owned(run,unit){
  return run(`(S.pool['${unit}']||0)+Object.values(S.formation).flat()
    .filter(u=>u.type==='${unit}').reduce((sum,u)=>sum+u.count,0)`);
}
function advance(run,predicate,max=30000){
  const result=run(`(()=>{let seconds=0;while(!(${predicate})&&seconds<${max}){tick();seconds++}
    return{seconds,reached:!!(${predicate})}})()`);
  assert.equal(result.reached,true,`等待 ${predicate} 超过 ${max} 在线秒`);
  return result.seconds;
}
function allocate(run,jobs){
  const existing=run('({...S.popAlloc})');
  for(const [key,n] of Object.entries(existing))if(n>0)
    assert.equal(run(`setPopAlloc('${key}',0)`).ok,true,`撤出${key}岗位失败`);
  for(const [key,n] of Object.entries(jobs))if(n>0)
    assert.equal(run(`setPopAlloc('${key}',${n})`).ok,true,`分配${key}岗位失败`);
  assert.ok(run('popAllocTotal()')<=run('popCurrent()'),'岗位人数超过村民数');
}
function trainMissing(run,unit,desired){
  const missing=Math.max(0,desired-owned(run,unit));
  if(!missing)return{count:0,seconds:0};
  const fee=run(`CFG.units['${unit}'].cost`);
  if(fee.steel&&run('S.res.steel')<fee.steel*missing){
    assert.ok(run("resCap('steel')")>=fee.steel*missing,'钢仓不足以付本次完整补训');
    allocate(run,{food:10,stone:33,coal:26,iron:20,steel:12});
    advance(run,`S.res.steel>=${fee.steel*missing}`);
  }
  allocate(run,{food:run('popCurrent()')});
  for(const [key,per] of Object.entries(fee))
    assert.ok(run(`S.res['${key}']`)>=per*missing,`${unit} 补训前 ${key} 不足`);
  const oldPool=run(`S.pool['${unit}']||0`),start=run('S.tick');
  const queued=run(`train('${unit}',${missing})`);
  assert.equal(queued.ok,true,`${unit} 入队失败：${JSON.stringify(queued)}`);
  assert.equal(queued.qty,missing,`${unit} 队列截断`);
  advance(run,`(S.pool['${unit}']||0)>=${oldPool+missing}`,10000);
  return{count:missing,seconds:run('S.tick')-start};
}
function place(run,row,index,unit,count){
  assert.ok(run(`(S.pool['${unit}']||0)`)>=count,`${unit} 库存不足`);
  run(`openFormModal('expedition','${row}',${index});S._formModalSel='${unit}';S._formModalQty=${count}`);
  assert.notEqual(run('confirmForm()'),false,`${unit} 无法编入${row}`);
}
function fullRoster(run){
  assert.equal(owned(run,'alloy_special'),target.alloy_special,'合金兵目标前后不一致');
  assert.equal(owned(run,'archer'),target.archer,'弓兵目标前后不一致');
  run("clrForm('expedition')");
  place(run,'front',0,'alloy_special',40);
  place(run,'mid',0,'archer',20);
  place(run,'back',0,'archer',20);
  assert.equal(run('formSoldierCount()'),80);
}
function replenish(run){
  const before=state(run),paidBefore=run('__trainingSpend.length');
  const alloy=trainMissing(run,'alloy_special',40);
  const archer=trainMissing(run,'archer',40);
  fullRoster(run);
  assert.equal(run('save().ok'),true);
  const after=state(run),paid=run(`__trainingSpend.slice(${paidBefore})`);
  const paidCosts={};for(const entry of paid)paidCosts[entry.resource]=(paidCosts[entry.resource]||0)+entry.amount;
  const expectedCosts={};
  for(const [unit,count] of [['alloy_special',alloy.count],['archer',archer.count]])
    for(const [key,amount] of Object.entries(run(`CFG.units['${unit}'].cost`)))
      if(count)expectedCosts[key]=(expectedCosts[key]||0)+amount*count;
  assert.deepEqual(paidCosts,expectedCosts,'补兵必须按实际生产人数扣费一次');
  return{seconds:after.tick-before.tick,alloy,archer,paidCosts,beforeArmy:before.army,
    afterArmy:after.army,foodBefore:before.resources.food,foodAfter:after.resources.food,
    steelBefore:before.resources.steel,steelAfter:after.resources.steel};
}
function finishBuilding(run,key){
  return advance(run,`S.buildings['${key}']?.state==='idle'`,300);
}
function buildT3Camp(run){
  assert.equal(run("buildAct('infantry_camp').ok"),true);
  const seconds=[finishBuilding(run,'infantry_camp')];
  for(let tier=1;tier<=3;tier++){
    const result=run("buildTierUpgradeAct('infantry_camp')");
    assert.equal(result.ok,true,`T${tier}营地付款失败：${JSON.stringify(result)}`);
    seconds.push(finishBuilding(run,'infantry_camp'));
    assert.equal(run('S.buildings.infantry_camp.tier'),tier);
  }
  assert.match(run("tierUpgradeLockReason('infantry_camp')"),/第65关/);
  return seconds;
}
function battle(run,stage){
  const before=state(run);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`第${stage}关未能开战`);
  const enemies=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((sum,u)=>sum+u.initialCount,0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){
    assert.equal(run('__step()'),true,`第${stage}关回调丢失`);callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`第${stage}关超出回调上限`);
  const after=state(run),won=run(`S.defeated.includes(${stage})`);
  assert.equal(after.tick,before.tick,'战斗动画错误推进生产时钟');
  assert.equal(after.army<=before.army,true,'战后兵力异常增加');
  run('exitBattle()');
  return{stage,won,round:run('B.round'),callbacks,enemies,beforeArmy:before.army,
    afterArmy:after.army,loss:before.army-after.army,
    beforeDeployed:before.deployed,afterDeployed:after.deployed,
    reward:Object.fromEntries(['wood','stone','food'].map(key=>[key,after.resources[key]-before.resources[key]]))};
}

// Source is the legal P97 route from the paid, zero-win P100 snapshot through stage 64.
const base=newWorld(sourceRaw),baseRun=base.run;
assert.equal(baseRun('S.defeated.length'),64);
assert.equal(baseRun('S.defeated.includes(65)'),false);
assert.equal(baseRun('formSoldierCount()'),68);
const after64=state(baseRun);
const firstRecovery=replenish(baseRun);
assert.equal(firstRecovery.archer.count,12);
const campSeconds=buildT3Camp(baseRun);
const preGate=baseRun("tierUpgradeLockReason('infantry_camp')");
assert.match(preGate,/第65关/);
assert.equal(baseRun('save().ok'),true);
const entryRaw=base.store.get('rts_save');
fs.writeFileSync(path.join(dataDir,entryFile),entryRaw);
const entryReload=newWorld(entryRaw);
assert.equal(entryReload.run('formSoldierCount()'),80);
assert.equal(entryReload.run('S.buildings.infantry_camp.tier'),3);
assert.match(entryReload.run("tierUpgradeLockReason('infantry_camp')"),/第65关/);

const rows=[];
for(const variant of ['historical6','current48'])for(let seed=1;seed<=32;seed++){
  const world=newWorld(entryRaw,seed),{run}=world;
  if(variant==='historical6')run(`CFG.enemies[64].units={infantry:[1,1,1],archer:[1,1,1]}`);
  const first=battle(run,65);
  assert.equal(first.enemies.people,variant==='historical6'?6:48);
  const gate=run("tierUpgradeLockReason('infantry_camp')");
  if(first.won)assert.equal(gate,'','第65关胜利后应开放T4付款');
  else assert.match(gate,/第65关/,'第65关失败不应开放T4');
  const settled=world.store.get('rts_save');
  const reload=newWorld(settled);
  assert.equal(reload.run('S.defeated.includes(65)'),first.won);
  assert.equal(reload.run('armyCount()'),first.afterArmy);
  let t4=null,recovery=null,next=null;
  if(first.won){
    const cost=run("tierUpgradeCost('infantry_camp')");
    const before=state(run);
    const payment=run("buildTierUpgradeAct('infantry_camp')");
    assert.equal(payment.ok,true,'第65关后T4付款失败');
    const seconds=finishBuilding(run,'infantry_camp');
    assert.equal(run('S.buildings.infantry_camp.tier'),4);
    t4={cost,seconds,woodPaid:before.resources.wood-run('S.res.wood'),
      stonePaid:before.resources.stone-run('S.res.stone')};
    recovery=replenish(run);
    next=battle(run,66);
  }
  assert.equal(run('save().ok'),true);
  const finalRaw=world.store.get('rts_save'),finalReload=newWorld(finalRaw);
  assert.equal(finalReload.run('S.defeated.includes(65)'),first.won);
  if(t4)assert.equal(finalReload.run('S.buildings.infantry_camp.tier'),4);
  if(next)assert.equal(finalReload.run('S.defeated.includes(66)'),next.won);
  rows.push({variant,seed,first,gate,t4,recovery,next,finalArmy:finalReload.run('armyCount()')});
}
const summary=Object.fromEntries(['historical6','current48'].map(variant=>{
  const sample=rows.filter(row=>row.variant===variant),wins=sample.filter(row=>row.first.won),
    recovered=wins.filter(row=>!row.recovery?.blocked&&row.recovery),
    nextWins=sample.filter(row=>row.next?.won),losses=wins.map(row=>row.first.loss).sort((a,b)=>a-b);
  return[variant,{firstWins:wins.length,of:sample.length,winLossMin:losses[0]??null,
    winLossMedian:losses.length?losses[Math.floor((losses.length-1)/2)]:null,
    winLossMax:losses.at(-1)??null,t4Paid:wins.filter(row=>row.t4).length,
    recovered:recovered.length,nextStageWins:nextWins.length,
    blocked:sample.filter(row=>row.recovery?.blocked).map(row=>({seed:row.seed,reason:row.recovery.blocked}))}];
}));
const report={batch:'P375',predecessor:'P368',unit:'online seconds; soldiers; configured resource units',
  source:{file:sourceFile,sha256:sha(sourceRaw),route:'P100 paid zero-win snapshot -> P97 real stages 1-64, fixed seed 9',
    after64:{tick:after64.tick,defeated:after64.defeated,army:after64.army,deployed:after64.deployed,
      food:after64.resources.food,steel:after64.resources.steel}},
  paidEntry:{file:entryFile,sha256:sha(entryRaw),firstRecovery,campSeconds,
    tick:baseRun('S.tick'),army:baseRun('armyCount()'),deployed:baseRun('formSoldierCount()'),preGate},
  sourceHashes,summary,rows,
  scope:'Both variants use the same legally paid stage-64 checkpoint and current combat/actions. Historical 6 rewrites stage-65 enemy counts only in isolated VM; current 48 comes from levels.js. Fixed streams are diagnostics, not player win rates. Garrison is disabled in the Node harness. Original P368 data remains frozen.'};
fs.writeFileSync(path.join(dataDir,reportFile),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:reportFile,source:report.source,paidEntry:report.paidEntry,summary},null,2));
