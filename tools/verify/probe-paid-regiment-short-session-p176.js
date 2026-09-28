'use strict';
// P176: replay P171's paid L5→L10 route from the same real L5 save under
// continuous online time and 600-second online / 8-hour offline sessions.
// The historical route is instrumented only in memory. No player file or
// browser save is changed and offline progress uses live settleOffline().
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const outputPath=path.join(root,'docs/codex/reports/data/p176-paid-regiment-short-session.json');
const seeds=[1,3],onlineWindowSec=600,offlineWindowSec=28800;
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function plain(value){return JSON.parse(JSON.stringify(value))}
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P176找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P176的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
let tickHook=()=>{},fightHook=()=>{};
function reuseP171(){
  let source=fs.readFileSync(p171Path,'utf8');
  source=replaceOnce(source,'function tick(){run(\'tick()\');observe()}',
    'function tick(){run(\'tick()\');__p176TickHook(run);observe()}',
    '在线计时钩子');
  source=replaceOnce(source,'function fight(run,seed,stage){\n  assert.equal',
    'function fight(run,seed,stage){\n  __p176FightHook(run,stage);\n  assert.equal',
    '战前时点钩子');
  source=replaceOnce(source,
    'assert.equal(ledger.at(-1).seconds,cost.time,`仓库Lv${level}完工时间`);',
    'assert.ok(ledger.at(-1).seconds<=cost.time,`仓库Lv${level}在线完工等待`);',
    '仓库在线完工断言');
  source=replaceOnce(source,
    "assert.equal(ledger.at(-1).seconds,barracksCost.time,'营帐Lv2完工时间');",
    "assert.ok(ledger.at(-1).seconds<=barracksCost.time,'营帐Lv2在线完工等待');",
    '营帐在线完工断言');
  source=replaceOnce(source,
    'assert.equal(ledger.at(-1).seconds,cost.time,`${key} T1完工时间`);',
    'assert.ok(ledger.at(-1).seconds<=cost.time,`${key} T1在线完工等待`);',
    '升阶在线完工断言');
  source=replaceOnce(source,'const profiles=[];',
    'return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact};\nconst profiles=[];',
    'P171同源返回点');
  return new Function('require','console','__dirname','__p176TickHook','__p176FightHook',source)(
    createRequire(p171Path),{log(){},error:console.error},path.dirname(p171Path),
    (...args)=>tickHook(...args),(...args)=>fightHook(...args));
}
const {runBranch,workerPolicies,snapshot,installBattleHarness,route,
  checkpoint,compact}=reuseP171();
const policy=workerPolicies.find(item=>item.name==='food-food');
assert.ok(policy);

function scenario(l5Save,sourceCheckpoint,seed,shortSession){
  const previousDateNow=Date.now;
  let virtualNow=JSON.parse(l5Save).ts;
  assert.ok(Number.isFinite(virtualNow));
  Date.now=()=>virtualNow;
  try{
    let active=environment({rts_save:l5Save}).run;
    const run=expression=>active(expression);
    assert.equal(run('loadSaveAndApply().status'),'ok');
    installBattleHarness(run);
    assert.deepEqual(snapshot(run),sourceCheckpoint,'L5同源重载不一致');
    const initialTick=run('S.tick');
    let onlineSeconds=0,actualOfflineSeconds=0,minObservedFood=run('S.res.food');
    const windows=[],fights=[];
    function installFoodObserver(){
      run(`globalThis.__p176MinFood=S.res.food;
        const originalProductionSecond=productionSecond;
        productionSecond=function(...args){
          const next=originalProductionSecond(...args);
          if(Number.isFinite(next.food))
            globalThis.__p176MinFood=Math.min(globalThis.__p176MinFood,next.food);
          return next;
        };`);
    }
    installFoodObserver();
    function observe(){
      minObservedFood=Math.min(minObservedFood,run('S.res.food'),run('globalThis.__p176MinFood'));
    }
    tickHook=()=>{
      onlineSeconds++;
      virtualNow+=1000;
      observe();
      if(!shortSession||onlineSeconds%onlineWindowSec!==0)return;
      const saveResult=run('save()');
      assert.equal(saveResult?.ok,true,'离线窗前保存失败');
      const savedTs=run('_loadedTs');
      assert.equal(savedTs,virtualNow,'会话边界时间戳不一致');
      const before=compact(run);
      virtualNow=savedTs+offlineWindowSec*1000;
      const settled=plain(run('settleOffline()'));
      assert.equal(settled.ok,true,`离线结算失败：${JSON.stringify(settled)}`);
      actualOfflineSeconds+=settled.durationSec;
      const after=compact(run);
      const report=plain(run('S.offline.pendingReport'));
      observe();
      const settledSave=run("localStorage.getItem('rts_save')");
      const expectedCheckpoint=checkpoint(run),expectedSnapshot=snapshot(run);
      const next=environment({rts_save:settledSave});
      assert.equal(next.run('loadSaveAndApply().status'),'ok','离线终档重载失败');
      installBattleHarness(next.run);
      active=next.run;
      installFoodObserver();
      assert.deepEqual(checkpoint(run),expectedCheckpoint,'离线重载破坏基础状态');
      assert.deepEqual(snapshot(run),expectedSnapshot,'离线重载破坏编队或队列');
      windows.push({atOnlineSeconds:onlineSeconds,requestedSeconds:offlineWindowSec,
        actualSeconds:settled.durationSec,truncated:settled.truncated,
        foodClamped:report?.advance?.foodClamped??false,
        produced:report?.advance?.produced??null,
        completed:report?.advance?.due??null,
        before,after,saveSha256:sha(settledSave)});
    };
    fightHook=(battleRun,stage)=>{
      if(battleRun===run)fights.push({stage,onlineSeconds,actualOfflineSeconds,
        before:compact(run)});
    };
    const outcome=route(run,seed);
    observe();
    assert.equal(run('S.tick')-initialTick,onlineSeconds+actualOfflineSeconds,
      '在线tick与真实离线结算秒数不守恒');
    const finalSave=run("localStorage.getItem('rts_save')");
    const finalEnvironment=environment({rts_save:finalSave});
    assert.equal(finalEnvironment.run('loadSaveAndApply().status'),'ok','路线终档重载失败');
    assert.deepEqual(checkpoint(finalEnvironment.run),checkpoint(run),'终档重载破坏基础状态');
    assert.deepEqual(snapshot(finalEnvironment.run),snapshot(run),'终档重载破坏编队或队列');
    return{mode:shortSession?'600-online-8h-offline':'continuous-online',
      onlineSeconds,actualOfflineSeconds,minObservedFood,
      windows,fights,block:outcome.block,clearedL10:outcome.clearedL10,
      firstLoss:outcome.firstLoss??null,
      final:{...compact(run),population:run('popCurrent()'),capacity:run('maxPop()')},
      finalSaveSha256:sha(finalSave),
      battles:outcome.battles.map(row=>({stage:row.stage,won:row.won,round:row.round,
        beforeDeployed:row.beforeDeployed,afterOwned:row.after.owned})),
      payments:outcome.ledger.filter(row=>row.expression&&
        (row.label.startsWith('支付')||row.label.startsWith('研究')))
        .map(row=>({label:row.label,tick:row.after.tick,result:row.result})),
      waits:outcome.ledger.filter(row=>row.seconds!==undefined)
        .map(row=>({label:row.label,onlineSeconds:row.seconds,met:row.met??true}))};
  }finally{
    tickHook=()=>{};fightHook=()=>{};
    Date.now=previousDateNow;
  }
}

const profiles=[];
for(const seed of seeds){
  const source=runBranch(seed,false,policy);
  assert.ok(source.battles.length===5&&source.battles.every(row=>row.won),
    `随机流${seed}未到达L5`);
  const continuous=scenario(source.checkpointSave,source.checkpoint,seed,false);
  const short=scenario(source.checkpointSave,source.checkpoint,seed,true);
  assert.equal(continuous.actualOfflineSeconds,0);
  assert.equal(short.actualOfflineSeconds,
    short.windows.reduce((sum,window)=>sum+window.actualSeconds,0));
  profiles.push({seed,branch:source.branch,l5SaveSha256:source.checkpointSaveSha256,
    l5Population:source.checkpoint.population,
    continuous,short});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'tools/verify/probe-paid-regiment-short-session-p176.js'];
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P176',unit:'simulated online tick seconds; actual settled offline seconds',
  sourceHead:head.stdout.trim(),
  method:'same real P167 L5 first-clear rts_save per seed, replay P171 paid route continuously and with true save/settleOffline/reload every 600 online ticks plus 28800 elapsed offline seconds; game functions pay building, research and per-soldier training costs, form and resolve every battle; stage-specific xorshift32 RNG',
  scope:{seeds,branch:'current-L3-plus-six',policy:'food-food',onlineWindowSec,
    offlineWindowSec,noGarrison:true,noResourceInjection:true,noPlayerSave:true},
  profiles,inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
for(const input of artifact.inputs)
  assert.equal(sha(fs.readFileSync(path.join(root,input.file))),input.sha256,
    `运行期间输入变更：${input.file}`);
console.log(JSON.stringify({batch:'P176',rawData:outputPath,
  profiles:profiles.map(profile=>({seed:profile.seed,
    l5Population:profile.l5Population,
    continuous:{onlineSeconds:profile.continuous.onlineSeconds,
      clearedL10:profile.continuous.clearedL10,firstLoss:profile.continuous.firstLoss,
      minObservedFood:profile.continuous.minObservedFood},
    short:{onlineSeconds:profile.short.onlineSeconds,
      actualOfflineSeconds:profile.short.actualOfflineSeconds,
      windows:profile.short.windows.map(window=>({atOnlineSeconds:window.atOnlineSeconds,
        actualSeconds:window.actualSeconds,foodClamped:window.foodClamped,
        beforeFood:window.before.resources.food,afterFood:window.after.resources.food,
        beforeQueue:window.before.queue,afterQueue:window.after.queue})),
      clearedL10:profile.short.clearedL10,firstLoss:profile.short.firstLoss,
      block:profile.short.block,minObservedFood:profile.short.minObservedFood,
      fights:profile.short.fights.map(f=>({stage:f.stage,onlineSeconds:f.onlineSeconds,
        offlineSeconds:f.actualOfflineSeconds}))}}))},null,2));
