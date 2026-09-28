'use strict';
// P175: continue P173's paid, replenished L16 clears from their actual saves.
// Reuse prior probes in memory; all changes to game state use live game calls.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p173Path=path.join(__dirname,'probe-current-l11-handoff-p173.js');
const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const p173DataPath=path.join(root,'docs/codex/reports/data/p173-current-l11-handoff.json');
const outputPath=path.join(root,'docs/codex/reports/data/p175-current-l17-cavalry-bridge.json');
const seeds=[1,42],policyName='food-food',maxWaitSeconds=3600;
const oldTargets={bronze_guard:15,infantry_t1:15,archer_t1:13};
const cavalryTargets={bronze_guard:15,cavalry_t1:15,archer_t1:13};
function sha(x){return crypto.createHash('sha256').update(x).digest('hex')}
function plain(x){return JSON.parse(JSON.stringify(x))}
function replaceOnce(src,needle,replacement,label){
  const at=src.indexOf(needle);
  assert.notEqual(at,-1,`P175找不到${label}`);
  assert.equal(src.indexOf(needle,at+needle.length),-1,`P175的${label}不唯一`);
  return src.slice(0,at)+replacement+src.slice(at+needle.length);
}
function reuseP173(){
  let source=fs.readFileSync(p173Path,'utf8');
  source=replaceOnce(source,
    "return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,owned,fight};",
    "return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,owned,fight,place};",
    'P171动作返回点');
  source=replaceOnce(source,
    'const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};',
    'const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};\nlet __p175L16Save=null;',
    'L16终档捕获变量');
  source=replaceOnce(source,
    "const saved=active(\"localStorage.getItem('rts_save')\");\n    active=restore(saved,active);",
    "const saved=active(\"localStorage.getItem('rts_save')\");\n    if(stage===16&&row.won)__p175L16Save=saved;\n    active=restore(saved,active);",
    'L16真实胜利终档捕获点');
  source=replaceOnce(source,
    '  compact,owned,fight}=reuseP171();',
    '  compact,owned,fight,place}=reuseP171();',
    'P173动作解构点');
  source=replaceOnce(source,'\nconst profiles=[];\nfor(const seed of seeds)',
    '\nreturn {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,owned,fight,place,restore,replenishedTrial,getL16Save:()=>__p175L16Save,clearL16Save:()=>{__p175L16Save=null}};\nconst profiles=[];\nfor(const seed of seeds)',
    'P173同源终档返回点');
  // P173 loads P171 source on its own. Override its read only in this
  // in-memory evaluation so the source file in the shared tree is untouched.
  const nativeRead=fs.readFileSync.bind(fs);
  const scopedFs={...fs,readFileSync(file,...args){
    if(path.resolve(String(file))!==p171Path)return nativeRead(file,...args);
    let p171=nativeRead(file,...args);
    p171=replaceOnce(p171,
      'function fight(run,seed,stage){\n  assert.equal',
      'function fight(run,seed,stage,form=formArmy){\n  assert.equal',
      'P171可选编队函数');
    p171=replaceOnce(p171,'const formation=formArmy(run),before=compact(run);',
      'const formation=form(run),before=compact(run);','P171编队调用');
    p171=replaceOnce(p171,
      'const out={bronze_guard:0,infantry_t1:0,archer_t1:0};',
      'const out={bronze_guard:0,infantry_t1:0,archer_t1:0,cavalry_t1:0};',
      'P171骑兵实入场');
    return p171;
  }};
  const nativeRequire=createRequire(p173Path);
  function scopedRequire(id){return id==='node:fs'?scopedFs:nativeRequire(id)}
  return new Function('require','console','__dirname',source)(
    scopedRequire,{log(){},error:console.error},path.dirname(p173Path));
}
const api=reuseP173();
const {runBranch,workerPolicies,snapshot,installBattleHarness,route,
  checkpoint,compact,owned,fight,place,restore,replenishedTrial,
  getL16Save,clearL16Save}=api;
const policy=workerPolicies.find(x=>x.name===policyName);
assert.ok(policy);
const p173Data=JSON.parse(fs.readFileSync(p173DataPath,'utf8'));
assert.equal(p173Data.batch,'P173');
for(const item of p173Data.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
    `P173历史输入已变化：${item.file}`);
function state(run){
  return{checkpoint:checkpoint(run),compact:compact(run),
    population:run('popCurrent()'),capacity:run('maxPop()'),
    stable:plain(run("({...bldSt('stable')})")),
    upgradedCavalry:run('!!S.upgradedUnits.cavalry_t1'),
    cavalryOwned:owned(run,'cavalry_t1'),
    cavalryCap:run("unitCap('cavalry_t1')"),
    cavalryLock:run("trainLockReason('cavalry_t1')"),
    unitRoot:plain(run('CFG.unitUpgrades.cavalry.tree.cavalry_t1.unlock')),
    army:run('armyCount()'),upkeepPerSecond:run('totalUpkeep()')};
}
function sameState(a,b,label){
  assert.deepEqual(state(a),state(b),`${label}：存档重载不一致`);
  assert.deepEqual(snapshot(a),snapshot(b),`${label}：兵池或编队重载不一致`);
}
function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}存档写入失败`);
  const saved=run("localStorage.getItem('rts_save')");
  const restored=restore(saved,run);
  sameState(run,restored,label);
  return{run:restored,saveSha256:sha(saved),save:saved};
}
function buildSourceL16(seed,disableReward){
  const branch=runBranch(seed,disableReward,policy);
  assert.ok(branch.battles.length===5&&branch.battles.every(b=>b.won));
  let run=restore(branch.checkpointSave);
  assert.deepEqual(snapshot(run),branch.checkpoint);
  const bridge=route(run,seed);
  assert.equal(bridge.block,null);
  assert.equal(bridge.clearedL10,true);
  const l10=reload(run,'L10');
  clearL16Save();
  const p173=replenishedTrial(l10.save,seed);
  assert.equal(p173.recovery.ready,true);
  assert.equal(p173.battle.won,true);
  const l16Save=getL16Save();
  assert.ok(l16Save,'P173真实补兵线未获得L16胜利终档');
  assert.equal(p173.laterBattles.length,5);
  assert.ok(p173.laterBattles.every(x=>x.battle.won));
  const l16=restore(l16Save);
  assert.deepEqual(plain(l16('([...S.defeated])')),Array.from({length:16},(_,i)=>i+1));
  assert.deepEqual(compact(l16),p173.laterBattles.at(-1).battle.after,
    'P173 L16终档战后状态不一致');
  const previous=p173Data.profiles.find(x=>x.seed===seed&&x.branch===branch.branch);
  assert.ok(previous,'P173旧报告缺少该支');
  assert.deepEqual(compact(l16),previous.replenished.laterBattles.at(-1).battle.after,
    '当前重建L16与P173原始数据不一致');
  return{l16Save,source:{branch:branch.branch,l5SaveSha256:branch.checkpointSaveSha256,
    l10SaveSha256:l10.saveSha256,l16SaveSha256:sha(l16Save),
    l10ToL16RecoverySeconds:p173.recovery.seconds,
    postL16:state(l16),p173L16Battle:p173.laterBattles.at(-1).battle}};
}
function payDelta(before,after,cost,tech=0,merit=0,label='动作'){
  for(const [rk,n] of Object.entries(cost)){
    if(rk==='time')continue;
    assert.ok(Math.abs(before.checkpoint.resources[rk]-after.checkpoint.resources[rk]-n)<1e-7,
      `${label}/${rk}实际扣费不符`);
  }
  assert.equal(before.checkpoint.resources.tech-after.checkpoint.resources.tech,tech,
    `${label}知识扣费不符`);
  assert.equal(before.checkpoint.merit-after.checkpoint.merit,merit,
    `${label}战功扣费不符`);
}
function action(run,label,expression,cost=null,tech=0,merit=0){
  const before=state(run),result=plain(run(expression)),after=state(run);
  assert.equal(result?.ok,true,`${label}失败: ${JSON.stringify(result)}`);
  if(cost)payDelta(before,after,cost,tech,merit,label);
  return{label,expression,result,before,after};
}
function formCavalry(run){
  run("clrForm('expedition')");
  const max=run('regMax()');
  assert.equal(max,15);
  for(const [slot,type] of [[0,'bronze_guard'],[1,'cavalry_t1']]){
    const count=Math.min(max,run(`S.pool['${type}']||0`));
    if(count)place(run,'front',type,count,slot);
  }
  let archers=run('S.pool.archer_t1||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
    const n=Math.min(max,archers);place(run,row,'archer_t1',n,i);archers-=n;
  }
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function battleResult(row){return{stage:row.stage,won:row.won,round:row.round,
  callbacks:row.callbacks,before:row.before,beforeDeployed:row.beforeDeployed,
  formation:row.formation,after:row.after}}
function directTrial(save,seed){
  const run=restore(save),before=state(run);
  const battle=fight(run,seed,17);
  const final=reload(run,'直接L17');
  return{before,battle:battleResult(battle),after:state(final.run),
    finalSaveSha256:final.saveSha256};
}
function trainingTrial(save,seed,kind){
  const run=restore(save),before=state(run),actions=[];
  const targets=kind==='cavalry'?cavalryTargets:oldTargets;
  let minFood=run('S.res.food'),minFoodTickEnd=minFood,buildSeconds=0;
  if(kind==='cavalry'){
    const buildCost=plain(run("buildingInitialCost('stable')"));
    const stableGate={bossCount:run('bossDefeatedCount()'),
      cost:buildCost,resources:plain(run('({...S.res})')),
      initialState:plain(run("({...bldSt('stable')})"))};
    if(run("bldSt('stable').lv")===0){
      if(Object.entries(buildCost).some(([rk,n])=>rk!=='time'&&run(`S.res.${rk}`)<n))
        return{before,stableGate,block:{at:'stable-build',reason:'insufficient-resources'},actions};
      actions.push(action(run,'建造骑兵训练场',"buildAct('stable')",buildCost));
      const actualBuildTime=actions.at(-1).after.stable.timerEnd;
      stableGate.actualBuildTime=actualBuildTime;
      while(run('S.buildings.stable.state')!=='idle'&&buildSeconds<actualBuildTime+2){
        run('tick()');buildSeconds++;
        minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
      }
      assert.equal(run('S.buildings.stable.lv'),1,'骑兵训练场未正常竣工');
      assert.equal(buildSeconds,actualBuildTime,'骑兵训练场竣工秒数');
    }
    const ul=plain(run('CFG.unitUpgrades.cavalry.tree.cavalry_t1.unlock'));
    if(!Object.entries(ul.cost).every(([rk,n])=>run(`S.res.${rk}`)>=n)||
      run('S.res.tech')<ul.needTech||run('S.merit')<ul.needMerit)
      return{before,stableGate,buildSeconds,block:{at:'cavalry-research',
        reason:'insufficient-resources',requirement:ul,state:state(run)},actions};
    actions.push(action(run,'解锁侍从骑士',"unlockUnitRoot('cavalry_t1')",
      ul.cost,ul.needTech,ul.needMerit));
    assert.equal(run('S.upgradedUnits.cavalry_t1'),true);
    assert.equal(run("trainLockReason('cavalry_t1')"),'');
    assert.ok(run("unitCap('cavalry_t1')")>=15,
      '当前运行时骑兵训练上限不足15');
  }
  const requested={},produced={},due={},pausedQueueSeconds={};
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const n=Math.max(0,target-have-queued);requested[type]=n;
    if(n){actions.push(action(run,`排队${type}`,`train('${type}',${n})`,{}));produced[type]=0}
  }
  function ready(){return Object.entries(targets).every(([type,n])=>owned(run,type)>=n)}
  let seconds=0;
  while(!ready()&&seconds<maxWaitSeconds){
    const beforeQ=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const afterQ=plain(run('S.queue'));
    for(const [type,q] of Object.entries(afterQ)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(beforeQ[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`未知产出队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,c] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        due[rk]=(due[rk]||0)+made*c;
    }
  }
  const recovery={seconds,ready:ready(),buildSeconds,
    totalOnlineSeconds:buildSeconds+seconds,minFoodTickEnd,
    requested,produced,trainingDueByProduced:due,pausedQueueSeconds,
    after:state(run)};
  if(!recovery.ready)return{before,actions,recovery,battle:null,
    block:{at:'training',reason:'time-limit-or-resource-pause'}};
  for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`${type}实际产出数量不符`);
  const battle=fight(run,seed,17,kind==='cavalry'?formCavalry:undefined);
  const final=reload(run,`${kind} L17`);
  return{before,actions,recovery,battle:battleResult(battle),
    after:state(final.run),finalSaveSha256:final.saveSha256};
}
const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const built=buildSourceL16(seed,disableReward),save=built.l16Save;
  const enemy=plain(restore(save)('CFG.enemies[16]'));
  assert.equal(enemy.id,17);
  assert.ok(Object.hasOwn(enemy.units,'cavalry_t1'));
  const direct=directTrial(save,seed);
  const oldLine=trainingTrial(save,seed,'old-line');
  const cavalry=trainingTrial(save,seed,'cavalry');
  profiles.push({seed,branch:built.source.branch,source:built.source,enemy,
    direct,oldLine,cavalry});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-current-l11-handoff-p173.js',
  'docs/codex/reports/data/p173-current-l11-handoff.json',
  'tools/verify/probe-current-l17-cavalry-bridge-p175.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P175',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'P173 genuine paid replenished L16 win saved and reloaded; three independent branches per endpoint: immediate L17; real queue refill of bronze/infantry/ranger; real paid stable construction, cavalry T1 root research, queues and bronze/ranger/cavalry deployment; stage-fixed xorshift32 RNG; no resources or soldiers injected',
  scope:{seeds,policyName,branches:['current-L3-plus-six','no-L3-reward'],
    maxWaitSeconds,oldTargets,cavalryTargets,noOffline:true,noGarrison:true},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P175',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,postL16:{tick:p.source.postL16.compact.tick,
    resources:p.source.postL16.compact.resources,
    owned:p.source.postL16.compact.owned,cavalryOwned:p.source.postL16.cavalryOwned},
  direct:{won:p.direct.battle.won,round:p.direct.battle.round,
    deployed:p.direct.battle.beforeDeployed},
  oldLine:{block:p.oldLine.block||null,recovery:p.oldLine.recovery&&{
    seconds:p.oldLine.recovery.seconds,ready:p.oldLine.recovery.ready,
    minFoodTickEnd:p.oldLine.recovery.minFoodTickEnd,
    requested:p.oldLine.recovery.requested,produced:p.oldLine.recovery.produced},
    won:p.oldLine.battle?.won,round:p.oldLine.battle?.round,
    deployed:p.oldLine.battle?.beforeDeployed},
  cavalry:{block:p.cavalry.block||null,recovery:p.cavalry.recovery&&{
    totalOnlineSeconds:p.cavalry.recovery.totalOnlineSeconds,
    ready:p.cavalry.recovery.ready,minFoodTickEnd:p.cavalry.recovery.minFoodTickEnd,
    requested:p.cavalry.recovery.requested,produced:p.cavalry.recovery.produced},
    won:p.cavalry.battle?.won,round:p.cavalry.battle?.round,
    deployed:p.cavalry.battle?.beforeDeployed}})),rawData:outputPath},null,2));
