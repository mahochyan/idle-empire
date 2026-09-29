'use strict';
// Isolated first-clear pressure probe. The candidate changes CFG only inside each VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const child=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const files={failed:'p-stage90-low-continuation-agent-through99-save.json',early:'p-stage90-entry-low-paid-save.json'};
const inputs=Object.fromEntries(Object.entries(files).map(([key,file])=>{
  const raw=fs.readFileSync(path.join(data,file),'utf8');return[key,{file,sha256:sha(raw),raw}];
}));
const head=child.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js','tools/verify/probe-stage96-low-p394.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const mode=process.argv.includes('--pilot')?'pilot':'full';
const seeds=mode==='pilot'?[1,7,9]:Array.from({length:16},(_,i)=>i+1);
function make(inputKey,seed,rawOverride=null){
  const env=environment({rts_save:rawOverride??inputs[inputKey].raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;
      __timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){},addEventListener(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__trainingSpend={};const __originalPay=payTrainingCost;
    globalThis.payTrainingCost=(cost,count)=>{for(const [rk,n] of Object.entries(cost))
      if(CFG.res[rk])__trainingSpend[rk]=(__trainingSpend[rk]||0)+n*count;
      return __originalPay(cost,count)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  return env;
}
function configure(run,stage,target){
  const result=run(`(()=>{const e=CFG.enemies[${stage-1}],before=Object.values(e.units).flat().reduce((a,b)=>a+b,0);
    const ratio=${target}/before;e.units=Object.fromEntries(Object.entries(e.units).map(([k,g])=>
      [k,g.map(n=>Math.max(1,Math.round(n*ratio)))]));
    return {before,after:Object.values(e.units).flat().reduce((a,b)=>a+b,0),units:e.units}})()`);
  return result;
}
function state(run){return run(`({second:S.tick,army:armyCount(),deployed:formSoldierCount(),pool:JSON.parse(JSON.stringify(S.pool)),
  res:{food:S.res.food,steel:S.res.steel,wood:S.res.wood,stone:S.res.stone,copper:S.res.copper,iron:S.res.iron},
  formation:JSON.parse(JSON.stringify(S.formation)),defeated:S.defeated.length,
  queue:JSON.parse(JSON.stringify(S.queue))})`)}
function allocate(run,jobs){
  const old=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(old))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  for(const [rk,n] of Object.entries(jobs))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true);
}
function waitFor(run,condition,max=30000){
  const r=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  assert.equal(r.ok,true,`wait timeout: ${condition} / ${JSON.stringify(state(run))}`);
  return r.n;
}
function recruit(run,key,target){
  const have=run(`S.pool['${key}']||0`),need=target-have;
  if(need<=0)return 0;
  if(key==='armored_trooper'){
    let produced=0;
    while(run('S.pool.armored_trooper||0')<target){
      const batch=Math.min(3,target-run('S.pool.armored_trooper||0')),fee=batch*2000;
      for(const rk of ['copper','iron','steel'])assert.ok(run(`resCap('${rk}')`)>=fee,`${rk} cap below ${fee}`);
      allocate(run,{food:10,stone:30,coal:30,copper:30});
      waitFor(run,`S.res.copper>=${fee}`);
      allocate(run,{food:10,stone:33,coal:26,iron:20,steel:12});
      waitFor(run,`S.res.iron>=${fee}&&S.res.steel>=${fee}`);
      allocate(run,{food:102});
      const prior=run('S.pool.armored_trooper||0');
      const result=run(`train('armored_trooper',${batch})`);
      assert.equal(result?.ok,true);
      assert.equal(result.qty,batch);
      waitFor(run,`(S.pool.armored_trooper||0)>=${prior+batch}`);
      produced+=batch;
    }
    return produced;
  }
  const cost=run(`CFG.units['${key}'].cost`);
  if(cost.steel&&run('S.res.steel')<cost.steel*need){
    allocate(run,{food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(run,`S.res.steel>=${cost.steel*need}`);
  }
  allocate(run,{food:102});
  if(cost.food)waitFor(run,`S.res.food>=${cost.food*need+2000}`);
  for(const rk of ['wood','stone','copper','iron','silver','gold'])if(cost[rk])
    assert.ok(run(`S.res.${rk}`)>=cost[rk]*need,`${key} missing ${rk}`);
  const result=run(`train('${key}',${need})`);
  assert.equal(result?.ok,true,`${key} queue: ${JSON.stringify(result)}`);
  assert.equal(result.qty,need);
  waitFor(run,`(S.pool['${key}']||0)>=${target}`);
  assert.equal(run(`S.pool['${key}']`),target);
  return need;
}
function place(run,row,key,n,idx){
  assert.ok(run(`S.pool['${key}']||0`)>=n,`${key} pool too small`);
  assert.ok(run(`rowSlots('${row}')`)>idx,`${row} slot missing`);
  const before=run('formSoldierCount()');
  run(`openFormModal('expedition','${row}',${idx});S._formModalSel='${key}';S._formModalQty=${n};confirmForm()`);
  assert.equal(run('formSoldierCount()'),before+n,`${key} form rejected`);
}
function prepare(run,formation){
  const before=state(run);
  const beforePaid=run('({...__trainingSpend})');
  run("clrForm('expedition')");
  const required={};for(const [row,key,n] of formation)required[key]=(required[key]||0)+n;
  const trained={};for(const [key,n] of Object.entries(required))trained[key]=recruit(run,key,n);
  for(const [row,key,n,idx] of formation)place(run,row,key,n,idx);
  assert.equal(run('save().ok'),true);
  const after=state(run);
  const afterPaid=run('({...__trainingSpend})');
  const paid=Object.fromEntries(Object.entries(afterPaid).map(([rk,n])=>[rk,n-(beforePaid[rk]||0)]).filter(([,n])=>n!==0));
  return{before,after,trained,paid,seconds:after.second-before.second};
}
function fight(env,stage,target){
  const run=env.run;
  const candidate=configure(run,stage,target);
  const before=state(run);
  assert.equal(run(`campaignStageSelectable(${stage-1})`),true);
  assert.equal(run(`selEnemy(${stage-1})`),true);
  run('openBattle()');assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callback limit');
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=state(run);
  const battle=run('({round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})');
  assert.equal(after.second,before.second);
  assert.equal(run(`S.defeated.includes(${stage})`),won);
  const raw=env.store.get('rts_save');assert.ok(raw);
  const reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run(`S.defeated.includes(${stage})`),won);
  assert.equal(reload.run('armyCount()'),after.army);
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  run('exitBattle()');
  return{stage,candidate,won,before:{army:before.army,deployed:before.deployed},
    after:{army:after.army,deployed:after.deployed},loss:before.deployed-after.deployed,
    enemyHp:battle.enemyHp,round:battle.round,callbacks,saveSha256:sha(raw),rngEnd:run('__rng'),raw};
}
function compactFight(x){const{raw,...other}=x;return other}
const formations={
  alloyArcher:[['front','alloy_special',40,0],['mid','archer',20,0],['back','archer',20,0]],
  alloyArmorArcher:[['front','alloy_special',40,0],['front','armored_trooper',40,1],['mid','archer',20,0],['back','archer',20,0]],
  armorArcher:[['front','armored_trooper',40,0],['mid','archer',20,0],['back','archer',20,0]],
  armorAlloy:[['front','armored_trooper',40,0],['front','alloy_special',40,1]]
};
const stage96=[];
const failedRetries=[];
let paidVictoryCheckpoint=null;
for(const [strategy,formation] of Object.entries(formations))for(const seed of seeds){
  const env=make('failed',seed),run=env.run;
  assert.equal(run('S.defeated.includes(95)'),true);
  assert.equal(run('S.defeated.includes(96)'),false);
  const prep=prepare(run,formation),fight1=fight(env,96,450);
  stage96.push({strategy,seed,prep,first:compactFight(fight1)});
  if(strategy==='armorAlloy'&&seed===9&&fight1.won){
    const file='p394-stage96-armor-alloy-seed9-paid-win-save.json';
    fs.writeFileSync(path.join(data,file),fight1.raw,'utf8');
    paidVictoryCheckpoint={file,sha256:sha(fight1.raw),stage96Won:true,
      second:run('S.tick'),army:run('armyCount()')};
  }
  if(strategy==='alloyArcher'&&!fight1.won){
    const retryEnv=make('failed',seed+100,fight1.raw),retryRun=retryEnv.run;
    assert.equal(retryRun('S.defeated.includes(96)'),false);
    const retryPrep=prepare(retryRun,formations.armorAlloy);
    const retry=fight(retryEnv,96,450);
    failedRetries.push({initialSeed:seed,retrySeed:seed+100,initialSaveSha256:fight1.saveSha256,
      prep:retryPrep,retry:compactFight(retry)});
  }
}
const summary=Object.keys(formations).map(strategy=>{
  const x=stage96.filter(r=>r.strategy===strategy),wins=x.filter(r=>r.first.won);
  return{strategy,wins:wins.length,of:x.length,meanLoss:x.reduce((n,r)=>n+r.first.loss,0)/x.length,
    meanWinLoss:wins.length?wins.reduce((n,r)=>n+r.first.loss,0)/wins.length:null,
    meanFailedEnemyHp:x.length>wins.length?x.filter(r=>!r.first.won).reduce((n,r)=>n+r.first.enemyHp,0)/(x.length-wins.length):null};
});
const early=[];
for(const strategy of ['alloyArcher','armorAlloy'])for(const seed of seeds){
  const env=make('early',seed),run=env.run;
  assert.equal(run('S.defeated.includes(89)'),true);
  assert.equal(run('S.defeated.includes(90)'),false);
  const prep90=prepare(run,formations[strategy]);
  const battle90=fight(env,90,165);
  let prep91=null,battle91=null;
  if(battle90.won){
    prep91=prepare(run,formations[strategy]);
    battle91=fight(env,91,180);
  }
  early.push({strategy,seed,prep90,battle90:compactFight(battle90),prep91,battle91:battle91&&compactFight(battle91)});
}
const earlySummary=['alloyArcher','armorAlloy'].map(strategy=>{
  const rows=early.filter(r=>r.strategy===strategy),both=rows.filter(r=>r.battle90.won&&r.battle91?.won);
  return{strategy,stage90Wins:rows.filter(r=>r.battle90.won).length,stage91Wins:rows.filter(r=>r.battle91?.won).length,
    bothWins:both.length,of:rows.length,meanStage90Loss:rows.reduce((n,r)=>n+r.battle90.loss,0)/rows.length,
    meanStage91Loss:both.length?both.reduce((n,r)=>n+r.battle91.loss,0)/both.length:null,
    maxTotalPrepSeconds:Math.max(...rows.map(r=>r.prep90.seconds+(r.prep91?.seconds||0)))};
});
const rushed91=[];
for(const seed of seeds){
  const env=make('early',seed),run=env.run;
  const prep90=prepare(run,formations.alloyArcher);
  const battle90=fight(env,90,165);
  assert.equal(battle90.won,true);
  const battle91=fight(env,91,180);
  let recovery=null;
  if(!battle91.won){
    const retryEnv=make('early',seed+200,battle91.raw),retryRun=retryEnv.run;
    const prep=prepare(retryRun,formations.alloyArcher);
    const retry=fight(retryEnv,91,180);
    recovery={seed:seed+200,prep,retry:compactFight(retry)};
  }
  rushed91.push({seed,prep90,battle90:compactFight(battle90),unreplenished91:compactFight(battle91),recovery});
}
const rushedArmor91=[];
for(const seed of seeds){
  const env=make('early',seed),run=env.run;
  const prep90=prepare(run,formations.armorAlloy);
  const battle90=fight(env,90,165);
  assert.equal(battle90.won,true);
  const battle91=fight(env,91,180);
  rushedArmor91.push({seed,prep90,battle90:compactFight(battle90),unreplenished91:compactFight(battle91)});
}
const result={kind:'stage 96 low paid failure recovery and stage 90/91 first-clear sensitivity',head,mode,
  inputs:Object.fromEntries(Object.entries(inputs).map(([key,{file,sha256}])=>[key,{file,sha256}])),
  sourceHashes,seeds,formations,summary,paidVictoryCheckpoint,failedRetries,
  retrySummary:{wins:failedRetries.filter(r=>r.retry.won).length,of:failedRetries.length,
    meanRetryLoss:failedRetries.length?failedRetries.reduce((n,r)=>n+r.retry.loss,0)/failedRetries.length:null},
  earlySummary,earlyRows:early,rushed91Summary:{
    unreplenishedWins:rushed91.filter(r=>r.unreplenished91.won).length,of:rushed91.length,
    recovered:rushed91.filter(r=>r.recovery?.retry.won).length,
    attemptedRecovery:rushed91.filter(r=>r.recovery).length},rushed91,
  rushedArmor91Summary:{unreplenishedWins:rushedArmor91.filter(r=>r.unreplenished91.won).length,
    of:rushedArmor91.length,meanStage90Loss:rushedArmor91.reduce((n,r)=>n+r.battle90.loss,0)/rushedArmor91.length,
    meanStage91Loss:rushedArmor91.reduce((n,r)=>n+r.unreplenished91.loss,0)/rushedArmor91.length},
  rushedArmor91,rows:stage96};
const out=path.join(data,`p394-stage96-low-${mode}.json`);
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
for(const {file,sha256} of sourceHashes)assert.equal(sha(fs.readFileSync(path.join(root,file))),sha256,file);
for(const {file,sha256} of Object.values(result.inputs))assert.equal(sha(fs.readFileSync(path.join(data,file))),sha256,file);
if(paidVictoryCheckpoint)assert.equal(sha(fs.readFileSync(path.join(data,paidVictoryCheckpoint.file))),paidVictoryCheckpoint.sha256);
console.log(JSON.stringify({out,summary,retrySummary:result.retrySummary,earlySummary,rushed91Summary:result.rushed91Summary,
  rushedArmor91Summary:result.rushedArmor91Summary},null,2));
