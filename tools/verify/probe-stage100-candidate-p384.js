'use strict';
// P384: isolated 91–100 battle-pressure candidate. Never mutates the shipped levels.js.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'docs/codex/reports/data');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = {
  preNuclear: 'p271-stage99-prenuclear-seed1-save.json',
  awakened: 'p285-awakening-stage6-full-roster-paid-save.json',
  star40: 'p338-electric5-nuclear5-star-attack-40-paid-save.json',
  star120: 'p338-electric5-nuclear5-star-attack-120-paid-save.json'
};
const inputs = Object.fromEntries(Object.entries(sources).map(([profile, name]) => {
  const raw = fs.readFileSync(path.join(dataDir, name), 'utf8');
  return [profile, {name, sha256: sha(raw), raw}];
}));
const hard = process.argv.includes('--hard');
const targetPeople = hard ?
  {91:80, 92:100, 93:140, 94:240, 95:320,
    96:450, 97:700, 98:950, 99:1300, 100:1870} :
  {91:60, 92:80, 93:100, 94:180, 95:220,
    96:280, 97:420, 98:540, 99:800, 100:1870};
const pilot = process.argv.includes('--pilot');
const seeds = pilot ? 8 : 32;
const sourceHashes = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js',
  'tests/progression/harness.js', 'tools/verify/probe-stage100-candidate-p384.js']
  .map(file => ({file, sha256: sha(fs.readFileSync(path.join(root, file)))}));

function setUp(run, seed) {
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;
      __timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}

function changeEnemy(run, stage) {
  return run(`(()=>{
    const enemy=CFG.enemies[${stage-1}];
    const original=Object.values(enemy.units).flat().reduce((a,b)=>a+b,0);
    const ratio=${targetPeople[stage]}/original;
    enemy.units=Object.fromEntries(Object.entries(enemy.units).map(([type,groups])=>
      [type,groups.map(n=>${stage===100 ? 170 : 'Math.max(1,Math.round(n*ratio))'})]));
    return{original,target:${targetPeople[stage]},candidate:Object.values(enemy.units).flat().reduce((a,b)=>a+b,0),
      groups:Object.values(enemy.units).flat().length};
  })()`);
}

function fight(profile, stage, variant, seed, keepRaw=false) {
  const input = inputs[profile];
  const env = environment({rts_save:input.raw});
  const run = env.run;
  assert.ok(['ok', 'migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('S.defeated.includes(99)'), true);
  assert.equal(run('S.defeated.includes(100)'), false);
  setUp(run, seed);
  const enemyCounts = variant === 'candidate' ? changeEnemy(run, stage) :
    run(`(()=>{const e=CFG.enemies[${stage-1}];const n=Object.values(e.units).flat();
      return{original:n.reduce((a,b)=>a+b,0),candidate:n.reduce((a,b)=>a+b,0),groups:n.length}})()`);
  const before = run('({army:armyCount(),deployed:formSoldierCount(),tick:S.tick})');
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'), true);
  let callbacks=0;
  while(run('S.battleActive') && callbacks<3000) {
    assert.equal(run('__step()'), true, `${profile} ${stage} ${variant} ${seed}`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'), false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({army:armyCount(),deployed:formSoldierCount(),tick:S.tick,round:B.round,
    enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    cleared:S.defeated.includes(${stage})})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.cleared,true === (stage<100 || won));
  const reload=environment({rts_save:env.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  assert.equal(reload.run(`S.defeated.includes(${stage})`),after.cleared);
  const result={profile,stage,variant,seed,won,round:after.round,
    loss:before.deployed-after.deployed,remainingHp:after.enemyHp,
    enemy:enemyCounts,callbacks,armyBefore:before.army,armyAfter:after.army,
    deployedBefore:before.deployed,deployedAfter:after.deployed};
  if(keepRaw)result.raw=env.store.get('rts_save');
  return result;
}

const rows=[];
for(const profile of Object.keys(inputs))for(const stage of Object.keys(targetPeople).map(Number))
  for(const variant of ['formal','candidate'])for(let seed=1;seed<=seeds;seed++)
    rows.push(fight(profile,stage,variant,seed));
const summary=[];
for(const profile of Object.keys(inputs))for(const stage of Object.keys(targetPeople).map(Number))
  for(const variant of ['formal','candidate']) {
    const subset=rows.filter(x=>x.profile===profile&&x.stage===stage&&x.variant===variant);
    const wins=subset.filter(x=>x.won),losses=subset.filter(x=>!x.won);
    summary.push({profile,stage,variant,enemy:subset[0].enemy,wins:wins.length,of:seeds,
      meanWinLoss:wins.length?wins.reduce((a,x)=>a+x.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
      meanLossRemainingHp:losses.length?losses.reduce((a,x)=>a+x.remainingHp,0)/losses.length:null});
  }
function recoverStage99() {
  const battle=fight('star120',99,'candidate',1,true);
  assert.equal(battle.won,true,'predeclared seed 1 must win candidate 99');
  const raw=battle.raw;delete battle.raw;
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const saved=JSON.parse(raw),target=JSON.parse(inputs.star120.raw).formation;
  const targetByType={};
  for(const groups of Object.values(target))for(const u of groups)
    targetByType[u.type]=(targetByType[u.type]||0)+u.count;
  run(`Date.now=()=>${saved.ts}+(S.tick-${saved.tick})*1000;
    globalThis.__paidP384={};globalThis.__trainedP384=0;globalThis.__minFoodP384=S.res.food;
    const __payP384=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payP384(cost,n);
      for(const k of trainingCostKeys(cost)){
        const amount=before[k]-S.res[k];
        if(Math.abs(amount-cost[k]*n)>1e-6)throw Error('training debit '+k);
        __paidP384[k]=(__paidP384[k]||0)+amount;
      }
      __trainedP384+=n;__minFoodP384=Math.min(__minFoodP384,S.res.food);
      return result;
    };
    const __prodP384=productionAndDevelopmentSecond;
    productionAndDevelopmentSecond=function(...args){const out=__prodP384(...args);
      if(out.res.food>=0)__minFoodP384=Math.min(__minFoodP384,out.res.food);
      return out};`);
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  const caps=run(`Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','tech']
    .map(k=>[k,resCap(k)]))`);
  const beforeStock=run(`({tick:S.tick,food:S.res.food,coal:S.res.coal,
    copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})`);
  let onlineSeconds=0,phase='setup';
  const phases={},shortages={},expected={};
  const value=k=>run(`S.res.${k}`),cap=k=>caps[k];
  function assign(resource) {
    for(const [key,n] of Object.entries(run('({...S.popAlloc})')))
      if(n>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
    assert.equal(run('popAllocTotal()'),1002);
    assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,'net food');
    phase=resource;
  }
  function advanceUntil(condition,max,stop='false') {
    const result=run(`(()=>{let n=0;while(!(${condition})&&!(${stop})&&n<${max}){tick();n++}
      return{n,done:!!(${condition})}})()`);
    onlineSeconds+=result.n;phases[phase]=(phases[phase]||0)+result.n;
    assert.ok(run('__minFoodP384')>0,'food depleted');
    return result;
  }
  function fillBasic(resource,amount) {
    if(value(resource)>=amount)return;
    assert.ok(amount<=cap(resource),resource+' cap');
    assign(resource);
    assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,30000).done,resource+' fill');
  }
  function fillProcessed(resource,amount) {
    if(value(resource)>=amount)return;
    assert.ok(amount<=cap(resource),resource+' cap');
    let cycles=0;
    while(value(resource)<amount&&cycles++<100){
      if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
      if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
      if(resource==='steel'&&value('iron')<100000)
        fillProcessed('iron',Math.min(1000000,cap('iron')));
      const stock=value(resource);
      assign(resource);
      const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
      advanceUntil(`S.res.${resource}>=${amount}`,10000,stop);
      assert.ok(value(resource)>stock,resource+' exhausted');
    }
    assert.ok(value(resource)>=amount,resource+' fill cycles');
  }
  function fill(resource,amount) {
    if(value(resource)>=amount)return;
    if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,amount);
    else fillBasic(resource,amount);
  }
  for(const uk of ['archer',...Object.keys(targetByType).filter(k=>k!=='archer')]) {
    const wanted=targetByType[uk],short=Math.max(0,wanted-run(`poolAvail('${uk}')`));
    shortages[uk]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${uk}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))) {
      fill(resource,per*short);expected[resource]=(expected[resource]||0)+per*short;
    }
    assign('tech');
    const queued=run(`train('${uk}',${short})`);
    assert.equal(queued?.ok,true,uk+' queue');
    assert.equal(queued.qty,short);
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
  const trained=run('__trainedP384'),paid=run('({...__paidP384})'),minFood=run('__minFoodP384');
  assert.equal(trained,battle.loss);
  for(const [resource,amount] of Object.entries(expected))
    assert.ok(Math.abs((paid[resource]||0)-amount)<1e-6,resource+' paid');
  assert.equal(run('formSoldierCount()'),626);
  assert.equal(run('armyCount()'),672);
  assert.equal(run('save().ok'),true);
  const finalRaw=env.store.get('rts_save');
  const reload=environment({rts_save:finalRaw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),626);
  return {battle,shortages,expected,paid,trained,onlineSeconds,phases,minFood,
    beforeStock,afterStock:run(`({tick:S.tick,food:S.res.food,coal:S.res.coal,
      copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})`),
    finalSaveSha256:sha(finalRaw)};
}

const recovery=process.argv.includes('--recover')?recoverStage99():null;
const report={batch:'P384',kind:'isolated 91-100 formal versus scaled candidate, real battle/callback/save reload',
  assumption:'All profiles are paid stage-99 checkpoints. Stages 91-99 are independent replays, not first-clear sequential campaigns; each seed starts from the same input save.',
  targetPeople,seeds,inputs:Object.fromEntries(Object.entries(inputs).map(([profile,{raw,...meta}])=>[profile,meta])),
  sourceHashes,summary,rows,recovery};
const filename=`p384-stage100-candidate-${hard?'hard':'soft'}-${pilot?'pilot':'deep'}.json`;
fs.writeFileSync(path.join(dataDir,filename),JSON.stringify(report,null,2)+'\n');
for(const {name,sha256} of Object.values(inputs))assert.equal(sha(fs.readFileSync(path.join(dataDir,name))),sha256);
console.log(JSON.stringify({file:filename,seeds,summary},null,2));
