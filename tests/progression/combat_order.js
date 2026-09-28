'use strict';
// Run with: node tests/progression/combat_order.js
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function withRandom(values,fn){
  const original=Math.random;
  let calls=0;
  Math.random=()=>values[calls++%values.length];
  try{return {value:fn(),calls}}finally{Math.random=original}
}

function sortedWithExtraComparisons(extra){
  const e=environment();
  e.run(`globalThis.__nativeSort=Array.prototype.sort;
    if(${extra})Array.prototype.sort=function(compare){
      if(compare&&this.length>2){compare(this[0],this[1]);compare(this[1],this[2])}
      return __nativeSort.call(this,compare)
    };`);
  const outcome=withRandom([0],()=>e.run(`(()=>{
    const units=[{id:'slow',spd:1},{id:'first',spd:5},
      {id:'second',spd:5},{id:'fast',spd:9}];
    let speedReads=0;
    const same=sortCombatUnitsBySpeed(units,u=>{speedReads++;return u.spd})===units;
    return JSON.stringify({ids:units.map(u=>u.id),speedReads,same})
  })()`));
  return {...JSON.parse(outcome.value),rngCalls:outcome.calls};
}

check('同速洗牌与速度优先不依赖 Array.sort 比较次数',()=>{
  const normal=sortedWithExtraComparisons(false);
  const extra=sortedWithExtraComparisons(true);
  assert.deepEqual(normal,{ids:['fast','second','first','slow'],speedReads:4,same:true,rngCalls:1});
  assert.deepEqual(extra,normal);
});

check('三人同速只抽两次并保持高速兵团在前',()=>{
  const e=environment();
  const outcome=withRandom([0,0.9],()=>e.run(`(()=>{
    const units=[{id:'a',spd:5},{id:'fast',spd:6},
      {id:'b',spd:5},{id:'c',spd:5}];
    sortCombatUnitsBySpeed(units,u=>u.spd);
    return JSON.stringify(units.map(u=>u.id))
  })()`));
  assert.deepEqual(JSON.parse(outcome.value),['fast','c','b','a']);
  assert.equal(outcome.calls,2);
});

check('正式远征回合按同速洗牌后的次序出手',()=>{
  const e=environment();
  const result=withRandom([0],()=>e.run(`(()=>{
    const getNode=document.getElementById;
    document.getElementById=id=>id.startsWith('ou-')||id.startsWith('eu-')
      ?null:getNode(id);
    S.selEnemy=0;
    S.formation={front:[1,2,3].map(id=>({type:'infantry',count:100,id})),mid:[],back:[]};
    B.isTraining=false;S.battleActive=true;initBattleState();
    globalThis.__sortCalls=[];globalThis.__firstActor=null;
    const realSort=sortCombatUnitsBySpeed;
    sortCombatUnitsBySpeed=(units,speedOf)=>{
      const sorted=realSort(units,speedOf);
      __sortCalls.push(sorted.map(u=>u.id));return sorted
    };
    const realTarget=getTarget;
    getTarget=(actor,foes)=>{if(__firstActor===null)__firstActor=actor.id;
      return realTarget(actor,foes)};
    battleTurn();
    return JSON.stringify({round:B.round,sortCalls:__sortCalls,firstActor:__firstActor})
  })()`));
  assert.deepEqual(JSON.parse(result.value),{
    round:1,sortCalls:[[1,2,0],[4,3]],firstActor:4
  });
});

check('正式训练场回合让三个同速兵团依洗牌顺序行动',()=>{
  const e=environment();
  const result=withRandom([0],()=>e.run(`(()=>{
    const getNode=document.getElementById;
    document.getElementById=id=>id.startsWith('ou-')||id.startsWith('eu-')
      ?null:getNode(id);
    S.formation={front:[1,2,3].map(id=>({type:'infantry',count:1,id})),mid:[],back:[]};
    B.isTraining=true;S.battleActive=true;initBattleState();
    globalThis.__timers=new Map();globalThis.__nextTimerId=1;
    globalThis.setTimeout=fn=>{const id=__nextTimerId++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__actors=[];
    const realTarget=getTarget;
    getTarget=(actor,foes)=>{__actors.push(actor.id);return realTarget(actor,foes)};
    battleTurn();
    for(let i=0;i<20&&__actors.length<3;i++){
      const next=__timers.entries().next().value;
      if(!next)break;
      __timers.delete(next[0]);next[1]();
    }
    return JSON.stringify({round:B.round,actors:__actors})
  })()`));
  assert.deepEqual(JSON.parse(result.value),{round:1,actors:[1,2,0]});
});

check('正式驻军结算也按同速洗牌后的次序出手',()=>{
  const e=environment({}, {garrison:true});
  const result=withRandom([0],()=>e.run(`(()=>{
    S._garrisonForm={front:[1,2,3].map(id=>({type:'infantry',count:100,id})),mid:[],back:[]};
    CFG.garrisonInvade.maxRounds=1;
    globalThis.__sortCalls=[];globalThis.__actors=[];
    const realSort=sortCombatUnitsBySpeed;
    sortCombatUnitsBySpeed=(units,speedOf)=>{
      const sorted=realSort(units,speedOf);
      __sortCalls.push(sorted.map(u=>u.id));return sorted
    };
    const realTarget=getGarrisonTarget;
    getGarrisonTarget=(actor,foes)=>{__actors.push(actor.id);
      return realTarget(actor,foes)};
    const battle=resolveGarrisonBattle({units:{infantry:[100,100]}});
    return JSON.stringify({rounds:battle.rounds,sortCalls:__sortCalls,
      actors:__actors,ourLeft:battle.ourLeft})
  })()`));
  const actual=JSON.parse(result.value);
  assert.deepEqual(actual.sortCalls,[[1,2,0],[1001,1000]]);
  assert.deepEqual(actual.actors.slice(0,5),[1,1001,2,1000,0]);
  assert.ok(actual.ourLeft>0);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
