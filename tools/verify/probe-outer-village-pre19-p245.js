'use strict';
// P245: paid L10 army against the proposed outer-village V1, before L19.
// The village is a combat surrogate in a fresh VM for each flow; no runtime
// region reward or progression exists yet, so ordinary-stage side effects are
// measured but are not treated as an implemented outer-area settlement.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const p171DataPath=path.join(root,'docs/codex/reports/data/p171-paid-regiment-capacity.json');
const outputPath=path.join(root,'docs/codex/reports/data/p245-outer-village-pre19.json');
const sourceSavePath=path.join(root,'docs/codex/reports/data/p245-outer-village-l10-save.json');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const fixedNow=1790400000000;
const villageUnits={infantry:[6,4,3],archer:[6,4,3],cavalry_t1:[4,3]};
const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};

function reuseP171(){
  const marker='const profiles=[];';
  let source=fs.readFileSync(p171Path,'utf8');
  const at=source.indexOf(marker);
  assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0,'P171 return marker');
  source=source.slice(0,at)+
    'return {runBranch,workerPolicies,snapshot,installBattleHarness,route,checkpoint,compact,owned,formArmy,battleRng};\n'+
    source.slice(at);
  return new Function('require','console','__dirname',source)(
    createRequire(p171Path),{log(){},error:console.error},path.dirname(p171Path));
}
const RealDate=global.Date;
global.Date=class extends RealDate{
  constructor(...args){super(...(args.length?args:[fixedNow]))}
  static now(){return fixedNow}
};
let api,source,sourceSave;
try{
  api=reuseP171();
  const policy=api.workerPolicies.find(x=>x.name==='food-food');
  assert.ok(policy);
  const branch=api.runBranch(1,false,policy);
  assert.equal(branch.branch,'current-L3-plus-six');
  assert.ok(branch.battles.length===5&&branch.battles.every(x=>x.won));
  const e=environment({rts_save:branch.checkpointSave}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  api.installBattleHarness(run);
  assert.deepEqual(api.snapshot(run),branch.checkpoint);
  const route=api.route(run,1);
  assert.equal(route.block,null);
  assert.equal(route.clearedL10,true);
  assert.deepEqual(plain(run('([...S.defeated])')),Array.from({length:10},(_,i)=>i+1));
  sourceSave=e.store.get('rts_save');
  assert.equal(typeof sourceSave,'string');
  const reload=environment({rts_save:sourceSave});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(api.snapshot(reload.run),api.snapshot(run));
  const p171Data=JSON.parse(fs.readFileSync(p171DataPath,'utf8'));
  const old=p171Data.profiles
    .find(x=>x.seed===1&&x.branch==='current-L3-plus-six');
  assert.ok(old);
  const historicalInputMismatches=p171Data.inputs
    .filter(x=>sha(fs.readFileSync(path.join(root,x.file)))!==x.sha256)
    .map(x=>x.file);
  source={seed:1,branch:branch.branch,l5SaveSha256:sha(branch.checkpointSave),
    l10SaveSha256:sha(sourceSave),routeTickSeconds:route.final.tick-route.initial.tick,
    population:run('popCurrent()'),capacity:run('maxPop()'),
    defeated:plain(run('([...S.defeated])')),res:plain(run('({...S.res})')),
    workers:plain(run('({...S.popAlloc})')),
    owned:Object.fromEntries(Object.keys(targets).map(k=>[k,api.owned(run,k)])),
    sciences:plain(run('([...S.sciences])')),
    formation:plain(run('S.formation')),
    historicalP171:{finalTick:old.route.final.tick,owned:old.route.final.owned,
      inputMismatches:historicalInputMismatches}};
}finally{global.Date=RealDate}

function entry(flow,caseKey){
  const world=environment({rts_save:sourceSave}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  api.installBattleHarness(run);
  const beforeDefeated=plain(run('([...S.defeated])'));
  assert.equal(beforeDefeated.includes(19),false);
  const formation=api.formArmy(run);
  assert.equal(run('armyCount()'),43);
  if(caseKey==='village')run(`CFG.enemies[0]={...CFG.enemies[0],name:'外域军屯村寨 V1 隔离敌阵',
    units:${JSON.stringify(villageUnits)},reward:{},boss:false,bossMult:null,
    drops:null,firstClearReward:null}`);
  else assert.equal(caseKey,'copper');
  api.battleRng(run,flow,11);
  const before={res:plain(run('({...S.res})')),merit:run('S.merit'),
    owned:Object.fromEntries(Object.keys(targets).map(k=>[k,api.owned(run,k)])),
    defeated:beforeDefeated};
  if(caseKey==='village')run('selEnemy(0);openBattle()');
  else run("openDevelopmentBorder('copper')");
  assert.equal(run('S.battleActive'),true,`flow ${flow} ${caseKey} start`);
  const enemy=plain(run(`({groups:B.enemyUnits.length,
    people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p166Step()'),true,`flow ${flow}: missing battle callback`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after={res:plain(run('({...S.res})')),merit:run('S.merit'),
    owned:Object.fromEntries(Object.keys(targets).map(k=>[k,api.owned(run,k)])),
    defeated:plain(run('([...S.defeated])'))};
  assert.deepEqual(after.defeated,beforeDefeated);
  if(caseKey==='village')assert.deepEqual(after.res,before.res,'surrogate reward must be empty');
  else assert.equal(after.res.coin-before.res.coin,won?400:0,'live copper coin reward');
  run('exitBattle()');
  const battleSave=world.store.get('rts_save');
  const reload=environment({rts_save:battleSave});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(plain(reload.run('({...S.res})')),after.res);
  assert.deepEqual(plain(reload.run('([...S.defeated])')),after.defeated);
  const loss=Object.fromEntries(Object.keys(targets)
    .map(k=>[k,before.owned[k]-after.owned[k]]));
  return{world,run,flow,caseKey,formation,enemy,won,round:run('B.round'),callbacks,
    before,after,loss,battleSaveSha256:sha(battleSave)};
}

function recovery(battle){
  const {run,world}=battle;
  const requested={};
  for(const [type,target] of Object.entries(targets)){
    const missing=Math.max(0,target-api.owned(run,type)-(run(`S.queue['${type}']?.count||0`)));
    requested[type]=missing;
    if(missing)assert.equal(run(`train('${type}',${missing}).ok`),true,`${type} train`);
  }
  run(`globalThis.__p245Paid={};globalThis.__p245MinPayFood=S.res.food;
    globalThis.__p245RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__p245RealPay(cost,n);
      __p245MinPayFood=Math.min(__p245MinPayFood,S.res.food);
      for(const [k,v] of Object.entries(cost))
        __p245Paid[k]=(__p245Paid[k]||0)+v*n;}`);
  const ready=()=>Object.entries(targets).every(([k,n])=>api.owned(run,k)>=n);
  let seconds=0,minFoodTickEnd=run('S.res.food');
  const pauses={};
  while(!ready()&&seconds<3600){
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    for(const [type,q] of Object.entries(plain(run('S.queue'))))
      if(q.count>0&&q.reason)pauses[type+': '+q.reason]=(pauses[type+': '+q.reason]||0)+1;
  }
  assert.equal(run('save().ok'),true);
  const saved=world.store.get('rts_save');
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  const owned=Object.fromEntries(Object.keys(targets).map(k=>[k,api.owned(run,k)]));
  assert.deepEqual(Object.fromEntries(Object.keys(targets).map(k=>[k,api.owned(reload.run,k)])),owned);
  return{ready:ready(),seconds,minFoodTickEnd,
    minFoodAfterPayment:run('__p245MinPayFood'),requested,
    paid:plain(run('({...__p245Paid})')),pauses,
    resAfter:plain(run('({...S.res})')),owned,
    saveSha256:sha(saved)};
}

const rows=[];
for(const caseKey of ['village','copper'])for(let flow=1;flow<=16;flow++){
  const battle=entry(flow,caseKey),refill=recovery(battle);
  rows.push({case:caseKey,flow,formation:battle.formation,enemy:battle.enemy,won:battle.won,
    round:battle.round,callbacks:battle.callbacks,before:battle.before,
    after:battle.after,loss:battle.loss,
    battleSaveSha256:battle.battleSaveSha256,recovery:refill});
}
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'tools/verify/probe-population-early-18.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-current-first-clear-campaign-p167.js',
  'tools/verify/probe-t1-handoff-feasibility-p170.js',
  'tools/verify/probe-paid-regiment-capacity-p171.js',
  'docs/codex/reports/data/p171-paid-regiment-capacity.json',
  'tools/verify/probe-outer-village-pre19-p245.js'];
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const result={batch:'P245',unit:'game simulated online tick seconds; resources and soldiers',
  head,method:'Current real paid P167→P170→P171 route through L10, no L19; V1 enemy in isolated ordinary-battle surrogate, empty rewards; genuine battle and paid replenishment; no runtime outer area yet',
  warning:'Surrogate ordinary battle adds merit on win. It does not implement or validate outer-area reward/progression.',
  source,inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),rows};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(sourceSavePath,sourceSave+'\n');
fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P245',source:{...source,formation:undefined,sciences:source.sciences.length},
  cases:Object.fromEntries(['village','copper'].map(key=>{
    const xs=rows.filter(x=>x.case===key);
    const loss=xs.map(x=>Object.values(x.loss).reduce((a,b)=>a+b,0));
    return[key,{wins:xs.filter(x=>x.won).length,
      lossRange:[Math.min(...loss),Math.max(...loss)],
      recoveryReady:xs.filter(x=>x.recovery.ready).length,
      recoverySeconds:xs.map(x=>x.recovery.seconds),
      minFoodAfterPayment:Math.min(...xs.map(x=>x.recovery.minFoodAfterPayment))}]})),
  outputPath,sourceSavePath},null,2));
