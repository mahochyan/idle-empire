'use strict';
// P60同一实付档续造蒸汽甲至满级；钢和粮由真实岗位生产，不写入条件属性。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const arg=prefix=>process.argv.find(x=>x.startsWith(prefix))?.slice(prefix.length);
const input=arg('--save='),level2File=arg('--level2-save='),output=arg('--snapshot-final=');
assert.ok(input&&level2File&&output,'须提供 --save、--level2-save 与 --snapshot-final');
const e=environment({rts_save:fs.readFileSync(input,'utf8')}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('S.weaponForge.steamArmor.level'),1);
assert.equal(run('S.weaponForge.steamArmor.equipped'),true);
const start=run("({second:S.tick,steel:S.res.steel,steelCap:resCap('steel'),food:S.res.food,medal:S.res.medal,core:S.items.godCore,def:weaponDefense('armored_trooper')})");
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
const jobs={food:10,stone:33,coal:26,iron:20,steel:12};
assign(jobs);
const steelRate=run("prodRate('steel')");
assert.ok(steelRate>0&&run("resCap('steel')")>=20000);
let productionSeconds=0,foodSeconds=0,forges=0,steelPaid=0;
const milestones=[];
while(run('S.weaponForge.steamArmor.level')<3){
  const cost=run("weaponForgeStepCost('steamArmor')");
  while(run('S.res.steel')<cost.steel){
    if(run('S.res.food')<10000){
      assign({food:102});
      foodSeconds+=waitUntil("S.res.food>=Math.min(100000,resCap('food')*0.8)",100000);
      assign(jobs);
    }
    productionSeconds+=run(`(()=>{let n=0;while(S.res.steel<${cost.steel}&&S.res.food>=10000&&n<1000){tick();n++}return n})()`);
    assert.ok(productionSeconds<500000,'50万在线秒仍未生产足够钢');
  }
  const before=run("({steel:S.res.steel,level:S.weaponForge.steamArmor.level,progress:S.weaponForge.steamArmor.progress})");
  const result=run("forgeWeapon('steamArmor')");
  assert.equal(result?.ok,true,`蒸汽甲第${forges+1}次投入失败：${JSON.stringify(result)}`);
  assert.equal(Math.round(before.steel-run('S.res.steel')),cost.steel);
  steelPaid+=cost.steel;forges++;
  if(run('S.weaponForge.steamArmor.level')>before.level){
    const level=run('S.weaponForge.steamArmor.level');
    milestones.push({level,second:run('S.tick'),def:run("weaponDefense('armored_trooper')"),steelPaid,forges});
    if(level===2)fs.writeFileSync(level2File,JSON.stringify(run("JSON.parse(localStorage.getItem('rts_save'))")),'utf8');
  }
  assert.ok(forges<=26,'蒸汽甲投入次数超出12＋14次');
}
assert.equal(forges,26);
assert.equal(steelPaid,520000);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
assert.equal(saved.weaponForge.steamArmor.level,3);
const reloaded=environment({rts_save:JSON.stringify(saved)});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run('S.weaponForge.steamArmor.level'),3);
assert.equal(reloaded.run('S.weaponForge.steamArmor.equipped'),true);
fs.writeFileSync(output,JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'online seconds; resource units',start,steelRate,productionSeconds,foodSeconds,forges,steelPaid,milestones,finish:{second:saved.tick,steel:saved.res.steel,medal:saved.res.medal,core:saved.items.godCore,def:run("weaponDefense('armored_trooper')")}},null,2));
