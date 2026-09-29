'use strict';
// True stage-90 first-entry sensitivity from paid stage-89 checkpoints.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const names={
  low:'p-stage90-entry-low-paid-save.json',
  midPreNuclear:'p-stage90-entry-mid-prenuclear-paid-save.json',
  midNuclear:'p-stage90-entry-mid-fulltech-paid-save.json'
};
const inputs=Object.fromEntries(Object.entries(names)
  .filter(([,file])=>fs.existsSync(path.join(dataDir,file)))
  .map(([profile,file])=>{const raw=fs.readFileSync(path.join(dataDir,file),'utf8');
    return[profile,{file,sha256:hash(raw),raw}]}));
assert.ok(inputs.midPreNuclear&&inputs.midNuclear);
const perGroup=[1,3,5,7,10,13,15,20];
const seedCount=process.argv.includes('--pilot')?4:16;
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage90-first-entry-agent.js'];
const sourceHashes=sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
function setup(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;
      __timers.delete(x[0]);x[1]();return true};
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
function fight(profile,scale,seed){
  const env=environment({rts_save:inputs[profile].raw}),run=env.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  assert.equal(run('S.defeated.includes(89)'),true);
  assert.equal(run('S.defeated.includes(90)'),false);
  setup(run,seed);
  if(scale!==1)run(`CFG.enemies[89].units=Object.fromEntries(
    Object.entries(CFG.enemies[89].units).map(([key,groups])=>
      [key,groups.map(()=>${scale})]));`);
  const before=run('({army:armyCount(),deployed:formSoldierCount(),tick:S.tick})');
  assert.equal(run('campaignStageSelectable(89)'),true);
  assert.equal(run('selEnemy(89)'),true);
  run('openBattle()');assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run('({army:armyCount(),deployed:formSoldierCount(),tick:S.tick,round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),cleared:S.defeated.includes(90)})');
  assert.equal(after.tick,before.tick);
  assert.equal(after.cleared,won);
  const raw=env.store.get('rts_save'),reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.defeated.includes(90)'),won);
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  return{profile,perGroup:scale,enemy:scale*11,seed,won,
    army:before.army,deployed:before.deployed,loss:before.deployed-after.deployed,
    round:after.round,enemyRemainingHp:after.enemyHp,callbacks};
}
const rows=[];
for(const profile of Object.keys(inputs))for(const scale of perGroup)
  for(let seed=1;seed<=seedCount;seed++)rows.push(fight(profile,scale,seed));
const summary=[];
for(const profile of Object.keys(inputs))for(const scale of perGroup){
  const group=rows.filter(x=>x.profile===profile&&x.perGroup===scale);
  const wins=group.filter(x=>x.won),losses=group.filter(x=>!x.won);
  summary.push({profile,perGroup:scale,enemy:scale*11,wins:wins.length,of:seedCount,
    meanWinLoss:wins.length?wins.reduce((a,x)=>a+x.loss,0)/wins.length:null,
    maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
    meanLossRemainingHp:losses.length?losses.reduce((a,x)=>a+x.enemyRemainingHp,0)/losses.length:null});
}
const report={kind:'real paid first-entry stage-90 battle under isolated enemy-count variants',
  head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  seedCount,perGroup,inputs:Object.fromEntries(Object.entries(inputs).map(([k,{raw,...v}])=>[k,v])),
  sourceHashes,summary,rows};
const output=path.join(dataDir,`p-stage90-first-entry-agent-${seedCount}seeds.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
for(const {file,sha256} of Object.values(report.inputs))
  assert.equal(hash(fs.readFileSync(path.join(dataDir,file),'utf8')),sha256);
for(const x of sourceHashes)assert.equal(hash(fs.readFileSync(path.join(root,x.file))),x.sha256,x.file);
console.log(JSON.stringify({output,seedCount,summary},null,2));
