'use strict';
// Four P398 paid L10 saves: real queues, production, battles and L20 frontier.
// Development harness only. Never modifies a player's rts_save or runtime code.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const ids=['economic','balanced','military','short-session'];
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-four-strategy-l20-p399.js'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const sourceBefore=Object.fromEntries(sourceFiles.map(file=>[file,sha(file)]));
const prior=JSON.parse(fs.readFileSync(path.join(dataDir,'p398-four-strategy-iron-battle.json'),'utf8'));
assert.equal(prior.batch,'P398');

function checked(run,expression,label){
  const out=run(expression);
  assert.equal(out?.ok,true,label+': '+JSON.stringify(out));
  return out;
}
function setup(run,active,offline,session){
  run(`(()=>{
    const g=globalThis,NativeDate=Date;
    g.__p398={active:${active},offline:${offline},session:${session?'true':'false'},
      nextPause:${session?(Math.floor(active/600)+1)*600:0},pending:false,
      virtualNow:JSON.parse(localStorage.getItem('rts_save')).ts,
      timerNow:0,nextTickMs:CFG.tickMs,timerId:1,timers:new Map(),
      inBattle:false,inScheduler:false,settling:false,offlineWindows:[],trainingCharges:[]};
    g.Date=class extends NativeDate{static now(){return g.__p398.virtualNow}};
    g.Math.random=()=>0.5;
    g.__p398Nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!g.__p398Nodes.has(id))g.__p398Nodes.set(id,{style:{},innerHTML:'',textContent:'',
        scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return g.__p398Nodes.get(id);
    };
    g.addLog=m=>S.log.push(String(m));
    const originalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{g.__p398.trainingCharges.push({cost:{...cost},n,tick:S.tick});
      return originalPay(cost,n)};
    const originalTick=tick;
    g.__p398Settle=reason=>{
      const p=g.__p398;
      if(!p.pending||p.inBattle)return null;
      const saved=save();if(!saved?.ok)throw Error('pre-offline save failed');
      const beforeTick=S.tick;
      p.virtualNow=Number(_loadedTs)+28800000;
      p.settling=true;
      let result;
      try{result=settleOffline()}finally{p.settling=false}
      if(!result?.ok||result.durationSec!==28800)
        throw Error('offline settlement failed: '+JSON.stringify(result));
      p.offline+=result.durationSec;
      p.offlineWindows.push({reason,active:p.active,durationSec:result.durationSec,
        tickBefore:beforeTick,tickAfter:S.tick});
      p.nextPause=(Math.floor(p.active/600)+1)*600;
      p.pending=false;
      return result;
    };
    g.tick=function(){
      if(g.__p398.settling||_saveProtected)return originalTick();
      const result=originalTick(),p=g.__p398;
      p.active++;
      if(!p.inScheduler)p.virtualNow+=1000;
      if(p.session&&p.active>=p.nextPause)p.pending=true;
      if(p.pending&&!p.inBattle)g.__p398Settle('tick-boundary');
      return result;
    };
    g.setTimeout=(fn,delay=0)=>{const p=g.__p398,id=p.timerId++;
      p.timers.set(id,{fn,at:p.timerNow+Math.max(0,Number(delay)||0)});return id};
    g.clearTimeout=id=>g.__p398.timers.delete(id);
    g.__p398Step=()=>{
      const p=g.__p398;let selected=null;
      for(const [id,timer]of p.timers)
        if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
          selected={id,timer};
      if(!selected)return false;
      while(p.nextTickMs<=selected.timer.at){
        const delta=p.nextTickMs-p.timerNow;p.timerNow=p.nextTickMs;
        p.virtualNow+=delta;p.inScheduler=true;
        try{g.tick()}finally{p.inScheduler=false}
        p.nextTickMs+=CFG.tickMs;
      }
      if(selected.timer.at>p.timerNow){p.virtualNow+=selected.timer.at-p.timerNow;
        p.timerNow=selected.timer.at}
      p.timers.delete(selected.id);selected.timer.fn();return true;
    };
  })()`);
}
function clock(run){return run(`({active:__p398.active,offline:__p398.offline,
  elapsed:__p398.active+__p398.offline,tick:S.tick,
  offlineWindows:__p398.offlineWindows.slice()})`)}
function snapshot(run){return run(`({tick:S.tick,population:popCurrent(),resources:{...S.res},
  workers:{...S.popAlloc},pool:{...S.pool},
  owned:Object.fromEntries(['iron_spearman','bronze_guard','archer','infantry']
    .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
  queue:JSON.parse(JSON.stringify(S.queue)),
  formation:JSON.parse(JSON.stringify(S.formation)),
  defeated:S.defeated.length})`)}
function setWorkers(run,target){
  const before=run('({...S.popAlloc})');
  for(const [key,count]of Object.entries(before))if(count>0)
    checked(run,`setPopAlloc('${key}',0)`,'remove worker '+key);
  for(const [key,count]of Object.entries(target))if(count>0)
    checked(run,`setPopAlloc('${key}',${count})`,'assign worker '+key);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function wait(run,seconds){
  assert.ok(Number.isSafeInteger(seconds)&&seconds>=0);
  run(`for(let i=0;i<${seconds};i++)tick()`);
}
function owned(run,type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function fillTo(run,target,maxSeconds,label){
  const keys=Object.keys(target),before=clock(run),ledger=[];
  for(const [type,qty]of Object.entries(target)){
    const needed=qty-owned(run,type)-(run(`S.queue['${type}']?.count||0`));
    if(needed>0){const result=checked(run,`train('${type}',${needed})`,'train '+type);
      ledger.push({type,requested:needed,result})}
  }
  let waited=0,lastProgress=0,lastTotal=keys.reduce((sum,k)=>sum+Math.min(target[k],owned(run,k)),0);
  while(keys.some(k=>owned(run,k)<target[k])){
    if(waited>=maxSeconds)break;
    wait(run,10);waited+=10;
    const total=keys.reduce((sum,k)=>sum+Math.min(target[k],owned(run,k)),0);
    if(total>lastTotal){lastTotal=total;lastProgress=waited}
    if(waited-lastProgress>=600)break;
  }
  return{label,target,ledger,waited,complete:keys.every(k=>owned(run,k)>=target[k]),
    before,after:clock(run),owned:Object.fromEntries(keys.map(k=>[k,owned(run,k)])),
    queue:Object.fromEntries(keys.map(k=>[k,run(`S.queue['${k}']?.count||0`)])),
    reasons:Object.fromEntries(keys.map(k=>[k,run(`S.queue['${k}']?.reason||''`)])),
    resources:run('({...S.res})')};
}
function place(run,row,type,count,idx){
  if(count<=0)return;
  assert.ok(run(`rowSlots('${row}')`)>idx,'slot locked '+row+idx);
  assert.ok(run(`S.pool['${type}']||0`)>=count,'insufficient '+type);
  run(`openFormModal('expedition','${row}',${idx});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
function form(run,stage){
  run("clrForm('expedition')");
  const target=stage>=17?20:10;
  const iron=Math.min(target,run('S.pool.iron_spearman||0'));
  const bronze=Math.min(target,run('S.pool.bronze_guard||0'));
  const archer=Math.min(stage>=17?20:13,run('S.pool.archer||0'));
  if(stage>=17){
    // Barracks Lv1 permits 10 per regiment; L15 unlocks the sixth slot.
    // Split each paid 20-person roster into legal 10-person regiments.
    assert.equal(iron,20);assert.equal(bronze,20);assert.equal(archer,20);
    place(run,'front','iron_spearman',10,0);
    place(run,'front','bronze_guard',10,1);
    place(run,'mid','iron_spearman',10,0);
    place(run,'mid','bronze_guard',10,1);
    place(run,'back','archer',10,0);
    place(run,'back','archer',10,1);
  }else{
    place(run,'front','iron_spearman',iron,0);
    place(run,'front','bronze_guard',bronze,1);
    place(run,'back','archer',Math.min(10,archer),0);
    place(run,'mid','archer',Math.min(10,Math.max(0,archer-10)),0);
  }
  return{iron,bronze,archer,deployed:run(`S.formation.front.concat(S.formation.mid,S.formation.back)
    .reduce((n,u)=>n+(u.count||0),0)`)};
}
function battle(run,stage){
  assert.equal(run('S.defeated.length'),stage-1,'cannot skip stage');
  const deployed=form(run,stage),before=snapshot(run),clockBefore=clock(run);
  run(`__p398.inBattle=true;selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,'battle did not open');
  const enemy=run(`({name:B.enemyCfg.name,boss:!!B.enemyCfg.boss,
    totalTroops:B.enemyUnits.reduce((n,u)=>n+(u.initialCount||0),0),
    totalHp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){
    assert.equal(run('__p398Step()'),true,'lost battle callback');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle did not settle');
  const win=run(`hasLevelDefeated(${stage-1})`),round=run('B.round');
  run('exitBattle();__p398.inBattle=false');
  if(run('__p398.pending'))run("__p398Settle('post-battle')");
  const after=snapshot(run),clockAfter=clock(run);
  checked(run,'save()','save battle result');
  const losses=Object.fromEntries(Object.keys(before.owned)
    .map(k=>[k,Math.max(0,before.owned[k]-after.owned[k])]));
  return{stage,win,round,callbacks,enemy,deployed,
    before:{tick:before.tick,pool:before.pool,owned:before.owned,resources:before.resources,defeated:before.defeated},
    after:{tick:after.tick,pool:after.pool,owned:after.owned,resources:after.resources,defeated:after.defeated},
    losses,
    clockBefore,clockAfter};
}
function upgradeToLv2(run,key){
  const before=clock(run),result={key,before,cost:run(`upCost('${key}')`),waited:0};
  assert.equal(run(`bldSt('${key}').lv`),1,'upgrade source level '+key);
  while(result.waited<=4800){
    const attempt=run(`buildAct('${key}')`);
    if(attempt?.ok){
      result.action=attempt;
      while(run(`bldSt('${key}').state`)!=='idle'&&result.waited<=4800){wait(run,10);result.waited+=10}
      result.after=clock(run);
      result.level=run(`bldSt('${key}').lv`);
      result.complete=result.level===2;
      return result;
    }
    if(attempt?.reason!=='resources'){
      result.action=attempt;result.after=clock(run);result.complete=false;return result;
    }
    wait(run,10);result.waited+=10;
  }
  result.after=clock(run);result.complete=false;result.reason='4800-second-material-frontier';
  return result;
}
function route(id){
  const inputFile=`docs/codex/reports/data/p398-four-strategy-${id}-iron-battle-save.json`;
  const raw=fs.readFileSync(path.join(root,inputFile),'utf8').trim();
  const saveHash=sha(inputFile);
  assert.equal(saveHash,prior.results[id].outputSha256,
    'L10 checkpoint differs from P398 ledger');
  const initialClock=prior.results[id].finalClock;
  const active=initialClock.active;
  const offline=initialClock.offline;
  const e=environment({rts_save:raw}),run=e.run;
  const load=run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(load.status),'load '+JSON.stringify(load));
  const migration={status:load.status,filled:load.filled,
    sourceVersion:JSON.parse(raw).v,
    loadedVersion:JSON.parse(e.store.get('rts_save')).v,
    preMigrationPreserved:e.store.get('rts_save_premigration')===raw,
    normalBackupPreserved:e.store.get('rts_save_backup_1')===raw};
  if(load.status==='migrated'){
    assert.equal(migration.preMigrationPreserved,true,'v33 original must be protected');
    assert.equal(migration.normalBackupPreserved,true,'migration backup must retain v33 original');
  }
  assert.equal(run('S.defeated.length'),10);
  setup(run,active,offline,id==='short-session');
  const initial=snapshot(run),firstStage=initial.defeated+1;
  const ironWorkers=id==='military'?{wood:3,stone:3,food:7,coal:3,iron:2}
    :{wood:4,stone:3,food:7,coal:3,iron:2};
  setWorkers(run,ironWorkers);
  const ironSupply=fillTo(run,{iron_spearman:10},4800,'iron-front');
  const bronzeWorkers=id==='military'?{wood:3,stone:3,food:7,coal:3,copper:2}
    :{wood:4,stone:3,food:7,coal:3,copper:2};
  setWorkers(run,bronzeWorkers);
  const supportSupply=fillTo(run,{bronze_guard:10,archer:13},4800,'bronze-and-archers');
  const battles=[],between=[],upgrades=[];
  if(ironSupply.complete&&supportSupply.complete){
    for(let stage=firstStage;stage<=20;stage++){
      if(stage===17){
        setWorkers(run,bronzeWorkers);
        for(const key of ['iron_forge','bronze_workshop','archer_range']){
          const up=upgradeToLv2(run,key);upgrades.push(up);
          if(!up.complete)break;
        }
        if(upgrades.length!==3||upgrades.some(up=>!up.complete))break;
      }
      if(stage>firstStage){
        // Iron and copper recipes draw from the same coal/stone stream. Refill
        // them in separate real workforce phases, as for the first rematch.
        setWorkers(run,ironWorkers);
        const target=stage>=17?20:10;
        const ironRefill=fillTo(run,{iron_spearman:target},4800,'after-win-iron-'+stage);
        setWorkers(run,bronzeWorkers);
        const supportRefill=fillTo(run,{bronze_guard:target,archer:stage>=17?20:13},4800,
          'after-win-support-'+stage);
        between.push({stage,ironRefill,supportRefill});
        if(!ironRefill.complete||!supportRefill.complete)break;
      }
      const fought=battle(run,stage);battles.push(fought);
      if(!fought.win)break;
    }
  }
  checked(run,'save()','save final battle route');
  const finalSave=run("localStorage.getItem('rts_save')"),final=snapshot(run),finalClock=clock(run);
  const outputFile=`docs/codex/reports/data/p399-four-strategy-${id}-l20-save.json`;
  fs.writeFileSync(path.join(root,outputFile),finalSave+'\n');
  const reloaded=environment({rts_save:finalSave});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.defeated.length'),final.defeated);
  assert.equal(reloaded.run('S.pool.iron_spearman'),final.pool.iron_spearman);
  const trainingCharges=run('JSON.parse(JSON.stringify(__p398.trainingCharges))');
  const paidTraining={iron:0,bronze:0,archer:0,other:0};
  for(const row of trainingCharges){
    const c=row.cost;
    if(c.iron===100&&c.food===500)paidTraining.iron+=row.n;
    else if(c.copper===100&&c.food===300)paidTraining.bronze+=row.n;
    else if(c.wood===80&&c.stone===20&&c.food===30)paidTraining.archer+=row.n;
    else paidTraining.other+=row.n;
  }
  assert.equal(paidTraining.other,0,'unexpected paid troop in this probe');
  return{inputFile,inputSha256:saveHash,migration,
    initialClock:{active,offline,elapsed:active+offline},
    initial,firstStage,workers:{iron:ironWorkers,support:bronzeWorkers},
    ironSupply,supportSupply,upgrades,between,battles,final,finalClock,
    trainingCharges,paidTraining,
    outputFile,outputSha256:sha(outputFile)};
}

const results={};
for(const id of ids){
  try{results[id]=route(id)}catch(error){results[id]={error:String(error.stack||error)};console.error(id,results[id].error)}
}
assert.ok(ids.every(id=>!results[id].error),'at least one campaign route failed');
const sourceAfter=Object.fromEntries(sourceFiles.map(file=>[file,sha(file)]));
assert.deepEqual(sourceAfter,sourceBefore,'source changed during four-route replay');
const artifact={batch:'P399',probe:'paid-l10-l20-frontier',sourceSha256:sourceBefore,
  unit:'active online seconds, settled offline seconds, elapsed simulated seconds; scripted menu actions instantaneous',
  method:'four P398 real-paid L10 saves; real role allocation, queues, production, battle callbacks, losses and saves; fixed battle random 0.5; natural garrison frozen',
  results};
const outputPath=path.join(dataDir,'p399-four-strategy-l20.json');
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:artifact.batch,probe:artifact.probe,
  runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
    .map(file=>[file,sourceBefore[file]])),
  routes:Object.fromEntries(ids.map(id=>[id,{firstStage:results[id].firstStage,
    migration:results[id].migration,
    ironSupply:{complete:results[id].ironSupply.complete,waited:results[id].ironSupply.waited,
      owned:results[id].ironSupply.owned,reasons:results[id].ironSupply.reasons},
    supportSupply:{complete:results[id].supportSupply.complete,waited:results[id].supportSupply.waited,
      owned:results[id].supportSupply.owned,reasons:results[id].supportSupply.reasons},
    upgrades:results[id].upgrades.map(u=>({key:u.key,complete:u.complete,waited:u.waited,
      cost:u.cost,level:u.level,reason:u.reason,action:u.action})),
    battles:results[id].battles.map(b=>({stage:b.stage,win:b.win,round:b.round,
      deployed:b.deployed,losses:b.losses,
      clockAfter:{active:b.clockAfter.active,offline:b.clockAfter.offline}})),
    paidTraining:results[id].paidTraining,
    finalClock:{active:results[id].finalClock.active,offline:results[id].finalClock.offline},
    finalDefeated:results[id].final.defeated,
    outputSha256:results[id].outputSha256}])),dataFile:outputPath},null,2));
