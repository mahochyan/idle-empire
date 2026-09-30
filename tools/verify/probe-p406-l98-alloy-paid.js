'use strict';
// One independently reloadable paid alloy-quality continuation from the L97 win.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..'),dir='docs/codex/reports/data';
const input=`${dir}/p405-l97-won-save.json`;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=f=>sha(fs.readFileSync(path.join(root,f)));
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const source=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(sourceHash[input],'d53dab711944ed857cecdb2d7914f0dd0fa925aa02e077d82209d88ed186cf22');
assert.equal(JSON.parse(source).defeated.length,97);
const full=[['front','alloy_special',30],['front','alloy_special',30],
  ['front','alloy_special',20],['front','iron_spearman',20],
  ['mid','archer_longbow',30],['mid','archer_longbow',30],
  ['mid','archer_longbow',20],['back','archer_longbow',30],
  ['back','archer_longbow',30],['back','archer_longbow',30],['back','archer_longbow',30]];
const steelWorkers={food:21,stone:3,coal:3,iron:2,steel:2};
const bowWorkers={food:28,wood:2,stone:1};
const steps=[],battleRows=[],checkpoints={};
let game=session(source),routeRaw=source,routeStage=97,minFood=game.run('S.res.food');
let setupOnline=0,winningOnline=0,winningBattleMs=0,failure=null,gateAudit=null;
function waitUntil(expr,maxSeconds,label){
  let seconds=0;
  while(!game.run(expr)&&seconds<maxSeconds){
    game.wait(10);seconds+=10;minFood=Math.min(minFood,game.run('S.res.food'));
  }
  assert.ok(game.run(expr),`${label} timed out after ${seconds}s: ${JSON.stringify(game.state())}`);
  return seconds;
}
function build(key){
  const from=game.run(`bldSt('${key}').lv`);
  const cost=game.run(from===0?`buildingInitialCost('${key}')`:`upCost('${key}')`);
  for(const [rk,n]of Object.entries(cost))if(rk!=='time')
    assert.ok(game.run(`resCap('${rk}')`)>=n,`${key} Lv${from+1} ${rk} cap ${game.run(`resCap('${rk}')`)} < ${n}`);
  const requirements=Object.entries(cost).filter(([rk])=>rk!=='time')
    .map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&');
  const waited=waitUntil(requirements,20000,`${key} resources`);
  assert.equal(game.run(`buildAct('${key}').ok`),true,`${key} paid`);
  const buildSeconds=waitUntil(`bldSt('${key}').lv===${from+1}&&bldSt('${key}').state==='idle'`,500,`${key} built`);
  game.saveReload(`${key} ${from+1}`);
  steps.push({action:'build',key,from,to:from+1,cost,waited,buildSeconds});
}
function research(id){
  const cost=game.run(`activeSciences()['${id}'].cost`);
  assert.ok(game.run("resCap('tech')")>=cost.tech,`${id} knowledge cap`);
  const waited=waitUntil(Object.entries(cost).filter(([,n])=>n>0)
    .map(([rk,n])=>rk==='merit'?`S.merit>=${n}`:`S.res.${rk}>=${n}`).join('&&'),20000,`${id} costs`);
  const result=game.run(`researchScience('${id}')`);
  assert.equal(result?.ok,true,`${id} paid`);
  assert.equal(game.run(`S.sciences.includes('${id}')`),true);
  game.saveReload(id);
  steps.push({action:'science',id,cost,waited});
}
function checkpoint(label,g){
  const rel=`${dir}/p406-l98-alloy-${label}-save.json`;
  fs.writeFileSync(path.join(root,rel),g.saveReload(label)+'\n');
  checkpoints[label]={path:rel,sha256:hash(rel)};
}
function fillAlloy(g){
  g.setWorkers(steelWorkers);
  const before=g.own('alloy_special'),target=80;
  const missing=target-before-(g.run('S.queue.alloy_special?.count||0'));
  if(missing>0){const r=g.run(`train('alloy_special',${missing})`);
    assert.equal(r?.ok,true);assert.equal(r.qty,missing)}
  let seconds=0;
  while(g.own('alloy_special')<target&&seconds<120000){
    g.wait(10);seconds+=10;minFood=Math.min(minFood,g.run('S.res.food'));
  }
  assert.equal(g.own('alloy_special'),target,`alloy recruits after ${seconds}s: ${JSON.stringify(g.state())}`);
  g.saveReload('alloy recruits');
  return{type:'alloy_special',before,target,queued:Math.max(0,missing),seconds};
}
function fullRefill(g){
  const iron=g.fill('iron_spearman',20,{food:25,coal:2,iron:2,stone:2});
  const alloy=fillAlloy(g),bow=g.fill('archer_longbow',200,bowWorkers);
  g.form(full);
  assert.equal(g.run('formSoldierCount()'),300);
  return[iron,alloy,bow];
}
try{
  // Earn the exact missing 20 deeds in an actual area fight before buying capacity.
  const prevWin=game.run('S.development.outer.town.wins'),prevDeed=game.run('S.res.deed');
  const areaBefore=game.run('formSoldierCount()'),areaStart=game.run('__p405.timerNow');
  game.run("openDevelopmentOuter('town')");
  assert.equal(game.run('S.battleActive'),true,'outer town launched');
  let callbacks=0;
  while(game.run('S.battleActive')&&callbacks<10000){assert.equal(game.run('__p405Step()'),true);callbacks++}
  assert.equal(game.run('S.development.outer.town.wins'),prevWin+1,'actual area win');
  assert.equal(game.run('S.res.deed'),prevDeed+20,'area deed reward');
  game.run('exitBattle()');game.saveReload('outer town');
  steps.push({action:'outer-town-win',prior:prevWin,after:prevWin+1,deed:20,
    armyBefore:areaBefore,armyAfter:game.run('formSoldierCount()'),callbacks,
    battleMs:game.run('__p405.timerNow')-areaStart});
  const settlement=game.run("upgradeSettlementBatch('smallTown',1,10)");
  assert.equal(settlement?.ok,true,'paid town expansion');
  const populationSeconds=waitUntil('popCurrent()>=31',100,'population growth');
  assert.equal(game.run('popCurrent()'),31);
  game.saveReload('small town 11');
  steps.push({action:'smallTown',cost:settlement.cost,level:11,populationSeconds});
  game.setWorkers({food:22,wood:5,stone:4});
  while(game.run("resCap('stone')")<18000)build('warehouse');
  while(game.run("resCap('food')")<15000)build('large_granary');
  build('academy');
  game.setWorkers({food:23,tech:8});
  research('sci_steel');
  game.setWorkers({food:22,wood:5,stone:4});
  build('academy');
  game.setWorkers({food:23,tech:8});
  research('sci_alloy_age');
  game.setWorkers({food:22,wood:5,stone:4});
  while(game.run("unitCap('alloy_special')")<80)build('alloy_armory');
  assert.equal(game.run("unitCap('alloy_special')"),80);
  checkpoint('growth-paid',game);
  const fills=fullRefill(game);
  steps.push({action:'train-and-form',fills,paidTraining:game.charges(),army:300});
  checkpoint('ready',game);
  setupOnline=game.online();routeRaw=game.raw();
  for(let stage=98;stage<=100;stage++){
    const gate=session(routeRaw).run(`campaignStageLockReason(${stage-1})`);
    if(gate){battleRows.push({stage,mode:'gate',gate,inputSha256:sha(routeRaw)});break}
    let advanced=false;
    for(const mode of stage===98?['ready']:['survivors','full-refill']){
      const candidate=mode==='ready'?game:session(routeRaw),candidateFills=[];
      if(mode==='full-refill')candidateFills.push(...fullRefill(candidate));
      const ownBefore={alloy_special:candidate.own('alloy_special'),
        archer_longbow:candidate.own('archer_longbow')};
      const battle=candidate.battle(stage);
      for(const [type,n]of Object.entries(ownBefore))battle.losses[type]=n-candidate.own(type);
      const row={stage,mode,inputSha256:sha(routeRaw),
        online:mode==='ready'?0:candidate.online(),
        paid:mode==='ready'?{}:candidate.charges(),fills:candidateFills,...battle};
      battleRows.push(row);
      console.log(JSON.stringify({stage,mode,won:battle.won,round:battle.round,
        armyBefore:battle.armyBefore,armyAfter:battle.armyAfter,
        remaining:battle.enemyRemaining.reduce((n,u)=>n+u.hp,0)}));
      if(battle.won){
        advanced=true;routeStage=stage;routeRaw=candidate.raw();
        if(mode!=='ready')winningOnline+=candidate.online();
        winningBattleMs+=battle.battleMs;
        checkpoint(`l${stage}-won`,candidate);
        break;
      }
      if(mode==='ready')checkpoint('l98-loss',candidate);
    }
    if(!advanced)break;
  }
}catch(error){failure=String(error.stack||error);console.error(failure)}
if(!failure&&routeStage===99){
  const audit=session(routeRaw),before=audit.raw();
  const ids=['sci_steam_age','sci_electric_age','sci_nuclear_age',
    'sci_star_beast_domain','sci_star_array','sci_quantum_age'];
  const sciencePath=ids.map(id=>audit.run(`({id:'${id}',name:sciName('${id}'),
    need:scienceNeedIds('${id}'),cost:{...activeSciences()['${id}'].cost}})`));
  const mandatoryCost={};
  for(const row of sciencePath)for(const [rk,n]of Object.entries(row.cost))
    if(rk!=='merit')mandatoryCost[rk]=(mandatoryCost[rk]||0)+n;
  const balance=audit.run("({tech:S.res.tech,steel:S.res.steel,medal:S.res.medal,techCap:resCap('tech'),steelCap:resCap('steel'),medalCap:resCap('medal')})");
  const nextResearch=audit.run("researchScience('sci_steam_age')");
  const selection=audit.run('selEnemy(99)');
  assert.equal(nextResearch?.reason,'insufficient-tech');
  assert.equal(selection,false,'L100 selection rejected');
  assert.equal(audit.raw(),before,'failed gates did not write save');
  gateAudit={reason:audit.run('campaignStageLockReason(99)'),selection,
    nextResearch,balance,sciencePath,mandatoryCost,saveUnchanged:true};
}
const bestPath=`${dir}/p406-l98-alloy-best-win-save.json`;
fs.writeFileSync(path.join(root,bestPath),routeRaw+'\n');
const ledgerPath=`${dir}/p406-l98-alloy-ledger.jsonl`;
fs.writeFileSync(path.join(root,ledgerPath),battleRows.map(x=>JSON.stringify(x)).join('\n')+'\n');
const summary={batch:'P406',input,inputSha256:sourceHash[input],sourceHash,
  method:'One actual paid v36 continuation: area win, settlement/population, buildings, scholars/science, queued steel troop training, modal formation, fixed RNG 0.5 combat callbacks, settlement and independent reload',
  units:'online is simulated noncombat tick seconds; battleMs is simulated callback milliseconds; menu actions are instant in harness',
  steps,setupOnline,winningOnline,winningBattleMs,sampledMinFood:minFood,routeStage,gateAudit,
  attempts:battleRows.length,stop:battleRows.at(-1),checkpoints,bestPath,bestSha256:hash(bestPath),
  ledgerPath,failure};
fs.writeFileSync(path.join(root,`${dir}/p406-l98-alloy-paid.json`),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash);
if(failure)process.exitCode=1;
