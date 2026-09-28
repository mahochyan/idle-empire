'use strict';
// P254: formal town encounters from a paid, zero-village-win iron-age save.
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
  'return {boot,reload,spendAndRecover,place,seedBattle,state,own,target,initialSave,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const maxWins=30;
const ironArmy=process.argv.includes('--iron-army');
function action(run,expression,label){
  const result=plain(run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
}
function paidIronEntry(){
  let ctx=api.boot(api.initialSave);
  const run=ctx.run;
  assert.equal(run('S.development.outer.village.wins'),0);
  assert.equal(run('S.development.outer.town.wins'),0);
  assert.equal(run('S.defeated.length'),10);
  action(run,"researchScience('sci_iron_warehouse')",'warehouse research');
  assert.equal(run('S.res.tech'),1600);
  action(run,"setPopAlloc('wood',S.popAlloc.wood-1)",'release wood worker');
  action(run,"setPopAlloc('iron',S.popAlloc.iron+1)",'assign iron worker');
  let ironSeconds=0;
  while(run('S.res.iron')<300&&ironSeconds<1000){run('tick()');ironSeconds++}
  assert.ok(ironSeconds<1000,'iron worker cannot fund first store');
  action(run,"buildAct('iron_store')",'iron store');
  for(let n=0;n<8;n++)run('tick()');
  assert.equal(run("bldSt('iron_store').lv"),1);
  action(run,"setPopAlloc('iron',S.popAlloc.iron-1)",'release iron worker');
  action(run,"setPopAlloc('tech',S.popAlloc.tech+1)",'assign scholar');
  let knowledgeSeconds=0;
  while(run('S.res.tech')<2500&&knowledgeSeconds<7200){run('tick()');knowledgeSeconds++}
  assert.ok(knowledgeSeconds<7200,'iron-age knowledge unreachable');
  action(run,"researchScience('sci_iron_age')",'iron-age research');
  action(run,"buildAct('iron_forge')",'iron forge');
  for(let n=0;n<10;n++)run('tick()');
  assert.equal(run("bldSt('iron_forge').lv"),1);
  action(run,"train('iron_spearman',1)",'first iron spearman');
  run('tick()');
  assert.equal(api.own(run,'iron_spearman'),1);
  let ironArmySeconds=0;
  if(ironArmy){
    action(run,"setPopAlloc('tech',S.popAlloc.tech-1)",'release scholar');
    action(run,"setPopAlloc('iron',S.popAlloc.iron+1)",'assign iron worker');
    action(run,"train('iron_spearman',14)",'queue iron army');
    while(api.own(run,'iron_spearman')<15&&ironArmySeconds<10000){
      run('tick()');ironArmySeconds++;
    }
    assert.equal(api.own(run,'iron_spearman'),15,'paid iron army did not complete');
  }
  ctx=api.reload(ctx,'paid iron entry');
  assert.equal(ctx.run("scienceUnlocked('sci_iron_age')"),true);
  assert.equal(api.own(ctx.run,'iron_spearman'),ironArmy?15:1);
  assert.equal(ctx.run('S.development.outer.village.wins'),0);
  if(ironArmy){delete api.target.infantry_t1;api.target.iron_spearman=15}
  return{save:ctx.world.store.get('rts_save'),
    paid:{ironSeconds,knowledgeSeconds,ironArmySeconds,entry:api.state(ctx.run),
      ironSpearman:ironArmy?15:1}};
}
function townFight(ctx,flow,attempt){
  const {run,world}=ctx;
  run("clrForm('expedition')");
  api.place(run,'front','bronze_guard',15,0);
  api.place(run,'front',ironArmy?'iron_spearman':'infantry_t1',15,1);
  api.place(run,'back','archer_t1',13,0);
  assert.equal(run("S.formation.front.reduce((n,u)=>n+u.count,0)+S.formation.back.reduce((n,u)=>n+u.count,0)"),43);
  api.seedBattle(run,flow,attempt);
  const before=api.state(run),townBefore=plain(run('({...S.development.outer.town})'));
  const ownedBefore=Object.fromEntries(Object.keys(api.target).map(type=>[type,api.own(run,type)]));
  run("openDevelopmentOuter('town')");
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('S.battleEncounter'),'outerTown');
  const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
    groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,`flow ${flow} town ${attempt} callback missing`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=api.state(run),townAfter=plain(run('({...S.development.outer.town})'));
  const loss=Object.fromEntries(Object.keys(api.target).map(type=>
    [type,ownedBefore[type]-api.own(run,type)]));
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.region.wins,before.region.wins,'village progress changed');
  if(won){
    assert.equal(townAfter.wins,townBefore.wins+1);
    assert.equal(townAfter.alert,townBefore.alert+20);
    assert.equal(after.res.deed-before.res.deed,20);
    assert.equal(after.res.medal-before.res.medal,7);
  }else{
    assert.deepEqual(townAfter,townBefore);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  const battleSave=world.store.get('rts_save');
  const fresh=api.boot(battleSave);
  assert.deepEqual(api.state(fresh.run),after,'battle reload');
  assert.deepEqual(plain(fresh.run('({...S.development.outer.town})')),townAfter);
  run('exitBattle()');
  return{won,before,after,townBefore,townAfter,loss,enemy,callbacks,
    battleSaveSha256:sha(battleSave)};
}
try{
  const entry=paidIronEntry();
  const entryPath='docs/codex/reports/data/'+(ironArmy?
    'p255-outer-town-iron-army-entry-save.json':'p254-outer-town-iron-entry-save.json');
  fs.writeFileSync(path.join(root,entryPath),entry.save+'\n');
  const flows=[];
  for(let flow=1;flow<=16;flow++){
    let ctx=api.boot(entry.save),workerCursor=0;
    const rows=[];
    for(let attempt=1;attempt<=maxWins;attempt++){
      const battle=townFight(ctx,flow,attempt);
      if(!battle.won){rows.push({attempt,battle,recovery:null});break}
      const recovered=api.spendAndRecover(ctx,battle,flow,workerCursor);
      workerCursor=recovered.workerCursor;
      rows.push({attempt,battle,recovery:recovered.record});
      ctx=recovered.next;
      if(!recovered.record.ready)break;
    }
    flows.push({flow,rows,final:api.state(ctx.run),
      town:plain(ctx.run('({...S.development.outer.town})')),
      finalSaveSha256:ctx.saveSha256});
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js','docs/codex/reports/data/p245-outer-village-l10-save.json',
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-town-live-p254.js'];
  const output='docs/codex/reports/data/'+(ironArmy?'p255-outer-town-iron-army.json':'p254-outer-town-live.json');
  const result={batch:ironArmy?'P255':'P254',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{maxWins,flows:'1..16',ironArmy,sourceSaveSha256:sha(api.initialSave),entrySaveSha256:sha(entry.save),
      combat:'formal CFG and openDevelopmentOuter, fixed bronze plus T1 infantry or iron formation, paid village housing and training recovery',
      battleTime:'animation and clicks excluded'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
    paidEntry:entry.paid,flows};
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:ironArmy?'P255':'P254',paidEntry:{ironSeconds:entry.paid.ironSeconds,
    knowledgeSeconds:entry.paid.knowledgeSeconds,tick:entry.paid.entry.tick,
    ironArmySeconds:entry.paid.ironArmySeconds,
    iron:entry.paid.entry.res.iron,food:entry.paid.entry.res.food},
    flows:flows.map(f=>({flow:f.flow,wins:f.rows.filter(r=>r.battle.won).length,
      attempts:f.rows.length,pop:f.final.pop,villageLevel:f.final.villageLevel,
      deed:f.final.res.deed,medal:f.final.res.medal,
      recoverySeconds:f.rows.reduce((n,r)=>n+(r.recovery?.seconds||0),0),
      minFoodAfterPayment:Math.min(...f.rows.map(r=>r.recovery?.minFoodAfterPayment??Infinity))})),
    output,entryPath},null,2));
}finally{global.Date=api.RealDate}
