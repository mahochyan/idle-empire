'use strict';
// Paid L5→L10 capacity bridge. The P170/P167 checkpoints are reused only in
// memory; all staffing, building, research, training, formation and battle state
// changes below call the live game functions in an isolated VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p170Path=path.join(__dirname,'probe-t1-handoff-feasibility-p170.js');
const outputPath=path.join(root,'docs/codex/reports/data/p171-paid-regiment-capacity.json');
const seeds=[1,42],policyName='food-food',maxWait=3600,postVictoryWait=600;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P171找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P171的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
function reuseP170(){
  let source=fs.readFileSync(p170Path,'utf8');
  source=replaceOnce(source,"const policy=workerPolicies.find(p=>p.name==='food-food');",
    'return {runBranch,workerPolicies,snapshot,installBattleHarness,battleRng,owned,place};\nconst policy=workerPolicies.find(p=>p.name===\'food-food\');',
    'P170同源L5返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p170Path),{log(){},error:console.error},path.dirname(p170Path));
}
const {runBranch,workerPolicies,snapshot,installBattleHarness,battleRng,owned,place}=reuseP170();
const policy=workerPolicies.find(item=>item.name===policyName);
assert.ok(policy);
function checkpoint(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),resources:{...S.res},
    merit:S.merit,workers:{...S.popAlloc},warehouse:{...S.buildings.warehouse},
    barracks:{...S.buildings.barracks},infantryCamp:{...S.buildings.infantry_camp},
    archerRange:{...S.buildings.archer_range},storageMode:S.storageMode,
    caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
    regMax:regMax(),frontSlots:rowSlots('front'),midSlots:rowSlots('mid'),backSlots:rowSlots('back'),
    sciences:[...S.sciences],upgradedUnits:{...S.upgradedUnits},
    queue:JSON.parse(JSON.stringify(S.queue)),defeated:[...S.defeated]})`));
}
function compact(run){
  const s=checkpoint(run);
  return{tick:s.tick,resources:s.resources,merit:s.merit,workers:s.workers,
    warehouse:s.warehouse,barracks:s.barracks,infantryCamp:s.infantryCamp,
    archerRange:s.archerRange,caps:s.caps,regMax:s.regMax,frontSlots:s.frontSlots,
    owned:Object.fromEntries(['bronze_guard','infantry','archer','infantry_t1','archer_t1']
      .map(type=>[type,owned(run,type)])),queue:s.queue};
}
function paidDelta(row,cost,tech=0,merit=0){
  if(Object.keys(cost).length===0)
    assert.deepEqual(row.after.resources,row.before.resources,
      `${row.label} 排队时不应立即扣资源`);
  for(const [rk,n] of Object.entries(cost)){
    if(rk==='time')continue;
    const actual=row.before.resources[rk]-row.after.resources[rk];
    assert.ok(Math.abs(actual-n)<1e-7,`${row.label}/${rk} 扣费 ${actual} ≠ ${n}`);
  }
  assert.equal(row.before.resources.tech-row.after.resources.tech,tech,
    `${row.label}/科技扣费`);
  assert.equal(row.before.merit-row.after.merit,merit,`${row.label}/战功扣费`);
}
function deployed(formation){
  const out={bronze_guard:0,infantry_t1:0,archer_t1:0};
  for(const row of ['front','mid','back'])for(const unit of formation[row])
    if(Object.hasOwn(out,unit.type))out[unit.type]+=unit.count;
  return out;
}
function formArmy(run){
  run("clrForm('expedition')");
  const max=run('regMax()');
  assert.equal(max,15,'营帐未提供15人每团');
  for(const [index,type] of [[0,'bronze_guard'],[1,'infantry_t1']]){
    const count=Math.min(max,run(`S.pool['${type}']||0`));
    if(count)place(run,'front',type,count,index);
  }
  let archers=run('S.pool.archer_t1||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
    const n=Math.min(max,archers);place(run,row,'archer_t1',n,i);archers-=n;
  }
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function fight(run,seed,stage){
  assert.equal(run('S.defeated.length'),stage-1,`L${stage}不可跳关`);
  const formation=formArmy(run),before=compact(run);
  battleRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`L${stage}未开战`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p166Step()'),true,`L${stage}战斗回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage}未结算`);
  const row={stage,won:run(`S.defeated.includes(${stage})`),round:run('B.round'),
    callbacks,before,formation,beforeDeployed:deployed(formation),after:compact(run)};
  run('exitBattle()');
  return row;
}
function route(run,seed){
  const initial=checkpoint(run),ledger=[],battles=[];
  let minFood=initial.resources.food;
  const pausedQueueSeconds={};
  function observe(){
    minFood=Math.min(minFood,run('S.res.food'));
    for(const [type,q] of Object.entries(plain(run('S.queue'))))
      if(q.count>0&&q.reason){
        const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1;
      }
  }
  function tick(){run('tick()');observe()}
  function action(label,expression,expectedCost=null,tech=0,merit=0){
    const before=compact(run),result=run(expression),after=compact(run);
    assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
    const row={label,expression,before,after,result:plain(result)};
    if(expectedCost)paidDelta(row,expectedCost,tech,merit);
    ledger.push(row);observe();
    return row;
  }
  function waitUntil(label,predicate,max=maxWait){
    const before=compact(run);
    let seconds=0;
    while(!predicate()&&seconds<max){tick();seconds++}
    const row={label,seconds,met:predicate(),before,after:compact(run)};
    ledger.push(row);
    return row.met;
  }
  function waitExactly(label,seconds){
    const before=compact(run);
    for(let i=0;i<seconds;i++)tick();
    ledger.push({label,seconds,before,after:compact(run)});
  }
  function block(at,gate){return{initial,ledger,battles,minFood,pausedQueueSeconds,
    block:{at,gate},final:compact(run),clearedL10:false}}
  function affordability(cost){
    return Object.entries(cost).every(([rk,n])=>rk==='time'||run(`S.res.${rk}`)>=n);
  }
  for(const type of ['infantry','archer']){
    const q=run(`S.queue['${type}']?.count||0`);
    if(q>0){
      const before=compact(run);run(`cancelQueue('${type}')`);
      assert.equal(run(`S.queue['${type}']?.count||0`),0);
      ledger.push({label:`取消旧${type}训练队列`,cancelled:q,before,after:compact(run)});
    }
  }
  const stoneBefore=run('S.popAlloc.stone');
  const woodBefore=run('S.popAlloc.wood');
  action('调离3名石工',`setPopAlloc('stone',${stoneBefore-3})`);
  action('安排3名木工',`setPopAlloc('wood',${woodBefore+3})`);
  assert.equal(initial.storageMode,'aligned','此口径的基本仓容需为对齐模式');
  for(let level=2;level<=5;level++){
    const beforeLevel=run('S.buildings.warehouse.lv');
    assert.equal(beforeLevel,level-1);
    const cost=plain(run("upCost('warehouse')"));
    assert.equal(run("upgradeLockReason('warehouse')"),'','仓库等级门');
    if(!waitUntil(`攒仓库Lv${level}费用`,()=>affordability(cost)))
      return block(`warehouse-L${level}`,{cost,resources:compact(run).resources});
    action(`支付仓库Lv${level}`,"buildAct('warehouse')",cost);
    assert.equal(run('S.buildings.warehouse.state'),'upgrading');
    if(!waitUntil(`仓库Lv${level}完工`,()=>run('S.buildings.warehouse.lv')===level,cost.time+1))
      return block(`warehouse-L${level}-completion`,compact(run).warehouse);
    assert.equal(ledger.at(-1).seconds,cost.time,`仓库Lv${level}完工时间`);
    assert.equal(run('S.buildings.warehouse.state'),'idle');
    assert.equal(run("resCap('wood')"),1800+600*level);
    assert.equal(run("resCap('stone')"),1200+400*level);
  }
  const barracksCost=plain(run("upCost('barracks')"));
  assert.equal(run("upgradeLockReason('barracks')"),'','营帐自身等级门');
  assert.ok(barracksCost.wood<=run("resCap('wood')")&&
    barracksCost.stone<=run("resCap('stone')"),'Lv5仓库仍装不下营帐费用');
  if(!waitUntil('攒营帐Lv2费用',()=>affordability(barracksCost)))
    return block('barracks-L2',{cost:barracksCost,resources:compact(run).resources});
  action('支付营帐Lv2',"buildAct('barracks')",barracksCost);
  assert.equal(run('regMax()'),5,'升级期间营帐应暂时失去团规模加成');
  if(!waitUntil('营帐Lv2完工',()=>run('S.buildings.barracks.lv')===2,barracksCost.time+1))
    return block('barracks-L2-completion',compact(run).barracks);
  assert.equal(ledger.at(-1).seconds,barracksCost.time,'营帐Lv2完工时间');
  assert.equal(run('regMax()'),15);
  assert.equal(run("rowSlots('front')"),2);
  for(const [key,type] of [['infantry_camp','infantry'],['archer_range','archer']]){
    const cost=plain(run(`tierUpgradeCost('${key}')`));
    if(!waitUntil(`攒${key} T1费用`,()=>run(`tierUpgradeLockReason('${key}')`)===''))
      return block(`${key}-T1`,{cost,reason:run(`tierUpgradeLockReason('${key}')`)});
    const oldOwned=owned(run,type);
    action(`支付${key} T1`, `buildTierUpgradeAct('${key}')`,cost);
    if(!waitUntil(`${key} T1完工`,()=>run(`S.buildings.${key}.tier`)===1,cost.time+1))
      return block(`${key}-T1-completion`,compact(run)[key]);
    assert.equal(ledger.at(-1).seconds,cost.time,`${key} T1完工时间`);
    assert.equal(owned(run,type),0,`${type}旧兵未退还`);
    const refund=Object.fromEntries(['wood','stone','food']
      .map(rk=>[rk,oldOwned*run(`CFG.units.${type}.cost.${rk}`)]));
    const log=`退还${oldOwned}名旧时代士兵，木${refund.wood}石${refund.stone}食${refund.food}`;
    assert.equal(plain(run('S.log')).filter(x=>x===log).length,1);
    ledger.push({label:`${type}旧兵退款核对`,oldOwned,refund,log,after:compact(run)});
  }
  for(const [from,to] of [['infantry','infantry_t1'],['archer','archer_t1']]){
    const branch=plain(run(`CFG.unitUpgrades.${from}.tree.${from}.branches[0]`));
    if(!waitUntil(`攒${to}研究费用`,()=>affordability(branch.cost)&&
      run('S.res.tech')>=branch.needTech&&run('S.merit')>=branch.needMerit))
      return block(`${to}-research`,{branch,resources:compact(run).resources,
        merit:run('S.merit')});
    action(`研究${to}`,`upgradeUnit('${from}','${to}')`,branch.cost,
      branch.needTech,branch.needMerit);
    assert.equal(run(`trainLockReason('${to}')`),'');
  }
  for(const [type,target] of [['bronze_guard',15],['infantry_t1',15],['archer_t1',13]]){
    const missing=target-owned(run,type)-run(`S.queue['${type}']?.count||0`);
    if(missing>0)action(`首次补训${type}`,`train('${type}',${missing})`,{});
  }
  if(!waitUntil('等待三线兵力补满',()=>owned(run,'bronze_guard')>=15&&
    owned(run,'infantry_t1')>=15&&owned(run,'archer_t1')>=13,1800))
    return block('training',{owned:compact(run).owned,queue:compact(run).queue});
  const firstBattleTick=run('S.tick');
  for(let stage=6;stage<=10;stage++){
    if(stage>6){
      for(const [type,target] of [['bronze_guard',15],['infantry_t1',15],['archer_t1',13]]){
        const missing=target-owned(run,type)-run(`S.queue['${type}']?.count||0`);
        if(missing>0)action(`L${stage}补训${type}`,`train('${type}',${missing})`,{});
      }
      waitExactly(`L${stage}战前补给`,postVictoryWait);
    }
    const battle=fight(run,seed,stage);
    battles.push(battle);observe();
    if(!battle.won)break;
  }
  return{initial,ledger,battles,minFood,pausedQueueSeconds,block:null,
    firstBattleTick,final:compact(run),clearedL10:run('S.defeated.includes(10)'),
    firstLoss:battles.find(x=>!x.won)?.stage||null};
}

const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const source=runBranch(seed,disableReward,policy);
  assert.ok(source.battles.length===5&&source.battles.every(b=>b.won));
  const e=environment({rts_save:source.checkpointSave}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  installBattleHarness(run);
  assert.deepEqual(snapshot(run),source.checkpoint);
  const result=route(run,seed);
  const saved=run("localStorage.getItem('rts_save')");
  const reloaded=environment({rts_save:saved});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(checkpoint(reloaded.run),checkpoint(run),'P171终档重载不一致');
  assert.deepEqual(snapshot(reloaded.run),snapshot(run),'P171兵力终档重载不一致');
  profiles.push({seed,branch:source.branch,sourceL5SaveSha256:source.checkpointSaveSha256,
    route:result,finalSaveSha256:sha(saved)});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P171',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),method:'P170 in-memory real P167 L5 first-clear save checkpoint; real queue cancellation and stone-to-wood staffing; real warehouse paid upgrades 1→5, barracks paid upgrade 1→2, T1 camp upgrades/refunds, research, queues, training and formation; xorshift32 stage-specific battle RNG; 600 online ticks after each victory through L10 or first loss; no resource injection or player/UI changes',
  scope:{seeds,policyName,branches:['current-L3-plus-six','no-L3-reward'],
    maxWait,postVictoryWait,noOffline:true,noGarrison:true},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P171',profiles:profiles.map(p=>({seed:p.seed,branch:p.branch,
  block:p.route.block,elapsedToFirstBattle:p.route.firstBattleTick-p.route.initial.tick,
  minFood:p.route.minFood,pausedQueueSeconds:p.route.pausedQueueSeconds,
  firstLoss:p.route.firstLoss,clearedL10:p.route.clearedL10,
  finalCaps:p.route.final.caps,finalRegMax:p.route.final.regMax,
  battles:p.route.battles.map(b=>({stage:b.stage,won:b.won,round:b.round,
    beforeOwned:b.before.owned,beforeDeployed:b.beforeDeployed})),
  paidSteps:p.route.ledger.filter(x=>x.expression&&x.label.startsWith('支付'))
    .map(x=>({label:x.label,tick:x.after.tick}))})),rawData:outputPath},null,2));
