'use strict';
// P81：从214人口实付档，仅用现存郊野材料逐笔购买机巧图纸；不预置折扣或素材。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const input=path.resolve(__dirname,'../../docs/codex/reports/data/p80-pop214-paid.json');
const outputArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const raw=fs.readFileSync(input,'utf8');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.beastExchange.scrollUsed'),80);
assert.equal(run('S.eraStorage.electricKnowledge'),16);
assert.equal(run('S.res.medal'),810836);
const before=run("({tick:S.tick,cap:resCap('tech'),tech:S.res.tech,used:S.beastExchange.scrollUsed,stock:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]]))})");
run('globalThis.__p81seed=9;Math.random=()=>{let x=__p81seed;x^=x<<13;x^=x>>>17;x^=x<<5;__p81seed=x>>>0;return __p81seed/4294967296}');
const targetArg=process.argv.find(x=>x.startsWith('--target='));
const target=targetArg?Number(targetArg.slice('--target='.length)):1;
const refreshArg=process.argv.find(x=>x.startsWith('--max-refreshes='));
const maxRefreshes=refreshArg?Number(refreshArg.slice('--max-refreshes='.length)):60;
assert.ok(Number.isSafeInteger(target)&&target>0&&target<=500);
assert.ok(Number.isSafeInteger(maxRefreshes)&&maxRefreshes>=0&&maxRefreshes<=200);
const keys=run('CFG.beastExchange.scrollMaterials');
let bought=0,refreshes=0,waited=0;
const purchases=[];
function buyOffered(){
  for(const key of keys){
    const price=run(`beastScrollTradeCost('${key}')`);
    const offers=run(`beastScrollOfferCount('${key}')`);
    const stock=run(`S.items.${key}`);
    const count=Math.min(target-bought,offers,Math.floor(stock/price));
    if(count<=0)continue;
    const trade=run(`exchangeWildMaterialForScrolls('${key}',${count})`);
    assert.equal(trade?.ok,true,`${key}: ${JSON.stringify(trade)}`);
    assert.equal(trade.cost,price*count);
    const used=run(`useStorageScroll(${count})`);
    assert.equal(used?.ok,true,`${key}: ${JSON.stringify(used)}`);
    purchases.push({key,count,cost:trade.cost,price});
    bought+=count;
    if(bought===target)return;
  }
}
buyOffered();
while(bought<target&&refreshes<maxRefreshes){
  if(run('S.beastExchange.refreshCharges')<1){
    const n=run('(()=>{let n=0;while(S.beastExchange.refreshCharges<1&&n<1200){tick();n++}return n})()');
    waited+=n;
    assert.ok(run('S.beastExchange.refreshCharges')>=1);
  }
  assert.equal(run('refreshBeastExchange()')?.ok,true);
  refreshes++;
  buyOffered();
}
assert.ok(bought>=1,'现存材料未买到图纸');
const after=run("({tick:S.tick,cap:resCap('tech'),tech:S.res.tech,used:S.beastExchange.scrollUsed,stock:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]]))})");
assert.equal(after.used-before.used,bought);
assert.ok(after.cap>before.cap);
for(const key of keys){
  const paid=purchases.filter(x=>x.key===key).reduce((n,x)=>n+x.cost,0);
  assert.equal(before.stock[key]-after.stock[key],paid);
}
assert.equal(run('S.res.medal'),810836);
assert.equal(run('S.items.guardianStone'),19);
const final=env.store.get('rts_save');
const check=environment({rts_save:final});
assert.equal(check.run('loadSaveAndApply().status'),'ok');
assert.equal(check.run("resCap('tech')"),after.cap);
if(outputArg)fs.writeFileSync(path.resolve(outputArg.slice('--snapshot-final='.length)),final);
console.log(JSON.stringify({unit:'simulated online seconds; resource units',before,after,bought,refreshes,waited,purchases,sha256:crypto.createHash('sha256').update(final).digest('hex')},null,2));
