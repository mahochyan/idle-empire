'use strict';
// P113: compare the same fresh population routes under several active/offline
// cadences using the real P101 route and offline settlement functions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const profiles=[600,1800,3600,28800].map(offlineSec=>({activeSec:600,offlineSec}));

function childJson(args){
  const result=spawnSync(process.execPath,[populationProbe,...args],
    {cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
  assert.equal(result.status,0,`P101 ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function route(name,profile,args){
  const data=childJson([...args,`--session-profile=${profile.activeSec}:${profile.offlineSec}`]);
  assert.equal(data.battleWins,0,`${name}人口路线不得含普通关胜场`);
  assert.deepEqual(data.sessionProfile,profile);
  const milestone=data.milestones.find(item=>item.label==='population-18');
  assert.ok(milestone,`${name}缺少18人口节点`);
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  return{
    route:name,
    profile,
    population18:{activeOnlineSeconds:milestone.activeOnlineSeconds,
      offlineSeconds:milestone.offlineSeconds,elapsedSimulationSeconds:milestone.second},
    final:{activeOnlineSeconds:data.activeOnlineSeconds,
      offlineSeconds:data.settledOfflineSeconds,elapsedSimulationSeconds:data.elapsedSimulationSeconds,
      population:data.milestones.at(-1).population,capacity:data.milestones.at(-1).capacity,
      resources:data.milestones.at(-1).resources,caps:data.milestones.at(-1).caps},
    actions:data.actions,
    milestones:data.milestones.map(item=>({label:item.label,second:item.second,
      activeOnlineSeconds:item.activeOnlineSeconds,offlineSeconds:item.offlineSeconds,
      population:item.population,capacity:item.capacity,resources:item.resources,caps:item.caps})),
    offlineSessions:data.offlineSessions.map(item=>({activeSeconds:item.activeSeconds,
      durationSec:item.durationSec,before:item.before, gains:item.gains,
      after:{population:item.population,capacity:item.capacity,growthClock:item.growthClock,
        resources:item.resources}}))
  };
}
function project(item){
  return{label:item.label,second:item.second,activeOnlineSeconds:item.activeOnlineSeconds,
    offlineSeconds:item.offlineSeconds,population:item.population,capacity:item.capacity,
    resources:item.resources,caps:item.caps};
}

const results=[];
for(const profile of profiles){
  const sequential=route('sequential-expansion',profile,[]);
  const research=route('research-priority-4-scholars',profile,
    ['--research-priority','--research-workers=4']);
  const researchMilestones=new Map(research.milestones.map(item=>[item.label,item]));
  const common=sequential.milestones.filter(item=>researchMilestones.has(item.label));
  assert.ok(common.length>=20,`${profile.offlineSec}秒profile共同检查点过少：${common.length}`);
  const differences=common.filter(item=>JSON.stringify(project(item))!==
    JSON.stringify(project(researchMilestones.get(item.label)))).map(item=>({
      label:item.label,sequential:project(item),researchPriority:project(researchMilestones.get(item.label))}));
  results.push({profile,commonCheckpointCount:common.length,
    equalCommonCheckpointCount:common.length-differences.length,differences,
    allocateActionDelta:research.actions.allocate-sequential.actions.allocate,
    routes:{sequential,researchPriority4:research}});
}

const artifact={batch:'P113',
  unit:'active online seconds; settled offline seconds; people; capacity; resources',
  method:'same fresh zero-win P101 population routes with actual save()/settleOffline() cadence; no player save, no battle, no injected resources',
  scope:'sequential expansion versus 4-scholar research priority; each profile pauses after 600 active online seconds and settles offline for 600, 1800, 3600, or 28800 seconds',
  results};
const rawPath=path.join(root,'docs/codex/reports/data/p113-population-session-cadence.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P113',profiles:results.map(item=>({
  offlineSeconds:item.profile.offlineSec,commonCheckpoints:item.commonCheckpointCount,
  equalCheckpoints:item.equalCommonCheckpointCount,differentCheckpoints:item.differences.map(x=>x.label),
  allocateActionDelta:item.allocateActionDelta,
  sequential:item.routes.sequential.population18,
  researchPriority4:item.routes.researchPriority4.population18})),rawData:rawPath},null,2));
