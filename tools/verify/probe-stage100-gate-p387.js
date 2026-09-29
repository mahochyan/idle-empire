'use strict';
// P387: characterize the current stage-100 gap using real battle actions in isolated VMs.
// This does not patch shipped code or manufacture a paid quantum save.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {environment} = require('../../tests/progression/harness');

const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, 'docs/codex/reports/data');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const profiles = {
  preNuclear: 'p271-stage99-prenuclear-seed1-save.json',
  star120: 'p338-electric5-nuclear5-star-attack-120-paid-save.json',
  paid300m: 'p386-300m-paid-save.json'
};
const inputs = Object.fromEntries(Object.entries(profiles).map(([key, name]) => {
  const raw = fs.readFileSync(path.join(dataDir, name), 'utf8');
  return [key, {name, sha256: sha(raw), raw}];
}));
const sourceFiles = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js',
  'tests/progression/harness.js', 'tools/verify/probe-stage100-gate-p387.js'];
const sourceHashes = sourceFiles.map(file => ({file, sha256: sha(fs.readFileSync(path.join(root, file)))}));

function setUp(run, seed) {
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;
      __timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,
        scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}

function battle(profile, variant, seed) {
  const env = environment({rts_save: inputs[profile].raw});
  const run = env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  const gateBefore = run(`({stage99:campaignStageSelectable(98),stage100:campaignStageSelectable(99),
    cleared99:S.defeated.includes(99),cleared100:S.defeated.includes(100),
    quantum:scienceUnlocked('sci_quantum_age'),soul:scienceUnlocked('sci_soul_realm'),
    deployed:formSoldierCount(),army:armyCount(),tech:S.res.tech,techCap:resCap('tech')})`);
  assert.equal(gateBefore.cleared99, true);
  assert.equal(gateBefore.cleared100, false);
  assert.equal(gateBefore.quantum, false);
  assert.equal(gateBefore.stage99, true);
  assert.equal(gateBefore.stage100, true);
  setUp(run, seed);
  if (variant === 'hard1870') {
    const enemy = run(`(()=>{const e=CFG.enemies[99];
      e.units=Object.fromEntries(Object.entries(e.units).map(([type,groups])=>
        [type,groups.map(()=>170)]));
      return Object.values(e.units).flat().reduce((a,n)=>a+n,0)})()`);
    assert.equal(enemy, 1870);
  }
  assert.equal(run('selEnemy(99)'), true);
  run('openBattle()');
  assert.equal(run('S.battleActive'), true, 'current code admitted unresearched stage 100');
  let callbacks = 0;
  while (run('S.battleActive') && callbacks < 3000) {
    assert.equal(run('__step()'), true, `${profile} ${variant} seed ${seed}`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'), false);
  const after = run(`({won:document.getElementById('battle-result').className==='win',
    cleared:S.defeated.includes(100),deployed:formSoldierCount(),army:armyCount(),
    enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),round:B.round})`);
  assert.equal(after.cleared, after.won);
  const raw = env.store.get('rts_save');
  const replay = environment({rts_save: raw});
  assert.equal(replay.run('loadSaveAndApply().status'), 'ok');
  assert.equal(replay.run('S.defeated.includes(100)'), after.won);
  assert.equal(replay.run('formSoldierCount()'), after.deployed);
  return {profile,variant,seed,gateBefore,won:after.won,loss:gateBefore.deployed-after.deployed,
    remainingEnemyHp:after.enemyHp,round:after.round,callbacks,saveSha256:sha(raw)};
}

const design = environment();
const science = design.run(`(()=>{
  const all=activeSciences(),ids=Object.keys(all);
  const ancestors=id=>{const seen=new Set();function walk(x){for(const p of scienceNeedIds(x,all[x])){
    if(!seen.has(p)){seen.add(p);walk(p)}}}walk(id);return[...seen]};
  return{count:ids.length,legacyOnly:ids.filter(id=>all[id].legacyOnly),
    modeSpecific:ids.filter(id=>all[id].storageMode||all[id].currencyMode),
    quantumAncestors:ancestors('sci_quantum_age'),
    soulAncestors:ancestors('sci_soul_realm'),
    starArrayAncestors:ancestors('sci_star_array'),
    ids,
    stage100Enemy:Object.values(CFG.enemies[99].units).flat().reduce((a,n)=>a+n,0),
    stage99Enemy:Object.values(CFG.enemies[98].units).flat().reduce((a,n)=>a+n,0)}
})()`);
const paid300mScience=JSON.parse(inputs.paid300m.raw).sciences;
science.paid300mScienceCount=paid300mScience.length;
science.paid300mMissing=science.ids.filter(id=>!paid300mScience.includes(id));
if(process.argv.includes('--science-only')){
  console.log(JSON.stringify(science,null,2));
  process.exit(0);
}
assert.equal(science.stage100Enemy, 11);
assert.equal(science.stage99Enemy, 144);

function lockedEntry(profile) {
  const env=environment({rts_save:inputs[profile].raw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  setUp(run,1);
  const beforeRaw=env.store.get('rts_save');
  const before=run('JSON.stringify({res:S.res,formation:S.formation,defeated:S.defeated,merit:S.merit})');
  const gate=run(`({stage99:campaignStageSelectable(98),stage100:campaignStageSelectable(99),
    reason:campaignStageLockReason(99),cleared100:S.defeated.includes(100)})`);
  assert.equal(gate.stage99,true);
  assert.equal(gate.stage100,false);
  assert.equal(gate.cleared100,false);
  assert.match(gate.reason,/星辉圣阵/);
  assert.match(gate.reason,/星界量子时代/);
  assert.equal(run('selEnemy(99)'),false);
  run('S.selEnemy=99;openBattle()');
  assert.equal(run('S.battleActive'),false);
  assert.equal(run('S.defeated.includes(100)'),false);
  assert.equal(run('JSON.stringify({res:S.res,formation:S.formation,defeated:S.defeated,merit:S.merit})'),before);
  assert.equal(env.store.get('rts_save'),beforeRaw);
  const historical=JSON.parse(inputs[profile].raw);
  historical.defeated.push(100);
  const old=environment({rts_save:JSON.stringify(historical)});
  assert.ok(['ok','migrated'].includes(old.run('loadSaveAndApply().status')));
  setUp(old.run,1);
  old.run('S.selEnemy=99;openBattle()');
  assert.equal(old.run('S.battleActive'),true);
  return {profile,gate,selected:false,opened:false,saveUnchanged:true,
    historicalClearRetained:true,historicalReplayAllowed:true};
}

const gatePresent=(()=>{
  const e=environment({rts_save:inputs.paid300m.raw});
  assert.ok(['ok','migrated'].includes(e.run('loadSaveAndApply().status')));
  return !e.run('campaignStageSelectable(99)');
})();
let rows,summary,kind,caveat,filename;
if(gatePresent){
  rows=Object.keys(inputs).map(lockedEntry);
  summary=rows.map(({profile,gate,...checks})=>({profile,reason:gate.reason,...checks}));
  kind='post-gate actual selection, battle-entry, save, and historical replay audit';
  caveat='Paid inputs are still pre-quantum; this proves a gate, not paid terminal victory or tuned battle difficulty.';
  filename='p387-stage100-gate-post.json';
}else{
  rows=[];
  for(const profile of Object.keys(inputs))rows.push(battle(profile,'formal',1));
  for(const profile of Object.keys(inputs))for(let seed=1;seed<=32;seed++)
    rows.push(battle(profile,'hard1870',seed));
  summary=Object.keys(inputs).map(profile=>{
    const formal=rows.find(r=>r.profile===profile&&r.variant==='formal');
    const hard=rows.filter(r=>r.profile===profile&&r.variant==='hard1870');
    const wins=hard.filter(r=>r.won);
    return{profile,formalWon:formal.won,formalLoss:formal.loss,
      hardWins:wins.length,hardSeeds:hard.length,
      meanHardWinLoss:wins.length?wins.reduce((n,r)=>n+r.loss,0)/wins.length:null,
      meanHardLossEnemyHp:hard.length>wins.length?
        hard.filter(r=>!r.won).reduce((n,r)=>n+r.remainingEnemyHp,0)/(hard.length-wins.length):null};
  });
  kind='pre-gate actual stage-100 entry and isolated formal/hard battle audit';
  caveat='Fixed independent seeds from paid pre-quantum checkpoints; not natural win rates or paid full-tech proof.';
  filename='p387-stage100-gate-audit.json';
}
const output={batch:'P387',kind,caveat,
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  inputs:Object.fromEntries(Object.entries(inputs).map(([k,{raw,...metadata}])=>[k,metadata])),
  sourceHashes,science,summary,rows};
const outputPath=path.join(dataDir,filename);
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
for (const {name,sha256} of Object.values(inputs))
  assert.equal(sha(fs.readFileSync(path.join(dataDir,name),'utf8')),sha256,name+' changed');
for (const {file,sha256} of sourceHashes)
  assert.equal(sha(fs.readFileSync(path.join(root,file))),sha256,file+' changed');
console.log(JSON.stringify({outputPath,science,summary},null,2));
