'use strict';
// 独立复跑真实新档的郊野取骨→勋章→冶钢精通13级，可指定额外兽骨目标并比较固定猎队人数。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
assert.ok(process.argv.includes('--steel-mastery-early'),'须带--steel-mastery-early先从新档购买前5级');
assert.ok(!process.argv.includes('--steel-mastery-hunt-13'),'本探针自行执行郊野路线，不要重复指定--steel-mastery-hunt-13');
assert.ok(!process.argv.includes('--steel-mastery-20'),'本探针自行执行郊野路线，不要重复指定--steel-mastery-20');
assert.ok(!process.argv.includes('--steel-mastery-hunt-10'),'本探针自行读取--fighters，不要重复指定--steel-mastery-hunt-10');
const fighterArg=process.argv.find(arg=>arg.startsWith('--fighters='));
const fighters=fighterArg?Number(fighterArg.slice('--fighters='.length)):8;
const randomArg=process.argv.find(arg=>arg.startsWith('--random='));
const random=randomArg?Number(randomArg.slice('--random='.length)):0.5;
const seedArg=process.argv.find(arg=>arg.startsWith('--seed='));
assert.ok(!seedArg||!randomArg,'随机种子与固定随机值只能二选一');
const seed=seedArg?Number(seedArg.slice('--seed='.length)):null;
const boneTargetArg=process.argv.find(arg=>arg.startsWith('--bone-target='));
const boneTarget=boneTargetArg?Number(boneTargetArg.slice('--bone-target='.length)):1140;
const previous=fs.readFileSync(path.join(__dirname,'probe-next-era.js'),'utf8');
const {run,assign,waitFor,build,action,actions,extraActions}=new Function('require','console','__dirname',
  previous+'\nreturn {run,assign,waitFor,build,action,actions,extraActions};')(
  require,{log(){},error:console.error},__dirname);
const hunt=require('./steel-mastery-hunt-step.js')({run,assign,waitFor,build,action,extraActions},random,fighters,boneTarget,seed);
assert.equal(run('S.steelMasteryLv'),13);
assert.equal(run('S.res.medal'),0);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.formation.front.length'),0);
assert.equal(run('S.pool.alloy_special'),fighters);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
const {environment}=require('../../tests/progression/harness');
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.steelMasteryLv'),13);
assert.equal(restored.run('S.pool.alloy_special'),fighters);
assert.equal(restored.run('S.killValues.wildBoar'),hunt.wildWins*10);
assert.equal(restored.run('S.res.bone'),hunt.remainingBone);
console.log(JSON.stringify({...hunt,stageWins:run('S.defeated.length'),
  marketDailyCount:run('S.daily.counts.market||0'),actions:{...actions,...extraActions,wildBattles:hunt.wildWins,
    boneTradeUnits:114,boneExchangeActions:1}},null,2));
