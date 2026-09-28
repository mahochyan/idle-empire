'use strict';
// 从真实新档取得62枚遗迹晶核的路线接续，逐级实付蒸汽科研技术1～6级。
// 所有时间是在线秒；仅通过玩家动作研究、建造、换契和重新分配岗位，不注入状态。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-god-domain-60.js'),'utf8');
const {run,assign,waitFor,action}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action};'
)(require,{log(){}},__dirname);
assert.equal(run('S.items.godCrystal'),62);
assert.equal(run('S.eraStorage.steamKnowledge'),0);
assert.equal(run('S.defeated.length'),0);
run('exitBattle()');

const steps=[];
const count={settlement:0,building:0,mastery:0,knowledge:0,market:0};
function mark(label){
  steps.push({label,second:run('S.tick'),population:run('S.population.current'),techCap:run("resCap('tech')"),
    mastery:run('S.storageMasteryLv'),knowledge:run('S.eraStorage.steamKnowledge'),
    crystal:run('S.items.godCrystal'),library:run("bldSt('library').lv"),institute:run("bldSt('institute').lv")});
  if(process.env.PROBE_PROGRESS)console.error(JSON.stringify(steps.at(-1)));
}
function wait(condition,max=200000){return waitFor(condition,max)}
const jobs={
  // 战斗单兵生命接入后驻留军力更大，先留出足够粮工维持连续施工。
  basic:{wood:24,stone:24,food:30,tech:24},
  tech:{food:30,tech:72},
  gold:{food:30,stone:25,coal:23,gold:24},
  steel:{food:30,stone:27,coal:20,iron:17,steel:8}
};
function upgradeBuilding(key,workerJobs){
  const level=run(`bldSt('${key}').lv`),cost=run(`upCost('${key}')`);
  for(const [rk,amount] of Object.entries(cost))if(rk!=='time'&&amount>0)
    assert.ok(run(`resCap('${rk}')`)>=amount,`${key} Lv${level+1} ${rk} ${amount} 超过容量 ${run(`resCap('${rk}')`)}`);
  assign(workerJobs);
  wait(Object.entries(cost).filter(([rk,n])=>rk!=='time'&&n>0).map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&'));
  action(`buildAct('${key}')`,'build',`${key} Lv${level+1}`);count.building++;
  wait(`bldSt('${key}').lv===${level+1}&&bldSt('${key}').state==='idle'`,180);
}
function ensureBasicCapacity(cost){
  while(run("resCap('wood')")<(cost.wood||0)||run("resCap('stone')")<(cost.stone||0))
    upgradeBuilding('stone_store',jobs.basic);
  while(run("resCap('food')")<(cost.food||0)){
    const granaryCost=run("upCost('large_granary')");
    while(run("resCap('wood')")<(granaryCost.wood||0)||run("resCap('stone')")<(granaryCost.stone||0))
      upgradeBuilding('stone_store',jobs.basic);
    upgradeBuilding('large_granary',jobs.basic);
  }
}

// 无首通奖励和注入人口；银两由合法岗位生产，再换城市地契。
while(run('maxPop()')<102){
  const deedCost=run("settlementCost('city')");
  while(run('S.res.deed')<deedCost){
    const missing=deedCost-run('S.res.deed');
    const chunk=Math.min(missing,Math.floor(run("resCap('silverCoin')")/200));
    assert.ok(chunk>0,'银两容量不足以买一张地契');
    const n=Math.floor((run('S.population.current')-8)/4);
    assert.ok(n>0,'扩城银两岗位不足');
    assign({food:8,stone:n,coal:n,silver:n,silverCoin:n});
    wait(`S.res.silverCoin>=${chunk*200}`);
    action(`exchangeResource('silverCoin','deed',${chunk*200})`,'market','银两换城市地契');count.market++;
  }
  action("upgradeSettlement('city',S.settlements.city)",'settlement','扩建城市');count.settlement++;
  // 单兵生命提高后，机巧遗迹战损更少，现役军粮开销随之增加；扩城等待阶段转全员产粮。
  assign({food:run('S.population.current')});
  wait('popCurrent()===maxPop()',100);
}
assert.equal(run('S.population.current'),102);
mark('102 population');

// 储存精通先提供所有非货币物资的容量倍率，费用由金工与钢工逐笔产出。
while(run('S.storageMasteryLv')<40){
  const level=run('S.storageMasteryLv')+1,cost=run('storageMasteryCost()');
  while(run("resCap('gold')")<(cost.gold||0))upgradeBuilding('gold_store',jobs.gold);
  while(run("resCap('steel')")<(cost.steel||0))upgradeBuilding('steel_store',jobs.steel);
  assign(jobs.tech);wait(`S.res.tech>=${cost.tech}`);
  if(cost.gold){assign(jobs.gold);wait(`S.res.gold>=${cost.gold}`)}
  if(cost.steel){assign(jobs.steel);wait(`S.res.steel>=${cost.steel}`)}
  action('upgradeStorageMastery()','research',`储存精通 Lv${level}`);count.mastery++;
  if(level===10||level===20||level===30||level===40)mark(`mastery ${level}`);
}

// 学院提产；图书馆/研究院按下一格“每点仓容的建材费”选择。
while(run("bldSt('academy').lv")<50){
  ensureBasicCapacity(run("upCost('academy')"));
  upgradeBuilding('academy',jobs.basic);
}
mark('academy 50');
function increaseKnowledgeCapacity(target){
  let upgrades=0;
  while(run("resCap('tech')")<target){
    const candidates=['library','institute'].filter(key=>run(`bldSt('${key}').lv`)<run('CFG.ownMax.warehouse'));
    assert.ok(candidates.length,'知识仓建筑均已达到上限');
    candidates.sort((a,b)=>run(`upCost('${a}').wood`)/run(`CFG.buildings.${a}.storagePerLv`)
      -run(`upCost('${b}').wood`)/run(`CFG.buildings.${b}.storagePerLv`));
    const key=candidates[0],cost=run(`upCost('${key}')`);
    ensureBasicCapacity(cost);
    upgradeBuilding(key,jobs.basic);
    assert.ok(++upgrades<=2000,'扩知识仓超过2000次建设');
  }
  return upgrades;
}
for(let targetLevel=1;targetLevel<=6;targetLevel++){
  const cost=run("eraStorageCost('steamKnowledge')");
  assert.equal(cost.tech,300000*targetLevel);
  increaseKnowledgeCapacity(cost.tech);
  mark(`capacity for knowledge ${targetLevel}`);
  assign(jobs.tech);wait(`S.res.tech>=${cost.tech}`);
  const before=run('({tech:S.res.tech,crystal:S.items.godCrystal})');
  action("upgradeEraStorage('steamKnowledge')",'research',`蒸汽科研技术 Lv${targetLevel}`);count.knowledge++;
  assert.equal(run('S.res.tech'),before.tech-cost.tech);
  assert.equal(run('S.items.godCrystal'),before.crystal-(cost.godCrystal||0));
  assert.equal(run('S.eraStorage.steamKnowledge'),targetLevel);
  mark(`knowledge ${targetLevel} paid`);
}
assert.equal(run('S.items.godCrystal'),2);
assert.equal(run('S.defeated.length'),0);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.eraStorage.steamKnowledge,6);
assert.equal(saved.storageMasteryLv,40);
assert.equal(saved.items.godCrystal,2);
assert.equal(saved.population.current,102);
assert.equal(saved.defeated.length,0);
for(const [key,value] of Object.entries(run('({...S.res})')))
  assert.ok(Number.isFinite(value)&&value>=0,`${key} 最终资源非法：${value}`);
console.log(JSON.stringify({unit:'online seconds',second:run('S.tick'),population:run('S.population.current'),stageWins:run('S.defeated.length'),
  knowledgeLevel:run('S.eraStorage.steamKnowledge'),crystal:run('S.items.godCrystal'),
  masteryLevel:run('S.storageMasteryLv'),techCapacity:run("resCap('tech')"),
  buildings:run("({academy:bldSt('academy').lv,library:bldSt('library').lv,institute:bldSt('institute').lv,stoneStore:bldSt('stone_store').lv,granary:bldSt('large_granary').lv,goldStore:bldSt('gold_store').lv,steelStore:bldSt('steel_store').lv})"),
  actions:count,milestones:steps},null,2));
