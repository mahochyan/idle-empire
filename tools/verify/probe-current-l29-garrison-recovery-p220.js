'use strict';
// P220: fixed-stream real garrisonTick sensitivity during paid L29 recovery.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p215-live-l29-order-sweep.json');
const p219Path=path.join(root,'docs/codex/reports/data/p219-current-l29-l31-handoff.json');
const outputPath=path.join(root,'docs/codex/reports/data/p220-current-l29-garrison-recovery.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const p219=JSON.parse(fs.readFileSync(p219Path,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
const picks=[
  {sourceSeed:1,flow:1,plan:'frontReverse'},
  {sourceSeed:15,flow:15,plan:'frontReverse'},
  {sourceSeed:1,flow:4,plan:'frontReverse'}
];
const streams=Array.from({length:12},(_,i)=>i+1);
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p215-live-l29-order-sweep.json',
  'docs/codex/reports/data/p219-current-l29-l31-handoff.json',
  'tools/verify/probe-current-l29-garrison-recovery-p220.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P215');
assert.equal(p219.batch,'P219');
for(const file of inputFiles.slice(0,6))
  assert.equal(inputs.find(x=>x.file===file).sha256,
    source.inputs.find(x=>x.file===file)?.sha256,`${file} changed since P215`);
function own(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function state(run){
  return plain(run(`({tick:S.tick,resources:{...S.res},
    owned:Object.fromEntries(['bronze_guard','cavalry_wind',
      'infantry_t1','archer_t1'].map(k=>[k,(S.pool[k]||0)+
        expeditionCount(k)+garrisonCount(k)])),
    queue:JSON.parse(JSON.stringify(S.queue)),
    garrison:JSON.parse(JSON.stringify(S.garrison)),
    garrisonForm:JSON.parse(JSON.stringify(S._garrisonForm)),
    garrisonLog:[...S.garrisonLog],army:armyCount()})`));
}
function installRng(run,pick,stream){
  const initial=(pick.flow*1009+29*9176+stream*7919)>>>0;
  run(`globalThis.__p220Seed=${initial};globalThis.__p220Draws=0;
    Math.random=()=>{__p220Draws++;let x=__p220Seed;
      x^=x<<13;x^=x>>>17;x^=x<<5;__p220Seed=x>>>0;
      return __p220Seed/4294967296}`);
  return initial;
}
function runRecovery(pick,stream,enabled){
  const trial=source.trials.find(t=>t.sourceSeed===pick.sourceSeed&&
    t.flow===pick.flow&&t.plan===pick.plan);
  assert.ok(trial?.battle.won);
  assert.equal(sha(trial.post.save),trial.post.sha256);
  const world=environment({rts_save:trial.post.save},{garrison:enabled});
  const run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  assert.equal(run('S.defeated.at(-1)'),29);
  const before=state(run);
  assert.equal(before.army,73-trial.battle.lossTotal);
  assert.equal(before.garrisonForm.front.length+before.garrisonForm.mid.length+
    before.garrisonForm.back.length,0);
  assert.ok(before.garrison.nextCheckTick<before.tick,
    'source save should have overdue invasion check');
  const initial=installRng(run,pick,stream);
  const requests={};
  for(const [type,target] of Object.entries(targets)){
    const need=Math.max(0,target-own(run,type)-run(`S.queue['${type}']?.count||0`));
    requests[type]=need;
    if(!need)continue;
    assert.equal(run(`trainLockReason('${type}')`),'');
    const pre=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok,true);
    assert.equal(action.qty,need);
    assert.deepEqual(plain(run('({...S.res})')),pre);
  }
  const ready=()=>Object.entries(targets).every(([type,target])=>own(run,type)>=target);
  let seconds=0,minFoodTickEnd=before.resources.food,pausedSeconds=0;
  while(!ready()&&seconds<7200){
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    if(Object.values(plain(run('S.queue'))).some(q=>q.count>0&&q.reason))pausedSeconds++;
  }
  const after=state(run);
  assert.equal(run('save().ok'),true);
  const afterSave=world.store.get('rts_save');
  assert.equal(typeof afterSave,'string');
  const reloaded=environment({rts_save:afterSave},{garrison:enabled});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(state(reloaded.run),after);
  return{sourceSaveSha256:trial.post.sha256,enabled,stream,seed:initial,
    draws:run('__p220Draws'),before,requests,seconds,
    ready:ready(),minFoodTickEnd,pausedSeconds,
    garrisonEvents:after.garrisonLog.length-before.garrisonLog.length,
    garrisonLogNew:after.garrisonLog.slice(before.garrisonLog.length),
    after,afterSaveSha256:sha(afterSave),afterSave};
}
const results=[];
for(const pick of picks)for(const stream of streams){
  const disabled=runRecovery(pick,stream,false);
  const enabled=runRecovery(pick,stream,true);
  const baseline=p219.trials.find(t=>t.selection.sourceSeed===pick.sourceSeed&&
    t.selection.flow===pick.flow&&t.selection.plan===pick.plan);
  assert.ok(baseline);
  assert.equal(disabled.seconds,baseline.beforeL30.replenishment.seconds);
  assert.equal(disabled.ready,true);
  results.push({pick,stream,disabled,enabled});
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const output={batch:'P220',sourceHead:head.stdout.trim(),
  scope:{picks,streams,nodeVmOnly:true,formalGarrisonCode:true,
    emptyGarrisonFromSource:true,recoverySecondsMax:7200,
    noResourceOrTroopInjection:true,
    note:'Source P215 saves inherited stale nextCheckTick because original harness disabled garrisonTick.'},
  inputs,results};
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({pick:r.pick,stream:r.stream,
  disabled:{seconds:r.disabled.seconds,food:r.disabled.minFoodTickEnd,
    events:r.disabled.garrisonEvents},
  enabled:{seconds:r.enabled.seconds,ready:r.enabled.ready,
    food:r.enabled.minFoodTickEnd,events:r.enabled.garrisonEvents,
    foodEnd:r.enabled.after.resources.food}})),null,2));
