'use strict';
// P391: real-action pressure from the immutable P390 paid save. No state injection.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'docs/codex/reports/data');
const source = path.join(dataDir, 'p390-star-array-entry-paid-save.json');
const raw = fs.readFileSync(source, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(sha(raw), 'aa54851f4e4a12848f56cb4b98ccd0eb52e2c62a4fdc066325f037a0ba37c25a');
const NativeDate = Date;
let probeNow = NativeDate.UTC(2026, 8, 30, 12, 0, 0);
global.Date = class ProbeDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [probeNow])); }
  static now() { return probeNow; }
};

function setup(seed) {
  const env = environment({rts_save: raw});
  const run = env.run;
  const status=run('loadSaveAndApply().status');
  assert.ok(['ok','migrated'].includes(status),status);
  if(status==='migrated')assert.equal(env.store.get('rts_save_premigration'),raw);
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
  return {env, run};
}

function state(run) {
  return run(`({army:armyCount(),deployed:formSoldierCount(),starTroopers:expeditionCount('star_trooper'),
    fruit:S.items.trialFruit,medal:S.res.medal,food:S.res.food,steel:S.res.steel,
    starItems:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore},
    awakening:{level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars},
    silenceAlert:S.killValues.godSilence,beastAlert:S.killValues.starBeast,
    beastDaily:CFG.starBeast.tiers.map(t=>dailyCount('starBeast'+t.tier)),
    formation:Object.fromEntries(['front','mid','back'].map(row=>[row,S.formation[row].map(u=>({type:u.type,count:u.count}))]))})`);
}

function reloadCheck(env, run) {
  assert.equal(run('save().ok'), true);
  const saved = env.store.get('rts_save');
  const restored = environment({rts_save:saved});
  assert.equal(restored.run('loadSaveAndApply().status'), 'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(state(restored.run))), JSON.parse(JSON.stringify(state(run))));
  return sha(saved);
}

function battle(run, key) {
  const before = state(run);
  const encounter = run(`materialDomainEncounter(${JSON.stringify(key)})`);
  run(`openMaterialDomain(${JSON.stringify(key)})`);
  if (!run('S.battleActive')) return {key, before, encounter, opened:false};
  let callbacks = 0;
  while (run('S.battleActive') && callbacks < 8000) {
    assert.equal(run('__step()'), true, 'battle timer exhausted');
    callbacks++;
  }
  assert.ok(callbacks < 8000, 'battle callback limit');
  const result = run("document.getElementById('battle-result').className");
  const enemyHpLeft = run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const after = state(run);
  run('exitBattle()');
  return {key, before, encounter:{units:encounter.units, attackMass:encounter.attackMass,
    starBeastAtk:encounter.starBeastAtk, starBeastDef:encounter.starBeastDef,
    reward:encounter.reward, killValue:encounter.killValue, nextKillValue:encounter.nextKillValue},
    opened:true, callbacks, result, enemyHpLeft, after};
}

const baseline = setup(1);
const initial = state(baseline.run);
const firstFruitCost = baseline.run('awakeningTrialCost()');
const firstFruitReward = baseline.run("materialDomainEncounter('trialFruit').reward.trialFruit");
const firstFruitAttempt = baseline.run("openAwakeningTrial('easy')");
assert.equal(firstFruitAttempt.reason, 'insufficient-items');
const independent = [];
for (const key of ['trialFruit', ...CFGKeys()]) {
  for (let seed=1; seed<=16; seed++) {
    const {env,run} = setup(seed);
    const row = {seed, ...battle(run,key)};
    row.saveSha256 = reloadCheck(env, run);
    independent.push(row);
  }
}
function CFGKeys() { return Array.from({length:8}, (_,i)=>'starBeast'+(i+2)); }

// One continuous paid path with only actual victories. Stop at first defeat.
const continuous = [];
for (let seed=1; seed<=16; seed++) {
  const {env,run} = setup(seed);
  const steps=[];
  for (let i=0; i<4; i++) {
    const cost=run('awakeningTrialCost()');
    if (run('S.items.trialFruit')>=cost) {
      const payment=run("openAwakeningTrial('easy')");
      if (!payment.ok) {steps.push({type:'trial-rejected',payment});break;}
      // openAwakeningTrial itself opens the paid battle.
      let callbacks=0;
      while (run('S.battleActive')&&callbacks<8000) {assert.equal(run('__step()'),true);callbacks++;}
      assert.ok(callbacks<8000);
      const result=run("document.getElementById('battle-result').className");
      steps.push({type:'trial',cost:payment.cost,result,callbacks,after:state(run),
        enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')});
      run('exitBattle()');
      reloadCheck(env,run);
      break;
    }
    const step=battle(run,'trialFruit');
    steps.push(step);
    reloadCheck(env,run);
    if (!step.opened||step.result!=='win') break;
  }
  continuous.push({seed,steps});
}

// The source has already beaten tier 1 today. Cross exactly one local day,
// then try genuine tier-1 battles from the still-depleted P390 roster.
probeNow = NativeDate.UTC(2026, 9, 1, 12, 0, 0);
const day2Rows=[];
for (let seed=1; seed<=16; seed++) {
  const {env,run}=setup(seed);
  const before=state(run);
  assert.equal(before.beastDaily[0],0);
  const result=battle(run,'starBeast1');
  assert.equal(result.opened,true);
  const afterBattleSha256=reloadCheck(env,run);
  run("openMaterialDomain('starBeast1')");
  const retryOpened=run('S.battleActive');
  assert.equal(retryOpened,result.result!=='win');
  day2Rows.push({seed,before,result,afterBattleSha256,retryOpened});
}
const day2={date:new Date(probeNow).toISOString(),rows:day2Rows};

const summary={batch:'P391',source:path.relative(root,source),sourceSha256:sha(raw),
  runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  firstClockUtc:'2026-09-30T12:00:00.000Z',initial,firstFruitCost,firstFruitReward,
  firstFruitAttempt,independent,continuous,day2,
  scope:'P390 paid save; actual openMaterialDomain/openAwakeningTrial, timers, endBattle, exitBattle, save/load. Fixed RNG seeds 1–16. No inventory, formation, enemy, tech or config injection; independent battles reset from source, continuous fruit/trial path does not.'};
const output=path.join(dataDir,'p391-late-paid-path-pressure.json');
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({initial,firstFruitCost,firstFruitReward,
  independent:Object.fromEntries(['trialFruit',...CFGKeys()].map(key=>{
    const rows=independent.filter(r=>r.key===key);
    return[key,{wins:rows.filter(r=>r.result==='win').length,starts:rows.length,
      first:rows[0].encounter,losses:rows.map(r=>r.before.army-r.after.army),
      enemyHpLeft:rows.map(r=>r.enemyHpLeft)}]})),
  continuous:continuous.map(r=>({seed:r.seed,steps:r.steps.map(s=>({type:s.type||s.key,
    result:s.result,opened:s.opened,fruit:s.after?.fruit,level:s.after?.awakening?.level,
    army:s.after?.army,enemyHpLeft:s.enemyHpLeft}))})),
  day2:{date:day2.date,wins:day2Rows.filter(r=>r.result.result==='win').length,
    rows:day2Rows.map(r=>({seed:r.seed,result:r.result.result,
      armyBefore:r.before.army,armyAfter:r.result.after.army,
      itemsAfter:r.result.after.starItems,dailyAfter:r.result.after.beastDaily[0],
      retryOpened:r.retryOpened}))},
  output:path.relative(root,output)},null,2));
