'use strict';
// P389: the shipped star-beast battle path with the immutable P386 paid save.
// Each fixed seed starts from a fresh VM; losses are observations, not a paid continuation.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const source=path.join(root,'docs/codex/reports/data/p386-300m-paid-save.json');
const raw=fs.readFileSync(source,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'7f27ca4a53ba412e187ec72aeaaf6349f1bba00185ae422ac959dac8e557f5cf',
  'P386 paid source save changed');

function fight(seed,scenario){
  const env=environment({rts_save:raw}),run=env.run;
  const load=run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(load.status),`save load: ${load.status}`);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  const before=run(`({tech:S.res.tech,medal:S.res.medal,army:armyCount(),
    deployed:formSoldierCount(),awakening:{...S.awakening.star_trooper},
    starMaterials:{starOriginStone:S.items.starOriginStone,
      illusionStone:S.items.illusionStone,sacredRingCore:S.items.sacredRingCore},
    alert:S.killValues.starBeast})`);
  const cost=run("activeSciences().sci_star_beast_domain.cost");
  const research=run("researchScience('sci_star_beast_domain')");
  assert.equal(research?.ok,true,`paid research rejected: ${research?.reason}`);
  assert.equal(run('S.res.tech'),before.tech-cost.tech);
  assert.equal(run('S.res.medal'),before.medal-cost.medal);
  assert.equal(run("scienceUnlocked('sci_star_beast_domain')"),true);
  if(scenario.awakening){
    // Sensitivity only: no source payment for awakening ranks/stars is claimed.
    run(`S.awakening.star_trooper.level=${scenario.awakening[0]};S.awakening.star_trooper.stars=${scenario.awakening[1]}`);
  }
  if(scenario.hpDivisor){
    // Sensitivity only: this overrides encounter scaling in the isolated VM.
    run(`CFG.starBeast.hpDivisor=${scenario.hpDivisor}`);
  }
  run("openMaterialDomain('starBeast1')");
  assert.equal(run('S.battleActive'),true,'first star beast did not open');
  if('falls' in scenario){
    // Sensitivity only: override whether aggregate HP reduces the six active queues.
    run(`B.enemyUnits[0].attackMassFallsWithHp=${scenario.falls}`);
  }
  const encounter=run(`({name:B.enemyCfg.name,killValue:B.enemyCfg.killValue,
    nextKillValue:B.enemyCfg.nextKillValue,hp:B.enemyUnits[0].hp,
    atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,
    attackMass:B.enemyUnits[0].attackMass,
    attackMassFallsWithHp:B.enemyUnits[0].attackMassFallsWithHp,
    reward:B.enemyCfg.reward})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<8000){
    assert.equal(run('__step()'),true,'battle callback missing');callbacks++;
  }
  assert.ok(callbacks<8000,'battle exceeded 8000 callbacks');
  const after=run(`({round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    deployed:formSoldierCount(),army:armyCount(),
    allyHp:B.ourUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    alert:S.killValues.starBeast,daily:dailyCount('starBeast1'),
    starMaterials:{starOriginStone:S.items.starOriginStone,
      illusionStone:S.items.illusionStone,sacredRingCore:S.items.sacredRingCore},
    result:document.getElementById('battle-result').className})`);
  const won=after.result==='win';
  if(won){
    assert.equal(after.daily,1);assert.equal(after.alert,encounter.nextKillValue);
    for(const [key,amount] of Object.entries(encounter.reward))
      assert.equal(after.starMaterials[key],before.starMaterials[key]+amount);
  }else{
    assert.equal(after.daily,0);assert.equal(after.alert,before.alert);
    assert.deepEqual(JSON.parse(JSON.stringify(after.starMaterials)),
      JSON.parse(JSON.stringify(before.starMaterials)));
  }
  const saved=JSON.parse(env.store.get('rts_save'));
  assert.equal(saved.v,33);
  assert.equal(saved.killValues.starBeast,after.alert);
  assert.equal(saved.daily.counts.starBeast1||0,after.daily);
  for(const itemKey of ['starOriginStone','illusionStone','sacredRingCore'])
    assert.equal(saved.items[itemKey],after.starMaterials[itemKey]);
  if(scenario.name==='paid_6_7'){
    const reload=environment({rts_save:env.store.get('rts_save')});
    const reloadStatus=reload.run('loadSaveAndApply()');
    assert.equal(reloadStatus.status,'ok',JSON.stringify(reloadStatus));
    assert.equal(reload.run('S.killValues.starBeast'),after.alert);
    assert.equal(reload.run("dailyCount('starBeast1')"),after.daily);
    assert.equal(reload.run('S.items.starOriginStone'),after.starMaterials.starOriginStone);
  }
  return{scenario:scenario.name,seed,loadStatus:load.status,paidResearch:{cost,techAfter:before.tech-cost.tech,
      medalAfter:before.medal-cost.medal},
    before,encounter,won,callbacks,after,
    casualties:before.deployed-after.deployed};
}

const seeds=Array.from({length:16},(_,i)=>i+1);
const scenarios=[
  {name:'paid_6_7'},
  {name:'synthetic_20_50',awakening:[20,50]},
  {name:'synthetic_6_7_hp225k',hpDivisor:160},
  {name:'synthetic_20_50_hp225k',awakening:[20,50],hpDivisor:160},
  {name:'synthetic_6_7_hp200k',hpDivisor:180},
  {name:'synthetic_20_50_hp200k',awakening:[20,50],hpDivisor:180}
];
const rows=scenarios.flatMap(scenario=>seeds.map(seed=>fight(seed,scenario)));
const summary=Object.fromEntries(scenarios.map(scenario=>{
  const set=rows.filter(r=>r.scenario===scenario.name),wins=set.filter(r=>r.won),losses=set.filter(r=>!r.won);
  return[scenario.name,{wins:wins.length,losses:losses.length,seeds:seeds.length,
    hp:set[0].encounter.hp,
    casualtiesMin:Math.min(...set.map(r=>r.casualties)),
    casualtiesMax:Math.max(...set.map(r=>r.casualties)),
    enemyHpOnLossMin:losses.length?Math.min(...losses.map(r=>r.after.enemyHp)):null,
    enemyHpOnLossMax:losses.length?Math.max(...losses.map(r=>r.after.enemyHp)):null}];
}));
const result={batch:'P389',source:{file:path.relative(root,source),sha256:sha(raw),saveVersion:JSON.parse(raw).v},
  runtimeFiles:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(file=>
    [file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  seedPolicy:'Fresh P386 paid v32 save for every fixed seed 1–16. Every run pays sci_star_beast_domain through researchScience. Only paid_6_7 leaves awakening and battle configuration untouched. Synthetic cases directly set awakening rank/star or beast HP divisor without paying for those changes.',
  entry:{researchCost:rows[0].paidResearch.cost,techAfterResearch:rows[0].paidResearch.techAfter,
    medalAfterResearch:rows[0].paidResearch.medalAfter,army:rows[0].before.army,
    deployed:rows[0].before.deployed,awakening:rows[0].before.awakening,
    startingAlert:rows[0].before.alert,startingMaterials:rows[0].before.starMaterials},
  summary,rows:rows.map(r=>({scenario:r.scenario,seed:r.seed,won:r.won,
    hp:r.encounter.hp,attackMass:r.encounter.attackMass,
    attackMassFallsWithHp:r.encounter.attackMassFallsWithHp,
    callbacks:r.callbacks,round:r.after.round,casualties:r.casualties,
    enemyHp:r.after.enemyHp,alert:r.after.alert,daily:r.after.daily,
    materials:r.after.starMaterials}))};
console.log(JSON.stringify(result,null,2));
