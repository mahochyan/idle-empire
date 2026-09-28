'use strict';
// 由四项电力科技首级的真实存档继续，验证守御／幻影两场新材料挑战。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-electric-technology-first.js'),'utf8');
const {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs}=new Function('require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs};')(
  require,{log(){},error:console.error},__dirname);
assert.equal(run('S.defeated.length'),0);
const before=run('({second:S.tick,formation:S.formation,pool:S.pool,stone:S.items.guardianStone,flower:S.items.phantomFlower})');
console.error('material probe start '+JSON.stringify(before));
const outcomes=[];
for(const key of ['guardianStone','phantomFlower']){
  const stock=run(`S.items.${key}`);
  run(`openMaterialDomain('${key}')`);
  assert.equal(run('S.battleActive'),true,`${key} 未开战`);
  for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'战斗回调丢失');
  assert.equal(run('S.battleActive'),false,'战斗未结束');
  const stockAfter=run(`S.items.${key}`),killValue=run(`S.killValues.${key==='guardianStone'?'godGuardian':'godPhantom'}`);
  assert.equal(stockAfter,stock+2,`${key} 首胜未按真实结算给2件材料`);
  assert.equal(killValue,100,`${key} 独立警戒值未增加100`);
  outcomes.push({key,second:run('S.tick'),stockBefore:stock,stockAfter,killValue,formation:run('S.formation')});
  run('exitBattle()');
}
assert.equal(run('S.defeated.length'),0,'材料挑战不得增加普通关卡胜场');
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.items.guardianStone,2);
assert.equal(saved.items.phantomFlower,2);
console.log(JSON.stringify({unit:'online seconds',before,outcomes,stageWins:run('S.defeated.length'),version:saved.v},null,2));
