'use strict';
// P173: continue four P171 paid L10 clears from their own serialized saves.
// The L11 immediate and replenished trials are independent reloads of each
// same L10 save. All training, ticks, formation and battle use live functions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const outputPath=path.join(root,'docs/codex/reports/data/p173-current-l11-handoff.json');
const seeds=[1,42],policyName='food-food',maxRecoverySeconds=3600;
const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P173找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P173的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
function reuseP171(){
  let source=fs.readFileSync(p171Path,'utf8');
  source=replaceOnce(source,'const profiles=[];',
    'return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,owned,fight};\nconst profiles=[];',
    'P171同源路线返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p171Path),{log(){},error:console.error},path.dirname(p171Path));
}
const {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,
  compact,owned,fight}=reuseP171();
const policy=workerPolicies.find(item=>item.name===policyName);
assert.ok(policy);
function scenarioState(run){
  return{checkpoint:checkpoint(run),compact:compact(run),
    formation:plain(run('JSON.parse(JSON.stringify(S.formation))')),
    pool:plain(run('({...S.pool})')),
    population:run('popCurrent()'),capacity:run('maxPop()'),
    selectedEnemy:run('S.selEnemy'),
    upkeepPerSecond:run('totalUpkeep()')};
}
function restore(save,expected=null){
  const e=environment({rts_save:save});
  assert.equal(e.run('loadSaveAndApply().status'),'ok');
  installBattleHarness(e.run);
  if(expected){
    assert.deepEqual(checkpoint(e.run),checkpoint(expected),'终档重载：资源和进度不一致');
    assert.deepEqual(snapshot(e.run),snapshot(expected),'终档重载：士兵和编队不一致');
  }
  return e.run;
}
function battleEssentials(row){
  return{stage:row.stage,won:row.won,round:row.round,callbacks:row.callbacks,
    before:row.before,beforeDeployed:row.beforeDeployed,after:row.after};
}
function continuousTrial(run,seed){
  const laterBattles=[];
  let active=run;
  for(let stage=12;stage<=16;stage++){
    const row=fight(active,seed,stage);
    const saved=active("localStorage.getItem('rts_save')");
    active=restore(saved,active);
    laterBattles.push({battle:battleEssentials(row),saveSha256:sha(saved)});
    if(!row.won)break;
  }
  return laterBattles;
}
function immediateTrial(l10Save,seed){
  const run=restore(l10Save);
  const before=scenarioState(run);
  const battle=fight(run,seed,11);
  const finalSave=run("localStorage.getItem('rts_save')");
  const reloaded=restore(finalSave,run);
  const reloadedDefeated=plain(reloaded('([...S.defeated])'));
  const laterBattles=battle.won?continuousTrial(reloaded,seed):[];
  return{before,battle:battleEssentials(battle),
    after:scenarioState(run),finalSaveSha256:sha(finalSave),
    reloadedDefeated,laterBattles};
}
function replenishedTrial(l10Save,seed){
  const run=restore(l10Save);
  const before=scenarioState(run),requested={},queued=[],pausedQueueSeconds={};
  const trainingDueByProduced={},produced={};
  let minFood=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const current=owned(run,type),existingQueue=run(`S.queue['${type}']?.count||0`);
    const missing=Math.max(0,target-current-existingQueue);
    requested[type]=missing;
    if(!missing)continue;
    const pre=scenarioState(run),result=plain(run(`train('${type}',${missing})`));
    assert.equal(result.ok,true,`${type}补兵排队失败`);
    assert.equal(result.qty,missing,`${type}补兵被队列截断`);
    const post=scenarioState(run);
    assert.deepEqual(post.compact.resources,pre.compact.resources,
      `${type}排队时不应提前扣费`);
    queued.push({type,requested:missing,result,before:pre.compact,after:post.compact});
    produced[type]=0;
  }
  function ready(){return Object.entries(targets).every(([type,target])=>owned(run,type)>=target)}
  let seconds=0;
  while(!ready()&&seconds<maxRecoverySeconds){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    const next=plain(run('S.queue'));
    minFood=Math.min(minFood,run('S.res.food'));
    for(const [type,q] of Object.entries(next)){
      if(q.count>0&&q.reason){
        const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1;
      }
      const count=(prior[type]?.count||0)-q.count;
      if(count<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`未知补兵队列${type}`);
      produced[type]=(produced[type]||0)+count;
      const cost=plain(run(`CFG.units['${type}'].cost`));
      for(const [rk,n] of Object.entries(cost))
        trainingDueByProduced[rk]=(trainingDueByProduced[rk]||0)+n*count;
    }
  }
  const recovery={seconds,ready:ready(),minFood,requested,produced,
    trainingDueByProduced,pausedQueueSeconds,queued,after:scenarioState(run)};
  if(!recovery.ready)return{before,recovery,battle:null,finalSaveSha256:null};
  for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`${type}实际产出与排队数量不一致`);
  const battle=fight(run,seed,11);
  const finalSave=run("localStorage.getItem('rts_save')");
  const reloaded=restore(finalSave,run);
  const reloadedDefeated=plain(reloaded('([...S.defeated])'));
  const laterBattles=battle.won?continuousTrial(reloaded,seed):[];
  return{before,recovery,battle:battleEssentials(battle),
    after:scenarioState(run),finalSaveSha256:sha(finalSave),
    reloadedDefeated,laterBattles};
}
const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const source=runBranch(seed,disableReward,policy);
  assert.equal(source.battles.length,5);
  assert.ok(source.battles.every(row=>row.won));
  const run=restore(source.checkpointSave);
  assert.deepEqual(snapshot(run),source.checkpoint,'L5检查点不匹配');
  const bridge=route(run,seed);
  assert.equal(bridge.block,null,'P171路线提前受阻');
  assert.equal(bridge.clearedL10,true,'P171路线未过L10');
  assert.ok(bridge.battles.length===5&&bridge.battles.every(b=>b.won));
  assert.equal(run('save().ok'),true,'L10终档未保存');
  const l10Save=run("localStorage.getItem('rts_save')");
  const l10Reload=restore(l10Save,run);
  const postL10=scenarioState(l10Reload);
  assert.equal(postL10.checkpoint.defeated.at(-1),10);
  const immediate=immediateTrial(l10Save,seed);
  const replenished=replenishedTrial(l10Save,seed);
  profiles.push({seed,branch:source.branch,
    sourceL5SaveSha256:source.checkpointSaveSha256,
    l10SaveSha256:sha(l10Save),
    l5ToL10OnlineSeconds:bridge.final.tick-bridge.initial.tick,
    l10Battle:battleEssentials(bridge.battles.at(-1)),postL10,
    immediate,replenished});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-current-l11-handoff-p173.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P173',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'P171 paid real L5→L10 route; save and reload each own L10 endpoint; fork two independent VM reloads for immediate L11 and actual training queue replenishment to 15/15/13, then fight L11; exploration continues each winning branch with no further ticks/training through L16 or first loss, reloading each result; training due computed from actual produced count times live unit cost, not independently isolated from per-tick resource net flow; no resource injection or player/UI changes',
  scope:{seeds,policyName,branches:['current-L3-plus-six','no-L3-reward'],
    maxRecoverySeconds,targets,noOffline:true,noGarrison:true},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P173',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,l5ToL10OnlineSeconds:p.l5ToL10OnlineSeconds,
  postL10:{tick:p.postL10.checkpoint.tick,population:p.postL10.population,
    capacity:p.postL10.capacity,resources:p.postL10.compact.resources,
    owned:p.postL10.compact.owned,formation:p.postL10.formation},
  immediate:{won:p.immediate.battle.won,round:p.immediate.battle.round,
    deployed:p.immediate.battle.beforeDeployed,afterOwned:p.immediate.battle.after.owned,
    laterBattles:p.immediate.laterBattles.map(x=>({stage:x.battle.stage,
      won:x.battle.won,round:x.battle.round,
      deployed:x.battle.beforeDeployed,afterOwned:x.battle.after.owned}))},
  replenished:{seconds:p.replenished.recovery.seconds,
    ready:p.replenished.recovery.ready,minFood:p.replenished.recovery.minFood,
    requested:p.replenished.recovery.requested,
    produced:p.replenished.recovery.produced,
    trainingDueByProduced:p.replenished.recovery.trainingDueByProduced,
    pausedQueueSeconds:p.replenished.recovery.pausedQueueSeconds,
    won:p.replenished.battle?.won,round:p.replenished.battle?.round,
    deployed:p.replenished.battle?.beforeDeployed,
    afterOwned:p.replenished.battle?.after.owned,
    laterBattles:p.replenished.laterBattles.map(x=>({stage:x.battle.stage,
      won:x.battle.won,round:x.battle.round,
      deployed:x.battle.beforeDeployed,afterOwned:x.battle.after.owned}))}})),rawData:outputPath},null,2));
