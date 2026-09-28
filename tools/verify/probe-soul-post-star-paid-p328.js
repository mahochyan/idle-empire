'use strict';
// P328: 从首星满编档沿同一随机流连续作战，并用真实生产、付费训练恢复阵容。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const mode=process.argv[2]||'historical-fixed';
assert.ok(['historical-fixed','soul-attrition'].includes(mode));
const outputBatch=mode==='historical-fixed'?'p328':'p329';
const data='docs/codex/reports/data/';
const sourceFile=data+'p327-soul-source-first-star-restored-save.json';
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(source),'b1d153baefd1eb6979eefcd8d758582bc5c3026b1bb844052eed2c0138f3dd49');
const previous=JSON.parse(fs.readFileSync(path.join(root,data+'p327-soul-source-first-star-recovery.json'),'utf8'));
assert.equal(previous.restoredSha256,sha(source));
const rosterFile=data+'p324-soul-alert4550-restored-save.json';
const rosterRaw=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterRaw),'ba54521f29f3bad88494f67b277c47e95c109a522f88ad9650c3a06e2e4aa69f');
const target=JSON.parse(rosterRaw).formation,targetByType={};
for(const row of Object.values(target))for(const u of row)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);
const origin=JSON.parse(source),env=environment({rts_save:source}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=msg=>{S.log.push({time:new __RealDate(Date.now()).toLocaleTimeString(),msg:String(msg)});
    if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${previous.rngEnd};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;}return result};`);
// P328 旧账固定为入场人数始终出手；P329 仅让英魂聚合体按失血减少出手，两个模式各写独立档。
run(`globalThis.__baseSoulEncounter=materialDomainEncounter;
  materialDomainEncounter=function(key,alert=null,tierId=null){const e=__baseSoulEncounter(key,alert,tierId);
    if(key==='soulStone'&&e)e.attackMassFallsWithHp=${mode==='soul-attrition'};return e};`);
const snap=()=>run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,firstStar:S.soulRanks.arcane_mage?.stars||0,food:S.res.food,slots:[...S.soulRealmTeam.slots]})');
const initial=snap();assert.equal(initial.army,672);assert.equal(initial.deployed,626);
assert.equal(initial.stone,3);assert.equal(initial.alert,5000);assert.equal(initial.firstStar,1);
assert.equal(run("['front','mid','back'].some(row=>S.formation[row].some(u=>u.type==='arcane_mage'))"),false);
let onlineSeconds=0,minFood=initial.food;const allocationSeconds={},rounds=[];
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
function restore(){
  const opening=snap(),paidTraining={},losses={},start=onlineSeconds;
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  for(const[unit,wanted]of Object.entries(targetByType)){
    const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));losses[unit]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
    }
    assign('tech');assert.equal(run(`train('${unit}',${short})`)?.ok,true,unit+' training');
    assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','training').done,unit+' training timeout');
  }
  assert.equal(Object.values(losses).reduce((a,b)=>a+b,0),672-opening.army);
  for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const after=snap();assert.equal(after.army,672);assert.equal(after.deployed,626);
  assert.equal(after.stone,opening.stone);assert.equal(after.alert,opening.alert);
  assert.equal(after.firstStar,opening.firstStar);
  return{opening,after,losses,paidTraining,onlineSeconds:onlineSeconds-start};
}
function checkpoint(label){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save'),file=data+`${outputBatch}-soul-${label}-save.json`;
  const reload=environment({rts_save:saved});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('armyCount()'),672);assert.equal(reload.run('formSoldierCount()'),626);
  assert.equal(reload.run('S.items.soulStone'),run('S.items.soulStone'));
  assert.equal(reload.run('S.killValues.soulRealm'),run('S.killValues.soulRealm'));
  fs.writeFileSync(path.join(root,file),saved,'utf8');
  return{file,sha256:sha(saved),rng:run('__rng')};
}
for(let n=0;n<3;n++){
  const slot=run('S.soulRealmTeam.slots.indexOf(540299)');assert.ok(slot>=0);
  const before=snap(),rngStart=run('__rng');
  assert.equal(before.army,672);assert.equal(before.deployed,626);
  const opened=run(`openSoulRealmSlot(${slot})`);
  assert.equal(opened.ok,true,JSON.stringify({n,slot,opened,battleActive:run('S.battleActive'),battleEncounter:run('S.battleEncounter'),saveProtected:run('saveProtected()'),formCnt:run('formCnt()')}));
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className"),after=snap(),enemyRemainingHp=run('B.enemyUnits[0].hp');
  assert.equal(result,'win','continuous route lost at normal slot '+slot);
  assert.equal(after.slots[slot],null);assert.ok(after.stone>before.stone);assert.equal(after.alert,before.alert+150);
  run('exitBattle()');assert.equal(run('S.battleEncounter'),null);
  const recovery=restore(),saved=checkpoint(`normal-${n+1}`);
  rounds.push({slot,tierId:540299,rngStart,rngEnd:run('__rng'),enemy,enemyRemainingHp,result,before,after,callbacks,recovery,saved});
}
const final=snap(),paidTraining={};for(const round of rounds)for(const[k,n]of Object.entries(round.recovery.paidTraining))paidTraining[k]=(paidTraining[k]||0)+n;
const eliteAttempts=[];
for(let n=0;n<12;n++){
  const slot=run('S.soulRealmTeam.slots.indexOf(540399)');if(slot<0)break;
  const before=snap(),rngStart=run('__rng');
  assert.equal(before.army,672);assert.equal(before.deployed,626);
  const opened=run(`openSoulRealmSlot(${slot})`);assert.equal(opened.ok,true,JSON.stringify({n,slot,opened}));
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className"),after=snap(),enemyRemainingHp=run('B.enemyUnits[0].hp');
  assert.ok(result==='win'||result==='lose',result);
  if(result==='win'){
    assert.equal(after.slots[slot],null);assert.equal(after.alert,before.alert+200);
    assert.ok(after.stone>before.stone);
  }else{
    assert.equal(after.slots[slot],540399);assert.equal(after.alert,before.alert);
    assert.equal(after.stone,before.stone);
  }
  run('exitBattle()');assert.equal(run('S.battleEncounter'),null);
  const recovery=restore(),saved=checkpoint(`elite-${n+1}`);
  eliteAttempts.push({slot,tierId:540399,rngStart,rngEnd:run('__rng'),enemy,enemyRemainingHp,result,before,after,callbacks,recovery,saved});
}
const ending=snap();
let nextTeam=null;
if(mode==='soul-attrition'&&ending.slots.every(id=>id===null)){
  const rngBefore=run('__rng');
  assert.equal(run('refreshSoulRealmTeam().ok'),true);
  nextTeam={state:snap(),rngBefore,saved:checkpoint('refreshed')};
  assert.equal(nextTeam.state.stone,ending.stone);assert.equal(nextTeam.state.alert,ending.alert);
}
for(const attempt of eliteAttempts)for(const[k,n]of Object.entries(attempt.recovery.paidTraining))paidTraining[k]=(paidTraining[k]||0)+n;
for(const[k,n]of Object.entries(paidTraining))assert.ok(Math.abs(n-(run(`__actualTraining.${k}`)||0))<1e-6,k+' actual debit');
const report={batch:outputBatch.toUpperCase(),mode,kind:'one uninterrupted xorshift32 stream with real battles, production, queue payments and formation restoration',
  sourceFile,sourceSha256:sha(source),rosterFile,rosterSha256:sha(rosterRaw),rngStart:previous.rngEnd,rngEnd:run('__rng'),
  unit:'simulated online seconds, soldiers and material items',initial,rounds,afterNormal:final,eliteAttempts,ending,nextTeam,onlineSeconds,allocationSeconds,minFood,
  paidTraining,actualTraining:run('({...__actualTraining})'),
  limits:['The P324 ancestor was selected from earlier fixed-seed wins, so this does not prove a natural new-game route.',
    'The local single-battalion HP and attack-mass mapping does not prove source combat equivalence.']};
const reportFile=data+`${outputBatch}-soul-post-star-paid.json`;
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(source));
console.log(JSON.stringify({initial,normalRounds:rounds.map(x=>({slot:x.slot,result:x.result,after:x.after,losses:x.recovery.losses,onlineSeconds:x.recovery.onlineSeconds})),afterNormal:final,eliteAttempts:eliteAttempts.map(x=>({slot:x.slot,result:x.result,before:x.before,after:x.after,losses:x.recovery.losses,onlineSeconds:x.recovery.onlineSeconds})),ending,nextTeam,onlineSeconds,paidTraining,minFood,reportFile},null,2));
