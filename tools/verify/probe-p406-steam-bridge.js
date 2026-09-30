'use strict';
// P406: continue the paid P405 L95 alloy save through real storage and science actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const outDir='docs/codex/reports/data';
const input=`${outDir}/p405-terminal-science-alloy-paid-save.json`;
const inputHash='06d12742f9dadc4fe06f2d7c299d7707cb07e566b18ada88a0b391ae35979cb0';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
assert.equal(hash(input),inputHash,'P405 alloy save changed');
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const s=session(raw),run=s.run;
assert.equal(run('S.defeated.length'),95);
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const copy=x=>JSON.parse(JSON.stringify(x));
const snap=()=>copy(run(`({tick:S.tick,defeated:S.defeated.length,pop:popCurrent(),
  resources:{wood:S.res.wood,stone:S.res.stone,food:S.res.food,tech:S.res.tech,
    coal:S.res.coal,iron:S.res.iron,steel:S.res.steel,gold:S.res.gold,medal:S.res.medal},
  caps:Object.fromEntries(['wood','stone','food','tech','coal','iron','steel','gold']
    .map(k=>[k,resCap(k)])),
  levels:{warehouse:bldSt('warehouse').lv,academy:bldSt('academy').lv,
    library:bldSt('library').lv,ironStore:bldSt('iron_store').lv,
    steelStore:bldSt('steel_store').lv,storageMastery:S.storageMasteryLv},
  sciences:[...S.sciences]})`));
const report={batch:'P406-steam-bridge',baselineHead:'6a2d124b50af4d1a063400491a747cfc6ae8267d',
  input,inputHash,sources,
  method:'one same-save route: actual setPopAlloc, online tick, building and science payment, independent v36 reload; fixed RNG 0.5, garrison frozen',
  units:'simulated online tick seconds, menu actions instant, offline seconds zero',
  initial:snap(),clock:{onlineSeconds:0,offlineSeconds:0},minimumFood:run('S.res.food'),
  events:[],checkpoints:{},stop:null};
const maxOnline=120000;
function mark(kind,details={}){
  const state=snap();
  report.events.push({kind,online:report.clock.onlineSeconds,
    after:{tick:state.tick,food:state.resources.food,tech:state.resources.tech,
      iron:state.resources.iron,steel:state.resources.steel,
      techCap:state.caps.tech,steelCap:state.caps.steel},...details});
}
function waitUntil(expression,max,label){
  let elapsed=0;
  while(!run(expression)&&elapsed<max&&report.clock.onlineSeconds<maxOnline){
    s.wait(10);elapsed+=10;report.clock.onlineSeconds+=10;
    report.minimumFood=Math.min(report.minimumFood,run('S.res.food'));
    assert.ok(run('S.res.food')>0,`${label}: food exhausted`);
  }
  if(!run(expression))throw Error(`${label}: timed out after ${elapsed}s (online ${report.clock.onlineSeconds})`);
  return elapsed;
}
function assign(target){s.setWorkers(target);const net=run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost");
  assert.ok(net>0,`food net ${net} under ${JSON.stringify(target)}`)}
function paidScience(id){
  const cost=copy(run(`({...activeSciences()['${id}'].cost})`));
  assert.ok(cost.tech<=run("resCap('tech')"),`${id} knowledge cap`);
  const wait=waitUntil(`S.res.tech>=${cost.tech}`,20000,`${id} knowledge`);
  const before=snap(),result=copy(run(`researchScience('${id}')`));
  assert.equal(result.ok,true,`${id} refused: ${JSON.stringify(result)}`);
  assert.equal(run(`scienceUnlocked('${id}')`),true);
  s.saveReload(id);mark('science',{id,cost,wait,techBefore:before.resources.tech,result});
}
function masteryTo(level){
  while(run('S.storageMasteryLv')<level){
    const cost=copy(run('storageMasteryCost()'));
    assert.ok(cost.tech<=run("resCap('tech')"));
    const wait=waitUntil(`S.res.tech>=${cost.tech}`,20000,'storage mastery knowledge');
    const result=copy(run('upgradeStorageMastery()'));
    assert.equal(result.ok,true,`storage mastery ${JSON.stringify(result)}`);
    mark('storage-mastery',{level:result.level,cost,wait});
  }
  s.saveReload('storage mastery '+level);
}
function build(key){
  const current=run(`bldSt('${key}').lv`),target=current+1;
  const cost=copy(run(`({...${current?'upCost': 'buildingInitialCost'}('${key}')})`));
  assert.equal(run(`upgradeLockReason('${key}')`),'',`${key} upgrade lock`);
  for(const [rk,n]of Object.entries(cost))if(rk!=='time')
    assert.ok(n<=run(`resCap('${rk}')`),`${key} Lv${target} ${rk} ${n} > cap`);
  const condition=Object.entries(cost).filter(([rk])=>rk!=='time')
    .map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&')||'true';
  assert.equal(run(condition),true,`${key} Lv${target} materials missing`);
  const result=copy(run(`buildAct('${key}')`));
  assert.equal(result.ok,true,`${key} Lv${target} ${JSON.stringify(result)}`);
  const seconds=waitUntil(`bldSt('${key}').lv>=${target}&&bldSt('${key}').state==='idle'`,300,
    `${key} Lv${target} construction`);
  s.saveReload(`${key} Lv${target}`);
  mark('build',{key,level:target,cost,constructionSeconds:seconds});
}
function buildWithFunds(key,workers,label){
  const level=run(`bldSt('${key}').lv`)+1;
  const cost=copy(run(`({...${level===1?'buildingInitialCost':'upCost'}('${key}')})`));
  for(const [rk,n]of Object.entries(cost))if(rk!=='time')
    assert.ok(n<=run(`resCap('${rk}')`),`${label} ${rk} ${n} > cap`);
  assign(workers);
  const needed=Object.entries(cost).filter(([rk])=>rk!=='time')
    .map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&')||'true';
  waitUntil(needed,30000,`${label} materials`);
  build(key);
}
const techWorkers={food:4,wood:4,stone:3,tech:8};
const ironWorkers={food:4,stone:5,coal:5,iron:5};
const steelWorkers={food:4,stone:4,coal:5,iron:3,steel:3};
function fill(resource,amount,workers,label){
  assert.ok(amount<=run(`resCap('${resource}')`),`${label}: cap too small`);
  assign(workers);
  const seconds=waitUntil(`S.res.${resource}>=${amount}`,30000,label);
  mark('fill',{resource,amount,workers,seconds});
}
function checkpoint(label){
  const dest=`${outDir}/p406-${label}-save.json`;
  s.saveReload(label);
  fs.writeFileSync(path.join(root,dest),s.raw()+'\n');
  report.checkpoints[label]={path:dest,sha256:hash(dest),snapshot:snap()};
}
try{
  assign(techWorkers);
  paidScience('sci_workshop');
  masteryTo(5);
  fill('iron',200,ironWorkers,'first iron store materials');
  build('iron_store');
  fill('stone',run("resCap('stone')"),{food:4,stone:15},'steel preparation stone');
  fill('coal',run("resCap('coal')"),{food:4,coal:15},'steel preparation coal');
  fill('iron',800,ironWorkers,'steel preparation iron');
  fill('steel',200,steelWorkers,'first steel store steel');
  build('steel_store');
  checkpoint('first-steel-store');
  // Workshop expansion supplies real single-payment capacity for the steam science.
  while(run("bldSt('large_granary').lv")<6)
    buildWithFunds('large_granary',{food:4,wood:15},'large granary');
  while(run("bldSt('warehouse').lv")<70)
    buildWithFunds('warehouse',{food:4,wood:15},'basic warehouse');
  while(run("bldSt('academy').lv")<30)
    buildWithFunds('academy',{food:4,wood:7,stone:8},'academy');
  assert.ok(run("resCap('tech')")>=100000);
  fill('tech',100000,{food:4,tech:15},'steam knowledge single payment');
  const firstSteelRefusal=copy(run("researchScience('sci_steam_age')"));
  assert.equal(firstSteelRefusal.reason,'insufficient-resources');
  mark('steam-steel-refusal',{result:firstSteelRefusal});
  report.stop={kind:'steel-single-payment-capacity',
    remainingCapacity:10000-run("resCap('steel')"),
    remainingStock:10000-run('S.res.steel')};
}catch(error){report.stop={kind:'error',message:String(error.stack||error)}}
report.final=snap();
const steam=copy(run('({...activeSciences().sci_steam_age.cost})'));
report.steam={cost:steam,capacity:{tech:run("resCap('tech')"),steel:run("resCap('steel')")},
  resources:{tech:run('S.res.tech'),steel:run('S.res.steel')}};
if(!run("scienceUnlocked('sci_steam_age')")){
  const beforeRefusal=snap(),rawBefore=s.raw();
  report.steam.refusal=copy(run("researchScience('sci_steam_age')"));
  assert.deepEqual(snap(),beforeRefusal,'refused science mutated state');
  assert.equal(s.raw(),rawBefore,'refused science overwrote save');
}
checkpoint('steam-bridge-final');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sources);
fs.writeFileSync(path.join(root,`${outDir}/p406-steam-bridge.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({online:report.clock.onlineSeconds,
  levels:report.final.levels,caps:report.final.caps,
  resources:report.final.resources,steam:report.steam,
  checkpoints:Object.fromEntries(Object.entries(report.checkpoints).map(([k,v])=>[k,v.sha256])),
  stop:report.stop},null,2));
if(report.stop?.kind==='error')process.exitCode=1;
