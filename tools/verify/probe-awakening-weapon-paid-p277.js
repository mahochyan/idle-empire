'use strict';
// Paid weapon continuation from a reloadable level-4 save. No direct S edits.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const input=arg('input')||'p276-awakening-level4-replenished-save.json';
const weapon=arg('weapon')||'steamArmor';
const target=Number(arg('target')||2);
const label=arg('label')||'steam2';
const expectedLevel=Number(arg('expected-level')||4);
const outputPrefix=arg('output-prefix')||'p277';
assert.match(input,/^p27[678]-[a-z0-9-]+\.json$/);
assert.ok(['steamArmor','energyArmor','electroRifle','electroSniper','gatling','mortar'].includes(weapon));
assert.ok(Number.isSafeInteger(target)&&target>=2&&target<=4);
assert.ok(Number.isSafeInteger(expectedLevel)&&expectedLevel>=4&&expectedLevel<=20);
assert.match(outputPrefix,/^p27[78]$/);
assert.match(label,/^[a-z0-9-]+$/);
const source='docs/codex/reports/data/'+input;
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.awakening.star_trooper.level'),expectedLevel);
const initial=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stars:expeditionCount('star_trooper'),food:S.res.food,res:{...S.res},items:{...S.items},armor:JSON.parse(JSON.stringify(S.weaponForge))})");
assert.equal(initial.deployed,587);
assert.equal(initial.stars,101);
assert.ok(run(`S.weaponForge.${weapon}.researched&&S.weaponForge.${weapon}.equipped`));
assert.ok(run(`S.weaponForge.${weapon}.level`)<target);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
run("globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}");
let seconds=0,minFood=initial.food;
const phases={stone:0,coal:0,iron:0,steel:0};
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function advanceUntil(expression,max,stop='false',phase){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;minFood=Math.min(minFood,result.min);
  if(phase)phases[phase]+=result.n;
  assert.ok(result.min>0,'food depleted');
  return result;
}
function fillBasic(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),resource+' capacity');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${targetStock}`,10000,'false',resource).done,resource+' fill timed out');
}
function fillProcessed(resource,targetStock){
  if(val(resource)>=targetStock)return;
  assert.ok(targetStock<=cap(resource),resource+' capacity');
  let cycles=0;
  while(val(resource)<targetStock&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetStock}`,5000,stop,resource);
    assert.ok(val(resource)>before,resource+' production stalled');
  }
  assert.ok(val(resource)>=targetStock,resource+' fill exhausted');
}
const investments=[];
while(run(`S.weaponForge.${weapon}.level`)<target){
  const level=run(`S.weaponForge.${weapon}.level`);
  const steps=run(`weaponForgeSteps('${weapon}')`);
  assert.ok(Number.isSafeInteger(steps)&&steps>=1&&steps<=100);
  const cost=run(`weaponForgeStepCost('${weapon}')`);
  assert.ok(cost&&Object.keys(cost).length>0);
  if(cost.steel)fillProcessed('steel',cost.steel*steps);
  const before=run("({res:{...S.res},items:{...S.items}})");
  for(let i=0;i<steps;i++){
    const result=run(`forgeWeapon('${weapon}')`);
    assert.equal(result?.ok,true,weapon+' step '+i+': '+JSON.stringify(result));
  }
  const after=run("({res:{...S.res},items:{...S.items}})");
  investments.push({from:level,to:run(`S.weaponForge.${weapon}.level`),steps,cost,before,after});
}
assert.equal(run(`S.weaponForge.${weapon}.level`),target);
assert.equal(run('armyCount()'),initial.army);
assert.equal(run('formSoldierCount()'),initial.deployed);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save');
const file=`docs/codex/reports/data/${outputPrefix}-awakening-${label}-paid-save.json`;
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run(`S.weaponForge.${weapon}.level`),target);
assert.equal(reload.run('armyCount()'),initial.army);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const final=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),stars:expeditionCount('star_trooper'),food:S.res.food,res:{...S.res},items:{...S.items},armor:JSON.parse(JSON.stringify(S.weaponForge))})");
const report={batch:outputPrefix.toUpperCase(),source,sourceSha256:sha(raw),weapon,target,label,unit:'simulated online seconds, resources, soldiers',initial,seconds,phases,minFood,investments,final,file,saveSha256:sha(output)};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/${outputPrefix}-awakening-${label}-paid.json`),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,weapon,target,seconds,phases,minFood,investments:investments.map(x=>({from:x.from,to:x.to,steps:x.steps,cost:x.cost})),file,saveSha256:report.saveSha256}));
