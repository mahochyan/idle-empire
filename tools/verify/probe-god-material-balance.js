'use strict';
// 条件军力矩阵，仅定位我方 HP=兵数换算的战斗墙；预置军队和警戒值，不作为自然可达证据。
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
function evaluate(key,kill,front,mid,count){
  const e=environment();
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));
    Math.random=()=>0.5;
    S.sciences=['sci_alloy_age','sci_steam_age','sci_electric_age'];
    S.buildings.barracks={lv:10,state:'idle'};
    S.formation={front:[{type:'${front}',count:${count},id:101}],
      mid:[{type:'${mid}',count:${count},id:102}],back:[{type:'archer',count:${count},id:103}]};
    S.killValues.${key==='guardianStone'?'godGuardian':'godPhantom'}=${kill};
    openMaterialDomain('${key}');
  `);
  const initial=e.run(`({enemy:B.enemyCfg.units,reward:B.enemyCfg.reward.${key},atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})`);
  for(let i=0;i<500&&e.run('S.battleActive');i++)assert.equal(e.run('__step()'),true);
  assert.equal(e.run('S.battleActive'),false);
  return{key,kill,front,mid,count,enemy:initial.enemy,atk:initial.atk,def:initial.def,
    reward:initial.reward,win:e.run(`S.items.${key}`)>0,
    round:e.run('B.round'),formation:e.run('S.formation')};
}
const rows=[];
for(const key of ['guardianStone','phantomFlower'])
  for(const kill of [0,800,1000,1200,1300,1400,1500])
    for(const [front,mid] of [
      ['alloy_special','armored_trooper'],['electro_trooper','armored_trooper']
    ])for(const count of [40,55])rows.push(evaluate(key,kill,front,mid,count));
console.log(JSON.stringify(rows.map(r=>({key:r.key,atk:r.atk,def:r.def,kill:r.kill,front:r.front,count:r.count,
  enemyCount:Object.values(r.enemy)[0][0],reward:r.reward,win:r.win,
  survivors:['front','mid','back'].map(row=>r.formation[row][0]?.count||0)}))));
