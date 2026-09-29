'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const routeIds=[
  [550011,170002,290085,'bullHorn','wildBull'],[550021,170003,290086,'snakeGall','wildSnake'],
  [550031,170004,290087,'tigerPelt','wildTiger'],[550041,170005,290088,'turtleShell','wildTurtle'],
  [550051,170006,290089,'wyrmSinew','wildWyrm']
];
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
function battleEnv(){
  const e=environment();
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;
    S.selEnemy=0;S.buildings.barracks={lv:10,state:'idle'};
    S.formation={front:[{type:'alloy_special',count:100,id:101}],mid:[],back:[]};
  `);
  return e;
}
function flushBattle(e){
  for(let n=0;n<500&&e.run('S.battleActive');n++)assert.equal(e.run('__step()'),true,'战斗回调丢失');
  assert.equal(e.run('S.battleActive'),false,'战斗未结束');
}

check('母本其余五种普通猎场、材料和30级图纸各有一条源表对应',()=>{
  const e=environment();
  for(const [warId,dropId,shopId,key,killKey] of routeIds){
    assert.equal(source[warId]['smallWar:GetStuff'],dropId);
    assert.deepEqual(source[warId]['smallWar:Get'],[[160007,2],[160008,15]]);
    assert.deepEqual(source[shopId]['exchangeShop:Need'],[dropId,200]);
    assert.deepEqual(source[shopId]['exchangeShop:Get'],[180016,1]);
    assert.equal(source[shopId]['exchangeShop:Rate'],10);
    assert.equal(source[shopId]['exchangeShop:ExchangeLv'],30);
    assert.equal(e.run(`materialDomainEncounter('${key}',0).reward.bone`),15);
    assert.equal(e.run(`S.killValues.${killKey}`),0);
  }
});

check('五条猎场真实胜利分别入材料与警戒值，重复结算无额外奖励',()=>{
  for(const [, , ,key,killKey] of routeIds){
    const e=battleEnv();
    e.run(`openMaterialDomain('${key}')`);
    assert.equal(e.run('S.battleActive'),true);
    flushBattle(e);
    assert.equal(e.run(`S.items.${key}`),1,key);
    assert.equal(e.run(`S.killValues.${killKey}`),10,key);
    assert.equal(e.run('S.res.bone'),15,key);
    assert.equal(e.run('S.killValues.wildBoar'),0,key);
    e.run("endBattle('win')");
    assert.equal(e.run(`S.items.${key}`),1,key);
    const restored=environment({rts_save:e.store.get('rts_save')});
    assert.equal(restored.run('loadSaveAndApply().status'),'ok');
    assert.equal(restored.run(`S.items.${key}`),1,key);
  }
});

check('新增猎场结算写档失败回滚兽骨、掉落材料和独立警戒值',()=>{
  const e=battleEnv();
  e.run("openMaterialDomain('bullHorn')");
  e.run("localStorage.setItem=key=>{if(key==='rts_save')throw Error('quota')}");
  flushBattle(e);
  assert.equal(e.run('S.res.bone'),0);
  assert.equal(e.run('S.items.bullHorn'),0);
  assert.equal(e.run('S.killValues.wildBull'),0);
});

check('刷新六类共享母本总权重，各自库存和品质分开，交易只消耗所选材料',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;S.items.bullHorn=500;Math.random=()=>0.025');
  assert.equal(e.run("exchangeWildMaterialForScrolls('bullHorn',1).reason"),'not-offered');
  assert.equal(e.run('refreshBeastExchange().offers'),11);
  assert.equal(e.run('S.beastExchange.heartOffers'),0);
  assert.equal(e.run('S.beastExchange.wildOffers.bullHorn.count'),11);
  assert.equal(e.run('S.beastExchange.wildOffers.bullHorn.quality'),50);
  assert.equal(e.run("beastScrollTradeCost('bullHorn')"),100);
  assert.equal(e.run("exchangeWildMaterialForScrolls('bullHorn',2).ok"),true);
  assert.equal(e.run('S.items.bullHorn'),300);
  assert.equal(e.run('S.items.boarHeart'),0);
  assert.equal(e.run('S.beastExchange.wildOffers.bullHorn.count'),9);
  assert.equal(e.run('S.items.storageScroll'),2);
  const restored=environment({rts_save:e.store.get('rts_save')});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.beastExchange.wildOffers.bullHorn.count'),9);
  assert.equal(restored.run('S.items.bullHorn'),300);
});

check('其它材料兑换与刷新保存失败均回滚，非法材料不能触及库存',()=>{
  const e=environment();
  e.run('S.beastExchange.level=30;S.items.bullHorn=500;S.beastExchange.wildOffers.bullHorn.count=2;save()');
  const raw=e.store.get('rts_save');
  e.run("localStorage.setItem=key=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run("exchangeWildMaterialForScrolls('bullHorn',1).reason"),'save-failed');
  assert.equal(e.run('S.items.bullHorn'),500);
  assert.equal(e.run('S.beastExchange.wildOffers.bullHorn.count'),2);
  assert.equal(e.run("exchangeWildMaterialForScrolls('unknown',1).reason"),'invalid-material');
  e.run('Math.random=()=>0.025');
  assert.equal(e.run('refreshBeastExchange().reason'),'save-failed');
  assert.equal(e.run('S.beastExchange.wildOffers.bullHorn.count'),2);
  assert.equal(e.store.get('rts_save'),raw);
});

check('v28原文先保护后补五种库存与警戒值，v34坏字段和未来v35阻止写回',()=>{
  const seed=environment();
  const raw=seed.run('(()=>{S.items.boarHeart=25;S.beastExchange.level=30;S.beastExchange.scrollUsed=5;S.beastExchange.heartOffers=2;S.beastExchange.heartQuality=80;S.beastExchange.refreshClock=777;S.beastExchange.refreshCharges=1;const d=serializeSave();d.v=28;for(const key of CFG.beastExchange.scrollMaterials.slice(1))delete d.items[key];for(const key of ["wildBull","wildSnake","wildTiger","wildTurtle","wildWyrm"])delete d.killValues[key];delete d.beastExchange.wildOffers;return JSON.stringify(d)})()');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.boarHeart'),25);
  assert.equal(e.run('S.beastExchange.scrollUsed'),5);
  assert.equal(e.run('S.beastExchange.heartOffers'),2);
  assert.equal(e.run('S.beastExchange.heartQuality'),80);
  assert.equal(e.run('S.beastExchange.refreshClock'),777);
  assert.equal(e.run('S.beastExchange.refreshCharges'),1);
  for(const [, , ,key,killKey] of routeIds){assert.equal(e.run(`S.items.${key}`),0);assert.equal(e.run(`S.killValues.${killKey}`),0)}
  const valid=JSON.parse(e.store.get('rts_save'));assert.equal(valid.v,34);
  for(const mutate of [d=>delete d.items.bullHorn,d=>d.killValues.wildSnake=-1,d=>delete d.beastExchange.wildOffers.tigerPelt,d=>d.beastExchange.wildOffers.wyrmSinew.count=15,d=>d.beastExchange.wildOffers.bullHorn.quality=42,d=>d.v=35]){
    const d=structuredClone(valid);mutate(d);const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===35?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

console.log(`wild scroll routes: ${passed}/6`);
