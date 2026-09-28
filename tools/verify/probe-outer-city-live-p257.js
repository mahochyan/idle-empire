'use strict';
// P257: formal city combat and paid recovery from two real silver-era entries.
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
  'return {boot,reload,spendAndRecover,place,seedBattle,state,own,target,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const bronzeFile='docs/codex/reports/data/p256-outer-city-first-silver-save.json';
const silverFile='docs/codex/reports/data/p256-outer-city-silver-army-save.json';
const entries={bronze:fs.readFileSync(path.join(root,bronzeFile),'utf8').trim(),
  silver:fs.readFileSync(path.join(root,silverFile),'utf8').trim()};
const maxWins=30;
function fight(ctx,formation,flow,attempt){
  const {run,world}=ctx;
  run("clrForm('expedition')");
  api.place(run,'front','bronze_guard',15,0);
  api.place(run,'front',formation==='silver'?'silver_heavy':'infantry_t1',15,1);
  api.place(run,'back','archer_t1',13,0);
  api.seedBattle(run,flow,attempt);
  const before=api.state(run),regionBefore=plain(run('({...S.development.outer.city})'));
  const ownedBefore=Object.fromEntries(Object.keys(api.target).map(type=>[type,api.own(run,type)]));
  run("openDevelopmentOuter('city')");
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('S.battleEncounter'),'outerCity');
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,'city callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'city battle unfinished');
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=api.state(run),regionAfter=plain(run('({...S.development.outer.city})'));
  const loss=Object.fromEntries(Object.keys(api.target).map(type=>
    [type,ownedBefore[type]-api.own(run,type)]));
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.region.wins,before.region.wins,'village progress changed');
  if(won){
    assert.equal(regionAfter.wins,regionBefore.wins+1);
    assert.equal(regionAfter.alert,regionBefore.alert+20);
    assert.equal(after.res.deed-before.res.deed,32);
    assert.equal(after.res.medal-before.res.medal,10);
  }else{
    assert.deepEqual(regionAfter,regionBefore);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  const battleSave=world.store.get('rts_save');
  const fresh=api.boot(battleSave);
  assert.deepEqual(api.state(fresh.run),after,'city battle reload');
  assert.deepEqual(plain(fresh.run('({...S.development.outer.city})')),regionAfter);
  run('exitBattle()');
  return{won,before,after,regionBefore,regionAfter,loss,enemy,callbacks,
    battleSaveSha256:sha(battleSave)};
}
try{
  const arms=[];
  for(const formation of ['bronze','silver']){
    if(formation==='silver'){
      delete api.target.infantry_t1;
      api.target.silver_heavy=15;
    }
    const flows=[];
    for(let flow=1;flow<=16;flow++){
      let ctx=api.boot(entries[formation]),workerCursor=0;
      assert.equal(ctx.run("scienceUnlocked('sci_silver_age')"),true);
      assert.equal(ctx.run('S.development.outer.city.wins'),0);
      const rows=[];
      for(let attempt=1;attempt<=maxWins;attempt++){
        const battle=fight(ctx,formation,flow,attempt);
        if(!battle.won){rows.push({attempt,battle,recovery:null});break}
        const recovered=api.spendAndRecover(ctx,battle,flow,workerCursor);
        workerCursor=recovered.workerCursor;
        rows.push({attempt,battle,recovery:recovered.record});
        ctx=recovered.next;
        if(!recovered.record.ready)break;
      }
      flows.push({flow,rows,final:api.state(ctx.run),
        city:plain(ctx.run('({...S.development.outer.city})')),
        finalSaveSha256:ctx.saveSha256});
    }
    arms.push({formation,sourceSaveSha256:sha(entries[formation]),flows});
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',bronzeFile,silverFile,
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-city-live-p257.js'];
  const output='docs/codex/reports/data/p257-outer-city-live.json';
  const result={batch:'P257',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{maxWins,flows:'1..16 per formation',
      combat:'formal CFG/openDevelopmentOuter, fixed bronze/T1 or bronze/silver front and T1 archer back',
      recovery:'real village housing, birth, staffing, queue payment and reload',
      battleTime:'clicks and animation excluded'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),arms};
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P257',summary:arms.map(a=>({formation:a.formation,
    firstWins:a.flows.filter(f=>f.rows[0]?.battle.won).length,
    wins:a.flows.map(f=>f.rows.filter(r=>r.battle.won).length),
    recoverySeconds:a.flows.map(f=>f.rows.reduce((n,r)=>n+(r.recovery?.seconds||0),0)),
    minFoodAfterPayment:Math.min(...a.flows.flatMap(f=>f.rows.map(r=>r.recovery?.minFoodAfterPayment??Infinity)))})),
    output},null,2));
}finally{global.Date=api.RealDate}
