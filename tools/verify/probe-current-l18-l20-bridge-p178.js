'use strict';
// P178: resume the four paid P175 old-line L17 wins and replenish through L20.
// Earlier probes are reused in memory; player source and saves are untouched.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p175Path=path.join(__dirname,'probe-current-l17-cavalry-bridge-p175.js');
const p175DataPath=path.join(root,'docs/codex/reports/data/p175-current-l17-cavalry-bridge.json');
const outputPath=path.join(root,'docs/codex/reports/data/p178-current-l18-l20-bridge.json');
const priorData=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
const maxRecoverySeconds=7200;
const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};
const seeds=[1,42];
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const at=source.indexOf(needle);
  assert.notEqual(at,-1,`P178找不到${label}`);
  assert.equal(source.indexOf(needle,at+needle.length),-1,`P178的${label}不唯一`);
  return source.slice(0,at)+replacement+source.slice(at+needle.length);
}
function reuseP175(){
  let source=fs.readFileSync(p175Path,'utf8');
  source=replaceOnce(source,'for(const item of p173Data.inputs)\n  assert.equal',
    "for(const item of p173Data.inputs)if(item.file!=='levels.js')\n  assert.equal",
    '允许关卡名描述重命名时重建P173游戏状态');
  source=replaceOnce(source,
    'const final=reload(run,`${kind} L17`);\n  return{before,actions,recovery,battle:battleResult(battle),\n    after:state(final.run),finalSaveSha256:final.saveSha256};',
    'const final=reload(run,`${kind} L17`);\n  return{before,actions,recovery,battle:battleResult(battle),\n    after:state(final.run),finalSaveSha256:final.saveSha256,finalSave:final.save};',
    'L17实胜序列化终档');
  source=replaceOnce(source,'const profiles=[];\nfor(const seed of seeds)',
    'return {buildSourceL16,trainingTrial,restore,owned,fight,checkpoint,compact,state,snapshot};\nconst profiles=[];\nfor(const seed of seeds)',
    'P175动作返回点');
  return new Function('require','console','__dirname',source)(
    createRequire(p175Path),{log(){},error:console.error},path.dirname(p175Path));
}
const {buildSourceL16,trainingTrial,restore,owned,fight,checkpoint,
  compact,state,snapshot}=reuseP175();
const p175Data=JSON.parse(fs.readFileSync(p175DataPath,'utf8'));
assert.equal(p175Data.batch,'P175');
for(const input of p175Data.inputs)
  if(input.file!=='levels.js')
    assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
      `P175历史输入已变化：${input.file}`);

function reload(run,label){
  assert.equal(run('save().ok'),true,`${label}保存失败`);
  const saved=run("localStorage.getItem('rts_save')");
  const next=restore(saved,run);
  assert.deepEqual(state(next),state(run),`${label}状态重载不一致`);
  assert.deepEqual(snapshot(next),snapshot(run),`${label}编队重载不一致`);
  return{run:next,save:saved,saveSha256:sha(saved)};
}
function recovery(run,stage){
  const before=state(run),requested={},produced={},dueByProduced={},pausedQueueSeconds={};
  let minFoodTickEnd=run('S.res.food');
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue['${type}']?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;
    if(!need)continue;
    const pre=plain(run('({...S.res})'));
    const result=plain(run(`train('${type}',${need})`));
    assert.equal(result?.ok,true,`L${stage} ${type}补兵排队失败：${JSON.stringify(result)}`);
    assert.equal(result.qty,need,`L${stage} ${type}排队数被截断`);
    assert.deepEqual(plain(run('({...S.res})')),pre,`L${stage}排队不应提前扣资源`);
    produced[type]=0;
  }
  function ready(){return Object.entries(targets).every(([type,n])=>owned(run,type)>=n)}
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
      assert.ok(Object.hasOwn(targets,type),`L${stage}未知产出队列${type}`);
      produced[type]=(produced[type]||0)+made;
      for(const [rk,c] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        dueByProduced[rk]=(dueByProduced[rk]||0)+made*c;
    }
  }
  const result={before,seconds,ready:ready(),requested,produced,
    dueByProduced,pausedQueueSeconds,minFoodTickEnd,after:state(run)};
  if(result.ready)for(const [type,n] of Object.entries(requested))
    assert.equal(produced[type]||0,n,`L${stage} ${type}实产数量与请求不一致`);
  return result;
}
function enemy(run,stage){
  const config=plain(run(`CFG.enemies[${stage-1}]`));
  assert.equal(config.id,stage);
  const units=Object.entries(config.units).flatMap(([type,counts])=>
    counts.map(count=>({type,count})));
  return{id:stage,name:config.name,boss:!!config.boss,
    groups:units.length,totalPeople:units.reduce((s,x)=>s+x.count,0),
    composition:config.units,bossMult:config.bossMult||null};
}
function runProfile(seed,disableReward){
  const source=buildSourceL16(seed,disableReward);
  const l17=trainingTrial(source.l16Save,seed,'old-line');
  assert.equal(l17.block,undefined,`L17原兵线受阻：${JSON.stringify(l17.block)}`);
  assert.equal(l17.battle.won,true,'L17原兵线没有胜利');
  assert.ok(l17.finalSave);
  const baseline=p175Data.profiles.find(p=>p.seed===seed&&p.branch===source.source.branch);
  assert.ok(baseline,'P175缺少同源分支');
  const currentL17=plain(restore(source.l16Save)('CFG.enemies[16]'));
  const previousL17=plain(baseline.enemy);
  for(const row of [currentL17,previousL17]){delete row.name;delete row.desc}
  assert.deepEqual(currentL17,previousL17,'P175同源L17敌阵或奖励已变化');
  // save() stamps Date.now(); a later rerun cannot reproduce the raw save hash.
  // Compare the gameplay state and battle ledger instead.
  assert.deepEqual(l17.after,baseline.oldLine.after,
    'P175同源L17战后重载状态不一致');
  assert.deepEqual(l17.battle.after,baseline.oldLine.battle.after,
    'P175同源L17战后状态不一致');
  let run=restore(l17.finalSave),minFoodTickEnd=run('S.res.food');
  assert.deepEqual(plain(run('([...S.defeated])')),Array.from({length:17},(_,i)=>i+1));
  const stageConfigs=[18,19,20].map(stage=>enemy(run,stage));
  const stages=[];
  for(let stage=18;stage<=20;stage++){
    const stageEnemy=enemy(run,stage);
    const refill=recovery(run,stage);
    minFoodTickEnd=Math.min(minFoodTickEnd,refill.minFoodTickEnd);
    if(!refill.ready){stages.push({stage,enemy:stageEnemy,recovery:refill,
      battle:null,block:'training-time-or-resource'});break}
    const beforeSave=reload(run,`L${stage}战前`);
    run=beforeSave.run;
    const battle=fight(run,seed,stage);
    const afterSave=reload(run,`L${stage}战后`);
    stages.push({stage,enemy:stageEnemy,recovery:refill,
      beforeSaveSha256:beforeSave.saveSha256,
      battle:{stage:battle.stage,won:battle.won,round:battle.round,
        callbacks:battle.callbacks,before:battle.before,
        beforeDeployed:battle.beforeDeployed,formation:battle.formation,
        after:battle.after},afterSaveSha256:afterSave.saveSha256,
      postBattle:state(afterSave.run)});
    run=afterSave.run;
    if(!battle.won)break;
  }
  return{seed,branch:source.source.branch,
    l16SaveSha256:sha(source.l16Save),l17SaveSha256:sha(l17.finalSave),
    l17Battle:l17.battle,postL17:state(restore(l17.finalSave)),
    stageConfigs,stages,minFoodTickEnd,final:state(run)};
}
const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true])
  profiles.push(runProfile(seed,disableReward));
function numericTrace(profile){
  return{seed:profile.seed,branch:profile.branch,
    postL17:profile.postL17.compact,
    stages:profile.stages.map(s=>({stage:s.stage,
      enemy:{groups:s.enemy.groups,totalPeople:s.enemy.totalPeople,
        composition:s.enemy.composition,bossMult:s.enemy.bossMult},
      recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
        requested:s.recovery.requested,produced:s.recovery.produced,
        dueByProduced:s.recovery.dueByProduced,
        minFoodTickEnd:s.recovery.minFoodTickEnd},
      battle:s.battle&&{won:s.battle.won,round:s.battle.round,
        beforeDeployed:s.battle.beforeDeployed,after:s.battle.after}})),
    minFoodTickEnd:profile.minFoodTickEnd,final:profile.final.compact};
}
if(priorData){
  assert.equal(priorData.batch,'P178');
  assert.deepEqual(profiles.map(numericTrace),priorData.profiles.map(numericTrace),
    '关卡可见名修改前后P178数值轨迹不一致');
  const withoutName=rows=>rows.map(({name,...data})=>data);
  assert.deepEqual(withoutName(profiles[0].stageConfigs),withoutName(priorData.stageConfigs),
    '关卡可见名修改前后L18-L20敌阵配置不一致');
}
const staticRun=environment().run;
staticRun("S.formation.front=[{type:'infantry',count:10,id:1}]");
const staticEnemyInit=[18,19,20].map(stage=>{
  const panel=plain(staticRun(`S.selEnemy=${stage-1};S.battleEncounter=null;B.isTraining=false;initBattleState();
    ({groups:B.enemyUnits.length,totalHp:B.enemyUnits.reduce((s,u)=>s+u.hp,0),
      hpWeightedAttack:B.enemyUnits.reduce((s,u)=>s+u.atk*u.hp,0),maxRound:B.maxRound})`));
  assert.equal(panel.totalHp,profiles[0].stageConfigs.find(e=>e.id===stage).totalPeople);
  return{stage,...panel};
});
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-current-l11-handoff-p173.js',
  'docs/codex/reports/data/p173-current-l11-handoff.json',
  'tools/verify/probe-current-l17-cavalry-bridge-p175.js',
  'docs/codex/reports/data/p175-current-l17-cavalry-bridge.json',
  'tools/verify/probe-current-l18-l20-bridge-p178.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P178',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),
  method:'Rebuild four P175 paid L17 old-line wins from P173/P171 real checkpoints; compare gameplay state against P175 and record the newly timestamped L17 save hash; after each stage use live training queues and per-second tick to refill to 15 bronze/15 infantry T1/13 archer T1, fight with same stage-seeded xorshift32 RNG, save and reload before/after L18-L20; no resource or soldier injection, no offline, no player/UI changes',
  scope:{seeds,branches:['current-L3-plus-six','no-L3-reward'],
    maxRecoverySeconds,targets,noOffline:true,noGarrison:true},
  stageConfigs:profiles[0].stageConfigs,staticEnemyInit,profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P178',profiles:profiles.map(p=>({seed:p.seed,
  branch:p.branch,l17SaveSha256:p.l17SaveSha256,
  stages:p.stages.map(s=>({stage:s.stage,enemy:s.enemy,
    recovery:{seconds:s.recovery.seconds,ready:s.recovery.ready,
      requested:s.recovery.requested,produced:s.recovery.produced,
      minFoodTickEnd:s.recovery.minFoodTickEnd,
      pausedQueueSeconds:s.recovery.pausedQueueSeconds},
    block:s.block||null,won:s.battle?.won,round:s.battle?.round,
    deployed:s.battle?.beforeDeployed,afterOwned:s.battle?.after.owned})),
  final:{tick:p.final.compact.tick,resources:p.final.compact.resources,
    population:p.final.population,capacity:p.final.capacity},
  minFoodTickEnd:p.minFoodTickEnd})),rawData:outputPath},null,2));
