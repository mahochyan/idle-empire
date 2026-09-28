'use strict';
// Restore actual medal-battle losses before testing the next paid equipment step.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p278-awakening-core-stage5-pretrial-2-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.awakening.star_trooper.level'),5);
assert.equal(run('formSoldierCount()'),580);
assert.equal(run('S.formation.front[1].type'),'armored_trooper');
assert.equal(run('S.formation.front[3].type'),'alloy_special');
const targets={armored_trooper:55-run('S.formation.front[1].count'),alloy_special:55-run('S.formation.front[3].count')};
assert.deepEqual(targets,{armored_trooper:3,alloy_special:4});
const cost={};
for(const [unit,count]of Object.entries(targets))for(const [k,v]of Object.entries(run(`CFG.units.${unit}.cost`)))cost[k]=(cost[k]||0)+v*count;
assert.deepEqual(cost,{copper:6000,iron:6000,steel:6400,food:6000});
const initial=run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),food:S.res.food,res:{...S.res},items:{...S.items}})');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
run("globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}");
let seconds=0,minFood=initial.food;
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=r.n;minFood=Math.min(minFood,r.min);
  assert.ok(r.min>0,'food depleted');assert.equal(r.done,true,'production or training timeout');
}
for(const resource of ['copper','steel']){
  if(run(`S.res.${resource}`)>=cost[resource])continue;
  assert.ok(cost[resource]<=run(`resCap('${resource}')`));
  assign(resource);advanceUntil(`S.res.${resource}>=${cost[resource]}`,2000);
}
run("globalThis.__paid={};globalThis.__basePay=payTrainingCost;payTrainingCost=(c,n)=>{for(const[k,v]of Object.entries(c))__paid[k]=(__paid[k]||0)+v*n;return __basePay(c,n)}");
for(const [unit,count]of Object.entries(targets)){
  const q=run(`train('${unit}',${count})`);
  assert.equal(q?.ok,true,unit+' queue');assert.equal(q.qty,count);
}
advanceUntil('(S.pool.armored_trooper||0)>=3&&(S.pool.alloy_special||0)>=4',100);
assert.deepEqual(JSON.parse(JSON.stringify(run('({...__paid})'))),cost);
run("fillFormMax('expedition','front',1)");
run("fillFormMax('expedition','front',3)");
assert.equal(run('S.formation.front[1].count'),55);
assert.equal(run('S.formation.front[3].count'),55);
assert.equal(run('armyCount()'),617);
assert.equal(run('formSoldierCount()'),587);
assert.equal(run("expeditionCount('star_trooper')"),101);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const file='docs/codex/reports/data/p278-awakening-stage5-medal-restored-save.json';
fs.writeFileSync(path.join(root,file),finalRaw,'utf8');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),587);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const report={batch:'P278',source,sourceSha256:sha(raw),unit:'simulated online seconds, resources, soldiers',initial,targets,cost,seconds,minFood,
  final:run('({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),food:S.res.food,res:{...S.res},items:{...S.items}})'),file,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p278-awakening-stage5-medal-restore.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,targets,cost,seconds,minFood,file,saveSha256:report.saveSha256},null,2));
