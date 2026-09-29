'use strict';
// Isolated late-campaign pressure scan. Candidate enemy counts never enter levels.js.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const profileFiles={
  preMilitary:'p386-300m-paid-save.json',
  military6:'p391-steam-military-six-star-paid-save.json',
  military6plus10:'p391-six-star-plus10-paid-save.json'
};
const inputs=Object.fromEntries(Object.entries(profileFiles).map(([key,file])=>{
  const raw=fs.readFileSync(path.join(dataDir,file),'utf8');
  return[key,{file,sha256:hash(raw),raw}];
}));
// Stage 90 closes the previous chapter. Include it to avoid hiding the 89->90 collapse.
// Targets use the existing unit groups and the existing Boss attack/defense multipliers.
const target={90:165,91:180,92:210,93:250,94:300,95:360,
  96:450,97:600,98:800,99:1100,100:1870};
const seeds=process.argv.includes('--pilot')?4:16;
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage100-terminal-bridge-agent.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));

function setup(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const t=__timers.entries().next().value;if(!t)return false;
      __timers.delete(t[0]);t[1]();return true};
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
function scale(run,stage,bossScale=170){
  return run(`(()=>{const e=CFG.enemies[${stage-1}],before=Object.values(e.units).flat().reduce((a,b)=>a+b,0);
    const ratio=${target[stage]}/before;
    e.units=Object.fromEntries(Object.entries(e.units).map(([key,groups])=>
      [key,groups.map(n=>${stage===100?bossScale:'Math.max(1,Math.round(n*ratio))'})]));
    return{before,after:Object.values(e.units).flat().reduce((a,b)=>a+b,0),
      groups:Object.values(e.units).flat().length};})()`);
}
function fight(profile,stage,variant,seed){
  const env=environment({rts_save:inputs[profile].raw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('S.defeated.includes(99)'),true);
  assert.equal(run('S.defeated.includes(100)'),false);
  setup(run,seed);
  // These paid inputs predate quantum. Only the science entry gate is bypassed,
  // so their army power is tested without claiming a valid first clear.
  if(stage===100)run('CFG.enemies[99].needSciences=[]');
  const enemy=variant!=='formal'?scale(run,stage,variant.startsWith('boss')?Number(variant.slice(4)):170):run(`(()=>{
    const n=Object.values(CFG.enemies[${stage-1}].units).flat();
    return{before:n.reduce((a,b)=>a+b,0),after:n.reduce((a,b)=>a+b,0),groups:n.length};})()`);
  const before=run('({army:armyCount(),deployed:formSoldierCount(),tick:S.tick})');
  assert.equal(run(`selEnemy(${stage-1})`),true);
  run('openBattle()');assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){
    assert.equal(run('__step()'),true,`${profile} ${stage} ${variant} ${seed}`);callbacks++;
  }
  assert.ok(callbacks<3000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({army:armyCount(),deployed:formSoldierCount(),tick:S.tick,
    round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    cleared:S.defeated.includes(${stage})})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.cleared,stage<100||won);
  const raw=env.store.get('rts_save'),reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  assert.equal(reload.run(`S.defeated.includes(${stage})`),after.cleared);
  return{profile,stage,variant,seed,enemy,won,loss:before.deployed-after.deployed,
    afterDeployed:after.deployed,enemyRemainingHp:after.enemyHp,round:after.round,callbacks};
}
const rows=[];
for(const profile of Object.keys(inputs))for(const stage of Object.keys(target).map(Number))
  for(const variant of stage===100?['formal','candidate','boss200','boss220','boss250']:['formal','candidate'])
    for(let seed=1;seed<=seeds;seed++)
    rows.push(fight(profile,stage,variant,seed));
const summary=[];
for(const profile of Object.keys(inputs))for(const stage of Object.keys(target).map(Number))
  for(const variant of stage===100?['formal','candidate','boss200','boss220','boss250']:['formal','candidate']){
    const group=rows.filter(r=>r.profile===profile&&r.stage===stage&&r.variant===variant);
    const wins=group.filter(r=>r.won),losses=group.filter(r=>!r.won);
    summary.push({profile,stage,variant,enemy:group[0].enemy.after,wins:wins.length,of:seeds,
      meanWinLoss:wins.length?wins.reduce((a,r)=>a+r.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(r=>r.loss)):null,
      meanLossRemainingHp:losses.length?losses.reduce((a,r)=>a+r.enemyRemainingHp,0)/losses.length:null});
  }
const out={kind:'isolate paid-input battle sensitivity; no paid quantum first-clear',
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  seedCount:seeds,target,
  inputs:Object.fromEntries(Object.entries(inputs).map(([k,{raw,...meta}])=>[k,meta])),
  sourceHashes,summary,rows};
const output=path.join(dataDir,`p-stage100-terminal-bridge-agent-${seeds}seeds.json`);
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
for(const {file,sha256} of Object.values(out.inputs))
  assert.equal(hash(fs.readFileSync(path.join(dataDir,file),'utf8')),sha256);
for(const x of sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,x.file))),x.sha256,x.file);
console.log(JSON.stringify({output,seedCount:seeds,summary},null,2));
