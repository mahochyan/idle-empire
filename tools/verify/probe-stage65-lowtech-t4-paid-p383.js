'use strict';
// P383: legal paid storage and infantry-camp T3/T4 continuation from P376.
// Only real research/build/worker/tick/save actions; no state injection or offline shortcut.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sourceFile='p376-stone-store-lv1-paid-save.json';
const sourceRaw=fs.readFileSync(path.join(data,sourceFile),'utf8');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sha(sourceRaw),'1405bc9b34bd17d85b9cd1004cebbbc0c717f236053ec23e67f82bc79352c1c0');

function boot(raw){
  const world=environment({rts_save:raw}),{run}=world;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  const ts=JSON.parse(raw).ts,tick=run('S.tick');
  run(`globalThis.__Date=Date;globalThis.Date=class extends __Date {
      static now(){return ${ts}+(S.tick-${tick})*1000}};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));`);
  return world;
}
function state(run){
  return run(`({tick:S.tick,ts:Date.now(),defeated:S.defeated.length,sciences:[...S.sciences],
    population:popCurrent(),army:armyCount(),deployed:formSoldierCount(),
    infantryT3:Object.entries(CFG.units).filter(([uk,u])=>baseUnitType(uk)==='infantry'&&u.tier===3)
      .reduce((n,[uk])=>n+(S.pool[uk]||0)+expeditionCount(uk)+garrisonCount(uk),0),
    resources:Object.fromEntries(['wood','stone','food','tech'].map(r=>[r,S.res[r]])),
    caps:Object.fromEntries(['wood','stone','food','tech'].map(r=>[r,resCap(r)])),
    warehouse:bldSt('warehouse').lv,stoneStore:bldSt('stone_store').lv,
    granary:bldSt('large_granary').lv,camp:{...bldSt('infantry_camp')},workers:{...S.popAlloc}})`);
}
const world=boot(sourceRaw),{run}=world;
assert.equal(run('S.defeated.includes(65)'),true);
assert.equal(run('S.buildings.infantry_camp.tier'),2);
assert.equal(run('S.buildings.stone_store.lv'),1);
const start=state(run),events=[];
let onlineSeconds=0,allocationActions=0,buildActions=0;
const CAP_SECONDS=60000;

function saveCheckpoint(name){
  assert.equal(run('save().ok'),true);
  const raw=world.store.get('rts_save');
  fs.writeFileSync(path.join(data,name),raw);
  const fresh=boot(raw),actual=state(fresh.run),expected=state(run);
  for(const key of ['defeated','population','army','deployed','infantryT3','warehouse','stoneStore','granary'])
    assert.equal(actual[key],expected[key],`reload ${name}: ${key}`);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.resources)),JSON.parse(JSON.stringify(expected.resources)));
  assert.deepEqual(JSON.parse(JSON.stringify(actual.camp)),JSON.parse(JSON.stringify(expected.camp)));
  assert.deepEqual(JSON.parse(JSON.stringify(actual.sciences)),JSON.parse(JSON.stringify(expected.sciences)));
  return{file:name,sha256:sha(raw),state:expected};
}
function assign(target){
  const desired=target==='food'?{food:22}:{[target]:14,food:8};
  const current=state(run).workers;
  if(Object.keys(current).every(rk=>(current[rk]||0)===(desired[rk]||0)))return;
  for(const[rk,n]of Object.entries(current))if(n>0&&n!==(desired[rk]||0)){
    assert.equal(run(`setPopAlloc('${rk}',0).ok`),true,`unassign ${rk}`);allocationActions++;
  }
  for(const[rk,n]of Object.entries(desired))if(n>0&&run(`S.popAlloc['${rk}']||0`)!==n){
    assert.equal(run(`setPopAlloc('${rk}',${n}).ok`),true,`assign ${rk}`);allocationActions++;
  }
  assert.equal(run('popAllocTotal()'),22);
}
function tickUntil(expr,label,max=CAP_SECONDS){
  const before=run('S.tick');
  const result=run(`(()=>{let n=0;while(!(${expr})&&n<${max}){tick();n++}
    return{seconds:n,met:!!(${expr}),tick:S.tick}})()`);
  onlineSeconds+=result.seconds;
  assert.equal(result.tick-before,result.seconds);
  assert.equal(result.met,true,`${label} at ${result.seconds} seconds`);
  assert.ok(onlineSeconds<=CAP_SECONDS,`total online bound ${onlineSeconds}`);
  return result.seconds;
}
function costFor(kind,key){return run(kind==='tier'?`tierUpgradeCost('${key}')`:
  `bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}')`)}
function ensurePayment(cost,label){
  const caps=state(run).caps;
  for(const[rk,amount]of Object.entries(cost))if(rk!=='time')
    assert.ok(amount<=caps[rk],`${label}: ${rk} cost ${amount} exceeds cap ${caps[rk]}`);
  let waited=0;
  for(const rk of ['stone','wood','food']){
    const amount=cost[rk]||0;
    if(run(`S.res.${rk}`)>=amount)continue;
    assign(rk);
    waited+=tickUntil(`S.res.${rk}>=${amount}`,`${label} ${rk}`);
  }
  return waited;
}
function pay(kind,key){
  const label=kind==='tier'?`${key} T${run(`bldSt('${key}').tier`)+1}`:
    `${key} Lv${run(`bldSt('${key}').lv`)+1}`;
  const cost=costFor(kind,key),waitSeconds=ensurePayment(cost,label),before=state(run);
  const result=run(kind==='tier'?`buildTierUpgradeAct('${key}')`:`buildAct('${key}')`);
  assert.equal(result?.ok,true,`${label} payment: ${JSON.stringify(result)}`);
  const paid=state(run);
  for(const[rk,amount]of Object.entries(cost))if(rk!=='time')
    assert.ok(Math.abs(before.resources[rk]-paid.resources[rk]-amount)<1e-6,
      `${label}: ${rk} charged exactly once`);
  let duplicate=null;
  if(kind==='tier'){
    duplicate=run(`buildTierUpgradeAct('${key}')`);
    assert.equal(duplicate?.ok,false,`${label}: busy repeat must fail`);
    assert.deepEqual(JSON.parse(JSON.stringify(state(run).resources)),
      JSON.parse(JSON.stringify(paid.resources)),`${label}: busy repeat must not charge twice`);
  }
  const constructionSeconds=tickUntil(`bldSt('${key}').state==='idle'`,`${label} construction`,Math.max(1,cost.time+1));
  assert.equal(constructionSeconds,cost.time);
  const after=state(run);
  if(kind==='tier')assert.equal(after.camp.tier,before.camp.tier+1);
  else assert.equal(after[key==='stone_store'?'stoneStore':'granary'],
    before[key==='stone_store'?'stoneStore':'granary']+1);
  const event={label,cost,waitSeconds,constructionSeconds,before,paid,duplicate,after};
  events.push(event);buildActions++;
  console.log(`${label}: wait ${waitSeconds}s + build ${constructionSeconds}s, caps ${after.caps.wood}/${after.caps.stone}/${after.caps.food}`);
  return event;
}

// T2 -> T3: upgrade caps through real wood/stone/food warehouse construction.
while(run('bldSt("stone_store").lv')<8)pay('building','stone_store');
while(run('bldSt("large_granary").lv')<2)pay('building','large_granary');
const preT3=saveCheckpoint('p383-t3-capacity-paid-save.json');
assert.ok(['wood','stone','food'].every(rk=>run(`resCap('${rk}')`)>=costFor('tier','infantry_camp')[rk]));
pay('tier','infantry_camp');
const t3=saveCheckpoint('p383-infantry-camp-t3-paid-save.json');

// T3 -> T4: current rules have no T4 infantry unit; verify real paid path and preserve existing army.
while(run('bldSt("stone_store").lv')<21)pay('building','stone_store');
while(run('bldSt("large_granary").lv')<6)pay('building','large_granary');
const preT4=saveCheckpoint('p383-t4-capacity-paid-save.json');
const armyBeforeT4=run('armyCount()'),t3BeforeT4=state(run).infantryT3;
pay('tier','infantry_camp');
const t4=saveCheckpoint('p383-infantry-camp-t4-paid-save.json');
assert.equal(t4.state.army,armyBeforeT4);
assert.equal(t4.state.infantryT3,t3BeforeT4);
assert.equal(run("Object.entries(CFG.units).filter(([uk,u])=>baseUnitType(uk)==='infantry'&&u.tier===4).length"),0);

const report={batch:'P383',source:{file:sourceFile,sha256:sha(sourceRaw),state:start},
  method:'Real buildAct/buildTierUpgradeAct/setPopAlloc/tick/save/loadSaveAndApply only; no resource or state injection; garrison ticking disabled by harness.',
  units:{time:'seconds',resources:'game units',population:'people'},
  totals:{onlineSeconds,allocationActions,buildActions},checkpoints:{preT3,t3,preT4,t4},events,
  t4NoInfantry:true,t4ArmyPreserved:armyBeforeT4===t4.state.army,
  sourceHashes:Object.fromEntries(['config.js','levels.js','math.js','technology.js','tests/progression/harness.js',
    'tools/verify/probe-stage65-lowtech-t4-paid-p383.js'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]))};
fs.writeFileSync(path.join(data,'p383-stage65-lowtech-t4-paid.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:sourceFile,onlineSeconds,buildActions,allocationActions,
  t3:{file:t3.file,camp:t3.state.camp.tier,army:t3.state.army},
  t4:{file:t4.file,camp:t4.state.camp.tier,army:t4.state.army,caps:t4.state.caps,
    resources:t4.state.resources}},null,2));
