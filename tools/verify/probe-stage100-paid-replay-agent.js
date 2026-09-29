'use strict';
// Paid-input, sequential stage-90..100 replay with actual training payments.
// Stages 90-99 were previously cleared. Stage 100's quantum gate is bypassed
// only for a combat sensitivity check; its first clear is therefore not earned.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const inputFile='p391-steam-military-six-star-paid-save.json';
const inputRaw=fs.readFileSync(path.join(dataDir,inputFile),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const target=JSON.parse(inputRaw).formation;
const bossScale=process.argv.includes('--boss220')?220:170;
const targetByType={};
for(const groups of Object.values(target))for(const u of groups)
  targetByType[u.type]=(targetByType[u.type]||0)+u.count;
const targetPeople={90:165,91:180,92:210,93:250,94:300,95:360,
  96:450,97:600,98:800,99:1100,100:bossScale*11};
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage100-paid-replay-agent.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));

function setup(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;
      __timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>{S.log.push(String(m));if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};
    globalThis.__baseMs=Date.now();globalThis.__baseTick=S.tick;
    Date.now=()=>__baseMs+(S.tick-__baseTick)*1000;`);
}
function value(run,key){return run(`S.res.${key}`)}
function state(run){return run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  food:S.res.food,wood:S.res.wood,stone:S.res.stone,coal:S.res.coal,
  copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,tech:S.res.tech})`)}
function replayOne(raw,rng,stage){
  const env=environment({rts_save:raw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run(`S.defeated.includes(${stage})`),stage<100,'stage-clear baseline');
  setup(run,rng);
  if(stage===100)run('CFG.enemies[99].needSciences=[]');
  const enemy=run(`(()=>{const e=CFG.enemies[${stage-1}],n=Object.values(e.units).flat();
    const before=n.reduce((a,b)=>a+b,0),ratio=${targetPeople[stage]}/before;
    e.units=Object.fromEntries(Object.entries(e.units).map(([k,groups])=>
      [k,groups.map(c=>${stage===100?bossScale:'Math.max(1,Math.round(c*ratio))'})]));
    return{before,after:Object.values(e.units).flat().reduce((a,b)=>a+b,0)};})()`);
  const before=state(run);
  assert.equal(before.deployed,626);assert.equal(before.army,672);
  assert.equal(run(`selEnemy(${stage-1})`),true);
  run('openBattle()');assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=state(run);
  const enemyRemainingHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  assert.equal(after.tick,before.tick);
  const afterBattleRaw=env.store.get('rts_save');
  const reloaded=environment({rts_save:afterBattleRaw});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('formSoldierCount()'),after.deployed);
  const recovery=replenish(run);
  const final=state(run);
  assert.equal(final.deployed,626);assert.equal(final.army,672);
  assert.equal(run('save().ok'),true);
  const finalRaw=env.store.get('rts_save');
  const reload2=environment({rts_save:finalRaw});
  assert.equal(reload2.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload2.run('formSoldierCount()'),626);
  assert.equal(reload2.run('armyCount()'),672);
  assert.equal(reload2.run(`S.defeated.includes(${stage})`),stage<100||won);
  return{ok:won,stage,enemy,won,before,after,
    enemyRemainingHp,loss:before.deployed-after.deployed,
    recovery,final,rng:run('__rng'),raw:finalRaw,callbacks};
}
function replenish(run){
  run(`globalThis.__paid={};globalThis.__trained=0;globalThis.__minFood=S.res.food;
    const __payOrig=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payOrig(cost,n);
      for(const k of trainingCostKeys(cost)){
        const delta=before[k]-S.res[k];
        if(Math.abs(delta-cost[k]*n)>1e-6)throw Error('training debit '+k);
        __paid[k]=(__paid[k]||0)+delta;
      }
      __trained+=n;__minFood=Math.min(__minFood,S.res.food);return result;
    };
    const __prodOrig=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=function(...args){const out=__prodOrig(...args);
      if(out.res.food>=0)__minFood=Math.min(__minFood,out.res.food);return out};`);
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  const shortages={},expected={},phases={};
  let phase='setup',onlineSeconds=0;
  function assign(resource){
    for(const [key,n] of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
    assert.equal(run('popAllocTotal()'),1002);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
    phase=resource;
  }
  function advanceUntil(expr,max,stop='false'){
    const result=run(`(()=>{let n=0;while(!(${expr})&&!(${stop})&&n<${max}){tick();n++}
      return{n,done:!!(${expr})};})()`);
    onlineSeconds+=result.n;phases[phase]=(phases[phase]||0)+result.n;
    assert.ok(run('__minFood')>0,'food exhausted');return result;
  }
  function basic(resource,amount){
    if(value(run,resource)>=amount)return;
    assert.ok(amount<=run(`resCap('${resource}')`),resource+' capacity');
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,30000).done,resource+' fill');
  }
  function processed(resource,amount){
    if(value(run,resource)>=amount)return;
    assert.ok(amount<=run(`resCap('${resource}')`),resource+' capacity');
    let cycles=0;
    while(value(run,resource)<amount&&cycles++<100){
      if(value(run,'stone')<100000)basic('stone',Math.min(1200000,run("resCap('stone')")));
      if(value(run,'coal')<100000)basic('coal',Math.min(450000,run("resCap('coal')")));
      if(resource==='steel'&&value(run,'iron')<100000)
        processed('iron',Math.min(1000000,run("resCap('iron')")));
      const stock=value(run,resource);assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${amount}`,10000,stop);
      assert.ok(value(run,resource)>stock,resource+' depleted');
    }
    assert.ok(value(run,resource)>=amount,resource+' cycles');
  }
  function fill(resource,amount){
    if(value(run,resource)>=amount)return;
    if(['copper','iron','steel','gold'].includes(resource))processed(resource,amount);
    else basic(resource,amount);
  }
  for(const uk of ['archer',...Object.keys(targetByType).filter(k=>k!=='archer')]){
    const wanted=targetByType[uk],short=Math.max(0,wanted-run(`poolAvail('${uk}')`));
    shortages[uk]=short;if(!short)continue;
    const cost=run(`({...CFG.units.${uk}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');
    const q=run(`train('${uk}',${short})`);
    assert.equal(q?.ok,true,uk+' train');assert.equal(q.qty,short);
    phase='training';
    assert.ok(advanceUntil(`poolAvail('${uk}')>=${wanted}`,30000).done,uk+' training');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});
      S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const paid=run('({...__paid})'),trained=run('__trained'),minFood=run('__minFood');
  for(const [resource,amount] of Object.entries(expected))
    assert.ok(Math.abs((paid[resource]||0)-amount)<1e-6,resource+' paid mismatch');
  assert.equal(run('Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0)'),0);
  return{shortages,expected,paid,trained,onlineSeconds,phases,minFood};
}

const seeds=process.argv.includes('--pilot')?[1]:[1,7,13,23];
const routes=[];
for(const seed of seeds){
  let raw=inputRaw,rng=seed;
  const stages=[];
  for(let stage=90;stage<=99;stage++){
    const result=replayOne(raw,rng,stage);
    const nextRaw=result.raw;delete result.raw;
    stages.push(result);
    raw=nextRaw;rng=result.rng;
    if(!result.ok)break;
  }
  if(stages.length===10&&stages.every(x=>x.ok)){
    for(let attempt=1;attempt<=3;attempt++){
      const result=replayOne(raw,rng,100);
      const nextRaw=result.raw;delete result.raw;
      result.attempt=attempt;stages.push(result);
      raw=nextRaw;rng=result.rng;
      if(result.ok)break;
    }
  }
  routes.push({seed,stages,completed:stages.length>=11&&stages.at(-1).stage===100&&stages.at(-1).ok,
    finalSaveSha256:hash(raw)});
}
const report={kind:'same paid input, 90-99 sequential repeat wins plus gate-bypassed stage-100 first win; real-action replenishment, no valid first-clear claim',
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  input:{file:inputFile,sha256:hash(inputRaw)},sourceHashes,targetPeople,bossScale,routes};
const output=path.join(dataDir,`p-stage100-paid-replay-agent-${bossScale}-${seeds.length}seeds.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
assert.equal(hash(fs.readFileSync(path.join(dataDir,inputFile),'utf8')),report.input.sha256);
for(const x of sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,x.file))),x.sha256,x.file);
console.log(JSON.stringify({output,routes:routes.map(x=>({seed:x.seed,completed:x.completed,
  stages:x.stages.map(y=>({stage:y.stage,enemy:y.enemy.after,won:y.won,loss:y.loss,
    trained:y.recovery?.trained,onlineSeconds:y.recovery?.onlineSeconds,
    minFood:y.recovery?.minFood}))}))},null,2));
