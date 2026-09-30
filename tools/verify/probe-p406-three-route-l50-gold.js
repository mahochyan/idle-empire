'use strict';
// One paid gold-army continuation from each independent P406 L49 winner.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {session,hashBytes,hash}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const dir='docs/codex/reports/data';
const route=process.argv[2];
assert.ok(['short-session','balanced','military'].includes(route),'pass a route name');
const input=`${dir}/p406-${route}-l49-won-save.json`;
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',
  'tools/verify/probe-p406-three-route-l50-gold.js',input];
const sources=Object.fromEntries(files.map(file=>[file,hash(file)]));
assert.equal(hashBytes(raw+'\n'),sources[input]);
const s=session(raw);
assert.equal(s.run('S.defeated.length'),49,'L49 input required');
const initialTick=s.run('S.tick');
const actions=[];
const plain=x=>JSON.parse(JSON.stringify(x));
function action(expr,label){
  const before=s.state(),result=plain(s.run(expr));
  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
  s.saveReload(label);
  actions.push({label,online:s.online(),result,resBefore:before.res,resAfter:s.state().res});
  return result;
}
function until(expr,limit,label){
  let waited=0;
  while(!s.run(expr)&&waited<limit){s.wait(10);waited+=10}
  assert.equal(!!s.run(expr),true,`${label}: timed out after ${waited}s`);
  actions.push({label:`wait ${label}`,seconds:waited,online:s.online()});
  return waited;
}
function build(key,target){
  while(s.run(`bldSt('${key}').lv`)<target){
    const next=s.run(`bldSt('${key}').lv`)+1;
    until(`(()=>{const c=bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}');
      return Object.entries(c).every(([rk,n])=>rk==='time'||S.res[rk]>=n)})()`,
      30000,`${key} Lv${next} materials`);
    action(`buildAct('${key}')`,`${key} Lv${next} payment`);
    until(`bldSt('${key}').lv>=${next}&&bldSt('${key}').state==='idle'`,300,
      `${key} Lv${next} completion`);
  }
}
const army=[['front','gold_cavalry',10],['front','gold_cavalry',7],
  ['front','silver_heavy',10],['front','silver_heavy',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10],
  ['back','archer_silverbow',10],['back','archer_silverbow',10]];
let battle=null,failure=null,failureState=null;
try{
  s.setWorkers({tech:10,food:9});
  until('S.res.tech>=200',1000,'library research knowledge');
  action("researchScience('sci_library')",'library science');
  s.setWorkers({wood:5,stone:5,food:9});
  build('library',10);
  assert.ok(s.run("resCap('tech')")>=7000,'gold research knowledge capacity');
  s.setWorkers({tech:10,food:9});
  for(const [id,cost] of [['sci_gold',6000],['sci_gold_age',7000]]){
    until(`S.res.tech>=${cost}`,20000,`${id} knowledge`);
    action(`researchScience('${id}')`,`${id} payment`);
  }
  s.setWorkers({wood:5,stone:5,food:9});
  build('farm',5);
  build('gold_armory',4);
  build('silver_armory',2);
  assert.ok(s.run("unitCap('gold_cavalry')")>=17);
  assert.ok(s.run("unitCap('silver_heavy')")>=20);
  const fills=[
    s.fill('archer_silverbow',40,{food:13,wood:4,stone:2}),
    s.fill('gold_cavalry',17,{food:14,coal:1,stone:2,gold:2}),
    s.fill('silver_heavy',20,{food:14,coal:1,stone:2,silver:2}),
    s.fill('iron_spearman',20,{food:11,coal:2,iron:2,stone:2,wood:2}),
    s.fill('bronze_guard',20,{food:11,coal:4,copper:2,stone:2})
  ];
  actions.push({label:'paid fills complete',online:s.online(),fills,paidTraining:s.charges()});
  s.form(army);
  battle=s.battle(50);
}catch(error){
  failure=String(error.stack||error);
  failureState={state:s.state(),foodRate:s.run("prodRate('food')"),
    upkeep:s.run('totalUpkeep()'),farm:s.run("bldSt('farm').lv")};
}
const finalPath=`${dir}/p406-${route}-l50-gold-final-save.json`;
const summaryPath=`${dir}/p406-${route}-l50-gold.json`;
fs.writeFileSync(path.join(root,finalPath),s.raw()+'\n');
const summary={batch:'P406',route,input,sources,
  method:'One continuous paid L49 win save, true library/gold science, buildings, workers, production, queued training cost, formation and L50 battle/reload; Math.random=0.5',
  units:'online simulated explicit noncombat wait() seconds; totalTickSeconds also includes battle callback tick() calls; battle.battleMs is configured callback milliseconds; menu actions instantaneous; short-session-origin continuation online',
  actions,totalOnlineSeconds:s.online(),totalTickSeconds:s.run('S.tick')-initialTick,
  paidTraining:s.charges(),battle,
  finalPath,finalSha256:hash(finalPath),failure,failureState};
fs.writeFileSync(path.join(root,summaryPath),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(files.map(file=>[file,hash(file)])),sources,
  'input/source files changed during replay');
assert.equal(hashBytes(s.raw()+'\n'),summary.finalSha256,'final save mismatch');
if(failure){console.error(failure);process.exitCode=1}
else console.log(JSON.stringify({route,won:battle.won,round:battle.round,
  armyBefore:battle.armyBefore,armyAfter:battle.armyAfter,
  totalOnlineSeconds:s.online(),finalSha256:summary.finalSha256}));
