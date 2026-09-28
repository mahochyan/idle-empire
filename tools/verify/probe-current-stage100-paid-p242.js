'use strict';
// P242: restore the real P241 stage-99 roster with paid actions, then replay L100.
// All game storage stays in the progression harness; only a new P242 report is written.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputPath=path.join(root,'docs/codex/reports/data/p241-natural-campaign-stage99-save.json');
const outputPath=path.join(root,'docs/codex/reports/data/p242-current-stage100-paid.json');
const recoveredPath=path.join(root,'docs/codex/reports/data/p242-stage100-recovered-save.json');
const checkpointOnly=process.argv.includes('--checkpoint-only');
const inputText=fs.readFileSync(inputPath,'utf8');
const input=JSON.parse(inputText);
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const sourceNames=['config.js','levels.js','math.js','garrison.js','technology.js'];
const sourceHashes=()=>Object.fromEntries(sourceNames.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
const filesBefore=sourceHashes();
assert.equal(input.v,32,'P241 input must be a v32 save');
assert.deepEqual([...input.defeated].sort((a,b)=>a-b),Array.from({length:99},(_,i)=>i+1));
assert.equal(input.sciences.includes('sci_nuclear_age'),false);
assert.equal(Object.keys(input.upgradedUnits).length,0);
if(!checkpointOnly&&fs.existsSync(outputPath))throw new Error('P242 output already exists; refusing to overwrite it');
if(fs.existsSync(recoveredPath))throw new Error('P242 recovered checkpoint already exists; refusing to overwrite it');

function unitCounts(form){
  const result={};
  for(const row of ['front','mid','back'])for(const u of form[row]||[])
    result[u.type]=(result[u.type]||0)+u.count;
  return result;
}
function snapshot(run){
  return run(`(()=>({tick:S.tick,army:armyCount(),
    deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),
    formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},
    resources:{...S.res},sciences:S.sciences.slice(),defeated:S.defeated.slice(),
    upgradedUnits:{...S.upgradedUnits},popAlloc:{...S.popAlloc},
    queue:JSON.parse(JSON.stringify(S.queue)),foodNet:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost}))()`);
}
function branch(random){
  const {run}=environment({rts_save:inputText});
  assert.equal(run('loadSaveAndApply().status'),'ok','P241 save could not reload');
  run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__foodMin=S.res.food;globalThis.__paid=[];
    const __payTrainingCost=payTrainingCost;
    globalThis.payTrainingCost=(cost,count)=>{
      __payTrainingCost(cost,count);
      for(const [resource,unitCost] of Object.entries(cost||{}))
        if(Object.prototype.hasOwnProperty.call(CFG.res,resource))__paid.push({resource,amount:unitCost*count});
      __foodMin=Math.min(__foodMin,S.res.food);
    };
    const __tick=tick;
    globalThis.tick=()=>{__tick();__foodMin=Math.min(__foodMin,S.res.food)};
    Math.random=()=>0.5;
  `);
  const initial=snapshot(run);
  assert.equal(initial.defeated.length,99);
  assert.equal(initial.army,92);
  assert.equal(initial.deployed,47);
  assert.equal(initial.sciences.includes('sci_nuclear_age'),false);
  assert.equal(Object.keys(initial.upgradedUnits).length,0);

  function assign(jobs){
    const current=run('({...S.popAlloc})');
    for(const [key,count] of Object.entries(current))if(count>0)
      assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`cannot vacate ${key}`);
    for(const [key,count] of Object.entries(jobs))if(count>0)
      assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`cannot assign ${key}`);
    assert.ok(run('popAllocTotal()')<=run('popCurrent()'),'overallocated population');
  }
  function waitFor(condition,max=50000){
    const result=run(`(()=>{let seconds=0;while(!(${condition})&&seconds<${max}){
      tick();seconds++}return{seconds,reached:!!(${condition}),tick:S.tick,food:S.res.food,
      steel:S.res.steel,queue:JSON.parse(JSON.stringify(S.queue))}})()`);
    assert.equal(result.reached,true,`recovery blocked waiting for ${condition}: ${JSON.stringify(result)}`);
    assert.ok(result.food>0,'recovery ran out of food');
    return result.seconds;
  }
  function trainTo(key,target){
    const have=run(`S.pool['${key}']||0`),missing=target-have;
    assert.ok(missing>=0,`${key} pool exceeds target`);
    if(!missing)return 0;
    const queued=run(`train('${key}',${missing})`);
    assert.equal(queued?.ok,true,`${key} training failed: ${JSON.stringify(queued)}`);
    assert.equal(queued.qty,missing,`${key} queue was shortened`);
    waitFor(`(S.pool['${key}']||0)>=${target}`);
    assert.equal(run(`S.pool['${key}']`),target);
    return missing;
  }
  function place(row,key,count){
    assert.ok(run(`rowSlots('${row}')`)>=1,`${row} slot is locked`);
    assert.ok(run(`S.pool['${key}']||0`)>=count,`${key} pool is short`);
    run(`openFormModal('expedition','${row}',0);S._formModalSel='${key}';S._formModalQty=${count};confirmForm()`);
    const placed=run(`S.formation.${row}[0]`);
    assert.equal(placed?.type,key,`wrong ${row} unit`);
    assert.equal(placed.count,count,`wrong ${row} count`);
  }

  // P241 replay's battle preparation uses 40 alloy in front and 20 hunters
  // in each rear row. Existing 40 armored reserves and five single reserves
  // make the paid pre-L99 owned total 125 when those 80 units are deployed.
  run("clrForm('expedition')");
  const requiredAlloy=40-run('S.pool.alloy_special||0');
  const requiredArcher=40-run('S.pool.archer||0');
  assert.equal(requiredAlloy,15);
  assert.equal(requiredArcher,18);
  const neededSteel=requiredAlloy*run('CFG.units.alloy_special.cost.steel');
  if(run('S.res.steel')<neededSteel){
    assign({food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(`S.res.steel>=${neededSteel}`);
  }
  assign({food:102});
  const neededFood=requiredAlloy*run('CFG.units.alloy_special.cost.food')+
    requiredArcher*run('CFG.units.archer.cost.food');
  waitFor(`S.res.food>=${neededFood+2000}`);
  const trained={alloy:trainTo('alloy_special',40),archer:trainTo('archer',40)};
  place('front','alloy_special',40);
  place('mid','archer',20);
  place('back','archer',20);
  assert.equal(run('save().ok'),true,'recovered formation did not persist');
  const prepared=snapshot(run);
  assert.equal(prepared.army,125);
  assert.equal(prepared.deployed,80);
  assert.deepEqual(unitCounts(prepared.formation),{alloy_special:40,archer:40});
  assert.deepEqual(prepared.defeated,initial.defeated,'recovery changed mainline wins');
  assert.deepEqual(prepared.sciences,initial.sciences,'recovery changed technologies');
  assert.deepEqual(prepared.upgradedUnits,initial.upgradedUnits,'recovery changed unit upgrades');
  assert.equal(prepared.resources.food>0,true);
  const paid=JSON.parse(JSON.stringify(run(`(()=>{const out={};for(const event of __paid)
    out[event.resource]=(out[event.resource]||0)+event.amount;return out})()`)));
  const expected={
    food:requiredAlloy*run('CFG.units.alloy_special.cost.food')+requiredArcher*run('CFG.units.archer.cost.food'),
    steel:requiredAlloy*run('CFG.units.alloy_special.cost.steel'),
    wood:requiredArcher*run('CFG.units.archer.cost.wood'),
    stone:requiredArcher*run('CFG.units.archer.cost.stone')
  };
  assert.deepEqual(paid,expected,'actual training payments did not match recruited units');
  const recoveredSave=run("localStorage.getItem('rts_save')");
  const recoveredData=JSON.parse(recoveredSave);
  assert.equal(recoveredData.v,32);
  assert.deepEqual([...recoveredData.defeated].sort((a,b)=>a-b),Array.from({length:99},(_,i)=>i+1));
  assert.equal(recoveredData.defeated.includes(100),false);
  assert.equal(recoveredData.sciences.includes('sci_nuclear_age'),false);
  assert.equal(Object.keys(recoveredData.upgradedUnits).length,0);
  const reloadedPrep=environment({rts_save:recoveredSave});
  assert.equal(reloadedPrep.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloadedPrep.run('armyCount()'),125);
  assert.equal(reloadedPrep.run('S.defeated.length'),99);
  const recovery={seconds:prepared.tick-initial.tick,foodFloor:run('__foodMin'),
    foodBefore:initial.resources.food,foodAfter:prepared.resources.food,
    steelBefore:initial.resources.steel,steelAfter:prepared.resources.steel,
    trained,paid,formation:prepared.formation,army:prepared.army,deployed:prepared.deployed,
    scienceCount:prepared.sciences.length,nuclear:prepared.sciences.includes('sci_nuclear_age')};

  run(`Math.random=()=>${random}`);
  run('selEnemy(99);openBattle()');
  assert.equal(run('S.battleActive'),true,'stage 100 did not open');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){
    assert.equal(run('__step()'),true,'stage 100 callback missing');
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'stage 100 did not settle');
  const after=snapshot(run);
  const resultClass=run("document.getElementById('battle-result').className");
  const battleSaveText=run("localStorage.getItem('rts_save')");
  const reloaded=environment({rts_save:battleSaveText});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(reloaded.run('S.defeated.slice()'),after.defeated);
  assert.equal(reloaded.run('armyCount()'),after.army);
  assert.equal(after.tick,prepared.tick,'battle advanced production time');
  assert.equal(after.sciences.includes('sci_nuclear_age'),false);
  assert.equal(Object.keys(after.upgradedUnits).length,0);
  const preparedComparable=JSON.parse(JSON.stringify({...prepared,
    formation:Object.fromEntries(['front','mid','back'].map(row=>
      [row,prepared.formation[row].map(({type,count})=>({type,count}))]))}));
  return{random,recovery,preparedSaveText:recoveredSave,preparedComparable,
    battle:{win:after.defeated.includes(100),resultClass,
    round:run('B.round'),callbacks,armyBefore:prepared.army,armyAfter:after.army,
    deployedBefore:prepared.deployed,deployedAfter:after.deployed,
    troopLoss:prepared.army-after.army,defeatedBefore:prepared.defeated.length,
    defeatedAfter:after.defeated.length,foodAfter:after.resources.food,
    settled:run('B.settled'),reloaded:true}};
}

const branches=[0.1,0.5,0.9].map(branch);
for(const candidate of branches.slice(1))
  assert.deepEqual(candidate.preparedComparable,branches[0].preparedComparable,
    'the three paid pre-battle checkpoints differ beyond transient IDs and timestamps');
const rows=branches.map(({random,recovery,battle})=>({random,recovery,battle}));
assert.deepEqual(sourceHashes(),filesBefore,'runtime source changed while P242 was running');
const out={source:'P241 current-code paid mainline stage-99 v32 checkpoint',
  sourcePath:path.relative(root,inputPath),sourceSha256:hash(inputText),
  currentFiles:filesBefore,environment:{node:process.version,kind:'isolated progression harness',
    productionAndTraining:'real game actions, online tick seconds',battle:'real async battle callbacks driven by deterministic timer harness'},
  limitations:'The P241 input came from one paid, high-operation 102-population route and seed 9. Three fixed combat random values are pressure samples, not player win rates. This replay checks one stage-100 battle after paid recovery, not a full multi-strategy campaign or browser/Android.',
  rows};
if(checkpointOnly){
  const prior=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  assert.deepEqual(prior.currentFiles,out.currentFiles,'existing P242 report uses different runtime files');
  assert.equal(prior.sourceSha256,out.sourceSha256,'existing P242 report uses a different P241 save');
  for(let i=0;i<rows.length;i++){
    assert.equal(prior.rows[i].battle.win,rows[i].battle.win);
    assert.equal(prior.rows[i].battle.troopLoss,rows[i].battle.troopLoss);
    assert.equal(prior.rows[i].recovery.seconds,rows[i].recovery.seconds);
    assert.deepEqual(prior.rows[i].recovery.paid,rows[i].recovery.paid);
  }
}else fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(recoveredPath,branches[0].preparedSaveText,{flag:'wx'});
console.log(JSON.stringify({output:path.relative(root,outputPath),
  recovered:path.relative(root,recoveredPath),recoveredSha256:hash(branches[0].preparedSaveText),
  sourceSha256:out.sourceSha256,
  currentFiles:filesBefore,rows:rows.map(({random,recovery,battle})=>({random,
    recovery:{seconds:recovery.seconds,foodFloor:recovery.foodFloor,trained:recovery.trained,paid:recovery.paid},battle}))},null,2));
