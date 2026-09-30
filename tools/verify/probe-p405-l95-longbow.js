'use strict';
// Paid T3 archer continuation from the independently reloadable L94 victory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const output='docs/codex/reports/data';
const input=`${output}/p405-mainline-l81-onward-final-save.json`;
const sources=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const hashBytes=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=f=>hashBytes(fs.readFileSync(path.join(root,f)));
const sourceHash=Object.fromEntries(sources.map(f=>[f,hash(f)]));
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(JSON.parse(raw).defeated.length,94);
const game=session(raw),steps=[];
const save=(name)=>{
  const rel=`${output}/${name}`,data=game.saveReload(name);
  fs.writeFileSync(path.join(root,rel),data+'\n');
  return{path:rel,sha256:hash(rel)};
};
const build=(key)=>{
  const start=game.run(`S.buildings.${key}?.lv||0`);
  const cost=game.run(`upCost('${key}')`);
  const need=Object.fromEntries(Object.entries(cost).filter(([k])=>k!=='time'));
  let waited=0;
  while(Object.entries(need).some(([k,v])=>game.run(`S.res.${k}`)<v)&&waited<10000){game.wait(10);waited+=10}
  assert.ok(waited<10000,`resources for ${key} ${JSON.stringify(need)}`);
  assert.equal(game.run(`buildAct('${key}').ok`),true,`build ${key}`);
  let time=0;
  while(game.run(`S.buildings.${key}.state`)!=='idle'&&time<200){game.wait(10);time+=10}
  assert.equal(game.run(`S.buildings.${key}.lv`),start+1);
  game.saveReload(`build ${key} ${start+1}`);
  steps.push({action:'build',key,from:start,to:start+1,cost:need,waited,buildSeconds:time});
};
let failure=null,ready=null,battle=null,final=null;
try{
  game.setWorkers({food:12,wood:4,stone:3});
  while(game.run("resCap('stone')")<8000)build('warehouse');
  const tierCost=game.run("tierUpgradeCost('archer_range')");
  let waited=0;
  while(Object.entries(tierCost).filter(([k])=>k!=='time').some(([k,v])=>game.run(`S.res.${k}`)<v)&&waited<10000){game.wait(10);waited+=10}
  assert.ok(waited<10000,'resources for archer T3');
  assert.equal(game.run("buildTierUpgradeAct('archer_range').ok"),true,'archer T3 paid');
  let tierSeconds=0;
  while(game.run("S.buildings.archer_range.state")!=='idle'&&tierSeconds<200){game.wait(10);tierSeconds+=10}
  assert.equal(game.run("S.buildings.archer_range.tier"),3);
  steps.push({action:'archer T3',cost:tierCost,waited,tierSeconds});
  build('archer_range');
  game.setWorkers({food:14,wood:2,stone:2,tech:1});
  let scholarSeconds=0;
  while(game.run('S.res.tech')<1000&&scholarSeconds<2000){game.wait(10);scholarSeconds+=10}
  assert.ok(game.run('S.res.tech')>=1000,'earned 1000 knowledge');
  steps.push({action:'scholar',seconds:scholarSeconds,tech:game.run('S.res.tech')});
  game.setWorkers({food:12,wood:4,stone:3});
  let researchWait=0;
  const researchCost={wood:2000,stone:1200,food:1500};
  while(Object.entries(researchCost).some(([k,v])=>game.run(`S.res.${k}`)<v)&&researchWait<2000){game.wait(10);researchWait+=10}
  assert.ok(researchWait<2000,'longbow material');
  assert.equal(game.run("upgradeUnit('archer_silverbow','archer_longbow').ok"),true,'longbow paid research');
  steps.push({action:'research longbow',cost:{...researchCost,tech:1000,merit:20,bow_essence:3},waited:researchWait});
  game.saveReload('longbow researched');
  const fills=[];
  for(const [type,target,workers]of [
    ['archer_longbow',60,{food:13,wood:4,stone:2}],
    ['bronze_guard',20,{food:11,coal:4,copper:2,stone:2}],
    ['iron_spearman',20,{food:11,coal:2,iron:2,stone:2,wood:2}],
    ['silver_heavy',40,{food:14,coal:1,silver:1,stone:1,wood:2}],
    ['gold_cavalry',29,{food:14,coal:1,gold:1,stone:1,wood:2}]])
    fills.push(game.fill(type,target,workers));
  steps.push({action:'train',fills,charges:game.charges()});
  const army=[['front','gold_cavalry',15],['front','gold_cavalry',14],
    ['front','silver_heavy',15],['front','silver_heavy',15],
    ['mid','silver_heavy',10],['mid','iron_spearman',10],
    ['mid','iron_spearman',10],['mid','bronze_guard',15],
    ['back','archer_longbow',15],['back','archer_longbow',15],
    ['back','archer_longbow',15],['back','archer_longbow',15]];
  game.form(army);
  ready=save('p405-l95-longbow-ready-save.json');
  const bowBefore=game.own('archer_longbow');
  battle=game.battle(95);
  battle.losses.archer_longbow=bowBefore-game.own('archer_longbow');
  final=save('p405-l95-longbow-final-save.json');
  console.log(JSON.stringify({won:battle.won,round:battle.round,armyAfter:battle.armyAfter,online:game.online(),ready,battle}));
}catch(error){failure=String(error.stack||error);console.error(failure)}
const summary={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'Actual paid building upgrades, T3 promotion, scholar knowledge, unit research, queued training, modal formation, fixed 0.5 battle callbacks and independent v36 reload',
  units:'online is simulated tick seconds; battleMs is simulated callback milliseconds; menu actions instant in harness',
  steps,totalOnline:game.online(),paidTraining:game.charges(),ready,battle,final,failure};
fs.writeFileSync(path.join(root,output,'p405-l95-longbow.json'),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sources.map(f=>[f,hash(f)])),sourceHash);
if(failure)process.exitCode=1;
