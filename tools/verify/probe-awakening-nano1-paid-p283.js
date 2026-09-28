'use strict';
// Continue the two real core battles: pay nano armor research, forge, and restore all losses.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p278-awakening-core-stage4-two-2-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,res:{...S.res},items:{...S.items},forge:{...S.weaponForge.nanoArmor},army:armyCount(),deployed:formSoldierCount(),level:S.awakening.star_trooper.level,star:expeditionCount('star_trooper')})");
assert.equal(initial.level,4);assert.equal(initial.army,606);assert.equal(initial.deployed,576);
assert.equal(initial.items.godCore,97);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}}`);
const researchCost=run('({...CFG.weaponForge.nanoArmor.researchCost})');
const boneTradeCost=run('beastBoneTradeCost()'),boneTradeReward=run('beastBoneTradeReward()');
const trades=Math.ceil((researchCost.medal-initial.res.medal)/boneTradeReward);
assert.ok(trades>0&&trades*boneTradeCost<=initial.res.bone);
const trade=run(`exchangeBonesForMedals(${trades})`);
assert.equal(trade?.ok,true,JSON.stringify(trade));
assert.equal(trade.boneCost,trades*boneTradeCost);assert.equal(trade.medalGain,trades*boneTradeReward);
let seconds=0,minFood=initial.res.food,phase='none';
const phases={tech:0,copper:0,steel:0,training:0};
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',912)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=r.n;minFood=Math.min(minFood,r.min);phases[phase]+=r.n;
  assert.ok(r.min>0,'food depleted');assert.equal(r.done,true,'timed out: '+expression);
}
function fill(resource,target){
  if(run(`S.res.${resource}`)>=target)return;
  assert.ok(target<=run(`resCap('${resource}')`),resource+' capacity');
  assign(resource);advanceUntil(`S.res.${resource}>=${target}`,10000);
}
fill('tech',researchCost.tech);
const beforeResearch=run('({tech:S.res.tech,medal:S.res.medal})');
const research=run("researchWeapon('nanoArmor')");
assert.equal(research?.ok,true,JSON.stringify(research));
assert.ok(Math.abs(beforeResearch.tech-run('S.res.tech')-researchCost.tech)<1e-5);
assert.equal(beforeResearch.medal-run('S.res.medal'),researchCost.medal);
const coreBeforeForge=run('S.items.godCore');
const forgeSteps=run("weaponForgeSteps('nanoArmor')");
assert.equal(forgeSteps,20);
for(let i=0;i<forgeSteps;i++)assert.equal(run("forgeWeapon('nanoArmor')")?.ok,true,`forge ${i+1}`);
assert.equal(run('S.weaponForge.nanoArmor.level'),1);
assert.equal(run('S.weaponForge.nanoArmor.progress'),0);
assert.equal(coreBeforeForge-run('S.items.godCore'),80);
assert.equal(run("setWeaponEquipped('nanoArmor',true)")?.ok,true);
const targets={alloy_special:55-run('S.formation.front[2].count'),armored_trooper:55-run('S.formation.front[3].count')};
assert.deepEqual(targets,{alloy_special:8,armored_trooper:3});
const trainingCost={};
for(const [unit,count]of Object.entries(targets))for(const [k,v]of Object.entries(run(`CFG.units.${unit}.cost`)))
  trainingCost[k]=(trainingCost[k]||0)+v*count;
assert.deepEqual(trainingCost,{food:12000,steel:6800,copper:6000,iron:6000});
fill('copper',trainingCost.copper);
fill('steel',trainingCost.steel);
assert.ok(run('S.res.food')>=trainingCost.food);
assert.ok(run('S.res.iron')>=trainingCost.iron);
run("globalThis.__paid={};globalThis.__basePay=payTrainingCost;payTrainingCost=(c,n)=>{for(const[k,v]of Object.entries(c))__paid[k]=(__paid[k]||0)+v*n;return __basePay(c,n)}");
for(const [unit,count]of Object.entries(targets)){
  const queued=run(`train('${unit}',${count})`);
  assert.equal(queued?.ok,true,`${unit} queue: ${JSON.stringify(queued)}`);
  assert.equal(queued.qty,count);
}
phase='training';advanceUntil('(S.pool.alloy_special||0)>=8&&(S.pool.armored_trooper||0)>=3',100);
assert.deepEqual(JSON.parse(JSON.stringify(run('({...__paid})'))),trainingCost);
run("fillFormMax('expedition','front',2)");
run("fillFormMax('expedition','front',3)");
assert.equal(run('formSoldierCount()'),587);
assert.equal(run('armyCount()'),617);
assert.equal(run("expeditionCount('star_trooper')"),101);
assert.equal(run('S.awakening.star_trooper.level'),4);
assert.equal(run('S.items.trialFruit'),78);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save');
const file='docs/codex/reports/data/p283-awakening-stage4-nano1-paid-save.json';
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.weaponForge.nanoArmor.level'),1);
assert.equal(reload.run('S.weaponForge.nanoArmor.equipped'),true);
assert.equal(reload.run('formSoldierCount()'),587);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const final=run("({tick:S.tick,res:{...S.res},items:{...S.items},forge:{...S.weaponForge.nanoArmor},army:armyCount(),deployed:formSoldierCount(),level:S.awakening.star_trooper.level,star:expeditionCount('star_trooper')})");
const report={batch:'P283',source,sourceSha256:sha(raw),unit:'simulated online seconds, resources, soldiers',
  initial,trades,boneTradeCost,boneTradeReward,trade,researchCost,beforeResearch,research,
  forgeSteps,coreBeforeForge,targets,trainingCost,phases,seconds,minFood,final,file,saveSha256:sha(output)};
const reportFile='docs/codex/reports/data/p283-awakening-stage4-nano1-paid.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,trades,trade,researchCost,forgeSteps,targets,trainingCost,
  phases,seconds,minFood,final:{tech:final.res.tech,medal:final.res.medal,bone:final.res.bone,core:final.items.godCore,
    forge:final.forge,army:final.army,deployed:final.deployed,level:final.level},file,saveSha256:report.saveSha256},null,2));
