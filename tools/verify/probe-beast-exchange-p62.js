'use strict';
// 真实旧档只读输入：逐级执行边贸行兑换，校验每笔费用及迁移保护。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const input=process.argv[2],output=process.argv[3];
assert.ok(input&&output,'用法：node probe-beast-exchange-p62.js 输入档 输出档');
const raw=fs.readFileSync(input,'utf8'),e=environment({rts_save:raw});
const loadStatus=e.run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loadStatus));
if(loadStatus==='migrated')assert.equal(e.store.get('rts_save_premigration'),raw);
const start=e.run('({version:targetSaveVersion(),bone:S.res.bone,medal:S.res.medal,kill:S.killValues.wildBoar,heart:S.items.boarHeart,scroll:S.items.storageScroll})');
let trades=0,boneCost=0,medalGain=0;
for(let lv=1;lv<30;lv++){
  assert.equal(e.run('S.beastExchange.level'),lv);
  const need=e.run('beastExchangeProgressNeed(S.beastExchange.level)');
  const cost=e.run('beastBoneTradeCost()'),reward=e.run('beastBoneTradeReward()');
  const result=e.run(`exchangeBonesForMedals(${need})`);
  assert.equal(result.ok,true,`边贸行 ${lv} 级实付失败：${result.reason}`);
  assert.equal(result.boneCost,need*cost);
  assert.equal(result.medalGain,need*reward);
  const upgraded=e.run('upgradeBeastExchange()');
  assert.equal(upgraded.ok,true,`边贸行 ${lv} 升级失败：${upgraded.reason}`);
  trades+=need;boneCost+=need*cost;medalGain+=need*reward;
}
const capBefore=e.run('resCap("tech")');
let scrollTrade=null,scrollUse=null,refreshes=[],waitedOnlineSec=0;
if(process.argv.includes('--consume-scrolls')){
  const seedArg=process.argv.find(x=>x.startsWith('--seed='));
  const seed=seedArg?Number(seedArg.slice('--seed='.length)):9;
  assert.ok(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff);
  e.run(`globalThis.__beastSeed=${seed};Math.random=()=>{let x=__beastSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__beastSeed=x>>>0;return __beastSeed/4294967296}`);
  const target=5;
  assert.ok(e.run('S.items.boarHeart')>=target*20,'真实档兽心不足，不能兑换五份最低价图纸');
  while(e.run('S.items.storageScroll')<target&&refreshes.length<100){
    if(e.run('S.beastExchange.refreshCharges')===0){
      const waited=e.run('(()=>{let n=0;while(S.beastExchange.refreshCharges<1&&n<CFG.beastExchange.refreshSeconds){tick();n++}return n})()');
      waitedOnlineSec+=waited;
      assert.ok(e.run('S.beastExchange.refreshCharges')>0,'刷新次数未按在线秒恢复');
    }
    const refreshed=e.run('refreshBeastExchange()');
    assert.equal(refreshed.ok,true);
    const offers=e.run('S.beastExchange.heartOffers'),quality=e.run('S.beastExchange.heartQuality'),cost=e.run('beastHeartTradeCost()');
    const take=Math.min(offers,target-e.run('S.items.storageScroll'),Math.floor(e.run('S.items.boarHeart')/cost));
    if(take>0){
      const trade=e.run(`exchangeHeartsForScrolls(${take})`);
      assert.equal(trade.ok,true);
      refreshes.push({offers,quality,cost,paid:trade.cost,got:take});
    }else refreshes.push({offers,quality,cost,paid:0,got:0});
  }
  assert.equal(e.run('S.items.storageScroll'),target,'一百次刷新内仍不足五份图纸');
  scrollTrade={ok:true,cost:refreshes.reduce((n,row)=>n+row.paid,0),scrollGain:target};
  scrollUse=e.run(`useStorageScroll(${target})`);
  assert.equal(scrollUse.ok,true,'卷轴使用失败');
}
const final=JSON.parse(e.store.get('rts_save'));
assert.equal(final.v,29);
assert.equal(final.beastExchange.level,30);
assert.equal(final.res.bone,start.bone-boneCost);
assert.equal(final.res.medal,start.medal+medalGain);
assert.equal(final.killValues.wildBoar,start.kill);
const reload=environment({rts_save:JSON.stringify(final)});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.beastExchange.level'),30);
assert.equal(reload.run('resCap("tech")'),e.run('resCap("tech")'));
fs.writeFileSync(output,JSON.stringify(final),'utf8');
console.log(JSON.stringify({start,trades,boneCost,medalGain,refreshes,waitedOnlineSec,scrollTrade,scrollUse,capBefore,capAfter:e.run('resCap("tech")'),finish:{tick:final.tick,bone:final.res.bone,medal:final.res.medal,level:final.beastExchange.level,heart:final.items.boarHeart,scroll:final.items.storageScroll,scrollUsed:final.beastExchange.scrollUsed}},null,2));
