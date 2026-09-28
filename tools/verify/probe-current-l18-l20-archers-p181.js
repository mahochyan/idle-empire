'use strict';
// P181: the same paid L17 old-line wins, with a second archer regiment.
// All player actions use the current game functions in isolated saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p175Path=path.join(__dirname,'probe-current-l17-cavalry-bridge-p175.js');
const p178DataPath=path.join(root,'docs/codex/reports/data/p178-current-l18-l20-bridge.json');
const outputPath=path.join(root,'docs/codex/reports/data/p181-current-l18-l20-archers.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const p178Data=JSON.parse(fs.readFileSync(p178DataPath,'utf8'));
const maxRecoverySeconds=7200;
const seeds=[1,42],archerTargets=[30,36];
const frontTargets={bronze_guard:15,infantry_t1:15};
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P181找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P181的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
function reuseP175(){
  let source=fs.readFileSync(p175Path,'utf8');
  source=replaceOnce(source,'for(const item of p173Data.inputs)\n  assert.equal',
    "for(const item of p173Data.inputs)if(item.file!=='levels.js')\n  assert.equal",
    '允许关卡纯可见文案变动');
  source=replaceOnce(source,
    'const final=reload(run,`${kind} L17`);\n  return{before,actions,recovery,battle:battleResult(battle),\n    after:state(final.run),finalSaveSha256:final.saveSha256};',
    'const final=reload(run,`${kind} L17`);\n  return{before,actions,recovery,battle:battleResult(battle),\n    after:state(final.run),finalSaveSha256:final.saveSha256,finalSave:final.save};',
    'L17实胜序列化终档');
  source=replaceOnce(source,'const profiles=[];\nfor(const seed of seeds)',
    'return {buildSourceL16,trainingTrial,restore,owned,fight,place,checkpoint,compact,state,snapshot};\nconst profiles=[];\nfor(const seed of seeds)',
    'P175动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p175Path),{log(){},error:console.error},path.dirname(p175Path));
}
assert.equal(p178Data.batch,'P178');
for(const input of p178Data.inputs)if(input.file!=='levels.js')
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `P178历史输入已变化：${input.file}`);
const {buildSourceL16,trainingTrial,restore,owned,fight,place,
  state,snapshot}=reuseP175();

function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}保存失败`);
  const saved=run("localStorage.getItem('rts_save')");
  const next=restore(saved,run);
  assert.deepEqual(state(next),state(run),`${label}状态重载不一致`);
  assert.deepEqual(snapshot(next),snapshot(run),`${label}编队重载不一致`);
  return{run:next,save:saved,saveSha256:sha(saved)};
}
function enemy(run,stage){
  const config=plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(config.id,stage);
  const groups=Object.values(config.units).reduce((n,counts)=>n+counts.length,0);
  const totalPeople=Object.values(config.units).flat().reduce((n,count)=>n+count,0);
  return{id:stage,name:config.name,boss:!!config.boss,
    groups,totalPeople,composition:config.units,bossMult:config.bossMult||null};
}
function verifyEnemyConfigs(run){
  const current=[17,18,19,20].map(stage=>enemy(run,stage));
  const historicL17=p178Data.profiles[0].l17Battle;
  assert.equal(current[0].totalPeople,63);
  assert.equal(historicL17.stage,17);
  for(let i=1;i<current.length;i++){
    const {name:unusedCurrent,...numeric}=current[i];
    const {name:unusedHistoric,...baseline}=p178Data.stageConfigs[i-1];
    assert.deepEqual(numeric,baseline,`P178同源L${current[i].id}敌阵已变化`);
  }
  return current.slice(1);
}
function recovery(run,stage,targets){
  const before=state(run),requested={},produced={},dueByProduced={},pausedQueueSeconds={};
  let minFoodTickEnd=run('S.res.food');
  // Observe the real payment function, then verify each produced soldier had a
  // matching debit. The wrapper lives only in this isolated VM, not game code.
  run(`globalThis.__p181PaymentSummary={};
    globalThis.__p181OriginalPay=payTrainingCost;
    payTrainingCost=function(cost,n){
      const type=Object.keys(CFG.units).find(key=>CFG.units[key].cost===cost);
      if(!type)throw Error('P181未知训练成本对象');
      const before=Object.fromEntries(Object.keys(cost).map(key=>[key,S.res[key]]));
      __p181OriginalPay(cost,n);
      const entry=__p181PaymentSummary[type]||{units:0,spent:{}};
      entry.units+=n;
      for(const [key,amount] of Object.entries(cost)){
        const actual=before[key]-S.res[key];
        if(Math.abs(actual-amount*n)>1e-7)throw Error('P181实际训练扣费不符 '+type+'/'+key);
        entry.spent[key]=(entry.spent[key]||0)+actual;
      }
      __p181PaymentSummary[type]=entry;
    };`);
  for(const [type,target] of Object.entries(targets)){
    assert.ok(run(`unitCap('${type}')`)>=target,`L${stage} ${type}持兵上限不足`);
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'',`L${stage} ${type}训练锁未开`);
    const pre=plain(run('({...S.res})'));
    const result=plain(run(`train('${type}',${need})`));
    assert.equal(result?.ok,true,`L${stage} ${type}排队失败：${JSON.stringify(result)}`);
    assert.equal(result.qty,need,`L${stage} ${type}队列被截断`);
    assert.deepEqual(plain(run('({...S.res})')),pre,`L${stage}排队提前扣资源`);
    produced[type]=0;
  }
  const ready=()=>Object.entries(targets).every(([type,n])=>owned(run,type)>=n);
  let seconds=0;
  while(!ready()&&seconds<maxRecoverySeconds){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made<=0)continue;
      assert.ok(Object.hasOwn(targets,type),`L${stage}未知队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,cost] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        dueByProduced[rk]=(dueByProduced[rk]||0)+made*cost;
    }
  }
  const paymentSummary=plain(run('({...__p181PaymentSummary})'));
  const paidByActual=Object.entries(paymentSummary).flatMap(([,row])=>
    Object.entries(row.spent)).reduce((acc,[key,amount])=>{
      acc[key]=(acc[key]||0)+amount;return acc;
    },{});
  for(const [type,count] of Object.entries(produced))
    assert.equal(paymentSummary[type]?.units||0,count,`L${stage} ${type}产出与实际扣费次数不符`);
  for(const [key,amount] of Object.entries(dueByProduced))
    assert.ok(Math.abs((paidByActual[key]||0)-amount)<1e-7,
      `L${stage} ${key}实际扣费与产出账不符`);
  const result={before,seconds,ready:ready(),requested,produced,
    dueByProduced,paymentSummary,paidByActual,pausedQueueSeconds,
    minFoodTickEnd,after:state(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type}实产数不符`);
  return result;
}
function formArchers(run,archerTarget){
  run("clrForm('expedition')");
  const max=run('regMax()');
  assert.equal(max,15);
  assert.equal(run("rowSlots('front')"),2);
  assert.equal(run("rowSlots('back')"),2);
  for(const [slot,type] of [[0,'bronze_guard'],[1,'infantry_t1']])
    place(run,'front',type,Math.min(max,run(`S.pool['${type}']||0`)),slot);
  let remaining=archerTarget;
  for(const row of ['back','mid'])for(let slot=0;slot<run(`rowSlots('${row}')`)&&remaining>0;slot++){
    const count=Math.min(max,remaining);
    place(run,row,'archer_t1',count,slot);
    remaining-=count;
  }
  assert.equal(remaining,0,'游侠阵位不足');
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function runVariant(l17Save,seed,branch,archerTarget,stageConfigs){
  const targets={...frontTargets,archer_t1:archerTarget};
  let run=restore(l17Save),minFoodTickEnd=run('S.res.food');
  const sourceState=state(run),stages=[];
  assert.deepEqual(plain(run('([...S.defeated])')),Array.from({length:17},(_,i)=>i+1));
  assert.equal(run("unitCap('archer_t1')"),36);
  for(let stage=18;stage<=20;stage++){
    const stageEnemy=enemy(run,stage);
    const refill=recovery(run,stage,targets);
    minFoodTickEnd=Math.min(minFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){stages.push({stage,enemy:stageEnemy,recovery:refill,
      battle:null,block:'training-time-or-resource'});break}
    const beforeSave=reload(run,`游侠${archerTarget} L${stage}战前`);
    run=beforeSave.run;
    const nominalReward=plain(run(`CFG.enemies[${stage-1}].reward`));
    const essenceBefore=plain(run('({...S.essence})'));
    const battle=fight(run,seed,stage,r=>formArchers(r,archerTarget));
    for(const [type,target] of Object.entries(targets))
      assert.equal(battle.beforeDeployed[type],target,`L${stage} ${type}实入场不符`);
    assert.equal(battle.beforeDeployed.cavalry_t1,0,'游侠线误编骑兵');
    const lossByType=Object.fromEntries(Object.entries(targets).map(([type,target])=>
      [type,target-owned(run,type)]));
    for(const [type,loss] of Object.entries(lossByType))
      assert.ok(loss>=0&&loss<=targets[type],`L${stage} ${type}战损异常`);
    const creditedReward=Object.fromEntries(Object.keys(nominalReward).map(key=>
      [key,battle.after.resources[key]-battle.before.resources[key]]));
    const essenceAfter=plain(run('({...S.essence})'));
    const essenceDrops=Object.fromEntries(Array.from(new Set([
      ...Object.keys(essenceBefore),...Object.keys(essenceAfter)])).map(key=>
      [key,(essenceAfter[key]||0)-(essenceBefore[key]||0)]).filter(([,n])=>n>0));
    const afterSave=reload(run,`游侠${archerTarget} L${stage}战后`);
    if(stage===19&&battle.won){
      assert.equal(sha(afterSave.save),afterSave.saveSha256,'L19续档SHA不一致');
      assert.deepEqual(state(restore(afterSave.save)),state(afterSave.run),
        'L19续档重载状态不一致');
    }
    stages.push({stage,enemy:stageEnemy,recovery:refill,
      beforeSaveSha256:beforeSave.saveSha256,
      battle:{stage:battle.stage,won:battle.won,round:battle.round,
        callbacks:battle.callbacks,before:battle.before,
        beforeDeployed:battle.beforeDeployed,formation:battle.formation,
        after:battle.after,lossByType,nominalReward,creditedReward,
        meritGain:battle.after.merit-battle.before.merit,essenceDrops},
      afterSaveSha256:afterSave.saveSha256,
      ...(stage===19&&battle.won?{
        l19ContinuationSave:afterSave.save,
        l19ContinuationSaveSha256:afterSave.saveSha256,
        l19ContinuationState:state(afterSave.run)}:{}),
      postBattle:state(afterSave.run)});
    run=afterSave.run;
    if(!battle.won)break;
  }
  return{seed,branch,archerTarget,sourceL17:sourceState,
    sourceL17SaveSha256:sha(l17Save),stageConfigs,stages,minFoodTickEnd,final:state(run)};
}
const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const source=buildSourceL16(seed,disableReward);
  const l17=trainingTrial(source.l16Save,seed,'old-line');
  assert.equal(l17.block,undefined,`L17原兵线受阻：${JSON.stringify(l17.block)}`);
  assert.equal(l17.battle.won,true,'L17原兵线未胜');
  assert.ok(l17.finalSave);
  const baseline=p178Data.profiles.find(p=>p.seed===seed&&p.branch===source.source.branch);
  assert.ok(baseline,'P178缺少同源分支');
  assert.deepEqual(l17.after,baseline.postL17,'P178同源L17终档已变化');
  const run=restore(l17.finalSave);
  const stageConfigs=verifyEnemyConfigs(run);
  for(const archerTarget of archerTargets)
    profiles.push(runVariant(l17.finalSave,seed,source.source.branch,archerTarget,stageConfigs));
}
function numericTrace(profile){
  return{seed:profile.seed,branch:profile.branch,archerTarget:profile.archerTarget,
    sourceL17:profile.sourceL17.compact,
    stages:profile.stages.map(s=>({stage:s.stage,
      enemy:{groups:s.enemy.groups,totalPeople:s.enemy.totalPeople,
        composition:s.enemy.composition,bossMult:s.enemy.bossMult},
      recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
        requested:s.recovery.requested,produced:s.recovery.produced,
        dueByProduced:s.recovery.dueByProduced,
        pausedQueueSeconds:s.recovery.pausedQueueSeconds,
        minFoodTickEnd:s.recovery.minFoodTickEnd},
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        beforeDeployed:s.battle.beforeDeployed,after:s.battle.after,
        lossByType:s.battle.lossByType}})),
    minFoodTickEnd:profile.minFoodTickEnd,final:profile.final.compact};
}
if(priorData){
  assert.equal(priorData.batch,'P181');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    'P181同源复跑数值轨迹不一致');
}
const inputs=[...p178Data.inputs.map(row=>row.file),p178DataPath.replace(root+path.sep,'').replaceAll('\\','/'),
  'tools/verify/probe-current-l18-l20-archers-p181.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P181',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'Rebuild four P178 old-line paid L17 wins from genuine P173/P171 checkpoints; from each identical serialized L17 save independently train 15 bronze/15 infantry T1/30 or 36 archer T1 using live queues and per-second tick, deploy with live formation actions to front 15+15 and back 15+15 (36 has 6 more mid), fight L18-L20 with stage-seeded xorshift32 RNG, save and reload before and after each battle; no resource or soldier injection, no offline, no garrison, no player/UI changes',
  scope:{seeds,branches:['current-L3-plus-six','no-L3-reward'],archerTargets,
    maxRecoverySeconds,frontTargets,noOffline:true,noGarrison:true},
  stageConfigs:profiles[0].stageConfigs,profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P181',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,archerTarget:p.archerTarget,
  stages:p.stages.map(s=>({stage:s.stage,enemyPeople:s.enemy.totalPeople,
    recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
      requested:s.recovery.requested,produced:s.recovery.produced,
      dueByProduced:s.recovery.dueByProduced,
      minFoodTickEnd:s.recovery.minFoodTickEnd,
      pausedQueueSeconds:s.recovery.pausedQueueSeconds},
    block:s.block||null,won:s.battle?.won,round:s.battle?.round,
    deployed:s.battle?.beforeDeployed,lossByType:s.battle?.lossByType,
    creditedReward:s.battle?.creditedReward})),
  firstBlock:p.stages.find(s=>s.block||s.battle&&!s.battle.won)?.stage||null,
  minFoodTickEnd:p.minFoodTickEnd})),rawData:outputPath},null,2));
