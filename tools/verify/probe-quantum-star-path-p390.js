'use strict';
// P390: real-action, reloadable continuation from the immutable P386 paid save.
// This deliberately stops at the first unpaid bottleneck; no inventory, awakening,
// enemy or capacity state is injected into the paid path.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const NativeDate=Date,probeNow=NativeDate.UTC(2026,8,30,12,0,0);
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[probeNow]))}
  static now(){return probeNow}
};

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const source=path.join(dataDir,'p386-300m-paid-save.json');
const sourceRaw=fs.readFileSync(source,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(sourceRaw),'7f27ca4a53ba412e187ec72aeaaf6349f1bba00185ae422ac959dac8e557f5cf');
const env=environment({rts_save:sourceRaw}),run=env.run;
assert.equal(run('loadSaveAndApply()').status,'migrated');
assert.equal(env.store.get('rts_save_premigration'),sourceRaw,'v32 raw save was not independently protected');
run(`globalThis.__rng=123456789;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};`);

function snapshot(){return run(`({v:targetSaveVersion(),tick:S.tick,tech:S.res.tech,
  techCap:resCap('tech'),techRate:prodRate('tech'),food:S.res.food,medal:S.res.medal,
  beastScience:scienceUnlocked('sci_star_beast_domain'),
  arrayScience:scienceUnlocked('sci_star_array'),
  quantumScience:scienceUnlocked('sci_quantum_age'),
  awakening:{level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars},
  knowledgePercent:starArrayKnowledgePercent(),
  starItems:{starOriginStone:S.items.starOriginStone,illusionStone:S.items.illusionStone,
    sacredRingCore:S.items.sacredRingCore},beastAlert:S.killValues.starBeast,
  dailyBeast1:dailyCount('starBeast1'),army:armyCount(),deployed:formSoldierCount(),
  steamKnowledge:S.eraStorage.steamKnowledge,scrolls:S.beastExchange.scrollUsed})`)}
function reloadCheck(){
  assert.equal(run('save().ok'),true);
  const raw=env.store.get('rts_save');
  const other=environment({rts_save:raw});
  assert.equal(other.run('loadSaveAndApply()').status,'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(other.run(`({tech:S.res.tech,cap:resCap('tech'),
    medal:S.res.medal,beast:scienceUnlocked('sci_star_beast_domain'),
    array:scienceUnlocked('sci_star_array'),alert:S.killValues.starBeast,
    origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore,
    daily:dailyCount('starBeast1')})`))),
    JSON.parse(JSON.stringify(run(`({tech:S.res.tech,cap:resCap('tech'),
    medal:S.res.medal,beast:scienceUnlocked('sci_star_beast_domain'),
    array:scienceUnlocked('sci_star_array'),alert:S.killValues.starBeast,
    origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore,
    daily:dailyCount('starBeast1')})`))));
  return {sha256:sha(raw),raw};
}

const checkpoints=[];
checkpoints.push({name:'p386_migrated',state:snapshot(),sha256:reloadCheck().sha256});
const beastCost=run("activeSciences().sci_star_beast_domain.cost");
const beastResearch=run("researchScience('sci_star_beast_domain')");
assert.equal(beastResearch.ok,true,JSON.stringify(beastResearch));
checkpoints.push({name:'beast_science_paid',cost:beastCost,state:snapshot(),sha256:reloadCheck().sha256});
const prematureArray=run("researchScience('sci_star_array')");
assert.equal(prematureArray.ok,false);
assert.equal(prematureArray.reason,'insufficient-tech');
const beforeFill=snapshot();
let fillSeconds=0;
while(run('S.res.tech')<300000000&&fillSeconds<30000){run('tick()');fillSeconds++}
assert.ok(fillSeconds<30000,'knowledge did not refill within 30000 online seconds');
assert.ok(run('S.res.food')>0,'food depleted during knowledge refill');
checkpoints.push({name:'array_science_funded',state:snapshot(),sha256:reloadCheck().sha256});
const arrayCost=run("activeSciences().sci_star_array.cost");
const arrayResearch=run("researchScience('sci_star_array')");
assert.equal(arrayResearch.ok,true,JSON.stringify(arrayResearch));
const afterArray=snapshot();
assert.equal(afterArray.knowledgePercent,0,'awakening gate must still disable array multiplier');
checkpoints.push({name:'array_science_paid',cost:arrayCost,state:afterArray,sha256:reloadCheck().sha256});

// Full real battle, deterministic seed fixed in advance from the P389 1–16 sweep.
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
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __rng=x>>>0;return __rng/4294967296};`);
run("openMaterialDomain('starBeast1')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<8000){assert.equal(run('__step()'),true);callbacks++}
assert.ok(callbacks<8000);
const battleResult=run("document.getElementById('battle-result').className");
const afterBattle=snapshot();
assert.equal(battleResult,'win','preselected P389 seed 1 no longer wins from this paid continuation');
assert.deepEqual(JSON.parse(JSON.stringify(afterBattle.starItems)),
  {starOriginStone:10,illusionStone:10,sacredRingCore:10});
const firstOpenCost=run("starArraySlotCost('open',0)");
const firstOpenAttempt=run('openStarArraySlot(0)');
assert.equal(firstOpenAttempt.ok,false);
assert.equal(firstOpenAttempt.reason,'insufficient-items');
checkpoints.push({name:'first_beast_paid_win',state:afterBattle,battle:{result:battleResult,callbacks},
  firstOpenCost,firstOpenAttempt:{ok:firstOpenAttempt.ok,reason:firstOpenAttempt.reason},
  sha256:reloadCheck().sha256});

const quantumAttempt=run("researchScience('sci_quantum_age')");
assert.equal(quantumAttempt.ok,false);
const finalRaw=env.store.get('rts_save');
const post=environment({rts_save:finalRaw});
assert.equal(post.run('loadSaveAndApply()').status,'ok');
const awakeningAttempt=post.run("openAwakeningTrial('easy')");
assert.equal(awakeningAttempt.ok,false);
assert.equal(awakeningAttempt.reason,'insufficient-items');
const finalPath=path.join(dataDir,'p390-star-array-entry-paid-save.json');
fs.writeFileSync(finalPath,finalRaw);
// Deliberately conditional arithmetic: keep the paid warehouse, scroll count and
// storage technologies fixed, then ask what a future 20-rank / 50-star array
// would need. These edits are made in a separate VM and never saved as paid state.
const conditional=environment({rts_save:finalRaw});
assert.equal(conditional.run('loadSaveAndApply()').status,'ok');
const baseBeforeScroll=conditional.run("S.beastExchange.scrollUsed=0;resCap('tech')");
const scrollMult=1+afterBattle.scrolls*0.01;
const capacityForPercent=p=>Math.floor(Math.floor(baseBeforeScroll*(1+p/100))*scrollMult);
let requiredPercent=0;
while(capacityForPercent(requiredPercent)<3000000000)requiredPercent++;
const weights=Array.from({length:20},(_,i)=>4+2*Math.floor(i/3));
let requiredRaw=0;
while(Math.floor(requiredRaw*0.6)<requiredPercent)requiredRaw++;
const maxRawForSlots=n=>weights.slice(0,n).reduce((v,w)=>v+10*w,0);
const minSlots=Array.from({length:20},(_,i)=>i+1).find(n=>maxRawForSlots(n)>=requiredRaw);
assert.ok(minSlots,'even all 20 slots cannot cross the fixed-cap target');
function minOriginUpgradeCost(n,targetRaw){
  // DP over legal levels 1..10 for the first n consecutive open/attuned slots.
  let states=new Map([[0,{cost:0,levels:[]}]]);
  for(let i=0;i<n;i++){
    const next=new Map();
    for(const [raw,prior] of states)for(let level=1;level<=10;level++){
      const gain=weights[i]*level,originCost=10*(i+1)*level*(level-1);
      const key=raw+gain,cost=prior.cost+originCost;
      if(!next.has(key)||cost<next.get(key).cost)
        next.set(key,{cost,levels:[...prior.levels,level]});
    }
    states=next;
  }
  return [...states].filter(([raw])=>raw>=targetRaw)
    .map(([raw,v])=>({raw,...v})).sort((a,b)=>a.cost-b.cost||a.raw-b.raw)[0];
}
const optimal=minOriginUpgradeCost(minSlots,requiredRaw);
const runtimeConditionalCap=conditional.run(`S.beastExchange.scrollUsed=${afterBattle.scrolls};
  S.awakening.star_trooper.level=20;S.awakening.star_trooper.stars=50;
  ${JSON.stringify(optimal.levels)}.forEach((level,i)=>{const slot=S.starArray.star_trooper.slots[i];
    slot.open=true;slot.type='knowledgeCap';slot.level=level;slot.refreshCount=1});
  resCap('tech')`);
assert.equal(runtimeConditionalCap,capacityForPercent(Math.floor(optimal.raw*0.6)));
const materialCosts={sacredRingCore:1000*minSlots*(minSlots+1)/2,
  illusionStone:100*minSlots*(minSlots+1)/2,
  starOriginStone:optimal.cost};
const baseRewardPerDay=run('CFG.starBeast.tiers.reduce((n,t)=>n+t.reward,0)');
const maxAlertGainPerDay=run('CFG.starBeast.tiers.reduce((n,t)=>n+t.alert,0)');
let optimisticDays=0,optimisticCore=0,optimisticCorePreviousDay=0;
while(optimisticCore<materialCosts.sacredRingCore){
  optimisticCorePreviousDay=optimisticCore;
  optimisticDays++;
  // Unrealistically grant every tier each day the *end-of-day* alert multiplier.
  // This upper-bounds rewards without requiring a presumed combat win rate.
  const maxAlert=maxAlertGainPerDay*optimisticDays;
  const step=Math.floor(maxAlert/1000);
  optimisticCore+=run('CFG.starBeast.tiers').reduce((n,t)=>n+Math.floor(t.reward*(1+0.2*step)),0);
}
const starRequirement={scope:'Conditional with P390 paid warehouse, technologies and 130 scrolls frozen. Separately assume future paid awakening 20/50; levels/materials are optimized in arithmetic only and are not in the paid save.',
  baseBeforeScroll,scrollMult,requiredPercent,requiredRaw,minSlots,
  maximumAt16Slots:{raw:maxRawForSlots(16),percent:Math.floor(maxRawForSlots(16)*0.6),
    capacity:capacityForPercent(Math.floor(maxRawForSlots(16)*0.6))},
  optimized17Slots:{raw:optimal.raw,levels:optimal.levels,
    percent:Math.floor(optimal.raw*0.6),capacity:capacityForPercent(Math.floor(optimal.raw*0.6)),
    runtimeConditionalCap,materialCosts},
  materialSources:{baseRewardPerDay,maxAlertGainPerDay,
    zeroAlertAllNineDays:Math.ceil(materialCosts.sacredRingCore/baseRewardPerDay),
    strictOptimisticDayLowerBound:optimisticDays,
    optimisticCorePreviousDay,optimisticCoreAtBoundDay:optimisticCore,
    lowerBoundMethod:'All 9 tiers somehow win daily; each receives the maximum possible end-of-day alert multiplier, with no calming or combat failure. Real reachable time can only be later.'},
  awakening:{currentLevel:afterBattle.awakening.level,currentStars:afterBattle.awakening.stars,
    nextTrialAttempt:{ok:awakeningAttempt.ok,reason:awakeningAttempt.reason,cost:awakeningAttempt.cost},
    simpleTrialRemainingRanks:14,simpleTrialFutureStars:43,
    fruitMinimumIfFirstGroupOne:Array.from({length:14},(_,i)=>10*(i+6)+1).reduce((a,b)=>a+b,0),
    fruitIfCurrentFirstGroup55:Array.from({length:14},(_,i)=>10*(i+6)+55).reduce((a,b)=>a+b,0),
    currentFruit:run('S.items.trialFruit')}};
assert.equal(starRequirement.awakening.currentStars+starRequirement.awakening.simpleTrialFutureStars,50);
const ledger={batch:'P390',source:{file:path.relative(root,source),sha256:sha(sourceRaw)},
  fixedClockUtc:new Date(probeNow).toISOString(),
  migration:{from:32,to:33,preMigrationRawProtected:true},
  runtimeFiles:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(file=>
    [file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  checkpoints,fill:{seconds:fillSeconds,techRateAtStart:beforeFill.techRate,
    techBefore:beforeFill.tech,techAfter:checkpoints[2].state.tech,
    foodBefore:beforeFill.food,foodAfter:checkpoints[2].state.food},
  quantumAttempt:{ok:quantumAttempt.ok,reason:quantumAttempt.reason,
    cost:run("activeSciences().sci_quantum_age.cost"),
    medalDeficit:Math.max(0,3000000-afterBattle.medal)},
  starRequirement,
  finalSave:{file:path.relative(root,finalPath),sha256:sha(finalRaw)},
  scope:'Same paid P386 source, actual researchScience/tick/openMaterialDomain/endBattle and reloads. Seed 1 chosen from prior published fixed sweep; existence evidence only, not win rate. No inventory, science, awakening, capacity or battle config injection.'};
fs.writeFileSync(path.join(dataDir,'p390-star-array-entry-paid-ledger.json'),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({fill:ledger.fill,battle:checkpoints.at(-1).battle,
  final:afterBattle,firstOpenCost,firstOpenAttempt:ledger.checkpoints.at(-1).firstOpenAttempt,
  quantumAttempt:ledger.quantumAttempt,starRequirement,
  finalSha256:ledger.finalSave.sha256},null,2));
