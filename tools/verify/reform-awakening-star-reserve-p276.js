'use strict';
// Re-form the paid 101-star roster without creating soldiers. Restore the
// original four frontline groups and keep star squads in the middle reserve.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const raw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p276-awakening-star-paid-save.json'),'utf8');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}}}`);
const army=run('armyCount()');
run("clrForm('expedition')");
const formation={
  front:[['electro_trooper',55],['electro_trooper',46],['alloy_special',55],['armored_trooper',55]],
  mid:[['gold_cavalry',40],['star_trooper',55],['star_trooper',46],['bronze_guard',15]],
  back:[['archer',55],['archer',55],['archer',55],['archer',55]]
};
for(const [row,groups] of Object.entries(formation))groups.forEach(([unit,count],slot)=>{
  assert.ok(run(`poolAvail('${unit}')`)>=count,`reserve ${unit} ${count}`);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${unit}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}]?.count`),count,`${row} ${slot}`);
});
assert.equal(run('armyCount()'),army);
assert.equal(run("expeditionCount('star_trooper')"),101);
assert.equal(run('save().ok'),true);
const save=e.store.get('rts_save');
const file='docs/codex/reports/data/p276-awakening-star-midreserve-save.json';
fs.writeFileSync(path.join(root,file),save,'utf8');
const reload=environment({rts_save:save});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),army);
console.log(JSON.stringify({file,army,deployed:run('formSoldierCount()'),stars:run("expeditionCount('star_trooper')")}));
