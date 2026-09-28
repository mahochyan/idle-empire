'use strict';
// 从真实新档电力首兵继续：使用机巧遗迹实战所得勋章，逐级支付科研精通20级。
// 时间单位为在线tick秒；不注入资源、人口、科技、兵力或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
for(const flag of ['--steel-mastery-early','--steel-mastery-20','--steel-mastery-hunt-10','--iron-store=300'])
  assert.ok(process.argv.includes(flag),`须带${flag}保持同一新档对照路线`);
const prior=fs.readFileSync(path.join(__dirname,'probe-electric-era.js'),'utf8');
const {run,assign,waitFor,action,jobs}=new Function('require','console','__dirname',
  prior+'\nreturn {run,assign,waitFor,action,jobs};')(
  require,{log(){},error(){}},__dirname);
assert.equal(run('S.population.current'),102);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.pool.electro_trooper'),1);
assert.equal(run('S.steelMasteryLv'),20);
assert.equal(run('S.scholarMasteryLv'),0);
assert.equal(run('S.killValues.godRevival'),1100);
assert.equal(run('S.res.medal'),2724);
assert.equal(run("scienceUnlocked('sci_workshop')"),true);
assert.equal(run("resCap('silverCoin')"),10000);
assert.equal(run('S.daily.counts.market||0'),0);
const start=run('S.tick');
assign(jobs.tech);
const rateBefore=run("prodRate('tech')"),capBefore=run("resCap('tech')");
const payments=[];
for(let level=1;level<=5;level++){
  const cost=run('scholarMasteryCost()');
  assert.equal(cost.tech,500*level);
  assert.equal(cost.medal,undefined);
  waitFor(`S.res.tech>=${cost.tech}`,50000);
  const before=run('({tech:S.res.tech,medal:S.res.medal})');
  action('upgradeScholarMastery()','research',`科研精通 Lv${level}`);
  assert.equal(run('S.scholarMasteryLv'),level);
  assert.equal(run('S.res.tech'),before.tech-cost.tech);
  assert.equal(run('S.res.medal'),before.medal);
  payments.push({level,second:run('S.tick'),cost});
}
const rateAtFive=run("prodRate('tech')");
assert.equal(run('S.res.medal'),2724);
assert.equal(run('S.daily.counts.market||0'),0);
for(let level=6;level<=20;level++){
  const cost=run('scholarMasteryCost()');
  assert.equal(cost.tech,500*level);
  assert.equal(cost.medal,10*level);
  assert.ok(run("resCap('tech')")>=cost.tech);
  waitFor(`S.res.tech>=${cost.tech}`,50000);
  const before=run('({tech:S.res.tech,medal:S.res.medal})');
  action('upgradeScholarMastery()','research',`科研精通 Lv${level}`);
  assert.equal(run('S.scholarMasteryLv'),level);
  assert.equal(run('S.res.tech'),before.tech-cost.tech);
  assert.equal(run('S.res.medal'),before.medal-cost.medal);
  payments.push({level,second:run('S.tick'),cost});
}
assert.equal(run('S.res.medal'),774);
const rateAfter=run("prodRate('tech')");
assert.ok(Math.abs(rateAfter/rateBefore-2)<1e-9,'学者产率未按20级翻倍');
assert.equal(run("resCap('tech')"),capBefore,'科研精通不应增加知识容量');
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.scholarMasteryLv,20);
assert.equal(saved.steelMasteryLv,20);
assert.equal(saved.res.medal,774);
assert.equal(saved.daily.counts.market||0,0);
assert.equal(saved.population.current,102);
assert.equal(saved.defeated.length,0);
const {environment}=require('../../tests/progression/harness');
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.scholarMasteryLv'),20);
assert.equal(restored.run('S.res.medal'),774);
assert.equal(restored.run('S.daily.counts.market||0'),0);
console.log(JSON.stringify({unit:'online seconds',start,finish:run('S.tick'),elapsed:run('S.tick')-start,
  population:saved.population.current,stageWins:saved.defeated.length,saveVersion:saved.v,
  techCap:capBefore,rateBefore,rateAtFive,rateAfter,payments,
  remainingMedal:saved.res.medal,remainingSilverCoin:saved.res.silverCoin},null,2));
