'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json');
let passed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
function ready(){
  const e=environment();
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper','sci_silver','sci_mint','sci_coin','sci_electric_age'];S.buildings.market={lv:1,state:'idle'};S.res.silverCoin=10000;save()");
  return e;
}

check('母本银两200换勋章10；我方高级市场只在电力后显示',()=>{
  assert.deepEqual(source.ents[380023]['market:Need'],[160005,200]);
  assert.deepEqual(source.ents[380023]['market:Get'],[160010,10]);
  const e=ready();
  e.run("S.sciences=S.sciences.filter(x=>x!=='sci_electric_age')");
  assert.equal(e.run("marketAvailableRates().some(x=>x.from==='silverCoin'&&x.to==='medal')"),false);
  assert.equal(e.run("exchangeResource('silverCoin','medal',200).reason"),'rate-locked');
  assert.equal(e.run('S.res.silverCoin'),10000);
  e.run("S.sciences.push('sci_electric_age')");
  assert.equal(e.run("marketAvailableRates().some(x=>x.from==='silverCoin'&&x.to==='medal')"),true);
});

check('真实交易扣银两200、入勋章10、落v32档；旧战功和挑战威胁等级不动',()=>{
  const e=ready();
  assert.equal(e.run("exchangeResource('silverCoin','medal',200).get"),10);
  assert.equal(e.run('S.res.silverCoin'),9800);
  assert.equal(e.run('S.res.medal'),10);
  assert.equal(e.run('S.merit'),0);
  assert.equal(e.run('S.killValues.godSlaughter'),0);
  const saved=JSON.parse(e.store.get('rts_save'));
  1332;
  assert.equal(saved.res.silverCoin,9800);
  assert.equal(saved.res.medal,10);
  assert.equal(saved.daily.counts.market,1);
});

check('高级市场每日5次：第六次拒绝且不扣银两；大宗兑换按母本比例',()=>{
  const e=ready();
  for(let i=0;i<5;i++)assert.equal(e.run("exchangeResource('silverCoin','medal',200).ok"),true);
  assert.equal(e.run('S.res.medal'),50);
  assert.equal(e.run('S.res.silverCoin'),9000);
  assert.equal(e.run("exchangeResource('silverCoin','medal',200).reason"),'daily-limit');
  assert.equal(e.run('S.res.medal'),50);
  assert.equal(e.run('S.res.silverCoin'),9000);
  const bulk=ready();
  assert.equal(bulk.run("exchangeResource('silverCoin','medal',10000).get"),500);
  assert.equal(bulk.run('S.res.silverCoin'),0);
  assert.equal(bulk.run('S.res.medal'),500);
});

check('数量、银两、勋章仓和写档失败均安全拒绝或回滚',()=>{
  const e=ready();
  for(const qty of [0,19,-200,1.5,10001])assert.equal(e.run(`exchangeResource('silverCoin','medal',${qty}).ok`),false);
  assert.equal(e.run('S.res.silverCoin'),10000);
  assert.equal(e.run('S.res.medal'),0);
  e.run("S.res.medal=resCap('medal')");
  assert.equal(e.run("exchangeResource('silverCoin','medal',200).reason"),'capacity');
  e.run('S.res.medal=0');
  const old=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(e.run("exchangeResource('silverCoin','medal',200).reason"),'save-failed');
  assert.equal(e.run('S.res.silverCoin'),10000);
  assert.equal(e.run('S.res.medal'),0);
  assert.equal(e.run('S.daily.counts.market||0'),0);
  assert.equal(e.store.get('rts_save'),old);
});

console.log('medal market: '+passed+'/4');
