'use strict';
// P110: carry the P108 short-session clock through actual early military prep,
// timed battle callbacks, and post-victory replenishment/offline windows.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
function childJson(script,args,input){
  const result=spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:16*1024*1024});
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function populationRoute(name,args){
  const data=childJson(populationProbe,[...args,'--capture-final-save']);
  assert.equal(typeof data.finalStateSave,'string',`${name}没有通过真实save()导出终档`);
  assert.equal(data.battleWins,0,`${name}人口阶段不应包含普通关胜场`);
  const milestone=data.milestones.find(x=>x.label==='population-18');
  assert.ok(milestone,`${name}缺少18人口检查点`);
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  return{name,data:{...data,finalStateSave:undefined},save:data.finalStateSave,milestone};
}
function campaignRoute(name,route,shortSession){
  const args=['--input-save-stdin'];
  if(shortSession)args.push('--session-profile=600:28800',
    '--session-elapsed-active=4188','--session-elapsed-offline=172800');
  const data=childJson(campaignProbe,args,route.save);
  assert.ok(data.source.includes('serialized fresh zero-win population-route save'),
    `${name}战役没有读取人口路线真实终档`);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  assert.deepEqual(data.entryState.army,{infantry:15,archer:13,bronze_guard:8});
  assert.equal(data.results.length,4,'需覆盖0/60/180/600秒每胜补兵窗口');
  const expectedWins={0:5,60:6,180:6,600:6};
  const expectedOfflineWindows={0:0,60:0,180:1,600:4};
  for(const window of data.results){
    for(const branch of [window.current,window.frontloadedMetal,window.frontloadedFood]){
      assert.equal(branch.wins,expectedWins[window.extraSecondsPerWin],
        `${name}/${branch.rewardMode}/${window.extraSecondsPerWin}s胜场边界变化`);
      assert.equal(branch.blockedAt,window.extraSecondsPerWin===0?6:null,
        `${name}/${branch.rewardMode}/${window.extraSecondsPerWin}s阻塞关变化`);
    }
  }
  if(shortSession){
    assert.deepEqual(data.sessionProfile,{activeSec:600,offlineSec:28800});
    assert.ok(data.preparationSessionClock.activeOnlineSeconds>=4200,
      '军备准备至少应推进到已经使用的4200在线秒会话边界');
    assert.equal(data.preparationSessionClock.settledOfflineSeconds,201600,
      '军备准备跨过4200在线秒门槛后应追加一次8小时离线');
    assert.equal(data.preparationSessionClock.offlineWindows.length,1);
    for(const window of data.results){
      for(const branch of [window.current,window.frontloadedMetal,window.frontloadedFood]){
        assert.ok(branch.sessionClock,'短时分支必须输出实测会话钟');
        assert.ok(branch.rows.every(row=>Number.isFinite(row.battleActiveMs)&&row.battleActiveMs>=0),
          '战斗时长应来自实际战斗回调延迟');
        assert.ok(branch.sessionClock.activeOnlineSeconds>=data.preparationSessionClock.activeOnlineSeconds);
        assert.ok(branch.sessionClock.settledOfflineSeconds>=data.preparationSessionClock.settledOfflineSeconds);
        assert.equal(branch.sessionClock.offlineWindows.length,expectedOfflineWindows[window.extraSecondsPerWin],
          `${window.extraSecondsPerWin}s胜场窗口触发的离线次数变化`);
        assert.equal(branch.sessionClock.settledOfflineSeconds,
          201600+expectedOfflineWindows[window.extraSecondsPerWin]*28800,
          '离线累计秒必须等于实际结算窗口');
      }
    }
  }
  return data;
}
const continuous=populationRoute('continuous-online',[]);
const short=populationRoute('600-online-28800-offline',['--session-profile=600:28800']);
assert.equal(continuous.data.activeOnlineSeconds,5316);
assert.equal(short.data.activeOnlineSeconds,4188);
assert.equal(short.data.settledOfflineSeconds,172800);
const routes={
  continuousOnline:{population:continuous.data,campaign:campaignRoute('continuous-online',continuous,false)},
  shortSession:{population:short.data,campaign:campaignRoute('short-session',short,true)}
};
const summary=Object.fromEntries(Object.entries(routes).map(([name,item])=>{
  const campaign=item.campaign;
  return[name,{population18:{activeOnlineSeconds:item.population.milestones.find(x=>x.label==='population-18').activeOnlineSeconds,
      offlineSeconds:item.population.milestones.find(x=>x.label==='population-18').offlineSeconds},
    campaignEntry:{tick:campaign.entryState.tick,population:campaign.entryState.population,
      capacity:campaign.entryState.capacity,army:campaign.entryState.army,
      ...(campaign.preparationSessionClock?{sessionClock:campaign.preparationSessionClock}:{})},
    windows:campaign.results.map(w=>({extraSecondsPerWin:w.extraSecondsPerWin,
      branches:[w.current,w.frontloadedMetal,w.frontloadedFood].map(b=>({rewardMode:b.rewardMode,wins:b.wins,
        blockedAt:b.blockedAt,stage6Win:!!b.rows.find(r=>r.stage===6)?.win,
        ...(b.sessionClock?{activeOnlineSeconds:b.sessionClock.activeOnlineSeconds,
          settledOfflineSeconds:b.sessionClock.settledOfflineSeconds,
          offlineWindows:b.sessionClock.offlineWindows.length}:{})}))}))}];
}));
const artifact={batch:'P110',
  unit:'active online/offline seconds; battle callback milliseconds; people; resources; soldiers; wins',
  method:'P101 same-save population routes feed P102; short-session active clock resumes at the serialized route totals and uses real save()/settleOffline(), actual game tick during battle callbacks, and real post-battle training/replenishment functions',
  scope:'continuous and 600s-online/28800s-offline routes; session profile covers P102 preparation and campaign branches; battle callback duration uses CFG delays and CFG.tickMs; fixed random 0.5; no player browser save',
  routes};
const rawPath=path.join(root,'docs/codex/reports/data/p110-short-session-population-campaign.json');
fs.mkdirSync(path.dirname(rawPath),{recursive:true});
fs.writeFileSync(rawPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P110',summary,rawData:rawPath},null,2));
