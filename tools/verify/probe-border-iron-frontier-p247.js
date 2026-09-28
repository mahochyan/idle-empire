'use strict';
// P247: isolated iron-point candidate using the current paid, pre-L19 L10 save.
// The iron config exists only in each VM. No player-facing price is changed.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const outputFile='docs/codex/reports/data/p247-border-iron-frontier.json';
const sourceSave=fs.readFileSync(path.join(root,sourceFile),'utf8').trim();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const target={bronze_guard:15,infantry_t1:15,archer_t1:13};
const ironCandidate={key:'borderIron',site:'iron',name:'边疆铁脉关隘',
  needScience:'sci_iron',developmentBorder:true,boss:false,
  units:{infantry:[6,5],archer:[3,2]},alertPerWin:20,levelPerWin:1,reward:{}};
const realDate=global.Date;
global.Date=class extends realDate {
  constructor(...args){super(...(args.length?args:[1790400000001]))}
  static now(){return 1790400000001}
};

function boot(save){
  const env=environment({rts_save:save}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`CFG.developmentBorder.iron=${JSON.stringify(ironCandidate)};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)
    };
    globalThis.addLog=message=>S.log.push(String(message));
    globalThis.__paid={};globalThis.__minPayFood=S.res.food;
    globalThis.__realPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__realPay(cost,n);__minPayFood=Math.min(__minPayFood,S.res.food);
      for(const [key,value] of Object.entries(cost))__paid[key]=(__paid[key]||0)+value*n};`);
  assert.equal(run('S.sciences.includes("sci_iron")'),true);
  assert.equal(run('S.defeated.includes(19)'),false);
  assert.equal(run('S.popAlloc.iron'),0);
  return{env,run};
}
function own(run,key){return run(`(S.pool['${key}']||0)+expeditionCount('${key}')+garrisonCount('${key}')`)}
function snapshot(run){return plain(run('({tick:S.tick,res:{...S.res},formation:S.formation,defeated:[...S.defeated],development:S.development})'))}
function seed(run,flow){
  run(`globalThis.__rng=${(flow*1009+11*9176)>>>0};
    Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
}
function one(flow,site){
  const ctx=boot(sourceSave),{run,env}=ctx;
  seed(run,flow);
  const before=snapshot(run);
  const ownedBefore=Object.fromEntries(Object.keys(target).map(k=>[k,own(run,k)]));
  run(`openDevelopmentBorder('${site}')`);
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run('({alert:B.enemyCfg.alert,units:B.enemyCfg.units,groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0)})'));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=snapshot(run);
  assert.deepEqual(after.defeated,before.defeated);
  const loss=Object.fromEntries(Object.keys(target).map(k=>[k,ownedBefore[k]-own(run,k)]));
  assert.equal(won,true,`flow ${flow} site ${site} first battle failed`);
  assert.equal(after.development.border.sites[site].level,1);
  assert.equal(after.development.border.sites[site].wins,1);
  assert.equal(after.res.coin-before.res.coin,site==='copper'?400:0);
  const battleSave=env.store.get('rts_save');
  const reloaded=boot(battleSave);
  assert.deepEqual(snapshot(reloaded.run),after);
  run('exitBattle()');
  assert.equal(run(`selectDevelopmentSite('${site}').ok`),true);
  const collectionBefore=snapshot(run);
  for(let t=0;t<60;t++)run('tick()');
  const collectionAfter=snapshot(run);
  assert.equal(run('S.development.border.collection.activeSite'),site);
  const actualMetal=collectionAfter.res[site]-collectionBefore.res[site];
  if(site==='iron')assert.equal(actualMetal,1,'first iron point should collect one iron in sixty online seconds');
  const requested={};
  for(const [key,n] of Object.entries(target)){
    const missing=Math.max(0,n-own(run,key)-run(`S.queue['${key}']?.count||0`));
    requested[key]=missing;
    if(missing)assert.equal(run(`train('${key}',${missing}).ok`),true);
  }
  const ready=()=>Object.entries(target).every(([key,n])=>own(run,key)>=n);
  let recoverySeconds=0;
  while(!ready()&&recoverySeconds<3600){run('tick()');recoverySeconds++}
  assert.equal(ready(),true,`flow ${flow} site ${site} recovery incomplete`);
  assert.equal(run('save().ok'),true);
  const finalSave=env.store.get('rts_save');
  assert.deepEqual(snapshot(boot(finalSave).run),snapshot(run));
  return{flow,site,enemy,won,callbacks,loss,battleSaveSha256:sha(battleSave),
    pointFirstMinute:{onlineSeconds:60,actualMetal,nominalMetal:site==='iron'?1:2,
      metalStockBefore:collectionBefore.res[site],metalStockAfter:collectionAfter.res[site]},
    recovery:{requested,onlineSeconds:recoverySeconds,minFoodAfterPayment:run('__minPayFood'),
      paid:plain(run('({...__paid})')),finalResource:plain(run('({...S.res})'))},
    finalSaveSha256:sha(finalSave)};
}
try{
  const rows=[];
  for(const site of ['copper','iron'])for(let flow=1;flow<=16;flow++)rows.push(one(flow,site));
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',sourceFile,'tools/verify/probe-border-iron-frontier-p247.js'];
  const result={batch:'P247',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    unit:'game simulated online tick seconds, resources and soldiers',
    policy:{sourceSaveSha256:sha(sourceSave),ironCandidate,coinReward:'candidate zero; official copper 400',
      comparison:'same paid save, same 16 fixed random flows; one battle, 60 online seconds collection, paid recovery'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),rows};
  const dest=path.join(root,outputFile);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P247',cases:Object.fromEntries(['copper','iron'].map(site=>{
    const a=rows.filter(r=>r.site===site);
    const losses=a.map(r=>Object.values(r.loss).reduce((x,y)=>x+y,0));
    return[site,{wins:a.filter(r=>r.won).length,lossRange:[Math.min(...losses),Math.max(...losses)],
      meanLoss:losses.reduce((x,y)=>x+y,0)/a.length,
      recoveryRange:[Math.min(...a.map(r=>r.recovery.onlineSeconds)),Math.max(...a.map(r=>r.recovery.onlineSeconds))],
      meanRecovery:a.reduce((x,r)=>x+r.recovery.onlineSeconds,0)/a.length,
      minFoodAfterPayment:Math.min(...a.map(r=>r.recovery.minFoodAfterPayment)),
      firstMinuteActualMetal:[Math.min(...a.map(r=>r.pointFirstMinute.actualMetal)),Math.max(...a.map(r=>r.pointFirstMinute.actualMetal))]}]
  })),outputFile},null,2));
}finally{global.Date=realDate}
