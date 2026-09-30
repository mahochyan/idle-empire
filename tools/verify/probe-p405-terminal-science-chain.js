'use strict';
// P405: follow the same paid L95 save toward the two L100 science gates.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const outDir='docs/codex/reports/data';
const input='docs/codex/reports/data/p405-l95-longbow-final-save.json';
const expected='cf2f221d0ed5a4d1ced5178acd5b3b41abe719554b1dcfea238cea6c3b04b7b5';
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
assert.equal(sha(input),expected);
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const s=session(raw),run=s.run;
assert.equal(run('S.defeated.length'),95);
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,sha(f)]));
const inspect=JSON.parse(run(`JSON.stringify({
  saveVersion:targetSaveVersion(),
  pop:popCurrent(),settlements:{...S.settlements},town:S.townLv,
  resources:{...S.res},alloc:{...S.popAlloc},
  caps:Object.fromEntries(['wood','stone','food','tech','coal','copper','iron','steel','medal']
    .map(k=>[k,resCap(k)])),
  rates:Object.fromEntries(['wood','stone','food','tech','coal','copper','iron','steel']
    .map(k=>[k,prodRate(k)])),upkeep:totalUpkeep(),
  library:{...bldSt('library'),cost:upCost('library'),lock:upgradeLockReason('library')},
  academy:{...bldSt('academy'),cost:upCost('academy'),lock:upgradeLockReason('academy')},
  science:Object.fromEntries(['sci_steel','sci_steel_store','sci_alloy_age','sci_steam_age',
    'sci_electric_age','sci_nuclear_age','sci_star_beast_domain','sci_star_array','sci_quantum_age']
    .map(id=>[id,{cost:activeSciences()[id].cost,need:activeSciences()[id].need||[],
      unlocked:scienceUnlocked(id)}]))})`));
const report={batch:'P405-terminal-science',input,inputSha256:expected,sources,
  method:'same paid L95 save, real worker assignment, tick production, building upgrade, science payment and v36 reload; fixed RNG 0.5, garrison frozen',
  units:'online tick seconds; menu actions instant; no offline settlement',
  initial:inspect,online:0,minimumFood:inspect.resources.food,events:[],failure:null};
const copy=x=>JSON.parse(JSON.stringify(x));
const snap=()=>copy(run(`({tick:S.tick,defeated:S.defeated.length,pop:popCurrent(),
  tech:S.res.tech,techCap:resCap('tech'),steel:S.res.steel,steelCap:resCap('steel'),
  food:S.res.food,wood:S.res.wood,stone:S.res.stone,iron:S.res.iron,
  merit:S.merit,medal:S.res.medal,library:bldSt('library').lv,
  sciences:[...S.sciences]})`));
let failure=null;
function waitUntil(expr,max,label){
  let seconds=0;
  while(!run(expr)&&seconds<max){
    s.wait(10);seconds+=10;
    report.minimumFood=Math.min(report.minimumFood,run('S.res.food'));
    if(run('S.res.food')<=0)throw Error(label+' exhausted food at '+seconds);
  }
  report.online+=seconds;
  if(!run(expr))throw Error(label+' timed out after '+seconds+'s: '+JSON.stringify(snap()));
  return seconds;
}
function libraryTo(level){
  while(run("bldSt('library').lv")<level){
    const next=run("bldSt('library').lv")+1;
    const cost=copy(run("({...upCost('library')})"));
    assert.equal(run("upgradeLockReason('library')"),'');
    for(const [rk,n]of Object.entries(cost))if(rk!=='time')
      assert.ok(n<=run(`resCap('${rk}')`),`library L${next} ${rk} exceeds cap`);
    const waiting=waitUntil(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}`,20000,
      `library L${next} materials`);
    const result=copy(run("buildAct('library')"));
    assert.equal(result.ok,true,`library L${next}: ${JSON.stringify(result)}`);
    const building=waitUntil(`bldSt('library').lv>=${next}&&bldSt('library').state==='idle'`,500,
      `library L${next} finish`);
    const after=snap();
    report.events.push({kind:'library',level:next,cost,waiting,building,online:report.online,
      techCap:after.techCap,food:after.food});
  }
  s.saveReload('library L'+level);
}
function payScience(id){
  const cost=copy(run(`({...activeSciences()['${id}'].cost})`));
  assert.ok(cost.tech<=run("resCap('tech')"),`${id} cost exceeds current knowledge cap`);
  const waiting=waitUntil(`S.res.tech>=${cost.tech}`,20000,`${id} knowledge`);
  const before=snap(),result=copy(run(`researchScience('${id}')`));
  assert.equal(result.ok,true,`${id}: ${JSON.stringify(result)}`);
  assert.equal(run(`scienceUnlocked('${id}')`),true);
  s.saveReload(id);
  const after=snap();
  report.events.push({kind:'science',id,cost,waiting,online:report.online,result,
    techBefore:before.tech,techAfter:after.tech,cap:before.techCap});
}
try{
  s.setWorkers({food:4,wood:4,stone:3,tech:8});
  report.workingRates=copy(run(`({food:prodRate('food'),wood:prodRate('wood'),
    stone:prodRate('stone'),tech:prodRate('tech'),upkeep:totalUpkeep()})`));
  assert.ok(report.workingRates.food-report.workingRates.upkeep-run('popCurrent()*CFG.popFoodCost')>0);
  libraryTo(20);
  payScience('sci_steel');
  payScience('sci_steel_store');
  libraryTo(25);
  payScience('sci_alloy_age');
}catch(error){failure=String(error.stack||error);report.failure=failure}
report.final=snap();
report.nextCost=copy(run("({...activeSciences().sci_steam_age.cost})"));
const refusedBefore=snap(),rawBeforeRefusal=s.raw();
report.nextAttempt=copy(run("researchScience('sci_steam_age')"));
assert.deepEqual(snap(),refusedBefore,'refused steam research mutated the state');
assert.equal(s.raw(),rawBeforeRefusal,'refused steam research overwrote the save');
report.nextCaps=copy(run(`({tech:resCap('tech'),steel:resCap('steel'),
  steelStoreInitial:buildingInitialCost('steel_store'),
  steamScienceNeed:activeSciences().sci_steam_age.need,
  stage100NeedSciences:CFG.enemies[99].needSciences,
  starArray:activeSciences().sci_star_array.cost,
  quantum:activeSciences().sci_quantum_age.cost})`));
assert.equal(report.nextAttempt.reason,'insufficient-tech');
s.saveReload('terminal science bridge');
const savePath=`${outDir}/p405-terminal-science-alloy-paid-save.json`;
fs.writeFileSync(path.join(root,savePath),s.raw()+'\n');
report.savePath=savePath;report.saveSha256=sha(savePath);
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,sha(f)])),sources);
fs.writeFileSync(path.join(root,`${outDir}/p405-terminal-science-bridge.json`),
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({online:report.online,events:report.events.filter(e=>e.kind==='science'),
  final:report.final,nextAttempt:report.nextAttempt,nextCaps:report.nextCaps,
  saveSha256:report.saveSha256,failure},null,2));
if(failure)process.exitCode=1;
