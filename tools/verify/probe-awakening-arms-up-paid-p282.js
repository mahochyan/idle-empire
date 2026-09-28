'use strict';
// From the P279 safe save, produce and actually pay for one attack star in three legal batches.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,res:{...S.res},steelCap:resCap('steel'),arms:JSON.parse(JSON.stringify(S.armsUp.star_trooper)),fruit:S.items.trialFruit,level:S.awakening.star_trooper.level,army:armyCount(),deployed:formSoldierCount()})");
assert.equal(initial.level,5);assert.equal(initial.arms.atk.stars,0);assert.equal(initial.arms.atk.progress,0);
assert.ok(initial.steelCap<4000000&&initial.steelCap>=1600000);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
let seconds=0,minFood=initial.res.food,phase='none';
const phases={stone:0,coal:0,iron:0,steel:0},payments=[];
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
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
  assert.ok(target<=cap(resource),resource+' stock exceeds capacity');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${target}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),resource+' stock exceeds capacity');
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
for(const times of [400,400,200]){
  const cost=times*4000;
  fillProcessed('steel',cost);
  const before=val('steel');
  const action=run(`investArmsUp('star_trooper','atk',${times})`);
  assert.equal(action?.ok,true,JSON.stringify(action));
  assert.equal(action.cost,cost);
  assert.ok(Math.abs((before-val('steel'))-cost)<1e-5,'steel payment');
  payments.push({times,cost,beforeSteel:before,afterSteel:val('steel'),stars:action.stars,progress:action.progress,secondsAfter:seconds});
}
assert.equal(run('S.armsUp.star_trooper.atk.stars'),1);
assert.equal(run('S.armsUp.star_trooper.atk.progress'),0);
assert.equal(payments.reduce((n,p)=>n+p.cost,0),4000000);
assert.equal(run('S.items.trialFruit'),initial.fruit);
assert.equal(run('armyCount()'),initial.army);
assert.equal(run('formSoldierCount()'),initial.deployed);
const output=e.store.get('rts_save');
const file='docs/codex/reports/data/p282-awakening-arms-up-one-star-paid-save.json';
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.armsUp.star_trooper.atk.stars'),1);
assert.equal(reload.run('S.armsUp.star_trooper.atk.progress'),0);
assert.equal(reload.run('S.items.trialFruit'),initial.fruit);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const final=run("({tick:S.tick,res:{...S.res},arms:JSON.parse(JSON.stringify(S.armsUp.star_trooper)),fruit:S.items.trialFruit,level:S.awakening.star_trooper.level,army:armyCount(),deployed:formSoldierCount(),attack:weaponAttack('star_trooper')})");
const report={batch:'P282',source,sourceSha256:sha(raw),unit:'simulated online seconds and resources',initial,
  phases,seconds,minFood,payments,totalPaidSteel:4000000,final,file,saveSha256:sha(output)};
const reportFile='docs/codex/reports/data/p282-awakening-arms-up-one-star-paid.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,steelCap:initial.steelCap,seconds,phases,minFood,payments,
  attackBefore:reload.run("CFG.units.star_trooper.atk+CFG.units.star_trooper.atk*awakeningTotalStars()*CFG.awakening.globalStatPerStar"),
  attackAfter:final.attack,file,saveSha256:report.saveSha256},null,2));
