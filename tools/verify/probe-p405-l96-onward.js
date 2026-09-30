'use strict';
// Consecutive paid mainline from the L95 T3 longbow victory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const dir='docs/codex/reports/data';
const input=`${dir}/p405-l95-longbow-final-save.json`;
const hashBytes=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=f=>hashBytes(fs.readFileSync(path.join(root,f)));
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const source=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(JSON.parse(source).defeated.length,95);
const full=[['front','gold_cavalry',25],['front','silver_heavy',25],
  ['front','silver_heavy',15],['front','bronze_guard',20],
  ['mid','gold_cavalry',4],['mid','iron_spearman',20],
  ['back','archer_longbow',25],['back','archer_longbow',25],
  ['back','archer_longbow',25],['back','archer_longbow',25]];
const supplies=[
  ['archer_longbow',100,{food:13,wood:4,stone:2}],
  ['bronze_guard',20,{food:11,coal:4,copper:2,stone:2}],
  ['iron_spearman',20,{food:11,coal:2,iron:2,stone:2,wood:2}],
  ['silver_heavy',40,{food:14,coal:1,silver:1,stone:1,wood:2}],
  ['gold_cavalry',29,{food:18,coal:1,gold:1,stone:1}]
];
const checkpoints={},rows=[],setupSteps=[];
let route=source,stageWon=95,totalOnline=0,totalBattleMs=0,failure=null;
try{
  const setup=session(route);
  const outerBefore=setup.run('S.development.outer.village.wins');
  const deedBefore=setup.run('S.res.deed');
  const areaStartMs=setup.run('__p405.timerNow');
  setup.run("openDevelopmentOuter('village')");
  assert.equal(setup.run('S.battleActive'),true,'outer village launched');
  let areaCallbacks=0;
  while(setup.run('S.battleActive')&&areaCallbacks<10000){
    assert.equal(setup.run('__p405Step()'),true);areaCallbacks++;
  }
  assert.equal(setup.run('S.development.outer.village.wins'),outerBefore+1,'outer village win');
  assert.equal(setup.run('S.res.deed'),deedBefore+12,'outer village paid deed reward');
  const areaBattleMs=setup.run('__p405.timerNow')-areaStartMs;
  setup.run('exitBattle()');
  setup.saveReload('outer village');
  setupSteps.push({action:'outer village',winFrom:outerBefore,winTo:outerBefore+1,
    deedGained:12,areaCallbacks,areaBattleMs,armyAfter:setup.run('formSoldierCount()')});
  const settlement=setup.run("upgradeSettlement('smallTown',5)");
  assert.equal(settlement?.ok,true,'paid town expansion');
  let populationWait=0;
  while(setup.run('popCurrent()')<21&&populationWait<100){setup.wait(10);populationWait+=10}
  assert.equal(setup.run('popCurrent()'),21,'organic population growth');
  setup.saveReload('settlement population');
  setupSteps.push({action:'smallTown',cost:30,level:6,populationWait,current:21});
  setup.setWorkers({food:14,wood:4,stone:3});
  const build=key=>{
    const start=setup.run(`S.buildings.${key}?.lv||0`);
    const {time,...cost}=setup.run(`upCost('${key}')`);
    let waited=0;
    while(Object.entries(cost).some(([k,v])=>setup.run(`S.res.${k}`)<v)&&waited<10000){setup.wait(10);waited+=10}
    assert.ok(waited<10000,`build resources ${key}`);
    assert.equal(setup.run(`buildAct('${key}').ok`),true,`build ${key}`);
    let buildSeconds=0;
    while(setup.run(`S.buildings.${key}.state`)!=='idle'&&buildSeconds<200){setup.wait(10);buildSeconds+=10}
    assert.equal(setup.run(`S.buildings.${key}.lv`),start+1);
    setup.saveReload(`build ${key} ${start+1}`);
    setupSteps.push({key,from:start,to:start+1,cost,waited,buildSeconds});
  };
  while(setup.run("resCap('stone')")<8900)build('warehouse');
  while(setup.run("regMax()")<25)build('barracks');
  while(setup.run("unitCap('archer_longbow')")<100)build('archer_range');
  totalOnline+=setup.online();route=setup.raw();
  const readyPath=`${dir}/p405-l96-expanded-capacity-save.json`;
  fs.writeFileSync(path.join(root,readyPath),route+'\n');
  checkpoints.expandedCapacity={path:readyPath,sha256:hash(readyPath)};
  for(let stage=96;stage<=100;stage++){
    const gate=session(route).run(`campaignStageLockReason(${stage-1})`);
    if(gate){rows.push({stage,mode:'gate',gate,inputSha256:hashBytes(route)});break}
    let advanced=false;
    for(const mode of ['survivors','full-refill']){
      const game=session(route),fills=[];
      if(mode==='full-refill'){
        for(const [type,target,workers]of supplies)fills.push(game.fill(type,target,workers));
        game.form(full);
      }
      const bowBefore=game.own('archer_longbow');
      const battle=game.battle(stage);
      battle.losses.archer_longbow=bowBefore-game.own('archer_longbow');
      const row={stage,mode,inputSha256:hashBytes(route),online:game.online(),
        paid:game.charges(),fills,...battle};
      rows.push(row);
      console.log(JSON.stringify({stage,mode,won:battle.won,round:battle.round,
        armyBefore:battle.armyBefore,armyAfter:battle.armyAfter,online:row.online}));
      if(battle.won){
        stageWon=stage;route=game.raw();totalOnline+=row.online;totalBattleMs+=battle.battleMs;
        if(stage===99||stage===100){
          const name=`${dir}/p405-mainline-l${stage}-save.json`;
          fs.writeFileSync(path.join(root,name),route+'\n');
          checkpoints[stage]={path:name,sha256:hash(name)};
        }
        advanced=true;break;
      }
    }
    if(!advanced)break;
  }
}catch(error){failure=String(error.stack||error);console.error(failure)}
const finalPath=`${dir}/p405-l96-onward-final-save.json`;
fs.writeFileSync(path.join(root,finalPath),route+'\n');
const ledgerPath=`${dir}/p405-l96-onward-ledger.jsonl`;
fs.writeFileSync(path.join(root,ledgerPath),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
const paid={},wins=rows.filter(r=>r.won);
for(const row of wins)for(const [rk,n]of Object.entries(row.paid||{}))paid[rk]=(paid[rk]||0)+n;
const summary={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'Each stage candidate independently reloaded from last paid v36 win; actual paid training, modal formation, battle callbacks and reload; Math.random fixed 0.5',
  units:'online is simulated tick seconds; battleMs is simulated callback milliseconds',
  setupSteps,stageWon,totalOnline,totalBattleMs,paid,wins:wins.length,attempts:rows.length,
  stop:rows.at(-1),checkpoints,finalPath,finalSha256:hash(finalPath),ledgerPath,failure};
fs.writeFileSync(path.join(root,`${dir}/p405-l96-onward.json`),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash);
if(failure)process.exitCode=1;
