'use strict';
// 从真实第45关旧档逐笔领取、研发、制造；不预置库存、兵力或研发状态。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const arg=prefix=>process.argv.find(x=>x.startsWith(prefix))?.slice(prefix.length);
const path=arg('--save='),energyPath=arg('--energy-save='),finalPath=arg('--snapshot-final=');
assert.ok(path&&energyPath&&finalPath,'须提供 --save、--energy-save、--snapshot-final');
const e=environment({rts_save:fs.readFileSync(path,'utf8')}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('S.weaponForge.electroArmor.researched'),true);
const start=run("({second:S.tick,cap:resCap('tech'),tech:S.res.tech,medal:S.res.medal,core:S.items.godCore})");
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退${key}失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配${key}失败`);
}
function waitForTech(need){
  assert.ok(run("resCap('tech')")>=need,'当前真实知识仓不足单笔研究费用');
  const n=run(`(()=>{let n=0;while(S.res.tech<${need}&&n<100000){tick();n++}return n})()`);
  assert.ok(run('S.res.tech')>=need,`等待${n}在线秒后知识仍不足`);
  return n;
}
assign({food:20,tech:82});
const rows=[];
for(const [key,snapshot] of [['energyArmor',energyPath],['nanoArmor',finalPath]]){
  const cfg=run(`CFG.weaponForge.${key}`);
  const waited=waitForTech(cfg.researchCost.tech);
  const beforeResearch=run('({tech:S.res.tech,medal:S.res.medal})');
  assert.equal(run(`researchWeapon('${key}')`)?.ok,true,key+'研发付款失败');
  assert.equal(Math.round(beforeResearch.tech-run('S.res.tech')),cfg.researchCost.tech);
  assert.equal(beforeResearch.medal-run('S.res.medal'),cfg.researchCost.medal);
  const coreBefore=run('S.items.godCore');
  for(let i=0;i<20;i++)assert.equal(run(`forgeWeapon('${key}')`)?.ok,true,key+'第'+(i+1)+'次锻造失败');
  assert.equal(coreBefore-run('S.items.godCore'),80);
  assert.equal(run(`S.weaponForge.${key}.level`),1);
  assert.equal(run(`setWeaponEquipped('${key}',true)`)?.ok,true,key+'装备失败');
  const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
  assert.equal(saved.v,29);
  const reload=environment({rts_save:JSON.stringify(saved)});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run(`S.weaponForge.${key}.equipped`),true);
  fs.writeFileSync(snapshot,JSON.stringify(saved),'utf8');
  rows.push({key,waited,fee:cfg.researchCost,corePaid:80,second:saved.tick,tech:saved.res.tech,medal:saved.res.medal,core:saved.items.godCore,def:run("weaponDefense('electro_trooper')")});
}
console.log(JSON.stringify({unit:'online seconds; material units; medals',start,rows},null,2));
