'use strict';
// P405 compact continuous campaign replay from the P404 level-50 paid win.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p404-l50-armory-and-bows-final-save.json';
const outDir='docs/codex/reports/data';
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',input];
const hashBytes=s=>crypto.createHash('sha256').update(s).digest('hex');
const hash=f=>hashBytes(fs.readFileSync(path.join(root,f)));
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const sourceRaw=fs.readFileSync(path.join(root,input),'utf8').trim();
const copy=x=>JSON.parse(JSON.stringify(x));
const types=['archer_silverbow','bronze_guard','iron_spearman','silver_heavy','gold_cavalry'];
const bowWorkers={food:13,wood:4,stone:2};
const copperWorkers={food:11,coal:4,copper:2,stone:2};
const ironWorkers={food:11,coal:2,iron:2,stone:2,wood:2};
const silverWorkers={food:14,coal:1,silver:1,stone:1,wood:2};
const goldWorkers={food:14,coal:1,gold:1,stone:1,wood:2};
const bronzeArmy=[['front','bronze_guard',10],['front','bronze_guard',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10]];
const fullArmy=[['front','gold_cavalry',10],['front','gold_cavalry',7],
  ['front','silver_heavy',10],['front','silver_heavy',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10]];
function members(form){return['front','mid','back'].reduce((n,row)=>n+form[row].reduce((m,u)=>m+u.count,0),0)}

function session(raw){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(env.store.get('rts_save'),raw);
  const ts=JSON.parse(raw).ts;
  run(`(()=>{
    const g=globalThis,NativeDate=Date;
    g.__p405={now:${ts},timerNow:0,nextTickMs:CFG.tickMs,timerId:1,timers:new Map(),charges:[]};
    g.Date=class extends NativeDate{static now(){return g.__p405.now}};
    g.Math.random=()=>0.5;
    const nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return nodes.get(id)
    };
    g.addLog=m=>S.log.push(String(m));
    const originalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{g.__p405.charges.push({cost:{...cost},n,tick:S.tick});return originalPay(cost,n)};
    const originalTick=tick;
    g.tick=function(){const result=originalTick();g.__p405.now+=1000;return result};
    g.setTimeout=(fn,delay=0)=>{const p=g.__p405,id=p.timerId++;
      p.timers.set(id,{fn,at:p.timerNow+Math.max(0,Number(delay)||0)});return id};
    g.clearTimeout=id=>g.__p405.timers.delete(id);
    g.__p405Step=()=>{
      const p=g.__p405;let selected=null;
      for(const [id,timer]of p.timers)
        if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
          selected={id,timer};
      if(!selected)return false;
      while(p.nextTickMs<=selected.timer.at){p.timerNow=p.nextTickMs;g.tick();p.nextTickMs+=CFG.tickMs}
      p.timerNow=Math.max(p.timerNow,selected.timer.at);
      p.timers.delete(selected.id);selected.timer.fn();return true;
    };
  })()`);
  let online=0;
  const state=()=>copy(run(`({tick:S.tick,defeated:S.defeated.length,merit:S.merit,
    res:{...S.res},pool:{...S.pool},formation:JSON.parse(JSON.stringify(S.formation)),
    popAlloc:{...S.popAlloc},queue:JSON.parse(JSON.stringify(S.queue))})`));
  const own=type=>run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
  const saveReload=label=>{
    assert.equal(run('save().ok'),true,`save ${label}`);
    const saved=env.store.get('rts_save'),fresh=environment({rts_save:saved});
    assert.equal(fresh.run('loadSaveAndApply().status'),'ok',label);
    for(const expr of ['S.defeated','S.tick','S.res','S.merit','S.essence','S.sciences',
      'S.buildings','S.formation','S.pool','S.queue','S.popAlloc'])
      assert.deepEqual(copy(fresh.run(expr)),copy(run(expr)),`${label}: ${expr}`);
    return saved;
  };
  const wait=seconds=>{
    assert.ok(Number.isSafeInteger(seconds)&&seconds>=0);
    run(`for(let i=0;i<${seconds};i++)tick()`);online+=seconds;
  };
  const setWorkers=target=>{
    const prev=copy(run('({...S.popAlloc})'));
    for(const [rk,n] of Object.entries(prev))if(n>0)
      assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true,`release ${rk}`);
    for(const [rk,n] of Object.entries(target))if(n>0)
      assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true,`assign ${rk}`);
    assert.ok(run('popAllocTotal()<=popCurrent()'));
  };
  const fill=(type,target,workers)=>{
    setWorkers(workers);
    const before=own(type),pending=run(`S.queue['${type}']?.count||0`);
    const missing=target-before-pending;
    if(missing>0){
      const result=copy(run(`train('${type}',${missing})`));
      assert.equal(result?.ok,true,`queue ${missing} ${type}: ${JSON.stringify(result)}`);
      assert.equal(result.qty,missing,`queue ${type} was truncated`);
    }
    let waited=0;
    while(own(type)<target&&waited<20000){wait(10);waited+=10}
    assert.equal(own(type),target,`train ${type} to ${target} timed out after ${waited}s: ${JSON.stringify(state())}`);
    saveReload(`trained ${type}`);
    return{type,before,target,queued:Math.max(0,missing),seconds:waited};
  };
  const form=army=>{
    run("clrForm('expedition')");
    const indexes={front:0,mid:0,back:0};
    for(const [row,type,count]of army){
      const index=indexes[row]++;
      assert.ok(run(`rowSlots('${row}')`)>index);
      assert.ok(run(`(S.pool['${type}']||0)>=${count}`));
      run(`openFormModal('expedition','${row}',${index});
        S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
      assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),true);
    }
    saveReload('formation ready');
  };
  const battle=stage=>{
    const before=state(),ownedBefore=Object.fromEntries(types.map(type=>[type,own(type)]));
    const lock=run(`campaignStageLockReason(${stage-1})`);
    if(lock)return{stage,blocked:true,lock,armyBefore:members(before.formation),state:before};
    assert.equal(run(`selEnemy(${stage-1})`),true);
    const timerBefore=run('__p405.timerNow');
    run('openBattle()');
    assert.equal(run('S.battleActive'),true,`L${stage} launched`);
    const enemy=copy(run('({name:B.enemyCfg.name,groups:B.enemyUnits.length,soldiers:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0),0)})'));
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__p405Step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false,`L${stage} callback bound`);
    const won=run(`hasLevelDefeated(${stage-1})`),round=run('B.round');
    const battleMs=run('__p405.timerNow')-timerBefore;
    const enemyRemaining=copy(run(`B.enemyUnits.filter(u=>u.alive!==false).map(u=>
      ({type:u.type,row:u.row,hp:u.hp,maxHp:u.maxHp,count:u.initialCount}))`));
    run('exitBattle()');
    const saved=saveReload(`L${stage} ${won?'win':'loss'}`),after=state();
    const ownedAfter=Object.fromEntries(types.map(type=>[type,own(type)]));
    const losses=Object.fromEntries(types.map(type=>[type,ownedBefore[type]-ownedAfter[type]]));
    return{stage,won,round,callbacks,battleMs,enemy,enemyRemaining,
      armyBefore:members(before.formation),armyAfter:members(after.formation),losses,
      tickBefore:before.tick,tickAfter:after.tick,meritBefore:before.merit,meritAfter:after.merit,
      resBefore:before.res,resAfter:after.res,saveSha256:hashBytes(saved)};
  };
  const refill=mode=>{
    const fills=[];
    fills.push(fill('archer_silverbow',40,bowWorkers));
    fills.push(fill('bronze_guard',20,copperWorkers));
    if(mode==='full'){
      fills.push(fill('iron_spearman',20,ironWorkers));
      fills.push(fill('silver_heavy',20,silverWorkers));
      fills.push(fill('gold_cavalry',17,goldWorkers));
    }
    form(mode==='full'?fullArmy:bronzeArmy);
    return fills;
  };
  const charges=()=>{
    const paid={};
    for(const row of copy(run('__p405.charges')))
      for(const [rk,n] of Object.entries(row.cost))paid[rk]=(paid[rk]||0)+n*row.n;
    return paid;
  };
  return{run,wait,state,own,saveReload,setWorkers,fill,form,battle,refill,charges,
    raw:()=>env.store.get('rts_save'),online:()=>online};
}

function main(){
const lines=[];
const checkpoints={};
const milestone=new Set([56,57,59,60,70,80,90,99,100]);
function checkpoint(stage,raw){
  if(!milestone.has(stage))return;
  const name=`${outDir}/p405-mainline-l${stage}-save.json`;
  fs.writeFileSync(path.join(root,name),raw+'\n');
  checkpoints[stage]={path:name,sha256:hash(name)};
}
let routeRaw=sourceRaw,routeStage=50,totalOnline=0,totalBattleMs=0;
let failure=null;
try{
  // First use the P404 surviving army without replacement; L57 requires a paid refill.
  const opening=session(routeRaw);
  for(let stage=51;stage<=56;stage++){
    const battle=opening.battle(stage);
    assert.equal(battle.won,true,`unrefilled L${stage}`);
    routeRaw=opening.raw();routeStage=stage;totalBattleMs+=battle.battleMs;
    lines.push({stage,mode:'unrefilled',online:0,paid:{},fills:[],...battle});
  }
  checkpoint(56,routeRaw);
  const unrefilled57=session(routeRaw),noRefill=unrefilled57.battle(57);
  lines.push({stage:57,mode:'unrefilled-control',online:0,paid:{},fills:[],...noRefill});
  assert.equal(noRefill.won,false,'expected L57 unrefilled loss changed');
  for(let stage=57;stage<=100;stage++){
    const gate=session(routeRaw).run(`campaignStageLockReason(${stage-1})`);
    if(gate){lines.push({stage,mode:'gate',blocked:true,lock:gate,inputSha256:hashBytes(routeRaw)});break}
    const options=['bronze','full'];
    let advanced=false;
    for(const mode of options){
      const candidate=session(routeRaw),fills=candidate.refill(mode);
      if(stage===80&&mode==='full'){
        const readyPath=`${outDir}/p405-mainline-l80-full-ready-save.json`;
        fs.writeFileSync(path.join(root,readyPath),candidate.raw()+'\n');
        checkpoints.l80Ready={path:readyPath,sha256:hash(readyPath)};
      }
      const battle=candidate.battle(stage);
      const row={stage,mode,online:candidate.online(),paid:candidate.charges(),fills,
        inputSha256:hashBytes(routeRaw),...battle};
      lines.push(row);
      if(battle.won){
        routeRaw=candidate.raw();routeStage=stage;
        totalOnline+=row.online;totalBattleMs+=battle.battleMs;
        checkpoint(stage,routeRaw);
        console.log(JSON.stringify({stage,mode,won:true,online:row.online,armyBefore:battle.armyBefore,
          armyAfter:battle.armyAfter,round:battle.round,losses:battle.losses}));
        advanced=true;break;
      }
      console.log(JSON.stringify({stage,mode,won:false,armyBefore:battle.armyBefore,
        armyAfter:battle.armyAfter,round:battle.round}));
    }
    if(!advanced)break;
  }
}catch(error){failure=String(error.stack||error);console.error(failure)}
const finalPath=`${outDir}/p405-mainline-continuous-final-save.json`;
fs.writeFileSync(path.join(root,finalPath),routeRaw+'\n');
const ledgerPath=`${outDir}/p405-mainline-continuous-ledger.jsonl`;
fs.writeFileSync(path.join(root,ledgerPath),lines.map(x=>JSON.stringify(x)).join('\n')+'\n');
const wins=lines.filter(x=>x.won),paid={};
for(const row of wins)for(const [rk,n]of Object.entries(row.paid||{}))paid[rk]=(paid[rk]||0)+n;
const summary={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'One fixed Math.random=0.5 stream; real selected stage, queued production charges, formation, battle callbacks, settlement, save and independent v36 reload; no direct game-state injection',
  units:'online is simulated noncombat tick seconds; battleMs is simulated callback milliseconds; menu operations are instant in the harness',
  routeStage,totalOnline,totalBattleMs,paid,wins:wins.length,attempts:lines.length,
  stop:lines.at(-1),checkpoints,finalPath,finalSha256:hash(finalPath),ledgerPath,
  failure};
fs.writeFileSync(path.join(root,`${outDir}/p405-mainline-continuous.json`),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash,'source/input changed during replay');
if(failure)process.exitCode=1;
}

if(require.main===module)main();
module.exports={session,hashBytes,hash,sourceHash,input,sourceRaw};
