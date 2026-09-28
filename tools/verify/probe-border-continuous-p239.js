'use strict';
// P239: current development-border battle + real training/production, one continuous state per flow.
// This is an isolated paid-route pressure probe; it never writes a player's save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const p166Path=path.join(__dirname,'probe-current-first-clear-population-p166.js');
const p167Path=path.join(root,'docs/codex/reports/data/p167-current-first-clear-campaign.json');
const outPath=path.join(root,'docs/codex/reports/data/p239-border-continuous.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const p167=JSON.parse(fs.readFileSync(p167Path,'utf8'));

function preparation(){
  const source=fs.readFileSync(p166Path,'utf8'),marker='const prepared=capturePreparation();';
  const at=source.indexOf(marker);
  assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0);
  const isolated=source.slice(0,at)+'return {capturePreparation,installBattleHarness,formArmy};\n'+source.slice(at);
  const helper=new Function('require','console','__dirname',isolated)(
    createRequire(p166Path),{log(){},error:console.error},path.dirname(p166Path));
  const RealDate=global.Date,fixed=1790400000000;
  global.Date=class extends RealDate {
    constructor(...args){super(...(args.length?args:[fixed]))}
    static now(){return fixed}
  };
  try{return{prepared:helper.capturePreparation(),helper}}
  finally{global.Date=RealDate}
}
const early=preparation();
assert.equal(early.prepared.battleState.population,18);
assert.equal(early.prepared.battleState.resources.deed,0);
assert.deepEqual(early.prepared.battleState,p167.battleStartState);
const targets={infantry:15,archer:13,bronze_guard:8};
const owned=(run,type)=>run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
const stock=run=>plain(run('({...S.res})'));

function boot(flow){
  const world=environment({rts_save:early.prepared.battleSave}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  early.helper.installBattleHarness(run);
  run(`globalThis.Date=class extends Date {static now(){return ${JSON.parse(early.prepared.battleSave).ts+1}}}`);
  early.helper.formArmy(run);
  assert.equal(run('S.sciences.includes("sci_copper")'),true);
  assert.deepEqual(Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)])),targets);
  const seed=(flow*1009+9176)>>>0;
  run(`globalThis.__p239Rng=${seed};globalThis.__p239Draws=0;
    Math.random=()=>{__p239Draws++;let x=__p239Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __p239Rng=x>>>0;return __p239Rng/4294967296};
    globalThis.__p239Paid={};globalThis.__p239MinPayFood=S.res.food;
    globalThis.__p239RealPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__p239RealPay(cost,n);__p239MinPayFood=Math.min(__p239MinPayFood,S.res.food);
      for(const[k,v]of Object.entries(cost))__p239Paid[k]=(__p239Paid[k]||0)+v*n};
    globalThis.__p239Pulses=[];globalThis.__p239RealProd=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=(...args)=>{const out=__p239RealProd(...args);
      if(out.collected)__p239Pulses.push({level:S.development.border.sites[out.resource].level,
        nominal:S.development.border.sites[out.resource].level*CFG.developmentCollection.yieldPerLevel[out.resource],
        gained:out.gained,tick:S.tick+1});return out};`);
  return{world,run,flow,initial:{saveSha256:hash(early.prepared.battleSave),res:stock(run),
    workers:plain(run('({...S.popAlloc})')),population:run('popCurrent()'),
    capacity:run('maxPop()'),formation:plain(run('S.formation'))}};
}

function refill(run){
  const paidBefore=plain(run('({...__p239Paid})'));
  const pulsesBefore=run('__p239Pulses.length');
  const staffing=[];
  if(run('S.popAlloc.wood')===0){
    assert.equal(run('S.popAlloc.stone'),6);
    const release=plain(run("setPopAlloc('stone',5)"));
    const assign=plain(run("setPopAlloc('wood',1)"));
    assert.equal(release.ok,true);assert.equal(assign.ok,true);
    staffing.push({stone:5,wood:1});
  }
  const requests={};
  for(const[type,target]of Object.entries(targets)){
    const missing=Math.max(0,target-owned(run,type)-(run(`S.queue['${type}']?.count||0`)));
    requests[type]=missing;
    if(missing)assert.equal(run(`train('${type}',${missing}).ok`),true,type+' queue');
  }
  let seconds=0,minFood=run('S.res.food');
  const pauses={};
  const ready=()=>Object.entries(targets).every(([k,n])=>owned(run,k)>=n);
  while(!ready()&&seconds<3600){
    run('tick()');seconds++;
    minFood=Math.min(minFood,run('S.res.food'));
    for(const[type,q]of Object.entries(plain(run('S.queue'))))
      if(q.count>0&&q.reason)pauses[type+': '+q.reason]=(pauses[type+': '+q.reason]||0)+1;
  }
  const paidAfter=plain(run('({...__p239Paid})'));
  const paid={};
  for(const key of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)]))
    if(paidAfter[key]!==paidBefore[key])paid[key]=(paidAfter[key]||0)-(paidBefore[key]||0);
  return{ready:ready(),seconds,minFoodTickEnd:minFood,minFoodAfterPayment:run('__p239MinPayFood'),
    requests,paid,pauses,staffing,pulses:plain(run(`__p239Pulses.slice(${pulsesBefore})`)),
    resAfter:stock(run)};
}

function fight(ctx){
  const {run,world}=ctx;
  early.helper.formArmy(run);
  const ownedBefore=Object.fromEntries(Object.keys(targets).map(k=>[k,owned(run,k)]));
  const before={res:stock(run),wins:run('S.development.border.sites.copper.wins'),
    level:run('S.development.border.sites.copper.level'),defeated:plain(run('S.defeated'))};
  run("openDevelopmentBorder('copper')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__p166Step()'),true,'lost combat callback');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'battle not settled');
  const won=run('S.development.border.sites.copper.wins')===before.wins+1;
  const after={res:stock(run),wins:run('S.development.border.sites.copper.wins'),
    level:run('S.development.border.sites.copper.level'),defeated:plain(run('S.defeated'))};
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.res.coin,before.res.coin,'coin reward is not priced yet');
  const lossByType=Object.fromEntries(Object.keys(targets).map(k=>[k,ownedBefore[k]-owned(run,k)]));
  run('exitBattle()');
  const settled=world.store.get('rts_save');
  const restored=environment({rts_save:settled});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.development.border.sites.copper.wins'),after.wins);
  assert.deepEqual(plain(restored.run('S.defeated')),after.defeated);
  return{won,round:run('B.round'),callbacks,enemy,lossByType,
    lossTotal:Object.values(lossByType).reduce((n,v)=>n+v,0),before,after,
    savedSha256:hash(settled)};
}

function flow(n){
  const ctx=boot(n),rows=[];
  for(let stage=1;stage<=30;stage++){
    const row=fight(ctx);row.stage=stage;
    if(!row.won){rows.push(row);break}
    if(stage===1){
      assert.equal(ctx.run("selectDevelopmentSite('copper').ok"),true);
    }
    row.recovery=refill(ctx.run);
    rows.push(row);
    if(!row.recovery.ready)break;
  }
  return{flow:n,initial:ctx.initial,rows,
    wins:ctx.run('S.development.border.sites.copper.wins'),
    level:ctx.run('S.development.border.sites.copper.level'),
    finalRes:stock(ctx.run),finalWorkers:plain(ctx.run('({...S.popAlloc})')),
    pulses:plain(ctx.run('__p239Pulses')),
    totalPaid:plain(ctx.run('({...__p239Paid})')),
    minPaymentFood:ctx.run('__p239MinPayFood'),
    mainlineDefeated:plain(ctx.run('S.defeated'))};
}

const flows=Array.from({length:16},(_,i)=>i+1).map(flow);
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-current-first-clear-population-p166.js',
  'tools/verify/probe-population-first-clear-replenish-p102.js',
  'docs/codex/reports/data/p167-current-first-clear-campaign.json'];
const report={batch:'P239',unit:'simulated online seconds',
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  method:'same paid early save, each RNG flow continuous across victories; current dynamic border enemy, true train/tick/payment/save; one wood-worker reassignment after first win; no coin grant',
  inputs:files.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),flows};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:'P239',flows:flows.map(f=>({flow:f.flow,wins:f.wins,
  losses:f.rows.map(r=>r.lossTotal),recovery:f.rows.map(r=>r.recovery?.seconds??null),
  paid:f.totalPaid,minFood:f.minPaymentFood,
  pulseNominal:f.pulses.reduce((n,p)=>n+p.nominal,0),
  pulseGained:f.pulses.reduce((n,p)=>n+p.gained,0)}))}));
