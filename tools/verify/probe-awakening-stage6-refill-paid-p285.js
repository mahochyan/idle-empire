'use strict';
// Replenish the actual paid level-6 win save through production, training, and formation actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p284-awakening-101star-nano10-paid-seed8-terminal-terminal-save.json';
const reference='p284-awakening-stage5-nano10-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const referenceRaw=fs.readFileSync(path.join(data,reference),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),star:expeditionCount('star_trooper'),level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars,fruit:S.items.trialFruit,core:S.items.godCore,alert:S.killValues.godSlaughter,res:{...S.res}})");
assert.equal(initial.army,517);assert.equal(initial.deployed,472);
assert.equal(initial.star,155);assert.equal(initial.level,6);assert.equal(initial.stars,7);assert.equal(initial.fruit,25);
const target=JSON.parse(referenceRaw).formation;
const targetByType={};
for(const groups of Object.values(target))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}};
  globalThis.__rng=285;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
let seconds=0,minFood=initial.res.food,phase='none';
const phases={food:0,stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=r.n;minFood=Math.min(minFood,r.min);phases[phase]+=r.n;
  assert.ok(r.min>0,'food depleted');return r;
}
function fillBasic(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),`${resource} target ${target} > capacity ${cap(resource)}`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${target}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),`${resource} target ${target} > capacity ${cap(resource)}`);
  let cycles=0;
  while(val(resource)<target&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${target}`,5000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=target,resource+' fill exhausted');
}
function fill(resource,target){if(val(resource)>=target)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,target);
  else fillBasic(resource,target);}
run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
const losses={},paidTraining={};
for(const [unit,wanted]of Object.entries(targetByType)){
  const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
  losses[unit]=short;if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`);
  const order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    const amount=perUnit*short;fill(resource,amount);
    paidTraining[resource]=(paidTraining[resource]||0)+amount;}
  const queued=run(`train('${unit}',${short})`);
  assert.equal(queued?.ok,true,`${unit} queue: ${JSON.stringify(queued)}`);
  assert.equal(queued.qty,short);
  phase='training';assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,1000).done,unit+' train timed out');
}
for(const [row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,`${row}${slot} ${u.type} pool`);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,`${row}${slot} formation`);
});
assert.equal(run('armyCount()'),671);assert.equal(run('formSoldierCount()'),626);
assert.equal(run("expeditionCount('star_trooper')"),155);
assert.equal(run('S.awakening.star_trooper.level'),6);
assert.equal(run('S.awakening.star_trooper.stars'),7);
assert.equal(run('S.items.trialFruit'),25);
assert.equal(run('S.items.godCore'),47);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save'),file='p285-awakening-stage6-full-roster-paid-save.json';
fs.writeFileSync(path.join(data,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(reload.run('S.awakening.star_trooper.level'),6);
assert.equal(reload.run('S.awakening.star_trooper.stars'),7);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
assert.equal(sha(fs.readFileSync(path.join(data,reference),'utf8')),sha(referenceRaw));
const final=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),star:expeditionCount('star_trooper'),level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars,fruit:S.items.trialFruit,core:S.items.godCore,alert:S.killValues.godSlaughter,res:{...S.res}})");
const report={batch:'P285',kind:'real production, paid training and formation restoration from paid level-6 terminal',
  source,sourceSha256:sha(raw),reference,referenceSha256:sha(referenceRaw),initial,losses,paidTraining,
  unit:'simulated online seconds, resources, soldiers',seconds,minFood,phases,final,file,saveSha256:sha(output)};
const reportFile='p285-awakening-stage6-full-roster-paid.json';
fs.writeFileSync(path.join(data,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,losses,paidTraining,seconds,minFood,phases,
  final:{army:final.army,deployed:final.deployed,star:final.star,level:final.level,fruit:final.fruit,core:final.core},file,saveSha256:report.saveSha256},null,2));
