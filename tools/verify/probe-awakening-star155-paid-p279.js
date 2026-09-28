'use strict';
// Produce and train the 54 newly available star soldiers, then form a legal third regiment.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p279-awakening-armory50-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),star:expeditionCount('star_trooper'),starCap:unitCap('star_trooper'),food:S.res.food,res:{...S.res},formation:JSON.parse(JSON.stringify(S.formation))})");
assert.deepEqual([initial.army,initial.deployed,initial.star,initial.starCap],[617,587,101,155]);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
run("globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}");
const target=54,totalCost={copper:432000,iron:432000,steel:432000};
let elapsed=0,minFood=initial.food,phase='none';
const phases={stone:0,coal:0,iron:0,copper:0,steel:0,training:0};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  elapsed+=r.n;minFood=Math.min(minFood,r.min);phases[phase]=(phases[phase]||0)+r.n;
  assert.ok(r.min>0,'food depleted');return r;
}
function fillBasic(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),resource+' stock exceeds capacity');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${targetStock}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),resource+' stock exceeds capacity');
  let cycles=0;
  while(val(resource)<targetStock&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetStock}`,5000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetStock,resource+' fill exhausted');
}
for(const resource of ['steel','iron','copper'])fillProcessed(resource,totalCost[resource]);
const beforeTraining=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food})");
assign('stone');phase='training';
run("globalThis.__paid={};globalThis.__basePay=payTrainingCost;payTrainingCost=(c,n)=>{for(const[k,v]of Object.entries(c))__paid[k]=(__paid[k]||0)+v*n;return __basePay(c,n)}");
const queued=run(`train('star_trooper',${target})`);
assert.equal(queued?.ok,true,JSON.stringify(queued));assert.equal(queued.qty,target);
assert.ok(advanceUntil('(S.pool.star_trooper||0)>=54',1000).done,'training timed out');
const actualPaid=JSON.parse(JSON.stringify(run('({...__paid})')));
assert.deepEqual(actualPaid,totalCost);
const afterTraining=run("({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food,pool:S.pool.star_trooper})");
for(const [k,amount]of Object.entries(totalCost))assert.ok(Math.abs((beforeTraining[k]-afterTraining[k])-amount)<1e-5,k+' training payment');
const targetFormation=JSON.parse(JSON.stringify(initial.formation));
assert.equal(targetFormation.mid[2].type,'silver_heavy');assert.equal(targetFormation.mid[2].count,15);
targetFormation.mid[2]={type:'star_trooper',count:54};
run("clrForm('expedition')");
for(const row of ['front','mid','back'])targetFormation[row].forEach((unit,slot)=>{
  assert.ok(run(`poolAvail('${unit.type}')`)>=unit.count,`${row}${slot} pool`);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit.type}';S._formModalQty=${unit.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),unit.count);
});
assert.equal(run("expeditionCount('star_trooper')"),155);
assert.equal(run('formSoldierCount()'),626);
assert.equal(run('armyCount()'),671);
assert.equal(run('S.pool.silver_heavy'),15);
assert.equal(run('S.items.trialFruit'),130);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save');
const file='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("expeditionCount('star_trooper')"),155);
assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const report={batch:'P279',source,sourceSha256:sha(raw),unit:'simulated online seconds, resources and soldiers',initial,
  target,totalCost,phases,elapsedOnlineSec:elapsed,minFood,beforeTraining,queued,actualPaid,afterTraining,
  final:run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),star:expeditionCount('star_trooper'),starCap:unitCap('star_trooper'),fruit:S.items.trialFruit,res:{...S.res}})"),
  file,saveSha256:sha(output)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p279-awakening-star155-paid.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,target,totalCost,elapsedOnlineSec:elapsed,phases,minFood,
  final:report.final,file,saveSha256:report.saveSha256},null,2));
