'use strict';
// P385: one continuous, legally paid material loop. No edits to a player save.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const data = path.join(root, 'docs/codex/reports/data');
const sourceFile = 'p379-unselected-battle-recovered-save.json';
const sourceRaw = fs.readFileSync(path.join(data, sourceFile), 'utf8');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha(sourceRaw), '9914b6fbd6dd79277661a6bba68a61a7f4642acc9d7033535da3b993d41daf4f');
const source = JSON.parse(sourceRaw);
const target = source.formation;
const targetByType = {};
for (const groups of Object.values(target)) for (const unit of groups)
  targetByType[unit.type] = (targetByType[unit.type] || 0) + unit.count;
assert.equal(Object.values(targetByType).reduce((a, b) => a + b, 0), 626);

function boot(raw, seed = 1) {
  const world = environment({rts_save: raw});
  assert.ok(['ok', 'migrated'].includes(world.run('loadSaveAndApply().status')));
  const initialTick = world.run('S.tick');
  const start = JSON.parse(raw).ts;
  world.run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
      static now(){return ${start}+(S.tick-${initialTick})*1000}};
    globalThis.__timers=new Map();globalThis.__timerId=1;
    globalThis.setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;
      __timers.delete(entry[0]);entry[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};
    globalThis.__trainingPaid={};globalThis.__trainedCount=0;
    const __payP385=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payP385(cost,n);
      for(const key of trainingCostKeys(cost)){
        const paid=before[key]-S.res[key],expected=cost[key]*n;
        if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
        __trainingPaid[key]=(__trainingPaid[key]||0)+paid;
      }
      __trainedCount+=n;return result;
    };`);
  return world;
}

const world = boot(sourceRaw);
const {run} = world;
function state() {return run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),
  resources:Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','tech']
    .map(k=>[k,S.res[k]])),
  crystal:S.items.godCrystal,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
  crystalAlert:S.killValues.godRevival,phantomAlert:S.killValues.godPhantom,
  medal:S.res.medal,marketCycles:S.marketSpecial.cycles})`)}
function checkpoint(file) {
  assert.equal(run('save().ok'), true);
  const raw = world.store.get('rts_save');
  fs.writeFileSync(path.join(data, file), raw);
  const reloaded = boot(raw);
  assert.equal(JSON.stringify(state()), JSON.stringify(reloaded.run(`({tick:S.tick,army:armyCount(),
    deployed:formSoldierCount(),queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),
    resources:Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','tech']
      .map(k=>[k,S.res[k]])),crystal:S.items.godCrystal,blood:S.items.sacredBlood,
    cleanser:S.items.domainCleanser,crystalAlert:S.killValues.godRevival,
    phantomAlert:S.killValues.godPhantom,medal:S.res.medal,marketCycles:S.marketSpecial.cycles})`)),
    '保存后重载关键状态不一致');
  return {file, sha256: sha(raw)};
}
function fight(domain) {
  const before = state();
  run(`openMaterialDomain('${domain}')`);
  assert.equal(run('S.battleActive'), true, domain + ' did not start');
  const enemy = run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks = 0;
  while (run('S.battleActive') && callbacks < 3000) {
    assert.equal(run('__step()'), true, domain + ' timer missing');
    callbacks++;
  }
  assert.ok(callbacks < 3000, domain + ' battle did not settle');
  const result = run("document.getElementById('battle-result').className");
  assert.ok(['win', 'lose'].includes(result));
  const after = state();
  assert.equal(after.tick, before.tick, 'battle animation advanced production');
  run('exitBattle()');
  return {domain, before, result, after, enemy, callbacks,
    loss: before.army - after.army,
    bloodGain: after.blood - before.blood,
    crystalGain: after.crystal - before.crystal};
}
function advance(seconds) {run(`for(let i=0;i<${seconds};i++)tick()`)}

const initial = state();
assert.equal(initial.crystalAlert, 5500);
assert.equal(initial.phantomAlert, 300);
assert.equal(initial.blood, 12);
assert.equal(initial.cleanser, 0);
assert.equal(initial.army, 672);
assert.equal(initial.deployed, 626);
const phantom = [];
for (let i = 0; i < 6; i++) {
  const result = fight('phantomFlower');
  assert.equal(result.result, 'win', 'phantom feeder failed in fixed stream');
  phantom.push(result);
}
assert.equal(state().blood, 18);
assert.equal(state().army, 672);
const afterPhantom = checkpoint('p385-after-phantom-save.json');

// Exchange six cleansers through the actual market action and pay 18 blood.
const beforeExchange = state();
const exchange = run('exchangeDomainCleanser(6)');
assert.equal(exchange?.ok, true, 'market exchange failed');
assert.equal(state().blood, beforeExchange.blood - 18);
assert.equal(state().cleanser, beforeExchange.cleanser + 6);
const afterExchange = checkpoint('p385-after-exchange-save.json');
const purify = [];
for (let i = 0; i < 6; i++) {
  const before = state();
  const result = run("useDomainCleanser('godCrystal')");
  assert.equal(result?.ok, true, 'cleanser action failed at ' + i);
  const after = state();
  assert.equal(after.cleanser, before.cleanser - 1);
  assert.equal(after.crystalAlert, before.crystalAlert - 100);
  purify.push({before: before.crystalAlert, after: after.crystalAlert});
  advance(6); // Existing action has a five-second duplicate-operation window.
}
assert.equal(state().crystalAlert, 4900);
const beforeCrystal = checkpoint('p385-before-crystal-save.json');
const crystal1 = fight('godCrystal');
assert.equal(crystal1.result, 'win', 'paid first crystal battle failed');
assert.equal(crystal1.crystalGain, 58);
assert.equal(crystal1.bloodGain, 3);
const afterCrystal1 = checkpoint('p385-after-crystal1-save.json');

// The same training and production actions used by the live game restore the roster.
const phases = {food: 0, wood: 0, stone: 0, coal: 0, copper: 0, iron: 0,
  steel: 0, gold: 0, tech: 0, training: 0};
let phase = 'training', onlineSeconds = 36, minFood = state().resources.food,
  minCoal = state().resources.coal, minSteel = state().resources.steel;
const value = key => run(`S.res.${key}`);
const cap = key => run(`resCap('${key}')`);
function assign(resource) {
  for (const [key, n] of Object.entries(run('({...S.popAlloc})'))) if (n > 0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok, true, key + ' allocation clear');
  if (resource === 'food') {
    assert.equal(run("setPopAlloc('food',999)")?.ok, true);
    assert.equal(run("setPopAlloc('wood',3)")?.ok, true);
  } else {
    assert.equal(run("setPopAlloc('food',100)")?.ok, true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok, true);
  }
  assert.equal(run('popAllocTotal()'), 1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost") > 0,
    'net food must be positive');
  phase = resource;
}
function advanceUntil(expression, max, stop = 'false') {
  const out = run(`(()=>{let n=0,mf=S.res.food,mc=S.res.coal,ms=S.res.steel;
    while(!(${expression})&&!(${stop})&&n<${max}){
      tick();n++;mf=Math.min(mf,S.res.food);mc=Math.min(mc,S.res.coal);ms=Math.min(ms,S.res.steel)}
    return{n,done:!!(${expression}),stopped:!!(${stop}),minFood:mf,minCoal:mc,minSteel:ms}})()`);
  onlineSeconds += out.n;
  phases[phase] += out.n;
  minFood = Math.min(minFood, out.minFood);
  minCoal = Math.min(minCoal, out.minCoal);
  minSteel = Math.min(minSteel, out.minSteel);
  assert.ok(minFood > 0, 'food depleted during recovery');
  return out;
}
function fillBasic(resource, needed) {
  if (value(resource) >= needed) return;
  assert.ok(needed <= cap(resource), resource + ' cost exceeds cap');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${needed}`, 20000).done,
    resource + ' collection did not complete');
}
function fillProcessed(resource, needed) {
  if (value(resource) >= needed) return;
  assert.ok(needed <= cap(resource), resource + ' cost exceeds cap');
  let cycles = 0;
  while (value(resource) < needed && cycles++ < 100) {
    if (value('stone') < 100000) fillBasic('stone', Math.min(1200000, cap('stone')));
    if (value('coal') < 100000) fillBasic('coal', Math.min(450000, cap('coal')));
    if (resource === 'steel' && value('iron') < 100000)
      fillProcessed('iron', Math.min(1000000, cap('iron')));
    const before = value(resource);
    assign(resource);
    const stop = 'S.res.stone<20000||S.res.coal<20000' +
      (resource === 'steel' ? '||S.res.iron<20000' : '');
    advanceUntil(`S.res.${resource}>=${needed}`, 10000, stop);
    assert.ok(value(resource) > before, resource + ' production stalled');
  }
  assert.ok(value(resource) >= needed, resource + ' production cost unavailable');
}
function fill(resource, needed) {
  if (value(resource) >= needed) return;
  if (['copper', 'iron', 'steel', 'gold'].includes(resource)) fillProcessed(resource, needed);
  else fillBasic(resource, needed);
}
function restoreRoster() {
  const before = state();
  const previousPaid = run('({...__trainingPaid})');
  const previousTrained = run('__trainedCount');
  const shortages = {}, expectedPaid = {};
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'), 0);
  const order = {steel: 0, iron: 1, copper: 2, food: 3, stone: 4, wood: 5};
  for (const unit of ['archer', ...Object.keys(targetByType).filter(key => key !== 'archer')]) {
    const wanted = targetByType[unit];
    const short = Math.max(0, wanted - run(`poolAvail('${unit}')`));
    shortages[unit] = short;
    if (!short) continue;
    assert.equal(run(`queueTotal('${unit}')`), 0);
    const cost = run(`({...CFG.units['${unit}'].cost})`);
    for (const [resource, per] of Object.entries(cost).sort((a, b) =>
      (order[a[0]] ?? 9) - (order[b[0]] ?? 9))) {
      fill(resource, per * short);
      expectedPaid[resource] = (expectedPaid[resource] || 0) + per * short;
    }
    assign('tech');
    const queued = run(`train('${unit}',${short})`);
    assert.equal(queued?.ok, true, unit + ' training failed');
    assert.equal(queued.qty, short);
    phase = 'training';
    assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`, 25000).done,
      unit + ' training not complete');
  }
  for (const [row, groups] of Object.entries(target)) groups.forEach((unit, slot) => {
    assert.ok(run(`poolAvail('${unit.type}')`) >= unit.count, row + slot + ' stock missing');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit.type}';
      S._formModalQty=${unit.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`), unit.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`), unit.count);
  });
  const after = state();
  const paid = run('({...__trainingPaid})');
  const actualPaid = Object.fromEntries(Object.entries(paid).map(([key, n]) =>
    [key, n - (previousPaid[key] || 0)]));
  const trained = run('__trainedCount') - previousTrained;
  assert.equal(after.army, initial.army);
  assert.equal(after.deployed, initial.deployed);
  assert.equal(after.queue, 0);
  assert.equal(trained, initial.army - before.army);
  for (const [key, cost] of Object.entries(expectedPaid))
    assert.ok(Math.abs((actualPaid[key] || 0) - cost) < 1e-6, key + ' debit differs');
  return {before, after, shortages, trained, expectedPaid, actualPaid,
    onlineSeconds, phases, minFood, minCoal, minSteel};
}
const recovery1 = restoreRoster();
const afterRecovery1 = checkpoint('p385-after-recovery1-save.json');

// One crystal win pays the next cleanser. Exercise another full battle in the same RNG stream.
const beforeSecondExchange = state();
const exchange2 = run('exchangeDomainCleanser(1)');
assert.equal(exchange2?.ok, true);
assert.equal(state().blood, beforeSecondExchange.blood - 3);
assert.equal(state().cleanser, beforeSecondExchange.cleanser + 1);
const beforeSecondPurify = state();
const secondPurify = run("useDomainCleanser('godCrystal')");
assert.equal(secondPurify?.ok, true);
assert.equal(state().crystalAlert, beforeSecondPurify.crystalAlert - 100);
assert.equal(state().crystalAlert, 4900);
const beforeCrystal2 = checkpoint('p385-before-crystal2-save.json');
const crystal2 = fight('godCrystal');
assert.equal(crystal2.result, 'win', 'paid second crystal battle failed');
assert.equal(crystal2.crystalGain, 58);
assert.equal(crystal2.bloodGain, 3);
const afterCrystal2 = checkpoint('p385-after-crystal2-save.json');
const recovery2 = restoreRoster();
const afterRecovery2 = checkpoint('p385-after-recovery2-save.json');

// Continue eight more paid cycles without resetting the save or random stream.
const later = [];
for (let round = 3; round <= 10; round++) {
  const start = state();
  assert.equal(start.blood, 3);
  assert.equal(start.cleanser, 0);
  assert.equal(start.crystalAlert, 5000);
  assert.equal(start.army, 672);
  assert.equal(start.deployed, 626);
  const exchangeResult = run('exchangeDomainCleanser(1)');
  assert.equal(exchangeResult?.ok, true, 'exchange failed at round ' + round);
  const cleanseResult = run("useDomainCleanser('godCrystal')");
  assert.equal(cleanseResult?.ok, true, 'cleanse failed at round ' + round);
  assert.equal(state().crystalAlert, 4900);
  const battle = fight('godCrystal');
  assert.equal(battle.result, 'win', 'crystal battle failed at round ' + round);
  assert.equal(battle.crystalGain, 58);
  assert.equal(battle.bloodGain, 3);
  const recovery = restoreRoster();
  later.push({round, loss: battle.loss, crystalGain: battle.crystalGain,
    bloodGain: battle.bloodGain, recoveryOnlineSeconds: recovery.onlineSeconds -
      (later.length ? later.at(-1).totalOnlineSeconds : recovery2.onlineSeconds),
    totalOnlineSeconds: recovery.onlineSeconds, trainingPaid: recovery.actualPaid});
}
const afterTenCycles = checkpoint('p385-after-ten-crystal-cycles-save.json');

const report = {batch: 'P385', source: {file: sourceFile, sha256: sha(sourceRaw)},
  seed: 1, selection: 'Fixed before running, one continuous RNG stream; no winner selection',
  initial, phantom: phantom.map(x => ({result: x.result, loss: x.loss, bloodGain: x.bloodGain,
    beforeAlert: x.before.phantomAlert, afterAlert: x.after.phantomAlert})),
  afterPhantom, exchange: {result: exchange, paidBlood: 18, checkpoint: afterExchange},
  purify, beforeCrystal, crystal1, afterCrystal1, recovery1, afterRecovery1,
  second: {exchange: exchange2, purify: secondPurify, beforeCrystal2, crystal2, afterCrystal2,
    recovery2, afterRecovery2}, later, afterTenCycles,
  sourceHashes: Object.fromEntries(['config.js', 'levels.js', 'math.js', 'garrison.js',
    'technology.js', 'tests/progression/harness.js', 'tools/verify/probe-crystal-sustainability-p385.js']
    .map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  scope: 'Single fixed continuous VM stream from a paid save; all blood, cleansing, battle, production and training use real actions and are reloaded. No player save is modified. One stream is not an estimated win rate or full quantum-stage-100 proof.'};
fs.writeFileSync(path.join(data, 'p385-crystal-sustainability.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({phantom: report.phantom, crystal1: {result: crystal1.result,
  loss: crystal1.loss, crystalGain: crystal1.crystalGain, bloodGain: crystal1.bloodGain},
  recovery: {onlineSeconds: recovery1.onlineSeconds, trained: recovery1.trained,
    paid: recovery1.actualPaid, minFood: recovery1.minFood},
  crystal2: {result: crystal2.result, loss: crystal2.loss, crystalGain: crystal2.crystalGain,
    bloodGain: crystal2.bloodGain}, later,
  final: state()}, null, 2));
