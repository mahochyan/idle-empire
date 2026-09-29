'use strict';
// P397: actual city/deed payments, capped 24-hour offline settlement, and military
// star actions from the P395 fighter-equipped continuation. No direct S edits.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const fromSeven=process.argv.includes('--from-seven');
const sourceFile=fromSeven?'p397-star-beast-seven-calm-paid-save.json':
  'p395-star7-fighter-equipped-paid-save.json';
const sourcePath=path.join(dir,sourceFile),sourceRaw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(sourceRaw),fromSeven?
  'debb8df2e88f91755e558b4d1bea13d79aa16ee280f10005d5c43d758229a3be':
  'dcf21b0932e2bd640c3a37804da1fc3d685165c47b2f2f3c1c50f3ccb16d93f1');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const NativeDate=Date;
let probeNow=JSON.parse(sourceRaw).ts;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[probeNow]));}
  static now(){return probeNow;}
};
function load(raw){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  return{env,run};
}
function state(run){return run(`({tick:S.tick,ts:Date.now(),city:S.settlements.city,
  deed:S.res.deed,food:S.res.food,tech:S.res.tech,medal:S.res.medal,
  stars:S.steamMilitaryStars,multiplier:steamMilitaryStatMultiplier(),
  field:steamMilitaryFieldSize(),army:armyCount(),deployed:formSoldierCount(),
  garrison:militaryFormationCount(S._garrisonForm),alert:S.killValues.starBeast,
  daily:{...S.daily.counts},weapon:{...S.weaponForge.starFighter}})`)}
function checkpoint(world,verifyReload=false){
  const {env,run}=world;
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save');
  assert.ok(saved,'save did not persist');
  if(verifyReload){
    const reloaded=load(saved);
    assert.equal(JSON.stringify(state(reloaded.run)),JSON.stringify(state(run)),
      'checkpoint reload differs');
  }
  return saved;
}
const startStars=state(load(sourceRaw).run).stars;
const requestedTarget=Number((process.argv.find(x=>x.startsWith('--target='))||
  `--target=${fromSeven?35:30}`).slice(9));
assert.ok(Number.isSafeInteger(requestedTarget)&&requestedTarget>startStars&&requestedTarget<=50);
const out={sourceFile,sourceSha256:sha(sourceRaw),runtimeSha256,
  start:state(load(sourceRaw).run),targetStars:requestedTarget,
  offlineWindowSeconds:86400,
  simulatedOfflineSeconds:0,simulatedOnlineSeconds:0,
  settlements:[],offline:[],starSteps:[],milestones:[]};
let current=sourceRaw;
const milestoneSaves=[];
let stopped=null;
for(let target=startStars+1;target<=out.targetStars;target++){
  let iterations=0;
  while(iterations++<5000){
    const world=load(current),{run}=world,before=state(run);
    assert.equal(before.stars,target-1);
    const limits=run(`({currentField:steamMilitaryFieldSize(),
      nextField:steamMilitaryFieldSize(${target}),
      required:CFG.steamMilitary.firstStarFieldNeed+
        CFG.steamMilitary.fieldNeedPerStar*S.steamMilitaryStars,
      cityGain:CFG.settlements.city.popPerLv})`);
    const needCity=Math.max(0,Math.ceil((limits.required-limits.currentField)/limits.cityGain),
      Math.ceil((Math.max(before.deployed,before.garrison)-limits.nextField)/limits.cityGain));
    if(needCity===0){
      const step=run('steamMilitaryStarStep(1)');
      assert.equal(step.ok,true,`star ${target}: ${JSON.stringify(step)}`);
      const after=state(run),saved=checkpoint(world,true);
      assert.equal(after.stars,target);
      assert.equal(after.deed,before.deed);
      assert.equal(after.army,before.army);
      out.starSteps.push({target,before,step,after,saveSha256:sha(saved)});
      if(target%5===0)console.error(`[P397] paid star ${target}; city ${after.city}; offline windows ${out.offline.length}`);
      current=saved;
      if([30,35,40,45,50].includes(target)){
        const file=`p397-star-beast-star${target}-paid-save.json`;
        milestoneSaves.push({file,raw:saved});
        out.milestones.push({target,file,sha256:sha(saved),state:after});
      }
      break;
    }
    const wanted=Math.min(needCity,1000);
    let low=0,high=wanted;
    while(low<high){
      const mid=Math.ceil((low+high+1)/2);
      const quote=run(`settlementBatchPreview('city',${mid},${before.city})`);
      if(quote.ok)low=mid;else high=mid-1;
    }
    if(low>0){
      const quote=run(`settlementBatchPreview('city',${low},${before.city})`);
      assert.equal(quote.ok,true);
      const paid=run(`upgradeSettlementBatch('city',${low},${before.city},${before.deed})`);
      assert.equal(paid.ok,true,JSON.stringify(paid));
      const after=state(run),saved=checkpoint(world);
      assert.equal(after.city,before.city+low);
      assert.equal(after.deed,before.deed-quote.cost);
      out.settlements.push({target,count:low,cost:quote.cost,beforeCity:before.city,
        afterCity:after.city,beforeDeed:before.deed,afterDeed:after.deed,
        saveSha256:sha(saved)});
      current=saved;
      continue;
    }
    if(out.offline.length>=1000){stopped='1000 capped 24-hour windows bound';break}
    const single=run(`settlementBatchPreview('city',1,${before.city})`);
    const deedCap=run("resCap('deed')");
    if(single.cost>deedCap){stopped='single city cost exceeds deed cap';break}
    probeNow+=out.offlineWindowSeconds*1000;
    const offlineWorld=load(current),settled=offlineWorld.run('settleOffline()');
    assert.equal(settled.ok,true,JSON.stringify(settled));
    assert.equal(settled.durationSec,out.offlineWindowSeconds);
    const after=state(offlineWorld.run),saved=checkpoint(offlineWorld);
    assert.ok(after.deed>before.deed,'deed did not grow during offline window');
    assert.ok(after.food>0,'food exhausted');
    out.offline.push({index:out.offline.length+1,target,seconds:out.offlineWindowSeconds,
      beforeDeed:before.deed,afterDeed:after.deed,beforeFood:before.food,
      afterFood:after.food,gain:settled.gains?.deed??null,saveSha256:sha(saved)});
    out.simulatedOfflineSeconds+=out.offlineWindowSeconds;
    if(out.offline.length%10===0)console.error(`[P397] offline windows ${out.offline.length}; star ${target-1}; city ${after.city}`);
    current=saved;
  }
  if(stopped)break;
  assert.equal(state(load(current).run).stars,target,'star iteration bound');
}
out.stopped=stopped;
out.final=state(load(current).run);
out.finalSaveFile=fromSeven?`p397-star-beast-last-star${requestedTarget}-paid-save.json`:
  'p397-star-beast-last-star-paid-save.json';
out.finalSaveSha256=sha(current);
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sha(sourceRaw),'source changed');
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),
  runtimeSha256[f],`${f} changed during run`);
for(const m of milestoneSaves)fs.writeFileSync(path.join(dir,m.file),m.raw);
fs.writeFileSync(path.join(dir,out.finalSaveFile),current);
const reportFile=`p397-star-beast-star${requestedTarget}-paid.json`;
fs.writeFileSync(path.join(dir,reportFile),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:out.sourceSha256,start:out.start,
  milestones:out.milestones,starSteps:out.starSteps.length,
  cityLevels:out.settlements.reduce((n,x)=>n+x.count,0),
  deedSpent:out.settlements.reduce((n,x)=>n+x.cost,0),
  offlineWindows:out.offline.length,
  simulatedOfflineHours:out.simulatedOfflineSeconds/3600,
  stopped:out.stopped,final:out.final,finalSaveSha256:out.finalSaveSha256},null,2));
