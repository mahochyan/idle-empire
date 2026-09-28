'use strict';
// 从P59第45关双材料实付档生产知识与钢、顺序研究并制造蒸汽甲；不预置库存或胜场。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const arg=prefix=>process.argv.find(x=>x.startsWith(prefix))?.slice(prefix.length);
const input=arg('--save='),output=arg('--snapshot-final=');
assert.ok(input&&output,'须提供 --save 与 --snapshot-final');
const e=environment({rts_save:fs.readFileSync(input,'utf8')}),run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
assert.equal(run('S.defeated.length'),45);
assert.equal(run('S.weaponForge.armored.researched'),true);
const start=run("({second:S.tick,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,steel:S.res.steel,steelCap:resCap('steel'),core:S.items.godCore,pop:S.population.current})");
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退${key}失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配${key}失败`);
}
function waitUntil(condition,limit){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${limit}){tick();n++}return{seconds:n,reached:!!(${condition})}})()`);
  assert.equal(result.reached,true,`${condition} 在${limit}在线秒内未达`);
  return result.seconds;
}
assign({food:20,tech:82});
const studies=[];
for(const key of ['gatling','mortar','steamArmor']){
  const cost=run(`CFG.weaponForge.${key}.researchCost`);
  assert.ok(run('S.res.medal')>=cost.medal,key+'缺勋章');
  const seconds=waitUntil(`S.res.tech>=${cost.tech}`,100000);
  const before=run('({tech:S.res.tech,medal:S.res.medal})');
  assert.equal(run(`researchWeapon('${key}')`)?.ok,true,key+'研究失败');
  assert.equal(Math.round(before.tech-run('S.res.tech')),cost.tech);
  assert.equal(before.medal-run('S.res.medal'),cost.medal);
  studies.push({key,cost,seconds,second:run('S.tick')});
}
const jobs={food:10,stone:33,coal:26,iron:20,steel:12};
assign(jobs);
const steelRate=run("prodRate('steel')");
assert.ok(run("resCap('steel')")>=20000,'钢仓不足单次锻造费');
let productionSeconds=0,foodSeconds=0,forges=0;
while(run('S.weaponForge.steamArmor.level')<1){
  while(run('S.res.steel')<20000){
    if(run('S.res.food')<10000){
      assign({food:102});
      foodSeconds+=waitUntil("S.res.food>=Math.min(100000,resCap('food')*0.8)",100000);
      assign(jobs);
    }
    productionSeconds+=run("(()=>{let n=0;while(S.res.steel<20000&&S.res.food>=10000&&n<1000){tick();n++}return n})()");
    assert.ok(productionSeconds<500000,'50万在线秒仍未生产足够钢');
  }
  const before=run('S.res.steel');
  assert.equal(run("forgeWeapon('steamArmor')")?.ok,true,'蒸汽甲锻造失败');
  assert.equal(Math.round(before-run('S.res.steel')),20000);
  forges++;
  assert.ok(forges<=20);
}
assert.equal(forges,20);
assert.equal(run("setWeaponEquipped('steamArmor',true)")?.ok,true);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
const reloaded=environment({rts_save:JSON.stringify(saved)});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run('S.weaponForge.steamArmor.equipped'),true);
fs.writeFileSync(output,JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'online seconds; resource units',start,studies,steelRate,productionSeconds,foodSeconds,forges,finish:{second:saved.tick,tech:saved.res.tech,medal:saved.res.medal,steel:saved.res.steel,core:saved.items.godCore,armor:saved.weaponForge.steamArmor,def:run("weaponDefense('armored_trooper')")}},null,2));
