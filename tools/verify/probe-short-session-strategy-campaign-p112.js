'use strict';
// P112: compare sequential-expansion and 4-scholar short-session saves through
// the same real early campaign, replenishment, defeat, and retry checkpoints.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
function childJson(script,args,input){
  const result=spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:20*1024*1024});
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function populationRoute(name,args){
  const data=childJson(populationProbe,[...args,'--session-profile=600:28800','--capture-final-save']);
  assert.equal(typeof data.finalStateSave,'string',`${name}未导出真实save()终档`);
  assert.equal(data.battleWins,0,`${name}人口路线不得含普通关胜场`);
  const milestone=data.milestones.find(x=>x.label==='population-18');
  assert.ok(milestone,`${name}缺少18人口里程碑`);
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  assert.ok(data.activeOnlineSeconds>=milestone.activeOnlineSeconds);
  assert.ok(data.settledOfflineSeconds>=milestone.offlineSeconds);
  return{name,data:{...data,finalStateSave:undefined},save:data.finalStateSave,milestone};
}
function campaignRoute(route){
  const args=['--input-save-stdin','--session-profile=600:28800',
    `--session-elapsed-active=${route.data.activeOnlineSeconds}`,
    `--session-elapsed-offline=${route.data.settledOfflineSeconds}`,
    '--retry-stage6-after-loss','--recovery-wait-seconds=600'];
  const data=childJson(campaignProbe,args,route.save);
  assert.ok(data.source.includes('serialized fresh zero-win population-route save'));
  assert.deepEqual(data.sessionProfile,{activeSec:600,offlineSec:28800});
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  assert.deepEqual(data.entryState.army,{infantry:15,archer:13,bronze_guard:8});
  assert.equal(data.results.length,4);
  for(const window of data.results){
    for(const branch of [window.current,window.frontloadedMetal,window.frontloadedFood]){
      assert.ok(branch.rows.every((row,index)=>row.stage===index+3),'战役记录须保持第3关后顺序');
      if(branch.blockedAt===6){
        assert.ok(branch.defeatRecovery,'第6关失败后需记录同关恢复');
        assert.equal(branch.defeatRecovery.activeWaitSeconds,600);
        assert.equal(branch.defeatRecovery.retry.outcome.win,true,'600秒补兵后的第6关重试应获胜');
        assert.equal(branch.defeatRecovery.firstLoss.populationBefore,
          branch.defeatRecovery.firstLoss.populationAfterDefeat,'战败不得减少人口');
      }
    }
  }
  return data;
}
function summarizeCampaign(data){
  return{entry:{tick:data.entryState.tick,resources:data.entryState.resources,population:data.entryState.population,
      capacity:data.entryState.capacity,army:data.entryState.army,preparationSessionClock:data.preparationSessionClock},
    windows:data.results.map(window=>({extraSecondsPerWin:window.extraSecondsPerWin,
      branches:[window.current,window.frontloadedMetal,window.frontloadedFood].map(branch=>({
        rewardMode:branch.rewardMode,wins:branch.wins,blockedAt:branch.blockedAt,
        stage6Win:!!branch.rows.find(row=>row.stage===6)?.win,
        activeOnlineSeconds:branch.sessionClock.activeOnlineSeconds,
        settledOfflineSeconds:branch.sessionClock.settledOfflineSeconds,
        offlineWindows:branch.sessionClock.offlineWindows.map(x=>({activeOnlineSeconds:x.activeOnlineSeconds,
          durationSec:x.durationSec,reason:x.reason})),
        ...(branch.defeatRecovery?{recovery:{activeWaitSeconds:branch.defeatRecovery.activeWaitSeconds,
          retryWin:branch.defeatRecovery.retry.outcome.win,retryRound:branch.defeatRecovery.retry.outcome.round,
          firstLossPopulation:branch.defeatRecovery.firstLoss.populationBefore,
          postDefeatPopulation:branch.defeatRecovery.firstLoss.populationAfterDefeat,
          rosterBeforeRetry:branch.defeatRecovery.beforeRetry.army}}:{})}))}))};
}
const routes={
  sequentialExpansion:populationRoute('sequential-expansion',[]),
  researchPriority4:populationRoute('research-priority-4-scholars',['--research-priority','--research-workers=4'])
};
for(const route of Object.values(routes)){
  const pop18=route.milestone;
  assert.equal(pop18.population,18);
  assert.equal(pop18.capacity,18);
}
const results={};
for(const [key,route] of Object.entries(routes))results[key]={population:route.data,
  campaign:campaignRoute(route)};
const sequential=results.sequentialExpansion;
const scholar=results.researchPriority4;
const scholarCheckpoints=new Map(scholar.population.milestones.map(item=>[item.label,item]));
const commonCheckpoints=sequential.population.milestones.filter(item=>scholarCheckpoints.has(item.label));
assert.equal(commonCheckpoints.length,28,'必须比较全部28个同名新档里程碑');
for(const item of commonCheckpoints){
  const other=scholarCheckpoints.get(item.label);
  const project=value=>({label:value.label,second:value.second,activeOnlineSeconds:value.activeOnlineSeconds,
    offlineSeconds:value.offlineSeconds,population:value.population,capacity:value.capacity,resources:value.resources});
  assert.deepEqual(project(item),project(other),`${item.label}里程碑的时间、人口、住房或库存发生差异`);
}
assert.equal(scholar.population.actions.allocate-sequential.population.actions.allocate,6,
  '科研优先路线应保留其额外岗位调整动作');
assert.deepEqual(sequential.campaign,scholar.campaign,
  '共同人口检查点状态相同后，两条路线的战役、补兵、败后恢复和重试必须逐字段相同');
const artifact={batch:'P112',
  unit:'active online/offline seconds; people; resources; soldiers; training; wins; retry results',
  method:'same fresh zero-win population routes are actually serialized with save(), reloaded by P102, and continued through real military preparation, production, battle timers, replenishment, defeat, and retry',
  scope:'sequential expansion versus 4-scholar research priority; both use 600 online seconds followed by 28800 offline seconds, fixed random 0.5, the same P102 army/reward/replenishment branches, and no player browser save',
  routes:results};
const rawPath=path.join(root,'docs/codex/reports/data/p112-short-session-strategy-campaign.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
const summary=Object.fromEntries(Object.entries(results).map(([key,value])=>[key,{
  population18:{activeOnlineSeconds:value.population.milestones.find(x=>x.label==='population-18').activeOnlineSeconds,
    offlineSeconds:value.population.milestones.find(x=>x.label==='population-18').offlineSeconds},
  finalPopulationRoute:{activeOnlineSeconds:value.population.activeOnlineSeconds,
    offlineSeconds:value.population.settledOfflineSeconds,elapsedSimulationSeconds:value.population.elapsedSimulationSeconds},
  campaign:summarizeCampaign(value.campaign)}]));
console.log(JSON.stringify({batch:'P112',summary,rawData:rawPath},null,2));
