'use strict';
// Pay for electric armory Lv32→50 from the stage-5, energy-armor-4 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p278-awakening-energy4-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.awakening.star_trooper.level'),5);
assert.equal(run("bldSt('electric_armory').lv"),32);
assert.equal(run("unitCap('star_trooper')"),101);
assert.equal(run('armyCount()'),617);
const initial=run("({tick:S.tick,lv:bldSt('electric_armory').lv,cap:unitCap('star_trooper'),res:{...S.res},food:S.res.food,pop:popCurrent()})");
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
run("globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}");
let seconds=0,minFood=initial.food,phase='none';
const phases={wood:0,stone:0,food:0,building:0},paid={wood:0,stone:0,food:0},rows=[];
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food'){
    assert.equal(run("setPopAlloc('food',999)")?.ok,true);
    assert.equal(run("setPopAlloc('wood',3)")?.ok,true);
  }
  else{
    assert.equal(run("setPopAlloc('food',90)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  }
  assert.equal(run('popAllocTotal()'),1002);
  phase=resource;
}
function waitUntil(expression,max){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=r.n;phases[phase]=(phases[phase]||0)+r.n;
  minFood=Math.min(minFood,r.min);
  assert.ok(r.min>0,'food depleted');assert.equal(r.done,true,'timed out: '+expression);
}
function fill(resource,target){
  if(run(`S.res.${resource}`)>=target)return;
  assert.ok(target<=run(`resCap('${resource}')`),resource+' single cost exceeds capacity');
  assign(resource);waitUntil(`S.res.${resource}>=${target}`,30000);
}
while(run("bldSt('electric_armory').lv")<50){
  const level=run("bldSt('electric_armory').lv");
  const cost=run("upCost('electric_armory')");
  assert.equal(run("upgradeLockReason('electric_armory')"),'');
  for(const k of ['wood','stone','food'])assert.ok(cost[k]<=run(`resCap('${k}')`),`Lv${level+1} ${k} cap`);
  fill('wood',cost.wood);
  fill('stone',cost.stone);
  fill('food',Math.min(run("resCap('food')"),cost.food+60000));
  const before=run('({...S.res})');
  const result=run("buildAct('electric_armory')");
  assert.equal(result?.ok,true,`Lv${level+1}: ${JSON.stringify(result)}`);
  const afterPay=run('({...S.res})');
  for(const k of ['wood','stone','food']){
    assert.ok(Math.abs((before[k]-afterPay[k])-cost[k])<1e-5,`Lv${level+1} ${k} payment`);
    paid[k]+=cost[k];
  }
  minFood=Math.min(minFood,afterPay.food);
  phase='building';
  waitUntil(`bldSt('electric_armory').lv===${level+1}&&bldSt('electric_armory').state==='idle'`,200);
  assert.equal(run("unitCap('star_trooper')"),5+3*(level+1));
  rows.push({from:level,to:level+1,cost,secondsAfter:seconds,foodAfter:run('S.res.food'),starCap:run("unitCap('star_trooper')")});
}
assert.equal(run("bldSt('electric_armory').lv"),50);
assert.equal(run("unitCap('star_trooper')"),155);
assert.equal(run('armyCount()'),617);
assert.equal(run('formSoldierCount()'),587);
assert.equal(run('S.items.trialFruit'),130);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save');
const file='docs/codex/reports/data/p279-awakening-armory50-paid-save.json';
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("bldSt('electric_armory').lv"),50);
assert.equal(reload.run("unitCap('star_trooper')"),155);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const report={batch:'P279',source,sourceSha256:sha(raw),unit:'simulated online seconds and resources',initial,
  rows,paid,seconds,phases,minFood,final:run("({tick:S.tick,lv:bldSt('electric_armory').lv,cap:unitCap('star_trooper'),res:{...S.res},food:S.res.food,pop:popCurrent(),army:armyCount()})"),
  file,saveSha256:sha(output)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p279-awakening-armory50-paid.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,levels:rows.length,paid,seconds,phases,minFood,final:report.final,file,saveSha256:report.saveSha256},null,2));
