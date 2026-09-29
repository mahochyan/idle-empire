'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}

check('60级丹药换石与母本交易所成本、收益、权重一致',()=>{
  const e=environment();
  for(const [key,id,cost,gain] of [['emberElixir',290098,10,4],['aegisElixir',290099,10,12]]){
    const entry=source[id],cfg=e.run(`CFG.beastExchange.soulTrades.${key}`);
    assert.deepEqual(entry['exchangeShop:Need'],[key==='emberElixir'?180002:180003,cost]);
    assert.deepEqual(entry['exchangeShop:Get'],[170091,gain]);
    assert.equal(entry['exchangeShop:ExchangeLv'],60);
    assert.equal(entry['exchangeShop:Rate'],30);
    assert.equal(cfg.sourceId,id);assert.equal(cfg.cost,cost);assert.equal(cfg.stones,gain);assert.equal(cfg.weight,30);
  }
  assert.equal(e.run('beastOfferTotalWeight(60)'),680);
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'level');
  e.run('S.beastExchange.level=59;Math.random=()=>65.5/570');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),0);
  assert.equal(e.run('S.beastExchange.soulOffers.aegisElixir'),0);
});

check('刷新只在60级后抽出两种铭石货位，真扣材料和货位并可重载',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.items.emberElixir=20;S.items.aegisElixir=10;S.items.soulStone=79;Math.random=()=>61.5/680');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),14);
  assert.equal(e.run('S.beastExchange.soulOffers.aegisElixir'),0);
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",2).ok'),true);
  assert.equal(e.run('S.items.emberElixir'),0);
  assert.equal(e.run('S.items.soulStone'),87);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),12);
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'insufficient-material');
  e.run('Math.random=()=>91.5/680');
  assert.equal(e.run('refreshBeastExchange().ok'),true);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),0);
  assert.equal(e.run('S.beastExchange.soulOffers.aegisElixir'),14);
  assert.equal(e.run('exchangeSoulElixirForStones("aegisElixir",1).ok'),true);
  assert.equal(e.run('S.items.aegisElixir'),0);
  assert.equal(e.run('S.items.soulStone'),99);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),99);
  assert.equal(reload.run('S.beastExchange.soulOffers.aegisElixir'),13);
});

check('数量、上架、库存、容量及重复调用都在动作函数校验',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.items.emberElixir=20;S.beastExchange.soulOffers.emberElixir=1;S.items.soulStone=79');
  for(const count of [0,-1,1.5,NaN,Infinity])assert.equal(e.run(`exchangeSoulElixirForStones('emberElixir',${count}).reason`),'invalid-quantity');
  assert.equal(e.run('exchangeSoulElixirForStones("notReal",1).reason'),'invalid-material');
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",2).reason'),'not-offered');
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).ok'),true);
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'not-offered');
  assert.equal(e.run('S.items.emberElixir'),10);assert.equal(e.run('S.items.soulStone'),83);
  e.run('S.beastExchange.soulOffers.emberElixir=1;S.items.soulStone=CFG.eraMaterials.soulStone.max-2');
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'capacity');
  assert.equal(e.run('S.items.emberElixir'),10);
});

check('写盘失败全额回滚材料、铭石、货位与交易进度',()=>{
  const e=environment();
  e.run('S.beastExchange.level=60;S.items.emberElixir=10;S.items.soulStone=79;S.beastExchange.soulOffers.emberElixir=1;save()');
  const raw=e.store.get('rts_save'),before=e.run('S.beastExchange.progress');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'save-failed');
  assert.equal(e.run('S.items.emberElixir'),10);assert.equal(e.run('S.items.soulStone'),79);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),1);
  assert.equal(e.run('S.beastExchange.progress'),before);
  assert.equal(e.store.get('rts_save'),raw);
});

check('旧v32候选迁移保原文和合法0，损坏与未来存档拒载保护',()=>{
  const seed=environment();
  const old=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
  delete old.beastExchange.soulOffers;old.items.soulStone=79;old.beastExchange.level=60;
  const raw=JSON.stringify(old),e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),0);
  assert.equal(e.run('S.items.soulStone'),79);
  for(const mutate of [d=>d.beastExchange.soulOffers.emberElixir=-1,
    d=>d.beastExchange.soulOffers.aegisElixir=15,
    d=>d.beastExchange.soulOffers.other=1,
    d=>d.beastExchange.level=59,
    d=>d.v=34]){
    const d=JSON.parse(e.store.get('rts_save'));mutate(d);
    if(d.beastExchange.level===59)d.beastExchange.soulOffers.aegisElixir=1;
    const text=JSON.stringify(d),bad=environment({rts_save:text});
    assert.equal(bad.run('loadSaveAndApply().status'),d.v===34?'future':'invalid');
    bad.run('tick();save()');assert.equal(bad.store.get('rts_save'),text);
  }
});

check('P335真实付费检查点升级候选不改铭石、警戒或兵力',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p335-soul-alert7050-full-save.json'),'utf8');
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(e.run('S.items.soulStone'),79);
  assert.equal(e.run('S.killValues.soulRealm'),7050);
  assert.equal(e.run('armyCount()'),672);
  assert.equal(e.run('S.beastExchange.level'),30);
  assert.equal(e.run('S.beastExchange.soulOffers.emberElixir'),0);
  assert.equal(e.run('S.beastExchange.soulOffers.aegisElixir'),0);
  assert.equal(e.run('exchangeSoulElixirForStones("emberElixir",1).reason'),'level');
});

console.log(`beast exchange soul: ${passed}/6`);
