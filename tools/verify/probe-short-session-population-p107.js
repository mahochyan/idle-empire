'use strict';
// P107: take a real early-route 8/10 housing save, settle offline windows, and
// verify when the next two villagers arrive. No player save or game code is written.
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const routeProbe=path.join(root,'tools/verify/probe-population-early-18.js');
const routeRun=spawnSync(process.execPath,[routeProbe,'--capture-headroom-save'],
  {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(routeRun.status,0,`P101路线失败：${routeRun.stderr||routeRun.stdout}`);
const route=JSON.parse(routeRun.stdout);
const checkpoint=route.milestones.find(item=>item.label==='expand-smallTown-1');
assert.ok(checkpoint?.stateSave,'缺少真实小镇扩容后的8/10人口检查点');
assert.equal(checkpoint.population,8);
assert.equal(checkpoint.capacity,10);
assert.equal(route.battleWins,0);

function summarizeResources(run){
  const res=run('({...S.res})');
  return Object.fromEntries(['wood','stone','food','tech','coin','deed','coal','copper','iron']
    .filter(key=>res[key]!==undefined).map(key=>[key,Number(res[key].toFixed(3))]));
}
function simulateOffline(seconds){
  const originalNow=Date.now;
  try{
    const e=environment({rts_save:checkpoint.stateSave});
    const run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    const savedTs=run('_loadedTs');
    const before={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      growthClock:run('S.population.growthClock'),resources:summarizeResources(run),workers:run('({...S.popAlloc})')};
    Date.now=()=>savedTs+seconds*1000;
    const settled=JSON.parse(run('JSON.stringify(settleOffline())'));
    assert.equal(settled.ok,true,`离线${seconds}秒未结算：${JSON.stringify(settled)}`);
    assert.equal(settled.durationSec,seconds,`离线时长${seconds}秒被意外截断`);
    const afterOffline={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      growthClock:run('S.population.growthClock'),resources:summarizeResources(run)};
    assert.equal(afterOffline.population,before.population,'离线时段不应增加实际村民');
    assert.equal(afterOffline.capacity,before.capacity,'离线时段不应自动扩建住房');
    assert.equal(afterOffline.growthClock,before.growthClock,'离线时段不应推进人口出生计时');
    run('for(let i=0;i<10;i++)tick()');
    const afterTenOnline={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
      growthClock:run('S.population.growthClock'),resources:summarizeResources(run)};
    assert.equal(afterTenOnline.population,10,'恢复在线10秒后应自然填入两个空位');
    return {requestedOfflineSeconds:seconds,checkpoint:{tick:before.tick,population:before.population,
        capacity:before.capacity,growthClock:before.growthClock,resources:before.resources,workers:before.workers},
      offline:{durationSec:settled.durationSec,gains:settled.gains,truncated:settled.truncated,
        after:{...afterOffline,resources:afterOffline.resources}},
      afterTenOnline};
  }finally{Date.now=originalNow;}
}
function simulateOnline(seconds){
  const e=environment({rts_save:checkpoint.stateSave});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const before={tick:run('S.tick'),population:run('popCurrent()'),capacity:run('maxPop()'),
    growthClock:run('S.population.growthClock'),resources:summarizeResources(run)};
  run(`for(let i=0;i<${seconds};i++)tick()`);
  return {requestedOnlineSeconds:seconds,before,after:{tick:run('S.tick'),population:run('popCurrent()'),
    capacity:run('maxPop()'),growthClock:run('S.population.growthClock'),resources:summarizeResources(run)}};
}

const windows=[3600,28800,86400].map(simulateOffline);
console.log(JSON.stringify({batch:'P107',unit:'simulated online/offline seconds; people; resources',
  source:'P101 current-worktree zero-win early market route; real 8/10 checkpoint save; settleOffline() and tick()',
  offlineConfig:{ratio:0.6,capSec:86400,minSec:120},
  checkpoint:{label:checkpoint.label,onlineSecond:checkpoint.second,population:checkpoint.population,
    capacity:checkpoint.capacity,battleWins:route.battleWins},
  onlineComparison:simulateOnline(3600),windows},null,2));
