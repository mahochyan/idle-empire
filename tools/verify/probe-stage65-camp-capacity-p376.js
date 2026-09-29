'use strict';
// P376: bounded, legally paid L65 -> infantry camp T2 -> first capacity wall.
// No resource, science, population, soldier, victory, or enemy injection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sourceFile='p375-stage65-lowtech-paid-entry.json';
const sourceRaw=fs.readFileSync(path.join(data,sourceFile),'utf8');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha(sourceRaw),'3807ece70ee164b57448c31a01ccf06af666b08274b81209fcbb87e9195826b3');

function boot(raw){
  const world=environment({rts_save:raw}),{run}=world;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  const ts=JSON.parse(raw).ts,tick=run('S.tick');
  run(`globalThis.__Date=Date;globalThis.Date=class extends __Date {
      static now(){return ${ts}+(S.tick-${tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const item=__timers.entries().next().value;if(!item)return false;
      __timers.delete(item[0]);item[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));`);
  return world;
}
function state(run){
  return run(`({tick:S.tick,defeated:S.defeated.length,sciences:[...S.sciences],
    population:popCurrent(),army:armyCount(),deployed:formSoldierCount(),
    infantryOwned:(S.pool.infantry_t1||0)+expeditionCount('infantry_t1')+garrisonCount('infantry_t1'),
    resources:Object.fromEntries(['wood','stone','food','tech'].map(r=>[r,S.res[r]])),
    caps:Object.fromEntries(['wood','stone','food','tech'].map(r=>[r,resCap(r)])),
    warehouse:bldSt('warehouse').lv,stoneStore:bldSt('stone_store').lv,
    granary:bldSt('large_granary').lv,
    camp:{...bldSt('infantry_camp')},workers:{...S.popAlloc}})`);
}
function saved(world,name){
  assert.equal(world.run('save().ok'),true);
  const raw=world.store.get('rts_save');
  fs.writeFileSync(path.join(data,name),raw);
  const reload=boot(raw);
  assert.equal(reload.run('S.defeated.length'),world.run('S.defeated.length'));
  assert.equal(reload.run('armyCount()'),world.run('armyCount()'));
  assert.equal(reload.run('S.buildings.infantry_camp.tier'),world.run('S.buildings.infantry_camp.tier'));
  assert.equal(JSON.stringify(reload.run('S.sciences')),JSON.stringify(world.run('S.sciences')));
  assert.equal(reload.run('S.buildings.stone_store?.lv||0'),world.run('S.buildings.stone_store?.lv||0'));
  for(const key of ['wood','stone','food','tech'])
    assert.equal(reload.run(`S.res.${key}`),world.run(`S.res.${key}`));
  return{file:name,sha256:sha(raw),state:state(world.run)};
}
function finish(run,key){
  const result=run(`(()=>{let seconds=0;while(S.buildings['${key}']?.state!=='idle'&&seconds<300){tick();seconds++}
    return{seconds,idle:S.buildings['${key}']?.state==='idle'}})()`);
  assert.equal(result.idle,true,`${key}建造未完成`);
  return result.seconds;
}

const world=boot(sourceRaw),{run}=world;
assert.equal(run('S.defeated.length'),64);
assert.equal(run('S.sciences.length'),8);
assert.equal(run('Object.values(CFG.enemies[64].units).flat().reduce((n,x)=>n+x,0)'),48);
const start=state(run);
run(`globalThis.__rng=1;Math.random=()=>{let x=__rng;
  x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
run('selEnemy(64);openBattle()');
assert.equal(run('S.battleActive'),true);
assert.equal(run('B.enemyUnits.reduce((n,u)=>n+u.initialCount,0)'),48);
let callbacks=0;
while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run('S.defeated.includes(65)'),true);
const battle={seed:1,callbacks,round:run('B.round'),after:state(run)};
run('exitBattle()');
const won=saved(world,'p376-stage65-lowtech-paid-win-save.json');

const t2Before=state(run),t2TrainCapBefore=run("unitCap('infantry_t1')"),
  t2Cost=run("tierUpgradeCost('infantry_camp')");
assert.deepEqual(JSON.parse(JSON.stringify(t2Cost)),{wood:2000,stone:1500,food:1000,time:45});
assert.equal(run("tierUpgradeLockReason('infantry_camp')"),'');
const t2Payment=run("buildTierUpgradeAct('infantry_camp')");
assert.equal(t2Payment.ok,true);
const t2Paid=state(run);
for(const key of ['wood','stone','food'])
  assert.equal(t2Before.resources[key]-t2Paid.resources[key],t2Cost[key]);
const t2Seconds=finish(run,'infantry_camp');
assert.equal(run('S.buildings.infantry_camp.tier'),2);
const t2TrainCapAfter=run("unitCap('infantry_t1')");
assert.equal(t2TrainCapAfter,t2TrainCapBefore,'营地时代升阶不应直接改变既有兵种上限');
const t2=saved(world,'p376-infantry-camp-t2-paid-save.json');
assert.equal(t2Seconds,45);
assert.equal(t2.state.infantryOwned,0,'营地升阶应按现行规则退还旧兵');

const t3Cost=run("tierUpgradeCost('infantry_camp')"),caps=state(run).caps;
assert.deepEqual(JSON.parse(JSON.stringify(t3Cost)),{wood:8000,stone:9000,food:5200,time:90});
assert.ok(t3Cost.wood>caps.wood&&t3Cost.stone>caps.stone&&t3Cost.food>caps.food);
const t3Reason=run("tierUpgradeLockReason('infantry_camp')");
const t3Attempt=run("buildTierUpgradeAct('infantry_camp')");
assert.equal(t3Attempt.ok,false);
assert.equal(run('S.buildings.infantry_camp.tier'),2);

const research=[];
for(const id of ['sci_copper_furnace','sci_stone_store']){
  const before=state(run),result=run(`researchScience('${id}')`);
  assert.equal(result.ok,true,`${id}实际研究失败`);
  assert.equal(run(`S.sciences.includes('${id}')`),true);
  research.push({id,configuredCost:run(`activeSciences()['${id}'].cost`),beforeTech:before.resources.tech,
    afterTech:run('S.res.tech')});
}
assert.equal(run('S.res.tech'),start.resources.tech-1800);
const storageBefore=state(run),stoneStoreCost=run("buildingInitialCost('stone_store')");
const storePayment=run("buildAct('stone_store')");
assert.equal(storePayment.ok,true);
const storePaid=state(run);
assert.equal(storageBefore.resources.stone-storePaid.resources.stone,stoneStoreCost.stone);
const storeSeconds=finish(run,'stone_store');
assert.equal(run('S.buildings.stone_store.lv'),1);
const store=saved(world,'p376-stone-store-lv1-paid-save.json');

for(const [key,value] of Object.entries({...store.state.workers}))if(value>0)
  assert.equal(run(`setPopAlloc('${key}',0)`).ok,true);
for(const [key,value] of Object.entries({wood:8,stone:6,food:8}))
  assert.equal(run(`setPopAlloc('${key}',${value})`).ok,true);
assert.equal(run('popAllocTotal()'),22);
const rates=run("({wood:prodRate('wood'),stone:prodRate('stone'),food:prodRate('food')})");
const onlineBefore=state(run);
run('(()=>{for(let i=0;i<60;i++)tick()})()');
const onlineAfter=state(run);
const online=saved(world,'p376-online-production-60s-save.json');
assert.equal(onlineAfter.tick-onlineBefore.tick,60);
const t4Cost=run('CFG.buildings.infantry_camp.tierUpgrade[3].cost');
const tier4Units=run("Object.entries(CFG.units).filter(([id,u])=>baseUnitType(id)==='infantry'&&u.tier===4).map(([id])=>id)");
assert.equal(tier4Units.length,0);
const report={batch:'P376',source:{file:sourceFile,sha256:sha(sourceRaw),state:start},
  stage65:{battle,won},t2:{before:t2Before,cost:t2Cost,payment:t2Payment,paid:t2Paid,
    seconds:t2Seconds,trainCapBefore:t2TrainCapBefore,trainCapAfter:t2TrainCapAfter,save:t2},
  firstWall:{cost:t3Cost,caps,reason:t3Reason,attempt:t3Attempt,
    exceedsCaps:['wood','stone','food'].filter(r=>t3Cost[r]>caps[r])},
  legalNext:{research,storeBefore:storageBefore,stoneStoreCost,storePayment,storePaid,
    storeSeconds,store,granaryScienceHeld:run("scienceUnlocked('sci_large_granary')"),
    granaryBuildCost:run("buildingInitialCost('large_granary')")},
  online:{seconds:60,rates,before:onlineBefore,after:onlineAfter,save:online},
  t4:{cost:t4Cost,tier4Units},
  sourceHashes:Object.fromEntries(['config.js','levels.js','math.js','technology.js','tests/progression/harness.js',
    'tools/verify/probe-stage65-camp-capacity-p376.js'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),
  scope:'Real paid L65 battle, tier upgrade, research, storage build, worker allocation and 60 online ticks. No offline simulation or T3/T4 payment. Isolated in-memory rts_save; no player save touched.'};
fs.writeFileSync(path.join(data,'p376-camp-capacity.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:report.source.file,win:won.state.defeated,t2:t2.state.camp.tier,
  t3Wall:report.firstWall,sciences:store.state.sciences.length,store:store.state.stoneStore,
  caps:store.state.caps,online:{seconds:60,rates,delta:Object.fromEntries(['wood','stone','food']
    .map(r=>[r,onlineAfter.resources[r]-onlineBefore.resources[r]]))},t4:report.t4},null,2));
