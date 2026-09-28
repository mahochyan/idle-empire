'use strict';
// P259: formal capital battle and real paid recovery from the P258 gold-era entry.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p246File=path.join(__dirname,'probe-outer-village-continuous-p246.js');
const source=fs.readFileSync(p246File,'utf8');
const marker='try{\n  const flows=[];';
const at=source.indexOf(marker);
assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0,'P246 helper marker changed');
const api=new Function('require','console','__dirname','process',source.slice(0,at)+
  'return {boot,reload,place,seedBattle,state,own,target,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const entryFile='docs/codex/reports/data/p258-outer-capital-gold-army-save.json';
const entry=fs.readFileSync(path.join(root,entryFile),'utf8').trim();
delete api.target.infantry_t1;
api.target.gold_cavalry=15;
// The paid gold entry temporarily pulled copper workers into food; bronze guard losses require restoring copper first.
const workerCycle=['copper','gold','food','coal','stone'];
const maxWins=30,maxRecoverySeconds=20000;

function fight(ctx,flow,attempt){
  const {run,world}=ctx;
  run("clrForm('expedition')");
  api.place(run,'front','bronze_guard',15,0);
  api.place(run,'front','gold_cavalry',15,1);
  api.place(run,'back','archer_t1',13,0);
  api.seedBattle(run,flow,attempt);
  const before=api.state(run),capitalBefore=plain(run('({...S.development.outer.capital})'));
  const ownedBefore=Object.fromEntries(Object.keys(api.target).map(type=>[type,api.own(run,type)]));
  run("openDevelopmentOuter('capital')");
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('S.battleEncounter'),'outerCapital');
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,'capital callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'capital battle unfinished');
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=api.state(run),capitalAfter=plain(run('({...S.development.outer.capital})'));
  const loss=Object.fromEntries(Object.keys(api.target).map(type=>
    [type,ownedBefore[type]-api.own(run,type)]));
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.region.wins,before.region.wins,'village progress changed');
  if(won){
    assert.equal(capitalAfter.wins,capitalBefore.wins+1);
    assert.equal(capitalAfter.alert,capitalBefore.alert+20);
    assert.equal(after.res.deed-before.res.deed,40);
    assert.equal(after.res.medal-before.res.medal,20);
  }else{
    assert.deepEqual(capitalAfter,capitalBefore);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  const battleSave=world.store.get('rts_save');
  const fresh=api.boot(battleSave);
  assert.deepEqual(api.state(fresh.run),after,'capital battle reload');
  assert.deepEqual(plain(fresh.run('({...S.development.outer.capital})')),capitalAfter);
  run('exitBattle()');
  return{won,before,after,capitalBefore,capitalAfter,loss,enemy,callbacks,
    battleSaveSha256:sha(battleSave)};
}
function recover(ctx,battle,flow,workerCursor){
  const {run}=ctx,cost=run("settlementCost('village')");
  let expanded=false,birthSeconds=0;
  if(run('S.res.deed')>=cost){
    assert.equal(run("upgradeSettlement('village').ok"),true);
    expanded=true;
    const beforePop=run('popCurrent()');
    while(run('popCurrent()')===beforePop&&birthSeconds<20){run('tick()');birthSeconds++}
    assert.equal(run('popCurrent()'),beforePop+1,'housing did not produce a resident');
    const job=workerCycle[workerCursor%workerCycle.length];
    assert.equal(run(`setPopAlloc('${job}',S.popAlloc.${job}+1).ok`),true,'new resident staffing');
    workerCursor++;
  }
  const requested={};
  for(const [type,n] of Object.entries(api.target)){
    const missing=Math.max(0,n-api.own(run,type)-run(`S.queue['${type}']?.count||0`));
    requested[type]=missing;
    if(missing)assert.equal(run(`train('${type}',${missing}).ok`),true,`${type} queue`);
  }
  let seconds=0,minFoodTickEnd=run('S.res.food');
  const paidBefore=plain(run('({...__paid})'));
  const ready=()=>Object.entries(api.target).every(([k,n])=>api.own(run,k)>=n);
  while(!ready()&&seconds<maxRecoverySeconds){
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
  }
  const paidAfter=plain(run('({...__paid})')),paid={};
  for(const key of new Set([...Object.keys(paidBefore),...Object.keys(paidAfter)]))
    if((paidAfter[key]||0)!==(paidBefore[key]||0))paid[key]=(paidAfter[key]||0)-(paidBefore[key]||0);
  const next=api.reload(ctx,`flow ${flow} recovery`);
  return{next,workerCursor,record:{expanded,cost,birthSeconds,requested,
    ready:ready(),seconds,minFoodTickEnd,minFoodAfterPayment:run('__minPayFood'),
    paid,after:api.state(run),saveSha256:next.saveSha256}};
}
try{
  const flows=[];
  for(let flow=1;flow<=16;flow++){
    let ctx=api.boot(entry),workerCursor=0;
    assert.equal(ctx.run("scienceUnlocked('sci_gold_age')"),true);
    assert.equal(ctx.run('S.development.outer.capital.wins'),0);
    const rows=[];
    for(let attempt=1;attempt<=maxWins;attempt++){
      const battle=fight(ctx,flow,attempt);
      if(!battle.won){rows.push({attempt,battle,recovery:null});break}
      const recovered=recover(ctx,battle,flow,workerCursor);
      workerCursor=recovered.workerCursor;
      rows.push({attempt,battle,recovery:recovered.record});
      ctx=recovered.next;
      if(!recovered.record.ready)break;
    }
    flows.push({flow,rows,final:api.state(ctx.run),
      capital:plain(ctx.run('({...S.development.outer.capital})')),
      finalSaveSha256:ctx.saveSha256});
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',entryFile,
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-capital-live-p259.js'];
  const output='docs/codex/reports/data/p259-outer-capital-live.json';
  const result={batch:'P259',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{maxWins,maxRecoverySeconds,flows:'1..16',target:api.target,workerCycle,
      combat:'formal CFG/openDevelopmentOuter, paid gold cavalry formation',
      recovery:'real village housing, birth, staffing, queue payment and reload',
      battleTime:'clicks and animation excluded'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),flows};
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P259',summary:{
    firstWins:flows.filter(f=>f.rows[0]?.battle.won).length,
    wins:flows.map(f=>f.rows.filter(r=>r.battle.won).length),
    recoverySeconds:flows.map(f=>f.rows.reduce((n,r)=>n+(r.recovery?.seconds||0),0)),
    minFoodAfterPayment:Math.min(...flows.flatMap(f=>f.rows.map(r=>r.recovery?.minFoodAfterPayment??Infinity))),
    recoveryIncomplete:flows.filter(f=>f.rows.some(r=>r.recovery&&!r.recovery.ready)).map(f=>f.flow)},
    output},null,2));
}finally{global.Date=api.RealDate}
