'use strict';
// 接续真实102人口、电力四项首级和两场材料首胜；用实际招募、战斗、扩仓与逐笔研究验证第6级。
// 在线时间单位为秒。前序固定战斗随机数0.5；全程不注入资源、人口、科技、兵力、材料或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-god-materials-first.js'),'utf8');
const {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,assign,waitFor,action,upgradeBuilding,ensureBasicCapacity,increaseKnowledgeCapacity,jobs};'
)(require,{log(){},error:console.error},__dirname);
assert.equal(run('S.population.current'),102);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.items.guardianStone'),2);
assert.equal(run('S.items.phantomFlower'),2);
const begin=run('S.tick'),battles=[],payments=[];
function upgradeTo(key,target){
  while(run(`bldSt('${key}').lv`)<target){
    ensureBasicCapacity(run(`upCost('${key}')`));
    upgradeBuilding(key,jobs.basic);
  }
}
upgradeTo('barracks',10);
while(run("unitCap('alloy_special')")<55)upgradeTo('alloy_armory',run("bldSt('alloy_armory').lv")+1);
while(run("unitCap('armored_trooper')")<55)upgradeTo('steam_armory',run("bldSt('steam_armory').lv")+1);
while(run("unitCap('archer')")<55)upgradeTo('archer_range',run("bldSt('archer_range').lv")+1);
assert.equal(run('regMax()'),55);
console.error('army capacity '+JSON.stringify(run("({second:S.tick,barracks:bldSt('barracks').lv,alloy:bldSt('alloy_armory').lv,armor:bldSt('steam_armory').lv,archer:bldSt('archer_range').lv})")));
const ARMY=55;

function owned(type){return run(`S.pool.${type}+expeditionCount('${type}')`)}
function trainAlloy(target){
  const missing=target-owned('alloy_special');if(missing<=0)return;
  assign({food:10,stone:30,coal:30,iron:20,steel:12});
  waitFor(`S.res.steel>=${missing*100}`,100000);
  assign({food:102});
  const result=run(`train('alloy_special',${missing})`);
  assert.equal(result?.ok,true,`合金兵补训：${JSON.stringify(result)}`);
  waitFor(`S.pool.alloy_special+expeditionCount('alloy_special')>=${target}`,100000);
}
function trainArmor(target){
  while(owned('armored_trooper')<target){
    const current=owned('armored_trooper'),batch=Math.min(3,target-current),fee=batch*2000;
    for(const rk of ['copper','iron','steel'])assert.ok(run(`resCap('${rk}')`)>=fee,`${rk}容量不足以训练${batch}名装甲兵`);
    assign({food:10,stone:30,coal:30,copper:30});
    waitFor(`S.res.copper>=${fee}`,100000);
    assign(jobs.steel);
    waitFor(`S.res.iron>=${fee}&&S.res.steel>=${fee}`,100000);
    const result=run(`train('armored_trooper',${batch})`);
    assert.equal(result?.ok,true,`装甲兵补训：${JSON.stringify(result)}`);
    waitFor(`S.pool.armored_trooper+expeditionCount('armored_trooper')>=${current+batch}`,100000);
  }
}
function trainArcher(target){
  const missing=target-owned('archer');if(missing<=0)return;
  assign({wood:32,stone:32,food:38});
  waitFor(`S.res.wood>=${missing*80}&&S.res.stone>=${missing*20}&&S.res.food>=${missing*30}`,100000);
  const result=run(`train('archer',${missing})`);
  assert.equal(result?.ok,true,`弓手补训：${JSON.stringify(result)}`);
  waitFor(`S.pool.archer+expeditionCount('archer')>=${target}`,100000);
}
function fill(row,type){
  const existing=run(`S.formation.${row}[0]?.count||0`),missing=ARMY-existing;
  if(missing<=0)return;
  run(`openFormModal('expedition','${row}',0);S._formModalSel='${type}';S._formModalQty=${missing};confirmForm()`);
  assert.equal(run(`S.formation.${row}[0]?.count`),ARMY,`${row}未补满${type}`);
}
function replenish(){
  trainAlloy(ARMY);trainArmor(ARMY);trainArcher(ARMY);
  fill('front','alloy_special');fill('mid','armored_trooper');fill('back','archer');
}
function fightFor(key,target,killKey){
  let attempts=0;
  while(run(`S.items.${key}`)<target){
    assert.ok(++attempts<=25,`${key}超过25场仍未取得${target}`);
    replenish();
    const before=run(`S.items.${key}`),killBefore=run(`S.killValues.${killKey}`),second=run('S.tick');
    run(`openMaterialDomain('${key}')`);
    assert.equal(run('S.battleActive'),true,`${key}未开战`);
    for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'战斗回调丢失');
    assert.equal(run('S.battleActive'),false,`${key}战斗未结束`);
    const after=run(`S.items.${key}`),formation=run('S.formation');
    const row={key,second,killBefore,before,after,formation};battles.push(row);
    console.error('battle '+JSON.stringify(row));
    assert.ok(after>before,`${key}警戒值${killBefore}战败；材料未增加`);
    assert.equal(run(`S.killValues.${killKey}`),killBefore+100);
    run('exitBattle()');
  }
}
fightFor('guardianStone',120,'godGuardian');
fightFor('phantomFlower',180,'godPhantom');

function payToSix(key){
  while(run(`S.eraStorage.${key}`)<6){
    const cost=run(`eraStorageCost('${key}')`),level=run(`S.eraStorage.${key}`)+1;
    increaseKnowledgeCapacity(cost.tech);
    assign(jobs.tech);waitFor(`S.res.tech>=${cost.tech}`,500000);
    const before=run('({tech:S.res.tech,items:{...S.items}})');
    action(`upgradeEraStorage('${key}')`,'research',`${key} Lv${level}`);
    assert.equal(run(`S.eraStorage.${key}`),level);
    assert.equal(run('S.res.tech'),before.tech-cost.tech);
    for(const item of ['guardianStone','phantomFlower'])assert.equal(run(`S.items.${item}`),before.items[item]-(cost[item]||0));
    const row={key,level,second:run('S.tick'),cost,capacity:run("resCap('tech')"),stock:run('S.res.tech')};
    payments.push(row);console.error('payment '+JSON.stringify(row));
  }
}
payToSix('electricProduction');
payToSix('electricKnowledge');
assert.equal(run('S.defeated.length'),0);
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.eraStorage.electricProduction,6);
assert.equal(saved.eraStorage.electricKnowledge,6);
assert.equal(saved.population.current,102);
assert.equal(saved.defeated.length,0);
console.log(JSON.stringify({unit:'online seconds',begin,finish:run('S.tick'),elapsed:run('S.tick')-begin,
  guardianStone:saved.items.guardianStone,phantomFlower:saved.items.phantomFlower,
  guardianKill:saved.killValues.godGuardian,phantomKill:saved.killValues.godPhantom,battles,payments},null,2));
