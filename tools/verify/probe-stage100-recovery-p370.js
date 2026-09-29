'use strict';
// P370: isolated stage-100 pressure sweep and paid post-win army recovery.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sources={
  star40:{name:'p338-electric5-nuclear5-star-attack-40-paid-save.json',sha256:'19f1b0c94717619cc9230b92b8a1efe8f247483510db86b4bc70667fcee292c8'},
  star120:{name:'p338-electric5-nuclear5-star-attack-120-paid-save.json',sha256:'ada73728e798a33479148b9ee170da4756132e270b62fd800976a00633199872'}
};
for(const x of Object.values(sources)){
  x.raw=fs.readFileSync(path.join(data,x.name),'utf8');assert.equal(hash(x.raw),x.sha256);
  x.save=JSON.parse(x.raw);x.target=x.save.formation;
  x.targetByType={};
  for(const groups of Object.values(x.target))for(const u of groups)x.targetByType[u.type]=(x.targetByType[u.type]||0)+u.count;
  assert.equal(Object.values(x.targetByType).reduce((a,b)=>a+b,0),626);
}
const sourceHashes=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
  'tools/verify/probe-stage100-recovery-p370.js'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
function setup(run,origin,seed){
  run(`globalThis.__clockMs=${origin.ts};globalThis.__tickBase=${origin.tick};
    globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{static now(){return __clockMs}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
}
function state(run){return run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),
  food:S.res.food,wood:S.res.wood,stone:S.res.stone,coal:S.res.coal,copper:S.res.copper,
  iron:S.res.iron,steel:S.res.steel,tech:S.res.tech,stage100:S.defeated.includes(100),
  caps:Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','tech'].map(k=>[k,resCap(k)]))})`)}
function battle(variant,scale,seed,keepRaw=false){
  const src=sources[variant],env=environment({rts_save:src.raw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('S.defeated.includes(99)'),true);
  assert.equal(run('S.defeated.includes(100)'),false);
  setup(run,src.save,seed);
  run(`const __p370boss=CFG.enemies.find(x=>x.id===100);
    __p370boss.units=Object.fromEntries(Object.entries(__p370boss.units).map(([uk,counts])=>[uk,counts.map(()=>${scale})]));`);
  const before=state(run);
  assert.equal(before.deployed,626);assert.equal(before.army,672);
  run('selEnemy(99);openBattle()');assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
  let callbacks=0;while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);const won=run("document.getElementById('battle-result').className")==='win';
  const after=state(run),remainingHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  assert.equal(after.stage100,won);assert.equal(after.tick,before.tick);
  const raw=env.store.get('rts_save'),reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.defeated.includes(100)'),won);
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  const out={variant,scale,seed,before,enemy,won,after,loss:before.deployed-after.deployed,
    remainingHp,callbacks,saveSha256:hash(raw)};
  if(keepRaw)out.raw=raw;
  return out;
}
const scales=[110,140,170],variants=Object.keys(sources),seedCount=128,rows=[],summary=[];
for(const variant of variants)for(const scale of scales){
  const subset=[];
  for(let seed=1;seed<=seedCount;seed++){
    const x=battle(variant,scale,seed);subset.push(x);rows.push(x);
  }
  const wins=subset.filter(x=>x.won).sort((a,b)=>a.loss-b.loss||a.seed-b.seed);
  const losses=subset.filter(x=>!x.won);
  const representativeWin=wins.length?wins[Math.floor((wins.length-1)/2)]:null;
  const representativeLoss=losses[0]||null;
  summary.push({variant,scale,wins:wins.length,of:subset.length,enemy:subset[0].enemy,
    meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    minWinLoss:wins.length?wins[0].loss:null,maxWinLoss:wins.length?wins.at(-1).loss:null,
    representativeWin:representativeWin?{seed:representativeWin.seed,loss:representativeWin.loss}:null,
    representativeLoss:representativeLoss?{seed:representativeLoss.seed,loss:representativeLoss.loss,remainingHp:representativeLoss.remainingHp}:null});
  console.error(JSON.stringify(summary.at(-1)));
}
const pilot={batch:'P370',kind:'isolated true stage-100 battle and reload, per-group enemy count conditional only',
  inputSources:Object.fromEntries(Object.entries(sources).map(([k,x])=>[k,{file:x.name,sha256:x.sha256}])),
  sourceHashes,scales,seedCount,summary,rows,
  caveat:'Each seed is an independent reset from a paid stage-99 save; selected winning replays are conditional paths, not natural uninterrupted RNG or win probabilities.'};
fs.writeFileSync(path.join(data,'p370-stage100-pilot.json'),JSON.stringify(pilot,null,2)+'\n');
if(process.argv.includes('--pilot')){console.log(JSON.stringify({summary},null,2));process.exit(0)}

function recover(variant,scale,seed,offlineSeconds){
  const src=sources[variant],win=battle(variant,scale,seed,true);
  assert.equal(win.won,true);const raw=win.raw;delete win.raw;
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const saved=JSON.parse(raw);setup(run,saved,seed);
  run(`globalThis.__trainingPaid={};globalThis.__trainedCount=0;globalThis.__minFood=S.res.food;
    const __payP370=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payP370(cost,n);
      for(const key of trainingCostKeys(cost)){
        const paid=before[key]-S.res[key],expected=cost[key]*n;
        if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
        __trainingPaid[key]=(__trainingPaid[key]||0)+paid;
      }
      __trainedCount+=n;__minFood=Math.min(__minFood,S.res.food);return result;
    };
    const __prodP370=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=function(...args){const x=__prodP370(...args);
      if(x.res.food>=0)__minFood=Math.min(__minFood,x.res.food);return x};`);
  const target=src.target,targetByType=src.targetByType;
  const before=state(run);assert.equal(before.stage100,true);
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  let offline=null,prequeued=0,cancelled=0;
  if(offlineSeconds){
    prequeued=Math.max(0,targetByType.archer-run("poolAvail('archer')"));
    if(prequeued){const q=run(`train('archer',${prequeued})`);assert.equal(q?.ok,true);assert.equal(q.qty,prequeued)}
    run(`__clockMs=${saved.ts+offlineSeconds*1000}`);
    const result=run('settleOffline()');assert.equal(result?.ok,true);
    assert.equal(result.durationSec,offlineSeconds);
    offline={result,report:run('S.offline.pendingReport'),after:state(run),trained:run('__trainedCount'),paid:run('({...__trainingPaid})')};
    assert.equal(offline.report?.durationSec,offlineSeconds);
    const qleft=run("queueTotal('archer')");
    if(qleft){const q=run(`dismissN('archer',${qleft})`);assert.equal(q?.ok,true);assert.equal(q.cancelled,qleft);assert.equal(q.dismissed,0);cancelled=qleft}
  }else{
    run(`__clockMs=${saved.ts}`);
    const result=run('settleOffline()');assert.equal(result?.ok,false);
    offline={result,report:null,after:state(run),trained:0,paid:{}};
  }
  run(`globalThis.__onlineBaseMs=${saved.ts+offlineSeconds*1000};globalThis.__onlineBaseTick=S.tick;
    Date.now=()=>__onlineBaseMs+(S.tick-__onlineBaseTick)*1000;`);
  const phases={wood:0,stone:0,coal:0,copper:0,iron:0,steel:0,gold:0,tech:0,training:0};
  let onlineSeconds=0,phase='tech';
  const value=rk=>run(`S.res.${rk}`),cap=rk=>run(`resCap('${rk}')`);
  function assign(resource){
    for(const [key,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
    assert.equal(run('popAllocTotal()'),1002);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food');
    phase=resource;
  }
  function advanceUntil(expression,max,stop='false'){
    const x=run(`(()=>{let n=0;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++}
      return{n,done:!!(${expression})}})()`);
    onlineSeconds+=x.n;phases[phase]+=x.n;
    assert.ok(run('__minFood')>0,'food depleted');return x;
  }
  function fillBasic(resource,targetValue){
    if(value(resource)>=targetValue)return;
    assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
    assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,20000).done,resource+' fill timeout');
  }
  function fillProcessed(resource,targetValue){
    if(value(resource)>=targetValue)return;
    assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
    let cycles=0;
    while(value(resource)<targetValue&&cycles++<100){
      if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
      if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
      if(resource==='steel'&&value('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
      const beforeStock=value(resource);assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${targetValue}`,10000,stop);
      assert.ok(value(resource)>beforeStock,resource+' fill exhausted');
    }
    assert.ok(value(resource)>=targetValue,resource+' fill exhausted');
  }
  function fill(resource,targetValue){if(value(resource)>=targetValue)return;
    if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,targetValue);
    else fillBasic(resource,targetValue)}
  const shortages={},expected={};
  for(const uk of ['archer',...Object.keys(targetByType).filter(x=>x!=='archer')]){
    const wanted=targetByType[uk],short=Math.max(0,wanted-run(`poolAvail('${uk}')`));
    shortages[uk]=short;if(!short)continue;
    assert.equal(run(`queueTotal('${uk}')`),0);
    const cost=run(`({...CFG.units.${uk}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');const queued=run(`train('${uk}',${short})`);
    assert.equal(queued?.ok,true,uk+' train '+JSON.stringify(queued));
    assert.equal(queued.qty,short);
    phase='training';assert.ok(advanceUntil(`poolAvail('${uk}')>=${wanted}`,25000).done,uk+' train timeout');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const final=state(run),paid=run('({...__trainingPaid})'),trained=run('__trainedCount'),minFood=run('__minFood');
  assert.equal(final.army,672);assert.equal(final.deployed,626);assert.equal(final.queue,0);
  assert.equal(final.stage100,true);assert.equal(trained,win.loss);
  for(const [resource,amount] of Object.entries(expected)){
    const actual=(paid[resource]||0)-(offline.paid[resource]||0);
    assert.ok(Math.abs(actual-amount)<1e-6,resource+' paid');
  }
  assert.equal(run('save().ok'),true);
  const finalRaw=env.store.get('rts_save'),reload=environment({rts_save:finalRaw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),626);
  assert.equal(reload.run('S.defeated.includes(100)'),true);
  const finalFile=`p370-stage100-${variant}-${scale}-seed${seed}-${offlineSeconds?'4h':'0h'}-paid-save.json`;
  fs.writeFileSync(path.join(data,finalFile),finalRaw);
  return{variant,scale,seed,offlineSeconds,win,afterBattle:before,prequeued,cancelled,offline,
    shortages,expected,paid,trained,onlineSeconds,phases,minFood,final,
    finalFile,finalSaveSha256:hash(finalRaw)};
}
const routes=[];
for(const row of summary){
  if(!row.representativeWin)continue;
  for(const offlineSeconds of [0,14400]){
    const route=recover(row.variant,row.scale,row.representativeWin.seed,offlineSeconds);
    routes.push(route);
    console.error(JSON.stringify({variant:route.variant,scale:route.scale,offlineSeconds,
      seed:route.seed,loss:route.win.loss,trained:route.trained,onlineSeconds:route.onlineSeconds,
      minFood:route.minFood,finalSaveSha256:route.finalSaveSha256}));
  }
}
const report={batch:'P370',kind:'selected paid post-victory true training, queue and 0/4h offline continuation',
  sourceHashes,inputSources:pilot.inputSources,pilotFile:'p370-stage100-pilot.json',summary,routes,
  caveat:'The median-loss winning seed is selected after 128 independent combat streams per case; conditional existence and repair, not a natural win rate or uninterrupted stream.'};
fs.writeFileSync(path.join(data,'p370-stage100-recovery.json'),JSON.stringify(report,null,2)+'\n');
for(const x of Object.values(sources))assert.equal(hash(fs.readFileSync(path.join(data,x.name),'utf8')),x.sha256);
console.log(JSON.stringify({pilotFile:'p370-stage100-pilot.json',recoveryFile:'p370-stage100-recovery.json',
  summary,routes:routes.map(x=>({variant:x.variant,scale:x.scale,offlineSeconds:x.offlineSeconds,seed:x.seed,
    loss:x.win.loss,trained:x.trained,onlineSeconds:x.onlineSeconds,minFood:x.minFood,finalFile:x.finalFile,
    finalSaveSha256:x.finalSaveSha256}))},null,2));
