'use strict';
// P201: continue the exact P200 paid T2 save through the current L22-L30 campaign.
// Only browser DOM/timers and deterministic RNG are emulated; game actions are live.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, 'docs/codex/reports/data/p200-live-cavalry-essence.json');
const p189Path = path.join(root, 'docs/codex/reports/data/p189-current-third-chapter.json');
const p190Path = path.join(root, 'docs/codex/reports/data/p190-current-third-chapter-second-back.json');
const p194Path = path.join(root, 'docs/codex/reports/data/p194-current-third-chapter-population-army.json');
const outputPath = path.join(root, 'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const p189 = JSON.parse(fs.readFileSync(p189Path, 'utf8'));
const p190 = JSON.parse(fs.readFileSync(p190Path, 'utf8'));
const p194 = JSON.parse(fs.readFileSync(p194Path, 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const seeds = [1, 15];
const maxRecoverySeconds = 7200;
const routes = {
  t2Core43: {targets:{bronze_guard:15,cavalry_wind:15,archer_t1:13},foodWorkers:5},
  t2ThirdFront58: {targets:{bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:13},foodWorkers:5},
  t2SecondBack73: {targets:{bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28},foodWorkers:7}
};
assert.equal(source.batch, 'P200');
assert.equal(source.block, null, 'P200 T2 paid route was blocked');
assert.equal(sha(source.finalSave), source.finalSaveSha256, 'P200 full final save changed');
assert.equal(sha(source.bossSave), source.bossSaveSha256, 'P200 full Boss save changed');
assert.equal(p189.batch, 'P189');
assert.equal(p190.batch, 'P190');
assert.equal(p194.batch, 'P194');
assert.equal(p190.sourceSaveSha256, p189.l21Rebuilt.saveSha256);
assert.notEqual(p194.sourceSaveSha256, p189.l21Rebuilt.saveSha256,
  'P194 是经 P193 扩村的另一终档，不能混同为同一起点');
assert.equal(source.input.saveSha256, p189.l21Rebuilt.saveSha256);

const inputFiles = ['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','docs/codex/reports/data/p200-live-cavalry-essence.json',
  'docs/codex/reports/data/p189-current-third-chapter.json',
  'docs/codex/reports/data/p190-current-third-chapter-second-back.json',
  'docs/codex/reports/data/p194-current-third-chapter-population-army.json',
  'tools/verify/probe-live-cavalry-third-chapter-p201.js'];
const inputs = inputFiles.map(file => ({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
for (const file of ['config.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js'])
  assert.equal(inputs.find(x=>x.file===file).sha256,source.input.sourceHashes[file],
    `P200 后 ${file} 变化，须重新建立 P201 起点`);
assert.equal(inputs.find(x=>x.file==='levels.js').sha256,
  source.input.sourceHashes['levels.js'], 'P200 后关卡配置变化');

function installHarness(run) {
  run(`globalThis.__p201Timers=new Map();globalThis.__p201TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p201TimerId++;__p201Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p201Timers.delete(id);
    globalThis.__p201Step=()=>{const next=__p201Timers.entries().next().value;
      if(!next)return false;__p201Timers.delete(next[0]);next[1]();return true};
    globalThis.__p201Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p201Nodes.has(id))__p201Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p201Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save) {
  const world = environment({rts_save:save});
  const run = world.run;
  assert.equal(run('loadSaveAndApply().status'), 'ok', '完整存档不能加载');
  assert.equal(run('saveProtected()'), false, '存档保护阻挡了继续');
  installHarness(run);
  return {world,run};
}
function owned(run,type) {
  return run(`(S.pool.${type}||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function snapshot(run) {
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    workers:{...S.popAlloc},resources:{...S.res},merit:S.merit,
    essence:{...S.essence},defeated:[...S.defeated],
    researched:{...S.upgradedUnits},army:armyCount(),
    owned:Object.fromEntries(['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
      .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),
    formation:JSON.parse(JSON.stringify(S.formation)),
    foodRate:prodRate('food'),upkeep:totalUpkeep(),
    foodNet:prodRate('food')-popCurrent()*(CFG.popFoodCost??0.1)-totalUpkeep(),
    caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
    rowSlots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')},
    regMax:regMax()})`));
}
function reload(active,label) {
  const before = snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label} 保存失败`);
  const save = active.world.store.get('rts_save');
  assert.equal(typeof save,'string');
  const after = restore(save);
  assert.deepEqual(snapshot(after.run),before,`${label} 重载状态不一致`);
  return {...after,save,saveSha256:sha(save)};
}
function foodEconomy(run) {
  return plain(run(`({population:popCurrent(),workers:{...S.popAlloc},
    foodOutput:prodRate('food'),upkeep:totalUpkeep(),
    residentFood:popCurrent()*(CFG.popFoodCost??0.1),
    net:prodRate('food')-totalUpkeep()-popCurrent()*(CFG.popFoodCost??0.1)})`));
}
function seedRng(run,seed,stage) {
  const initial = (seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p201Rng=${initial};Math.random=()=>{
    let x=__p201Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p201Rng=x>>>0;return __p201Rng/4294967296;}`);
}
function enemy(run,stage) {
  const cfg = plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(cfg.id,stage);
  const rows = plain(run(`(S.selEnemy=${stage-1},S.battleEncounter=null,
    B.isTraining=false,initBattleState(),
    {groups:B.enemyUnits.length,totalHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
      attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
      maxRound:B.maxRound})`));
  // L22-L29 are still the P190/P194 opponent configs. L30 was deliberately retuned.
  if(stage<=29) {
    const historic=p190.profiles[0].stages.find(x=>x.stage===stage)?.enemy.config;
    assert.ok(historic,`P190 缺少 L${stage} 敌阵`);
    assert.deepEqual({id:cfg.id,name:cfg.name,units:cfg.units,boss:!!cfg.boss,
      bossMult:cfg.bossMult||null,reward:cfg.reward},historic,
      `L${stage} 敌阵变化，历史 T1 同口径对比失效`);
  }
  return {config:{id:cfg.id,name:cfg.name,units:cfg.units,
    boss:!!cfg.boss,bossMult:cfg.bossMult||null,reward:cfg.reward},battle:rows};
}
function refill(run,stage,targets) {
  const before = snapshot(run);
  const requested={},produced={},due={},pausedQueueSeconds={};
  let minFoodTickEnd=before.resources.food;
  for(const [type,target] of Object.entries(targets)) {
    const have=owned(run,type),queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'',`L${stage} ${type}训练锁`);
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need)
      return {before,seconds:0,ready:false,requested,produced,due,
        minFoodTickEnd,pausedQueueSeconds,after:snapshot(run),
        block:{type,phase:'queue',action,cap:run(`unitCap('${type}')`),have,queued}};
    assert.deepEqual(plain(run('({...S.res})')),pre,'排队提前扣资源');
    produced[type]=0;
  }
  run(`globalThis.__p201Paid=[];globalThis.__p201OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p201OriginalPay(cost,n);
      __p201Paid.push({type,count:n,cost:{...cost}})};`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!ready()&&seconds<maxRecoverySeconds) {
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)) {
      if(q.count>0&&q.reason) {
        const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1;
      }
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p201Paid'));
  for(const item of paid) {
    assert.ok(Object.hasOwn(targets,item.type),`未知训练付款 ${item.type}`);
    for(const [rk,c] of Object.entries(item.cost))due[rk]=(due[rk]||0)+c*item.count;
  }
  for(const [type,count] of Object.entries(produced))
    assert.equal(paid.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count,
      `L${stage} ${type} 实产与付款人数不符`);
  const result={before,seconds,ready:ready(),requested,produced,
    trainingDue:due,pausedQueueSeconds,minFoodTickEnd,after:snapshot(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type} 未实产到目标`);
  else result.block={phase:'training-time-or-resource',seconds,
    queues:result.after.queue,resources:result.after.resources};
  return result;
}
function formation(run,targets) {
  run('Math.random=()=>0.5');
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15);
  assert.equal(run("rowSlots('front')"),3);
  assert.ok(run("rowSlots('back')")>=2);
  const place=(row,index,type,count)=>{
    assert.ok(owned(run,type)>=count);
    assert.ok(run(`S.pool.${type}||0`)>=count,`${type} 编队库存不足`);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
      S.formation.${row}[${index}]?.count===${count}`),true);
  };
  place('front',0,'bronze_guard',15);
  place('front',1,'cavalry_wind',15);
  if(targets.infantry_t1)place('front',2,'infantry_t1',15);
  place('back',0,'archer_t1',13);
  if(targets.archer_t1===28)place('back',1,'archer_t1',15);
  const formed=plain(run('JSON.parse(JSON.stringify(S.formation))'));
  const deployed={};
  for(const row of ['front','mid','back'])for(const u of formed[row])
    deployed[u.type]=(deployed[u.type]||0)+u.count;
  assert.deepEqual(deployed,targets);
  return {formed,deployed};
}
function fight(run,seed,stage,targets) {
  assert.equal(run('S.defeated.length'),stage-1,`L${stage} 不可跳关`);
  const {formed,deployed}=formation(run,targets);
  const before=snapshot(run);
  seedRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`L${stage} 未开战`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000) {
    assert.equal(run('__p201Step()'),true,`L${stage} 异步回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`L${stage} 未结算`);
  const won=run(`S.defeated.includes(${stage})`);
  const round=run('B.round');
  const after=snapshot(run);
  const losses=Object.fromEntries(Object.entries(targets)
    .map(([type,n])=>[type,n-after.owned[type]]));
  for(const [type,n] of Object.entries(losses))
    assert.ok(n>=0&&n<=targets[type],`L${stage} ${type}战损异常`);
  run('exitBattle()');
  return {won,round,callbacks,formation:formed,deployed,
    lossByType:losses,lossTotal:Object.values(losses).reduce((a,b)=>a+b,0),
    before,after};
}

const start=restore(source.finalSave);
const startState=snapshot(start.run);
assert.equal(startState.defeated.at(-1),21);
assert.equal(startState.army,35);
assert.equal(startState.owned.cavalry_wind,15);
assert.equal(startState.owned.cavalry_t1,undefined);
assert.equal(startState.researched.cavalry_wind,true);
assert.equal(startState.essence.wind_essence,0);
assert.equal(startState.essence.iron_essence,2);
assert.equal(startState.resources.food,source.final.resources.food);
assert.equal(startState.workers.food,5);
assert.equal(startState.workers.coal,6);
const sourceRaw=sha(source.finalSave);
const profiles=[];
for(const seed of seeds)for(const [routeName,route] of Object.entries(routes)) {
  let active=restore(source.finalSave);
  assert.deepEqual(snapshot(active.run),startState);
  const staffingBefore=foodEconomy(active.run);
  let staffingActions=[];
  if(route.foodWorkers===7) {
    staffingActions=[plain(active.run("setPopAlloc('coal',4)")),
      plain(active.run("setPopAlloc('food',7)"))];
    assert.ok(staffingActions.every(x=>x?.ok),'粮7岗位调整失败');
    active=reload(active,`${routeName} 岗位调整`);
  }
  const staffingAfter=foodEconomy(active.run);
  assert.equal(staffingAfter.workers.food,route.foodWorkers);
  const stages=[];
  let minFoodTickEnd=active.run('S.res.food');
  for(let stage=22;stage<=30;stage++) {
    const foe=enemy(active.run,stage);
    const recovery=refill(active.run,stage,route.targets);
    minFoodTickEnd=Math.min(minFoodTickEnd,recovery.minFoodTickEnd);
    if(!recovery.ready) {
      stages.push({stage,enemy:foe,recovery,battle:null,block:recovery.block});
      break;
    }
    const prepared=reload(active,`${routeName} seed${seed} L${stage} 战前`);
    active=prepared;
    const battle=fight(active.run,seed,stage,route.targets);
    const settled=reload(active,`${routeName} seed${seed} L${stage} 战后`);
    active=settled;
    const actualReward=Object.fromEntries(Object.keys(foe.config.reward).map(rk=>
      [rk,battle.after.resources[rk]-battle.before.resources[rk]]));
    const essenceDrops=Object.fromEntries(new Set([
      ...Object.keys(battle.before.essence),...Object.keys(battle.after.essence)])
      .values().map(k=>[k,(battle.after.essence[k]||0)-(battle.before.essence[k]||0)])
      .filter(([,n])=>n>0));
    stages.push({stage,enemy:foe,recovery,
      beforeSaveSha256:prepared.saveSha256,
      ...(stage===29?{l29PreparedSave:prepared.save}:{}),
      battle:{won:battle.won,round:battle.round,callbacks:battle.callbacks,
        formation:battle.formation,deployed:battle.deployed,
        lossByType:battle.lossByType,lossTotal:battle.lossTotal,
        nominalReward:foe.config.reward,actualReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterSaveSha256:settled.saveSha256,postBattle:snapshot(active.run)});
    if(!battle.won)break;
  }
  const totals={recoverySeconds:stages.reduce((n,s)=>n+s.recovery.seconds,0),
    totalSinceP189L21:source.totalOnlineSeconds+
      stages.reduce((n,s)=>n+s.recovery.seconds,0),
    trainingDue:{},minimumFoodTickEnd:minFoodTickEnd,
    lastCleared:active.run('S.defeated.at(-1)'),
    firstBlockedStage:stages.find(s=>s.block||!s.battle?.won)?.stage||null};
  for(const s of stages)for(const [rk,n] of Object.entries(s.recovery.trainingDue||{}))
    totals.trainingDue[rk]=(totals.trainingDue[rk]||0)+n;
  profiles.push({seed,route:routeName,targets:route.targets,
    staffing:{before:staffingBefore,actions:staffingActions,after:staffingAfter},
    stages,totals,final:snapshot(active.run),
    finalSaveSha256:sha(active.world.store.get('rts_save')),
    finalSave:active.world.store.get('rts_save')});
}
const comparisons=profiles.map(p=>{
  const [baseData,baseRoute]=p.route==='t2Core43'?[p189,'profiles']:
    p.route==='t2ThirdFront58'?[p189,'thirdFrontProfiles']:[p190,'secondBackFood7'];
  const old=p.route==='t2SecondBack73'?
    baseData.profiles.find(x=>x.seed===p.seed&&x.route===baseRoute):
    baseData[baseRoute].find(x=>x.seed===p.seed);
  assert.ok(old,`缺少 ${p.route} seed${p.seed} 的 T1 对照`);
  const p194Baseline=p.route==='t2SecondBack73'?
    p194.profiles.find(x=>x.seed===p.seed):null;
  return {seed:p.seed,route:p.route,t1Source:p.route==='t2SecondBack73'?'P190':'P189',
    t1Route:baseRoute,t1HistoricalLastCleared:old.totals.lastCleared,
    t1FirstBlockedStage:old.totals.firstBlockedStage,
    t1RecoverySeconds:old.totals.recoverySeconds,
    t2LastCleared:p.totals.lastCleared,
    t2FirstBlockedStage:p.totals.firstBlockedStage,
    t2RecoverySeconds:p.totals.recoverySeconds,
    p194Alternative:p194Baseline&&{historicalLastCleared:p194Baseline.totals.lastCleared,
      recoverySeconds:p194Baseline.totals.recoverySeconds,population:22},
    stages:p.stages.map(s=>{const prior=old.stages.find(x=>x.stage===s.stage);
      const alt=p194Baseline?.stages.find(x=>x.stage===s.stage);
      return {stage:s.stage,t2:{ready:s.recovery.ready,seconds:s.recovery.seconds,
        won:s.battle?.won??null,round:s.battle?.round??null,
        losses:s.battle?.lossTotal??null},
        t1:s.stage<=29&&prior?{ready:prior.recovery.ready,seconds:prior.recovery.seconds,
          won:prior.battle?.won??null,round:prior.battle?.round??null,
          losses:prior.battle?.lossTotal??null}:null,
        p194:s.stage<=29&&alt?{won:alt.battle?.won??null,round:alt.battle?.round??null,
          losses:alt.battle?.lossTotal??null}:null};
    })};
});
const staticIronGate=plain(start.run(`({
  source:{level:S.defeated.at(-1),stableTier:bldSt('stable').tier,
    cavalryRoot:!!S.upgradedUnits.cavalry_t1,
    ironResearched:!!S.upgradedUnits.cavalry_iron,
    ironEssence:S.essence.iron_essence||0,
    resources:{...S.res},merit:S.merit},
  research:CFG.unitUpgrades.cavalry.tree.cavalry_t1.branches
    .find(x=>x.to==='cavalry_iron'),
  units:{t1:CFG.units.cavalry_t1,wind:CFG.units.cavalry_wind,
    iron:CFG.units.cavalry_iron},
  currentTrainLock:trainLockReason('cavalry_iron')})`));
const rangeSemantics=plain(start.run(`({wind:isRanged('cavalry_wind'),
  iron:isRanged('cavalry_iron'),archer:isRanged('archer_t1'),
  windText:CFG.units.cavalry_wind.passive,
  windCombatBase:baseUnitType('cavalry_wind')})`));
assert.equal(rangeSemantics.wind,false,'现行猎风弩骑射程规则已变');
assert.equal(rangeSemantics.archer,true);
assert.equal(rangeSemantics.windCombatBase,'cavalry');
assert.equal(staticIronGate.source.ironEssence,2);
assert.equal(staticIronGate.source.stableTier,2);
assert.equal(staticIronGate.source.cavalryRoot,true);
assert.equal(staticIronGate.source.ironResearched,false);
assert.equal(staticIronGate.research.needEssence.type,'iron_essence');
assert.equal(staticIronGate.research.needEssence.count,2);
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
if(prior) {
  assert.equal(prior.batch,'P201');
  const numeric=p=>p.map(x=>({seed:x.seed,route:x.route,targets:x.targets,
    staffing:x.staffing,totals:x.totals,final:x.final,
    stages:x.stages.map(s=>({stage:s.stage,enemy:s.enemy,recovery:s.recovery,
      battle:s.battle,postBattle:s.postBattle,block:s.block||null}))}));
  const withoutGeneratedFormationIds=value=>JSON.parse(JSON.stringify(value,function(key,item){
    if(key==='id'&&this&&typeof this.type==='string'&&Number.isInteger(this.count))
      return undefined;
    return item;
  }));
  assert.deepEqual(withoutGeneratedFormationIds(numeric(profiles)),
    withoutGeneratedFormationIds(numeric(prior.profiles)),
    'P201 复跑数值轨迹不一致');
  const comparable=value=>plain(value).map(p=>({...p,stages:p.stages.map(s=>
    ({...s,t1:s.stage===30?null:s.t1??null,
      p194:s.stage===30?null:s.p194??null}))}));
  assert.deepEqual(comparable(comparisons),comparable(prior.comparisons),
    'P201 对照复跑不一致');
  assert.deepEqual(staticIronGate,prior.staticIronGate,'重装骑士只读条件变化');
  assert.deepEqual(rangeSemantics,prior.rangeSemantics,'猎风射程语义变化');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P201',sourceHead:head.stdout.trim(),unit:'simulated online seconds',
  sourceSaveSha256:sourceRaw,
  method:'Restore the exact full P200 paid L21 T2 save. Three actual formation targets, seeds 1/15. Use live setPopAlloc, train, per-second tick and payTrainingCost, formation modal, openBattle/async callbacks/endBattle, save/reload before and after each battle; stop on first loss or 7200-second per-stage training block. No resource, troop, essence, stage or enemy injection.',
  scope:{seeds,maxRecoverySeconds,routes,noOffline:true,noGarrison:true,
    rng:'xorshift32 initial=(seed*1009+stage*9176)>>>0; same as P189/P190/P194',
    historicT1Comparison:'L22-L29 enemy config asserted equal; L30 historical T1 results use superseded roster'},
  start:startState,profiles,comparisons,staticIronGate,rangeSemantics,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P201',sourceSaveSha256:sourceRaw,
  profiles:profiles.map(p=>({seed:p.seed,route:p.route,totals:p.totals,
    stages:p.stages.map(s=>({stage:s.stage,seconds:s.recovery.seconds,
      minFood:s.recovery.minFoodTickEnd,ready:s.recovery.ready,
      won:s.battle?.won??null,round:s.battle?.round??null,
      losses:s.battle?.lossTotal??null,block:s.block||null}))})),
  comparisons:comparisons.map(c=>({seed:c.seed,route:c.route,
    t1HistoricalLastCleared:c.t1HistoricalLastCleared,
    t2LastCleared:c.t2LastCleared,
    p194HistoricalLastCleared:c.p194Alternative?.historicalLastCleared??null})),
  output:outputPath},null,2));
