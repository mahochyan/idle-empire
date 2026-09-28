'use strict';
// P246: current live outer-village settlement from one paid, pre-L19 L10 save.
// Each seeded flow is continuous and reloads after every battle and recovery.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputPath=path.join(root,'docs/codex/reports/data/p245-outer-village-l10-save.json');
const rewardDeed=process.argv[2]?.startsWith('--deed=')?Number(process.argv[2].slice(7)):12;
assert.ok([3,6,12].includes(rewardDeed),'P246 reward arm must be 3, 6 or 12 deeds');
const outputPath=path.join(root,'docs/codex/reports/data/'+
  (rewardDeed===12?'p246-outer-village-continuous.json':`p246-outer-village-candidate${rewardDeed}.json`));
const initialSave=fs.readFileSync(inputPath,'utf8').trim();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const target={bronze_guard:15,infantry_t1:15,archer_t1:13};
const workerCycle=['food','wood','food','copper'];
const maxWins=30,maxRecoverySeconds=3600;
const fixedNow=1790400000001;
const RealDate=global.Date;
global.Date=class extends RealDate{
  constructor(...args){super(...(args.length?args:[fixedNow]))}
  static now(){return fixedNow}
};

function own(run,type){return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function state(run){return plain(run(`({tick:S.tick,pop:popCurrent(),capacity:maxPop(),
  workers:{...S.popAlloc},res:{...S.res},villageLevel:S.settlements.village,
  region:{...S.development.outer.village},defeated:[...S.defeated],
  formation:JSON.parse(JSON.stringify(S.formation))})`))}
function boot(save){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(rewardDeed!==12)run(`CFG.developmentOuter.village.reward.deed=${rewardDeed}`);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
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
      for(const [k,v] of Object.entries(cost))__paid[k]=(__paid[k]||0)+v*n};`);
  assert.equal(run('saveProtected()'),false);
  assert.equal(run('S.defeated.includes(19)'),false);
  return{world,run};
}
function reload(ctx,label){
  assert.equal(ctx.run('save().ok'),true,label+' save');
  const saved=ctx.world.store.get('rts_save');
  const next=boot(saved);
  assert.deepEqual(state(next.run),state(ctx.run),label+' reload state');
  for(const type of Object.keys(target))assert.equal(own(next.run,type),own(ctx.run,type),label+' '+type);
  return{...next,saveSha256:sha(saved)};
}
function place(run,row,type,count,slot){
  assert.ok(run(`rowSlots('${row}')`)>slot);
  assert.ok(run(`poolAvail('${type}')`)>=count);
  run(`openFormModal('expedition','${row}',${slot});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),count);
}
function formArmy(run){
  run("clrForm('expedition')");
  place(run,'front','bronze_guard',15,0);
  place(run,'front','infantry_t1',15,1);
  place(run,'back','archer_t1',13,0);
  assert.equal(run('armyCount()'),43);
}
function seedBattle(run,flow,attempt){
  const seed=(flow*1009+(10+attempt)*9176)>>>0;
  run(`globalThis.__rng=${seed};globalThis.__draws=0;
    Math.random=()=>{__draws++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296}`);
}
function fight(ctx,flow,attempt){
  const {run,world}=ctx;
  formArmy(run);seedBattle(run,flow,attempt);
  const before=state(run),ownedBefore=Object.fromEntries(Object.keys(target).map(k=>[k,own(run,k)]));
  run("openDevelopmentOuter('village')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,`flow ${flow} attempt ${attempt}: callback missing`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=state(run),loss=Object.fromEntries(Object.keys(target)
    .map(k=>[k,ownedBefore[k]-own(run,k)]));
  assert.deepEqual(after.defeated,before.defeated);
  if(won){
    assert.equal(after.region.wins,before.region.wins+1);
    assert.equal(after.region.alert,before.region.alert+20);
    assert.equal(after.res.deed-before.res.deed,rewardDeed);
    assert.equal(after.res.medal-before.res.medal,5);
  }else{
    assert.deepEqual(after.region,before.region);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  const battleSave=world.store.get('rts_save');
  const fresh=boot(battleSave);
  assert.deepEqual(state(fresh.run),after,'battle save reload');
  run('exitBattle()');
  return{won,round:run('B.round'),draws:run('__draws'),callbacks,
    before,after,loss,enemy,battleSaveSha256:sha(battleSave)};
}
function spendAndRecover(ctx,battle,flow,workerCursor){
  const {run}=ctx;
  const cost=run("settlementCost('village')");
  let expanded=false,birthSeconds=0;
  if(run('S.res.deed')>=cost){
    assert.equal(run("upgradeSettlement('village').ok"),true);
    expanded=true;
    const beforePop=run('popCurrent()');
    while(run('popCurrent()')===beforePop&&birthSeconds<20){run('tick()');birthSeconds++}
    assert.equal(run('popCurrent()'),beforePop+1,'housing did not produce a resident');
    const job=workerCycle[workerCursor%workerCycle.length];
    assert.equal(run(`setPopAlloc('${job}',S.popAlloc.${job}+1).ok`),true,'new resident staffing');
    workerCursor++;
  }
  const requested={};
  for(const [type,n] of Object.entries(target)){
    const missing=Math.max(0,n-own(run,type)-run(`S.queue['${type}']?.count||0`));
    requested[type]=missing;
    if(missing)assert.equal(run(`train('${type}',${missing}).ok`),true,`${type} queue`);
  }
  let seconds=0,minFoodTickEnd=run('S.res.food');
  const paidBefore=plain(run('({...__paid})'));
  const ready=()=>Object.entries(target).every(([k,n])=>own(run,k)>=n);
  while(!ready()&&seconds<maxRecoverySeconds){
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
  }
  const paidAfter=plain(run('({...__paid})'));
  const paid={};
  for(const key of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)]))
    if((paidAfter[key]||0)!==(paidBefore[key]||0))paid[key]=(paidAfter[key]||0)-(paidBefore[key]||0);
  const next=reload(ctx,`flow ${flow} recovery`);
  return{next,workerCursor,record:{expanded,cost,birthSeconds,requested,
    ready:ready(),seconds,minFoodTickEnd,minFoodAfterPayment:run('__minPayFood'),
    paid,after:state(run),saveSha256:next.saveSha256}};
}

try{
  const flows=[];
  for(let flow=1;flow<=16;flow++){
    let ctx=boot(initialSave),workerCursor=0;
    const rows=[];
    for(let attempt=1;attempt<=maxWins;attempt++){
      const battle=fight(ctx,flow,attempt);
      if(!battle.won){rows.push({attempt,battle,recovery:null});break}
      const recovered=spendAndRecover(ctx,battle,flow,workerCursor);
      workerCursor=recovered.workerCursor;
      rows.push({attempt,battle,recovery:recovered.record});
      ctx=recovered.next;
      if(!recovered.record.ready)break;
    }
    flows.push({flow,rows,final:state(ctx.run),finalSaveSha256:ctx.saveSha256});
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',
    'docs/codex/reports/data/p245-outer-village-l10-save.json',
    'tools/verify/probe-outer-village-continuous-p246.js'];
  const result={batch:'P246',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{sourceSaveSha256:sha(initialSave),rewardDeed,
      rewardMode:rewardDeed===12?'current-runtime':'isolated-config-candidate',
      maxWins,maxRecoverySeconds,target,workerCycle,
      housing:'at most one paid village upgrade per victory; ten online ticks to natural birth',
      battle:'real openDevelopmentOuter and endBattle; no extra reward injection'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),flows};
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P246',rewardDeed,flows:flows.map(f=>({flow:f.flow,
    wins:f.rows.filter(r=>r.battle.won).length,attempts:f.rows.length,
    pop:f.final.pop,capacity:f.final.capacity,level:f.final.villageLevel,
    deeds:f.final.res.deed,medals:f.final.res.medal,
    recoveryWait:f.rows.reduce((n,r)=>n+(r.recovery?.seconds||0),0),
    minFoodPay:Math.min(...f.rows.map(r=>r.recovery?.minFoodAfterPayment??Infinity))})),
    outputPath},null,2));
}finally{global.Date=RealDate}
