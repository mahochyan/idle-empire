'use strict';
// 从P325首星或P326精英胜档真实生产、训练并恢复P324满编，不改玩家代码与源档。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const variant=process.argv[2]||'first-star';
const cases={
  'first-star':{file:'p325-soul-nine-slot-first-star-save.json',sha:'624f027af07125a037e9c578cb58e8debc1a5eb5a1139c3f458f4a6d3667776f',army:407,stone:3,alert:5000,stars:1,out:'p326-soul-first-star'},
  'elite':{file:'p326-soul-alert5000-540399-win-save.json',sha:'b284fd98fef299c4419587615adbbcc4ae75fa031d1267497db3d623440b33fc',army:489,stone:10,alert:5200,stars:1,out:'p326-soul-alert5000-elite'},
  'source-two-win':{file:'p327-soul-source-two-win-save.json',sha:'1bd5fa90717f345eb0e071f03687829fc8690f508fd783d45cd972761c1ccafa',army:453,stone:99,alert:4850,stars:0,out:'p327-soul-source-two-win'},
  'source-first-star':{file:'p327-soul-source-growth-paid-first-star-save.json',sha:'dd29c772368d2a3076d37e67d60e820488848888bc01e5e4802d0cd1c1772280',army:621,stone:3,alert:5000,stars:1,out:'p327-soul-source-first-star'}
};
assert.ok(Object.prototype.hasOwnProperty.call(cases,variant));
const selected=cases[variant],sourceFile='docs/codex/reports/data/'+selected.file;
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(source),selected.sha);
const rngStart=variant==='source-two-win'?
  JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p326-soul-source-growth-paid-check.json'),'utf8')).continuous.intermediateRng:
  variant==='source-first-star'?JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p327-soul-source-growth-paid-star.json'),'utf8')).rngEnd:3260001;
assert.ok(Number.isSafeInteger(rngStart)&&rngStart>0);
const rosterFile='docs/codex/reports/data/p324-soul-alert4550-restored-save.json';
const rosterRaw=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterRaw),'ba54521f29f3bad88494f67b277c47e95c109a522f88ad9650c3a06e2e4aa69f');
const origin=JSON.parse(source),roster=JSON.parse(rosterRaw),target=roster.formation,targetByType={};
for(const row of Object.values(target))for(const u of row)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((sum,n)=>sum+n,0),626);
const env=environment({rts_save:source}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  addLog=msg=>{S.log.push({time:new __RealDate(Date.now()).toLocaleTimeString(),msg:String(msg)});
    if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${rngStart};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;}return result};`);
const snap=()=>run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,firstStar:S.soulRanks.arcane_mage?.stars||0,food:S.res.food,team:JSON.stringify(S.soulRealmTeam)})');
const opening=snap();assert.equal(opening.army,selected.army);
assert.equal(opening.stone,selected.stone);assert.equal(opening.alert,selected.alert);assert.equal(opening.firstStar,selected.stars);
let onlineSeconds=0,minFood=opening.food;const allocationSeconds={},paidTraining={},losses={};
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
run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
for(const[unit,wanted]of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);losses[unit]=short;
  if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  assign('tech');const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','training').done,unit+' training timeout');
}
assert.equal(Object.values(losses).reduce((sum,n)=>sum+n,0),672-opening.army);
for(const[row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
});
const restored=snap();assert.equal(restored.army,672);assert.equal(restored.deployed,626);
assert.equal(restored.stone,selected.stone);assert.equal(restored.alert,selected.alert);assert.equal(restored.firstStar,selected.stars);
assert.equal(restored.team,opening.team);
for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-(run(`__actualTraining.${key}`)||0))<1e-6,key+' actual training debit');
assert.equal(run('save().ok'),true);
const restoredText=env.store.get('rts_save'),restoredFile=`docs/codex/reports/data/${selected.out}-restored-save.json`;
const reload=environment({rts_save:restoredText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),672);assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(reload.run('S.items.soulStone'),selected.stone);assert.equal(reload.run('S.killValues.soulRealm'),selected.alert);
assert.equal(reload.run('S.soulRanks.arcane_mage?.stars||0'),selected.stars);
assert.equal(reload.run('JSON.stringify(S.soulRealmTeam)'),opening.team);
fs.writeFileSync(path.join(root,restoredFile),restoredText,'utf8');
const report={batch:variant.startsWith('source-')?'P327':'P326',kind:`real resource production, queue payment and formation restoration from ${variant} win save`,
  sourceFile,sourceSha256:sha(source),rosterFile,rosterSha256:sha(rosterRaw),unit:'simulated online seconds, resource units, soldiers',
  opening,losses,onlineSeconds,allocationSeconds,minFood,paidTraining,actualTraining:run('({...__actualTraining})'),restored,rngStart,rngEnd:run('__rng'),
  restoredFile,restoredSha256:sha(restoredText),
  limits:['This is one fixed resource allocation schedule, not a minimum or player median time.',
    'The P325 source descends from earlier selected fixed-seed battles; this does not validate a natural continuous new-game route.']};
const reportFile=`docs/codex/reports/data/${selected.out}-recovery.json`;
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(source));
console.log(JSON.stringify({opening,losses,onlineSeconds,paidTraining,minFood,restored,restoredSha256:sha(restoredText),reportFile},null,2));
