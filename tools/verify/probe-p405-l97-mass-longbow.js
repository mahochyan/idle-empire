'use strict';
// One paid, reloadable mass-longbow growth route from the L96 mainline victory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..'),dir='docs/codex/reports/data';
const input=`${dir}/p405-l96-onward-final-save.json`;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=f=>sha(fs.readFileSync(path.join(root,f)));
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(JSON.parse(raw).defeated.length,96);
const buildRows=[],areaRows=[],battleRows=[],checkpoints={};
const full=[['front','gold_cavalry',29],['front','silver_heavy',30],
  ['front','silver_heavy',10],['front','bronze_guard',20],
  ['mid','iron_spearman',20],['mid','archer_longbow',30],
  ['mid','archer_longbow',30],['mid','archer_longbow',20],
  ['back','archer_longbow',30],['back','archer_longbow',30],
  ['back','archer_longbow',30],['back','archer_longbow',30]];
const supplies=[
  ['gold_cavalry',29,{food:26,coal:1,gold:1,stone:1}],
  ['silver_heavy',40,{food:26,coal:1,silver:1,stone:1}],
  ['bronze_guard',20,{food:22,coal:3,copper:2,stone:2}],
  ['iron_spearman',20,{food:22,coal:2,iron:2,stone:2,wood:1}],
  ['archer_longbow',200,{food:26,wood:2,stone:1}]
];
let route=raw,routeStage=96,setup=null,setupFills=null,totalOnline=0,totalBattleMs=0,failure=null;
const checkpoint=(label,game)=>{
  const rel=`${dir}/p405-l97-${label}-save.json`;
  fs.writeFileSync(path.join(root,rel),game.saveReload(label)+'\n');
  checkpoints[label]={path:rel,sha256:hash(rel)};
};
try{
  const game=session(route);
  // Nine actual town victories pay 180 deeds; the fifth win is followed by a paid bow refill.
  for(let i=0;i<9;i++){
    if(i===5){
      const refill=game.fill('archer_longbow',100,{food:17,wood:2,stone:2});
      game.form([['back','archer_longbow',25],['back','archer_longbow',25],
        ['back','archer_longbow',25],['back','archer_longbow',25]]);
      areaRows.push({action:'refill',...refill});
    }
    const before=game.run('S.development.outer.town.wins'),deed=game.run('S.res.deed');
    const army=game.run('formSoldierCount()'),t0=game.run('__p405.timerNow');
    game.run("openDevelopmentOuter('town')");
    assert.equal(game.run('S.battleActive'),true,'outer town launched');
    let callbacks=0;
    while(game.run('S.battleActive')&&callbacks<10000){
      assert.equal(game.run('__p405Step()'),true);callbacks++;
    }
    assert.equal(game.run('S.development.outer.town.wins'),before+1,`outer town win ${i+1}`);
    assert.equal(game.run('S.res.deed'),deed+20,'paid deed reward');
    game.run('exitBattle()');game.saveReload(`town ${i+1}`);
    areaRows.push({action:'town-win',from:before,to:before+1,deed:20,
      callbacks,battleMs:game.run('__p405.timerNow')-t0,armyBefore:army,
      armyAfter:game.run('formSoldierCount()')});
  }
  const deedBefore=game.run('S.res.deed');
  const expansion=game.run("upgradeSettlementBatch('smallTown',4,6)");
  assert.equal(expansion?.ok,true,'four paid town levels');
  let populationWait=0;
  while(game.run('popCurrent()')<29&&populationWait<100){game.wait(10);populationWait+=10}
  assert.equal(game.run('popCurrent()'),29,'organic population growth to 29');
  buildRows.push({action:'smallTown',levels:4,deedBefore,cost:expansion.cost,
    deedAfter:game.run('S.res.deed'),populationWait});
  game.setWorkers({food:20,wood:5,stone:4});
  const build=key=>{
    const start=game.run(`S.buildings.${key}?.lv||0`);
    const {time,...cost}=game.run(`upCost('${key}')`);
    let waited=0;
    while(Object.entries(cost).some(([k,v])=>game.run(`S.res.${k}`)<v)&&waited<10000){game.wait(10);waited+=10}
    assert.ok(waited<10000,`build resources ${key} ${JSON.stringify(cost)}`);
    assert.equal(game.run(`buildAct('${key}').ok`),true,`build ${key}`);
    let buildSeconds=0;
    while(game.run(`S.buildings.${key}.state`)!=='idle'&&buildSeconds<200){game.wait(10);buildSeconds+=10}
    assert.equal(game.run(`S.buildings.${key}.lv`),start+1);
    game.saveReload(`build ${key} ${start+1}`);
    buildRows.push({action:'build',key,from:start,to:start+1,cost,waited,buildSeconds});
  };
  while(game.run("resCap('stone')")<15034)build('warehouse');
  while(game.run("resCap('food')")<13000)build('large_granary');
  while(game.run('regMax()')<30)build('barracks');
  while(game.run("unitCap('archer_longbow')")<200)build('archer_range');
  while(game.run('S.buildings.farm.lv')<25)build('farm');
  const capacities=game.run("({stone:resCap('stone'),wood:resCap('wood'),food:resCap('food'),regiment:regMax(),longbow:unitCap('archer_longbow'),foodRate:prodRate('food')})");
  checkpoint('expanded-capacity',game);
  setupFills=[];
  for(const [type,target,workers]of supplies)setupFills.push(game.fill(type,target,workers));
  game.form(full);
  assert.equal(game.run('formSoldierCount()'),309,'all 309 soldiers placed');
  checkpoint('ready',game);
  setup={capacities,areaRows,buildRows,setupFills,paidTraining:game.charges(),
    online:game.online(),ready:checkpoints.ready};
  route=game.raw();totalOnline+=game.online();
  for(let stage=97;stage<=100;stage++){
    const gate=session(route).run(`campaignStageLockReason(${stage-1})`);
    if(gate){battleRows.push({stage,mode:'gate',gate,inputSha256:sha(route)});break}
    let won=false;
    for(const mode of stage===97?['ready']:['survivors','full-refill']){
      const candidate=mode==='ready'?game:session(route),fills=[];
      if(mode==='full-refill'){
        for(const [type,target,workers]of supplies)fills.push(candidate.fill(type,target,workers));
        candidate.form(full);
      }
      const bowBefore=candidate.own('archer_longbow');
      const battle=candidate.battle(stage);
      battle.losses.archer_longbow=bowBefore-candidate.own('archer_longbow');
      battleRows.push({stage,mode,inputSha256:sha(route),online:mode==='ready'?0:candidate.online(),
        paid:mode==='ready'?{}:candidate.charges(),fills,...battle});
      console.log(JSON.stringify({stage,mode,won:battle.won,round:battle.round,
        armyBefore:battle.armyBefore,armyAfter:battle.armyAfter}));
      if(battle.won){
        won=true;routeStage=stage;route=candidate.raw();
        if(mode!=='ready')totalOnline+=candidate.online();
        totalBattleMs+=battle.battleMs;
        checkpoint(stage===97?'won':`l${stage}-won`,candidate);
        break;
      }
    }
    if(!won)break;
  }
}catch(error){failure=String(error.stack||error);console.error(failure)}
const finalPath=`${dir}/p405-l97-mass-longbow-final-save.json`;
fs.writeFileSync(path.join(root,finalPath),route+'\n');
const ledgerPath=`${dir}/p405-l97-mass-longbow-ledger.jsonl`;
fs.writeFileSync(path.join(root,ledgerPath),battleRows.map(x=>JSON.stringify(x)).join('\n')+'\n');
const summary={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'One real paid v36 route: outer town wins, settlement, tick growth, building upgrades, queues, modal formation, campaign callbacks and independent reload; fixed Math.random 0.5',
  units:'online is simulated noncombat tick seconds; battleMs is simulated callback milliseconds; UI actions instant in harness',
  setup,routeStage,totalOnline,totalBattleMs,attempts:battleRows.length,
  stop:battleRows.at(-1),checkpoints,finalPath,finalSha256:hash(finalPath),ledgerPath,failure};
fs.writeFileSync(path.join(root,`${dir}/p405-l97-mass-longbow.json`),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash);
if(failure)process.exitCode=1;
