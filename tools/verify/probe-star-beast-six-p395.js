'use strict';
// P395: isolated, paid star-beast continuation from P394. No shipped state is edited.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceName='p394-tier4-after5-refilled-paid-save.json';
const source=fs.readFileSync(path.join(data,sourceName),'utf8');
assert.equal(sha(source),'14bd38b1c9c428c6b8e7a42a8c16296158de59eafccb9e50ec774a32a73a666a');
const NativeDate=Date;
let probeNow=JSON.parse(source).ts;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[probeNow]));}
  static now(){return probeNow;}
};

function load(saved,seed=1){
  const env=environment({rts_save:saved}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  return{env,run};
}
function state(run){return run(`({city:S.settlements.city,deed:S.res.deed,army:armyCount(),
  deployed:formSoldierCount(),field:steamMilitaryFieldSize(),stars:S.steamMilitaryStars,
  multiplier:steamMilitaryStatMultiplier(),daily:{...S.daily.counts},alert:S.killValues.starBeast,
  items:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore},
  front:S.formation.front.map(u=>({type:u.type,count:u.count})),
  mid:S.formation.mid.map(u=>({type:u.type,count:u.count})),
  back:S.formation.back.map(u=>({type:u.type,count:u.count})),
  resources:{food:S.res.food,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,medal:S.res.medal,tech:S.res.tech}})`)}
function checkpoint(env,run){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save'),other=environment({rts_save:saved});
  assert.equal(other.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(state(other.run))),JSON.parse(JSON.stringify(state(run))));
  return saved;
}
function battle(saved,seed,tier=4){
  const {env,run}=load(saved,seed),before=state(run);
  run(`openMaterialDomain('starBeast${tier}')`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<8000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<8000);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const enemyInitialHp=run('B.enemyUnits.reduce((n,u)=>n+u.maxHp,0)');
  const after=state(run);
  const afterRaw=checkpoint(env,run);
  return{seed,tier,result,enemyInitialHp,enemyHpLeft,loss:before.army-after.army,
    ringDelta:after.items.ring-before.items.ring,after,callbacks,saveSha256:sha(afterRaw),
    endRaw:afterRaw,winRaw:result==='win'?afterRaw:null};
}
function pressure(saved,seeds=16,tier=4){
  const ids=Array.isArray(seeds)?seeds:Array.from({length:seeds},(_,i)=>i+1);
  const rows=ids.map(seed=>battle(saved,seed,tier));
  return{wins:rows.filter(r=>r.result==='win').length,closestEnemyHp:Math.min(...rows.map(r=>r.enemyHpLeft)),
    meanEnemyHp:rows.reduce((n,r)=>n+r.enemyHpLeft,0)/rows.length,
    rows:rows.map(({winRaw,endRaw,...r})=>r),firstWin:rows.find(r=>r.winRaw)?.winRaw||null};
}
function makeFormation(saved,frontIndices){
  const source=JSON.parse(saved).formation;
  const melee=[...source.front,...source.mid].map(u=>({type:u.type,count:u.count}));
  const front=new Set(frontIndices);
  const next={front:melee.filter((_,i)=>front.has(i)),mid:melee.filter((_,i)=>!front.has(i)),
    back:source.back.map(u=>({type:u.type,count:u.count}))};
  assert.equal(next.front.length,4);assert.equal(next.mid.length,4);
  const {env,run}=load(saved),prior=state(run);
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  for(const [row,groups]of Object.entries(next))for(const [slot,u]of groups.entries()){
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count);
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  }
  assert.equal(run('formSoldierCount()'),prior.deployed);
  assert.equal(run('armyCount()'),prior.army);
  assert.equal(run('S.res.deed'),prior.deed);
  return{saved:checkpoint(env,run),state:state(run)};
}
function starUp(saved){
  const {env,run}=load(saved),before=state(run),target=before.stars+1;
  const needed=Math.max(0,Math.ceil((before.deployed-run(`steamMilitaryFieldSize(${target})`))/4));
  const quote=needed?run(`settlementBatchPreview('city',${needed},${before.city})`):null;
  if(quote&&!quote.ok)return{ok:false,before,needed,quote};
  const built=needed?run(`upgradeSettlementBatch('city',${needed},${before.city},${before.deed})`):null;
  assert.ok(!built||built.ok);
  const starred=run('steamMilitaryStarStep(1)');
  assert.equal(starred.ok,true,JSON.stringify(starred));
  const after=state(run),output=checkpoint(env,run);
  assert.equal(after.stars,target);
  assert.equal(after.deed,before.deed-(quote?.cost||0));
  return{ok:true,before,needed,quote:quote&&{cost:quote.cost,remainingDeed:quote.remainingDeed},
    built,starred,after,saved:output,saveSha256:sha(output)};
}

function replenish(saved,target){
  const {env,run}=load(saved),before=state(run),resBefore=run('({...S.res})');
  const targetByType={};
  for(const groups of Object.values(target))for(const u of groups)
    targetByType[u.type]=(targetByType[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need={};
  for(const [type,wanted]of Object.entries(targetByType))
    need[type]=Math.max(0,wanted-run(`poolAvail('${type}')`));
  let seconds=0,minFood=resBefore.food,phase='none';
  const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
  const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap('${k}')`);
  function assign(resource){
    for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
    phase=resource;
  }
  function advanceUntil(expression,max,stop='false'){
    const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
      tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
    seconds+=x.n;minFood=Math.min(minFood,x.min);phases[phase]+=x.n;
    assert.ok(x.min>0);return x;
  }
  function fillBasic(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource));
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,10000).done,resource+' timeout');
  }
  function fillProcessed(resource,amount){
    if(val(resource)>=amount)return;
    assert.ok(amount<=cap(resource));
    let cycles=0;
    while(val(resource)<amount&&cycles++<100){
      if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
      if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
      if(resource==='steel'&&val('iron')<100000)
        fillProcessed('iron',Math.min(1000000,cap('iron')));
      const prior=val(resource);assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${amount}`,5000,stop);
      assert.ok(val(resource)>prior,resource+' stalled');
    }
    assert.ok(val(resource)>=amount,resource+' exhausted');
  }
  function fill(resource,amount){
    if(val(resource)>=amount)return;
    if(['copper','iron','steel'].includes(resource))fillProcessed(resource,amount);
    else fillBasic(resource,amount);
  }
  const trainingCost={},order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const [type,short]of Object.entries(need)){
    if(!short)continue;
    const cost=run(`({...CFG.units.${type}.cost})`);
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=perUnit*short;fill(resource,amount);
      trainingCost[resource]=(trainingCost[resource]||0)+amount;
    }
    assert.equal(run(`train('${type}',${short})`)?.ok,true);
    phase='training';
    assert.ok(advanceUntil(`poolAvail('${type}')>=${targetByType[type]}`,1000).done,type+' training');
  }
  for(const [row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count);
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=state(run),output=checkpoint(env,run);
  assert.equal(after.deployed,626);assert.equal(after.army,672);
  assert.deepEqual(after.items,before.items);assert.equal(after.deed,before.deed);
  return{before,need,trainingCost,seconds,minFood,phases,after,
    resBefore,resAfter:run('({...S.res})'),saved:output,sha256:sha(output)};
}
function offlineWindow(saved,seconds=28800){
  const before=state(load(saved).run);
  probeNow+=seconds*1000;
  const {env,run}=load(saved),result=run('settleOffline()');
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.durationSec,seconds);
  const after=state(run),output=checkpoint(env,run);
  return{before,seconds,result,after,saved:output,sha256:sha(output)};
}

function calm(saved){
  const {env,run}=load(saved),before=state(run);
  const action=run('calmStarBeastAlert()');
  assert.equal(action.ok,true,JSON.stringify(action));
  const after=state(run),output=checkpoint(env,run);
  assert.equal(after.alert,Math.max(0,before.alert-1000));
  return{before,action,after,saved:output,sha256:sha(output)};
}
function compactPressure(p){return{wins:p.wins,closestEnemyHp:p.closestEnemyHp,meanEnemyHp:p.meanEnemyHp,
  rows:p.rows.map(r=>({seed:r.seed,result:r.result,enemyHpLeft:r.enemyHpLeft,
    enemyInitialHp:r.enemyInitialHp,loss:r.loss,ringDelta:r.ringDelta,callbacks:r.callbacks}))}}
function domainBattle(saved,seed,key){
  const {env,run}=load(saved,seed);
  const before=run(`({army:armyCount(),core:S.items.godCore,
    medal:S.res.medal,alert:S.killValues.godSlaughter})`);
  run(`openMaterialDomain('${key}')`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<8000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<8000);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const after=run(`({army:armyCount(),core:S.items.godCore,
    medal:S.res.medal,alert:S.killValues.godSlaughter})`);
  const endRaw=checkpoint(env,run);
  return{seed,key,result,enemyHpLeft,loss:before.army-after.army,
    coreDelta:after.core-before.core,medalDelta:after.medal-before.medal,
    alertDelta:after.alert-before.alert,after,callbacks,endRaw,sha256:sha(endRaw)};
}
function persist(name,payload){
  const file=path.join(data,name);
  fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
  console.log(JSON.stringify({file,...payload.summary},null,2));
}
if(process.argv.includes('--calm')){
  const before=state(load(source).run);
  const rawPressure=pressure(source,16,6);
  const quiet=calm(source);
  const name='p395-star6-calm-paid-save.json';
  fs.writeFileSync(path.join(data,name),quiet.saved);
  const pressureAfter=pressure(quiet.saved,16,6);
  const payload={batch:'P395',source:{file:sourceName,sha256:sha(source)},
    runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>
      [f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    before,pressureBefore:compactPressure(rawPressure),
    quiet:{action:quiet.action,after:quiet.after,file:name,sha256:quiet.sha256},
    pressureAfter:compactPressure(pressureAfter),
    summary:{beforeWins:rawPressure.wins,alertBefore:before.alert,alertAfter:quiet.after.alert,
      afterWins:pressureAfter.wins,closestAfter:pressureAfter.closestEnemyHp}};
  persist('p395-star6-calm.json',payload);
  process.exit(0);
}
if(process.argv.includes('--stars')){
  const calmName='p395-star6-calm-paid-save.json';
  let current=fs.readFileSync(path.join(data,calmName),'utf8');
  assert.equal(sha(current),'ae5d8873a179c70c26fbe693db628bc01827e11e35b7e59267d2e57bb35d4b39');
  const steps=[],offline=[];
  for(let target=18;target<=35;target++){
    let step=starUp(current);
    while(!step.ok&&offline.length<100){
      const window=offlineWindow(current);
      offline.push({target,seconds:window.seconds,priorDeed:window.before.deed,
        afterDeed:window.after.deed,gains:window.result.gains,sha256:window.sha256});
      current=window.saved;
      step=starUp(current);
    }
    if(!step.ok){steps.push({target,failed:step});break}
    const name=`p395-star6-star${target}-paid-save.json`;
    fs.writeFileSync(path.join(data,name),step.saved);
    const four=pressure(step.saved,[1,2,11,16],6),
      full=four.wins===4?pressure(step.saved,16,6):null;
    const row={target,city:step.after.city,field:step.after.field,multiplier:step.after.multiplier,
      cost:step.quote?.cost||0,deed:step.after.deed,file:name,sha256:step.saveSha256,
      four:compactPressure(four),full:full&&compactPressure(full)};
    steps.push(row);current=step.saved;
    if(full?.wins===16)break;
  }
  const payload={batch:'P395',source:{file:calmName,sha256:sha(fs.readFileSync(path.join(data,calmName),'utf8'))},
    runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>
      [f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    offline,steps,summary:{offlineWindows:offline.length,simulatedOfflineHours:offline.length*8,
      steps:steps.map(s=>({target:s.target,city:s.city,cost:s.cost,deed:s.deed,
        wins4:s.four?.wins,wins16:s.full?.wins,closest:s.full?.closestEnemyHp||s.four?.closestEnemyHp}))}};
  persist('p395-star6-stars.json',payload);
  process.exit(0);
}
if(process.argv.includes('--recovery')){
  const star24Name='p395-star6-star24-paid-save.json';
  const star24=fs.readFileSync(path.join(data,star24Name),'utf8');
  probeNow=JSON.parse(star24).ts;
  const defeat=battle(star24,7,6);
  assert.equal(defeat.result,'lose');
  const defeatName='p395-star6-star24-seed7-loss-paid-save.json';
  fs.writeFileSync(path.join(data,defeatName),defeat.endRaw);
  const restored=replenish(defeat.endRaw,JSON.parse(star24).formation);
  const refillName='p395-star6-star24-seed7-refilled-paid-save.json';
  fs.writeFileSync(path.join(data,refillName),restored.saved);
  let current=restored.saved,step=starUp(current),offline=[];
  while(!step.ok&&offline.length<20){
    const window=offlineWindow(current);
    offline.push({seconds:window.seconds,priorDeed:window.before.deed,
      afterDeed:window.after.deed,gains:window.result.gains,sha256:window.sha256});
    current=window.saved;
    step=starUp(current);
  }
  assert.equal(step.ok,true,'25th star still unaffordable after 20 windows');
  const recoveredName='p395-star6-star25-after-loss-recovery-paid-save.json';
  fs.writeFileSync(path.join(data,recoveredName),step.saved);
  const after=pressure(step.saved,16,6);
  assert.equal(after.wins,16);
  persist('p395-star6-loss-recovery.json',{batch:'P395',source:{file:star24Name,sha256:sha(star24)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    defeat:{seed:7,tier:6,enemyHpLeft:defeat.enemyHpLeft,loss:defeat.loss,
      file:defeatName,sha256:defeat.saveSha256,after:defeat.after},
    refill:{need:restored.need,cost:restored.trainingCost,seconds:restored.seconds,
      minFood:restored.minFood,file:refillName,sha256:restored.sha256},
    offline,star25:{cost:step.quote.cost,city:step.after.city,deed:step.after.deed,
      file:recoveredName,sha256:step.saveSha256},
    pressure:compactPressure(after),
    summary:{defeatLoss:defeat.loss,refillSec:restored.seconds,refillCost:restored.trainingCost,
      offlineHours:offline.length*8,star25Cost:step.quote.cost,retryWins16:after.wins}});
  process.exit(0);
}
if(process.argv.includes('--next')){
  const readyName='p395-star6-star25-after-loss-recovery-paid-save.json';
  const ready=fs.readFileSync(path.join(data,readyName),'utf8');
  probeNow=JSON.parse(ready).ts;
  const win=battle(ready,1,6);
  assert.equal(win.result,'win');
  const winName='p395-star6-seed1-win-paid-save.json';
  fs.writeFileSync(path.join(data,winName),win.endRaw);
  const refill=replenish(win.endRaw,JSON.parse(ready).formation);
  const refillName='p395-star7-refilled-paid-save.json';
  fs.writeFileSync(path.join(data,refillName),refill.saved);
  const beforeCalm=pressure(refill.saved,16,7);
  const quiet=calm(refill.saved);
  const calmName='p395-star7-calm-paid-save.json';
  fs.writeFileSync(path.join(data,calmName),quiet.saved);
  const afterCalm=pressure(quiet.saved,16,7);
  persist('p395-star7-entry.json',{batch:'P395',source:{file:readyName,sha256:sha(ready)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    tier6Win:{seed:1,loss:win.loss,ringDelta:win.ringDelta,alert:win.after.alert,
      file:winName,sha256:win.saveSha256},
    refill:{need:refill.need,cost:refill.trainingCost,seconds:refill.seconds,
      minFood:refill.minFood,file:refillName,sha256:refill.sha256},
    beforeCalm:compactPressure(beforeCalm),
    calm:{action:quiet.action,file:calmName,sha256:quiet.sha256},
    afterCalm:compactPressure(afterCalm),
    summary:{tier6Loss:win.loss,tier6RewardEach:win.ringDelta,
      alertBeforeCalm:win.after.alert,alertAfterCalm:quiet.after.alert,
      tier7BeforeWins:beforeCalm.wins,tier7AfterWins:afterCalm.wins,
      tier7Closest:afterCalm.closestEnemyHp}});
  process.exit(0);
}
if(process.argv.includes('--gates')){
  const name='p395-star7-calm-paid-save.json',saved=fs.readFileSync(path.join(data,name),'utf8');
  probeNow=JSON.parse(saved).ts;
  const {env,run}=load(saved);
  const before=state(run);
  const actions={fighter:run("researchWeapon('starFighter')"),
    array:run('openStarArraySlot(0)'),
    arms:run("investArmsUp('star_trooper','atk',1000)")};
  const research=run(`({techCap:resCap('tech'),techRateNow:prodRate('tech'),
    steelCap:resCap('steel'),steelRateNow:prodRate('steel'),
    ringCost:starArraySlotCost('open',0),
    archerAtk:weaponAttack('archer'),starAtk:weaponAttack('star_trooper')})`);
  assert.deepEqual(state(run),before);
  persist('p395-star7-gates.json',{batch:'P395',source:{file:name,sha256:sha(saved)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    before,actions,research,summary:{fighter:actions.fighter.reason,
      array:actions.array.reason,arms:actions.arms.reason,
      techCap:research.techCap,techRateNow:research.techRateNow}});
  process.exit(0);
}
if(process.argv.includes('--fighter-supply')){
  const name='p395-star7-calm-paid-save.json',saved=fs.readFileSync(path.join(data,name),'utf8');
  probeNow=JSON.parse(saved).ts;
  const {env,run}=load(saved),before=state(run);
  assert.equal(run("setPopAlloc('copper',0)").ok,true);
  assert.equal(run("setPopAlloc('tech',902)").ok,true);
  const rates=run(`({tech:prodRate('tech'),food:prodRate('food'),
    techCap:resCap('tech'),needTech:CFG.weaponForge.starFighter.researchCost.tech,
    medal:S.res.medal,core:S.items.godCore})`);
  const assigned=checkpoint(env,run);
  const assignedName='p395-star7-tech-assigned-paid-save.json';
  fs.writeFileSync(path.join(data,assignedName),assigned);
  const window=offlineWindow(assigned);
  const offlineName='p395-star7-tech-offline-paid-save.json';
  fs.writeFileSync(path.join(data,offlineName),window.saved);
  const {env:afterEnv,run:afterRun}=load(window.saved);
  const action=afterRun("researchWeapon('starFighter')");
  const researched=action.ok?checkpoint(afterEnv,afterRun):null;
  const researchName=researched?'p395-star7-fighter-researched-paid-save.json':null;
  if(researched)fs.writeFileSync(path.join(data,researchName),researched);
  persist('p395-star7-fighter-supply.json',{batch:'P395',source:{file:name,sha256:sha(saved)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    before,rates,assigned:{file:assignedName,sha256:sha(assigned)},
    window:{seconds:window.seconds,gains:window.result.gains,after:window.after,
      file:offlineName,sha256:window.sha256},
    research:{action,file:researchName,sha256:researched&&sha(researched)},
    summary:{techRate:rates.tech,techGain:window.after.resources.tech-before.resources.tech,
      researchOk:action.ok,reason:action.reason||null,core:rates.core}});
  process.exit(0);
}
if(process.argv.includes('--core-entry')){
  const name='p395-star7-fighter-researched-paid-save.json';
  const saved=fs.readFileSync(path.join(data,name),'utf8');
  probeNow=JSON.parse(saved).ts;
  const rows=[1,2,7,11,16].map(seed=>domainBattle(saved,seed,'medal'));
  persist('p395-star7-core-entry.json',{batch:'P395',source:{file:name,sha256:sha(saved)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    rows:rows.map(({endRaw,...row})=>row),
    summary:{wins:rows.filter(r=>r.result==='win').length,
      coreRewards:rows.map(r=>r.coreDelta),losses:rows.map(r=>r.loss)}});
  process.exit(0);
}
if(process.argv.includes('--core-farm')){
  const name='p395-star7-fighter-researched-paid-save.json';
  const original=fs.readFileSync(path.join(data,name),'utf8');
  probeNow=JSON.parse(original).ts;
  let current=original;
  const rows=[];
  for(let index=1;index<=3;index++){
    const result=domainBattle(current,11,'medal');
    assert.equal(result.result,'win',`core farm ${index} failed`);
    const winName=`p395-star7-core-farm-win${index}-paid-save.json`;
    fs.writeFileSync(path.join(data,winName),result.endRaw);
    const restored=replenish(result.endRaw,JSON.parse(original).formation);
    const refillName=`p395-star7-core-farm-refill${index}-paid-save.json`;
    fs.writeFileSync(path.join(data,refillName),restored.saved);
    rows.push({index,result:{seed:result.seed,loss:result.loss,
      coreDelta:result.coreDelta,medalDelta:result.medalDelta,
      alertDelta:result.alertDelta,after:result.after,
      file:winName,sha256:result.sha256},
      refill:{need:restored.need,cost:restored.trainingCost,seconds:restored.seconds,
        minFood:restored.minFood,file:refillName,sha256:restored.sha256,
        resources:restored.after.resources}});
    current=restored.saved;
  }
  persist('p395-star7-core-farm.json',{batch:'P395',source:{file:name,sha256:sha(original)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    rows,summary:{wins:rows.length,coreDeltas:rows.map(r=>r.result.coreDelta),
      losses:rows.map(r=>r.result.loss),totalOnlineSec:rows.reduce((n,r)=>n+r.refill.seconds,0),
      endCore:rows.at(-1).result.after.core,
      endSteel:rows.at(-1).refill.resources.steel}});
  process.exit(0);
}
if(process.argv.includes('--fighter')){
  const name='p395-star7-core-farm-refill3-paid-save.json';
  const saved=fs.readFileSync(path.join(data,name),'utf8');
  probeNow=JSON.parse(saved).ts;
  const {env,run}=load(saved),before=state(run);
  const supplyBefore=run(`({steel:S.res.steel,core:S.items.godCore,
    level:S.weaponForge.starFighter.level,progress:S.weaponForge.starFighter.progress})`);
  const actions=[];
  for(let i=0;i<20;i++){
    const action=run("forgeWeapon('starFighter')");
    assert.equal(action.ok,true,JSON.stringify(action));
    actions.push(action);
  }
  assert.equal(run('S.weaponForge.starFighter.level'),1);
  const equipped=run("setWeaponEquipped('starFighter',true)");
  assert.equal(equipped.ok,true);
  const after=state(run),supplyAfter=run(`({steel:S.res.steel,core:S.items.godCore,
    level:S.weaponForge.starFighter.level,progress:S.weaponForge.starFighter.progress,
    equipped:S.weaponForge.starFighter.equipped})`);
  const active=checkpoint(env,run),activeName='p395-star7-fighter-equipped-paid-save.json';
  fs.writeFileSync(path.join(data,activeName),active);
  const pressureAfter=pressure(active,16,7);
  persist('p395-star7-fighter.json',{batch:'P395',source:{file:name,sha256:sha(saved)},
    runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>
      [f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    before,supplyBefore,actions,equipped,after,supplyAfter,
    active:{file:activeName,sha256:sha(active)},
    pressure:compactPressure(pressureAfter),
    summary:{steelSpent:supplyBefore.steel-supplyAfter.steel,
      coreSpent:supplyBefore.core-supplyAfter.core,
      wins:pressureAfter.wins,closest:pressureAfter.closestEnemyHp,
      lossRange:[Math.min(...pressureAfter.rows.map(r=>r.loss)),
        Math.max(...pressureAfter.rows.map(r=>r.loss))]}});
  process.exit(0);
}
if(process.argv.includes('--smoke-current')){
  const cases=[
    {file:'p395-star6-star25-paid-save.json',tier:6,expected:16,reward:100},
    {file:'p395-star6-star25-after-loss-recovery-paid-save.json',tier:6,expected:16,reward:100},
    {file:'p395-star7-calm-paid-save.json',tier:7,expected:0,reward:0},
    {file:'p395-star7-fighter-equipped-paid-save.json',tier:7,expected:0,reward:0}
  ];
  const results=[];
  for(const entry of cases){
    const saved=fs.readFileSync(path.join(data,entry.file),'utf8');
    probeNow=JSON.parse(saved).ts;
    const p=pressure(saved,16,entry.tier);
    assert.equal(p.wins,entry.expected,entry.file);
    for(const row of p.rows)assert.equal(row.ringDelta,entry.reward);
    results.push({file:entry.file,sha256:sha(saved),tier:entry.tier,
      pressure:compactPressure(p)});
  }
  persist('p395-star6-current-smoke.json',{batch:'P395',
    runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>
      [f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    results,summary:{cases:results.map(r=>({file:r.file,tier:r.tier,
      wins:r.pressure.wins,closest:r.pressure.closestEnemyHp}))}});
  process.exit(0);
}
