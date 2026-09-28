'use strict';
// 接续真实新档蒸汽科研技术六级路线，逐笔攒够电力时代研究与首名电磁兵。
// 时间为在线秒；研究、仓储、建筑、岗位、招募均调用游戏动作，不注入资源或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-steam-knowledge-six.js'),'utf8');
const {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs};'
)(require,{log(){},error:console.error},__dirname);
assert.equal(run('S.eraStorage.steamKnowledge'),6);
assert.equal(run('S.items.godCrystal'),2);
assert.equal(run('S.defeated.length'),0);
const milestones=[];
const actions={mastery:0,build:0,storage:0,research:0,train:0};
function point(label){
  const data={label,second:run('S.tick'),mastery:run('S.storageMasteryLv'),steelMastery:run('S.steelMasteryLv'),knowledge:run('S.eraStorage.steamKnowledge'),
    metal:run('S.eraStorage.steamMetal'),techCap:run("resCap('tech')"),steelCap:run("resCap('steel')"),
    steelStore:run("bldSt('steel_store').lv"),crystal:run('S.items.godCrystal')};
  milestones.push(data);
  if(process.env.PROBE_PROGRESS)console.error(JSON.stringify(data));
}
function wait(condition,max=200000){return waitFor(condition,max)}
function upgradeRefinery(){
  const level=run("bldSt('steel_refinery').lv"),cost=run("upCost('steel_refinery')");
  ensureBasicCapacity(cost);
  assign(jobs.basic);
  wait(`S.res.wood>=${cost.wood}&&S.res.food>=${cost.food}`);
  upgradeBuilding('steel_refinery',jobs.gold);actions.build++;
  assert.equal(run("bldSt('steel_refinery').lv"),level+1);
}
// 提高冶钢工产率，后续金钢付款和大量钢仓升级仍由同一生产链承担。
while(run("bldSt('steel_refinery').lv")<30)upgradeRefinery();
point('steel refinery 30');
while(run('S.storageMasteryLv')<100){
  const level=run('S.storageMasteryLv')+1,cost=run('storageMasteryCost()');
  while(run("resCap('gold')")<cost.gold){upgradeBuilding('gold_store',jobs.gold);actions.build++}
  while(run("resCap('steel')")<cost.steel){upgradeBuilding('steel_store',jobs.steel);actions.build++}
  assign(jobs.tech);wait(`S.res.tech>=${cost.tech}`);
  assign(jobs.gold);wait(`S.res.gold>=${cost.gold}`);
  assign(jobs.steel);wait(`S.res.steel>=${cost.steel}`);
  action('upgradeStorageMastery()','research',`储存精通 Lv${level}`);actions.mastery++;
  if(level%10===0)point(`mastery ${level}`);
}
assert.ok(run("resCap('tech')")>=2500000,'电力前蒸汽金属仓第5级知识费仍超仓');
for(let level=1;level<=5;level++){
  const cost=run("eraStorageCost('steamMetal')");
  assert.equal(cost.tech,500000*level);
  assert.equal(cost.godCrystal,undefined);
  assign(jobs.tech);wait(`S.res.tech>=${cost.tech}`);
  action("upgradeEraStorage('steamMetal')",'research',`蒸汽金属仓库 Lv${level}`);actions.storage++;
}
point('steam metal 5');
increaseKnowledgeCapacity(5000000);
assert.ok(run("resCap('tech')")>=5000000);
point('tech capacity 5m');
while(run("bldSt('smelter').lv")<30){
  ensureBasicCapacity(run("upCost('smelter')"));
  upgradeBuilding('smelter',jobs.basic);actions.build++;
}
point('smelter 30');
const ironStoreArg=process.argv.find(arg=>arg.startsWith('--iron-store='));
if(ironStoreArg){
  const target=Number(ironStoreArg.slice('--iron-store='.length));
  assert.ok(Number.isSafeInteger(target)&&target>=run("bldSt('iron_store').lv")&&target<=run('CFG.ownMax.warehouse'),'铁仓目标等级无效');
  while(run("bldSt('iron_store').lv")<target){
    upgradeBuilding('iron_store',jobs.steel);actions.build++;
    const level=run("bldSt('iron_store').lv");
    if(level%100===0)point(`iron store ${level}`);
  }
  point(`iron store target ${target}`);
}
while(run("resCap('steel')")<1000000){
  upgradeBuilding('steel_store',jobs.steel);actions.build++;
  const level=run("bldSt('steel_store').lv");
  if(level%100===0)point(`steel store ${level}`);
}
point('steel capacity 1m');
assign(jobs.steel);wait('S.res.steel>=1000000');
point('steel stock 1m');
assign(jobs.tech);wait('S.res.tech>=5000000');
const before=run('({tech:S.res.tech,steel:S.res.steel})');
action("researchScience('sci_electric_age')",'research','电力时代');actions.research++;
assert.equal(run('S.res.tech'),before.tech-5000000);
assert.equal(run('S.res.steel'),before.steel-1000000);
assert.equal(run("S.sciences.includes('sci_electric_age')"),true);
point('electric researched');

const armoryCost=run('CFG.buildings.electric_armory.build');
assign(jobs.basic);
wait(`S.res.wood>=${armoryCost.wood}&&S.res.stone>=${armoryCost.stone}&&S.res.food>=${armoryCost.food}`);
action("buildAct('electric_armory')",'build','建造电磁兵坊');actions.build++;
wait("bldSt('electric_armory').lv===1&&bldSt('electric_armory').state==='idle'",180);
assign({food:12,stone:30,coal:30,copper:30});
wait('S.res.copper>=8000');
assign(jobs.steel);
wait('S.res.iron>=8000&&S.res.steel>=8000');
assign({food:102});
const trainBefore=run('({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})');
const result=run("train('electro_trooper',1)");
assert.equal(result?.ok,true,JSON.stringify(result));actions.train++;
wait('S.pool.electro_trooper>=1',10);
for(const rk of ['copper','iron','steel'])assert.equal(trainBefore[rk]-run(`S.res.${rk}`),8000);
point('electro trooper trained');

const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.population.current,102);
assert.equal(saved.storageMasteryLv,100);
assert.equal(saved.eraStorage.steamKnowledge,6);
assert.equal(saved.eraStorage.steamMetal,5);
assert.equal(saved.buildings.iron_store.lv,ironStoreArg?Number(ironStoreArg.slice('--iron-store='.length)):run("bldSt('iron_store').lv"));
assert.equal(saved.items.godCrystal,2);
assert.equal(saved.defeated.length,0);
assert.ok(saved.sciences.includes('sci_electric_age'));
assert.equal(saved.buildings.electric_armory.lv,1);
assert.equal(saved.pool.electro_trooper,1);
for(const [key,value] of Object.entries(run('({...S.res})')))
  assert.ok(Number.isFinite(value)&&value>=0,`${key} 最终资源非法：${value}`);
console.log(JSON.stringify({unit:'online seconds',second:run('S.tick'),population:run('S.population.current'),stageWins:run('S.defeated.length'),
  crystal:run('S.items.godCrystal'),mastery:run('S.storageMasteryLv'),steelMastery:run('S.steelMasteryLv'),knowledge:run('S.eraStorage.steamKnowledge'),
  metal:run('S.eraStorage.steamMetal'),techCap:run("resCap('tech')"),steelCap:run("resCap('steel')"),
  ironStore:run("bldSt('iron_store').lv"),steelStore:run("bldSt('steel_store').lv"),electroTrooper:run('S.pool.electro_trooper'),actions,milestones},null,2));
