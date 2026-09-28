'use strict';
// 从电力时代首名电磁兵的真实动作状态继续；逐笔获取并支付四项电力科技首级费用。
// 单位：在线秒。前序固定战斗随机数0.5；本段不注入库存、等级、人口或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-electric-era.js'),'utf8');
const {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs}=new Function('require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs};')(
  require,{log(){},error:console.error},__dirname);
assert.equal(run("S.sciences.includes('sci_electric_age')"),true);
assert.equal(run('S.pool.electro_trooper'),1);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.eraStorage.electricKnowledge'),0);
const start=run('S.tick'),milestones=[];
assign(jobs.tech);
for(const key of ['electricProduction','electricKnowledge','electricBasic','electricMetal']){
  const cost=run(`eraStorageCost('${key}')`);
  assert.ok(run("resCap('tech')")>=cost.tech,`${key} 首笔知识容量不足`);
  const before=run('S.res.tech');
  waitFor(`S.res.tech>=${cost.tech}`,500000);
  const stock=run('S.res.tech'),capacityBefore=run("resCap('tech')"),rateBefore=run("prodRate('tech')");
  action(`upgradeEraStorage('${key}')`,'research',`${key} 首级`);
  const rateAfter=run("prodRate('tech')"),capacityAfter=run("resCap('tech')");
  assert.equal(run(`S.eraStorage.${key}`),1);
  assert.equal(run('S.res.tech'),stock-cost.tech);
  if(key==='electricProduction')assert.ok(Math.abs(rateAfter/rateBefore-1.1)<1e-9);
  if(key==='electricKnowledge')assert.equal(capacityAfter,Math.floor(capacityBefore*1.1));
  milestones.push({key,second:run('S.tick'),onlineHours:Math.round(run('S.tick')/360)/10,cost:cost.tech,
    capBefore:capacityBefore,capAfter:capacityAfter,rateBefore,rateAfter,stockBeforePayment:stock,stockAtStart:before});
}
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.population.current,102);
assert.equal(saved.defeated.length,0);
assert.equal(saved.items.godCrystal,2);
assert.equal(saved.items.guardianStone,0);
assert.equal(saved.items.phantomFlower,0);
for(const key of ['electricBasic','electricMetal','electricKnowledge','electricProduction'])assert.equal(saved.eraStorage[key],1);
for(const [key,value] of Object.entries(run('({...S.res})')))assert.ok(Number.isFinite(value)&&value>=0,key);
console.log(JSON.stringify({unit:'online seconds',start,finish:run('S.tick'),extraSeconds:run('S.tick')-start,
  population:saved.population.current,stageWins:saved.defeated.length,saveVersion:saved.v,milestones},null,2));
