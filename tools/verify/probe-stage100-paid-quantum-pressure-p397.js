'use strict';
// Isolated stage-100 enemy sensitivity on a genuinely paid quantum checkpoint.
// Only the isolated VM enemy array is changed. The pre-quantum battle is an
// eligibility-only counterfactual; its real stage-100 entry remains locked.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const names={preArray:'p386-300m-paid-save.json',preQuantum:'p397-quantum-bounded-cycle-save.json',paidQuantum:'p397-quantum-two-stores-save.json'};
const inputs=Object.fromEntries(Object.entries(names).map(([key,name])=>{
  const raw=fs.readFileSync(path.join(dir,name),'utf8');return[key,{name,hash:sha(raw),raw}];
}));
assert.equal(inputs.paidQuantum.hash,'c057701bbbfcf6d4763696e47cba0d10e37704b75f8f4cd5031a3cb050e7bea8');
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js','tools/verify/probe-stage100-paid-quantum-pressure-p397.js'];
const sourceHashes=sourceFiles.map(file=>({file,hash:sha(fs.readFileSync(path.join(root,file)))}));
const scales=[1,10,20,30,40,50,60,80,100,120,140,160,180];
const seeds=process.argv.includes('--pilot')?[1,7,9,16]:Array.from({length:16},(_,i)=>i+1);

function setUp(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;
      __timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,
        scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}

function entry(profile){
  const e=environment({rts_save:inputs[profile].raw}),run=e.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  const before=e.store.get('rts_save');
  const status=run(`({array:scienceUnlocked('sci_star_array'),quantum:scienceUnlocked('sci_quantum_age'),
    clear99:S.defeated.includes(99),clear100:S.defeated.includes(100),
    selectable:campaignStageSelectable(99),reason:campaignStageLockReason(99),
    deployed:formSoldierCount(),quantumDeployed:expeditionCount('quantum_trooper')})`);
  assert.equal(status.clear99,true);
  assert.equal(status.clear100,false);
  assert.equal(status.selectable,profile==='paidQuantum');
  assert.equal(run('selEnemy(99)'),profile==='paidQuantum');
  if(profile!=='paidQuantum'){
    run('S.selEnemy=99;openBattle()');
    assert.equal(run('S.battleActive'),false);
    assert.equal(e.store.get('rts_save'),before);
  }
  return status;
}
const eligibility=Object.fromEntries(Object.keys(inputs).map(p=>[p,entry(p)]));
assert.equal(eligibility.preArray.array,false);
assert.equal(eligibility.preQuantum.array,true);
assert.equal(eligibility.preQuantum.quantum,false);
assert.equal(eligibility.paidQuantum.quantum,true);
assert.equal(eligibility.paidQuantum.quantumDeployed,0);

function fight(profile,scale,seed,keepRaw=false){
  const e=environment({rts_save:inputs[profile].raw}),run=e.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  if(profile==='paidQuantum'){
    // Complete the already-paid single quantum soldier in the real queue first.
    assert.equal(run("setPopAlloc('tech',0)")?.ok,true);
    assert.equal(run("setPopAlloc('steel',902)")?.ok,true);
    for(let i=0;i<10;i++)run('tick()');
    assert.equal(run("poolAvail('quantum_trooper')"),1);
    assert.equal(run("queueTotal('quantum_trooper')"),0);
  }
  setUp(run,seed);
  if(profile!=='paidQuantum')run('CFG.enemies[99].needSciences=[]');
  run(`CFG.enemies[99].units=Object.fromEntries(Object.entries(CFG.enemies[99].units)
    .map(([key,groups])=>[key,groups.map(()=>${scale})]));`);
  const before=run(`({tick:S.tick,deployed:formSoldierCount(),army:armyCount(),
    quantum:scienceUnlocked('sci_quantum_age'),array:scienceUnlocked('sci_star_array')})`);
  assert.equal(run('selEnemy(99)'),true);
  run('openBattle()');
  assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
  assert.equal(enemy.people,11*scale);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<4000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({tick:S.tick,deployed:formSoldierCount(),army:armyCount(),
    round:B.round,clear100:S.defeated.includes(100),
    enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.clear100,won);
  const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  assert.equal(reload.run('S.defeated.includes(100)'),won);
  const result={profile,scale,seed,enemy,won,loss:before.deployed-after.deployed,
    deployedBefore:before.deployed,deployedAfter:after.deployed,round:after.round,
    remainingEnemyHp:after.enemyHp,callbacks,saveHash:sha(saved)};
  if(keepRaw)result.raw=saved;
  return result;
}

function recoverHardestWinner(){
  const battle=fight('paidQuantum',100,15,true);
  assert.equal(battle.won,true);
  assert.ok(battle.loss>=380,'expected the high-loss seed-15 winner');
  const raw=battle.raw;delete battle.raw;
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const target=JSON.parse(inputs.paidQuantum.raw).formation;
  const wantedByType={};
  for(const groups of Object.values(target))for(const u of groups)
    wantedByType[u.type]=(wantedByType[u.type]||0)+u.count;
  run(`Date.now=()=>${JSON.parse(raw).ts}+(S.tick-${JSON.parse(raw).tick})*1000;
    globalThis.__paidP397={};globalThis.__trainedP397=0;globalThis.__minFoodP397=S.res.food;
    const __payP397=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payP397(cost,n);
      for(const k of trainingCostKeys(cost)){
        const amount=before[k]-S.res[k];
        if(Math.abs(amount-cost[k]*n)>1e-6)throw Error('training debit '+k);
        __paidP397[k]=(__paidP397[k]||0)+amount;
      }
      __trainedP397+=n;__minFoodP397=Math.min(__minFoodP397,S.res.food);
      return result;
    };
    const __prodP397=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=function(...args){const out=__prodP397(...args);
      if(out.res.food>=0)__minFoodP397=Math.min(__minFoodP397,out.res.food);
      return out};`);
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  const caps=run(`Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','tech']
    .map(k=>[k,resCap(k)]))`);
  const beforeStock=run(`({tick:S.tick,food:S.res.food,wood:S.res.wood,stone:S.res.stone,coal:S.res.coal,
    copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})`);
  let onlineSeconds=0,phase='setup';
  const phases={},shortages={},expected={};
  const value=k=>run(`S.res.${k}`),cap=k=>caps[k];
  function assign(resource){
    for(const [key,n] of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food');
    phase=resource;
  }
  function advanceUntil(condition,max,stop='false'){
    const result=run(`(()=>{let n=0;while(!(${condition})&&!(${stop})&&n<${max}){tick();n++}
      return{n,done:!!(${condition})}})()`);
    onlineSeconds+=result.n;phases[phase]=(phases[phase]||0)+result.n;
    assert.ok(run('__minFoodP397')>0,'food depleted');
    return result;
  }
  function fillBasic(resource,amount){
    if(value(resource)>=amount)return;
    assert.ok(amount<=cap(resource),resource+' cap');
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,50000).done,resource+' fill');
  }
  function fillProcessed(resource,amount){
    if(value(resource)>=amount)return;
    assert.ok(amount<=cap(resource),resource+' cap');
    let cycles=0;
    while(value(resource)<amount&&cycles++<200){
      if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
      if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
      if(resource==='steel'&&value('iron')<100000)
        fillProcessed('iron',Math.min(1000000,cap('iron')));
      const stock=value(resource);
      assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${amount}`,20000,stop);
      assert.ok(value(resource)>stock,resource+' exhausted');
    }
    assert.ok(value(resource)>=amount,resource+' fill cycles');
  }
  function fill(resource,amount){
    if(value(resource)>=amount)return;
    if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,amount);
    else fillBasic(resource,amount);
  }
  for(const uk of ['archer',...Object.keys(wantedByType).filter(k=>k!=='archer')]){
    const wanted=wantedByType[uk],short=Math.max(0,wanted-run(`poolAvail('${uk}')`));
    shortages[uk]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${uk}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');
    const queued=run(`train('${uk}',${short})`);
    assert.equal(queued?.ok,true,uk+' queue');
    assert.equal(queued.qty,short);
    phase='training';
    assert.ok(advanceUntil(`poolAvail('${uk}')>=${wanted}`,50000).done,uk+' training');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});
      S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const trained=run('__trainedP397'),paid=run('({...__paidP397})'),minFood=run('__minFoodP397');
  assert.equal(trained,battle.loss);
  for(const [resource,amount] of Object.entries(expected))
    assert.ok(Math.abs((paid[resource]||0)-amount)<1e-6,resource+' paid');
  assert.equal(run('formSoldierCount()'),626);
  assert.equal(run('save().ok'),true);
  const finalRaw=env.store.get('rts_save'),reload=environment({rts_save:finalRaw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),626);
  assert.equal(reload.run('S.defeated.includes(100)'),true);
  return{battle,shortages,expected,paid,trained,onlineSeconds,phases,minFood,
    caps,beforeStock,afterStock:run(`({tick:S.tick,food:S.res.food,wood:S.res.wood,stone:S.res.stone,coal:S.res.coal,
      copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})`),finalHash:sha(finalRaw)};
}

const rows=[];
for(const profile of ['preQuantum','paidQuantum'])for(const scale of scales)
  for(const seed of seeds)rows.push(fight(profile,scale,seed));
const summary=[];
for(const profile of ['preQuantum','paidQuantum'])for(const scale of scales){
  const subset=rows.filter(x=>x.profile===profile&&x.scale===scale),wins=subset.filter(x=>x.won);
  summary.push({profile,perGroup:scale,totalEnemy:11*scale,wins:wins.length,of:seeds.length,
    meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    minWinLoss:wins.length?Math.min(...wins.map(x=>x.loss)):null,
    maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
    meanRounds:wins.length?wins.reduce((n,x)=>n+x.round,0)/wins.length:null,
    fullArmyLosses:subset.filter(x=>x.loss===x.deployedBefore).length});
}
const recovery=process.argv.includes('--recover')?recoverHardestWinner():null;
const report={batch:'P397',kind:'isolated stage-100 candidate, real callbacks and save/reload',
  units:'soldiers, HP and battle rounds; no economic recovery measured',
  inputs:Object.fromEntries(Object.entries(inputs).map(([key,{raw,...metadata}])=>[key,metadata])),
  eligibility,sourceHashes,scales,seeds,summary,rows,recovery,
  caveat:'Pre-quantum battle needs an eligibility-only bypass, while its real entry is denied. Paid quantum has no quantum soldier deployed; research flags alone may leave combat unchanged. Fixed seeds are engineering samples, not player win rates.'};
const file=`p397-stage100-paid-quantum-pressure-${seeds.length}seeds.json`;
fs.writeFileSync(path.join(dir,file),JSON.stringify(report,null,2)+'\n');
for(const x of Object.values(inputs))assert.equal(sha(fs.readFileSync(path.join(dir,x.name),'utf8')),x.hash);
for(const x of sourceHashes)assert.equal(sha(fs.readFileSync(path.join(root,x.file))),x.hash,x.file+' changed');
console.log(JSON.stringify(recovery?{file,recovery}:{file,eligibility,summary},null,2));
