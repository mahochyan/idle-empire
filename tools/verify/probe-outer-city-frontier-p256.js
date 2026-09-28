'use strict';
// P256: paid silver-era entry from zero outer wins, isolated city enemy candidates.
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
  'return {boot,reload,place,seedBattle,state,own,initialSave,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const ironEntryFile='docs/codex/reports/data/p254-outer-town-iron-entry-save.json';
const ironEntry=fs.readFileSync(path.join(root,ironEntryFile),'utf8').trim();
const candidates={
  base:{infantry:[11,8,5],archer:[11,8,5],cavalry_t1:[8,6,4]},
  guard:{infantry:[11,8,5],archer:[11,8,5],cavalry_t1:[8,6,4],bronze_guard:[4,3]},
  silver:{infantry:[11,8,5],archer:[11,8,5],cavalry_t1:[8,6,4],silver_heavy:[2]}
};
const cityBase={key:'outerCity',region:'city',name:'外域铸银城塞',needScience:'sci_silver_age',
  developmentOuter:true,boss:false,alertPerWin:20,reward:{deed:32,medal:10}};
function action(run,expression,label){
  const result=plain(run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
}
function waitFor(run,expression,max,label){
  let seconds=0,minFood=run('S.res.food');
  while(!run(expression)&&seconds<max){run('tick()');seconds++;minFood=Math.min(minFood,run('S.res.food'))}
  assert.ok(seconds<max,label+' timeout');
  return{seconds,minFood};
}
function paidSilverEntries(){
  let ctx=api.boot(ironEntry),run=ctx.run;
  assert.equal(run('S.defeated.length'),10);
  assert.equal(run('S.development.outer.village.wins'),0);
  assert.equal(run('S.development.outer.town.wins'),0);
  const science=[];
  for(const [key,cost] of [['sci_city',2200],['sci_silver',3200],['sci_silver_age',4000]]){
    const waited=waitFor(run,`S.res.tech>=${cost}`,7200,key);
    const before=run('S.res.tech');
    action(run,`researchScience('${key}')`,key);
    assert.equal(run('S.res.tech'),before-cost);
    science.push({key,cost,...waited});
    ctx=api.reload(ctx,key+' reload');run=ctx.run;
    assert.equal(run(`scienceUnlocked('${key}')`),true);
  }
  action(run,"buildAct('silver_armory')",'silver armory');
  for(let n=0;n<10;n++)run('tick()');
  assert.equal(run("bldSt('silver_armory').lv"),1);
  action(run,"setPopAlloc('tech',S.popAlloc.tech-1)",'release scholar');
  action(run,"setPopAlloc('silver',S.popAlloc.silver+1)",'assign silver worker');
  action(run,"train('silver_heavy',1)",'first silver heavy');
  const firstWait=waitFor(run,"(S.pool.silver_heavy||0)+expeditionCount('silver_heavy')>=1",3000,'first silver heavy');
  ctx=api.reload(ctx,'first silver heavy reload');run=ctx.run;
  const first=ctx.world.store.get('rts_save');
  assert.equal(api.own(run,'silver_heavy'),1);
  assert.equal(run('S.development.outer.city.wins'),0);
  action(run,"train('silver_heavy',14)",'silver formation');
  const armyWait=waitFor(run,"(S.pool.silver_heavy||0)+expeditionCount('silver_heavy')>=15",10000,'silver formation');
  ctx=api.reload(ctx,'silver formation reload');run=ctx.run;
  assert.equal(api.own(run,'silver_heavy'),15);
  const army=ctx.world.store.get('rts_save');
  return{science,firstWait,armyWait,first,army,
    firstState:api.state(api.boot(first).run),armyState:api.state(run)};
}
function fight(save,formation,candidateKey,flow){
  const ctx=api.boot(save),{run,world}=ctx;
  const base={...cityBase,units:candidates[candidateKey]};
  run(`CFG.developmentOuter.city=${JSON.stringify(base)}`);
  run("clrForm('expedition')");
  api.place(run,'front','bronze_guard',15,0);
  api.place(run,'front',formation==='silver'?'silver_heavy':'infantry_t1',15,1);
  api.place(run,'back','archer_t1',13,0);
  api.seedBattle(run,flow,1);
  const before=api.state(run),ownedBefore={};
  for(const type of ['bronze_guard',formation==='silver'?'silver_heavy':'infantry_t1','archer_t1'])
    ownedBefore[type]=api.own(run,type);
  run("openDevelopmentOuter('city')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({units:B.enemyCfg.units,groups:B.enemyUnits.length,
    people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,'city callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'city battle unfinished');
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=api.state(run),city=plain(run('({...S.development.outer.city})'));
  const loss=Object.fromEntries(Object.keys(ownedBefore).map(type=>
    [type,ownedBefore[type]-api.own(run,type)]));
  if(won){
    assert.equal(city.wins,1);assert.equal(city.alert,20);
    assert.equal(after.res.deed-before.res.deed,32);
    assert.equal(after.res.medal-before.res.medal,10);
  }else{
    assert.equal(city.wins,0);assert.equal(city.alert,0);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.region.wins,before.region.wins);
  const battleSave=world.store.get('rts_save');
  const fresh=api.boot(battleSave);
  assert.deepEqual(api.state(fresh.run),after,'city save reload');
  assert.deepEqual(plain(fresh.run('({...S.development.outer.city})')),city);
  return{formation,candidateKey,flow,won,before,after,city,loss,enemy,callbacks,
    battleSaveSha256:sha(battleSave)};
}
try{
  const entry=paidSilverEntries();
  const firstPath='docs/codex/reports/data/p256-outer-city-first-silver-save.json';
  const armyPath='docs/codex/reports/data/p256-outer-city-silver-army-save.json';
  fs.writeFileSync(path.join(root,firstPath),entry.first+'\n');
  fs.writeFileSync(path.join(root,armyPath),entry.army+'\n');
  const rows=[];
  for(const [formation,save] of [['bronze',entry.first],['silver',entry.army]])
    for(const candidateKey of Object.keys(candidates))
      for(let flow=1;flow<=16;flow++)rows.push(fight(save,formation,candidateKey,flow));
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',ironEntryFile,
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-city-frontier-p256.js'];
  const output='docs/codex/reports/data/p256-outer-city-frontier.json';
  const result={batch:'P256',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{cityBase,candidates,sourceSaveSha256:sha(ironEntry),
      firstSaveSha256:sha(entry.first),armySaveSha256:sha(entry.army),
      city:'isolated CFG candidate; science and army paid by real game actions'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
    paidEntry:{science:entry.science,firstWait:entry.firstWait,armyWait:entry.armyWait,
      firstState:entry.firstState,armyState:entry.armyState},rows};
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P256',science:entry.science,
    firstWait:entry.firstWait,armyWait:entry.armyWait,
    first:{tick:entry.firstState.tick,silver:entry.firstState.res.silver,food:entry.firstState.res.food},
    army:{tick:entry.armyState.tick,silver:entry.armyState.res.silver,food:entry.armyState.res.food},
    outcomes:Object.keys(candidates).flatMap(candidateKey=>['bronze','silver'].map(formation=>{
      const r=rows.filter(x=>x.candidateKey===candidateKey&&x.formation===formation);
      const wins=r.filter(x=>x.won),loss=wins.map(x=>Object.values(x.loss).reduce((a,b)=>a+b,0));
      return{candidateKey,formation,wins:wins.length,meanLoss:wins.length?loss.reduce((a,b)=>a+b,0)/wins.length:null,
        maxLoss:wins.length?Math.max(...loss):null};
    })),firstPath,armyPath,output},null,2));
}finally{global.Date=api.RealDate}
