'use strict';
// P172: the exact P171 paid route, paired with one formation-only change.
// The alternate formation still uses real modal actions; no saved state or
// troop count is injected into the VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const outputPath=path.join(root,'docs/codex/reports/data/p172-regiment-deployment-causal.json');
const seeds=[1,42],policyName='food-food';
const modes=['full-15','capped-10'];
let activeMode=modes[0],placeAction=null;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P172找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P172的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
function alternateFormation(run){
  assert.ok(placeAction);
  run("clrForm('expedition')");
  assert.equal(run('regMax()'),15,'两个对照必须共享营帐Lv2');
  const frontLimit=activeMode==='full-15'?15:10;
  for(const [index,type] of [[0,'bronze_guard'],[1,'infantry_t1']]){
    const count=Math.min(frontLimit,run(`S.pool['${type}']||0`));
    if(count)placeAction(run,'front',type,count,index);
  }
  let archers=run('S.pool.archer_t1||0');
  for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
    const n=Math.min(run('regMax()'),archers);
    placeAction(run,row,'archer_t1',n,i);archers-=n;
  }
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function reuseP171(){
  let source=fs.readFileSync(p171Path,'utf8');
  source=replaceOnce(source,'const formation=formArmy(run),before=compact(run);',
    'const formation=alternateFormation(run),before=compact(run);',
    'P171战前唯一编队调用');
  source=replaceOnce(source,'const profiles=[];',
    'return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,place};\nconst profiles=[];',
    'P171同源路线返回点');
  return new Function('require','console','__dirname','alternateFormation',source)(
    createRequire(p171Path),{log(){},error:console.error},path.dirname(p171Path),
    alternateFormation);
}
const {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,place}=reuseP171();
placeAction=place;
const policy=workerPolicies.find(item=>item.name===policyName);
assert.ok(policy);
function battleEssentials(row){
  return{stage:row.stage,won:row.won,round:row.round,
    before:row.before,beforeDeployed:row.beforeDeployed,
    after:row.after};
}
function compactTrial(mode,result,saved){
  return{mode,firstBattleTick:result.firstBattleTick,
    paidRouteSteps:result.ledger.filter(x=>x.expression||x.label.includes('完工'))
      .map(x=>({label:x.label,tick:x.after?.tick,
        seconds:x.seconds??null,cost:x.expression?Object.fromEntries(
          Object.keys(x.before.resources).filter(k=>x.before.resources[k]!==x.after.resources[k])
            .map(k=>[k,x.before.resources[k]-x.after.resources[k]])):null})),
    minimumFood:result.minFood,pausedQueueSeconds:result.pausedQueueSeconds,
    block:result.block,firstLoss:result.firstLoss,
    clearedL10:result.clearedL10,final:result.final,
    battles:result.battles.map(battleEssentials),finalSaveSha256:sha(saved)};
}
const profiles=[];
for(const seed of seeds)for(const disableReward of [false,true]){
  const source=runBranch(seed,disableReward,policy);
  assert.equal(source.battles.length,5);
  assert.ok(source.battles.every(row=>row.won));
  const trials=[];
  for(const mode of modes){
    activeMode=mode;
    const e=environment({rts_save:source.checkpointSave}),run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    installBattleHarness(run);
    assert.deepEqual(snapshot(run),source.checkpoint);
    const result=route(run,seed);
    assert.equal(result.block,null,`${mode}未到L6`);
    const saved=run("localStorage.getItem('rts_save')");
    const reload=environment({rts_save:saved});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.deepEqual(checkpoint(reload.run),checkpoint(run),'P172终档重载不一致');
    assert.deepEqual(snapshot(reload.run),snapshot(run),'P172兵力终档重载不一致');
    trials.push({raw:result,compact:compactTrial(mode,result,saved)});
  }
  const full=trials[0].raw,capped=trials[1].raw;
  assert.deepEqual(full.initial,capped.initial,'A/B L5起档不同');
  assert.equal(full.firstBattleTick,capped.firstBattleTick,'A/B L6前时间分叉');
  assert.deepEqual(full.battles[0].before,capped.battles[0].before,
    'A/B L6战前资源、训练和拥有量不一致');
  assert.equal(full.battles[0].beforeDeployed.bronze_guard,15);
  assert.equal(full.battles[0].beforeDeployed.infantry_t1,15);
  assert.equal(capped.battles[0].beforeDeployed.bronze_guard,10);
  assert.equal(capped.battles[0].beforeDeployed.infantry_t1,10);
  assert.equal(full.battles[0].beforeDeployed.archer_t1,13);
  assert.equal(capped.battles[0].beforeDeployed.archer_t1,13);
  const beforeBattleSteps=trial=>{
    const boundary=trial.ledger.findIndex(x=>x.label==='等待三线兵力补满');
    assert.ok(boundary>=0,'L6战前补兵边界缺失');
    return trial.ledger.slice(0,boundary+1).map(x=>({label:x.label,
      expression:x.expression??null,seconds:x.seconds??null,
      tick:x.after.tick,resources:x.after.resources}));
  };
  assert.deepEqual(beforeBattleSteps(full),beforeBattleSteps(capped),
    'A/B L6前付费与等待路线不一致');
  profiles.push({seed,branch:source.branch,sourceL5SaveSha256:source.checkpointSaveSha256,
    trials:trials.map(x=>x.compact)});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-regiment-deployment-causal-p172.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P172',unit:'simulated online tick seconds, people, resources and soldiers',
  sourceHead:head.stdout.trim(),method:'identical P171 real paid capacity route and same P170/P167 serialized L5 start, with one in-memory formation call substitution: front regiments take up to 15 versus up to 10; actual modal actions and seeded battle callbacks; both arms have Lv2 barracks and regMax15, use identical pre-L6 actions/timing/owned targets; after each victory both target bronze15/militia15/ranger13 and wait 600 online ticks, stopping at first loss or L10',
  scope:{seeds,policyName,modes,branches:['current-L3-plus-six','no-L3-reward'],
    noResourceInjection:true,noOffline:true,noGarrison:true},profiles,
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P172',profiles:profiles.map(p=>({seed:p.seed,branch:p.branch,
  trials:p.trials.map(t=>({mode:t.mode,firstBattleTick:t.firstBattleTick,
    minimumFood:t.minimumFood,firstLoss:t.firstLoss,clearedL10:t.clearedL10,
    battles:t.battles.map(b=>({stage:b.stage,won:b.won,round:b.round,
      owned:b.before.owned,deployed:b.beforeDeployed}))}))})),rawData:outputPath},null,2));
