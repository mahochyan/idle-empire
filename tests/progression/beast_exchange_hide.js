'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
function battleEnv(){
  const e=environment();
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.buildings.barracks={lv:10,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:55,id:101}],mid:[],back:[]};`);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true);
  assert.equal(e.run('S.battleActive'),false);
}
check('母本六猎场兽皮2／兽骨15、资源上限及现有十二货位逐条吻合',()=>{
  const e=environment(),cfg=e.run('CFG.beastExchange.hideTrades');
  assert.equal(source[160007]['resource2:Max'],9999);
  assert.equal(e.run('CFG.res.hide.max'),9999);
  for(const id of [550001,550011,550021,550031,550041,550051])
    assert.deepEqual(source[id]['smallWar:Get'],[[160007,2],[160008,15]]);
  assert.equal(Object.keys(cfg).length,12);
  for(const [id,trade] of Object.entries(cfg)){
    const row=source[id];
    assert.deepEqual(row['exchangeShop:Need'],[160007,trade.cost]);
    assert.equal(row['exchangeShop:Get'][1],trade.amount);
    assert.equal(row['exchangeShop:Rate'],trade.weight);
    assert.equal(row['exchangeShop:ExchangeLv'],0);
    assert.equal(trade.get,({150001:'food',150002:'wood',150003:'stone',150005:'coal'})[row['exchangeShop:Get'][0]]);
  }
  for(const id of [290031,290032,290033])assert.equal(cfg[id],undefined,'麻布货位留在未实现权重');
  for(const key of ['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'])
    assert.equal(e.run(`materialDomainEncounter('${key}',0).reward.hide`),2);
  assert.equal(e.run("isWorkerResource('hide')"),false);
});
check('真实狩猎取得兽皮，再刷新货位、实扣换粮、升级经验并重载',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('bone')");flushBattle(e);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  assert.equal(e.run('S.res.hide'),2);assert.equal(e.run('S.res.bone'),15);
  e.run("endBattle('win')");assert.equal(e.run('S.res.hide'),2,'重复结算不再领奖');
  e.run('Math.random=()=>0');
  const refresh=e.run('refreshBeastExchange()');assert.equal(refresh.ok,true);assert.equal(refresh.offers,8);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),8);
  assert.equal(e.run('beastHideTradeCost(290001)'),1,'10%品质真正改变售价');
  const trade=e.run('exchangeHideForResource(290001,1)');
  assert.equal(trade.ok,true);assert.equal(trade.hideCost,1);assert.equal(trade.gain,1000);
  assert.equal(e.run('S.res.hide'),1);assert.equal(e.run('S.res.food'),1300);
  assert.equal(e.run('S.beastExchange.progress'),1);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),7);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  for(const expr of ['S.res.hide','S.res.food','S.beastExchange.progress','S.beastExchange.hideOffers[290001].count'])
    assert.equal(restored.run(expr),e.run(expr));
});
check('兽皮货位逐级涨价与旧图纸、铭石、勋章权重区间互不挤占',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;S.beastExchange.hideOffers[290011].quality=100');
  assert.equal(e.run('beastHideTradeCost(290011)'),68);
  assert.equal(e.run('beastHideTradeReward(290011)'),4080);
  e.run('Math.random=()=>60.5/445');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),11);
  assert.equal(e.run('S.beastExchange.heartOffers'),0);
  e.run('S.beastExchange.level=60;Math.random=()=>140.5/680');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),14);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),0);
  assert.equal(e.run('S.beastExchange.medalOffers'),0);
  e.run('S.beastExchange.hideOffers[290011].quality=100');
  assert.equal(e.run('beastHideTradeCost(290011)'),128);
  assert.equal(e.run('beastHideTradeReward(290011)'),7680);
});
check('六猎场胜利兽皮必得，失败和保存失败都不得留下兽皮',()=>{
  for(const key of ['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew']){
    const e=battleEnv();e.run(`openMaterialDomain('${key}')`);flushBattle(e);
    assert.equal(e.run("document.getElementById('battle-result').className"),'win',key);
    assert.equal(e.run('S.res.hide'),2,key);
  }
  const lost=battleEnv();
  lost.run("S.formation.front=[{type:'infantry',count:1,id:101}];openMaterialDomain('bone')");flushBattle(lost);
  assert.equal(lost.run("document.getElementById('battle-result').className"),'lose');
  assert.equal(lost.run('S.res.hide'),0);
  const e=battleEnv();e.run("openMaterialDomain('bone')");
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");flushBattle(e);
  assert.equal(e.run('S.res.hide'),0);assert.equal(e.run('S.res.bone'),0);
  assert.equal(e.run('S.killValues.wildBoar'),0);
});
check('未上架、数量、兽皮与目标仓容均由动作函数守住',()=>{
  const e=environment();
  assert.equal(e.run('exchangeHideForResource("__proto__",1).reason'),'invalid-good');
  for(const n of [0,-1,1.5,NaN,Infinity])assert.equal(e.run(`exchangeHideForResource(290001,${n}).reason`),'invalid-quantity');
  assert.equal(e.run('exchangeHideForResource(290001,1).reason'),'not-offered');
  e.run('S.beastExchange.hideOffers[290001].count=1');
  assert.equal(e.run('exchangeHideForResource(290001,2).reason'),'not-offered');
  assert.equal(e.run('exchangeHideForResource(290001,1).reason'),'insufficient-hide');
  e.run('S.res.hide=10;S.res.food=resCap("food")');
  assert.equal(e.run('exchangeHideForResource(290001,1).reason'),'capacity');
  assert.equal(e.run('S.res.hide'),10);assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),1);
});
check('兑换和刷新写盘失败全额回滚兽皮、货位、物资、进度和次数',()=>{
  const e=environment();e.run('S.res.hide=10;S.beastExchange.hideOffers[290001].count=1;save()');
  const raw=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('exchangeHideForResource(290001,1).reason'),'save-failed');
  assert.equal(e.run('S.res.hide'),10);assert.equal(e.run('S.res.food'),300);
  assert.equal(e.run('S.beastExchange.progress'),0);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),1);
  assert.equal(e.run('refreshBeastExchange().reason'),'save-failed');
  assert.equal(e.run('S.beastExchange.refreshCharges'),5);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),1);
  assert.equal(e.store.get('rts_save'),raw);
});
check('旧v32同版迁移保原文与合法0，坏档／未来档只读',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));delete old.res.hide;delete old.beastExchange.hideOffers;
  old.res.bone=42;old.beastExchange.level=30;old.beastExchange.progress=165;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.hide'),0);assert.equal(e.run('S.res.bone'),42);
  assert.equal(e.run('S.beastExchange.progress'),165);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),0);
  const valid=JSON.parse(e.store.get('rts_save'));
  for(const mutate of [d=>d.res.hide=-1,d=>d.res.hide=0.5,d=>d.beastExchange.hideOffers[290001].count=-1,
    d=>d.beastExchange.hideOffers[290001].quality=42,d=>delete d.beastExchange.hideOffers[290001],d=>d.v=37]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===37?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});
check('迁移前原文副本失败，不把旧档写成新档',()=>{
  const seed=environment();seed.run('save()');
  const old=JSON.parse(seed.store.get('rts_save'));delete old.res.hide;delete old.beastExchange.hideOffers;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(e.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(e.store.get('rts_save'),raw);assert.equal(e.run('S.res.hide'),0);
});
check('P338真实付费档升级候选不追发兽皮，也不改兵力、骨与边贸等级',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json'),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.res.hide'),0);assert.equal(e.run('S.res.bone'),39);
  assert.equal(e.run('S.beastExchange.level'),30);assert.equal(e.run('S.beastExchange.progress'),165);
  assert.equal(e.run('armyCount()'),672);assert.equal(e.run('formSoldierCount()'),626);
  assert.equal(e.run('S.beastExchange.hideOffers[290001].count'),0);
});
check('历史兽皮若已超新基础上限，加载与再保存都保留原数',()=>{
  const seed=environment();seed.run('save()');
  const d=JSON.parse(seed.store.get('rts_save'));d.res.hide=12000;
  const e=environment({rts_save:JSON.stringify(d)});
  assert.equal(e.run('loadSaveAndApply().status'),'ok');
  assert.equal(e.run('S.res.hide'),12000);
  assert.equal(e.run('save().ok'),true);
  assert.equal(JSON.parse(e.store.get('rts_save')).res.hide,12000);
});
console.log(`beast exchange hide: ${passed}/10`);
