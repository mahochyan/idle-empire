'use strict';
// From one paid save, play the seed-3 blood-supply failure, rebuild the original roster with real production/training,
// then spend its existing cleanser and retry the same material dungeon. No soldiers or resources are injected.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p295-aegis-elixir-paid-save.json',raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'5909b1e9fcab59140edb76bde9ce21736d387f4f0b73b384bf0076210d5b80d1');
const sourceData=JSON.parse(raw),target=sourceData.formation;
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const originalWorkers=JSON.parse(run('JSON.stringify(S.popAlloc)'));
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${sourceData.ts}+(S.tick-${sourceData.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=3;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const battle=()=>{
  const before={blood:run('S.items.sacredBlood'),alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()')};
  run("openMaterialDomain('phantomFlower')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const result=run("document.getElementById('battle-result').className");
  const after={blood:run('S.items.sacredBlood'),alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()')};
  run('exitBattle()');
  return{result,before,after,callbacks};
};
const history=[];
for(let i=0;i<16;i++)history.push(battle());
assert.equal(history.filter(x=>x.result==='win').length,15);
assert.equal(history.at(-1).result,'lose');
assert.equal(run('S.items.sacredBlood'),18);
assert.equal(run('formSoldierCount()'),0);
const failed={battle:history.at(-1),blood:run('S.items.sacredBlood'),cleanser:run('S.items.domainCleanser'),
  tick:run('S.tick'),resources:JSON.parse(run('JSON.stringify(S.res)'))};
const targetByType={};
for(const groups of Object.values(target))for(const group of groups)targetByType[group.type]=(targetByType[group.type]||0)+group.count;
run("clrForm('expedition')");
assert.equal(run('formSoldierCount()'),0);
let seconds=0,minFood=run('S.res.food'),phase='none';
const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
const value=key=>run(`S.res.${key}`),cap=key=>run(`resCap('${key}')`);
function assign(resource){
  for(const [key,count] of Object.entries(JSON.parse(run('JSON.stringify(S.popAlloc)'))))
    if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key+' clear');
  assert.equal(run("setPopAlloc('food',100)")?.ok,true,'food allocation');
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true,resource+' allocation');
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;minFood=Math.min(minFood,result.min);phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');
  return result;
}
function fillBasic(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),`${resource} target ${needed} > cap ${cap(resource)}`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${needed}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),`${resource} target ${needed} > cap ${cap(resource)}`);
  let cycles=0;
  while(value(resource)<needed&&cycles++<100){
    if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&value('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=value(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${needed}`,5000,stop);
    assert.ok(value(resource)>before,resource+' stalled');
  }
  assert.ok(value(resource)>=needed,resource+' fill exhausted');
}
function fill(resource,needed){
  if(value(resource)>=needed)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,needed);
  else fillBasic(resource,needed);
}
const costOrder={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
const paidTraining={};
for(const [unit,wanted] of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  if(!short)continue;
  const cost=JSON.parse(run(`JSON.stringify(CFG.units.${unit}.cost)`));
  for(const [resource,perUnit] of Object.entries(cost).sort((a,b)=>(costOrder[a[0]]??9)-(costOrder[b[0]]??9))){
    const amount=perUnit*short;
    fill(resource,amount);
    paidTraining[resource]=(paidTraining[resource]||0)+amount;
  }
  const queued=run(`train('${unit}',${short})`);
  assert.equal(queued?.ok,true,unit+' queue '+JSON.stringify(queued));
  phase='training';
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,1000).done,unit+' training timed out');
}
for(const [row,groups] of Object.entries(target))groups.forEach((group,slot)=>{
  assert.ok(run(`poolAvail('${group.type}')`)>=group.count,row+slot+' reserve');
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${group.type}';S._formModalQty=${group.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),group.count,row+slot+' formation');
});
assert.equal(run('formSoldierCount()'),353);
for(const [key,count] of Object.entries(JSON.parse(run('JSON.stringify(S.popAlloc)'))))
  if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key+' restore clear');
for(const [key,count] of Object.entries(originalWorkers))
  if(count>0)assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,key+' restore');
assert.deepEqual(JSON.parse(run('JSON.stringify(S.popAlloc)')),originalWorkers);
const rebuilt={seconds,phases,minFood,paidTraining,soldiers:run('formSoldierCount()'),
  blood:run('S.items.sacredBlood'),alert:run('S.killValues.godPhantom'),cleanser:run('S.items.domainCleanser'),
  tick:run('S.tick'),resources:JSON.parse(run('JSON.stringify(S.res)'))};
const rebuiltRaw=e.store.get('rts_save'),rebuiltTs=JSON.parse(rebuiltRaw).ts,rngAtRetry=run('__rng');
const alt=environment({rts_save:rebuiltRaw}),altRun=alt.run;
assert.equal(altRun('loadSaveAndApply().status'),'ok');
altRun(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${rebuiltTs}}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=${rngAtRetry};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const alternateUse=altRun("useDomainCleanser('phantomFlower')");
assert.equal(alternateUse.ok,true);
assert.equal(altRun('S.killValues.godPhantom'),2000);
altRun("openMaterialDomain('phantomFlower')");
assert.equal(altRun('S.battleActive'),true);
let altCallbacks=0;
while(altRun('S.battleActive')&&altCallbacks<4000){assert.equal(altRun('__step()'),true);altCallbacks++}
assert.equal(altRun('S.battleActive'),false);
const withCleanserRetry={result:altRun("document.getElementById('battle-result').className"),
  blood:altRun('S.items.sacredBlood'),soldiers:altRun('formSoldierCount()'),alert:altRun('S.killValues.godPhantom'),
  cleanser:altRun('S.items.domainCleanser'),callbacks:altCallbacks,spent:alternateUse.spent};
assert.equal(run('S.killValues.godPhantom'),2100);
assert.equal(run('S.items.domainCleanser'),1);
const retry=battle();
assert.equal(retry.result,'win');
assert.equal(run('S.items.sacredBlood'),20);
assert.equal(run('S.items.domainCleanser'),1);
const postRetry={result:retry.result,blood:run('S.items.sacredBlood'),soldiers:run('formSoldierCount()'),
  alert:run('S.killValues.godPhantom'),cleanser:run('S.items.domainCleanser'),tick:run('S.tick'),
  resources:JSON.parse(run('JSON.stringify(S.res)'))};
const retrySave=e.store.get('rts_save'),retryReload=environment({rts_save:retrySave});
assert.equal(retryReload.run('loadSaveAndApply().status'),'ok');
assert.equal(retryReload.run('S.items.sacredBlood'),20);
run(`globalThis.__marketSeed=291;Math.random=()=>{let x=__marketSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__marketSeed=x>>>0;return __marketSeed/4294967296}`);
let marketSec=0,marketSteps=0;
while(run('S.marketSpecial.offers.emberElixir')<1&&marketSteps<5000){
  const advance=run('offlineAdvanceSec(60,1)');
  assert.equal(advance.elapsed,60,'market minute completed');
  marketSec+=60;marketSteps++;
}
assert.ok(run('S.marketSpecial.offers.emberElixir')>=1,'ember offered');
const preBuy={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  offers:run('S.marketSpecial.offers.emberElixir'),cycles:run('S.marketSpecial.cycles')};
const bought=run("buyMarketSpecial('emberElixir')");
assert.equal(bought.ok,true,JSON.stringify(bought));
assert.equal(run('S.items.sacredBlood'),preBuy.blood-20);
assert.equal(run('S.items.emberElixir'),preBuy.ember+1);
const terminal={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),cleanser:run('S.items.domainCleanser'),
  tick:run('S.tick'),resources:JSON.parse(run('JSON.stringify(S.res)'))};
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.items.sacredBlood'),terminal.blood);
assert.equal(reload.run('S.items.emberElixir'),terminal.ember);
const savePath='p297-phantom-blood-recovery-save.json',reportPath='p297-phantom-blood-recovery-report.json';
const report={batch:'P297',source,sourceSha256:sha(raw),battleRng:{kind:'continuous xorshift32',seed:3},
  marketRng:{kind:'xorshift32',seed:291},initialSoldiers:353,history,failed,targetByType,rebuilt,
  rngAtRetry,withCleanserRetry,retry,postRetry,postRetrySavePath:'p297-phantom-blood-retry-save.json',postRetrySaveSha256:sha(retrySave),
  market:{elapsedSec:marketSec,steps:marketSteps,ratio:1,preBuy,bought},terminal,savePath,saveSha256:sha(output)};
fs.writeFileSync(path.join(data,report.postRetrySavePath),retrySave,'utf8');
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({batch:report.batch,failed,rebuilt:{seconds,phases,minFood,paidTraining,soldiers:rebuilt.soldiers,
  blood:rebuilt.blood,alert:rebuilt.alert,cleanser:rebuilt.cleanser},withCleanserRetry,retry,postRetry,market:report.market,
  terminal,postRetrySaveSha256:report.postRetrySaveSha256,saveSha256:report.saveSha256},null,2));
