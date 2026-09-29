'use strict';
// P391: pay the new military science and legal stars, then use real battles.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p391-beast-replenished-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const NativeDate=Date;
let probeNow=JSON.parse(raw).ts;
global.Date=class ProbeDate extends NativeDate {
  constructor(...args){super(...(args.length?args:[probeNow]));}
  static now(){return probeNow;}
};
function load(saved,seed=1){
  const env=environment({rts_save:saved}),run=env.run;
  const status=run('loadSaveAndApply().status');
  assert.ok(['ok','migrated'].includes(status),status);
  if(status==='migrated')assert.equal(env.store.get('rts_save_premigration'),saved);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  return{env,run};
}
function state(run){return run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,food:S.res.food,
  army:armyCount(),deployed:formSoldierCount(),fruit:S.items.trialFruit,
  starItems:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore},
  awakening:{level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars},
  military:{science:scienceUnlocked('sci_steam_military'),stars:S.steamMilitaryStars,
    field:steamMilitaryFieldSize(),multiplier:steamMilitaryStatMultiplier()},
  beastDaily:dailyCount('starBeast1')})`)}
function settledBattle(run){
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<8000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<8000);
  return{result:run("document.getElementById('battle-result').className"),callbacks,
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),after:state(run)};
}
function battle(run,key){
  const before=state(run);
  run(`openMaterialDomain(${JSON.stringify(key)})`);
  if(!run('S.battleActive'))return{key,opened:false,before};
  const settled=settledBattle(run);
  run('exitBattle()');
  return{key,opened:true,before,...settled};
}
function checkReload(env,run){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save');
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(state(reload.run))),JSON.parse(JSON.stringify(state(run))));
  return saved;
}

const base=load(raw),run=base.run;
const initial=state(run);
assert.equal(initial.military.science,false);
assert.equal(initial.military.stars,0);
const scienceCost=run("activeSciences().sci_steam_military.cost");
assert.equal(scienceCost.tech,150000);
for(const [key,count]of Object.entries(run('({...S.popAlloc})')))
  if(key!=='food'&&count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
assert.equal(run("setPopAlloc('tech',902)").ok,true);
let fillSeconds=0,minFood=initial.food;
while(run('S.res.tech')<scienceCost.tech&&fillSeconds<100){run('tick()');fillSeconds++;
  minFood=Math.min(minFood,run('S.res.food'));}
assert.ok(fillSeconds<100);
assert.ok(minFood>0);
const beforeScience=state(run);
const payment=run("researchScience('sci_steam_military')");
assert.equal(payment.ok,true,JSON.stringify(payment));
const checkpoints=[{stars:0,state:state(run),raw:checkReload(base.env,run)}];
for(let target=1;target<=6;target++){
  const step=run('steamMilitaryStarStep(1)');
  if(!step.ok){checkpoints.push({stars:target,blocked:step});break;}
  checkpoints.push({stars:target,step,state:state(run),raw:checkReload(base.env,run)});
}
const sixStar=checkpoints.find(c=>c.stars===6&&c.raw);
if(sixStar)fs.writeFileSync(path.join(data,'p391-steam-military-six-star-paid-save.json'),sixStar.raw);
const seventhAttempt=run('steamMilitaryStarStep(1)');
assert.equal(seventhAttempt.ok,false);
assert.equal(seventhAttempt.reason,'formation-too-large');
assert.equal(seventhAttempt.projected,557);
assert.equal(run('S.steamMilitaryStars'),6);

const rows=[];
for(const checkpoint of checkpoints){
  if(!checkpoint.raw)continue;
  for(let seed=1;seed<=16;seed++){
    const beast=load(checkpoint.raw,seed),beastResult=battle(beast.run,'starBeast2');
    checkReload(beast.env,beast.run);
    const trial=load(checkpoint.raw,seed),steps=[];
    for(let i=0;i<2;i++){
      const fruit=battle(trial.run,'trialFruit');
      steps.push(fruit);
      if(!fruit.opened||fruit.result!=='win')break;
    }
    let trialResult=null;
    if(steps.length===2&&steps.every(x=>x.result==='win')){
      const before=state(trial.run),open=trial.run("openAwakeningTrial('easy')");
      assert.equal(open.ok,true,JSON.stringify(open));
      const settled=settledBattle(trial.run);
      trial.run('exitBattle()');
      trialResult={before,cost:open.cost,...settled};
    }
    checkReload(trial.env,trial.run);
    rows.push({stars:checkpoint.stars,seed,beast:beastResult,
      fruit:steps.map(x=>({result:x.result,loss:x.before.army-x.after.army,gain:x.after.fruit-x.before.fruit})),
      trial:trialResult});
  }
}

// One-day reset after the P390 first win, now with genuinely paid replenishment.
probeNow=NativeDate.UTC(2026,9,1,12,0,0);
const day2=[];
for(let seed=1;seed<=16;seed++){
  const {env,run:dayRun}=load(checkpoints[0].raw,seed);
  assert.equal(dayRun("dailyCount('starBeast1')"),0);
  const first=battle(dayRun,'starBeast1');
  checkReload(env,dayRun);
  dayRun("openMaterialDomain('starBeast1')");
  const retryOpened=dayRun('S.battleActive');
  assert.equal(retryOpened,first.result!=='win');
  day2.push({seed,first,retryOpened});
}

const result={batch:'P391',source,sourceSha256:sha(raw),
  runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  initial,scienceCost,fillSeconds,minFood,beforeScience,payment,
  checkpoints:checkpoints.map(c=>({stars:c.stars,step:c.step,blocked:c.blocked,state:c.state,
    saveSha256:c.raw?sha(c.raw):null})),rows,day2,
  seventhAttempt,
  sixStarSave:sixStar?{file:'p391-steam-military-six-star-paid-save.json',sha256:sha(sixStar.raw)}:null,
  scope:'Real setPopAlloc/tick/researchScience/steamMilitaryStarStep and real daily/timed battle actions, full save/load; fixed seeds 1–16. No inventory, stats, enemy or configuration injection. Each star count is legally paid once on one sequential path; independent combat VMs start from that paid checkpoint.'};
const output='p391-steam-military-paid-sensitivity.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(result,null,2)+'\n');
const compact=checkpoints.filter(c=>c.raw).map(c=>{
  const subset=rows.filter(x=>x.stars===c.stars);
  return{stars:c.stars,field:c.state.military.field,multiplier:c.state.military.multiplier,
    beast2Wins:subset.filter(x=>x.beast.result==='win').length,
    fruitTwoWins:subset.filter(x=>x.fruit.length===2&&x.fruit.every(y=>y.result==='win')).length,
    trial7Wins:subset.filter(x=>x.trial?.result==='win').length,
    beast2EnemyHpLeft:subset.map(x=>x.beast.enemyHpLeft),
    trial7EnemyHpLeft:subset.map(x=>x.trial?.enemyHpLeft)};
});
console.log(JSON.stringify({scienceCost,fillSeconds,techBefore:beforeScience.tech,
  techAfter:checkpoints[0].state.tech,minFood,compact,
  day2:{tier1Wins:day2.filter(x=>x.first.result==='win').length,
    tier1Losses:day2.map(x=>x.first.before.army-x.first.after.army)},output},null,2));
