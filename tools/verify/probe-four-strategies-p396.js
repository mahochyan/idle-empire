'use strict';
// Four fresh-save early-route checks against one source revision. The campaign
// adapter deliberately excludes P102's historical candidate deed injection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const populationPath=path.join(__dirname,'probe-population-early-18.js');
const campaignPath=path.join(__dirname,'probe-population-first-clear-replenish-p102.js');
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const sourceBefore=Object.fromEntries(sourceFiles.map(file=>[file,sha(file)]));
const safeName=name=>assert.match(name,/^[a-z][a-z0-9-]*$/);
const fixedClock="Date.now=()=>Date.UTC(2026,8,30,0,0,0)";
const populationSource=fs.readFileSync(populationPath,'utf8').replace(
  'const e=environment();',`const e=environment();e.run('${fixedClock}');`);
const rawCampaignSource=fs.readFileSync(campaignPath,'utf8').replace(/\r\n/g,'\n');
function replaceOnce(source,anchor,replacement){
  assert.equal(source.split(anchor).length,2,`P102 adapter anchor changed: ${anchor}`);
  return source.replace(anchor,replacement);
}
const campaignTail='const windows=waitWindows;';
assert.equal(rawCampaignSource.split(campaignTail).length,2,'P102 tail anchor changed');
let noCandidateRewardSource=replaceOnce(rawCampaignSource,
  "const {environment}=require('../../tests/progression/harness');",
  "const {environment:realEnvironment}=require('../../tests/progression/harness');"+
  `const environment=opts=>{const e=realEnvironment(opts);e.run('${fixedClock}');return e;};`);
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  'function checked(run,expression,label){',
  "const __p396Ops={build:0,allocate:0,research:0,train:0,settlement:0,formation:0,battle:0};"+
  'function checked(run,expression,label){');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  '  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);\n  return result;',
  '  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);'+
  "const method=expression.match(/^([A-Za-z]+)\\(/)?.[1];"+
  "const kind={buildAct:'build',setPopAlloc:'allocate',researchScience:'research',train:'train'}[method];"+
  'if(kind)__p396Ops[kind]++;return result;');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  ';confirmForm()`);',
  ';confirmForm()`);__p396Ops.formation++;');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  ';openBattle()`);',
  ';openBattle()`);__p396Ops.battle++;');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  'spent+=result.cost;',
  'spent+=result.cost;__p396Ops.settlement++;');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  'trainingAttempts.push({type,requested:missing,result});',
  'trainingAttempts.push({type,requested:missing,result});if(result?.ok)__p396Ops.train++;');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  "const baseAward=Math.ceil(stage/10);",
  "if(rewardMode==='current'&&process.argv.includes('--p396-defer-housing'))"+
  "return {award:0,bonus:0,spent:0};"+
  "const baseAward=rewardMode==='current'?0:Math.ceil(stage/10);");
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  'const saved=run(`(()=>{S.res.deed+=${baseAward+bonus};return save()})()`);',
  'const saved=rewardMode===\'current\'?run(\'save()\'):'+
  'run(`(()=>{S.res.deed+=${baseAward+bonus};return save()})()`);');
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  "rows.push({...fought,reward,workforceChange,replenishment,afterTick:run('S.tick')});",
  "rows.push({...fought,reward,workforceChange,replenishment,afterTick:run('S.tick'),"+
  "deedAfter:run('S.res.deed'),deedSavedAfter:run(\"JSON.parse(localStorage.getItem('rts_save')).res.deed\"),"+
  "capacityAfter:run('maxPop()'),"+
  "nextVillageCost:run(\"settlementCost('village')\")});");
noCandidateRewardSource=replaceOnce(noCandidateRewardSource,
  "tickBefore:r.before.tick,afterTick:r.afterTick}))",
  "tickBefore:r.before.tick,afterTick:r.afterTick,deedAfter:r.deedAfter,"+
  "deedSavedAfter:r.deedSavedAfter,capacityAfter:r.capacityAfter,"+
  "nextVillageCost:r.nextVillageCost}))");
const campaignSource=noCandidateRewardSource
  .slice(0,noCandidateRewardSource.indexOf(campaignTail))+
  "\nconst __p396Branch=makeBranch('current',waitWindows[0]);"+
  "console.log(JSON.stringify({entryState:battleStart,sessionProfile,"+
  "preparationSessionClock,branch:__p396Branch,operations:__p396Ops},null,2));";

function executeSource(source,file,args){
  const former=process.argv;
  let stdout='';
  process.argv=[process.execPath,file,...args];
  try{
    new Function('require','console','__dirname',source)(createRequire(file),
      {log(value){stdout+=String(value)},error:console.error},path.dirname(file));
  }finally{process.argv=former}
  assert.ok(stdout.startsWith('{'),`${path.basename(file)} produced no JSON`);
  return JSON.parse(stdout);
}
function sumActions(actions){return Object.values(actions||{}).reduce((sum,value)=>sum+Number(value||0),0)}
function populationRoute(id,args){
  safeName(id);
  const data=executeSource(populationSource,populationPath,[...args,'--capture-final-save']);
  assert.equal(data.battleWins,0);
  assert.equal(data.milestones.find(x=>x.label==='population-18')?.population,18);
  assert.equal(data.milestones.find(x=>x.label==='population-18')?.capacity,18);
  assert.equal(data.milestones.at(-1)?.population,18);
  assert.ok(typeof data.finalStateSave==='string'&&data.finalStateSave.startsWith('{'));
  const savePath=path.join(dataDir,`p396-four-strategy-${id}-pop18-save.json`);
  fs.writeFileSync(savePath,data.finalStateSave+'\n');
  const saved=JSON.parse(data.finalStateSave);
  assert.equal(saved.defeated.length,0);
  const saveSha=sha(path.relative(root,savePath));
  const pop18=data.milestones.find(x=>x.label==='population-18');
  return {data,savePath,saveSha,pop18,
    summary:{population18:{activeOnlineSeconds:pop18.activeOnlineSeconds,
      settledOfflineSeconds:pop18.offlineSeconds,elapsedSimulationSeconds:pop18.second,
      population:pop18.population,capacity:pop18.capacity,actions:pop18.actions,
      actionCount:sumActions(pop18.actions),food:pop18.resources.food},
    final:{activeOnlineSeconds:data.activeOnlineSeconds,
      settledOfflineSeconds:data.settledOfflineSeconds,
      elapsedSimulationSeconds:data.elapsedSimulationSeconds,
      population:data.milestones.at(-1).population,
      actionCount:sumActions(data.actions),actions:data.actions,
      minFood:data.minFood,battleWins:data.battleWins},saveSha256:saveSha}};
}
function campaignRoute(route,extraSecondsPerWin,sessionProfile,deferHousing){
  const args=[`--input-save-file=${route.savePath}`,`--wait-windows=${extraSecondsPerWin}`,
    '--campaign-max-stage=10','--retry-first-loss','--recovery-wait-seconds=600'];
  if(sessionProfile)args.push(`--session-profile=${sessionProfile}`,
    `--session-elapsed-active=${route.data.activeOnlineSeconds}`,
    `--session-elapsed-offline=${route.data.settledOfflineSeconds}`);
  if(deferHousing)args.push('--p396-defer-housing');
  const output=executeSource(campaignSource,campaignPath,args);
  const {branch}=output;
  const entrySave=JSON.parse(output.entryState.save);
  assert.ok(entrySave.sciences.includes('sci_bronze_age'));
  assert.ok(entrySave.pool.bronze_guard>=8);
  assert.equal(output.operations.battle,branch.attempted+(branch.defeatRecovery?1:0));
  assert.equal(output.entryState.population,18);
  assert.equal(output.entryState.capacity,18);
  assert.ok(branch.rows.every(row=>row.reward?.award===0),
    'candidate deed injection entered a reported route');
  const rows=branch.rows.map(row=>({stage:row.stage,win:row.win,
    tickBefore:row.tickBefore,afterTick:row.afterTick,
    deedAfter:row.deedAfter,deedSavedAfter:row.deedSavedAfter,
    capacityAfter:row.capacityAfter,
    nextVillageCost:row.nextVillageCost,round:row.round,
    deployed:row.deployed,armyBefore:row.armyBefore,armyAfter:row.armyAfter,
    byTypeBefore:row.byTypeBefore,byTypeAfter:row.byTypeAfter,
    populationBefore:row.populationBefore,capacityBefore:row.capacityBefore,
    replenishment:row.replenishment&&{queuedAtStart:row.replenishment.queuedAtStart,
      remainingQueue:row.replenishment.remainingQueue,
      queueReasons:row.replenishment.queueReasons,afterArmy:row.replenishment.afterArmy,
      resources:row.replenishment.resources},resourcesBefore:row.resourcesBefore}));
  const recovery=branch.defeatRecovery?{stage:branch.defeatRecovery.stage,
    activeWaitSeconds:branch.defeatRecovery.activeWaitSeconds,
    firstLoss:branch.defeatRecovery.firstLoss,
    trainingAttempts:branch.defeatRecovery.trainingAttempts,
    beforeRetry:branch.defeatRecovery.beforeRetry,
    retry:branch.defeatRecovery.retry,
    afterRetry:branch.defeatRecovery.afterRetry}:null;
  return {entry:{tick:output.entryState.tick,resources:output.entryState.resources,
    workers:output.entryState.workers,population:output.entryState.population,
    capacity:output.entryState.capacity,army:output.entryState.army,
    bronzeSciencePaid:true},operations:output.operations,
    operationCount:sumActions(output.operations),
    extraSecondsPerWin,attempted:branch.attempted,wins:branch.wins,
    blockedAt:branch.blockedAt,rows,recovery,
    sessionClock:branch.sessionClock||null};
}

fs.mkdirSync(dataDir,{recursive:true});
const profiles=[
  {id:'economic',populationArgs:[],waitSeconds:0,sessionProfile:null,
    deferHousing:false,
    policy:'housing-first 2-scholar start; spend genuine stage-3 deed reward on village capacity; immediate next fights'},
  {id:'balanced',populationArgs:['--research-priority','--research-workers=4'],
    waitSeconds:180,sessionProfile:null,deferHousing:false,
    policy:'temporary 4-scholar research after market; genuine stage-3 deed to housing; 180 online seconds of post-win replenishment'},
  {id:'military',populationArgs:[],waitSeconds:600,sessionProfile:null,
    deferHousing:true,
    policy:'2-scholar start; reserve genuine stage-3 deed and spend 600 online seconds after each win on actual troop replenishment'},
  {id:'short-session',populationArgs:['--research-priority','--research-workers=4',
    '--session-profile=600:28800'],waitSeconds:180,sessionProfile:'600:28800',
    deferHousing:false,
    policy:'4-scholar research start; genuine stage-3 deed to housing; 600 active online seconds followed by actual 8-hour offline settlement, including military phase'}
];
const results={};
for(const profile of profiles){
  const population=populationRoute(profile.id,profile.populationArgs);
  let campaign=null,campaignError=null;
  try{campaign=campaignRoute(population,profile.waitSeconds,profile.sessionProfile,profile.deferHousing)}
  catch(error){campaignError=String(error.stack||error)}
  results[profile.id]={policy:profile.policy,population:population.summary,campaign,campaignError};
}
assert.ok(Object.values(results).every(value=>value.campaign&&!value.campaignError),
  'at least one four-strategy campaign continuation failed');
const sourceAfter=Object.fromEntries(sourceFiles.map(file=>[file,sha(file)]));
assert.deepEqual(sourceAfter,sourceBefore,'shared source changed during four-route replay');
const artifact={batch:'P396',sourceSha256:sourceBefore,
  unit:'active online seconds, settled offline seconds, elapsed simulation seconds; scripted actions are instantaneous',
  method:'four fresh new-game saves, then P102 real action/battle continuation; P102 candidate deed injection skipped for reported current branch',
  limitations:'harness fixes battle random at 0.5 and freezes natural garrison; routes are early checkpoints, not full 50-hour or full-era acceptance',
  results};
const outputPath=path.join(dataDir,'p396-four-strategy-early-checkpoints.json');
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:artifact.batch,sourceSha256:sourceBefore,
  results:Object.fromEntries(Object.entries(results).map(([key,value])=>[key,{
    population:value.population,campaign:value.campaign&&{
      entry:value.campaign.entry,attempted:value.campaign.attempted,
      wins:value.campaign.wins,blockedAt:value.campaign.blockedAt,
      recovery:value.campaign.recovery&&{stage:value.campaign.recovery.stage,
        activeWaitSeconds:value.campaign.recovery.activeWaitSeconds,
        retryWin:value.campaign.recovery.retry?.outcome?.win},
      sessionClock:value.campaign.sessionClock&&{
        activeOnlineSeconds:value.campaign.sessionClock.activeOnlineSeconds,
        settledOfflineSeconds:value.campaign.sessionClock.settledOfflineSeconds,
        offlineWindows:value.campaign.sessionClock.offlineWindows?.length}},
    campaignError:value.campaignError&&value.campaignError.split('\n')[0]}])),
  dataFile:outputPath},null,2));
