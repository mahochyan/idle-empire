'use strict';
// P166 compares the shipped L3 first-clear reward with an isolated no-reward
// control. It never runs P102's historical, hand-injected deed model.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p102Path=path.join(__dirname,'probe-population-first-clear-replenish-p102.js');
const outputPath=path.join(root,'docs/codex/reports/data/p166-current-first-clear-population.json');
const stoneReserve=100;
const stoneSaleSize=1000;

function plain(value){return JSON.parse(JSON.stringify(value))}
function snapshot(run){
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),growthClock:S.population.growthClock,
    workers:{...S.popAlloc},resources:{...S.res},army:armyCount(),upkeepPerSecond:totalUpkeep(),
    pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    queue:JSON.parse(JSON.stringify(S.queue)),defeated:[...S.defeated],settlements:{...S.settlements}})`));
}
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function replaceOnce(source,needle,replacement){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,'P102真实军备准备返回点已经变化');
  assert.equal(source.indexOf(needle,first+needle.length),-1,'P102军备准备返回点不唯一');
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

// P102 has the reusable P101 zero-win source and the actual 18-person barracks,
// research, training and allocation actions, but its later clearReward() adds
// candidate deeds by direct S mutation. Return before that historical model runs.
function capturePreparation(){
  const source=fs.readFileSync(p102Path,'utf8');
  const isolated=replaceOnce(source,'let battleStart=prepareEconomy();',
    'let battleStart=prepareEconomy(); return {sourceSave:startSave,battleStart};');
  const runSource=new Function('require','console','__dirname',isolated);
  const result=runSource(createRequire(p102Path),{log(){},error:console.error},__dirname);
  assert.equal(typeof result?.sourceSave,'string');
  assert.equal(typeof result?.battleStart?.save,'string');
  const sourceEnvironment=environment({rts_save:result.sourceSave});
  assert.equal(sourceEnvironment.run('loadSaveAndApply().status'),'ok');
  const sourceState=snapshot(sourceEnvironment.run);
  assert.equal(sourceState.population,18);
  assert.equal(sourceState.capacity,18);
  assert.equal(sourceState.resources.deed,0);
  assert.deepEqual(sourceState.defeated,[]);
  const battleEnvironment=environment({rts_save:result.battleStart.save});
  assert.equal(battleEnvironment.run('loadSaveAndApply().status'),'ok');
  const battleState=snapshot(battleEnvironment.run);
  assert.equal(battleState.population,18);
  assert.equal(battleState.capacity,18);
  assert.equal(battleState.resources.deed,0);
  assert.deepEqual(battleState.defeated,[]);
  assert.equal(battleState.army,36);
  return{sourceSave:result.sourceSave,battleSave:result.battleStart.save,
    sourceState,battleState};
}

function installBattleHarness(run){
  // The VM calls real battle functions; only browser timers/DOM are emulated.
  run(`globalThis.__p166Timers=new Map();globalThis.__p166TimerId=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__p166TimerId++;__p166Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p166Timers.delete(id);
    globalThis.__p166Step=()=>{const first=__p166Timers.entries().next().value;
      if(!first)return false;__p166Timers.delete(first[0]);first[1]();return true};
    globalThis.__p166Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p166Nodes.has(id))__p166Nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p166Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function checked(run,expression,label){
  const result=run(expression);
  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
  return plain(result);
}
function place(run,row,type,count,index=0){
  if(count<=0)return;
  assert.ok(run(`rowSlots('${row}')`)>index,`${row}[${index}]未开放`);
  assert.ok(run(`S.pool['${type}']||0`)>=count,`${type}余量不足`);
  run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
function formArmy(run){
  run("clrForm('expedition')");
  let bronze=run('S.pool.bronze_guard||0');
  for(let i=0;i<run("rowSlots('front')")&&bronze>0;i++){
    const count=Math.min(run('regMax()'),bronze);
    place(run,'front','bronze_guard',count,i);bronze-=count;
  }
  let infantry=run('S.pool.infantry||0');
  for(let i=0;i<run("rowSlots('front')")&&infantry>0;i++){
    if(run(`S.formation.front[${i}]`))continue;
    const count=Math.min(run('regMax()'),infantry);
    place(run,'front','infantry',count,i);infantry-=count;
  }
  let archers=run('S.pool.archer||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
    const count=Math.min(run('regMax()'),archers);
    place(run,row,'archer',count,i);archers-=count;
  }
}
function battle(run,stage){
  assert.deepEqual(plain(run('[...S.defeated]')),Array.from({length:stage-1},(_,i)=>i+1),
    `L${stage}必须连续首通`);
  formArmy(run);
  const before=snapshot(run);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`L${stage}未开战`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p166Step()'),true,`L${stage}战斗回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage}未结算`);
  const round=run('B.round');
  const won=run(`S.defeated.includes(${stage})`);
  assert.equal(won,true,`L${stage}未胜利`);
  const rewardText=run("document.getElementById('battle-result').innerHTML");
  const after=snapshot(run);
  run('exitBattle()');
  return{stage,callbacks,round,won,before,after,
    rewardShowsExpansionDeed:rewardText.includes('拓居令')};
}
function withoutDeed(row){
  const copy=plain(row);
  delete copy.before.resources.deed;
  delete copy.after.resources.deed;
  for(const state of [copy.before,copy.after])
    for(const formationRow of ['front','mid','back'])
      for(const unit of state.formation[formationRow])delete unit.id;
  delete copy.rewardShowsExpansionDeed;
  return copy;
}
function runBranch(name,battleSave,disableReward){
  const env=environment({rts_save:battleSave});
  const run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(disableReward){
    assert.equal(run('CFG.enemies[2].firstClearReward.deed'),6);
    run('CFG.enemies[2].firstClearReward=null');
  }
  installBattleHarness(run);
  const start=snapshot(run);
  let minFood=start.resources.food;
  function observeFood(){minFood=Math.min(minFood,run('S.res.food'))}
  function tickOne(){run('tick()');observeFood()}
  const battles=[];
  for(let stage=1;stage<=3;stage++){
    battles.push(battle(run,stage));observeFood();
    if(stage<3)for(let i=0;i<10;i++)tickOne();
  }
  const afterL3=snapshot(run);
  const stage3Save=run("localStorage.getItem('rts_save')");
  assert.equal(typeof stage3Save,'string');
  const continuation=environment({rts_save:stage3Save});
  const c=continuation.run;
  assert.equal(c('loadSaveAndApply().status'),'ok');
  assert.deepEqual(snapshot(c),afterL3,`${name} L3结算存档重载不一致`);
  let minFoodAfterL3=afterL3.resources.food;
  for(let i=0;i<10;i++){
    c('tick()');minFood=Math.min(minFood,c('S.res.food'));
    minFoodAfterL3=Math.min(minFoodAfterL3,c('S.res.food'));
  }
  const beforeMarket=snapshot(c);

  function marketTick(){
    c('tick()');minFood=Math.min(minFood,c('S.res.food'));
    minFoodAfterL3=Math.min(minFoodAfterL3,c('S.res.food'));
  }
  function expandAndBirth(target){
    const segmentStart=snapshot(c);
    let segmentMinFood=segmentStart.resources.food;
    function segmentTick(){marketTick();segmentMinFood=Math.min(segmentMinFood,c('S.res.food'))}
    const quote=plain(c("settlementBatchPreview('village',1)"));
    assert.equal(quote.ok,false,`${name}/${target}应尚缺地契`);
    const deedCost=quote.cost;
    assert.equal(deedCost,target===19?9:10,`${name}/${target}当前住房费用发生变化`);
    const deedMissing=deedCost-segmentStart.resources.deed;
    assert.ok(deedMissing>0,`${name}/${target}需要市场续供`);
    const deedRate=c("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
    const coinCost=Math.ceil(deedMissing/deedRate);
    assert.equal(Math.floor(coinCost*deedRate),deedMissing);
    const sales=[];
    let waited=0;
    while(c('S.res.coin')<coinCost){
      if(c('S.res.stone')>=stoneReserve+stoneSaleSize){
        const before=snapshot(c);
        const sale=checked(c,`exchangeResource('stone','coin',${stoneSaleSize})`,`${name}/${target}卖石`);
        sales.push({tick:before.tick,stoneSpent:stoneSaleSize,coinReceived:sale.get,
          coinBefore:before.resources.coin,coinAfter:c('S.res.coin')});
      }else{
        assert.ok(waited++<20000,`${name}/${target}筹币超过20000模拟在线秒`);
        segmentTick();
      }
    }
    const beforePurchase=snapshot(c);
    const purchase=checked(c,`exchangeResource('coin','deed',${coinCost})`,`${name}/${target}购契`);
    assert.equal(purchase.get,deedMissing);
    assert.equal(c('S.res.deed'),deedCost);
    const expansion=checked(c,"upgradeSettlement('village')",`${name}/${target}扩村`);
    assert.equal(expansion.cost,deedCost);
    assert.equal(c('maxPop()'),target);
    let birthSeconds=0;
    while(c('popCurrent()')<target){
      assert.ok(birthSeconds<20,`${name}/${target}自然出生超过20模拟在线秒`);
      segmentTick();birthSeconds++;
    }
    assert.equal(c('popCurrent()'),target);
    const stoneWorkers=c('S.popAlloc.stone||0');
    checked(c,`setPopAlloc('stone',${stoneWorkers+1})`,`${name}/${target}新增村民上石岗`);
    const after=snapshot(c);
    assert.equal(after.resources.deed,0);
    const saved=checked(c,'save()',`${name}/${target}保存`);
    const reloaded=environment({rts_save:c("localStorage.getItem('rts_save')")});
    assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
    assert.deepEqual(snapshot(reloaded.run),after,`${name}/${target}扩容存档重载不一致`);
    return{target,segmentStart,deedCost,deedMissing,coinCost,sales,
      stoneSold:sales.reduce((sum,sale)=>sum+sale.stoneSpent,0),
      coinFromSales:sales.reduce((sum,sale)=>sum+sale.coinReceived,0),
      beforePurchase,purchase,expansion,birthSeconds,
      activeSeconds:after.tick-segmentStart.tick,after,minFood:segmentMinFood};
  }
  const to19=expandAndBirth(19);
  const to20=expandAndBirth(20);
  return{name,disabledReward:disableReward,start,battles,afterL3,stage3SaveSha256:sha(stage3Save),
    beforeMarket,to19,to20,final:snapshot(c),minFoodFromBattleStart:minFood,minFoodAfterL3,
    simulatedOnlineSecondsFromBattleStart:to20.after.tick-start.tick};
}

const prepared=capturePreparation();
const reward=runBranch('current-L3-plus-six',prepared.battleSave,false);
const control=runBranch('isolated-L3-no-reward',prepared.battleSave,true);
assert.deepEqual(reward.start,control.start,'两支必须共用同一真实战前存档');
for(let i=0;i<3;i++)assert.deepEqual(withoutDeed(reward.battles[i]),withoutDeed(control.battles[i]),
  `L${i+1}战果、战损、资源与时间必须同源`);
for(let i=0;i<2;i++)assert.equal(reward.battles[i].after.resources.deed,
  control.battles[i].after.resources.deed,'L1–L2两支地契余额应相同');
assert.equal(reward.battles[2].after.resources.deed,6,'当前L3首胜应由真实结算发6地契');
assert.equal(control.battles[2].after.resources.deed,0,'隔离无奖控制应保持0地契');
assert.equal(reward.battles[2].rewardShowsExpansionDeed,true,'L3胜利结算应展示拓居令');
assert.equal(control.battles[2].rewardShowsExpansionDeed,false,'无奖控制不能展示拓居令');
assert.equal(reward.to19.deedMissing,3);
assert.equal(control.to19.deedMissing,9);
for(const branch of [reward,control]){
  assert.equal(branch.to20.after.population,20);
  assert.equal(branch.to20.after.capacity,20);
  assert.deepEqual(branch.final.defeated,[1,2,3]);
  assert.ok(branch.minFoodFromBattleStart>0,`${branch.name}粮食耗尽`);
  assert.equal(branch.to19.after.workers.stone,7);
  assert.equal(branch.to20.after.workers.stone,8);
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0,`读取HEAD失败：${head.stderr||''}`);
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js'];
const artifact={batch:'P166',unit:'simulated online tick seconds, residents, deeds, coins, food, military upkeep',
  method:'same P101 serialized zero-win 18/18 save, same real P102 barracks/research/training preparation save, two isolated VM battles L1-L3 with fixed random 0.5; only the control disables CFG.enemies[2].firstClearReward in memory; no P102 clearReward or direct resource additions; reload actual L3 save, sell stone through real market, purchase only missing deeds, upgrade village, tick until birth, assign each newcomer to stone',
  scope:'L1-L3 wins and 18-to-20 housing; no garrison, no offline windows, no later battle comparison; battle callback wall-clock time is not counted in simulated online tick seconds; no player browser save or UI changes',
  marketPolicy:{stoneReserve,stoneSaleSize,source:'stone only',newWorker:'stone'},
  sourceHead:head.stdout.trim(),sourceSaveSha256:sha(prepared.sourceSave),
  battleStartSaveSha256:sha(prepared.battleSave),sourceState:prepared.sourceState,
  battleStartState:prepared.battleState,branches:[reward,control],
  comparison:{sameL1L3Battle:true,deedDeltaAfterL3:6,nextHousingCost:9,
    marketDeedsFor19:{reward:reward.to19.deedMissing,control:control.to19.deedMissing},
    battleStartTo19Seconds:{reward:reward.to19.after.tick-reward.start.tick,
      control:control.to19.after.tick-control.start.tick},
    battleStartTo20Seconds:{reward:reward.to20.after.tick-reward.start.tick,
      control:control.to20.after.tick-control.start.tick},
    minFoodFromBattleStart:{reward:reward.minFoodFromBattleStart,control:control.minFoodFromBattleStart},
    minFoodFromL3To20:{reward:reward.minFoodAfterL3,control:control.minFoodAfterL3}},
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P166',battleStartTick:prepared.battleState.tick,
  comparison:artifact.comparison,
  routes:artifact.branches.map(branch=>({name:branch.name,
    L3:{deed:branch.afterL3.resources.deed,round:branch.battles[2].round,
      army:branch.afterL3.army,food:branch.afterL3.resources.food},
    to19:{tick:branch.to19.after.tick,onlineSeconds:branch.to19.after.tick-branch.start.tick,
      sales:branch.to19.sales.length,stoneSold:branch.to19.stoneSold,
      coinsSpent:branch.to19.coinCost,minFood:branch.to19.minFood},
    to20:{tick:branch.to20.after.tick,onlineSeconds:branch.to20.after.tick-branch.start.tick,
      sales:branch.to20.sales.length,stoneSold:branch.to20.stoneSold,
      coinsSpent:branch.to20.coinCost,minFood:branch.to20.minFood}})),
  rawData:outputPath},null,2));
