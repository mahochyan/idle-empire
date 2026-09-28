'use strict';
// P72 实付档：按现有市场和农田升级动作恢复粮食效率，再测金属净产。
// node tools/verify/probe-farm-steel-p73.js [--snapshot-final=路径]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const source=path.resolve(__dirname,'../../docs/codex/reports/data/p72-pop126-paid.json');
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:fs.readFileSync(source,'utf8')});
const run=e.run;
const loadStatus=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loadStatus),`P72开发快照应可安全加载，实际状态：${loadStatus}`);
assert.equal(run('S.defeated.length'),45);
assert.equal(run('popCurrent()'),126);
assert.equal(run('armyCount()'),203);
assert.equal(run("bldSt('farm').lv"),1);
const start=run('S.tick');
let elapsed=0,minFood=run('S.res.food');
const costs={wood:0,stone:0,food:0};
const steps=[];
const snap=label=>JSON.parse(JSON.stringify(run(`({label:${JSON.stringify(label)},tick:S.tick,farm:bldSt('farm').lv,
  pop:popCurrent(),army:armyCount(),alloc:{...S.popAlloc},res:{wood:S.res.wood,stone:S.res.stone,food:S.res.food,
  coal:S.res.coal,iron:S.res.iron,steel:S.res.steel},foodRate:prodRate('food'),foodUpkeep:totalUpkeep()+popCurrent()*CFG.popFoodCost,
  steelRate:prodRate('steel')})`)));
steps.push(snap('start'));
function wait(condition,max){
  const r=run(`(()=>{let n=0,m=S.res.food;while(!(${condition})&&n<${max}){tick();n++;m=Math.min(m,S.res.food)}
    return{n,m,ok:!!(${condition})}})()`);
  elapsed+=r.n;minFood=Math.min(minFood,r.m);
  assert.equal(r.ok,true,`等待 ${condition} 超时: ${JSON.stringify(snap('timeout'))}`);
}
function act(expr,label){
  const r=run(expr);
  assert.equal(r?.ok,true,`${label}: ${JSON.stringify(r)}`);
  return r;
}
const trade=act("exchangeResource('wood','stone',100000)",'木换石');
assert.equal(trade.get,60000);
steps.push(snap('wood-stone-trade'));
while(run("bldSt('farm').lv")<5){
  const from=run("bldSt('farm').lv"),to=from+1,cost=run("upCost('farm')");
  for(const rk of Object.keys(costs)){
    const amount=cost[rk]??0;
    assert.ok(run(`resCap('${rk}')`)>=amount,`农田 ${to} 级单笔 ${rk} 超仓`);
  }
  // 升级中农田增益暂失，另外保留6000粮覆盖最长120秒的现行净耗。
  wait(`S.res.wood>=${cost.wood??0}&&S.res.stone>=${cost.stone??0}&&S.res.food>=${cost.food+6000}`,50000);
  const before=run('({...S.res})');
  act("buildAct('farm')",`农田 ${from}→${to}`);
  for(const rk of Object.keys(costs)){
    const amount=cost[rk]??0;
    assert.ok(Math.abs((before[rk]-run(`S.res.${rk}`))-amount)<1e-8,`${rk} 实扣错误`);
    costs[rk]+=amount;
  }
  wait(`bldSt('farm').lv===${to}&&bldSt('farm').state==='idle'`,150);
  steps.push(snap(`farm-${to}`));
}
assert.ok(minFood>0,'升级期间不得断粮');
// 工坊改为母本每级10%后，保留43名粮工以供203人军队与126名居民；其余岗位维持上游正净。
assert.equal(run("S.popAlloc.food"),43,'P72档应保留原43名粮工');
for(const [rk,n] of [['steel',18],['coal',23]])
  if(run(`S.popAlloc['${rk}']`)>n)act(`setPopAlloc('${rk}',${n})`,`减少${rk}岗位`);
for(const [rk,n] of [['stone',30],['iron',12]])
  if(run(`S.popAlloc['${rk}']`)<n)act(`setPopAlloc('${rk}',${n})`,`增加${rk}岗位`);
assert.equal(run('popAllocTotal()'),126);
const balanced=snap('balanced-start');steps.push(balanced);
wait(`S.tick>=${balanced.tick+1000}`,1000);
const sustained=snap('balanced-1000s');steps.push(sustained);
const net=Object.fromEntries(['stone','food','coal','iron','steel'].map(k=>[k,Number(((sustained.res[k]-balanced.res[k])/1000).toFixed(5))]));
for(const rk of Object.keys(net))assert.ok(net[rk]>0,`${rk} 无正净产: ${JSON.stringify(net)}; 岗位=${JSON.stringify(balanced.alloc)}; 粮速=${balanced.foodRate}; 粮耗=${balanced.foodUpkeep}`);
assert.equal(net.steel,36);
assert.equal(run('S.defeated.length'),45);
assert.equal(run('armyCount()'),203);
assert.equal(run('S.res.medal'),800056);
assert.equal(run('S.items.guardianStone'),102);
assert.equal(run('S.items.godCrystal'),41);
assert.equal(run('save().ok'),true,'终点状态未能保存');
const raw=e.store.get('rts_save'),persisted=JSON.parse(raw);
assert.equal(persisted.tick,run('S.tick'));
assert.equal(persisted.res.steel,sustained.res.steel);
const restored=environment({rts_save:raw});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run("bldSt('farm').lv"),5);
assert.equal(restored.run('popCurrent()'),126);
assert.equal(restored.run('armyCount()'),203);
if(finalArg)fs.writeFileSync(path.resolve(finalArg.slice('--snapshot-final='.length)),raw);
console.log(JSON.stringify({unit:'simulated online seconds',source,sourceTick:start,elapsed,
  actions:{market:1,farmUpgrades:4,workerAssignments:5},costs:{marketWood:100000,marketStone:60000,farm:costs},
  minFood,netPerSecond:net,finalSha256:crypto.createHash('sha256').update(raw).digest('hex'),steps},null,2));
