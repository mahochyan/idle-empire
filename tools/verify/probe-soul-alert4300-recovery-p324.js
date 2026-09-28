'use strict';
// Restore the actual 4050 win and screen the next alert tier from that paid roster.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const step=process.argv[2]||'4300';
assert.ok(['4300','4550'].includes(step));
const expected=step==='4300'?{source:'p324-soul-alert4000-first-win-save.json',sha:'40c9251193eac838851b08f9785ae5c97ef14aab16a55bdb4d040ca2a04dc487',army:364,stone:80,alert:4300}:
  {source:'p324-soul-alert4300-first-win-save.json',sha:'5251692b7291ba86ca2295cfcdd32ba363e00d84cccc7dcbe229a20dd2e0fa99',army:312,stone:91,alert:4550};
const sourceFile='docs/codex/reports/data/'+expected.source;
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),expected.sha);
const origin=JSON.parse(raw);
const rosterFile='docs/codex/reports/data/p323-soul-stone-frontier-27battles-save.json';
const rosterRaw=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterRaw),'42fcfd5d8604752ec9cee1c60cfd0b575e7051a1eea2c41b6a26ea5adb451d31');
const old=JSON.parse(rosterRaw),groups=[...old.formation.front,...old.formation.mid];
const [E55,A55,E46,L55,S46,S55,S54,G40]=groups;
const front=[S55,S54,A55,E55],mid=groups.filter(u=>!front.includes(u));
const target={front,mid,back:old.formation.back},targetByType={};
for(const row of Object.values(target))for(const u of row)targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((n,v)=>n+v,0),626);
const e=environment({rts_save:raw}),r=e.run;
assert.equal(r('loadSaveAndApply().status'),'ok');
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  addLog=msg=>{S.log.push({time:new __RealDate(Date.now()).toLocaleTimeString(),msg:String(msg)});
    if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${step==='4300'?3244300:3244550};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__actualTraining={};const __originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=__originalPayTrainingCost(cost,n);for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key],expected=cost[key]*n;
      if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
      __actualTraining[key]=(__actualTraining[key]||0)+paid;}return result};`);
const snap=()=>r('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,medal:S.res.medal,core:S.items.godCore,food:S.res.food})');
const opening=snap();assert.equal(opening.army,expected.army);
assert.equal(opening.stone,expected.stone);assert.equal(opening.alert,expected.alert);
let onlineSeconds=0,minFood=opening.food;const allocationSeconds={},paidTraining={};
function val(k){return r(`S.res.${k}`)}
function cap(k){return r(`resCap('${k}')`)}
function assign(resource){
  for(const[key,count]of Object.entries(r('({...S.popAlloc})')))if(count>0)assert.equal(r(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(r("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(r("setPopAlloc('food',100)")?.ok,true);assert.equal(r(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(r('popAllocTotal()'),1002);
  assert.ok(r("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',resource='training'){
  const x=r(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
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
r("clrForm('expedition')");assert.equal(r('formSoldierCount()'),0);
const losses={};for(const[unit,wanted]of Object.entries(targetByType)){
  const available=r(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);losses[unit]=short;
  if(!short)continue;
  const cost=r(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const[resource,per]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
  }
  assign('tech');const queued=r(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' '+JSON.stringify(queued));
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,20000,'false','training').done,unit+' training timeout');
}
assert.equal(Object.values(losses).reduce((n,v)=>n+v,0),672-opening.army);
for(const[row,rowGroups]of Object.entries(target))rowGroups.forEach((u,slot)=>{
  assert.ok(r(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
  r(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(r(`S.formation.${row}[${slot}]?.type`),u.type);
  assert.equal(r(`S.formation.${row}[${slot}]?.count`),u.count);
});
const restored=snap();assert.equal(restored.army,672);assert.equal(restored.deployed,626);
assert.equal(restored.stone,expected.stone);assert.equal(restored.alert,expected.alert);
for(const[key,amount]of Object.entries(paidTraining))assert.ok(Math.abs(amount-(r(`__actualTraining.${key}`)||0))<1e-6,key+' actual training debit');
assert.equal(r('save().ok'),true);
const restoredText=e.store.get('rts_save'),restoreSaveFile=`docs/codex/reports/data/p324-soul-alert${step}-restored-save.json`;
const reload=environment({rts_save:restoredText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),626);assert.equal(reload.run('S.items.soulStone'),expected.stone);
fs.writeFileSync(path.join(root,restoreSaveFile),restoredText,'utf8');
function battle(seed,capture=false){
  const env=environment({rts_save:restoredText}),run=env.run;assert.equal(run('loadSaveAndApply().status'),'ok');
  const save=JSON.parse(restoredText);
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}+(S.tick-${save.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=run('({army:armyCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm})');
  run("openMaterialDomain('soulStone')");assert.equal(run('S.battleActive'),true);
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp})');
  run('exitBattle()');
  return{seed,result,before,after,callbacks,...(capture?{saveText:env.store.get('rts_save')}: {})};
}
const trials=Array.from({length:128},(_,i)=>battle(i+1)),wins=trials.filter(x=>x.result==='win');
let selectedWin=null;if(wins.length){
  const paid=battle(wins[0].seed,true);assert.equal(paid.result,'win');
  const saveFile=`docs/codex/reports/data/p324-soul-alert${step}-first-win-save.json`;
  const check=environment({rts_save:paid.saveText});assert.equal(check.run('loadSaveAndApply().status'),'ok');
  assert.equal(check.run('S.items.soulStone'),paid.after.stone);
  fs.writeFileSync(path.join(root,saveFile),paid.saveText,'utf8');
  selectedWin={seed:paid.seed,before:paid.before,after:paid.after,saveFile,saveSha256:sha(paid.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P324',sourceFile,sourceSha256:sha(raw),rosterFile,rosterSha256:sha(rosterRaw),
  kind:`real paid casualty restoration after selected prior win; isolated ${step} alert fixed-seed screen`,
  unit:'simulated online seconds, resource units, soldiers, battle HP',opening,losses,onlineSeconds,allocationSeconds,minFood,
  paidTraining,actualTraining:r('({...__actualTraining})'),restored,restoreSaveFile,restoreSaveSha256:sha(restoredText),
  trials,wins:wins.length,selectedWin,limitations:['128 independently reseeded trials are conditional, not continuous natural win rate.',
    'The selected 4050 win was a rare fixed-seed branch; further success must preserve battle losses.']};
const output=`docs/codex/reports/data/p324-soul-alert${step}-recovery.json`;
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,opening,losses,onlineSeconds,paidTraining,restored,
  restoreSaveFile,restoreSaveSha256:report.restoreSaveSha256,tested:trials.length,wins:wins.length,
  minEnemyHp:Math.min(...trials.map(x=>x.after.enemyHp)),selectedWin,output},null,2));
