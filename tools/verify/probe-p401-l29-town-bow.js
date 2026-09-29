'use strict';
// P401: paid continuation from P400's defeated L29 / paid T1 archer checkpoint.
// All changes to S go through real actions, production ticks, battle callbacks and saves.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p400-four-strategy-economic-tier1-archer-frontier-save.json';
const out='docs/codex/reports/data/p401-l29-town-bow.json';
const outSave='docs/codex/reports/data/p401-l29-town-bow-save.json';
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const sources=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',input];
const hashes=Object.fromEntries(sources.map(f=>[f,digest(f)]));
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const env=environment({rts_save:raw}),run=env.run;
const plain=x=>JSON.parse(JSON.stringify(x));
const events=[];
let online=0,battleMs=0;
function state(){return plain(run(`({tick:S.tick,defeated:S.defeated.length,merit:S.merit,
  pop:popCurrent(),res:{...S.res},essence:{...S.essence},workers:{...S.popAlloc},
  pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue)),
  outer:JSON.parse(JSON.stringify(S.development.outer)),
  buildings:JSON.parse(JSON.stringify(S.buildings)),upgraded:{...S.upgradedUnits}})`))}
function record(label,more={}){events.push({label,online,tick:run('S.tick'),...more,state:state()})}
function action(expr,label){
  const workerAction=/^(assign|release) /.test(label);
  const before=workerAction?plain(run('({...S.popAlloc})')):state();
  const result=plain(run(expr));
  events.push({label,online,tick:run('S.tick'),expression:expr,result,before,
    after:workerAction?plain(run('({...S.popAlloc})')):state()});
  assert.equal(result?.ok,true,label+': '+JSON.stringify(result));
  return result;
}
function wait(seconds){
  assert.ok(Number.isSafeInteger(seconds)&&seconds>=0);
  run(`for(let i=0;i<${seconds};i++)tick()`);online+=seconds;
}
function waitUntil(expr,max,label){
  let waited=0;
  while(!run(expr)&&waited<max){wait(10);waited+=10}
  events.push({label:'wait '+label,seconds:waited,online,tick:run('S.tick'),
    satisfied:!!run(expr),state:state()});
  if(!run(expr))throw Error(label+' timeout after '+waited+' seconds');
  return waited;
}
function setWorkers(target){
  const old=plain(run('({...S.popAlloc})'));
  for(const [rk,n]of Object.entries(old))if(n>0)action(`setPopAlloc('${rk}',0)`,'release '+rk);
  for(const [rk,n]of Object.entries(target))if(n>0)action(`setPopAlloc('${rk}',${n})`,'assign '+rk);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function own(type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function fill(target,label){
  for(const [type,n]of Object.entries(target)){
    const missing=n-own(type)-(run(`S.queue['${type}']?.count||0`));
    if(missing>0)action(`train('${type}',${missing})`,label+' train '+type);
  }
  waitUntil(Object.entries(target).map(([type,n])=>
    `(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')>=${n}`)
    .join('&&'),12000,label+' queue completion');
  return Object.fromEntries(Object.keys(target).map(type=>[type,own(type)]));
}
function place(row,type,count,index){
  assert.ok(run(`rowSlots('${row}')`)>index);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${index});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
function formation(archerType,includeInfantry=false){
  run("clrForm('expedition')");
  place('front','iron_spearman',10,0);
  place('front','bronze_guard',10,1);
  if(includeInfantry)place('front','infantry',10,2);
  place('mid','iron_spearman',10,0);
  place('mid','bronze_guard',10,1);
  place('back',archerType,10,0);
  place('back',archerType,10,1);
  return plain(run('JSON.parse(JSON.stringify(S.formation))'));
}
function fight(kind,archerType,includeInfantry=false){
  const before=state(),form=formation(archerType,includeInfantry),start=online;
  const ownedBefore=Object.fromEntries(['infantry','iron_spearman','bronze_guard','archer_t1','archer_silverbow']
    .map(type=>[type,own(type)]));
  const battleTickBefore=run('S.tick'),battleTimerBefore=run('__p401.timerNow');
  if(kind==='town')run("openDevelopmentOuter('town')");
  else{assert.equal(run('S.defeated.length'),kind-1);run(`selEnemy(${kind-1});openBattle()`)}
  assert.equal(run('S.battleActive'),true,'battle start '+kind);
  const enemy=plain(run(`({name:B.enemyCfg.name,alert:B.enemyCfg.alert||0,
    roster:B.enemyUnits.map(u=>({type:u.type,count:u.initialCount,hp:u.hp,atk:u.atk,def:u.def}))})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){
    assert.equal(run('__p401Step()'),true,'battle callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle timeout');
  const win=kind==='town'?run('S.development.outer.town.wins')>before.outer.town.wins:
    run(`hasLevelDefeated(${kind-1})`);
  const round=run('B.round');
  const battleTicks=run('S.tick')-battleTickBefore;
  const callbackMs=run('__p401.timerNow')-battleTimerBefore;
  battleMs+=callbackMs;
  run('exitBattle()');
  action('save()','save '+kind+' result');
  const after=state(),losses={};
  for(const type of ['infantry','iron_spearman','bronze_guard','archer_t1','archer_silverbow'])
    losses[type]=Math.max(0,ownedBefore[type]-own(type));
  const row={kind,win,round,callbacks,enemy,form,before,after,losses,
    battleTicks,callbackMs,battleSeconds:online-start};
  events.push({label:'battle '+kind,...row});
  return row;
}
function reload(label){
  action('save()','save before '+label);
  const saved=env.store.get('rts_save'),fresh=environment({rts_save:saved});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok',label);
  assert.equal(fresh.run('S.defeated.length'),run('S.defeated.length'));
  assert.equal(fresh.run('S.development.outer.town.wins'),run('S.development.outer.town.wins'));
  assert.deepEqual(plain(fresh.run('({...S.essence})')),plain(run('({...S.essence})')));
  events.push({label:'reload '+label,online,saveSha256:crypto.createHash('sha256').update(saved).digest('hex')});
}
const initialLoad=run('loadSaveAndApply()');
assert.equal(initialLoad.status,'ok');
assert.equal(run('S.defeated.length'),28);
assert.equal(run('S.upgradedUnits.archer_t1'),true);
run(`(()=>{
  const g=globalThis,NativeDate=Date;
  g.__p401={virtualNow:JSON.parse(localStorage.getItem('rts_save')).ts,
    timerNow:0,nextTickMs:CFG.tickMs,timerId:1,timers:new Map()};
  g.Date=class extends NativeDate{static now(){return g.__p401.virtualNow}};
  g.Math.random=()=>0.5;
  g.__p401Nodes=new Map();
  document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!g.__p401Nodes.has(id))g.__p401Nodes.set(id,{style:{},innerHTML:'',textContent:'',
      scrollHeight:0,scrollTop:0,className:'',
      classList:{add(){},remove(){},toggle(){},contains(){return false}},
      setAttribute(){},appendChild(){},remove(){}});
    return g.__p401Nodes.get(id)
  };
  g.addLog=m=>S.log.push(String(m));
  g.__p401.trainingCharges=[];
  const originalPay=payTrainingCost;
  payTrainingCost=(cost,n)=>{g.__p401.trainingCharges.push({cost:{...cost},n,tick:S.tick});
    return originalPay(cost,n)};
  const originalTick=tick;
  g.tick=function(){const result=originalTick();g.__p401.virtualNow+=1000;return result};
  g.setTimeout=(fn,delay=0)=>{const p=g.__p401,id=p.timerId++;
    p.timers.set(id,{fn,at:p.timerNow+Math.max(0,Number(delay)||0)});return id};
  g.clearTimeout=id=>g.__p401.timers.delete(id);
  g.__p401Step=()=>{
    const p=g.__p401;let selected=null;
    for(const [id,timer]of p.timers)
      if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
        selected={id,timer};
    if(!selected)return false;
    while(p.nextTickMs<=selected.timer.at){p.timerNow=p.nextTickMs;g.tick();p.nextTickMs+=CFG.tickMs}
    p.timerNow=Math.max(p.timerNow,selected.timer.at);
    p.timers.delete(selected.id);selected.timer.fn();return true;
  };
})()`);
record('loaded',{initialLoad,inputSha256:digest(input),woodCap:run("resCap('wood')"),
  techCap:run("resCap('tech')")});
let failure=null;
try{
  // Growth outlet 1: a real, affordable wood warehouse upgrade.
  const woodUpCost=plain(run("upCost('warehouse')"));
  if(run('S.res.wood')<woodUpCost.wood){
    setWorkers({wood:7,food:9,stone:3});
    waitUntil(`S.res.wood>=${woodUpCost.wood}`,5000,'wood for warehouse');
  }
  action("buildAct('warehouse')",'warehouse L2');
  waitUntil("bldSt('warehouse').lv>=2&&bldSt('warehouse').state==='idle'",120,'warehouse completion');
  record('wood capacity expanded',{woodCap:run("resCap('wood')"),woodUpCost});
  reload('warehouse');
  // Replenish the defeated P400 army with paid queues.
  setWorkers({wood:3,stone:3,food:8,coal:3,iron:2});
  fill({iron_spearman:20},'iron frontline');
  setWorkers({wood:3,stone:3,food:8,coal:3,copper:2});
  fill({bronze_guard:20,archer_t1:20},'bronze and T1 archer');
  reload('town entry army');
  const town=fight('town','archer_t1');
  reload('town result');
  if(town.win){
    // One town win tops up the existing one bow essence to the T2 requirement.
    assert.ok(run('S.essence.bow_essence')>=2);
    setWorkers({wood:6,stone:4,food:7,tech:2});
    const cost=plain(run("tierUpgradeCost('archer_range')"));
    waitUntil(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}&&S.res.food>=${cost.food}`,
      8000,'T2 camp materials');
    action("buildTierUpgradeAct('archer_range')",'archer camp T2');
    waitUntil("bldSt('archer_range').tier>=2&&bldSt('archer_range').state==='idle'",180,
      'T2 camp completion');
    const branch=plain(run('CFG.unitUpgrades.archer.tree.archer_t1.branches[0]'));
    waitUntil(`S.res.tech>=${branch.needTech}&&S.res.wood>=${branch.cost.wood}&&
      S.res.stone>=${branch.cost.stone}&&S.res.food>=${branch.cost.food}`,5000,
      'silver bow research materials');
    action("upgradeUnit('archer_t1','archer_silverbow')",'paid silver bow research');
    assert.equal(run('S.upgradedUnits.archer_silverbow'),true);
    reload('T2 archer research');
    setWorkers({wood:4,stone:3,food:7,coal:3,copper:2});
    fill({archer_silverbow:20,bronze_guard:20},'T2 archer roster');
    setWorkers({wood:3,stone:3,food:8,coal:3,iron:2});
    fill({iron_spearman:20},'T2 frontline');
    const l29=fight(29,'archer_silverbow');
    reload('L29 result');
    if(!l29.win){
      setWorkers({wood:3,stone:3,food:8,coal:3,iron:2});
      fill({iron_spearman:20},'L29 rematch iron');
      setWorkers({wood:4,stone:3,food:7,coal:3,copper:2});
      fill({bronze_guard:20,archer_silverbow:20,infantry:10},'L29 rematch support');
      fight(29,'archer_silverbow',true);
      reload('L29 rematch result');
    }
    if(run('S.defeated.length')>=29){
      for(let stage=30;stage<=40;stage++){
        setWorkers({wood:3,stone:3,food:8,coal:3,iron:2});
        fill({iron_spearman:20},'next iron '+stage);
        setWorkers({wood:4,stone:3,food:7,coal:3,copper:2});
        fill({bronze_guard:20,archer_silverbow:20,infantry:10},'next support '+stage);
        const fought=fight(stage,'archer_silverbow',true);
        reload('L'+stage+' result');
        if(!fought.win)break;
      }
    }
  }
}catch(error){failure=String(error.stack||error)}
const save=env.store.get('rts_save');
fs.writeFileSync(path.join(root,outSave),save+'\n');
const final=state();
const trainingCharges=plain(run('JSON.parse(JSON.stringify(__p401.trainingCharges))'));
const trainingPaid={};
for(const row of trainingCharges)for(const [rk,amount]of Object.entries(row.cost))
  trainingPaid[rk]=(trainingPaid[rk]||0)+amount*row.n;
const artifact={batch:'P401',input,inputSha256:digest(input),sources:hashes,
  method:'P400 paid T1 L29 defeat; real paid build, work allocation, queues, battle callbacks, save/reload; fixed random 0.5; garrison frozen',
  unit:'simulated online tick seconds; menu actions instantaneous; battle callback time separately in milliseconds',
  online,battleMs,trainingCharges,trainingPaid,events,final,
  outputSave:outSave,outputSaveSha256:digest(outSave),failure};
fs.writeFileSync(path.join(root,out),JSON.stringify(artifact,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sources.map(f=>[f,digest(f)])),hashes,'input changed during replay');
console.log(JSON.stringify({batch:'P401',online,battleMs,trainingPaid,failure,
  townWins:final.outer.town.wins,essence:final.essence,archerTier:final.buildings.archer_range.tier,
  silverBow:!!final.upgraded.archer_silverbow,mainline:final.defeated,
  battles:events.filter(e=>e.label.startsWith('battle ')).map(e=>({kind:e.kind,win:e.win,round:e.round,losses:e.losses})),
  output:out},null,2));
if(failure)process.exitCode=1;
