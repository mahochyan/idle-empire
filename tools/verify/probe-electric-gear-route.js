'use strict';
// 从真实材料档通过现有岗位、研究和逐次锻造，支付蒸汽或电磁装备；不预置资源或胜场。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const saveArg=process.argv.find(x=>x.startsWith('--save='));
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const keyArg=process.argv.find(x=>x.startsWith('--key='));
const key=keyArg?keyArg.slice('--key='.length):'electroRifle';
assert.ok(['gatling','mortar','steamArmor','electroRifle','electroSniper','electroArmor','energyArmor','nanoArmor'].includes(key),
  '--key 须为蒸汽或电磁军备链的有效键');
const levelArg=process.argv.find(x=>x.startsWith('--target-level='));
const targetLevel=levelArg?Number(levelArg.slice('--target-level='.length)):1;
assert.ok(saveArg,'须提供 --save=真实存档路径');
const e=environment({rts_save:fs.readFileSync(saveArg.slice('--save='.length),'utf8')}),run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),'输入存档加载失败');
assert.equal(run("S.sciences.includes('sci_electric_age')"),true);
const cfg=run(`CFG.weaponForge.${key}`);
const combatUnit=cfg.unit;
assert.equal(run(`S.weaponForge.${cfg.needWeapon}.researched`),true,'前置军备未研发');
assert.ok(Number.isSafeInteger(targetLevel)&&targetLevel>=1&&targetLevel<=cfg.maxLevel,'目标等级超出军备上限');
const oldState=run(`({...S.weaponForge.${key}})`);
assert.ok(oldState.level<targetLevel,'现有装备已达到目标等级');
const start=run('({second:S.tick,tech:S.res.tech,steel:S.res.steel,medal:S.res.medal,godCore:S.items.godCore,kill:S.killValues.godSlaughter})');
const researchCost=oldState.researched?{tech:0,medal:0}:cfg.researchCost;
assert.ok(start.medal>=researchCost.medal,'勋章不足以支付研究');
let requiredSteps=0,requiredCore=0;
for(let level=oldState.level;level<targetLevel;level++){
  const steps=run(`weaponForgeSteps('${key}',${level})`)-(level===oldState.level?oldState.progress:0);
  const stepCost=run(`weaponForgeStepCost('${key}',${level})`);
  requiredSteps+=steps;
  requiredCore+=steps*(stepCost.godCore||0);
}
assert.ok(start.godCore>=requiredCore,'神族之核不足以升至目标等级');
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退 ${key} 失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配 ${key} 失败`);
}
function waitFor(condition,max=500000){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,reached:!!(${condition})}})()`);
  assert.equal(result.reached,true,`${condition} 在${max}在线秒内未达`);
  return result.n;
}
let techSeconds=0;
if(!oldState.researched){
  assign({food:45,tech:57});
  techSeconds=waitFor(`S.res.tech>=${researchCost.tech}`);
  assert.equal(run(`researchWeapon('${key}').ok`),true);
}
if(cfg.stepCost.steel)assign({food:10,stone:33,coal:26,iron:20,steel:12});
let steelSeconds=0;
for(let i=0;i<requiredSteps;i++){
  const stepCost=run(`weaponForgeStepCost('${key}')`);
  if(stepCost.steel)steelSeconds+=waitFor(`S.res.steel>=${stepCost.steel}`);
  assert.equal(run(`forgeWeapon('${key}').ok`),true,`第${i+1}次制造失败`);
}
assert.equal(run(`setWeaponEquipped('${key}',true).ok`),true);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
assert.equal(saved.weaponForge[key].level,targetLevel);
assert.equal(saved.weaponForge[key].equipped,true);
assert.equal(saved.items.godCore,start.godCore-requiredCore);
assert.equal(saved.res.medal,start.medal-researchCost.medal);
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run(`weaponAttack('${combatUnit}')`),run(`weaponAttack('${combatUnit}')`));
assert.equal(restored.run(`weaponDefense('${combatUnit}')`),run(`weaponDefense('${combatUnit}')`));
if(finalArg)fs.writeFileSync(finalArg.slice('--snapshot-final='.length),JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'online seconds; resource units; attack/defense',key,targetLevel,requiredSteps,requiredCore,start,techSeconds,steelSeconds,
  finish:{second:saved.tick,tech:saved.res.tech,steel:saved.res.steel,medal:saved.res.medal,godCore:saved.items.godCore,kill:saved.killValues.godSlaughter,gear:saved.weaponForge[key],attack:run(`weaponAttack('${combatUnit}')`),defense:run(`weaponDefense('${combatUnit}')`)}},null,2));
