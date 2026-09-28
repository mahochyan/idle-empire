'use strict';
// 接续26人、普通关卡零胜利、晶核不足60的真实路线；实付扩仓、扩军并挑战到60枚。
// 在线秒逐tick推进，固定战斗随机数0.5；不注入资源、人口、科技、兵力或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-god-domain-curve.js'),'utf8');
const {run,assign,waitFor,action,build,extraActions}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,build,extraActions};'
)(require,{log(){}},__dirname);
assert.ok(run('S.killValues.godRevival')>=600,'前段机巧遗迹挑战尚未推进到扩军门');
assert.ok(run('S.items.godCrystal')>=16&&run('S.items.godCrystal')<60,'须从真实未满60晶核的档接续');
assert.equal(run('S.defeated.length'),0);
run('exitBattle()');

function upgradeOne(key){
  const before=run(`bldSt('${key}').lv`),cost=run(`upCost('${key}')`);
  for(const [rk,amount] of Object.entries(cost))if(rk!=='time'&&amount>0)
    assert.ok(run(`resCap('${rk}')`)>=amount,`${key} Lv${before+1} ${rk} ${amount} 超仓 ${run(`resCap('${rk}')`)}`);
  if(cost.stone||cost.wood){
    assign({wood:6,stone:14,food:6});
    waitFor(Object.entries(cost).filter(([rk])=>rk==='wood'||rk==='stone').map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&'),50000);
  }
  if(cost.food){assign({food:26});waitFor(`S.res.food>=${cost.food}`,50000);}
  action(`buildAct('${key}')`,'build',`${key} Lv${before+1}`);
  waitFor(`bldSt('${key}').lv===${before+1}&&bldSt('${key}').state==='idle'`,180);
}
function ensureCostCapacity(cost){
  while(run("resCap('wood')")<(cost.wood||0)||run("resCap('stone')")<(cost.stone||0))upgradeOne('stone_store');
  while(run("resCap('food')")<(cost.food||0))upgradeOne('large_granary');
}
function upgradeToPaid(key,target){
  while(run(`bldSt('${key}').lv`)<target){
    ensureCostCapacity(run(`upCost('${key}')`));
    upgradeOne(key);
  }
}

upgradeToPaid('barracks',7);
upgradeToPaid('alloy_armory',12);
upgradeToPaid('steam_armory',12);
if(run("bldSt('archer_range').lv")===0){assign({wood:6,stone:14,food:6});build('archer_range');}
upgradeToPaid('archer_range',2);
assert.equal(run('regMax()'),40);
for(const uk of ['alloy_special','armored_trooper','archer'])assert.ok(run(`unitCap('${uk}')`)>=40,`${uk} 上限不足`);

function trainAlloy(target){
  const missing=target-run("S.pool.alloy_special+expeditionCount('alloy_special')");
  if(missing<=0)return;
  assign({food:2,stone:8,coal:7,iron:5,steel:4});
  waitFor(`S.res.steel>=${missing*100}`,100000);
  assign({food:26});
  const result=run(`train('alloy_special',${missing})`);
  assert.equal(result?.ok,true,JSON.stringify(result));extraActions.train++;
  try{waitFor(`S.pool.alloy_special+expeditionCount('alloy_special')>=${target}`,100000)}
  catch(error){throw Error('alloy training stalled: '+JSON.stringify(run("({pool:S.pool,formation:S.formation,queue:S.queue,cap:unitCap('alloy_special'),left:unitCapLeft('alloy_special'),army:armyCount(),free:freeBandSize(),raw:rawUpkeep(),foodRate:prodRate('food'),upkeep:totalUpkeep(),foodCost:potentialFoodCostSecond()})"))+': '+error.message)}
}
function trainArcher(target){
  const missing=target-run("S.pool.archer+expeditionCount('archer')");
  if(missing<=0)return;
  assign({wood:8,stone:8,food:10});
  waitFor(`S.res.wood>=${missing*80}&&S.res.stone>=${missing*20}&&S.res.food>=${missing*30}`,50000);
  const result=run(`train('archer',${missing})`);
  assert.equal(result?.ok,true,JSON.stringify(result));extraActions.train++;
  waitFor(`S.pool.archer+expeditionCount('archer')>=${target}`,50000);
}
function trainArmor(target){
  while(run("S.pool.armored_trooper+expeditionCount('armored_trooper')")<target){
    const owned=run("S.pool.armored_trooper+expeditionCount('armored_trooper')");
    const batch=Math.min(3,target-owned),cost=batch*2000;
    for(const rk of ['copper','iron','steel'])assert.ok(run(`resCap('${rk}')`)>=cost,`${rk} 单批上限不足`);
    assign({food:2,stone:8,coal:10,copper:6});
    waitFor(`S.res.copper>=${cost}`,100000);
    assign({food:2,stone:8,coal:7,iron:5,steel:4});
    waitFor(`S.res.iron>=${cost}&&S.res.steel>=${cost}`,100000);
    const result=run(`train('armored_trooper',${batch})`);
    assert.equal(result?.ok,true,JSON.stringify(result));extraActions.train++;
    waitFor(`S.pool.armored_trooper+expeditionCount('armored_trooper')>=${owned+batch}`,1000);
  }
}
function fill(row,type){
  const current=run(`S.formation.${row}[0]?.count||0`),missing=40-current;
  if(missing<=0)return;
  run(`openFormModal('expedition','${row}',0);S._formModalSel='${type}';S._formModalQty=${missing};confirmForm()`);
  assert.equal(run(`S.formation.${row}[0]?.count`),40,`${row} ${type} 编队不足：${JSON.stringify(run(`({pool:S.pool.${type},formation:S.formation,regMax:regMax(),unitCap:unitCap('${type}')})`))}`);
}
const milestones=[];
while(run('S.items.godCrystal')<60){
  trainAlloy(40);trainArcher(40);trainArmor(40);
  fill('front','alloy_special');fill('mid','armored_trooper');fill('back','archer');
  const before=run('S.items.godCrystal'),kill=run('S.killValues.godRevival');
  run('openGodDomain()');
  assert.equal(run('S.battleActive'),true);
  for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'战斗回调丢失');
  assert.equal(run('S.battleActive'),false);
  const after=run('S.items.godCrystal');
  milestones.push({kill,crystal:after,second:run('S.tick'),formation:run('S.formation')});
  assert.ok(after>before,`神域杀戮值${kill}未胜：${JSON.stringify(milestones.at(-1))}`);
  if(after<60)run('exitBattle()');
}
assert.equal(run('S.defeated.length'),0);
console.log(JSON.stringify({unit:'online seconds',second:run('S.tick'),population:run('S.population.current'),stageWins:run('S.defeated.length'),
  crystal:run('S.items.godCrystal'),killValue:run('S.killValues.godRevival'),
  knowledgeGate:run("({stored:S.res.tech,capacity:resCap('tech'),storageLevel:S.eraStorage.steamKnowledge,nextCost:eraStorageCost('steamKnowledge'),attempt:upgradeEraStorage('steamKnowledge')})"),
  buildings:run("({barracks:bldSt('barracks').lv,alloy:bldSt('alloy_armory').lv,steam:bldSt('steam_armory').lv,archer:bldSt('archer_range').lv,stoneStore:bldSt('stone_store').lv,granary:bldSt('large_granary').lv})"),milestones},null,2));
