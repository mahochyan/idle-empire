'use strict';

// Player-facing post-alloy terminology may change without renaming save/config IDs or costs.
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const e=environment();

for(const [key,name] of Object.entries({
  medal:'战备勋章',
}))assert.equal(e.run(`CFG.res.${key}.name`),name);

for(const [key,name] of Object.entries({
  guardianStone:'防护模块',phantomFlower:'相位晶簇',godCore:'高能核心'
}))assert.equal(e.run(`CFG.eraMaterials.${key}.name`),name);

for(const [key,name] of Object.entries({
  guardianStone:'重装防卫机',phantomFlower:'光学拟态机',medal:'战术演算机'
}))assert.equal(e.run(`CFG.godDomains.${key}.name`),name);

for(const [key,name,passive] of [
  ['phantom_god','光学拟态机','光学迷彩'],
  ['guardian_god','重装防卫机','重装护盾'],
  ['slaughter_god','战术演算机','战术压制']
]){
  assert.equal(e.run(`CFG.units.${key}.name`),name);
  assert.equal(e.run(`CFG.units.${key}.race`),'高阶机体');
  assert.equal(e.run(`CFG.units.${key}.passive`),passive);
  assert.equal(e.run(`CFG.units.${key}.enemyOnly`),true);
}

for(const table of ['sciences','sciencesLong']){
  const gate=JSON.parse(e.run(`JSON.stringify(CFG.${table}.sci_nuclear_age)`));
  assert.ok(gate.desc.includes('星际先遣兵')&&gate.desc.includes('战备勋章'));
  assert.deepEqual(gate.cost,{tech:100000000,medal:800000,merit:0});
  assert.deepEqual(gate.need,['sci_electric_age']);
}

assert.equal(e.run("CFG.units.star_trooper.name"),'星际先遣兵');
assert.equal(e.run("CFG.units.star_trooper.cost.copper"),8000);
assert.equal(e.run("CFG.units.star_trooper.cost.iron"),8000);
assert.equal(e.run("CFG.units.star_trooper.cost.steel"),8000);
assert.equal(e.run("CFG.eraMaterials.godCore.name"),'高能核心');
assert.equal(e.run("CFG.eraStorage.electricBasic.lateMaterial"),'guardianStone');
assert.equal(e.run("CFG.eraStorage.electricProduction.lateMaterial"),'phantomFlower');
assert.equal(e.run("CFG.weaponForge.electroRifle.stepCost.godCore"),4);
assert.equal(e.run("CFG.weaponForge.energyArmor.stepCost.godCore"),4);

console.log('industrial theme names: all assertions passed');
