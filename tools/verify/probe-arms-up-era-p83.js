'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const input=path.join(__dirname,'../../docs/codex/reports/data/p82-arms-up-first-invest-paid.json');
const output=path.join(__dirname,'../../docs/codex/reports/data/p83-six-era-arms-first-invest-paid.json');
const raw=fs.readFileSync(input,'utf8'),e=environment({rts_save:raw});
assert.equal(e.run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
const before=JSON.parse(e.run('JSON.stringify({tick:S.tick,res:{...S.res},population:S.population.current,army:armyCount(),electroProgress:S.armsUp.electro_trooper.atk.progress})'));
for(const [key,count]of [['tech',0],['copper',30],['silver',30],['gold',30]])
  assert.equal(e.run(`setPopAlloc('${key}',${count}).ok`),true);
let seconds=0;
while(seconds<1000){
  const enough=e.run('S.res.copper>=1000&&S.res.silver>=1000&&S.res.gold>=1000&&S.res.steel>=2029');
  if(enough)break;
  e.run('tick()');seconds++;
}
assert.equal(seconds,121);
const stockBeforePay=JSON.parse(e.run('JSON.stringify({copper:S.res.copper,iron:S.res.iron,silver:S.res.silver,gold:S.res.gold,steel:S.res.steel})'));
const paid=[
  ['bronze_guard','copper'],['iron_spearman','iron'],['silver_heavy','silver'],
  ['gold_cavalry','gold'],['alloy_special','steel'],['armored_trooper','steel']
];
for(const [uk]of paid){
  assert.equal(e.run(`investArmsUp('${uk}','atk').ok`),true);
  assert.equal(e.run(`S.armsUp.${uk}.atk.progress`),1);
  assert.equal(e.run(`S.armsUp.${uk}.atk.stars`),0);
}
assert.equal(e.run('S.armsUp.electro_trooper.atk.progress'),1);
assert.equal(e.run('S.armsUp.star_trooper.atk.progress'),0);
assert.equal(e.run('armyCount()'),before.army);
assert.equal(e.run('S.population.current'),before.population);
const after=JSON.parse(e.run('JSON.stringify({tick:S.tick,res:{...S.res},population:S.population.current,army:armyCount(),armsUp:S.armsUp})'));
assert.equal(stockBeforePay.copper-after.res.copper,1000);
assert.equal(stockBeforePay.iron-after.res.iron,1000);
assert.equal(stockBeforePay.silver-after.res.silver,1000);
assert.equal(stockBeforePay.gold-after.res.gold,1000);
assert.equal(stockBeforePay.steel-after.res.steel,2000);
const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const [uk]of paid)assert.equal(reload.run(`S.armsUp.${uk}.atk.progress`),1);
assert.equal(reload.run('S.armsUp.electro_trooper.atk.progress'),1);
assert.equal(reload.run('armyCount()'),before.army);
fs.writeFileSync(output,saved);
console.log(JSON.stringify({input:path.basename(input),inputVersion:30,before:{tick:before.tick,population:before.population,army:before.army,electroProgress:before.electroProgress},
  seconds,stockBeforePay,paid:paid.map(([unit,material])=>({unit,material,amount:1000,progress:1})),
  after:{tick:after.tick,population:after.population,army:after.army,stocks:{copper:after.res.copper,iron:after.res.iron,silver:after.res.silver,gold:after.res.gold,steel:after.res.steel},electroProgress:after.armsUp.electro_trooper.atk.progress},
  output:path.basename(output),sha256:crypto.createHash('sha256').update(saved).digest('hex'),reload:'ok'},null,2));
