'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const tiers=[
  {tier:2,shop:290080,item:180031,level:30,cost:3,weight:20,bonus:0.015},
  {tier:3,shop:290081,item:180032,level:40,cost:4,weight:10,bonus:0.02},
  {tier:4,shop:290082,item:180033,level:50,cost:5,weight:10,bonus:0.025},
  {tier:5,shop:290083,item:180034,level:60,cost:6,weight:10,bonus:0.03}
];
const tierBasisPoints={2:150,3:200,4:250,5:300};
function capWithScrolls(base,firstUsed,tierUsed={}){
  const basisPoints=10000+firstUsed*100+Object.entries(tierUsed).reduce(
    (sum,[tier,count])=>sum+tierBasisPoints[tier]*count,0);
  return Number(BigInt(base)*BigInt(basisPoints)/10000n);
}
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}
const snap=e=>JSON.parse(e.run('JSON.stringify({items:S.items,beastExchange:S.beastExchange,res:S.res})'));

check('四阶源费用、等级、权重、库存与加法倍率对应实装配置',()=>{
  const e=environment();
  assert.equal(e.run('SAVE_VERSION'),36);
  for(const {tier,shop,item,level,cost,weight,bonus} of tiers){
    const src=source[shop],pill=source[item],cfg=e.run(`CFG.beastExchange.highScrollTrades[${tier}]`);
    assert.deepEqual(src['exchangeShop:Need'],[180016,cost]);
    assert.deepEqual(src['exchangeShop:Get'],[item,1]);
    assert.equal(src['exchangeShop:ExchangeLv'],level);
    assert.equal(src['exchangeShop:Rate'],weight);
    assert.equal(pill['itemPill:LimitNum'],500);
    assert.equal(cfg.level,level);
    assert.equal(cfg.weight,weight);
    assert.equal(cfg.firstScrollCost,cost);
    assert.equal(cfg.capacityPerUse,bonus);
    assert.equal(cfg.useLimit,500);
    assert.equal(e.run(`CFG.eraMaterials.storageScroll${tier}.max`),1000);
    assert.equal(e.run(`S.items.storageScroll${tier}`),0);
    assert.equal(e.run(`S.beastExchange.scrollUsedTiers[${tier}]`),0);
  }
});

check('四档品质按每份ceil折价，非法档与非法品质不生成可付价格',()=>{
  const e=environment();
  for(const {tier,cost} of tiers)for(const quality of [100,80,50,10]){
    e.run(`S.beastExchange.tierOffers[${tier}].quality=${quality}`);
    assert.equal(e.run(`beastTierScrollTradeCost(${tier})`),Math.ceil(cost*quality/100));
  }
  assert.equal(Number.isNaN(e.run('beastTierScrollTradeCost(1)')),true);
  assert.equal(Number.isNaN(e.run('beastTierScrollTradeCost(6)')),true);
  e.run('S.beastExchange.tierOffers[2].quality=42');
  assert.equal(Number.isNaN(e.run('beastTierScrollTradeCost(2)')),true);
});

check('Ⅱ至Ⅴ阶各真实交易两份、使用两份，并保存重载仓容',()=>{
  for(const {tier,level,cost,bonus} of tiers){
    const e=environment();
    const capBefore=e.run("resCap('tech')"),medalCap=e.run("resCap('medal')");
    e.run(`S.beastExchange.level=${level};S.items.storageScroll=100;
      S.beastExchange.tierOffers[${tier}]={count:2,quality:80}`);
    const unitCost=Math.ceil(cost*0.8),paid=e.run(`exchangeTierScroll(${tier},2)`);
    assert.equal(paid.ok,true,JSON.stringify(paid));
    assert.equal(paid.cost,2*unitCost);
    assert.equal(e.run('S.items.storageScroll'),100-2*unitCost);
    assert.equal(e.run(`S.items.storageScroll${tier}`),2);
    assert.equal(e.run(`S.beastExchange.tierOffers[${tier}].count`),0);
    const used=e.run(`useTierStorageScroll(${tier},2)`);
    assert.equal(used.ok,true,JSON.stringify(used));
    assert.equal(e.run(`S.items.storageScroll${tier}`),0);
    assert.equal(e.run(`S.beastExchange.scrollUsedTiers[${tier}]`),2);
    assert.equal(e.run("resCap('tech')"),capWithScrolls(capBefore,0,{[tier]:2}));
    assert.equal(e.run("resCap('medal')"),medalCap);
    const reloaded=environment({rts_save:e.store.get('rts_save')});
    assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
    assert.equal(reloaded.run(`S.beastExchange.scrollUsedTiers[${tier}]`),2);
    assert.equal(reloaded.run(`S.items.storageScroll${tier}`),0);
    assert.equal(reloaded.run("resCap('tech')"),e.run("resCap('tech')"));
  }
});

check('Ⅰ至Ⅴ阶仓容相加后统一乘基底，货币容量保持不变',()=>{
  const e=environment();
  const tech=e.run("resCap('tech')"),wood=e.run("resCap('wood')"),medal=e.run("resCap('medal')");
  e.run(`S.beastExchange.level=60;S.items.storageScroll=1;
    for(const tier of [2,3,4,5])S.items['storageScroll'+tier]=1`);
  assert.equal(e.run('useStorageScroll(1).ok'),true);
  for(const {tier} of tiers)assert.equal(e.run(`useTierStorageScroll(${tier},1).ok`),true);
  const used=Object.fromEntries(tiers.map(({tier})=>[tier,1]));
  assert.equal(e.run("resCap('tech')"),capWithScrolls(tech,1,used));
  assert.equal(e.run("resCap('wood')"),capWithScrolls(wood,1,used));
  assert.equal(e.run("resCap('medal')"),medal);
  assert.equal(e.run('S.beastExchange.scrollUsed'),1);
  for(const {tier} of tiers)assert.equal(e.run(`S.beastExchange.scrollUsedTiers[${tier}]`),1);
});

check('Ⅱ阶对2400木仓精确加1.5%，Ⅰ＋Ⅱ加法且大整数不丢1',()=>{
  const e=environment();
  e.run('S.items.storageScroll2=1;S.items.storageScroll=1');
  assert.equal(e.run("masteredCapacity('wood',2400)"),2400);
  assert.equal(e.run('useTierStorageScroll(2,1).ok'),true);
  assert.equal(e.run("masteredCapacity('wood',2400)"),2436);
  assert.equal(e.run('useStorageScroll(1).ok'),true);
  assert.equal(e.run("masteredCapacity('wood',2400)"),2460);
  const base=1234567890123;
  const expected=Number(BigInt(base)*10250n/10000n);
  assert.equal(e.run(`masteredCapacity('wood',${base})`),expected);
});

check('交易与使用在等级、货位、库存、次数、参数门上拒付且不改状态',()=>{
  const e=environment();
  e.run('S.beastExchange.level=29;S.beastExchange.tierOffers[2]={count:1,quality:100};S.items.storageScroll=10');
  function refused(expression,reason){const before=snap(e),out=e.run(expression);assert.equal(out.ok,false);assert.equal(out.reason,reason);assert.deepEqual(snap(e),before)}
  refused('exchangeTierScroll(6,1)','invalid-tier');
  refused('useTierStorageScroll(6,1)','invalid-tier');
  refused('exchangeTierScroll(2,0)','invalid-quantity');
  refused('useTierStorageScroll(2,1.5)','invalid-quantity');
  refused('exchangeTierScroll(2,1)','level');
  e.run('S.beastExchange.level=30;S.beastExchange.tierOffers[2].count=0');
  refused('exchangeTierScroll(2,1)','not-offered');
  e.run('S.beastExchange.tierOffers[2].count=1;S.items.storageScroll=0');
  refused('exchangeTierScroll(2,1)','insufficient-scroll');
  e.run('S.items.storageScroll=10;S.items.storageScroll2=1000');
  refused('exchangeTierScroll(2,1)','capacity');
  e.run('S.items.storageScroll2=0');
  refused('useTierStorageScroll(2,1)','insufficient-scroll');
  e.run('S.items.storageScroll2=1;S.beastExchange.scrollUsedTiers[2]=500');
  refused('useTierStorageScroll(2,1)','use-limit');
});

check('高阶交易和使用遇主档写入失败，库存、报价与已用数完整回滚',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.beastExchange.tierOffers[5]={count:2,quality:50};S.items.storageScroll=10;S.items.storageScroll5=1;save()');
  const raw=e.store.get('rts_save'),before=snap(e);
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('exchangeTierScroll(5,1).reason'),'save-failed');
  assert.deepEqual(snap(e),before);
  assert.equal(e.run('useTierStorageScroll(5,1).reason'),'save-failed');
  assert.deepEqual(snap(e),before);
  assert.equal(e.store.get('rts_save'),raw);
});

check('v34候选迁移先留原文，旧库存/零值不损失，新四阶默认零并可重载',()=>{
  const seed=environment();
  const d=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
  d.v=34;d.items.storageScroll=7;d.beastExchange.scrollUsed=11;d.res.medal=4321;
  for(const {tier} of tiers)delete d.items['storageScroll'+tier];
  delete d.beastExchange.scrollUsedTiers;delete d.beastExchange.tierOffers;
  const raw=JSON.stringify(d),e=environment({rts_save:raw});
  const migration=e.run('loadSaveAndApply()');
  assert.equal(migration.status,'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.storageScroll'),7);
  assert.equal(e.run('S.beastExchange.scrollUsed'),11);
  assert.equal(e.run('S.res.medal'),4321);
  for(const {tier} of tiers){
    assert.equal(e.run(`S.items.storageScroll${tier}`),0);
    assert.equal(e.run(`S.beastExchange.scrollUsedTiers[${tier}]`),0);
    assert.equal(e.run(`S.beastExchange.tierOffers[${tier}].count`),0);
    assert.equal(e.run(`S.beastExchange.tierOffers[${tier}].quality`),100);
  }
  const saved=e.store.get('rts_save');assert.equal(JSON.parse(saved).v,36);
  const reload=environment({rts_save:saved});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.storageScroll'),7);
  assert.equal(reload.run('S.res.medal'),4321);
  for(const {tier} of tiers)assert.equal(reload.run(`S.beastExchange.scrollUsedTiers[${tier}]`),0);
  for(const blockedKey of ['rts_save_premigration','rts_save_backup_1']){
    const blocked=environment({rts_save:raw});
    blocked.run(`const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='${blockedKey}')throw Error('quota');return originalSet(key,value)}`);
    assert.equal(blocked.run('loadSaveAndApply().status'),'migrated_readonly');
    assert.equal(blocked.run('saveProtected()'),true);
    assert.equal(blocked.store.get('rts_save'),raw);
    assert.equal(blocked.run('S.items.storageScroll'),0);
    assert.equal(blocked.run('S.res.medal'),0);
  }
});

check('v36密卷损坏字段与v37未来档均拒载，tick和save不覆盖原文',()=>{
  const seed=environment();assert.equal(seed.run('save().ok'),true);
  const valid=JSON.parse(seed.store.get('rts_save'));assert.equal(valid.v,36);
  const cases=[
    {mutate:d=>delete d.items.storageScroll2,status:'invalid'},
    {mutate:d=>d.items.storageScroll3=-1,status:'invalid'},
    {mutate:d=>delete d.beastExchange.scrollUsedTiers[4],status:'invalid'},
    {mutate:d=>d.beastExchange.scrollUsedTiers[5]=501,status:'invalid'},
    {mutate:d=>d.beastExchange.tierOffers[2].quality=42,status:'invalid'},
    {mutate:d=>d.beastExchange.tierOffers[6]={count:1,quality:100},status:'invalid'},
    {mutate:d=>{d.beastExchange.level=60;d.beastExchange.heartOffers=7;
      d.beastExchange.tierOffers[2].count=7;d.beastExchange.medalOffers=1},status:'invalid'},
    {mutate:d=>d.v=37,status:'future'}
  ];
  for(const {mutate,status} of cases){
    const d=structuredClone(valid);mutate(d);const raw=JSON.stringify(d),bad=environment({rts_save:raw});
    assert.equal(bad.run('loadSaveAndApply().status'),status);
    assert.equal(bad.run('saveProtected()'),true);
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),raw);
  }
});

console.log(`high scroll P401: ${passed}/9`);
