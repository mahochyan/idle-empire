'use strict';
// P109: carry continuous and short-session fresh population routes through a
// serialized rts_save into the real early-campaign/replenishment probe.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const populationProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const campaignProbe=path.join(root,'tools/verify/probe-population-first-clear-replenish-p102.js');
function childJson(script,args,input){
  const result=spawnSync(process.execPath,[script,...args],
    {cwd:root,encoding:'utf8',input,maxBuffer:12*1024*1024});
  assert.equal(result.status,0,`${path.basename(script)} ${args.join(' ')}失败：${result.stderr||result.stdout}`);
  return JSON.parse(result.stdout);
}
function populationRoute(name,args){
  const data=childJson(populationProbe,[...args,'--capture-final-save']);
  assert.equal(typeof data.finalStateSave,'string',`${name}没有通过真实save()导出终档`);
  assert.equal(data.battleWins,0,`${name}的人口阶段不应包含普通关胜场`);
  const milestone=data.milestones.find(x=>x.label==='population-18');
  assert.ok(milestone,`${name}缺少18人口检查点`);
  assert.equal(milestone.population,18);
  assert.equal(milestone.capacity,18);
  return{name,data:{...data,finalStateSave:undefined},save:data.finalStateSave,population18:milestone};
}
function campaignFrom(name,route){
  const data=childJson(campaignProbe,['--input-save-stdin'],route.save);
  assert.ok(data.source.includes('serialized fresh zero-win population-route save'),
    `${name}战役没有读取人口路线保存的存档`);
  assert.equal(data.entryState.population,18);
  assert.equal(data.entryState.capacity,18);
  assert.ok(data.entryState.tick>=route.data.elapsedSimulationSeconds,
    `${name}战役时间早于人口路线终档，疑似丢失连续状态`);
  assert.deepEqual(data.entryState.army,{infantry:15,archer:13,bronze_guard:8});
  assert.equal(data.results.length,4,'需覆盖0/60/180/600秒每胜补兵窗口');
  for(const window of data.results){
    assert.equal(window.extraSecondsPerWin>=0,true);
    for(const branch of [window.current,window.frontloadedMetal,window.frontloadedFood]){
      assert.ok(branch.attempted>=1);
      assert.ok(branch.rows.every((row,index)=>row.stage===index+3),'战役摘要必须保持第3关后的顺序');
    }
  }
  return data;
}

const continuous=populationRoute('continuous-online',[]);
const shortSession=populationRoute('short-session',['--session-profile=600:28800']);
assert.equal(continuous.population18.activeOnlineSeconds,5096);
assert.equal(continuous.population18.offlineSeconds,0);
assert.equal(shortSession.population18.activeOnlineSeconds,3968);
assert.equal(shortSession.population18.offlineSeconds,172800);
const results={
  continuousOnline:{population:continuous.data,campaign:campaignFrom('continuous-online',continuous)},
  shortSession:{population:shortSession.data,campaign:campaignFrom('short-session',shortSession)}
};
const output={batch:'P109',
  unit:'simulated active/offline seconds; people; resources; soldiers; wins',
  method:'each actual fresh zero-win population route is saved with save(), passed through stdin, reloaded by P102, then prepared for and replayed through real battles and replenishment windows',
  scope:'short-session schedule applies to the fresh population route up to its early 18/18 checkpoint; subsequent military preparation, battles, and post-win waits use P102 online ticks',
  source:'current-worktree P101/P102 real implementations in isolated harnesses; no player browser save or runtime edits',
  routes:results};
const dataPath=path.join(root,'docs/codex/reports/data/p109-short-session-population-campaign.json');
fs.mkdirSync(path.dirname(dataPath),{recursive:true});
fs.writeFileSync(dataPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({batch:output.batch,summary:Object.fromEntries(Object.entries(results).map(([name,item])=>{
  const wins=Object.fromEntries(item.campaign.results.map(w=>[w.extraSecondsPerWin,
    [w.current,w.frontloadedMetal,w.frontloadedFood].map(b=>({wins:b.wins,blockedAt:b.blockedAt,
      stage6:b.rows.find(r=>r.stage===6)?.win??null}))]));
  return[name,{population18:{activeOnlineSeconds:item.population.milestones.find(x=>x.label==='population-18').activeOnlineSeconds,
      offlineSeconds:item.population.milestones.find(x=>x.label==='population-18').offlineSeconds,
      elapsedSeconds:item.population.milestones.find(x=>x.label==='population-18').second},
    battleEntry:{tick:item.campaign.entryState.tick,resources:item.campaign.entryState.resources,
      population:item.campaign.entryState.population,capacity:item.campaign.entryState.capacity,
      army:item.campaign.entryState.army},wins}];
}))},null,2));
