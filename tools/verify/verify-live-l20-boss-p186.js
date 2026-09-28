'use strict';
// P186: replay paid pre-L20 saves against the actual campaign configuration.
// Unlike the P182-P185 sensitivity probes, this does not override CFG.enemies.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const cavalry = JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p184-current-l20-boss-seeds.json'), 'utf8'));
const archers = JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p183-current-l20-archer-roster.json'), 'utf8'));
const priorWin = JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p187-current-l20-worst-recovery.json'), 'utf8'));
const roster = {infantry:[8,6,4], archer:[8,6,4], cavalry_t1:[8,6,4]};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));

function load(saved, expectedSha) {
  assert.equal(sha(saved), expectedSha, '历史实付战前存档SHA');
  const world = environment({rts_save:saved});
  const run = world.run;
  assert.equal(run('loadSaveAndApply().status'), 'ok', '旧档载入失败');
  assert.deepEqual(plain(run('CFG.enemies[19].units')), roster,
    '第20关未使用正式敌阵');
  assert.deepEqual(plain(run('([...S.defeated])')),
    Array.from({length:19}, (_, i) => i+1), '战前必须已胜1—19关');
  // Only browser timers and DOM are emulated; the game handles every battle step.
  run(`globalThis.__p186Timers=new Map();globalThis.__p186TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p186TimerId++;__p186Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p186Timers.delete(id);
    globalThis.__p186Step=()=>{const first=__p186Timers.entries().next().value;
      if(!first)return false;__p186Timers.delete(first[0]);first[1]();return true};
    globalThis.__p186Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p186Nodes.has(id))__p186Nodes.set(id,{style:{},innerHTML:'',textContent:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},
        contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p186Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return run;
}
function owned(run, type) {
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function place(run, row, type, count, slot) {
  assert.ok(count>0 && run(`rowSlots('${row}')`)>slot);
  assert.ok(run(`S.pool['${type}']||0`)>=count);
  run(`openFormModal('expedition','${row}',${slot});`+
    `S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].type`), type);
  assert.equal(run(`S.formation.${row}[${slot}].count`), count);
}
function form(run, kind, archerTarget) {
  run("clrForm('expedition')");
  assert.equal(run('regMax()'), 15);
  place(run, 'front', 'bronze_guard', 15, 0);
  place(run, 'front', kind==='cavalry'?'cavalry_t1':'infantry_t1', 15, 1);
  place(run, 'back', 'archer_t1', Math.min(15, archerTarget), 0);
  if(archerTarget>15)place(run, 'back', 'archer_t1',
    Math.min(15, archerTarget-15), 1);
  if(archerTarget>30)place(run, 'mid', 'archer_t1', archerTarget-30, 0);
  const formation = plain(run('S.formation'));
  const deployed = {};
  for(const row of ['front','mid','back'])for(const unit of formation[row])
    deployed[unit.type]=(deployed[unit.type]||0)+unit.count;
  assert.deepEqual(deployed, kind==='cavalry'
    ? {bronze_guard:15,cavalry_t1:15,archer_t1:13}
    : {bronze_guard:15,infantry_t1:15,archer_t1:archerTarget});
  return deployed;
}
function battle(saved, expectedSha, seed, kind, archerTarget, expected) {
  const run = load(saved, expectedSha);
  const deployed = form(run, kind, archerTarget);
  const beforeOwned = Object.fromEntries(Object.keys(deployed).map(type=>
    [type,owned(run,type)]));
  const beforeResources = plain(run('S.res'));
  const beforeMerit = run('S.merit');
  const rngStart = (seed*1009+20*9176)>>>0;
  run(`globalThis.__p186Rng=${rngStart};Math.random=()=>{
    let x=__p186Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p186Rng=x>>>0;return __p186Rng/4294967296;}`);
  run('selEnemy(19);openBattle()');
  assert.equal(run('S.battleActive'), true, '第20关未正常开战');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p186Step()'),true,'战斗回调丢失');
    callbacks++;
  }
  assert.equal(run('S.battleActive'), false, '第20关未结算');
  const won=run('S.defeated.includes(20)'), round=run('B.round');
  const losses=Object.fromEntries(Object.entries(beforeOwned).map(([type,n])=>
    [type,n-owned(run,type)]));
  const lossTotal=Object.values(losses).reduce((n,x)=>n+x,0);
  const afterResources=plain(run('S.res'));
  const meritGain=run('S.merit')-beforeMerit;
  run('exitBattle()');
  assert.equal(run('save().ok'),true,'战后写档失败');
  const savedAfter=run("localStorage.getItem('rts_save')");
  const reload=environment({rts_save:savedAfter}).run;
  assert.equal(reload('loadSaveAndApply().status'),'ok','战后重载失败');
  assert.equal(reload('S.defeated.includes(20)'),won,'胜场重载丢失');
  assert.deepEqual(plain(reload('S.res')),afterResources,'奖励重载丢失');
  assert.equal(won,expected.won);
  assert.equal(round,expected.round);
  assert.equal(callbacks,expected.callbacks);
  assert.equal(lossTotal,expected.lossTotal);
  assert.deepEqual(losses,expected.losses||expected.lossByType);
  assert.equal(meritGain,expected.meritGain);
  const actualReward=Object.fromEntries(Object.keys(expected.actualReward).map(key=>
    [key,afterResources[key]-beforeResources[key]]));
  assert.deepEqual(actualReward,expected.actualReward);
  return {seed,kind,archerTarget,won,round,lossTotal,callbacks};
}

assert.equal(cavalry.batch,'P184');
assert.equal(archers.batch,'P183');
const rows=[];
for(const seed of cavalry.scope.combatSeeds){
  const expected=cavalry.outcomes.find(row=>row.roster==='8-6-4'&&row.seed===seed);
  assert.ok(expected);
  rows.push(battle(cavalry.preparedSave,cavalry.scope.preparedSaveSha256,
    seed,'cavalry',13,expected));
}
for(const profile of archers.profiles){
  const variant=profile.variants.find(row=>row.roster==='8-6-4');
  assert.ok(variant);
  rows.push(battle(profile.preparedSave,profile.preparedSaveSha256,
    profile.seed,'archers',profile.archerTarget,
    {...variant.battle, losses:variant.battle.lossByType,
      actualReward:variant.battle.actualReward}));
}
assert.equal(priorWin.batch,'P187');
assert.equal(sha(priorWin.l20.finalSave),priorWin.l20.finalSaveSha256);
const oldVictory=environment({rts_save:priorWin.l20.finalSave}).run;
assert.equal(oldVictory('loadSaveAndApply().status'),'ok');
assert.equal(oldVictory('S.defeated.includes(20)'),true,
  '调整前已胜第20关的旧档丢失胜场');
assert.equal(oldVictory('CFG.enemies[19].name'),'军镇铁骑统领');
console.log(JSON.stringify({batch:'P186',roster,checks:rows.length,
  wins:rows.filter(row=>row.won).length,
  priorVictorySaveLoaded:true,
  cavalry:{checks:16,lossMin:Math.min(...rows.slice(0,16).map(row=>row.lossTotal)),
    lossMax:Math.max(...rows.slice(0,16).map(row=>row.lossTotal))},
  archer:rows.slice(16)},null,2));
