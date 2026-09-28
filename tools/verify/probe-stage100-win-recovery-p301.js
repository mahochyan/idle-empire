'use strict';
// P301: after a paid late-army win against the candidate final boss, rebuild its exact formation by real production and training.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,input),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=JSON.parse(raw),target=source.formation;
const targetByType={};
for(const groups of Object.values(target))for(const unit of groups)targetByType[unit.type]=(targetByType[unit.type]||0)+unit.count;
const e=environment({rts_save:raw}),run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
assert.equal(run('S.defeated.includes(100)'),false);
assert.equal(run('formSoldierCount()'),626);
const initial=run('({tick:S.tick,res:{...S.res},pop:popCurrent(),army:armyCount(),deployed:formSoldierCount()})');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
    static now(){return ${source.ts}+(S.tick-${initial.tick})*1000}};
  globalThis.__rng=6;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  const boss=CFG.enemies.find(x=>x.id===100);
  boss.units=Object.fromEntries(Object.entries(boss.units).map(([type,counts])=>[type,counts.map(()=>160)]));`);
run('selEnemy(99);openBattle()');
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
assert.equal(run('S.defeated.includes(100)'),true);
const postBattle=run('({tick:S.tick,res:{...S.res},pop:popCurrent(),army:armyCount(),deployed:formSoldierCount(),pool:{...S.pool}})');
assert.equal(initial.deployed-postBattle.deployed,283);
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.includes(100)'),true);
let seconds=0,minFood=postBattle.res.food,phase='none';
const phases={food:0,stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
function val(key){return run(`S.res.${key}`)}
function cap(key){return run(`resCap('${key}')`)}
function assign(resource){
  for(const [key,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;minFood=Math.min(minFood,result.min);phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),`${resource} ${targetStock} exceeds ${cap(resource)}`);
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetStock}`,10000).done,resource+' timeout');
}
function fillProcessed(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),`${resource} ${targetStock} exceeds ${cap(resource)}`);
  let cycles=0;
  while(val(resource)<targetStock&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetStock}`,5000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetStock,resource+' exhausted');
}
function fill(resource,targetStock){if(val(resource)>=targetStock)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,targetStock);
  else fillBasic(resource,targetStock)}
run('clrForm(\'expedition\')');assert.equal(run('formSoldierCount()'),0);
run(`globalThis.__paid={};globalThis.__payTrainingCost=payTrainingCost;
  payTrainingCost=(cost,n)=>{for(const [key,v] of Object.entries(cost))__paid[key]=(__paid[key]||0)+v*n;
    return __payTrainingCost(cost,n)}`);
const losses={};
for(const [unit,wanted] of Object.entries(targetByType)){
  losses[unit]=Math.max(0,wanted-run(`poolAvail('${unit}')`));
  const cost=run(`({...CFG.units.${unit}.cost})`);
  while(run(`poolAvail('${unit}')`)<wanted){
    let batch=Math.min(wanted-run(`poolAvail('${unit}')`),run(`maxTrainable('${unit}')`));
    for(const [resource,perUnit]of Object.entries(cost))if(perUnit>0)batch=Math.min(batch,Math.floor(cap(resource)/perUnit));
    assert.ok(batch>0,unit+' cannot fit a training batch');
    const order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9)))
      fill(resource,perUnit*batch);
    const before=run(`poolAvail('${unit}')`);
    const queued=run(`train('${unit}',${batch})`);
    assert.equal(queued?.ok,true,`${unit} queue ${JSON.stringify(queued)}`);
    assert.equal(queued.qty,batch);
    phase='training';assert.ok(advanceUntil(`poolAvail('${unit}')>=${before+batch}`,10000).done,unit+' train timeout');
  }
}
run('payTrainingCost=__payTrainingCost');
for(const [row,groups] of Object.entries(target))groups.forEach((unit,slot)=>{
  assert.ok(run(`poolAvail('${unit.type}')`)>=unit.count,`${row}${slot} stock`);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit.type}';S._formModalQty=${unit.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),unit.count,`${row}${slot} formation`);
});
assert.equal(run('formSoldierCount()'),626);
assert.equal(run('S.defeated.includes(100)'),true);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.defeated.includes(100)'),true);
assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(sha(fs.readFileSync(path.join(root,input),'utf8')),sha(raw));
const final=run('({tick:S.tick,res:{...S.res},pop:popCurrent(),army:armyCount(),deployed:formSoldierCount(),paid:{...__paid}})');
const report={batch:'P301',kind:'paid late army, conditional 160-per-group final boss, real victory and full production/training recovery',
  input,inputSha256:sha(raw),seed:6,scale:160,initial,postBattle,callbacks,
  losses,seconds,minFood,phases,final,saveSha256:sha(finalRaw)};
const reportFile='docs/codex/reports/data/p301-stage100-win-recovery.json';
const saveFile='docs/codex/reports/data/p301-stage100-win-recovered-save.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,saveFile),finalRaw);
console.log(JSON.stringify({batch:report.batch,seed:6,scale:160,losses,paid:final.paid,seconds,minFood,phases,
  postBattle:{deployed:postBattle.deployed,army:postBattle.army},final:{deployed:final.deployed,army:final.army},
  reportFile,saveFile,saveSha256:report.saveSha256},null,2));
