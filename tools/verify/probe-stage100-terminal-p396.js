'use strict';
// P396: Current paid pre-quantum checkpoint against isolated final-stage enemy scales.
// The science gate is bypassed only inside each throwaway VM; no candidate is shipped.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const inputFile='p395-quantum-steam32-medal-combined-paid-save.json';
const inputRaw=fs.readFileSync(path.join(dataDir,inputFile),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const inputHash=hash(inputRaw);
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage100-terminal-p396.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const scales=[1,60,80,100,120,140,160,180,200,220,240,260,280,300];
const seeds=process.argv.includes('--pilot')?[1,7,9,16]:Array.from({length:16},(_,i)=>i+1);

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

{
  const env=environment({rts_save:inputRaw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.defeated.includes(99)'),true);
  assert.equal(run('S.defeated.includes(100)'),false);
  assert.equal(run("scienceUnlocked('sci_star_array')"),true);
  assert.equal(run("scienceUnlocked('sci_quantum_age')"),false);
  assert.equal(run('resCap("tech")'),357121694);
  assert.equal(run('S.res.medal'),3073710);
  assert.equal(run("researchScience('sci_quantum_age').reason"),'insufficient-tech');
  assert.equal(run('campaignStageSelectable(99)'),false);
  assert.equal(run('selEnemy(99)'),false);
  run('S.selEnemy=99;openBattle()');
  assert.equal(run('S.battleActive'),false);
  assert.equal(env.store.get('rts_save'),inputRaw);
}

function fight(scale,seed){
  const env=environment({rts_save:inputRaw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  setup(run,seed);
  // Eligibility-only bypass. The paid army, resources, research, equipment, and
  // awakening remain exactly as loaded; in particular quantum science stays locked.
  run('CFG.enemies[99].needSciences=[]');
  if(scale!==1)run(`CFG.enemies[99].units=Object.fromEntries(
    Object.entries(CFG.enemies[99].units).map(([key,groups])=>[key,groups.map(()=>${scale})]));`);
  const before=run(`({tick:S.tick,deployed:formSoldierCount(),army:armyCount(),
    tech:S.res.tech,medal:S.res.medal,quantum:scienceUnlocked('sci_quantum_age')})`);
  assert.equal(before.quantum,false);
  assert.equal(run('selEnemy(99)'),true);
  run('openBattle()');
  assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){
    assert.equal(run('__step()'),true,`battle callback scale ${scale} seed ${seed}`);
    callbacks++;
  }
  assert.ok(callbacks<4000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({tick:S.tick,deployed:formSoldierCount(),army:armyCount(),round:B.round,
    clear100:S.defeated.includes(100),tech:S.res.tech,medal:S.res.medal,
    enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    quantum:scienceUnlocked('sci_quantum_age')})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.clear100,won);
  assert.equal(after.quantum,false);
  const reloaded=environment({rts_save:env.store.get('rts_save')});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('formSoldierCount()'),after.deployed);
  assert.equal(reloaded.run('S.defeated.includes(100)'),won);
  return{scale,seed,enemy,won,loss:before.deployed-after.deployed,
    beforeDeployed:before.deployed,afterDeployed:after.deployed,enemyHp:after.enemyHp,
    round:after.round,callbacks};
}

const rows=[];
for(const scale of scales)for(const seed of seeds)rows.push(fight(scale,seed));
const summary=scales.map(scale=>{
  const group=rows.filter(x=>x.scale===scale),wins=group.filter(x=>x.won);
  return{perGroup:scale,totalEnemy:group[0].enemy.people,wins:wins.length,of:group.length,
    meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    minWinLoss:wins.length?Math.min(...wins.map(x=>x.loss)):null,
    maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
    fullArmyLosses:group.filter(x=>x.loss===x.beforeDeployed).length};
});
const output=path.join(dataDir,`p396-stage100-prequantum-${seeds.length}seeds.json`);
const report={batch:'P396',kind:'isolated current-code terminal sensitivity with paid pre-quantum input',
  unit:'soldiers, HP, battle rounds; no simulated production time',
  input:{file:inputFile,sha256:inputHash,paid:true,quantumSciencePaid:false},
  eligibility:'Terminal science gate bypassed only inside battle VM; no science flags, units, stock, or progression are injected.',
  sourceHashes,scales,seeds,summary,rows,
  caveat:'Engineering fixed streams, not player win rates. No paid quantum research or paid postbattle refills are demonstrated.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
assert.equal(hash(fs.readFileSync(path.join(dataDir,inputFile))),inputHash);
for(const x of sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,x.file))),x.sha256,`${x.file} changed`);
console.log(JSON.stringify({output,summary},null,2));
