'use strict';
// P358: real formation, battle, paid queue and third four-hour offline window.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const codeHashes={config:sha(fs.readFileSync(path.join(root,'config.js'))),math:sha(fs.readFileSync(path.join(root,'math.js')))};
assert.equal(codeHashes.config,'8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675');
assert.equal(codeHashes.math,'dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95');
const sourceFile=data+'p354-wood-5-coal-235-full-queue-4h-save.json';
const sourceText=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sourceSha256=sha(sourceText);
assert.equal(sourceSha256,'8727dcc7934d728ca9c5f876c0b6fb8a3d0133bc31f34649564c6cdf258359cf');
const source=JSON.parse(sourceText);
assert.equal(source.v,32);
const p354=JSON.parse(fs.readFileSync(path.join(root,data+'p354-wild-coal-balance.json'),'utf8'));
assert.equal(p354.selected.saveSha256,sourceSha256);
const rosterFile=data+'p329-soul-refreshed-save.json';
const rosterText=fs.readFileSync(path.join(root,rosterFile),'utf8');
assert.equal(sha(rosterText),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const target=JSON.parse(rosterText).formation,targetByType={};
for(const row of Object.values(target))for(const item of row)targetByType[item.type]=(targetByType[item.type]||0)+item.count;
assert.equal(Object.values(targetByType).reduce((n,v)=>n+v,0),626);
const p352=JSON.parse(fs.readFileSync(path.join(root,data+'p352-birth-deed-five-policy-optimal-base-workers-two-window.json'),'utf8'));
const battleSeed=p352.secondWindow.after.rng;
assert.ok(Number.isSafeInteger(battleSeed)&&battleSeed>0);
const env=environment({rts_save:sourceText}),run=env.run;
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
  globalThis.Date=class extends __RealDate {static now(){return __clockMs}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__phase='setup';globalThis.__rngDraws={setup:0,combat:0,offline:0};
  globalThis.__rng=${battleSeed};Math.random=()=>{__rngDraws[__phase]++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__trainingPaid={};const originalPayTrainingCost=payTrainingCost;
  payTrainingCost=function(cost,n){const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    const result=originalPayTrainingCost(cost,n);
    for(const key of trainingCostKeys(cost)){
      const paid=before[key]-S.res[key];
      if(Math.abs(paid-cost[key]*n)>1e-6)throw Error('training debit mismatch '+key);
      __trainingPaid[key]=(__trainingPaid[key]||0)+paid;
    }return result;
  };
`);
assert.equal(run('loadSaveAndApply().status'),'ok');
const stock=()=>run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','bone','medal','deed','hide'].map(k=>[k,S.res[k]]))");
const queue=()=>run('Object.fromEntries(Object.entries(S.queue).filter(([,q])=>q?.count>0).map(([key,q])=>[key,{count:q.count,timer:q.timer,reason:q.reason||""}]))');
const queueCount=()=>Object.values(queue()).reduce((n,q)=>n+q.count,0);
const state=()=>run('({timeMs:Date.now(),tick:S.tick,army:armyCount(),deployed:formSoldierCount(),queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),alert:S.killValues.wildWyrm,bone:S.res.bone,hide:S.res.hide,deed:S.res.deed,population:popCurrent(),capacity:maxPop(),rng:__rng})');
const allocation=run('({...S.popAlloc})');
assert.equal(run('popAllocTotal()'),1122);
assert.equal(run('popCurrent()'),1122);
assert.equal(queueCount(),0);
const beginning=state(),beginningStock=stock();
assert.equal(beginning.army,672);
assert.equal(beginning.deployed,0);
assert.equal(beginning.alert,3930);
for(const [row,groups] of Object.entries(target))groups.forEach((item,slot)=>{
  assert.ok(run('poolAvail('+JSON.stringify(item.type)+')')>=item.count,row+slot+' available');
  run('openFormModal('+JSON.stringify('expedition')+','+JSON.stringify(row)+','+slot+');'+
    'S._formModalSel='+JSON.stringify(item.type)+';S._formModalQty='+item.count+';confirmForm()');
  assert.equal(run('S.formation.'+row+'['+slot+']?.type'),item.type);
  assert.equal(run('S.formation.'+row+'['+slot+']?.count'),item.count);
});
const formed=state();
assert.equal(formed.army,beginning.army);
assert.equal(formed.deployed,626);
assert.equal(run('save().ok'),true);
const formedSave=env.store.get('rts_save');
const formedReload=environment({rts_save:formedSave});
assert.equal(formedReload.run('loadSaveAndApply().status'),'ok');
assert.equal(formedReload.run('formSoldierCount()'),626);
run("__phase='combat';openMaterialDomain('wyrmSinew')");
assert.equal(run('S.battleActive'),true);
const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
let callbacks=0;
while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
assert.ok(callbacks<3000);
const battleResult=run("document.getElementById('battle-result').className");
assert.ok(['win','lose'].includes(battleResult));
const battleAfter=state(),battleStock=stock(),enemyHpAfter=run('B.enemyUnits[0].hp');
assert.equal(battleAfter.army,formed.army-(formed.deployed-battleAfter.deployed));
if(battleResult==='win'){
  assert.ok(battleAfter.bone>formed.bone);
  assert.ok(battleAfter.hide>formed.hide);
  assert.equal(battleAfter.alert,formed.alert+10);
}else{
  assert.equal(battleAfter.alert,formed.alert);
  assert.equal(battleAfter.bone,formed.bone);
  assert.equal(battleAfter.hide,formed.hide);
}
run("exitBattle();__phase='setup'");
const battleSave=env.store.get('rts_save');
const battleReload=environment({rts_save:battleSave});
assert.equal(battleReload.run('loadSaveAndApply().status'),'ok');
assert.equal(battleReload.run('armyCount()'),battleAfter.army);
assert.equal(battleReload.run('S.killValues.wildWyrm'),battleAfter.alert);
assert.equal(battleReload.run('S.res.bone'),battleAfter.bone);
run("clrForm('expedition')");
assert.equal(run('formSoldierCount()'),0);
const queueStartStock=stock(),requested={},trainingNeed={};
for(const [key,wanted] of Object.entries(targetByType)){
  const missing=Math.max(0,wanted-run('poolAvail('+JSON.stringify(key)+')'));
  if(!missing)continue;
  const action=run('train('+JSON.stringify(key)+','+missing+')');
  assert.equal(action?.ok,true,key+' train');
  assert.equal(action.qty,missing,key+' full requested queue');
  requested[key]=missing;
  const cost=run('({...CFG.units['+JSON.stringify(key)+'].cost})');
  for(const [resource,amount] of Object.entries(cost))trainingNeed[resource]=(trainingNeed[resource]||0)+amount*missing;
}
const queued=state(),queuedUnits=queueCount();
assert.equal(queued.queue,queuedUnits);
assert.equal(queuedUnits,Object.values(requested).reduce((n,v)=>n+v,0));
assert.equal(queued.army,battleAfter.army);
assert.deepEqual(stock(),queueStartStock,'queue placement itself is unpaid');
assert.deepEqual(run('({...S.popAlloc})'),allocation,'same worker allocation');
assert.equal(run('save().ok'),true);
const logout=state(),logoutStock=stock(),logoutSave=env.store.get('rts_save');
const logoutReload=environment({rts_save:logoutSave});
assert.equal(logoutReload.run('loadSaveAndApply().status'),'ok');
assert.equal(logoutReload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),queuedUnits);
assert.equal(JSON.parse(logoutSave).ts,logout.timeMs);
const startTick=logout.tick;
run("__clockMs+=14400000;__phase='offline'");
assert.equal(run('loadSaveAndApply().status'),'ok');
const settlement=run('settleOffline()');
assert.equal(settlement?.ok,true);
assert.ok(settlement.durationSec>0&&settlement.durationSec<=14400);
const arrival=state(),arrivalStock=stock(),remaining=queue();
const produced=queuedUnits-arrival.queue;
assert.equal(arrival.tick-startTick,settlement.durationSec);
assert.equal(arrival.army-logout.army,produced);
assert.equal(run('S.offline.pendingReport.advance.produced'),produced);
assert.equal(arrival.alert,battleAfter.alert);
assert.ok(Object.values(arrivalStock).every(v=>Number.isFinite(v)&&v>=0));
const caps=run("Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','bone','medal','deed','hide'].map(k=>[k,resCap(k)]))");
const paid=run('({...__trainingPaid})');
const settledSave=env.store.get('rts_save');
const settledReload=environment({rts_save:settledSave});
assert.equal(settledReload.run('loadSaveAndApply().status'),'ok');
assert.equal(settledReload.run('armyCount()'),arrival.army);
assert.equal(settledReload.run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),arrival.queue);
assert.equal(settledReload.run('S.killValues.wildWyrm'),arrival.alert);
assert.equal(settledReload.run('S.res.food'),arrivalStock.food);
const report={batch:'P358',date:'2026-09-29',unit:'seconds, resources, soldiers',
  codeHashes,sourceFile,sourceSha256,rosterFile,rosterSha256:sha(rosterText),battleSeed,
  beginning,beginningStock,allocation,formed,formedSaveSha256:sha(formedSave),
  battle:{result:battleResult,enemy,enemyHpAfter,callbacks,after:battleAfter,stock:battleStock,saveSha256:sha(battleSave)},
  requested,trainingNeed,queued,queueStartStock,logout,logoutStock,logoutSaveSha256:sha(logoutSave),
  settlement,arrival,arrivalStock,remaining,produced,paid,caps,settledSaveSha256:sha(settledSave),
  limits:['One P354 paid late-game save, one deterministic wild battle, one four-hour offline window.',
    'P354 source save does not persist the test RNG; the third battle uses the separately stated deterministic seed.',
    'This measures one continuation, not an indefinite material loop or fresh-save reachability.',
    'VM localStorage, DOM and timers are not browser or Android validation.']};
const reportFile=data+'p358-wild-third-window.json',saveFile=data+'p358-wild-third-window-save.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,saveFile),settledSave,'utf8');
console.log(JSON.stringify({reportFile,saveFile,battleSeed,battleResult,casualties:formed.deployed-battleAfter.deployed,
  queued:queuedUnits,produced,remaining:arrival.queue,alertBefore:formed.alert,alertAfter:arrival.alert,
  durationSec:settlement.durationSec,truncated:settlement.truncated,stock:arrivalStock,caps,paid,settledSaveSha256:sha(settledSave)},null,2));
