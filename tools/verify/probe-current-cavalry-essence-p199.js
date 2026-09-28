'use strict';
// P199: replay the real P189 L21 save under an in-memory L20 essence-drop candidate.
// All spending, construction, production, research, training and saves use game actions.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const input = JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p189-current-third-chapter.json'), 'utf8'));
const outputPath = path.join(root,
  'docs/codex/reports/data/p199-current-cavalry-essence.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const source = input.l21Rebuilt.save;
assert.equal(input.batch, 'P189');
assert.equal(sha(source), input.l21Rebuilt.saveSha256, 'P189 L21 原始存档变动');
for (const entry of input.inputs.filter(x =>
  ['config.js', 'garrison.js', 'technology.js',
    'tests/progression/harness.js'].includes(x.file))) {
  assert.equal(sha(fs.readFileSync(path.join(root, entry.file))), entry.sha256,
    `${entry.file} 源码与 P189 实付存档不匹配`);
}
const sourceHashes = Object.fromEntries(['config.js', 'levels.js', 'math.js',
  'garrison.js', 'technology.js', 'tests/progression/harness.js']
  .map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const world = environment({rts_save:source});
const run = world.run;
assert.equal(run('loadSaveAndApply().status'), 'ok', 'L21 源档载入失败');
assert.equal(run('saveProtected()'), false);
assert.deepEqual(plain(run('CFG.enemies[19].units')),
  {infantry:[8,6,4],archer:[8,6,4],cavalry_t1:[8,6,4]});
assert.equal(run('CFG.enemies[19].drops.wind_essence'), undefined);
assert.equal(run('CFG.enemies[19].drops.iron_essence'), undefined);
assert.equal(run('S.defeated.includes(20)&&S.defeated.includes(21)'), true);
assert.equal(run('S.essence.wind_essence||0'), 0);
assert.equal(run('S.essence.iron_essence||0'), 0);

const snapshot = rr => plain(rr(`({tick:S.tick,population:popCurrent(),
  workers:{...S.popAlloc},resources:{...S.res},caps:{wood:resCap('wood'),
  stone:resCap('stone'),food:resCap('food')},merit:S.merit,
  essence:{...S.essence},stable:{...bldSt('stable')},
  warehouse:{...bldSt('warehouse')},granary:{...bldSt('large_granary')},
  researched:{...S.upgradedUnits},army:armyCount(),
  cavalryT1:(S.pool.cavalry_t1||0)+expeditionCount('cavalry_t1')+garrisonCount('cavalry_t1'),
  cavalryWind:(S.pool.cavalry_wind||0)+expeditionCount('cavalry_wind')+garrisonCount('cavalry_wind'),
  foodRate:prodRate('food'),upkeep:totalUpkeep(),
  trainingLock:trainLockReason('cavalry_wind')})`));
const first = snapshot(run);
const steps = [];
const record = (action, before, after, extra={}) =>
  steps.push({action,seconds:after.tick-before.tick,...extra,before,after});
const totalPaid = {};
const accumulate = cost => {
  for (const [key, amount] of Object.entries(cost)) {
    if (key==='time') continue;
    totalPaid[key] = (totalPaid[key]||0)+amount;
  }
};

// The candidate changes only the isolated VM's Boss table, not repository files.
run(`CFG.enemies[19].drops.wind_essence={prob:1,count:2};
  CFG.enemies[19].drops.iron_essence={prob:1,count:2};`);
assert.equal(run('CFG.enemies[19].drops.wind_essence.count'), 2);
run(`globalThis.__p199Timers=new Map();globalThis.__p199TimerId=1;
  globalThis.setTimeout=fn=>{const id=__p199TimerId++;__p199Timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__p199Timers.delete(id);
  globalThis.__p199Step=()=>{const first=__p199Timers.entries().next().value;
    if(!first)return false;__p199Timers.delete(first[0]);first[1]();return true};
  globalThis.__p199Nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__p199Nodes.has(id))__p199Nodes.set(id,{style:{},innerHTML:'',
      textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
      toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __p199Nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__p199Rng=${(1*1009+20*9176)>>>0};
  Math.random=()=>{let x=__p199Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p199Rng=x>>>0;return __p199Rng/4294967296};`);
const beforeBoss = snapshot(run);
run('selEnemy(19);openBattle()');
assert.equal(run('S.battleActive'), true, '第20关复战未开战');
let callbacks=0;
while (run('S.battleActive') && callbacks<1000) {
  assert.equal(run('__p199Step()'), true, '战斗异步回调中断');
  callbacks++;
}
assert.equal(run('S.battleActive'), false, '战斗未结算');
const bossResult = {won:run('S.merit')>beforeBoss.merit,
  round:run('B.round'),callbacks,
  losses:beforeBoss.army-run('armyCount()'),
  meritGain:run('S.merit')-beforeBoss.merit,
  drops:{wind:(run('S.essence.wind_essence||0')-(beforeBoss.essence.wind_essence||0)),
    iron:(run('S.essence.iron_essence||0')-(beforeBoss.essence.iron_essence||0))}};
assert.equal(bossResult.won, true, '第20关复战失败，不能继续实付链路');
assert.deepEqual(bossResult.drops, {wind:2,iron:2});
run('exitBattle()');
const afterBoss = snapshot(run);
record('复战第20关，内存候选掉落疾风/铁壁各2', beforeBoss, afterBoss,
  {battle:bossResult});
assert.equal(run('save().ok'), true);
const bossSave=world.store.get('rts_save');
const reloadBoss=environment({rts_save:bossSave});
assert.equal(reloadBoss.run('loadSaveAndApply().status'),'ok');
assert.equal(reloadBoss.run('S.essence.wind_essence'),2);
assert.equal(reloadBoss.run('S.essence.iron_essence'),2);
assert.equal(reloadBoss.run('S.defeated.filter(x=>x===20).length'),1,
  '复战不应重复计入通关记录');

// Continue from the serialized victory. The new VM has the unmodified levels.js.
const live=reloadBoss.run;
let totalSeconds=0;
let minimumFood=Infinity;
let minimumFoodAfterAction=snapshot(live).resources.food;
let zeroFoodTickEnds=0;
const maxOnlineSeconds=18000;
const noteActionFood=()=>{
  minimumFoodAfterAction=Math.min(minimumFoodAfterAction,live('S.res.food'));
};
function advanceUntil(condition,label) {
  const budget=maxOnlineSeconds-totalSeconds;
  if(budget<=0)return {ok:false,seconds:0,reason:'online-time-limit'};
  const result=plain(live(`(()=>{let n=0,minFood=Infinity,zero=0;
    while(!(${condition})&&n<${budget}&&!saveProtected()){
      tick();n++;minFood=Math.min(minFood,S.res.food);
      if(S.res.food===0)zero++;
    }
    return{ok:!!(${condition}),seconds:n,minFood:n?minFood:null,zero,
      protected:saveProtected(),food:S.res.food,
      queueReasons:Object.fromEntries(Object.entries(S.queue)
        .filter(([,q])=>q.count>0).map(([k,q])=>[k,q.reason||'']))}})()`));
  totalSeconds+=result.seconds;
  if(result.minFood!==null)minimumFood=Math.min(minimumFood,result.minFood);
  zeroFoodTickEnds+=result.zero;
  if(!result.ok)result.reason=`${label} 等待失败`;
  return result;
}
function payBuilding(key) {
  const before=snapshot(live);
  const levelBefore=live(`bldSt('${key}').lv`);
  const cost=plain(live(`bldSt('${key}').lv===0?
    buildingInitialCost('${key}'):upCost('${key}')`));
  const cond=Object.entries(cost).filter(([k])=>k!=='time')
    .map(([k,n])=>`S.res.${k}>=${n}`).join('&&')||'true';
  const funded=advanceUntil(cond,`${key} 筹款`);
  if(!funded.ok)return{ok:false,phase:`${key}-funding`,cost,funded};
  const action=plain(live(`buildAct('${key}')`));
  if(!action?.ok)return{ok:false,phase:`${key}-build`,cost,action};
  noteActionFood();
  accumulate(cost);
  const complete=advanceUntil(`bldSt('${key}').state==='idle'&&bldSt('${key}').lv===${levelBefore+1}`,
    `${key} 完工`);
  const after=snapshot(live);
  record(`${key} ${levelBefore}→${levelBefore+1}`,before,after,
    {cost,funded,buildResult:action,complete});
  return complete.ok?{ok:true,cost,funded,complete}:
    {ok:false,phase:`${key}-completion`,cost,complete};
}
let block=null;
const granary=payBuilding('large_granary');
if(!granary.ok)block=granary;
while(!block && live("bldSt('warehouse').lv")<17) {
  const build=payBuilding('warehouse');
  if(!build.ok)block=build;
}
if(!block) {
  assert.ok(live("resCap('wood')")>=8000);
  assert.ok(live("resCap('stone')")>=8000);
  assert.ok(live("resCap('food')")>=5000);
  const before=snapshot(live), cost=plain(live("tierUpgradeCost('stable')"));
  const funded=advanceUntil('S.res.wood>=8000&&S.res.stone>=8000&&S.res.food>=5000',
    '骑兵场T2筹款');
  if(!funded.ok)block={ok:false,phase:'stable-tier-funding',cost,funded};
  else {
    const action=plain(live("buildTierUpgradeAct('stable')"));
    if(!action?.ok)block={ok:false,phase:'stable-tier-start',cost,action};
    else {
      noteActionFood();
      accumulate(cost);
      const complete=advanceUntil("bldSt('stable').tier===2&&bldSt('stable').state==='idle'",
        '骑兵场T2完工');
      record('stable T1→T2',before,snapshot(live),{cost,funded,tierResult:action,complete,
        retiredT1:before.cavalryT1-live("(S.pool.cavalry_t1||0)+expeditionCount('cavalry_t1')+garrisonCount('cavalry_t1')")});
      if(!complete.ok)block={ok:false,phase:'stable-tier-completion',complete};
    }
  }
}
if(!block) {
  const before=snapshot(live),branch=plain(live(`CFG.unitUpgrades.cavalry.tree.cavalry_t1
    .branches.find(x=>x.to==='cavalry_wind')`));
  const need={...branch.cost,tech:branch.needTech};
  const cond=Object.entries(need).map(([k,n])=>`S.res.${k}>=${n}`).join('&&');
  const funded=advanceUntil(cond,'骑兵T2研究筹款');
  if(!funded.ok)block={ok:false,phase:'research-funding',need,funded};
  else {
    const action=plain(live("upgradeUnit('cavalry_t1','cavalry_wind')"));
    noteActionFood();
    record('研究猎风弩骑T2',before,snapshot(live),{need,
      merit:branch.needMerit,essence:branch.needEssence,funded,researchResult:action});
    if(!action?.ok)block={ok:false,phase:'research-action',action};
    else {
      accumulate(need);
      totalPaid.merit=(totalPaid.merit||0)+branch.needMerit;
      totalPaid[branch.needEssence.type]=
        (totalPaid[branch.needEssence.type]||0)+branch.needEssence.count;
    }
  }
}
if(!block) {
  const before=snapshot(live);
  live(`globalThis.__p199TrainingPaid={count:0,resources:{}};
    const __p199OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{
      __p199OriginalPay(cost,n);__p199TrainingPaid.count+=n;
      for(const rk of trainingCostKeys(cost))
        __p199TrainingPaid.resources[rk]=
          (__p199TrainingPaid.resources[rk]||0)+cost[rk]*n;
    };`);
  const action=plain(live("train('cavalry_wind',15)"));
  if(!action?.ok||action.qty!==15)block={ok:false,phase:'training-queue',action};
  else {
    noteActionFood();
    const complete=advanceUntil("(S.pool.cavalry_wind||0)+expeditionCount('cavalry_wind')+garrisonCount('cavalry_wind')>=15",
      '猎风弩骑T2实训15人');
    const paid=plain(live('__p199TrainingPaid'));
    record('猎风弩骑T2训练15人',before,snapshot(live),
      {queueResult:action,complete,paid});
    if(complete.ok){
      assert.equal(paid.count,15,'真实训练生产人数不符');
      const cost=plain(live('CFG.units.cavalry_wind.cost'));
      assert.deepEqual(paid.resources,Object.fromEntries(
        Object.entries(cost).map(([k,v])=>[k,v*15])));
      accumulate(paid.resources);
    }
    if(!complete.ok)block={ok:false,phase:'training-completion',complete};
  }
}
assert.equal(live('save().ok'),true,'终态写档失败');
const finalSave=reloadBoss.store.get('rts_save');
const verify=environment({rts_save:finalSave});
assert.equal(verify.run('loadSaveAndApply().status'),'ok','终态重载失败');
const final=snapshot(verify.run);
if(!block){
  assert.equal(final.stable.tier,2);
  assert.equal(final.researched.cavalry_wind,true);
  assert.equal(final.essence.wind_essence,0);
  assert.equal(final.essence.iron_essence,2);
  assert.ok(final.cavalryWind>=15);
}
const report={batch:'P199',sourceHead:'406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d',
  input:{file:'docs/codex/reports/data/p189-current-third-chapter.json',
    saveSha256:input.l21Rebuilt.saveSha256,sourceHashes,
    historicMathSha256:input.inputs.find(x=>x.file==='math.js').sha256},
  scope:'真实P189 L21档；仅隔离VM第20关追加两种100%×2精魄；固定种子1复战；原岗木3石3粮5煤6铜3；仓库Lv5→17和大粮仓Lv1；实付骑兵T2研究与15人训练；在线tick单位秒',
  candidate:{wind_essence:{prob:1,count:2},iron_essence:{prob:1,count:2}},
  first,bossResult,bossSaveSha256:sha(bossSave),bossSave,
  steps,totalPaid,totalOnlineSeconds:totalSeconds,
  minFoodTickEnd:Number.isFinite(minimumFood)?minimumFood:null,
  minFoodAfterAction:minimumFoodAfterAction,zeroFoodTickEnds,
  block,final,finalSaveSha256:sha(finalSave),finalSave,
  saveReload:{boss:true,final:true},
  note:'开发侧条件方案；未改正式掉落。普通Boss复战掉落不是首通奖励，旧档不追发。'};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:report.batch,bossResult,totalOnlineSeconds:totalSeconds,
  minFoodTickEnd:report.minFoodTickEnd,
  minFoodAfterAction:minimumFoodAfterAction,zeroFoodTickEnds,totalPaid,block,
  final:{tick:final.tick,resources:final.resources,caps:final.caps,
    essence:final.essence,stable:final.stable,cavalryWind:final.cavalryWind}},null,2));
if(block)process.exitCode=1;
