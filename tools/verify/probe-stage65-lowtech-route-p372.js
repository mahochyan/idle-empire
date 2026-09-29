'use strict';
// P375 rerun of P372's bounded paid continuation from P206's stage-41 win.
// Original P372 data remains frozen; historical 6 exists only in VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sourceReport=JSON.parse(fs.readFileSync(path.join(data,'p206-live-l40-l41-handoff.json'),'utf8'));
const sourceCase=sourceReport.cases[2];
const sourceRaw=sourceCase.l41.postSave;
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha(sourceRaw),sourceCase.l41.postSaveSha256,'P206原始实付快照SHA不匹配');
const sourceFile='p375-stage41-lowtech-paid-save.json';
fs.writeFileSync(path.join(data,sourceFile),sourceRaw);
const original=JSON.parse(sourceRaw);
const originalTick=original.tick;
const targets={bronze_guard:15,cavalry_t1:15,infantry_t1:15,archer_t1:28};

function boot(raw){
  const world=environment({rts_save:raw}),{run}=world;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),
    'P206实付旧档无法安全读取或迁移');
  const save=JSON.parse(raw),clockTick=run('S.tick');
  run(`globalThis.__baseDate=Date;globalThis.Date=class extends __baseDate {
      static now(){return ${save.ts}+(S.tick-${clockTick})*1000}};
    globalThis.__timers=new Map();globalThis.__timerId=1;
    globalThis.setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const item=__timers.entries().next().value;if(!item)return false;
      __timers.delete(item[0]);item[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));`);
  return world;
}
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function compact(run){
  return run(`({tick:S.tick,defeated:S.defeated.length,sciences:S.sciences.length,
    population:popCurrent(),capacity:maxPop(),army:armyCount(),
    deployed:formSoldierCount(),food:S.res.food,wood:S.res.wood,stone:S.res.stone,
    copper:S.res.copper,coal:S.res.coal,merit:S.merit,
    caps:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food')},
    owned:Object.fromEntries(['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
      .map(type=>[type,(S.pool[type]||0)+expeditionCount(type)+garrisonCount(type)])),
    queue:JSON.parse(JSON.stringify(S.queue)),workers:{...S.popAlloc}})`);
}
function recover(run,stage){
  const before=compact(run),queued={};let minFood=before.food;
  for(const [type,target] of Object.entries(targets)){
    const need=Math.max(0,target-owned(run,type)-(run(`S.queue['${type}']?.count||0`)));
    if(!need)continue;
    const result=run(`train('${type}',${need})`);
    if(!result?.ok||result.qty!==need)return{ok:false,before,queued,
      block:{phase:'queue',stage,type,need,result,lock:run(`trainLockReason('${type}')`)}};
    queued[type]=need;
  }
  let seconds=0;
  while(Object.entries(targets).some(([type,n])=>owned(run,type)<n)&&seconds<7200){
    run('tick()');seconds++;minFood=Math.min(minFood,run('S.res.food'));
  }
  const after=compact(run),ok=Object.entries(targets).every(([type,n])=>owned(run,type)>=n);
  return{ok,seconds,minFood,queued,before,after,...(!ok?{block:{phase:'recovery',stage,
    reason:'7200 online seconds exhausted',deficits:Object.fromEntries(Object.entries(targets)
      .map(([type,n])=>[type,Math.max(0,n-owned(run,type))])),queue:after.queue}}:{})};
}
function place(run,row,index,type,count){
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});S._formModalSel='${type}';S._formModalQty=${count}`);
  assert.notEqual(run('confirmForm()'),false);
}
function form(run){
  run("clrForm('expedition')");
  place(run,'front',0,'bronze_guard',15);
  place(run,'front',1,'cavalry_t1',15);
  place(run,'front',2,'infantry_t1',15);
  place(run,'back',0,'archer_t1',13);
  place(run,'back',1,'archer_t1',15);
  assert.equal(run('formSoldierCount()'),73);
}
function fight(run,stage,seed){
  run(`globalThis.__rng=${seed};Math.random=()=>{let x=__rng;
    x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=compact(run);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run(`S.defeated.includes(${stage})`),round=run('B.round'),after=compact(run);
  run('exitBattle()');
  assert.equal(run('save().ok'),true);
  return{stage,seed,won,round,callbacks,before,after,loss:before.army-after.army};
}
const source=boot(sourceRaw);
assert.equal(source.run('S.defeated.length'),41);
assert.equal(source.run('S.sciences.length'),8);
assert.equal(source.run('popCurrent()'),22);
const rows=[];
let block=null,prebattleRaw=null;
for(let stage=42;stage<=64;stage++){
  assert.equal(source.run('S.defeated.length'),stage-1);
  const replenishment=recover(source.run,stage);
  if(!replenishment.ok){block=replenishment.block;rows.push({stage,replenishment});break}
  form(source.run);
  assert.equal(source.run('save().ok'),true);
  prebattleRaw=source.store.get('rts_save');
  const result=fight(source.run,stage,15*1009+stage*9176);
  rows.push({stage,replenishment:{ok:true,seconds:replenishment.seconds,
    minFood:replenishment.minFood,queued:replenishment.queued},battle:result});
  if(!result.won){block={phase:'battle',stage,seed:result.seed,round:result.round,
    loss:result.loss,remainingArmy:result.after.army};break}
  const checkpointRaw=source.store.get('rts_save'),reloaded=boot(checkpointRaw);
  assert.equal(reloaded.run('S.defeated.length'),stage);
  assert.equal(reloaded.run('armyCount()'),result.after.army);
}
const completed=source.run('S.defeated.length');
const firstBlockScreen=[];
if(block?.phase==='battle'&&prebattleRaw){
  for(let seed=1;seed<=32;seed++){
    const trial=boot(prebattleRaw),result=fight(trial.run,block.stage,seed);
    firstBlockScreen.push({seed,won:result.won,round:result.round,
      loss:result.loss,remainingArmy:result.after.army});
  }
}
let selectedContinuation=null;
if(block?.phase==='battle'&&firstBlockScreen.some(row=>row.won)){
  const selected=firstBlockScreen.filter(row=>row.won)
    .sort((a,b)=>a.loss-b.loss||a.seed-b.seed)[0];
  let alternative=boot(prebattleRaw);const selectedRows=[],rescueSelections=[];
  const restart=fight(alternative.run,block.stage,selected.seed);
  assert.equal(restart.won,true);
  selectedRows.push({stage:block.stage,battle:restart});
  let nextBlock=null;
  for(let stage=block.stage+1;stage<=64;stage++){
    const replenishment=recover(alternative.run,stage);
    if(!replenishment.ok){nextBlock=replenishment.block;
      selectedRows.push({stage,replenishment});break}
    form(alternative.run);
    assert.equal(alternative.run('save().ok'),true);
    const stagePreRaw=alternative.store.get('rts_save');
    let result=fight(alternative.run,stage,15*1009+stage*9176);
    if(!result.won){
      const screen=[];
      for(let seed=1;seed<=32;seed++){
        const trial=boot(stagePreRaw),trialResult=fight(trial.run,stage,seed);
        screen.push({seed,won:trialResult.won,loss:trialResult.loss});
      }
      const winner=screen.filter(row=>row.won).sort((a,b)=>a.loss-b.loss||a.seed-b.seed)[0];
      rescueSelections.push({stage,initialSeed:result.seed,initialLoss:result.loss,
        wins:screen.filter(row=>row.won).length,of:screen.length,
        selectedSeed:winner?.seed??null,selectedLoss:winner?.loss??null});
      if(winner){alternative=boot(stagePreRaw);result=fight(alternative.run,stage,winner.seed)}
    }
    selectedRows.push({stage,replenishment:{ok:true,seconds:replenishment.seconds,
      minFood:replenishment.minFood,queued:replenishment.queued},battle:result});
    if(!result.won){nextBlock={phase:'battle',stage,seed:result.seed,
      round:result.round,loss:result.loss,remainingArmy:result.after.army};break}
  }
  const selectedCompleted=alternative.run('S.defeated.length');
  if(selectedCompleted===64)fs.writeFileSync(path.join(data,
    'p375-stage64-lowtech-selected-paid-save.json'),alternative.store.get('rts_save'));
  selectedContinuation={selection:{seed:selected.seed,loss:selected.loss,
    candidateStreams:firstBlockScreen.length,winningStreams:firstBlockScreen.filter(row=>row.won).length,
    criterion:'least loss among paid stage-49 winning fixed streams'},
    rescueSelections,completed:selectedCompleted,block:nextBlock,rows:selectedRows,
    final:compact(alternative.run)};
}
if(completed<64&&prebattleRaw)
  fs.writeFileSync(path.join(data,'p375-first-block-prebattle-paid-save.json'),prebattleRaw);
if(completed===64)
  fs.writeFileSync(path.join(data,'p375-stage64-lowtech-paid-save.json'),source.store.get('rts_save'));
let gateComparison=null;
if(selectedContinuation?.completed===64){
  const stage64Raw=fs.readFileSync(path.join(data,'p375-stage64-lowtech-selected-paid-save.json'),'utf8');
  const entry=boot(stage64Raw),entryRecovery=recover(entry.run,65);
  assert.equal(entryRecovery.ok,true,'低科研第64关存档无法实付补兵');
  form(entry.run);
  assert.equal(entry.run('save().ok'),true);
  const entryRaw=entry.store.get('rts_save');
  const entryFile='p375-stage65-lowtech-paid-entry.json';
  fs.writeFileSync(path.join(data,entryFile),entryRaw);
  const campEntry=entry.run("({camp:S.buildings.infantry_camp?{...S.buildings.infantry_camp}:null,reason:tierUpgradeLockReason('infantry_camp'),cost:tierUpgradeCost('infantry_camp')})");
  const checks=[];
  for(const variant of ['historical6','current48'])for(let seed=1;seed<=32;seed++){
    const trial=boot(entryRaw);
    if(variant==='historical6')trial.run('CFG.enemies[64].units={infantry:[1,1,1],archer:[1,1,1]}');
    assert.equal(trial.run('Object.values(CFG.enemies[64].units).flat().reduce((sum,n)=>sum+n,0)'),
      variant==='historical6'?6:48,'第65关对照敌人数语义已变化');
    const first=fight(trial.run,65,seed),postRaw=trial.store.get('rts_save');
    const loaded=boot(postRaw);
    assert.equal(loaded.run('S.defeated.includes(65)'),first.won);
    assert.equal(loaded.run('armyCount()'),first.after.army);
    const campAfter=trial.run("({camp:S.buildings.infantry_camp?{...S.buildings.infantry_camp}:null,reason:tierUpgradeLockReason('infantry_camp'),cost:tierUpgradeCost('infantry_camp')})");
    let recovery66=null,second=null;
    if(first.won){
      recovery66=recover(trial.run,66);
      if(recovery66.ok){form(trial.run);second=fight(trial.run,66,seed)}
    }
    checks.push({variant,seed,first:{won:first.won,round:first.round,loss:first.loss,
      remainingArmy:first.after.army,food:first.after.food},reload:{won:loaded.run('S.defeated.includes(65)'),
      army:loaded.run('armyCount()')},campAfter,recovery66:recovery66&&{
      ok:recovery66.ok,seconds:recovery66.seconds,queued:recovery66.queued,
      minFood:recovery66.minFood,block:recovery66.block??null},
      second:second&&{won:second.won,loss:second.loss}});
  }
  const summary=Object.fromEntries(['historical6','current48'].map(variant=>{
    const own=checks.filter(row=>row.variant===variant),wins=own.filter(row=>row.first.won);
    const losses=wins.map(row=>row.first.loss).sort((a,b)=>a-b);
    return[variant,{wins:wins.length,of:own.length,winningLosses:{min:losses[0]??null,
      median:losses.length?losses[Math.floor((losses.length-1)/2)]:null,max:losses.at(-1)??null},
      recovery66:wins.filter(row=>row.recovery66?.ok).length,
      stage66Wins:own.filter(row=>row.second?.won).length}]
  }));
  gateComparison={entryFile,entrySha256:sha(entryRaw),entryRecovery:{seconds:entryRecovery.seconds,
    queued:entryRecovery.queued,minFood:entryRecovery.minFood},entry:compact(entry.run),campEntry,
    summary,checks,scope:'Same legally paid stage-65 entry; historical 6 changed only inside VM, current 48 comes from levels.js. 32 paired diagnostic RNG streams, not player win rates. Original P372 data remains frozen.'};
}
const report={batch:'P375',predecessor:'P372',kind:'bounded lower-tech real paid stage-41 continuation',
  source:{report:'p206-live-l40-l41-handoff.json',caseIndex:2,
    file:sourceFile,sha256:sha(sourceRaw),tick:originalTick,
    state:compact(boot(sourceRaw).run)},
  currentHashes:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js','tools/verify/probe-stage65-lowtech-route-p372.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),
  targets,rows,completed,block,firstBlockScreen,selectedContinuation,gateComparison,
  final:compact(source.run),
  scope:'Only real train/tick/formation/battle/save/reload from P206 paid L41 save; fixed independent battle stream per stage. No research, population, material, soldier, victory, or enemy adjustment. Natural garrison disabled by existing Node harness.'};
fs.writeFileSync(path.join(data,'p375-lowtech-route.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:report.source.file,completed,block,attempted:rows.length,
  blockScreen:{wins:firstBlockScreen.filter(row=>row.won).length,of:firstBlockScreen.length},
  gateComparison:gateComparison&&{entry:gateComparison.entry,campEntry:gateComparison.campEntry,
    summary:gateComparison.summary},
  selected: selectedContinuation&&{selection:selectedContinuation.selection,
    completed:selectedContinuation.completed,block:selectedContinuation.block,
    stages:selectedContinuation.rows.map(row=>({stage:row.stage,
      win:row.battle?.won,loss:row.battle?.loss,
      recoverySeconds:row.replenishment?.seconds,
      food:row.battle?.after?.food}))},
  stages:rows.map(r=>({stage:r.stage,win:r.battle?.won,loss:r.battle?.loss,
    recoverySeconds:r.replenishment?.seconds,food:r.battle?.after?.food}))},null,2));
