'use strict';
// 从真实新档合金路线续跑：逐笔生产知识并支付冶钢精通前五级，无资源／研究／兵力注入。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-next-era.js'),'utf8');
const {run,assign,action,waitFor}=new Function('require','console','__dirname',prior+'\nreturn {run,assign,action,waitFor};')(
  require,{log(){},error:console.error},__dirname);
assert.equal(run("S.sciences.includes('sci_steel')"),true);
assert.equal(run('S.steelMasteryLv'),0);
assert.equal(run('S.defeated.length'),0);
const start=run('S.tick'),startingTech=run('S.res.tech'),startingMedal=run('S.res.medal');
assign({food:5,tech:21});
const payments=[];
for(let level=1;level<=5;level++){
  const cost=run('steelMasteryCost()');
  assert.equal(cost.tech,1500*level);
  assert.equal(cost.medal,undefined);
  waitFor(`S.res.tech>=${cost.tech}`,20000);
  const before=run('S.res.tech');
  action('upgradeSteelMastery()','research',`冶钢精通 Lv${level}`);
  assert.equal(run('S.res.tech'),before-cost.tech);
  assert.equal(run('S.steelMasteryLv'),level);
  payments.push({level,second:run('S.tick'),tech:cost.tech});
}
assert.equal(run('S.res.medal'),startingMedal);
assert.equal(run('steelMasteryCost().medal'),180);
assign({food:5,tech:20,steel:1});
const actualRate=run("prodRate('steel')"),oldLevel=run('S.steelMasteryLv');
run('S.steelMasteryLv=0');
const withoutMastery=run("prodRate('steel')");
run(`S.steelMasteryLv=${oldLevel}`);
assert.ok(Math.abs(actualRate-withoutMastery*1.25)<1e-9);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.steelMasteryLv,5);
assert.equal(saved.defeated.length,0);
assert.equal(saved.res.medal,startingMedal);
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.steelMasteryLv'),5);
console.log(JSON.stringify({unit:'online seconds',start,finish:run('S.tick'),elapsed:run('S.tick')-start,
  startingTech,startingMedal,steelRateBefore:withoutMastery,steelRateAfter:actualRate,payments,
  population:saved.population.current,stageWins:saved.defeated.length,saveVersion:saved.v},null,2));
