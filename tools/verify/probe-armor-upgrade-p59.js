'use strict';
// 从已实付能源/纳米首件存档继续逐笔锻造；不预置神核。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const arg=prefix=>process.argv.find(x=>x.startsWith(prefix))?.slice(prefix.length);
const input=arg('--save='),output=arg('--snapshot-final='),key=arg('--armor=')||'nanoArmor',target=Number(arg('--level=')||4);
assert.ok(input&&output&&['energyArmor','nanoArmor'].includes(key)&&Number.isSafeInteger(target)&&target>=2&&target<=40);
const e=environment({rts_save:fs.readFileSync(input,'utf8')}),run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
assert.equal(run('S.defeated.length'),45);
assert.equal(run(`S.weaponForge.${key}.equipped`),true);
const start=run(`({second:S.tick,core:S.items.godCore,level:S.weaponForge.${key}.level,progress:S.weaponForge.${key}.progress})`);
const rows=[];
while(run(`S.weaponForge.${key}.level`)<target){
  const level=run(`S.weaponForge.${key}.level`),cost=run(`weaponForgeStepCost('${key}')`);
  const before=run('S.items.godCore'),result=run(`forgeWeapon('${key}')`);
  if(!result?.ok){rows.push({level,reason:result?.reason,core:before});break}
  assert.equal(before-run('S.items.godCore'),cost.godCore);
  if(run(`S.weaponForge.${key}.level`)>level)rows.push({level:level+1,core:run('S.items.godCore')});
}
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
const reload=environment({rts_save:JSON.stringify(saved)});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run(`S.weaponForge.${key}.level`),saved.weaponForge[key].level);
fs.writeFileSync(output,JSON.stringify(saved),'utf8');
console.log(JSON.stringify({key,target,start,rows,finish:{second:saved.tick,core:saved.items.godCore,level:saved.weaponForge[key].level,progress:saved.weaponForge[key].progress,attack:run("weaponAttack('electro_trooper')"),defense:run("weaponDefense('electro_trooper')")}},null,2));
