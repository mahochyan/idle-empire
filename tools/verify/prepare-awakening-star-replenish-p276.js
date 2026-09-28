'use strict';
// From the actual P275 first-awakening checkpoint, return the star soldier to
// reserve and restore the original archer slot through the real formation actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const raw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p275-awakening-source-paid-save.json'),'utf8');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}}}`);
assert.equal(run("S.formation.back[3].type"),'star_trooper');
assert.equal(run("S.pool.archer"),55);
run("rmForm('expedition','back',3);formModalTarget={which:'expedition',row:'back',idx:3};S._formModalSel='archer';S._formModalQty=55;confirmForm()");
assert.equal(run("S.pool.star_trooper"),1);
assert.equal(run("S.formation.back[3].count"),55);
assert.equal(run('save().ok'),true);
const save=e.store.get('rts_save');
const file='docs/codex/reports/data/p276-awakening-star-prepared-save.json';
fs.writeFileSync(path.join(root,file),save,'utf8');
const reload=environment({rts_save:save});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("S.pool.star_trooper"),1);
console.log(JSON.stringify({file,army:run('armyCount()'),deployed:run('formSoldierCount()'),starReserve:run('S.pool.star_trooper')}));
