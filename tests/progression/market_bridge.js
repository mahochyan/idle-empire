'use strict';
// 早期地契补给：使用游戏真实建造、研究、分配、交易和保存动作。
const assert = require('node:assert/strict');
const {environment} = require('./harness');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+': '+e.message)}}
function readyMarket(e,advanced=false){
  e.run(`S.sciences=['sci_prospect','sci_coal','sci_copper'${advanced?",'sci_metal','sci_iron','sci_mint','sci_coin'":''}];S.buildings.market={lv:1,state:'idle'};S.res.wood=1000;S.res.coin=1000`);
}

test('交易动作必须经过科技、完工市场和价目阶段',()=>{
  const e=environment();
  e.run('S.res.wood=1000');
  const before=e.run('JSON.stringify(S.res)');
  assert.equal(e.run("exchangeResource('wood','coin',10).reason"),'market-locked');
  e.run("S.sciences=['sci_prospect','sci_coal','sci_copper'];S.buildings.market={lv:0,state:'building',timer:1,timerEnd:1}");
  assert.equal(e.run("exchangeResource('wood','coin',10).reason"),'market-locked');
  e.run("S.buildings.market={lv:1,state:'idle'}");
  assert.equal(e.run("marketAvailableRates().length"),4);
  assert.equal(e.run("exchangeResource('coin','wood',1).reason"),'rate-locked');
  assert.equal(e.run('JSON.stringify(S.res)'),before);
});

test('新档不打关卡可研究煤铜、产铜、经市场续供地契扩到9人上限',()=>{
  const e=environment();
  const state=JSON.parse(e.run(`JSON.stringify((()=>{
    buildAct('academy');
    for(let lv=0;lv<4;lv++)upgradeSettlement('village',lv);
    let expandedAt=null,marketAt=null,coalJobStarted=false;
    for(let t=1;t<=2500;t++){
      tick();
      if(t===10){setPopAlloc('food',1);setPopAlloc('tech',1)}
      if(t===20){setPopAlloc('wood',1);setPopAlloc('stone',1)}
      if(t===30)setPopAlloc('tech',3);
      if(t===40)setPopAlloc('tech',5);
      for(const id of ['sci_prospect','sci_coal','sci_copper']){
        if(!scienceUnlocked(id)&&S.res.tech>=activeSciences()[id].cost.tech)researchScience(id);
      }
      if(scienceUnlocked('sci_copper')&&bldSt('market').lv===0&&bldSt('market').state==='idle'){
        const built=buildAct('market');
        if(built.ok){
          setPopAlloc('tech',0);setPopAlloc('coal',2);setPopAlloc('copper',1);
          coalJobStarted=true;
        }
      }
      if(bldSt('market').lv>0&&marketAt===null){
        marketAt=t;setPopAlloc('tech',0);setPopAlloc('coal',0);setPopAlloc('copper',0);setPopAlloc('stone',0);setPopAlloc('wood',7);
      }
      if(marketAt!==null){
        if(S.res.coin<900&&S.res.wood>=1100)exchangeResource('wood','coin',1000);
        if(S.res.coin>=900){
          const buy=exchangeResource('coin','deed',900);
          if(buy.ok){upgradeSettlement('village',4);expandedAt=t;break}
        }
      }
    }
    return{expandedAt,marketAt,coalJobStarted,copper:S.res.copper,cap:maxPop(),people:popCurrent(),deed:S.res.deed,days:dailyCount('market'),coinScience:scienceUnlocked('sci_coin'),mint:bldSt('mint').lv,defeated:S.defeated.length};
  })())`));
  assert.ok(state.marketAt!==null,'未能建成早期市场');
  assert.equal(state.coalJobStarted,true,'市场建造期应派煤工和铜工');
  assert.ok(state.copper>0,'市场建造期应从零煤铜经真实岗位获得铜');
  assert.ok(state.expandedAt!==null,'未能在2500在线秒内续购地契并扩容');
  assert.equal(state.cap,9);
  assert.equal(state.people,8);
  assert.equal(state.deed,4);
  assert.equal(state.days,0);
  assert.equal(state.coinScience,false);
  assert.equal(state.mint,0);
  assert.equal(state.defeated,0);
});

test('基础供应链不限次，其他兑换仍按本地日界限5次',()=>{
  const e=environment();readyMarket(e,true);
  for(let i=0;i<5;i++)assert.equal(e.run("exchangeResource('coin','wood',1).ok"),true);
  assert.equal(e.run("exchangeResource('coin','wood',1).reason"),'daily-limit');
  assert.equal(e.run("dailyCount('market')"),5);
  assert.equal(e.run("exchangeResource('wood','coin',10).ok"),true);
  assert.equal(e.run("exchangeResource('coin','deed',100).ok"),true);
  assert.equal(e.run("dailyCount('market')"),5);
  e.run("S.daily.day='1900-01-01'");
  assert.equal(e.run("exchangeResource('coin','wood',1).ok"),true);
  assert.equal(e.run("dailyCount('market')"),1);
});

test('坏数量、来源不足与目标仓满均不扣资源',()=>{
  const e=environment();readyMarket(e);
  const before=e.run('JSON.stringify(S.res)');
  for(const qty of ['NaN','Infinity','0','-1','1.5'])
    assert.equal(e.run(`exchangeResource('wood','coin',${qty}).ok`),false,qty);
  assert.equal(e.run("exchangeResource('wood','coin',1001).ok"),false);
  e.run("S.res.coin=resCap('coin')");
  const full=e.run('JSON.stringify(S.res)');
  assert.equal(e.run("exchangeResource('wood','coin',10).reason"),'capacity');
  assert.equal(e.run('JSON.stringify(S.res)'),full);
  assert.equal(JSON.parse(before).wood,1000);
});

test('备份或主档写入失败时成交回滚，旧主档仍可导出',()=>{
  for(const key of ['rts_save_backup_1','rts_save']){
    const e=environment();readyMarket(e);e.run('save()');
    const master=e.store.get('rts_save');
    const before=e.run('JSON.stringify({res:S.res,daily:S.daily})');
    e.run(`const originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${key}')throw Error('quota');originalSet(k,v)}`);
    assert.equal(e.run("exchangeResource('wood','coin',100).reason"),'save-failed',key);
    assert.equal(e.run('JSON.stringify({res:S.res,daily:S.daily})'),before,key);
    assert.equal(e.store.get('rts_save'),master,key);
  }
});

test('所有现有兑换环路都无正收益',()=>{
  const e=environment();
  const rates=JSON.parse(e.run('JSON.stringify(CFG.market.rates)'));
  const graph=new Map();
  for(const r of rates){if(!graph.has(r.from))graph.set(r.from,[]);graph.get(r.from).push(r)}
  for(const start of graph.keys()){
    const walk=(at,product,seen)=>{
      for(const edge of graph.get(at)||[]){
        const next=product*edge.rate;
        if(edge.to===start)assert.ok(next<1-1e-9,`${start} 闭环收益 ${next}`);
        else if(!seen.has(edge.to)){seen.add(edge.to);walk(edge.to,next,seen);seen.delete(edge.to)}
      }
    };
    walk(start,1,new Set([start]));
  }
});

console.log(`${passed} passed / ${failed} failed`);
