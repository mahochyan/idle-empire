'use strict';
// 从真实新档动作路线继续到蒸汽研究与首名装甲兵：不注入资源、人口、科技或胜利。
// 运行：node tools/verify/probe-steam-era.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-next-era.js'),'utf8');
const continuation=new Function('require','console','__dirname',prior+'\nreturn {run,actions,extraActions,action,assign,study,build,waitFor,point,points};')(
  require,{log(){}},__dirname
);
const {run,actions,extraActions,action,assign,study,build,waitFor,point,points}=continuation;
assert.equal(run('S.storageMasteryLv'),5);
assert.equal(run('S.defeated.length'),0);
function ensureCapacity(rk,amount,guard=new Set()){
  let attempts=0;
  while(run(`resCap('${rk}')`)<amount){
    assert.ok(++attempts<=50,`${rk} 扩仓次数异常：需${amount}，现仓${run(`resCap('${rk}')`)}，仓库Lv${run("bldSt('warehouse').lv")}，模式${run('S.storageMode')}`);
    const key=rk==='food'?'large_granary':rk==='wood'?'warehouse':rk==='stone'?
      (run("bldSt('stone_store').lv")>0?'stone_store':'warehouse'):rk==='copper'?
      (guard.has('copper_store')?'iron_store':'copper_store'):null;
    assert.ok(key,`${rk} 没有本探针可用的容量建筑`);
    assert.ok(!guard.has(key),`${rk} 的 ${key} 升级本身超出可支付仓容`);
    const nextGuard=new Set(guard);nextGuard.add(key);
    const level=run(`bldSt('${key}').lv`),beforeCapacity=run(`resCap('${rk}')`),cost=run(`upCost('${key}')`);
    const payments=Object.entries(cost).filter(([resource,value])=>resource!=='time'&&value>0);
    for(const[resource,value]of payments)if(value>run(`resCap('${resource}')`))
      ensureCapacity(resource,value,nextGuard);
    waitFor(payments.map(([resource,value])=>`S.res.${resource}>=${value}`).join('&&'),20000);
    action(`buildAct('${key}')`,'build',`扩${rk}仓容（${key} Lv${level+1}）`);
    waitFor(`bldSt('${key}').lv===${level+1}&&bldSt('${key}').state==='idle'`,130);
    assert.ok(run(`resCap('${rk}')`)>beforeCapacity,`${key} 升级未增加${rk}容量`);
  }
}
function upgradeTo(key,target){
  while(run(`bldSt('${key}').lv`)<target){
    const before=run(`bldSt('${key}').lv`),cost=run(`upCost('${key}')`);
    for(const[rk,amount]of Object.entries(cost))if(rk!=='time'&&amount>0)
      ensureCapacity(rk,amount,new Set([key]));
    const payments=Object.entries(cost).filter(([rk,n])=>rk!=='time'&&n>0);
    waitFor(payments.map(([rk,n])=>`S.res.${rk}>=${n}`).join('&&'),20000);
    action(`buildAct('${key}')`,'build',`${key} Lv${before+1}`);
    waitFor(`bldSt('${key}').lv===${before+1}&&bldSt('${key}').state==='idle'`,130);
  }
}
const jobsBasic={wood:8,stone:8,food:4,tech:6};
assign(jobsBasic);
study('sci_copper_furnace');
build('copper_furnace');
study('sci_stone_store');
build('stone_store');
study('sci_institute');
build('institute');
point('stone-and-research-branch');

// 逐级支付前置仓容与学院费用：当前母本映射中学院满级50、石仓等级上限1000。
upgradeTo('stone_store',15);
upgradeTo('large_granary',4);
upgradeTo('academy',32);
assert.ok(run("resCap('tech')")>=100000);
point('knowledge-cap-ready');

// 兽骨在早期实战取得，知识仓扩容后才逐级支付14～20级；全部使用玩家可执行动作。
if(process.argv.includes('--steel-mastery-20')){
  assert.equal(run('S.steelMasteryLv'),13);
  assert.ok(run('S.res.bone')>=1790,'前期郊野储备不足');
  const traded=run('exchangeBonesForMedals(179)');
  assert.equal(traded?.ok,true,JSON.stringify(traded));
  assert.equal(run('S.res.medal'),3580);
  assert.equal(run('S.daily.counts.market||0'),0);
  assign({food:5,tech:21});
  const payments=[];
  for(let level=14;level<=20;level++){
    const cost=run('steelMasteryCost()');
    assert.equal(cost.tech,1500*level);
    assert.equal(cost.medal,30*level);
    assert.ok(run("resCap('tech')")>=cost.tech);
    waitFor(`S.res.tech>=${cost.tech}`,50000);
    const before=run('({tech:S.res.tech,medal:S.res.medal})');
    action('upgradeSteelMastery()','research',`冶钢精通 Lv${level}`);
    assert.equal(run('S.steelMasteryLv'),level);
    assert.equal(run('S.res.tech'),before.tech-cost.tech);
    assert.equal(run('S.res.medal'),before.medal-cost.medal);
    payments.push({level,second:run('S.tick'),tech:cost.tech,medal:cost.medal});
  }
  assert.equal(run('S.res.medal'),10);
  const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
  assert.equal(saved.steelMasteryLv,20);
  assert.equal(saved.res.medal,10);
  assert.equal(saved.defeated.length,0);
  const {environment}=require('../../tests/progression/harness');
  const restored=environment({rts_save:JSON.stringify(saved)});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.steelMasteryLv'),20);
  assert.equal(restored.run('S.res.medal'),10);
  assert.equal(restored.run('S.res.bone'),run('S.res.bone'));
  point('steel-mastery-20',{payments,remainingBone:run('S.res.bone')});
  assign(jobsBasic);
}

// 上游净流量：26人中粮2、石8、煤7、铁5、钢4；先升级工坊才能长期正向炼钢。
upgradeTo('coal_mine',5);
// 母本冶铁工坊Need含铜；为支付分段升级及相应仓容，在煤链路线中保留铜工岗位。
assign({food:2,stone:7,coal:7,copper:4,iron:3,steel:3});
upgradeTo('smelter',10);
assert.ok(run("bldSt('copper_store').lv>0"),'workShop冶铁厂Need含铜，路线必须通过真实铜仓动作扩容');
assert.ok(run("resCap('copper')>=2000"),'冶铁厂10级前置费用需由已建铜仓链支持');
const jobsSteel={food:2,stone:8,coal:7,iron:5,steel:4};
assign(jobsSteel);
const beforeFlow=run('({...S.res})');
const flowStart=run('S.tick');
waitFor(`S.tick>=${flowStart+60}`,20000);
const afterFlow=run('({...S.res})');
for(const rk of ['food','stone','coal','iron','steel'])
  assert.ok(afterFlow[rk]>=beforeFlow[rk]-1e-8,`${rk} 上游净流量未保持非负`);
point('steel-upstream-positive');
upgradeTo('steel_store',64);
assert.ok(run("resCap('steel')")>=10000);
point('steel-cap-ready');
waitFor('S.res.steel>=10000',20000);
assign({food:6,tech:20});
waitFor('S.res.tech>=100000',20000);
const payment=run('({tech:S.res.tech,steel:S.res.steel})');
action("researchScience('sci_steam_age')",'research','蒸汽时代');
assert.equal(run('S.res.tech'),payment.tech-100000);
assert.equal(run('S.res.steel'),payment.steel-10000);
point('steam-age-researched',{payment});

assign({wood:8,stone:10,food:8});
build('steam_armory');
assign({food:2,stone:8,coal:10,copper:6});
waitFor('S.res.copper>=2000',20000);
assign(jobsSteel);
waitFor('S.res.iron>=2000&&S.res.steel>=2000',20000);
assign({});
const beforeTrain=run('({...S.res})');
const trained=run("train('armored_trooper',1)");
assert.equal(trained?.ok,true,JSON.stringify(trained));
extraActions.train++;
waitFor('S.pool.armored_trooper===1',10);
for(const rk of ['copper','iron','steel'])assert.equal(beforeTrain[rk]-run(`S.res.${rk}`),2000,rk);
assert.equal(run('S.defeated.length'),0);
point('armored-trooper-trained');
const last=points.at(-1);
console.log(JSON.stringify({unit:'online seconds',onlineSeconds:last.onlineSeconds,population:last.population,
  wins:last.battleWins,techCap:last.caps.tech,steelCap:last.caps.steel,
  steelMastery:run('S.steelMasteryLv'),medal:run('S.res.medal'),bone:run('S.res.bone'),
  sciences:last.sciences.filter(id=>['sci_copper_furnace','sci_stone_store','sci_institute','sci_steam_age'].includes(id)),
  firstArmoredSoldiers:run('S.pool.armored_trooper'),actions:{...actions,...extraActions},
  milestones:points.filter(p=>['stone-and-research-branch','knowledge-cap-ready','steel-mastery-20','steel-upstream-positive','steel-cap-ready','steam-age-researched','armored-trooper-trained'].includes(p.label))
    .map(p=>({label:p.label,second:p.onlineSeconds,population:p.population,techCap:p.caps.tech,steelCap:p.caps.steel,food:p.resources.food,payments:p.payments,remainingBone:p.remainingBone}))},null,2));
