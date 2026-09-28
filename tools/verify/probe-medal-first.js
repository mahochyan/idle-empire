'use strict';
// 接续零普通关卡胜利、102人口、电力生产与科研第6级的真实路线；保留机巧遗迹既得勋章，只用实际补兵和战斗取得额外勋章。
// 在线时间单位为秒，战斗随机数沿前序固定为0.5；不注入资源、兵力、奖励或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-electric-sixth-level.js'),'utf8');
const {run,replenish}=new Function('require','console','__dirname',prior+'\nreturn {run,replenish};')(
  require,{log(){},error(){}},__dirname);
assert.equal(run('S.population.current'),102);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.sciences.includes("sci_electric_age")'),true);
assert.ok(run('S.res.medal')>0,'机巧遗迹双奖励未传递到电力后路线');
const begin=run('S.tick'),battles=[];
for(let attempt=0;attempt<2;attempt++){
  replenish();
  const before=run('({second:S.tick,medal:S.res.medal,kill:S.killValues.godSlaughter,merit:S.merit,formation:S.formation})');
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true,'杀戮之神未开战');
  for(let step=0;step<500&&run('S.battleActive');step++)assert.equal(run('__step()'),true,'战斗回调丢失');
  assert.equal(run('S.battleActive'),false,'战斗未结束');
  const after=run('({second:S.tick,medal:S.res.medal,kill:S.killValues.godSlaughter,merit:S.merit,formation:S.formation})');
  const row={attempt:attempt+1,before,after};battles.push(row);
  console.error('medal battle '+JSON.stringify(row));
  assert.ok(after.medal>before.medal,'实战未取得勋章');
  assert.equal(after.kill,before.kill+100);
  assert.equal(after.merit,before.merit);
  run('exitBattle()');
}
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.res.medal,run('S.res.medal'));
assert.equal(saved.killValues.godSlaughter,200);
assert.equal(saved.defeated.length,0);
console.log(JSON.stringify({unit:'online seconds',begin,finish:run('S.tick'),elapsed:run('S.tick')-begin,
  medal:saved.res.medal,kill:saved.killValues.godSlaughter,population:saved.population.current,stageWins:saved.defeated.length,battles},null,2));
