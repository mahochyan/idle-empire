'use strict';
// P258: pay the gold-era route from a zero-outer-win silver save, then compare capital candidates.
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
  'return {boot,reload,place,seedBattle,state,own,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const sourceFile='docs/codex/reports/data/p256-outer-city-silver-army-save.json';
const sourceSave=fs.readFileSync(path.join(root,sourceFile),'utf8').trim();
const candidates={
  v1:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[3],gold_cavalry:[1]},
  v2:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[3],gold_cavalry:[2]},
  v3:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[2]},
  v3a:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[3,2]},
  v3b:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[4,3]},
  v3c:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[5,4]},
  v3d:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[6,4]},
  v4:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[8,6]},
  v5:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[4,3],gold_cavalry:[12,8]},
  v6:{infantry:[13,10,6],archer:[13,10,6],cavalry_t1:[10,8,5],silver_heavy:[6,4],gold_cavalry:[12,8]}
};
const capitalBase={key:'outerCapital',region:'capital',name:'外域铸金王都',
  needScience:'sci_gold_age',developmentOuter:true,boss:true,alertPerWin:20,
  reward:{deed:40,medal:20}};
function action(run,expression,label){
  const result=plain(run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
}
function waitFor(run,expression,max,label){
  let seconds=0,minFood=run('S.res.food');
  while(!run(expression)&&seconds<max){
    run('tick()');seconds++;minFood=Math.min(minFood,run('S.res.food'));
  }
  assert.ok(seconds<max,label+' timeout '+JSON.stringify(plain(run(`({
    tick:S.tick,res:{gold:S.res.gold,food:S.res.food,stone:S.res.stone,coal:S.res.coal},
    alloc:S.popAlloc,queue:S.queue.gold_cavalry,owned:(S.pool.gold_cavalry||0)+expeditionCount('gold_cavalry')
  })`))));
  return{seconds,minFood};
}
function paidGoldEntries(){
  let ctx=api.boot(sourceSave),run=ctx.run;
  assert.equal(run('S.defeated.length'),10);
  for(const region of ['village','town','city','capital'])
    assert.equal(run(`S.development.outer.${region}.wins`),0);
  // Academy Lv1 caps knowledge at 5000, below either gold research bill.
  action(run,"buildAct('academy')",'academy Lv2 for 7000 tech cap');
  waitFor(run,"bldSt('academy').lv>=2",300,'academy Lv2');
  assert.ok(run("resCap('tech')")>=7000);
  ctx=api.reload(ctx,'academy Lv2 reload');run=ctx.run;
  // The silver entry's five food workers cannot feed the long gold research/training window.
  // Keep one stone and two coal workers for the gold recipe; redirect the other jobs to food.
  for(const [key,count] of [['silver',0],['wood',0],['stone',1],['coal',2],['copper',0]])
    action(run,`setPopAlloc('${key}',${count})`,'gold-route staffing '+key);
  action(run,"setPopAlloc('food',16)",'gold-route food staff');
  action(run,"setPopAlloc('tech',1)",'assign scholar');
  const science=[];
  for(const [key,cost] of [['sci_gold',6000],['sci_gold_age',7000]]){
    const waited=waitFor(run,`S.res.tech>=${cost}`,30000,key);
    const before=run('S.res.tech');
    action(run,`researchScience('${key}')`,key);
    assert.equal(run('S.res.tech'),before-cost);
    science.push({key,cost,...waited});
    ctx=api.reload(ctx,key+' reload');run=ctx.run;
    assert.equal(run(`scienceUnlocked('${key}')`),true);
  }
  action(run,"buildAct('gold_armory')",'gold armory');
  for(let n=0;n<12;n++)run('tick()');
  assert.equal(run("bldSt('gold_armory').lv"),1);
  action(run,"setPopAlloc('tech',S.popAlloc.tech-1)",'release scholar');
  action(run,"setPopAlloc('gold',S.popAlloc.gold+1)",'assign gold worker');
  action(run,"train('gold_cavalry',1)",'first gold cavalry');
  const firstWait=waitFor(run,"(S.pool.gold_cavalry||0)+expeditionCount('gold_cavalry')>=1",4000,'first gold cavalry');
  ctx=api.reload(ctx,'first gold cavalry reload');run=ctx.run;
  const first=ctx.world.store.get('rts_save');
  assert.equal(api.own(run,'gold_cavalry'),1);
  // Lv1 cavalry stable caps the army at eight; pay three real upgrades to support 15.
  action(run,"setPopAlloc('food',12)",'release food staff for stable upgrades');
  action(run,"setPopAlloc('wood',2)",'assign wood staff');
  action(run,"setPopAlloc('stone',3)",'assign stone staff');
  const armoryUpgrades=[];
  while(run("bldSt('gold_armory').lv")<4){
    const lv=run("bldSt('gold_armory').lv");
    const cost=plain(run("upCost('gold_armory')"));
    const waited=waitFor(run,"Object.entries(upCost('gold_armory')).every(([k,v])=>k==='time'||S.res[k]>=v)",
      20000,'gold armory Lv'+(lv+1)+' payment');
    action(run,"buildAct('gold_armory')",'gold armory Lv'+(lv+1));
    waitFor(run,`bldSt('gold_armory').lv>=${lv+1}`,300,'gold armory Lv'+(lv+1));
    ctx=api.reload(ctx,'gold armory Lv'+(lv+1)+' reload');run=ctx.run;
    armoryUpgrades.push({lv:lv+1,cost,waited});
  }
  assert.ok(run("unitCap('gold_cavalry')")>=15);
  action(run,"train('gold_cavalry',14)",'gold formation');
  const armyWait=waitFor(run,"(S.pool.gold_cavalry||0)+expeditionCount('gold_cavalry')>=15",30000,'gold formation');
  ctx=api.reload(ctx,'gold formation reload');run=ctx.run;
  assert.equal(api.own(run,'gold_cavalry'),15);
  for(const region of ['village','town','city','capital'])
    assert.equal(run(`S.development.outer.${region}.wins`),0);
  return{science,firstWait,armoryUpgrades,armyWait,first,army:ctx.world.store.get('rts_save'),
    firstState:api.state(api.boot(first).run),armyState:api.state(run)};
}
function fight(save,formation,candidateKey,flow){
  const ctx=api.boot(save),{run,world}=ctx;
  const base={...capitalBase,units:candidates[candidateKey]};
  run(`CFG.developmentOuter.capital=${JSON.stringify(base)}`);
  run("clrForm('expedition')");
  api.place(run,'front','bronze_guard',15,0);
  api.place(run,'front',formation==='gold'?'gold_cavalry':'silver_heavy',15,1);
  api.place(run,'back','archer_t1',13,0);
  api.seedBattle(run,flow,1);
  const before=api.state(run),ownedBefore={};
  for(const type of ['bronze_guard',formation==='gold'?'gold_cavalry':'silver_heavy','archer_t1'])
    ownedBefore[type]=api.own(run,type);
  run("openDevelopmentOuter('capital')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({units:B.enemyCfg.units,groups:B.enemyUnits.length,
    people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
    attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,'capital callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'capital battle unfinished');
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=api.state(run),capital=plain(run('({...S.development.outer.capital})'));
  const loss=Object.fromEntries(Object.keys(ownedBefore).map(type=>
    [type,ownedBefore[type]-api.own(run,type)]));
  if(won){
    assert.equal(capital.wins,1);assert.equal(capital.alert,20);
    assert.equal(after.res.deed-before.res.deed,40);
    assert.equal(after.res.medal-before.res.medal,20);
  }else{
    assert.equal(capital.wins,0);assert.equal(capital.alert,0);
    assert.equal(after.res.deed,before.res.deed);
    assert.equal(after.res.medal,before.res.medal);
  }
  assert.deepEqual(after.defeated,before.defeated);
  const battleSave=world.store.get('rts_save');
  const fresh=api.boot(battleSave);
  assert.deepEqual(api.state(fresh.run),after,'capital save reload');
  assert.deepEqual(plain(fresh.run('({...S.development.outer.capital})')),capital);
  return{formation,candidateKey,flow,won,before,after,capital,loss,enemy,callbacks,
    battleSaveSha256:sha(battleSave)};
}
try{
  const entry=paidGoldEntries();
  const firstPath='docs/codex/reports/data/p258-outer-capital-first-gold-save.json';
  const armyPath='docs/codex/reports/data/p258-outer-capital-gold-army-save.json';
  fs.writeFileSync(path.join(root,firstPath),entry.first+'\n');
  fs.writeFileSync(path.join(root,armyPath),entry.army+'\n');
  const rows=[];
  for(const [formation,save] of [['silver',entry.first],['gold',entry.army]])
    for(const candidateKey of Object.keys(candidates))
      for(let flow=1;flow<=16;flow++)rows.push(fight(save,formation,candidateKey,flow));
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',sourceFile,
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-capital-frontier-p258.js'];
  const output='docs/codex/reports/data/p258-outer-capital-frontier.json';
  const result={batch:'P258',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{capitalBase,candidates,sourceSaveSha256:sha(sourceSave),
      firstSaveSha256:sha(entry.first),armySaveSha256:sha(entry.army),
      capital:'isolated CFG candidate; science and army paid by real game actions'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
    paidEntry:{science:entry.science,firstWait:entry.firstWait,
      armoryUpgrades:entry.armoryUpgrades,armyWait:entry.armyWait,
      firstState:entry.firstState,armyState:entry.armyState},rows};
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P258',science:entry.science,
    firstWait:entry.firstWait,armoryUpgrades:entry.armoryUpgrades,armyWait:entry.armyWait,
    first:{tick:entry.firstState.tick,gold:entry.firstState.res.gold,food:entry.firstState.res.food},
    army:{tick:entry.armyState.tick,gold:entry.armyState.res.gold,food:entry.armyState.res.food},
    outcomes:Object.keys(candidates).flatMap(candidateKey=>['silver','gold'].map(formation=>{
      const r=rows.filter(x=>x.candidateKey===candidateKey&&x.formation===formation);
      const wins=r.filter(x=>x.won),loss=wins.map(x=>Object.values(x.loss).reduce((a,b)=>a+b,0));
      return{candidateKey,formation,wins:wins.length,
        meanLoss:wins.length?loss.reduce((a,b)=>a+b,0)/wins.length:null,
        maxLoss:wins.length?Math.max(...loss):null};
    })),firstPath,armyPath,output},null,2));
}finally{global.Date=api.RealDate}
