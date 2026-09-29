'use strict';
// P394: isolated, paid star-beast continuation from P393. No shipped state is edited.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const names={pre:'p393-tier3-city-star10-prebattle-paid-save.json',win:'p393-tier3-city-star10-seed1-paid-save.json'};
const raw=Object.fromEntries(Object.entries(names).map(([k,n])=>[k,fs.readFileSync(path.join(data,n),'utf8')]));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw.pre),'df515a38dca073d7ff5fde1c235a48574b395041903b083f87d901c350380d51');
assert.equal(sha(raw.win),'d407c2849e4050c0f8231d61075e735e60aed4bc8f4944f71d38d3434050af04');
const NativeDate=Date;
let probeNow=JSON.parse(raw.pre).ts;
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
    winRaw:result==='win'?afterRaw:null};
}
function pressure(saved,seeds=16,tier=4){
  const ids=Array.isArray(seeds)?seeds:Array.from({length:seeds},(_,i)=>i+1);
  const rows=ids.map(seed=>battle(saved,seed,tier));
  return{wins:rows.filter(r=>r.result==='win').length,closestEnemyHp:Math.min(...rows.map(r=>r.enemyHpLeft)),
    meanEnemyHp:rows.reduce((n,r)=>n+r.enemyHpLeft,0)/rows.length,
    rows:rows.map(({winRaw,...r})=>r),firstWin:rows.find(r=>r.winRaw)?.winRaw||null};
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

if(process.argv.includes('--smoke-new')){
  const cases=[
    {file:'p394-tier4-star12-paid-save.json',expected:'caab6f4009b8c4e9c5fe75c7b7fd0d14ef78ab1579a3da153ab589381dfdfd10',tier:4,seeds:[1,11,16],reward:50},
    {file:'p394-tier4-to5-star17-paid-save.json',tier:5,seeds:[1,11,16],reward:70},
    {file:'p394-tier4-after5-refilled-paid-save.json',expected:'14bd38b1c9c428c6b8e7a42a8c16296158de59eafccb9e50ec774a32a73a666a',tier:6,seeds:[11],reward:0}
  ];
  const results=[];
  for(const c of cases){
    const saved=fs.readFileSync(path.join(data,c.file),'utf8');
    if(c.expected)assert.equal(sha(saved),c.expected);
    probeNow=JSON.parse(saved).ts;
    const p=pressure(saved,c.seeds,c.tier);
    for(const row of p.rows){
      assert.equal(row.result,c.reward?'win':'lose');
      assert.equal(row.ringDelta,c.reward);
    }
    results.push({file:c.file,sha256:sha(saved),tier:c.tier,seeds:c.seeds,
      wins:p.wins,closest:p.closestEnemyHp,rows:p.rows.map(r=>({seed:r.seed,
        result:r.result,enemyHpLeft:r.enemyHpLeft,loss:r.loss,ringDelta:r.ringDelta,
        saveSha256:r.saveSha256}))});
  }
  const output={batch:'P394',mathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    results,scope:'New-runtime smoke on old paid checkpoints; independent save/load for each fixed seed. No paid path rerun.'};
  fs.writeFileSync(path.join(data,'p394-tier4-new-hash-smoke.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
  process.exit(0);
}

if(process.argv.includes('--gates')){
  const {env,run}=load(raw.win),before=state(run);
  const quote=run("starArraySlotCost('open',0)");
  const starArray=run('openStarArraySlot(0)');
  const starFighter=run("researchWeapon('starFighter')");
  const quantum=run("researchScience('sci_quantum_age')");
  const after=state(run);
  assert.deepEqual(after,before);
  assert.equal(starArray.ok,false);
  assert.equal(starFighter.ok,false);
  assert.equal(quantum.ok,false);
  const saved=checkpoint(env,run);
  const result={source:{file:names.win,sha256:sha(raw.win)},
    runtimeMathSha256:sha(fs.readFileSync(path.join(root,'math.js'),'utf8')),
    before,quote,starArray,starFighter,quantum,unchanged:JSON.stringify(after)===JSON.stringify(before),
    reloadSha256:sha(saved)};
  fs.writeFileSync(path.join(data,'p394-tier4-research-array-gates.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({quote,starArray,starFighter,quantum,unchanged:result.unchanged,
    runtimeMathSha256:result.runtimeMathSha256},null,2));
  process.exit(0);
}

if(process.argv.includes('--beyond')){
  const t4BeforeFile='p394-tier4-star12-paid-save.json';
  const t4WinFile='p394-tier4-star12-seed1-win-save.json';
  const t4Before=fs.readFileSync(path.join(data,t4BeforeFile),'utf8');
  const t4Win=fs.readFileSync(path.join(data,t4WinFile),'utf8');
  assert.equal(sha(t4Before),'caab6f4009b8c4e9c5fe75c7b7fd0d14ef78ab1579a3da153ab589381dfdfd10');
  assert.equal(sha(t4Win),'dd99d2f0e10927411a1310c9125b670ca01b1e88b454feba0123ccf2603bba78');
  probeNow=JSON.parse(t4Win).ts;
  const replenished=replenish(t4Win,JSON.parse(t4Before).formation);
  const refillFile='p394-tier4-after-win-refilled-paid-save.json';
  fs.writeFileSync(path.join(data,refillFile),replenished.saved);
  const day2=offlineWindow(replenished.saved,86400);
  const day2File='p394-tier4-day2-before-battle-paid-save.json';
  fs.writeFileSync(path.join(data,day2File),day2.saved);
  assert.equal(load(day2.saved).run("dailyCount('starBeast4')"),0);
  const repeat4=pressure(day2.saved,16,4);
  const tier5Base=pressure(day2.saved,16,5);
  let current=day2.saved;
  const starSteps=[],offline=[];
  for(let target=13;target<=24;target++){
    let step=starUp(current);
    while(!step.ok&&offline.length<30){
      const window=offlineWindow(current);
      offline.push({target,seconds:window.seconds,beforeDeed:window.before.deed,
        afterDeed:window.after.deed,gains:window.result.gains,sha256:window.sha256});
      current=window.saved;
      step=starUp(current);
    }
    if(!step.ok){starSteps.push({target,failed:step});break}
    const file=`p394-tier4-to5-star${target}-paid-save.json`;
    fs.writeFileSync(path.join(data,file),step.saved);
    const p=pressure(step.saved,16,5);
    const entry={target,needed:step.needed,quote:step.quote,before:step.before,
      after:step.after,file,sha256:step.saveSha256,pressure:{wins16:p.wins,
        closest:p.closestEnemyHp,rows:p.rows}};
    if(p.firstWin){
      const winFile=`p394-tier4-to5-star${target}-seed${p.rows.find(r=>r.result==='win').seed}-win-save.json`;
      fs.writeFileSync(path.join(data,winFile),p.firstWin);
      entry.firstWin={file:winFile,sha256:sha(p.firstWin)};
    }
    starSteps.push(entry);current=step.saved;
    if(p.wins===16)break;
  }
  let next=null;
  const stable=starSteps.find(x=>x.pressure?.wins16===16&&x.firstWin);
  if(stable){
    const winRaw=fs.readFileSync(path.join(data,stable.firstWin.file),'utf8');
    const restored=replenish(winRaw,JSON.parse(fs.readFileSync(path.join(data,stable.file),'utf8')).formation);
    const file='p394-tier4-after5-refilled-paid-save.json';
    fs.writeFileSync(path.join(data,file),restored.saved);
    const p=pressure(restored.saved,16,6);
    next={tier:6,replenishment:{need:restored.need,cost:restored.trainingCost,seconds:restored.seconds,
      minFood:restored.minFood,file,sha256:restored.sha256},
      pressure:{wins16:p.wins,closest:p.closestEnemyHp,rows:p.rows}};
  }
  const output={batch:'P394',source:{tier4Pre:{file:t4BeforeFile,sha256:sha(t4Before)},
    tier4Win:{file:t4WinFile,sha256:sha(t4Win)}},runtimeSha256:Object.fromEntries(
    ['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    tier4Replenishment:{...replenished,saved:undefined,file:refillFile},
    day2:{seconds:day2.seconds,gains:day2.result.gains,file:day2File,sha256:day2.sha256,
      repeatTier4:{wins16:repeat4.wins,closest:repeat4.closestEnemyHp,rows:repeat4.rows}},
    tier5Base:{wins16:tier5Base.wins,closest:tier5Base.closestEnemyHp,rows:tier5Base.rows},
    offline,starSteps,next,
    scope:'Paid training, daily offline, city and military stars. Every battle has independent save reload; fixed seeds 1–16.'};
  const outputFile='p394-tier4-beyond-paid-continuation.json';
  fs.writeFileSync(path.join(data,outputFile),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({tier4Refill:{need:replenished.need,cost:replenished.trainingCost,
    seconds:replenished.seconds,minFood:replenished.minFood},
    day2:{deedGain:day2.after.deed-day2.before.deed,repeatTier4Wins:repeat4.wins},
    tier5Base:{wins:tier5Base.wins,closest:tier5Base.closestEnemyHp},
    starSteps:starSteps.map(x=>({target:x.target,city:x.after?.city,cost:x.quote?.cost,
      deed:x.after?.deed,wins:x.pressure?.wins16,closest:x.pressure?.closest})),
    next:next&&{tier:next.tier,refill:next.replenishment,pressure:{wins:next.pressure.wins16,
      closest:next.pressure.closest}},outputFile},null,2));
  process.exit(0);
}

if(process.argv.includes('--continuation')){
  const replenished=replenish(raw.win,JSON.parse(raw.pre).formation);
  const replenishedFile='p394-tier4-refilled-paid-save.json';
  fs.writeFileSync(path.join(data,replenishedFile),replenished.saved);
  const fullPressure=pressure(replenished.saved);
  let current=replenished.saved;
  const starSteps=[],offline=[];
  for(let target=11;target<=18;target++){
    let step=starUp(current);
    while(!step.ok&&offline.length<24){
      const window=offlineWindow(current);
      offline.push({target,seconds:window.seconds,beforeDeed:window.before.deed,
        afterDeed:window.after.deed,gains:window.result.gains,sha256:window.sha256});
      current=window.saved;
      step=starUp(current);
    }
    if(!step.ok){starSteps.push({target,failed:step});break}
    const file=`p394-tier4-star${target}-paid-save.json`;
    fs.writeFileSync(path.join(data,file),step.saved);
    const p=pressure(step.saved);
    const entry={target,needed:step.needed,quote:step.quote,before:step.before,
      after:step.after,file,sha256:step.saveSha256,pressure:{wins16:p.wins,
        closest:p.closestEnemyHp,rows:p.rows}};
    if(p.firstWin){
      const winFile=`p394-tier4-star${target}-seed${p.rows.find(r=>r.result==='win').seed}-win-save.json`;
      fs.writeFileSync(path.join(data,winFile),p.firstWin);
      entry.firstWin={file:winFile,sha256:sha(p.firstWin)};
    }
    starSteps.push(entry);current=step.saved;
    if(p.wins===16)break;
  }
  const output={batch:'P394',source:{pre:{file:names.pre,sha256:sha(raw.pre)},
    win:{file:names.win,sha256:sha(raw.win)}},runtimeSha256:Object.fromEntries(
    ['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
    replenishment:{...replenished,saved:undefined,file:replenishedFile},
    fullPressure:{wins16:fullPressure.wins,closest:fullPressure.closestEnemyHp,rows:fullPressure.rows},
    offline,starSteps,scope:'Actual tick/train/formation/city/star/offline/battle/save/load; independent fixed seeds 1–16.'};
  const outputFile='p394-tier4-paid-continuation.json';
  fs.writeFileSync(path.join(data,outputFile),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({replenishment:{need:replenished.need,trainingCost:replenished.trainingCost,
    seconds:replenished.seconds,minFood:replenished.minFood,sha256:replenished.sha256},
    full:{wins:fullPressure.wins,closest:fullPressure.closestEnemyHp},
    offline:offline.map(x=>({target:x.target,seconds:x.seconds,gainDeed:x.afterDeed-x.beforeDeed})),
    starSteps:starSteps.map(x=>({target:x.target,city:x.after?.city,deed:x.after?.deed,
      cost:x.quote?.cost,wins:x.pressure?.wins16,closest:x.pressure?.closest,firstWin:x.firstWin})),
    outputFile},null,2));
  process.exit(0);
}

const source={pre:{file:names.pre,sha256:sha(raw.pre),state:state(load(raw.pre).run)},
  win:{file:names.win,sha256:sha(raw.win),state:state(load(raw.win).run)}};
const baseline=pressure(raw.win);
const labels=[...JSON.parse(raw.pre).formation.front,...JSON.parse(raw.pre).formation.mid]
  .map((u,i)=>`${i<4?'F':'M'}${i%4}:${u.type}${u.count}`);
const scans=[];
for(let a=0;a<5;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<7;c++)for(let d=c+1;d<8;d++){
  const frontIndices=[a,b,c,d],formed=makeFormation(raw.pre,frontIndices);
  const p=pressure(formed.saved,[1,2,6,14]);
  scans.push({frontIndices,frontNames:frontIndices.map(i=>labels[i]),wins4:p.wins,
    closest4:p.closestEnemyHp,mean4:p.meanEnemyHp,saveSha256:sha(formed.saved)});
}
scans.sort((a,b)=>b.wins4-a.wins4||a.mean4-b.mean4);
const finalists=[];
for(const candidate of scans.slice(0,8)){
  const formed=makeFormation(raw.pre,candidate.frontIndices),p=pressure(formed.saved);
  finalists.push({...candidate,wins16:p.wins,closest16:p.closestEnemyHp,
    mean16:p.meanEnemyHp,rows16:p.rows});
}
finalists.sort((a,b)=>b.wins16-a.wins16||a.mean16-b.mean16);
const star11=starUp(raw.pre);
const star11Pressure=star11.ok?pressure(star11.saved):null;
const bestFormation=makeFormation(raw.pre,finalists[0].frontIndices);
const bestStar11=starUp(bestFormation.saved);
const bestStar11Pressure=bestStar11.ok?pressure(bestStar11.saved):null;
const output={batch:'P394',runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
  .map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),source,baseline:{wins16:baseline.wins,
  closest:baseline.closestEnemyHp,rows:baseline.rows},scans,finalists,
  star11:star11.ok?{before:star11.before,needed:star11.needed,quote:star11.quote,
    after:star11.after,saveSha256:star11.saveSha256,pressure:star11Pressure}:star11,
  bestStar11:bestStar11.ok?{frontIndices:finalists[0].frontIndices,needed:bestStar11.needed,
    quote:bestStar11.quote,after:bestStar11.after,saveSha256:bestStar11.saveSha256,
    pressure:bestStar11Pressure}:bestStar11,
  scope:'Actual formation clear/confirm and city/star actions; tier-four battles from independent reloads, fixed seeds only.'};
const outputFile='p394-tier4-initial-scan.json';
fs.writeFileSync(path.join(data,outputFile),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({source:source.win.sha256,baseline:{wins:baseline.wins,closest:baseline.closestEnemyHp},
  best:finalists.slice(0,4).map(x=>({front:x.frontNames,wins:x.wins16,closest:x.closest16,mean:x.mean16})),
  star11:star11.ok?{needed:star11.needed,cost:star11.quote?.cost,wins:star11Pressure.wins,closest:star11Pressure.closestEnemyHp}:star11,
  bestStar11:bestStar11.ok?{wins:bestStar11Pressure.wins,closest:bestStar11Pressure.closestEnemyHp}:bestStar11,
  outputFile},null,2));
