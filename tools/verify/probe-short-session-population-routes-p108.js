'use strict';
// P108: compare the same zero-win early population routes with continuous
// simulation and scheduled 10-minute online / 8-hour offline sessions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const routeProbe=path.join(root,'tools/verify/probe-population-early-18.js');
function runRoute(name,args){
  const result=spawnSync(process.execPath,[routeProbe,...args],
    {cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,`${name}路线失败：${result.stderr||result.stdout}`);
  const data=JSON.parse(result.stdout);
  assert.equal(data.battleWins,0,`${name}不应有普通关胜场`);
  const milestone=data.milestones.find(item=>item.label==='population-18');
  assert.ok(milestone,`${name}缺少18人口检查点`);
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  assert.equal(milestone.second,milestone.activeOnlineSeconds+milestone.offlineSeconds,
    `${name}检查点的模拟时钟拆分不一致`);
  if(data.sessionProfile){
    assert.equal(data.sessionProfile.activeSec,600);
    assert.equal(data.sessionProfile.offlineSec,28800);
    assert.ok(data.offlineSessions.length>0);
    for(const session of data.offlineSessions){
      assert.equal(session.durationSec,28800);
      assert.equal(session.before.population,session.population,'离线改变了人口');
      assert.equal(session.before.capacity,session.capacity,'离线改变了住房');
      assert.equal(session.before.growthClock,session.growthClock,'离线改变了出生钟');
    }
  }else assert.equal(data.settledOfflineSeconds,0);
  return{name,data,population18:milestone};
}

const routes=[
  runRoute('sequential-online',[]),
  runRoute('research-4-online',['--research-priority']),
  runRoute('sequential-short-session',['--session-profile=600:28800']),
  runRoute('research-4-short-session',['--research-priority','--session-profile=600:28800'])
];
const result={batch:'P108',unit:'simulated seconds; route actions are instantaneous, active tick time and offline settlement are split',
  offlineRule:'each 600 active online seconds, save then call current settleOffline() for 28800 seconds; population and capacity must remain unchanged offline',
  source:'fresh current-worktree population harness; no battle, injected resources, or player browser save',routes};
const output=JSON.stringify(result,null,2);
const dataPath=path.join(root,'docs/codex/reports/data/p108-short-session-population-routes.json');
fs.mkdirSync(path.dirname(dataPath),{recursive:true});
fs.writeFileSync(dataPath,output+'\n');
console.log(JSON.stringify({batch:result.batch,routes:routes.map(({name,data,population18})=>({name,
  reachedAtSimulationSecond:population18.second,activeOnlineSeconds:population18.activeOnlineSeconds,
  offlineSeconds:population18.offlineSeconds,offlineSessions:data.offlineSessions.length,
  population:population18.population,capacity:population18.capacity,resources:population18.resources,
  elapsedSimulationSeconds:data.elapsedSimulationSeconds,minFood:data.minFood}))},null,2));
