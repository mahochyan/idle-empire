'use strict';
// 从已实战取得郊野材料的存档，按真实刷新、交易和使用动作购买图纸；不预置库存。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const input=process.argv[2],output=process.argv[3],materialKey=process.argv[4]||'bullHorn';
assert.ok(input&&output,'用法：node probe-wild-scroll-p64.js 输入档 输出档 [材料key]');
const raw=fs.readFileSync(input,'utf8'),e=environment({rts_save:raw}),run=e.run;
const loaded=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loaded),'输入档无法安全加载');
if(loaded==='migrated')assert.equal(e.store.get('rts_save_premigration'),raw);
assert.ok(run('CFG.beastExchange.scrollMaterials').includes(materialKey),'材料不在六类图纸路径中');
assert.ok(run('S.beastExchange.level')>=30,'边贸行等级不足');
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const seed=seedArg?Number(seedArg.slice('--seed='.length)):9;
assert.ok(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff,'种子非法');
run(`globalThis.__wildSeed=${seed};Math.random=()=>{let x=__wildSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__wildSeed=x>>>0;return __wildSeed/4294967296}`);
const targetArg=process.argv.find(x=>x.startsWith('--target='));
const target=targetArg?Number(targetArg.slice('--target='.length)):5;
assert.ok(Number.isSafeInteger(target)&&target>=1&&target<=500,'图纸目标须为1～500');
const capBefore=run("resCap('tech')"),scrollBefore=run('S.beastExchange.scrollUsed'),stockBefore=run(`S.items.${materialKey}`),tickBefore=run('S.tick');
assert.ok(scrollBefore+target<=run('CFG.beastExchange.scrollUseLimit'),'图纸使用次数超上限');
assert.ok(stockBefore>=target*20,'实战材料不足以购买最低折扣图纸');
let refreshes=0,onlineWait=0,paid=0,gained=0,nonempty=0;
while(gained<target&&refreshes<120){
  if(run('S.beastExchange.refreshCharges')===0){
    const waited=run('(()=>{let n=0;while(S.beastExchange.refreshCharges<1&&n<CFG.beastExchange.refreshSeconds){tick();n++}return n})()');
    onlineWait+=waited;
    assert.ok(run('S.beastExchange.refreshCharges')>0,'在线恢复刷新次数失败');
  }
  const refreshed=run('refreshBeastExchange()');
  assert.equal(refreshed.ok,true,`刷新失败：${refreshed.reason}`);
  refreshes++;
  const offers=run(`beastScrollOfferCount('${materialKey}')`),cost=run(`beastScrollTradeCost('${materialKey}')`);
  if(offers>0)nonempty++;
  const take=Math.min(offers,target-gained,Math.floor(run(`S.items.${materialKey}`)/cost));
  if(take>0){
    const traded=run(`exchangeWildMaterialForScrolls('${materialKey}',${take})`);
    assert.equal(traded.ok,true,`实付失败：${traded.reason}`);
    gained+=take;paid+=traded.cost;
  }
}
assert.equal(gained,target,'120次刷新仍未能取得目标图纸');
assert.equal(run(`S.items.${materialKey}`),stockBefore-paid,'材料实扣不符');
const used=run(`useStorageScroll(${target})`);
assert.equal(used.ok,true,'使用图纸失败');
const final=JSON.parse(e.store.get('rts_save'));
assert.equal(final.v,29);
assert.equal(final.beastExchange.scrollUsed,scrollBefore+target);
const reloaded=environment({rts_save:JSON.stringify(final)});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run("resCap('tech')"),run("resCap('tech')"));
fs.writeFileSync(output,JSON.stringify(final),'utf8');
console.log(JSON.stringify({materialKey,seed,stockBefore,stockAfter:final.items[materialKey],refreshes,nonempty,onlineWait,paid,gained,
  scrollBefore,scrollAfter:final.beastExchange.scrollUsed,capBefore,capAfter:run("resCap('tech')"),tickBefore,tickAfter:final.tick},null,2));
