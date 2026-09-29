'use strict';
// Reconstruct P167's paid, zero-mainline-win preparation before its historical comparison arms.
// This probe uses real battle callbacks and saves, then checks only the new military reward.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {environment}=require('../../tests/progression/harness');

const p166Path=path.join(__dirname,'probe-current-first-clear-population-p166.js');
const source=fs.readFileSync(p166Path,'utf8');
const marker='const prepared=capturePreparation();';
const index=source.indexOf(marker);
assert.ok(index>=0&&source.indexOf(marker,index+marker.length)<0,'P166 preparation seam changed');
const isolated=source.slice(0,index)+'return {capturePreparation,installBattleHarness,formArmy};\n'+source.slice(index);
const helper=new Function('require','console','__dirname',isolated)(
  createRequire(p166Path),{log(){},error:console.error},path.dirname(p166Path));
const NativeDate=global.Date,fixed=1790400000000;
global.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[fixed]))}
  static now(){return fixed}
};
let prepared;
try{prepared=helper.capturePreparation()}
finally{global.Date=NativeDate}

const world=environment({rts_save:prepared.battleSave}),run=world.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),0);
helper.installBattleHarness(run);
helper.formArmy(run);
const before={merit:run('S.merit'),wins:run('S.development.border.sites.copper.wins'),
  coin:run('S.res.coin'),deed:run('S.res.deed'),soldiers:run('formSoldierCount()')};
run("openDevelopmentBorder('copper')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__p166Step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
assert.equal(run('S.development.border.sites.copper.wins'),before.wins+1);
assert.equal(run('S.merit'),before.merit+2);
assert.equal(run('S.res.coin'),before.coin+400);
assert.equal(run('S.defeated.length'),0);
const saved=world.store.get('rts_save'),payload=JSON.parse(saved);
assert.equal(payload.merit,before.merit+2);
assert.equal(payload.development.border.sites.copper.wins,before.wins+1);
assert.deepEqual(payload.defeated,[]);
const loaded=environment({rts_save:saved});
assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
assert.equal(loaded.run('S.merit'),before.merit+2);
assert.equal(loaded.run('S.defeated.length'),0);
console.log(JSON.stringify({batch:'P398',before,after:{merit:run('S.merit'),
  wins:run('S.development.border.sites.copper.wins'),coin:run('S.res.coin'),
  deed:run('S.res.deed'),soldiers:run('formSoldierCount()'),defeated:run('S.defeated.length')},
  callbacks,saveVersion:payload.v,saveReload:'ok'}));
