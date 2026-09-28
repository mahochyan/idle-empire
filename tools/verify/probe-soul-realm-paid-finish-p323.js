'use strict';
// Paid continuation from P323's restored roster; finishes the soul-realm science if medals suffice.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p323-soul-realm-route-185battles-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'6f04dad92881333a94885c45c659de87aaf19f0e3f0f6556f4b36ecf86026d27');
const limit=Number(process.argv[2]||20);
assert.ok(Number.isSafeInteger(limit)&&limit>0&&limit<=350,'limit must be 1..350');
const origin=JSON.parse(raw),target=origin.formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=324;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){
    const before=Object.fromEntries(trainingCostKeys(cost).map(key=>[key,S.res[key]]));
    const result=__originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;
    }
    return result;
  };`);
const snap=()=>run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal,bone:S.res.bone,food:S.res.food,stone:S.res.stone,coal:S.res.coal,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,tech:S.res.tech,turtleAlert:S.killValues.wildTurtle,bullAlert:S.killValues.wildBull,boarAlert:S.killValues.wildBoar,snakeAlert:S.killValues.wildSnake,tigerAlert:S.killValues.wildTiger,wyrmAlert:S.killValues.wildWyrm,arcaneMage:S.pool.arcane_mage,soulStone:S.items.soulStone})');
const opening=snap();assert.equal(opening.deployed,626);
assert.equal(opening.bullAlert,3640);
assert.equal(run("scienceUnlocked('sci_astral_lord')"),true);
assert.equal(run("scienceUnlocked('sci_soul_realm')"),false);
let onlineSeconds=0,minFood=opening.food;const allocationSeconds={},paidTraining={},rows=[];
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[key,count]of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',resource='training'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=x.n;allocationSeconds[resource]=(allocationSeconds[resource]||0)+x.n;minFood=Math.min(minFood,x.min);
  assert.ok(x.min>0,'food depleted');return x;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000,'false',resource).done,resource+' fill timeout');
}
function fillProcessed(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  let cycles=0;
  while(val(resource)<targetValue&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetValue}`,7000,stop,resource);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){
  if(val(resource)>=targetValue)return;
  if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue);
}
function restoreRoster(before,afterBattle){
  const spentBefore=run('({...__actualTraining})'),elapsedBefore=onlineSeconds;
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  const losses={},costPaid={};
  for(const[unit,wanted]of Object.entries(targetByType)){
    const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
    losses[unit]=short;if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);costPaid[resource]=(costPaid[resource]||0)+per*short;
      paidTraining[resource]=(paidTraining[resource]||0)+per*short;
    }
    // While the queue trains, earn knowledge without consuming the stone/coal reserved for later soldiers.
    assign('tech');
    const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
    const trained=advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','training');
    if(!trained.done)assert.fail(unit+' training '+JSON.stringify(run(`({pool:S.pool.${unit},queue:S.queue.${unit},cap:unitCap('${unit}'),res:S.res,alloc:S.popAlloc})`)));
  }
  for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type,row+slot+' type');
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' count');
  });
  const restored=snap(),spentAfter=run('({...__actualTraining})');
  assert.equal(Object.values(losses).reduce((n,v)=>n+v,0),before.army-afterBattle.army);
  assert.equal(restored.army,before.army);assert.equal(restored.deployed,before.deployed);
  assert.equal(restored.arcaneMage,1);
  for(const[key,amount]of Object.entries(costPaid))assert.ok(Math.abs(amount-(spentAfter[key]||0)+(spentBefore[key]||0))<1e-6,key+' actual debit');
  return{losses,costPaid,seconds:onlineSeconds-elapsedBefore};
}
const routePhases=[
  ['tigerPelt','tigerAlert',3300],['wyrmSinew','wyrmAlert',3900],['bone','boarAlert',4400],
  ['tigerPelt','tigerAlert',3500],['wyrmSinew','wyrmAlert',4000],
  ['bullHorn','bullAlert',3800],['bone','boarAlert',4500],['bullHorn','bullAlert',4000],
  ['turtleShell','turtleAlert',4400]
];
let phaseIndex=0;
let phaseFailures=0;
function route(before){
  while(phaseIndex<routePhases.length&&before[routePhases[phaseIndex][1]]>=routePhases[phaseIndex][2]){phaseIndex++;phaseFailures=0}
  return routePhases[phaseIndex]?.[0]||null;
}
let stoppingReason='limit';
let defeats=0;
for(let n=1;n<=limit;n++){
  const before=snap(),encounter=route(before);
  if(!encounter){stoppingReason='routes-exhausted';break}
  run(`openMaterialDomain('${encounter}')`);assert.equal(run('S.battleActive'),true);
  let callbacks=0;while(run('S.battleActive')&&callbacks++<2000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<2000);
  const result=run("document.getElementById('battle-result').className"),afterBattle=snap();
  run('exitBattle()');
  if(result!=='win'){
    defeats++;
    const restoration=restoreRoster(before,afterBattle),after=snap();
    assert.equal(after.medal,before.medal);assert.equal(after.bone,before.bone);
    assert.equal(run('save().ok'),true);
    rows.push({n,encounter,result,callbacks,before,afterBattle,restoration,after});
    console.error(`P323 finish defeat ${defeats} on attempt ${n}, ${encounter}; recovered ${restoration.losses&&Object.values(restoration.losses).reduce((a,b)=>a+b,0)} soldiers; medal=${after.medal}`);
    phaseFailures++;
    if(phaseFailures>=2){phaseIndex++;phaseFailures=0}
    if(defeats>=12){stoppingReason='defeat-limit';break}
    continue;
  }
  assert.ok(afterBattle.bone>before.bone);
  const restoration=restoreRoster(before,afterBattle);
  const trades=Math.floor(val('bone')/run('beastBoneTradeCost()'));
  const trade=run(`exchangeBonesForMedals(${trades})`);assert.equal(trade.ok,true);
  const after=snap();assert.equal(after.medal,before.medal+trade.medalGain);
  assert.equal(run('save().ok'),true);
  rows.push({n,encounter,result,callbacks,before,afterBattle,restoration,trades,trade,after});
  phaseFailures=0;
  if(n%10===0)console.error(`P323 finish ${n} attempts; medal=${after.medal}; route=${encounter}; onlineSeconds=${onlineSeconds}`);
  if(after.medal>=300000){stoppingReason='medal-ready';break}
}
let science=null;
if(stoppingReason==='medal-ready'){
  assign('tech');
  const wait=advanceUntil('S.res.tech>=20000000',20000,'false','tech');assert.ok(wait.done);
  const before=snap(),paid=run("researchScience('sci_soul_realm')");assert.equal(paid.ok,true);
  const after=snap();assert.equal(before.tech-after.tech,20000000);assert.equal(before.medal-after.medal,300000);
  assert.equal(run("scienceUnlocked('sci_soul_realm')"),true);
  const duplicate=run("researchScience('sci_soul_realm')");assert.equal(duplicate.repeat,true);
  assert.equal(snap().tech,after.tech);assert.equal(snap().medal,after.medal);
  science={wait,before,paid,after};
}
const final=snap();assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.res.medal'),final.medal);
assert.equal(reload.run('S.res.tech'),final.tech);
assert.equal(reload.run('S.killValues.wildTurtle'),final.turtleAlert);
assert.equal(reload.run('S.killValues.wildBull'),final.bullAlert);
assert.equal(reload.run('S.killValues.wildBoar'),final.boarAlert);
assert.equal(reload.run('S.killValues.wildSnake'),final.snakeAlert);
assert.equal(reload.run('S.killValues.wildTiger'),final.tigerAlert);
assert.equal(reload.run('S.killValues.wildWyrm'),final.wyrmAlert);
assert.equal(reload.run('S.items.soulStone'),origin.items.soulStone);
if(science)assert.equal(reload.run("scienceUnlocked('sci_soul_realm')"),true);
const actualTraining=run('({...__actualTraining})');
for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-(actualTraining[key]||0))<1e-6,key+' total training debit');
if(stoppingReason!=='defeat'){
  assert.equal(reload.run('armyCount()'),opening.army);
  assert.equal(reload.run('formSoldierCount()'),opening.deployed);
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const stem=`p323-soul-realm-finish-${rows.length}battles`;
const saveFile=`docs/codex/reports/data/${stem}-save.json`;
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P323',sourceFile,sourceSha256:sha(raw),seed:324,rng:'one continuous xorshift32 stream from this reloaded save; no per-battle reseeding',routePhases,
  unit:'simulated online seconds, resource units, soldiers',limit,opening,stoppingReason,rows,
  science,onlineSeconds,allocationSeconds,minFood,paidTraining,actualTraining,final,
  saveFile,saveSha256:sha(finalRaw)};
const dataFile=`docs/codex/reports/data/${stem}.json`;
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({batch:report.batch,sourceSha256:report.sourceSha256,seed:report.seed,limit,stoppingReason,
  battles:rows.length,wins:rows.filter(row=>row.result==='win').length,defeats,
  routes:Object.fromEntries([...new Set(routePhases.map(([key])=>key))].map(key=>[key,rows.filter(row=>row.encounter===key&&row.result==='win').length])),
  science,onlineSeconds,allocationSeconds,minFood,
  paidTraining,final,saveFile,saveSha256:report.saveSha256,dataFile},null,2));
