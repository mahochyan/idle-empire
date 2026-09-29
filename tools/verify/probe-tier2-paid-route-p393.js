'use strict';
// P393: real formation actions and paid city expansion from the P391 six-star save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p391-steam-military-six-star-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'6a6150b11c74f19933c235092993bebe5ebcc59404df1d809cfda031d4845bda');
const NativeDate=Date,now=JSON.parse(raw).ts;
let probeNow=now;
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
  multiplier:steamMilitaryStatMultiplier(),items:{origin:S.items.starOriginStone,
    illusion:S.items.illusionStone,ring:S.items.sacredRingCore},
  front:S.formation.front.map(u=>({type:u.type,count:u.count})),
  mid:S.formation.mid.map(u=>({type:u.type,count:u.count}))})`)}
function checkpoint(env,run){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save'),other=environment({rts_save:saved});
  assert.equal(other.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(state(other.run))),JSON.parse(JSON.stringify(state(run))));
  return saved;
}
function battle(saved,seed,key='starBeast2'){
  const {env,run}=load(saved,seed),before=state(run);
  run(`openMaterialDomain('${key}')`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<8000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<8000);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const after=state(run);
  assert.equal(run('save().ok'),true);
  const afterRaw=env.store.get('rts_save'),reload=environment({rts_save:afterRaw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.sacredRingCore'),after.items.ring);
  return{key,seed,result,enemyHpLeft,loss:before.army-after.army,
    ringDelta:after.items.ring-before.items.ring,after,callbacks,saveSha256:sha(afterRaw),
    winRaw:result==='win'?afterRaw:null};
}
function pressure(saved,seeds=16,key='starBeast2'){
  const rows=Array.from({length:seeds},(_,i)=>battle(saved,i+1,key));
  return{wins:rows.filter(r=>r.result==='win').length,
    closestEnemyHp:Math.min(...rows.map(r=>r.enemyHpLeft)),
    rows:rows.map(({winRaw,...r})=>r),
    firstWin:rows.find(r=>r.winRaw)?{seed:rows.find(r=>r.winRaw).seed,
      raw:rows.find(r=>r.winRaw).winRaw}:null};
}
function makeFormation(saved,frontIndices){
  const source=JSON.parse(saved).formation;
  const melee=[...source.front,...source.mid].map(u=>({type:u.type,count:u.count}));
  const front=new Set(frontIndices);
  const next={front:melee.filter((_,i)=>front.has(i)),mid:melee.filter((_,i)=>!front.has(i)),
    back:source.back.map(u=>({type:u.type,count:u.count}))};
  assert.equal(next.front.length,4);assert.equal(next.mid.length,4);
  const {env,run}=load(saved);
  const prior=state(run);
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

const baseline=load(raw),initial=state(baseline.run);
assert.equal(initial.city,247);assert.equal(initial.deployed,626);
assert.equal(initial.stars,6);assert.equal(initial.field,657);
const original=JSON.parse(raw).formation;
const labels=[...original.front.map((u,i)=>`F${i}:${u.type}${u.count}`),
  ...original.mid.map((u,i)=>`M${i}:${u.type}${u.count}`)];
// Keep all 12 groups and every soldier, swap exactly one frontline and middle group.
const swaps=[];
for(let f=0;f<4;f++)for(let m=4;m<8;m++){
  const indices=[0,1,2,3].map(x=>x===f?m:x);
  const formed=makeFormation(raw,indices),p=pressure(formed.saved,4);
  swaps.push({frontIndices:indices,frontNames:indices.map(i=>labels[i]),
    saveSha256:sha(formed.saved),wins4:p.wins,closest4:p.closestEnemyHp,
    rows4:p.rows.map(r=>({seed:r.seed,result:r.result,enemyHpLeft:r.enemyHpLeft,loss:r.loss}))});
}
swaps.sort((a,b)=>b.wins4-a.wins4||a.closest4-b.closest4);
const fullSwaps=[];
for(const sw of swaps.slice(0,4)){
  const formed=makeFormation(raw,sw.frontIndices),p=pressure(formed.saved);
  fullSwaps.push({...sw,wins16:p.wins,closest16:p.closestEnemyHp,rows16:p.rows});
}
// Pick the same sixteen-win lineup with the smallest mean battle loss.
const finalists=fullSwaps.filter(x=>x.wins16===16);
assert.ok(finalists.length>0);
finalists.sort((a,b)=>a.rows16.reduce((n,r)=>n+r.loss,0)-b.rows16.reduce((n,r)=>n+r.loss,0));
const chosen=finalists[0];
const chosenForm=makeFormation(raw,chosen.frontIndices),chosenPressure=pressure(chosenForm.saved);
assert.equal(chosenPressure.wins,16);
const chosenFile='p393-tier2-reformed-six-star-paid-save.json';
fs.writeFileSync(path.join(data,chosenFile),chosenForm.saved);
const firstWin=chosenPressure.firstWin;
const firstWinFile='p393-tier2-reformed-six-star-seed1-win-save.json';
assert.equal(firstWin.seed,1);
fs.writeFileSync(path.join(data,firstWinFile),firstWin.raw);
const tier3FromWin=pressure(firstWin.raw,16,'starBeast3');

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
  const after=state(run),finalRaw=checkpoint(env,run);
  assert.equal(after.deployed,626);assert.equal(after.army,672);
  assert.deepEqual(after.items,before.items);assert.equal(after.deed,before.deed);
  return{before,need,trainingCost,seconds,minFood,phases,after,
    resBefore,resAfter:run('({...S.res})'),saved:finalRaw};
}
const refreshed=replenish(firstWin.raw,JSON.parse(chosenForm.saved).formation);
const refreshedFile='p393-tier2-reformed-replenished-paid-save.json';
fs.writeFileSync(path.join(data,refreshedFile),refreshed.saved);
probeNow+=86400000;
const day2Load=load(refreshed.saved);
assert.equal(day2Load.run("dailyCount('starBeast2')"),0);
const day2=pressure(refreshed.saved);
probeNow=now;
// Withhold only non-attacking middle-row soldiers to fit the next star without a deed purchase.
const lean=load(firstWin.raw),leanBefore=state(lean.run);
lean.run("adjForm('expedition','mid',3,-40)");
lean.run("adjForm('expedition','mid',1,-21)");
assert.equal(lean.run('formSoldierCount()'),557);
const leanStar=lean.run('steamMilitaryStarStep(1)');
assert.equal(leanStar.ok,true);
const leanAfter=state(lean.run),leanRaw=checkpoint(lean.env,lean.run);
assert.equal(leanAfter.deed,leanBefore.deed);
assert.equal(leanAfter.army,leanBefore.army);
const leanTier3=pressure(leanRaw,16,'starBeast3');

// Continue the paid victory path: restore all eight casualties, then purchase the smallest
// city expansion needed to retain the full 626-person formation at each next star.
const postWinStage3=[];let postWinRaw=refreshed.saved;
for(let target=7;target<=10;target++){
  const {env,run}=load(postWinRaw),before=state(run);
  const needed=Math.max(0,Math.ceil((before.deployed-run(`steamMilitaryFieldSize(${target})`))/4));
  const quote=run(`settlementBatchPreview('city',${needed})`);
  if(!quote.ok){postWinStage3.push({target,before,needed,quote});break}
  const built=run(`upgradeSettlementBatch('city',${needed},${before.city},${before.deed})`);
  assert.equal(built.ok,true);
  const starred=run('steamMilitaryStarStep(1)');
  assert.equal(starred.ok,true);
  const after=state(run),saved=checkpoint(env,run),p=pressure(saved,16,'starBeast3');
  const entry={target,before,needed,cost:quote.cost,built,starred,after,
    saveSha256:sha(saved),tier3Wins16:p.wins,closestTier3:p.closestEnemyHp,rows:p.rows};
  if(target===10){
    const file='p393-tier3-city-star10-prebattle-paid-save.json';
    fs.writeFileSync(path.join(data,file),saved);
    entry.checkpointFile=file;
  }
  if(p.firstWin){
    const file=`p393-tier3-city-star${target}-seed${p.firstWin.seed}-paid-save.json`;
    fs.writeFileSync(path.join(data,file),p.firstWin.raw);
    entry.firstWin={seed:p.firstWin.seed,file,sha256:sha(p.firstWin.raw)};
  }
  postWinStage3.push(entry);postWinRaw=saved;
  if(p.wins===16)break;
}
const postWinHigher=[];
const tier3Full=postWinStage3.find(x=>x.tier3Wins16===16&&x.firstWin);
if(tier3Full){
  let current=fs.readFileSync(path.join(data,tier3Full.firstWin.file),'utf8');
  for(let tier=4;tier<=9;tier++){
    const p=pressure(current,16,`starBeast${tier}`);
    const entry={tier,wins16:p.wins,closest:p.closestEnemyHp,rows:p.rows};
    if(p.firstWin){
      const file=`p393-tier${tier}-after-star10-seed${p.firstWin.seed}-paid-save.json`;
      fs.writeFileSync(path.join(data,file),p.firstWin.raw);
      entry.firstWin={seed:p.firstWin.seed,file,sha256:sha(p.firstWin.raw)};
      current=p.firstWin.raw;
    }
    postWinHigher.push(entry);
    if(!p.firstWin)break;
  }
}
let tier3FirstWin=null;
if(tier3FromWin.firstWin){
  const file=`p393-tier3-after-tier2-seed${tier3FromWin.firstWin.seed}-paid-save.json`;
  fs.writeFileSync(path.join(data,file),tier3FromWin.firstWin.raw);
  tier3FirstWin={seed:tier3FromWin.firstWin.seed,file,sha256:sha(tier3FromWin.firstWin.raw)};
}
let day2FirstWin=null;
if(day2.firstWin){
  const file=`p393-tier2-day2-seed${day2.firstWin.seed}-paid-save.json`;
  fs.writeFileSync(path.join(data,file),day2.firstWin.raw);
  day2FirstWin={seed:day2.firstWin.seed,file,sha256:sha(day2.firstWin.raw)};
}

// Build only enough city levels to let the existing 626 soldiers pass each next star's field cap.
const paid=[];let currentRaw=raw;
for(let target=7;target<=10;target++){
  const {env,run}=load(currentRaw),before=state(run);
  const needed=Math.max(0,Math.ceil((before.deployed-run(`steamMilitaryFieldSize(${target})`))/4));
  let quote=null,built=null;
  if(needed){
    quote=run(`settlementBatchPreview('city',${needed})`);
    if(!quote.ok){paid.push({target,before,needed,quote});break}
    built=run(`upgradeSettlementBatch('city',${needed},${before.city},${before.deed})`);
    assert.equal(built.ok,true,JSON.stringify(built));
  }
  const starred=run('steamMilitaryStarStep(1)');
  assert.equal(starred.ok,true,JSON.stringify(starred));
  assert.equal(run('S.steamMilitaryStars'),target);
  const after=state(run),saved=checkpoint(env,run),p=pressure(saved);
  const entry={target,before,needed,quote:quote?{cost:quote.cost,gain:quote.gain}:null,
    built,starred,after,saveSha256:sha(saved),wins16:p.wins,closest16:p.closestEnemyHp,
    rows:p.rows};
  if(p.firstWin){
    const winFile=`p393-tier2-city-star${target}-seed${p.firstWin.seed}-paid-save.json`;
    fs.writeFileSync(path.join(data,winFile),p.firstWin.raw);
    entry.firstWin={seed:p.firstWin.seed,file:winFile,sha256:sha(p.firstWin.raw)};
  }
  paid.push(entry);currentRaw=saved;
  if(target===7){
    const checkpointFile='p393-tier2-city-star7-paid-save.json';
    fs.writeFileSync(path.join(data,checkpointFile),saved);
    entry.checkpointFile=checkpointFile;
  }
  if(p.wins===16)break;
}
const output={batch:'P393',source,sourceSha256:sha(raw),runtimeSha256:Object.fromEntries(
  ['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
  initial,labels,swaps,fullSwaps,paid,
  chosen:{frontIndices:chosen.frontIndices,frontNames:chosen.frontNames,
    formationFile:chosenFile,formationSha256:sha(chosenForm.saved),wins16:chosenPressure.wins,
    rows:chosenPressure.rows,firstWin:{seed:firstWin.seed,file:firstWinFile,sha256:sha(firstWin.raw)}},
  continuation:{tier3FromWin:{wins16:tier3FromWin.wins,closest:tier3FromWin.closestEnemyHp,
      rows:tier3FromWin.rows,firstWin:tier3FirstWin},
    leanSeven:{before:leanBefore,starred:leanStar,after:leanAfter,saveSha256:sha(leanRaw),
      tier3Wins16:leanTier3.wins,closestTier3:leanTier3.closestEnemyHp,rows:leanTier3.rows},
    postWinStage3,postWinHigher,
    replenishment:{before:refreshed.before,need:refreshed.need,trainingCost:refreshed.trainingCost,
      seconds:refreshed.seconds,minFood:refreshed.minFood,phases:refreshed.phases,
      after:refreshed.after,resBefore:refreshed.resBefore,resAfter:refreshed.resAfter,
      file:refreshedFile,sha256:sha(refreshed.saved)},
    day2:{wins16:day2.wins,closest:day2.closestEnemyHp,rows:day2.rows,firstWin:day2FirstWin}},
  scope:'Real clear/confirm formation, settlementBatchPreview/upgradeSettlementBatch, steamMilitaryStarStep, battle/endBattle, save/load. Fixed seeds 1–16. No resource, unit or config injection.'};
const outputFile='p393-tier2-paid-route.json';
fs.writeFileSync(path.join(data,outputFile),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({initial,topSwaps:fullSwaps.map(x=>({frontNames:x.frontNames,wins16:x.wins16,closest16:x.closest16})),
  chosen:{frontNames:chosen.frontNames,wins16:chosenPressure.wins,firstWin:{seed:firstWin.seed,file:firstWinFile},
    tier3Wins:tier3FromWin.wins,replenishNeed:refreshed.need,trainingCost:refreshed.trainingCost,
    replenishSeconds:refreshed.seconds,day2Tier2Wins:day2.wins,
    leanSevenTier3Wins:leanTier3.wins,
    postWinStage3:postWinStage3.map(x=>({target:x.target,needed:x.needed,cost:x.cost,
      tier3Wins16:x.tier3Wins16,closestTier3:x.closestTier3,firstWin:x.firstWin})),
    postWinHigher:postWinHigher.map(x=>({tier:x.tier,wins16:x.wins16,closest:x.closest,firstWin:x.firstWin}))},
  paid:paid.map(x=>({target:x.target,needed:x.needed,cost:x.quote?.cost,beforeDeed:x.before.deed,
    afterDeed:x.after?.deed,field:x.after?.field,wins16:x.wins16,closest16:x.closest16,firstWin:x.firstWin})),
  outputFile},null,2));
