'use strict';
// 条件军力矩阵：只验证真实战斗公式下各档所需单团兵力；不代表建造、招募可达。
const {environment}=require('../../tests/progression/harness');
function fight(killValue,groups){
  const e=environment();
  const formation={front:[],mid:[],back:[]};
  let fid=101;
  for(const [row,type,count] of groups)formation[row].push({type,count,id:fid++});
  e.run(`
    Math.random=()=>0.5;
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    S.sciences=['sci_alloy_age','sci_god_domain'];S.killValues.godRevival=${killValue};
    S.buildings.barracks={lv:10,state:'idle'};S.buildings.alloy_armory={lv:17,state:'idle'};
    S.buildings.archer_range={lv:10,state:'idle'};S.buildings.steam_armory={lv:17,state:'idle'};
    S.formation=${JSON.stringify(formation)};
    openGodDomain();
  `);
  const enemy=e.run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  for(let step=0;step<500&&e.run('S.battleActive');step++)if(!e.run('__step()'))throw Error('battle timer missing');
  if(e.run('S.battleActive'))throw Error('battle did not settle');
  return{win:e.run('S.items.godCrystal')>0,survivors:e.run("S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0)"),round:e.run('B.round'),enemy};
}
const rows=[];
const formations={
  alloy55:[['front','alloy_special',55]],
  alloy30_archer30:[['front','alloy_special',30],['back','archer',30]],
  alloy40_archer40:[['front','alloy_special',40],['back','archer',40]],
  alloy55_archer55:[['front','alloy_special',55],['back','archer',55]],
  alloy30_armor30_archer30:[['front','alloy_special',30],['mid','armored_trooper',30],['back','archer',30]],
  alloy35_armor35_archer35:[['front','alloy_special',35],['mid','armored_trooper',35],['back','archer',35]],
  alloy40_armor40_archer40:[['front','alloy_special',40],['mid','armored_trooper',40],['back','archer',40]]
};
for(const k of [600,700,800,900,1000]){
  const row={killValue:k,enemy:fight(k,formations.alloy55).enemy};
  for(const [name,groups] of Object.entries(formations)){
    const result=fight(k,groups);
    row[name]={win:result.win,survivors:result.survivors,round:result.round};
  }
  rows.push(row);
}
console.log(JSON.stringify(rows,null,2));
