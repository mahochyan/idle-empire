'use strict';
// Restore the exact P386 roster from the P390 paid star-beast win via real economy actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p390-star-array-entry-paid-save.json',reference='p386-300m-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const referenceRaw=fs.readFileSync(path.join(data,reference),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'aa54851f4e4a12848f56cb4b98ccd0eb52e2c62a4fdc066325f037a0ba37c25a');
assert.equal(sha(referenceRaw),'7f27ca4a53ba412e187ec72aeaaf6349f1bba00185ae422ac959dac8e557f5cf');
const NativeDate=Date,sourceNow=JSON.parse(raw).ts;
global.Date=class ProbeDate extends NativeDate {
  constructor(...args){super(...(args.length?args:[sourceNow]));}
  static now(){return sourceNow;}
};
const e=environment({rts_save:raw}),run=e.run;
const loadStatus=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loadStatus),loadStatus);
if(loadStatus==='migrated')assert.equal(e.store.get('rts_save_premigration'),raw);
const initial=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),res:{...S.res},
  fruit:S.items.trialFruit,core:S.items.godCore,beastAlert:S.killValues.starBeast,
  awakening:{...S.awakening.star_trooper},starItems:{origin:S.items.starOriginStone,
    illusion:S.items.illusionStone,ring:S.items.sacredRingCore}})`);
const target=JSON.parse(referenceRaw).formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)
  targetByType[u.type]=(targetByType[u.type]||0)+u.count;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
  static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}};
  globalThis.__rng=391;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __rng=x>>>0;return __rng/4294967296}`);

let seconds=0,minFood=initial.res.food,phase='none';
const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap('${k}')`);
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const out=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=out.n;minFood=Math.min(minFood,out.min);phases[phase]+=out.n;
  assert.ok(out.min>0,'food depleted');return out;
}
function fillBasic(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} cost exceeds cap`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,10000).done,resource+' fill timeout');
}
function fillProcessed(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource),`${resource} cost exceeds cap`);
  let cycles=0;
  while(val(resource)<amount&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)
      fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${amount}`,5000,stop);
    assert.ok(val(resource)>before,resource+' production stalled');
  }
  assert.ok(val(resource)>=amount,resource+' fill exhausted');
}
function fill(resource,amount){
  if(val(resource)>=amount)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,amount);
  else fillBasic(resource,amount);
}

run("clrForm('expedition')");
assert.equal(run('formSoldierCount()'),0);
const losses={},paidTraining={};
const order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
for(const [unit,wanted]of Object.entries(targetByType)){
  const short=Math.max(0,wanted-run(`poolAvail('${unit}')`));
  losses[unit]=short;
  if(!short)continue;
  const cost=run(`({...CFG.units.${unit}.cost})`);
  for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
    const amount=perUnit*short;fill(resource,amount);
    paidTraining[resource]=(paidTraining[resource]||0)+amount;
  }
  const queued=run(`train('${unit}',${short})`);
  assert.equal(queued?.ok,true,`${unit}: ${JSON.stringify(queued)}`);
  phase='training';
  assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,1000).done,unit+' train timeout');
}
for(const [row,groups]of Object.entries(target))groups.forEach((u,slot)=>{
  assert.ok(run(`poolAvail('${u.type}')`)>=u.count,`${row}${slot} pool`);
  run(`openFormModal('expedition','${row}',${slot});
    S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
});
assert.equal(run('armyCount()'),672);
assert.equal(run('formSoldierCount()'),626);
assert.equal(run('S.awakening.star_trooper.level'),6);
assert.equal(run('S.awakening.star_trooper.stars'),7);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const finalFile='p391-beast-replenished-paid-save.json';
fs.writeFileSync(path.join(data,finalFile),finalRaw);
const restored=environment({rts_save:finalRaw});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('formSoldierCount()'),626);
assert.equal(restored.run('armyCount()'),672);
const final=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),res:{...S.res},
  fruit:S.items.trialFruit,core:S.items.godCore,beastAlert:S.killValues.starBeast,
  awakening:{...S.awakening.star_trooper},starItems:{origin:S.items.starOriginStone,
    illusion:S.items.illusionStone,ring:S.items.sacredRingCore}})`);
assert.deepEqual(final.starItems,initial.starItems);
assert.equal(final.res.medal,initial.res.medal);
const ledger={batch:'P391',source,sourceSha256:sha(raw),reference,referenceSha256:sha(referenceRaw),
  runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  initial,losses,paidTraining,seconds,minFood,phases,final,
  finalSave:{file:finalFile,sha256:sha(finalRaw)},
  scope:'Real setPopAlloc/tick/train/openFormModal/confirmForm/save/load; no inventory or game config injection.'};
const ledgerFile='p391-beast-replenished-paid-ledger.json';
fs.writeFileSync(path.join(data,ledgerFile),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({losses,paidTraining,seconds,minFood,phases,
  initial:{army:initial.army,deployed:initial.deployed,food:initial.res.food,medal:initial.res.medal,starItems:initial.starItems},
  final:{army:final.army,deployed:final.deployed,food:final.res.food,medal:final.res.medal,starItems:final.starItems},
  finalSave:ledger.finalSave},null,2));
