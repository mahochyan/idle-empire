'use strict';
// P225: old paid T1 saves against the actual L29 configuration, without CFG overrides.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'docs/codex/reports/data');
const prior = JSON.parse(fs.readFileSync(path.join(dataDir, 'p221-l29-t1-rebuild.json'), 'utf8'));
const outputPath = path.join(dataDir, 'p225-live-l29-t1-formal.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const targets = {bronze_guard: 15, cavalry_t1: 15, infantry_t1: 15, archer_t1: 28};
const placements = [['front', 'bronze_guard', 15], ['front', 'cavalry_t1', 15],
  ['front', 'infantry_t1', 15], ['back', 'archer_t1', 13], ['back', 'archer_t1', 15]];
const inputs = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js',
  'tests/progression/harness.js', 'tools/verify/probe-live-l29-t1-formal-p225.js',
  'docs/codex/reports/data/p221-l29-t1-rebuild.json']
  .map(file => ({file, sha256: sha(fs.readFileSync(path.join(root, file)))}));
assert.equal(prior.batch, 'P221');
assert.equal(prior.routes.length, 2);
Date.now = () => prior.scope.fixedVmNowMs;

function installHarness(run) {
  run(`globalThis.__p225Timers=new Map();globalThis.__p225TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p225TimerId++;
      __p225Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p225Timers.delete(id);
    globalThis.__p225Step=()=>{const next=__p225Timers.entries().next().value;
      if(!next)return false;__p225Timers.delete(next[0]);next[1]();return true};
    globalThis.__p225Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p225Nodes.has(id))__p225Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p225Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save) {
  const world = environment({rts_save: save}), run = world.run;
  assert.equal(run('loadSaveAndApply().status'), 'ok');
  assert.equal(run('saveProtected()'), false);
  installHarness(run);
  return {world, run};
}
function state(run) {
  return plain(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
    resources:{...S.res},workers:{...S.popAlloc},merit:S.merit,
    defeated:[...S.defeated],army:armyCount(),
    owned:Object.fromEntries(['bronze_guard','cavalry_t1','infantry_t1','archer_t1']
      .map(type=>[type,(S.pool[type]||0)+expeditionCount(type)+garrisonCount(type)])),
    queue:JSON.parse(JSON.stringify(S.queue)),
    formation:JSON.parse(JSON.stringify(S.formation))})`));
}
function saveReload(active, label) {
  const before = state(active.run);
  assert.equal(active.run('save().ok'), true, `${label} save failed`);
  const save = active.world.store.get('rts_save');
  assert.equal(typeof save, 'string');
  const next = restore(save);
  assert.deepEqual(state(next.run), before, `${label} reload changed gameplay state`);
  return {...next, save, sha256: sha(save)};
}
function seedRng(run, flow, stage) {
  const initial = (flow * 1009 + stage * 9176) >>> 0;
  run(`globalThis.__p225Rng=${initial};globalThis.__p225Draws=0;
    Math.random=()=>{__p225Draws++;let x=__p225Rng;
      x^=x<<13;x^=x>>>17;x^=x<<5;
      __p225Rng=x>>>0;return __p225Rng/4294967296}`);
}
function owned(run, type) {
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function form(run) {
  run("clrForm('expedition')");
  for (const [row, type, count] of placements) {
    const index = run(`S.formation.${row}.length`);
    assert.ok(index < run(`rowSlots('${row}')`));
    assert.ok(count <= run('regMax()'));
    assert.ok(run(`S.pool['${type}']||0`) >= count);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
      S.formation.${row}[${index}]?.count===${count}`), true);
  }
  assert.equal(run('armyCount()'), 73);
}
function battle(active, stage, flow, alreadyFormed = false) {
  const run = active.run;
  if (!alreadyFormed) form(run);
  const before = state(run);
  assert.equal(before.defeated.at(-1), stage - 1);
  assert.equal(before.army, 73);
  seedRng(run, flow, stage);
  run(`selEnemy(${stage - 1});openBattle()`);
  assert.equal(run('S.battleActive'), true);
  const initialEnemy = plain(run(`({groups:B.enemyUnits.length,
    hp:B.enemyUnits.reduce((n,u)=>n+(u.maxHp||0),0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0),
    mageGroups:B.enemyUnits.filter(u=>u.type==='mage_t1').length})`));
  let callbacks = 0;
  while (run('S.battleActive') && callbacks < 1000) {
    assert.equal(run('__p225Step()'), true, 'battle callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'), false, 'battle did not settle');
  const won = run(`S.defeated.includes(${stage})`);
  const round = run('B.round');
  const enemyHp = run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)');
  const rngDraws = run('__p225Draws');
  const settled = state(run), losses = {};
  for (const [type, target] of Object.entries(targets)) {
    losses[type] = target - settled.owned[type];
    assert.ok(losses[type] >= 0 && losses[type] <= target);
  }
  const lossTotal = Object.values(losses).reduce((a, b) => a + b, 0);
  assert.equal(lossTotal, before.army - settled.army);
  run('exitBattle()');
  const saved = saveReload(active, `L${stage}/flow${flow} battle`);
  return {won, round, callbacks, initialEnemy, enemyHp, rngDraws,
    losses, lossTotal, before, after: state(saved.run),
    postSave: saved.save, postSaveSha256: saved.sha256};
}
function fill(active) {
  const run = active.run, before = state(run), requested = {}, produced = {}, due = {};
  let minTickEndFood = before.resources.food, seconds = 0;
  for (const [type, target] of Object.entries(targets)) {
    const need = Math.max(0, target - owned(run, type) - (run(`S.queue['${type}']?.count||0`)));
    requested[type] = need;
    if (!need) continue;
    assert.equal(run(`trainLockReason('${type}')`), '');
    const resourceBefore = plain(run('({...S.res})'));
    const action = plain(run(`train('${type}',${need})`));
    assert.equal(action?.ok, true, `train ${type}: ${JSON.stringify(action)}`);
    assert.deepEqual(plain(run('({...S.res})')), resourceBefore);
  }
  const ready = () => Object.entries(targets).every(([type, target]) => owned(run, type) >= target);
  while (!ready() && seconds < 7200) {
    const priorQueue = plain(run('S.queue'));
    run('tick()'); seconds++;
    minTickEndFood = Math.min(minTickEndFood, run('S.res.food'));
    const nextQueue = plain(run('S.queue'));
    for (const [type, queue] of Object.entries(nextQueue)) {
      const made = (priorQueue[type]?.count || 0) - queue.count;
      if (made <= 0) continue;
      produced[type] = (produced[type] || 0) + made;
      for (const [resource, cost] of Object.entries(plain(run(`CFG.units['${type}'].cost`))))
        due[resource] = (due[resource] || 0) + cost * made;
    }
  }
  assert.equal(ready(), true, 'not replenished within 7200 simulated online seconds');
  for (const [type, need] of Object.entries(requested))
    assert.equal(produced[type] || 0, need, `paid training ${type}`);
  const after = state(run);
  const saved = saveReload(active, `refill/${seconds}s`);
  return {seconds, ready: true, requested, produced, due, minTickEndFood,
    before: {resources: before.resources, army: before.army},
    after: {resources: after.resources, army: after.army},
    postSave: saved.save, postSaveSha256: saved.sha256};
}

const rows = [], selected = {};
for (const source of prior.routes) {
  const preparedSave = source.l29.preparedSave;
  assert.equal(sha(preparedSave), source.l29.preparedSha256);
  const loaded = restore(preparedSave);
  assert.equal(loaded.run('CFG.enemies[28].name'), '帝国军校学徒');
  assert.deepEqual(plain(loaded.run('CFG.enemies[28].units.mage_t1')), [11, 8, 5]);
  assert.equal(loaded.run('S.defeated.at(-1)'), 28);
  assert.equal(loaded.run('armyCount()'), 73);
  for (let flow = 1; flow <= 16; flow++) {
    const active = restore(preparedSave);
    const result = battle(active, 29, flow, true);
    const expected = prior.trials.find(row => row.sourceSeed === source.seed &&
      row.candidate === 'mage24' && row.flow === flow);
    assert.ok(expected, `missing P221 seed${source.seed} flow${flow}`);
    for (const key of ['won', 'round', 'enemyHp', 'rngDraws', 'lossTotal'])
      assert.equal(result[key], expected[key], `seed${source.seed}/flow${flow}/${key}`);
    assert.deepEqual(result.losses, expected.losses);
    assert.deepEqual(result.initialEnemy, expected.initialEnemy);
    rows.push({sourceSeed: source.seed, flow, preparedSha256: source.l29.preparedSha256,
      won: result.won, round: result.round, enemyHp: result.enemyHp,
      rngDraws: result.rngDraws, losses: result.losses, lossTotal: result.lossTotal,
      initialEnemy: result.initialEnemy, postSaveSha256: result.postSaveSha256});
    if (source.seed === 1 && [2, 3].includes(flow)) selected[flow] = result;
  }
}
assert.equal(rows.length, 32);
assert.equal(rows.filter(x => x.sourceSeed === 1 && x.won).length, 11);
assert.equal(rows.filter(x => x.sourceSeed === 15 && x.won).length, 11);
const continuations = [];
for (const flow of [2, 3]) {
  const origin = selected[flow];
  const firstRefill = fill(restore(origin.postSave));
  const continuation = {flow, firstL29: {won: origin.won, lossTotal: origin.lossTotal,
    postSaveSha256: origin.postSaveSha256}, firstRefill: {
    seconds: firstRefill.seconds, due: firstRefill.due,
    minTickEndFood: firstRefill.minTickEndFood,
    postSaveSha256: firstRefill.postSaveSha256}};
  let active = restore(firstRefill.postSave);
  const nextStage = origin.won ? 30 : 29;
  const next = battle(active, nextStage, flow);
  continuation.nextBattle = {stage: nextStage, won: next.won,
    lossTotal: next.lossTotal, round: next.round,
    postSaveSha256: next.postSaveSha256};
  if (origin.won && next.won) {
    const secondRefill = fill(restore(next.postSave));
    continuation.secondRefill = {seconds: secondRefill.seconds,
      due: secondRefill.due, minTickEndFood: secondRefill.minTickEndFood,
      postSaveSha256: secondRefill.postSaveSha256};
    active = restore(secondRefill.postSave);
    const last = battle(active, 31, flow);
    continuation.lastBattle = {stage: 31, won: last.won,
      lossTotal: last.lossTotal, round: last.round,
      postSaveSha256: last.postSaveSha256};
  }
  continuations.push(continuation);
}
const output = {batch: 'P225', unit: 'simulated online seconds, soldiers, resources',
  method: 'P221 fully paid old T1 L29 saves load actual formal L29; 2 sources x 16 streams, official battle/endBattle/save/reload. Flow2 high-loss victory and flow3 full defeat paid recovery, then formal continuation without CFG override. Harness disables garrisonTick.',
  scope: {sources: 2, flows: 16, battles: rows.length, fixedStreamNotPlayerWinRate: true,
    noGarrison: true, noOffline: true, fixedVmNowMs: prior.scope.fixedVmNowMs},
  sourceHead: prior.sourceHead, inputSha256: sha(fs.readFileSync(path.join(dataDir,
    'p221-l29-t1-rebuild.json'))), inputs, rows, continuations};
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({batch: output.batch, rows: rows.length,
  winsBySource: [1, 15].map(seed => rows.filter(x => x.sourceSeed === seed && x.won).length),
  continuations: continuations.map(x => ({flow: x.flow,
    refillSeconds: x.firstRefill.seconds, nextWon: x.nextBattle.won,
    lastWon: x.lastBattle?.won})), outputSha256: sha(fs.readFileSync(outputPath))}));
