'use strict';
// Paired formation sensitivity on the same actual P167 battle route. Only
// P167's stage 6+ formArmy call is instrumented in memory; player code stays
// unchanged, and every placement still uses the live expedition form actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p167Path=path.join(__dirname,'probe-current-first-clear-campaign-p167.js');
const outputPath=path.join(root,'docs/codex/reports/data/p169-early-formation-bridge.json');
const seeds=[1,2,3,42,12345];
const policyNames=['wood-food','food-food'];
const modes=['bronze-first','mixed-bronze-infantry'];
const rewardBranches=[{name:'current-L3-plus-six',disableReward:false},
  {name:'no-L3-reward',disableReward:true}];
let activeMode=modes[0];
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  assert.notEqual(first,-1,`P169找不到${label}`);
  assert.equal(source.indexOf(needle,first+needle.length),-1,`P169的${label}不唯一`);
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}
function place(run,row,type,count,index){
  if(count<=0)return;
  assert.ok(run(`rowSlots('${row}')`)>index,`${row}[${index}]未开放`);
  assert.ok(run(`S.pool['${type}']||0`)>=count,`${type}余量不足`);
  run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),
    true,`${row}[${index}]真实编入失败`);
}
function mixedFormArmy(run){
  run("clrForm('expedition')");
  const max=run('regMax()');
  const slots=run("rowSlots('front')");
  assert.ok(slots>=2,'混编只允许在第5关已通关后');
  let bronze=run('S.pool.bronze_guard||0');
  let infantry=run('S.pool.infantry||0');
  let frontIndex=0;
  if(bronze>0){
    const count=Math.min(max,bronze);
    place(run,'front','bronze_guard',count,frontIndex++);bronze-=count;
  }
  if(infantry>0&&frontIndex<slots){
    const count=Math.min(max,infantry);
    place(run,'front','infantry',count,frontIndex++);infantry-=count;
  }
  // If one type is exhausted, use the second slot for available front troops.
  while(frontIndex<slots&&(bronze>0||infantry>0)){
    const type=bronze>0?'bronze_guard':'infantry';
    const count=Math.min(max,type==='bronze_guard'?bronze:infantry);
    place(run,'front',type,count,frontIndex++);
    if(type==='bronze_guard')bronze-=count;else infantry-=count;
  }
  let archers=run('S.pool.archer||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
    const count=Math.min(max,archers);
    place(run,row,'archer',count,i);archers-=count;
  }
}
function reuseP167(){
  let source=fs.readFileSync(p167Path,'utf8');
  source=replaceOnce(source,
    '  formArmy(run);\n  const before=snapshot(run);',
    "  if(stage>=6&&formationMode()==='mixed-bronze-infantry') mixedFormArmy(run); else formArmy(run);\n  const before=snapshot(run);",
    '真实战斗前编队调用');
  source=replaceOnce(source,
    'const profiles=workerPolicies.flatMap',
    'return {runBranch,workerPolicies,seeds,prepared,snapshot};\nconst profiles=workerPolicies.flatMap',
    'P167同源路线返回点');
  return new Function('require','console','__dirname','formationMode','mixedFormArmy',source)(
    createRequire(p167Path),{log(){},error:console.error},path.dirname(p167Path),
    ()=>activeMode,mixedFormArmy);
}
const {runBranch,workerPolicies,prepared}=reuseP167();
const policies=policyNames.map(name=>{
  const policy=workerPolicies.find(item=>item.name===name);
  assert.ok(policy,`缺少${name}岗位策略`);
  return policy;
});
function essentials(row){
  return{stage:row.stage,enemy:row.enemy,won:row.won,round:row.round,
    tick:row.before.tick,population:row.before.population,
    beforeArmy:row.beforeArmy,beforeDeployed:row.beforeDeployed,
    afterArmy:row.afterArmy,afterDeployed:row.afterDeployed,
    casualties:row.casualties,
    resourcesBefore:Object.fromEntries(['food','wood','stone','coin','deed']
      .map(key=>[key,row.before.resources[key]])),
    resourcesAfter:Object.fromEntries(['food','wood','stone','coin','deed']
      .map(key=>[key,row.after.resources[key]]))};
}
function compact(branch,mode){
  return{mode,branch:branch.branch,wins:branch.wins,firstLoss:branch.firstLoss,
    attemptedL10:branch.battles.some(row=>row.stage===10),
    clearedL10:branch.final.defeated.includes(10),
    finalTick:branch.final.tick,finalPopulation:branch.final.population,
    finalCapacity:branch.final.capacity,minFood:branch.minFood,
    finalSaveSha256:branch.finalSaveSha256,
    battles:branch.battles.map(essentials)};
}
const profiles=[];
for(const policy of policies)for(const seed of seeds)for(const reward of rewardBranches){
  const branches=[];
  for(const mode of modes){
    activeMode=mode;
    const branch=runBranch(seed,reward.disableReward,policy);
    assert.equal(branch.branch,reward.name);
    assert.equal(branch.final.population,20);
    assert.equal(branch.final.capacity,20);
    branches.push(branch);
  }
  assert.deepEqual(branches[0].start,branches[1].start,'A/B起始状态不同');
  assert.deepEqual(branches[0].battles.filter(row=>row.stage<=5).map(essentials),
    branches[1].battles.filter(row=>row.stage<=5).map(essentials),
    '第6关前A/B已在胜负、编队或资源上分叉');
  const baselineL6=branches[0].battles.find(row=>row.stage===6);
  const mixedL6=branches[1].battles.find(row=>row.stage===6);
  assert.ok(baselineL6&&mixedL6,'编队对照未进入第6关');
  assert.equal(baselineL6.beforeDeployed.infantry,0,'原策略已投入步兵');
  assert.equal(mixedL6.beforeDeployed.infantry,10,'混编未投入完整步兵团');
  assert.equal(mixedL6.beforeDeployed.bronze_guard,10,'混编未投入完整刀盾团');
  profiles.push({workerPolicy:policy.name,seed,rewardBranch:reward.name,
    branches:branches.map((branch,i)=>compact(branch,modes[i]))});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-early-formation-bridge-p169.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0,`读取HEAD失败：${head.stderr||''}`);
const artifact={batch:'P169',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),sourceSaveSha256:sha(prepared.sourceSave),
  battleStartSaveSha256:sha(prepared.battleSave),
  method:'P167 same P101/P102 18-person source save, actual L1 onward fight/queue/market/tick and fixed seed per stage; only P167 stage-6+ formation call instrumented in memory; both formations use real clrForm/openFormModal/confirmForm actions; stop at first loss; no offline, garrison, extra deeds, resource injection or player-code changes',
  comparison:'bronze-first deploys bronze guards into front slots before infantry; mixed deploys at most one bronze regiment then one infantry regiment (or available type if exhausted), keeping archer placement unchanged',
  policy:{seeds,policyNames,modes,rewardBranches,waitAfterVictory:600,
    stage1To2Wait:10,stage2To3Wait:10,stage3PlusWait:610,
    battleCallbackTime:'excluded from online tick seconds'},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P169',sourceHead:artifact.sourceHead,
  profileCount:profiles.length,
  pairs:profiles.map(p=>({policy:p.workerPolicy,seed:p.seed,reward:p.rewardBranch,
    arms:p.branches.map(b=>({mode:b.mode,wins:b.wins,firstLoss:b.firstLoss,
      attemptedL10:b.attemptedL10,clearedL10:b.clearedL10,
      firstComparedStage:b.battles.find(row=>row.stage>=6)?.stage||null}))})),
  rawData:outputPath},null,2));
