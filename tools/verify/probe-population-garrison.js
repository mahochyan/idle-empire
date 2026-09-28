'use strict';
// Replay the existing zero-expedition-battle 18-population route with the real
// garrison state machine enabled. No game resources, villagers, or unlocks are
// injected. Each seed replaces only Math.random with a repeatable LCG.
// node tools/verify/probe-population-garrison.js [seed ...]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const harness=require('../../tests/progression/harness');

const source=path.join(__dirname,'probe-population-early-18.js');
const files=['config.js','levels.js','math.js','garrison.js',
  'tests/progression/harness.js','tools/verify/probe-population-early-18.js'];
function sourceHash(){
  const hash=crypto.createHash('sha256');
  for(const file of files)hash.update(fs.readFileSync(path.join(__dirname,'../..',file)));
  return hash.digest('hex');
}

function replay(seed){
  let game=null,report=null;
  const originalEnvironment=harness.environment;
  const originalLog=console.log;
  const hashBefore=sourceHash();
  harness.environment=()=>{
    game=originalEnvironment({}, {garrison:seed!==null});
    if(seed!==null){
      game.run(`(()=>{
        let state=${seed}>>>0;
        const seededMath=Object.create(Math);
        seededMath.random=()=>{
          state=(Math.imul(1664525,state)+1013904223)>>>0;
          return state/4294967296;
        };
        globalThis.Math=seededMath;
      })()`);
    }
    game.run(`
      globalThis.__garrisonProbe={invasions:0,lossEvents:0,loss:{},at18:null,minFoodUntil18:S.res.food};
      const originalStartGarrisonInvasion=startGarrisonInvasion;
      startGarrisonInvasion=function(inv){
        __garrisonProbe.invasions++;
        return originalStartGarrisonInvasion(inv);
      };
      const originalApplyDefeatLoss=applyDefeatLoss;
      applyDefeatLoss=function(){
        const loss=originalApplyDefeatLoss();
        __garrisonProbe.lossEvents++;
        for(const [key,amount] of Object.entries(loss))
          __garrisonProbe.loss[key]=(__garrisonProbe.loss[key]||0)+amount;
        return loss;
      };
      const originalPopulationTick=tick;
      tick=function(){
        originalPopulationTick();
        if(__garrisonProbe.at18===null){
          __garrisonProbe.minFoodUntil18=Math.min(__garrisonProbe.minFoodUntil18,S.res.food);
          if(maxPop()===18&&popCurrent()===18){
            __garrisonProbe.at18={second:S.tick,res:{...S.res},
              invasions:__garrisonProbe.invasions,lossEvents:__garrisonProbe.lossEvents,
              loss:{...__garrisonProbe.loss},
              garrisonPhase:S.garrison?.phase||'none',battleWins:S.defeated.length};
          }
        }
      };
    `);
    return game;
  };
  console.log=value=>{report=JSON.parse(String(value));};
  try{
    delete require.cache[require.resolve(source)];
    require(source);
    assert.equal(sourceHash(),hashBefore,'game/probe source changed during replay');
    const probe=JSON.parse(JSON.stringify(game.run('__garrisonProbe')));
    const milestone=report.milestones.find(item=>item.label==='population-18');
    assert.ok(milestone,'route never recorded 18/18');
    assert.equal(probe.at18?.second,milestone.second);
    assert.equal(milestone.population,18);
    assert.equal(milestone.capacity,18);
    assert.equal(probe.at18.battleWins,0);
    return {seed:seed===null?'baseline':seed,onlineSeconds:probe.at18.second,
      resourceLossTo18:probe.at18.loss,invasionsTo18:probe.at18.invasions,
      lossEventsTo18:probe.at18.lossEvents,minFoodTo18:Number(probe.minFoodUntil18.toFixed(3)),
      resourcesAt18:milestone.resources,marketExchanges:milestone.actions.exchange,
      reached:true};
  }catch(error){
    let probe=null;
    try{
      if(game)probe=JSON.parse(JSON.stringify(game.run(
        'typeof __garrisonProbe === "undefined" ? null : __garrisonProbe')));
    }catch(_ignored){}
    return {seed:seed===null?'baseline':seed,reached:false,
      onlineSeconds:probe?.at18?.second??null,
      resourceLossTo18:probe?.at18?.loss||probe?.loss||{},
      error:String(error.stack||error)};
  }finally{
    harness.environment=originalEnvironment;
    console.log=originalLog;
  }
}

const input=process.argv.slice(2);
const seeds=input.length?input.map(Number):Array.from({length:20},(_,index)=>
  crypto.createHash('sha256').update(`population-garrison-${index}`).digest().readUInt32LE(0));
assert.ok(seeds.every(seed=>Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff));
const sourceSha256=sourceHash();
const results=[replay(null),...seeds.map(replay)];
assert.equal(sourceHash(),sourceSha256,'game/probe source changed across seed replays');
console.log(JSON.stringify({unit:'online seconds',sourceSha256,assumptions:{
  route:'unchanged tools/verify/probe-population-early-18.js actions',
  expeditionBattles:0,garrison:'actual garrisonTick and empty-garrison defeat path',
  random:'per-seed 32-bit LCG; illustrative repeatable seeds, not a player-time distribution'
},results},null,2));
if(results.some(result=>!result.reached))process.exitCode=1;
