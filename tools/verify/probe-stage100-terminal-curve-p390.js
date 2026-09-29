'use strict';
// P390: fixed-seed, isolated terminal-curve sensitivity on the shipped combat code.
// The only paid input is P386. All post-quantum states below are explicitly synthetic.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const inputFile='p386-300m-paid-save.json';
const inputRaw=fs.readFileSync(path.join(dataDir,inputFile),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(inputRaw),'7f27ca4a53ba412e187ec72aeaaf6349f1bba00185ae422ac959dac8e557f5cf');
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage100-terminal-curve-p390.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const stageTargets={91:80,92:100,93:140,94:240,95:320,96:450,97:700,98:950,99:1300};
const stage100Scales=[1,110,140,170,200,250];
const seedCount=process.argv.includes('--pilot')?4:16;

// Confirm that the paid checkpoint cannot enter the actual first-clear fight.
{
  const env=environment({rts_save:inputRaw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('campaignStageSelectable(99)'),false);
  const before=env.store.get('rts_save');
  run('S.selEnemy=99;openBattle()');
  assert.equal(run('S.battleActive'),false);
  assert.equal(env.store.get('rts_save'),before);
}

function setup(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;
      __timers.delete(entry[0]);entry[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}

function applyProfile(run,profile,stage){
  if(profile==='paidPre'){
    // P386 has not bought the two researches. Only bypass this probe's stage-100 gate;
    // keep every paid soldier, weapon and battle stat untouched.
    if(stage===100)run('CFG.enemies[99].needSciences=[]');
    return;
  }
  run(`for(const id of ['sci_star_beast_domain','sci_star_array','sci_quantum_age'])
    if(!S.sciences.includes(id))S.sciences.push(id);`);
  if(profile==='quantum101'||profile==='mature101'){
    // Replace the 101 paid electro soldiers in their existing two slots. Equal headcount,
    // same buildings and all other troops; the 101 quantum soldiers are not paid.
    run(`for(const row of ['front','mid','back'])for(const u of S.formation[row])
      if(u.type==='electro_trooper')u.type='quantum_trooper';`);
  }
  if(profile==='mature101'){
    // Far-future combat sensitivity only: the 20-rank/50-star progression is unearned.
    run(`S.awakening.star_trooper.level=20;
      S.awakening.star_trooper.stars=50;
      S.awakening.star_trooper.tracks={easy:20,perfect:0,extreme:0};`);
  }
  assert.equal(run('save().ok'),true,profile+' synthetic fixture save');
  const check=environment({rts_save:run('localStorage.getItem("rts_save")')});
  assert.equal(check.run('loadSaveAndApply().status'),'ok',profile+' synthetic fixture reload');
  assert.equal(run('formSoldierCount()'),626,profile+' total deployed');
  if(profile==='quantum101'||profile==='mature101'){
    assert.equal(run("expeditionCount('quantum_trooper')"),101);
    assert.ok(run("unitCapLeft('quantum_trooper')")>=0);
  }
}

function scaleEnemy(run,stage,variant){
  if(stage===100){
    if(variant===1)return;
    run(`const __enemyP390=CFG.enemies[99];
      __enemyP390.units=Object.fromEntries(Object.entries(__enemyP390.units)
        .map(([type,groups])=>[type,groups.map(()=>${variant})]));`);
    return;
  }
  if(variant==='formal')return;
  run(`const __enemyP390=CFG.enemies[${stage-1}];
    const __peopleP390=Object.values(__enemyP390.units).flat().reduce((a,n)=>a+n,0);
    const __ratioP390=${stageTargets[stage]}/__peopleP390;
    __enemyP390.units=Object.fromEntries(Object.entries(__enemyP390.units).map(([type,groups])=>
      [type,groups.map(n=>Math.max(1,Math.round(n*__ratioP390)))]));`);
}

function fight(profile,stage,variant,seed){
  const env=environment({rts_save:inputRaw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('S.defeated.includes(99)'),true);
  assert.equal(run('S.defeated.includes(100)'),false);
  setup(run,seed);
  applyProfile(run,profile,stage);
  scaleEnemy(run,stage,variant);
  const before=run(`({deployed:formSoldierCount(),army:armyCount(),tick:S.tick,
    quantum:scienceUnlocked('sci_quantum_age'),array:scienceUnlocked('sci_star_array'),
    quantumTroops:expeditionCount('quantum_trooper'),starTroops:expeditionCount('star_trooper'),
    awakening:{...S.awakening.star_trooper}})`);
  assert.equal(run(`selEnemy(${stage-1})`),true,profile+' '+stage+' selected');
  run('openBattle()');
  assert.equal(run('S.battleActive'),true,profile+' '+stage+' battle opened');
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+combatAttackMass(u),0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){
    assert.equal(run('__step()'),true,profile+' '+stage+' '+variant+' '+seed);
    callbacks++;
  }
  assert.ok(callbacks<3000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({deployed:formSoldierCount(),army:armyCount(),tick:S.tick,round:B.round,
    cleared:S.defeated.includes(${stage}),enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.cleared,stage<100||won);
  const raw=env.store.get('rts_save');
  const reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  assert.equal(reload.run(`S.defeated.includes(${stage})`),after.cleared);
  return{profile,stage,variant,seed,before,enemy,won,round:after.round,
    loss:before.deployed-after.deployed,remainingHp:after.enemyHp,callbacks};
}

const rows=[];
for(const profile of ['paidPre','scienceOnly','quantum101','mature101'])
  for(const scale of stage100Scales)for(let seed=1;seed<=seedCount;seed++)
    rows.push(fight(profile,100,scale,seed));
for(const profile of ['paidPre','mature101'])
  for(const stage of Object.keys(stageTargets).map(Number))
    for(const variant of ['formal','candidate'])for(let seed=1;seed<=seedCount;seed++)
      rows.push(fight(profile,stage,variant,seed));

const summary=[];
for(const profile of ['paidPre','scienceOnly','quantum101','mature101'])
  for(const scale of stage100Scales){
    const group=rows.filter(x=>x.profile===profile&&x.stage===100&&x.variant===scale);
    const wins=group.filter(x=>x.won),losses=group.filter(x=>!x.won);
    summary.push({profile,stage:100,variant:scale,enemy:group[0].enemy,wins:wins.length,of:group.length,
      meanWinLoss:wins.length?wins.reduce((a,x)=>a+x.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
      meanLossRemainingHp:losses.length?losses.reduce((a,x)=>a+x.remainingHp,0)/losses.length:null});
  }
for(const profile of ['paidPre','mature101'])for(const stage of Object.keys(stageTargets).map(Number))
  for(const variant of ['formal','candidate']){
    const group=rows.filter(x=>x.profile===profile&&x.stage===stage&&x.variant===variant);
    const wins=group.filter(x=>x.won);
    summary.push({profile,stage,variant,enemy:group[0].enemy,wins:wins.length,of:group.length,
      meanWinLoss:wins.length?wins.reduce((a,x)=>a+x.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null});
  }
// A technology flag alone must not be misreported as power gained in combat.
for(const scale of stage100Scales)for(let seed=1;seed<=seedCount;seed++){
  const a=rows.find(x=>x.profile==='paidPre'&&x.stage===100&&x.variant===scale&&x.seed===seed);
  const b=rows.find(x=>x.profile==='scienceOnly'&&x.stage===100&&x.variant===scale&&x.seed===seed);
  assert.deepEqual([a.won,a.loss,a.remainingHp,a.round],[b.won,b.loss,b.remainingHp,b.round],
    'science-only battle parity '+scale+' '+seed);
}
const output=path.join(dataDir,`p390-stage100-terminal-curve-${seedCount}seeds.json`);
const report={batch:'P390',kind:'isolated candidate via real battle actions, callbacks, save and reload',
  input:{file:inputFile,sha256:hash(inputRaw),type:'paid pre-quantum P386 stage-99 checkpoint'},
  profiles:{
    paidPre:'Paid P386 army; only the stage-100 science gate is bypassed in this probe.',
    scienceOnly:'Synthetic science flags, same P386 army; no research costs were paid.',
    quantum101:'Synthetic science flags plus 101 unearned quantum soldiers replacing 101 electro soldiers in the same slots.',
    mature101:'quantum101 plus unearned star-trooper awakening rank 20 / 50 stars; star-array slots remain unopened.'},
  sourceHashes,stageTargets,stage100Scales,seedCount,summary,rows,
  caveat:'Fixed seeds are deterministic engineering samples, not player win rates. Stages 91-99 are independent replays from an already-cleared stage-99 paid save, not a continuous paid campaign.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
assert.equal(hash(fs.readFileSync(path.join(dataDir,inputFile))),report.input.sha256);
for(const x of sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,x.file))),x.sha256,x.file+' changed');
console.log(JSON.stringify({output,seedCount,stage100:summary.filter(x=>x.stage===100),
  stage99:summary.filter(x=>x.stage===99)},null,2));
