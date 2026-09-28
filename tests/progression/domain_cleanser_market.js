'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.resolve(__dirname,'../..');
const entities=JSON.parse(fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/entities_table.json'),'utf8')).ents;
const marketList=JSON.parse(fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/db_base_norm.json'),'utf8')).base.marketList;
const paidRaw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function ready(){const e=environment();e.run("S.sciences=['sci_copper','sci_currency','sci_gold','sci_electric_age'];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");return e}

check('母本市场20分钟10格权重、两笔静态标价与道具效用对应配置',()=>{
  const total=marketList.reduce((sum,id)=>sum+entities[id]['market:Rate'],0);
  assert.equal(entities['380000']['market:Time'],1200);
  assert.equal(entities['380000']['market:InitCount'],10);
  assert.equal(total,2625);
  assert.equal(entities['380009']['market:Rate'],20);
  assert.equal(entities['380049']['market:Rate'],10);
  assert.deepEqual(entities['380009']['market:Need'],[160006,9999]);
  assert.deepEqual(entities['380049']['market:Need'],[180001,3]);
  assert.deepEqual(entities['380049']['market:Get'],[180005,1]);
  assert.equal(entities['180005']['itemPill:Add'],100);
  const e=ready();
  assert.equal(e.run('CFG.market.special.totalWeight'),total);
  assert.equal(e.run("CFG.market.special.goods.sacredBlood.cost"),9999);
  assert.equal(e.run("CFG.market.special.goods.domainCleanser.cost"),3);
  e.run('S.storageMasteryLv=100');
  assert.equal(e.run("resCap('goldCoin')"),10000);
});

check('旧v32档先保护原文再补两道具和市场时钟，非法值与备份失败拒载',()=>{
  const e=environment({rts_save:paidRaw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),paidRaw);
  assert.equal(e.run('S.items.sacredBlood'),0);
  assert.equal(e.run('S.items.domainCleanser'),0);
  assert.equal(e.run('S.marketSpecial.clockSec'),1200);
  assert.equal(e.run('S.marketSpecial.offers.sacredBlood'),0);
  const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  const bad=JSON.parse(saved);bad.items.domainCleanser=-1;
  const badRaw=JSON.stringify(bad),blocked=environment({rts_save:badRaw});
  assert.equal(blocked.run('loadSaveAndApply().status'),'invalid');
  blocked.run('tick();save()');
  assert.equal(blocked.store.get('rts_save'),badRaw);
  const invalid=JSON.parse(saved);invalid.marketSpecial.offers.sacredBlood=11;
  assert.equal(environment({rts_save:JSON.stringify(invalid)}).run('loadSaveAndApply().status'),'invalid');
  const oversubscribed=JSON.parse(saved);oversubscribed.marketSpecial.offers={sacredBlood:6,domainCleanser:5};
  assert.equal(environment({rts_save:JSON.stringify(oversubscribed)}).run('loadSaveAndApply().status'),'invalid');
  const noBackup=environment({rts_save:paidRaw});
  noBackup.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save_premigration')throw Error('quota');oldSet(key,value)}");
  assert.equal(noBackup.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(noBackup.store.get('rts_save'),paidRaw);
});

check('在线和离线每1200秒独立刷新10格，按源权重抽血剂与净化剂',()=>{
  const e=ready();
  e.run("globalThis.__rolls=[0,0.01,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5];Math.random=()=>__rolls.shift()");
  e.run('tick()');
  assert.equal(e.run('S.marketSpecial.cycles'),1);
  assert.equal(e.run('S.marketSpecial.clockSec'),1200);
  assert.equal(e.run('S.marketSpecial.offers.sacredBlood'),1);
  assert.equal(e.run('S.marketSpecial.offers.domainCleanser'),1);
  assert.equal(JSON.parse(e.store.get('rts_save')).marketSpecial.offers.sacredBlood,1);
  const firstOffline=ready();
  firstOffline.run('Math.random=()=>0.5;offlineAdvanceSec(1,0.6)');
  assert.equal(firstOffline.run('S.marketSpecial.cycles'),1);
  e.run('Math.random=()=>0.5;offlineAdvanceSec(1200,0.6)');
  assert.equal(e.run('S.marketSpecial.cycles'),2);
  assert.equal(e.run('S.marketSpecial.offers.sacredBlood'),0);
  assert.equal(e.run('S.marketSpecial.clockSec'),1200);
});

check('两段交易均真实扣费、减货架份额、存档往返，旧铜钱与银两不动',()=>{
  const e=ready(),run=e.run;
  run("S.marketSpecial.offers={sacredBlood:3,domainCleanser:1,emberElixir:0,aegisElixir:0};S.res.goldCoin=9999;S.res.coin=7;S.res.silverCoin=8;save()");
  const copper=run('S.res.coin'),silver=run('S.res.silverCoin');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).ok,true);
  assert.equal(run('S.res.goldCoin'),0);
  assert.equal(run('S.items.sacredBlood'),1);
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'insufficient-resource');
  run('S.res.goldCoin=9999');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).ok,true);
  run('S.res.goldCoin=9999');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).ok,true);
  assert.equal(run('S.marketSpecial.offers.sacredBlood'),0);
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'sold-out');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('domainCleanser'))")).ok,true);
  assert.equal(run('S.items.sacredBlood'),0);
  assert.equal(run('S.items.domainCleanser'),1);
  assert.equal(run('S.res.coin'),copper);
  assert.equal(run('S.res.silverCoin'),silver);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.domainCleanser'),1);
  assert.equal(reload.run('S.marketSpecial.offers.domainCleanser'),0);
});

check('净化剂需电力和指定警戒至少200；5000→4900只扣一次并改变真实敌阵',()=>{
  const e=ready(),run=e.run;
  assert.equal(JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))")).reason,'alert-too-low');
  run('S.killValues.godSlaughter=5000;S.items.domainCleanser=1;save()');
  const before=run("materialDomainEncounter('medal').units.slaughter_god[0]");
  assert.equal(before,3995);
  const used=JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))"));
  assert.equal(used.ok,true);assert.equal(used.alert,4900);
  assert.equal(run('S.items.domainCleanser'),0);
  assert.equal(run("materialDomainEncounter('medal').units.slaughter_god[0]"),2747);
  const repeat=JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))"));
  assert.equal(repeat.repeat,true);
  assert.equal(run('S.killValues.godSlaughter'),4900);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.killValues.godSlaughter'),4900);
  assert.equal(reload.run('S.items.domainCleanser'),0);
  assert.equal(JSON.parse(run("JSON.stringify(useDomainCleanser('missing'))")).reason,'domain-locked');
});

check('无市场、无货、满道具仓和战斗中都拒绝扣费；最低警戒停在100',()=>{
  const fresh=environment();
  fresh.run('S.res.goldCoin=9999;S.marketSpecial.offers.sacredBlood=1');
  assert.equal(JSON.parse(fresh.run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'market-locked');
  assert.equal(fresh.run('S.res.goldCoin'),9999);
  const e=ready(),run=e.run;
  run('S.res.goldCoin=9999');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'sold-out');
  run('S.marketSpecial.offers.sacredBlood=1;S.items.sacredBlood=CFG.eraMaterials.sacredBlood.max');
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'capacity');
  assert.equal(run('S.res.goldCoin'),9999);
  assert.equal(run('S.marketSpecial.offers.sacredBlood'),1);
  run('S.items.domainCleanser=1;S.killValues.godSlaughter=200;S.battleActive=true');
  assert.equal(JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))")).reason,'battle-active');
  assert.equal(run('S.items.domainCleanser'),1);
  run('S.battleActive=false');
  const used=JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))"));
  assert.equal(used.alert,100);
  assert.equal(run('S.items.domainCleanser'),0);
});

check('写档失败时购买与使用均回滚，主档原文不覆盖',()=>{
  const e=ready(),run=e.run;
  run("S.marketSpecial.offers.sacredBlood=1;S.res.goldCoin=9999;S.items.domainCleanser=1;S.killValues.godSlaughter=5000;save()");
  const raw=e.store.get('rts_save');
  run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  assert.equal(JSON.parse(run("JSON.stringify(buyMarketSpecial('sacredBlood'))")).reason,'save-failed');
  assert.equal(run('S.res.goldCoin'),9999);
  assert.equal(run('S.items.sacredBlood'),0);
  assert.equal(run('S.marketSpecial.offers.sacredBlood'),1);
  assert.equal(JSON.parse(run("JSON.stringify(useDomainCleanser('medal'))")).reason,'save-failed');
  assert.equal(run('S.items.domainCleanser'),1);
  assert.equal(run('S.killValues.godSlaughter'),5000);
  assert.equal(e.store.get('rts_save'),raw);
});

check('货架刷新写档失败回退本轮货品和时钟，旧主档仍可导出',()=>{
  const e=ready(),run=e.run;
  run('S.marketSpecial.clockSec=1;save()');
  const raw=e.store.get('rts_save');
  run("Math.random=()=>0;const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save')throw Error('quota');oldSet(key,value)}");
  run('tick()');
  assert.equal(run('S.marketSpecial.clockSec'),1);
  assert.equal(run('S.marketSpecial.offers.sacredBlood'),0);
  assert.equal(e.store.get('rts_save'),raw);
});

console.log(`${passed} passed`);
