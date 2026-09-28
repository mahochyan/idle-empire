'use strict';
// Spend only real stocked wild materials against real exchange offers after the paid Wyrm run.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const tiger=process.argv.includes('--tiger');
const sourceFile=tiger?'docs/codex/reports/data/p270-nuclear-scroll-hunt-tigerPelt-last-recovered-save.json':'docs/codex/reports/data/p270-nuclear-scroll-hunt-last-recovered-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run('globalThis.__rng=13;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}');
const initial=run("({tick:S.tick,army:armyCount(),food:S.res.food,tech:S.res.tech,cap:resCap('tech'),scrollUsed:S.beastExchange.scrollUsed,items:{...S.items},charges:S.beastExchange.refreshCharges,clock:S.beastExchange.refreshClock})");
assert.equal(initial.army,516);assert.equal(initial.scrollUsed,tiger?88:83);
const materialKeys=run('CFG.beastExchange.scrollMaterials.slice()');
let elapsed=0,minFood=initial.food,purchased=0;
const rows=[];
for(let refresh=1;refresh<=60&&run("resCap('tech')")<100000000;refresh++){
  let waited=0;
  if(run('S.beastExchange.refreshCharges')<1){
    const result=run("(()=>{let n=0,min=S.res.food;while(S.beastExchange.refreshCharges<1&&n<1500){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:S.beastExchange.refreshCharges>=1}})()");
    assert.equal(result.done,true);assert.ok(result.min>0);waited=result.n;elapsed+=waited;minFood=Math.min(minFood,result.min);
  }
  const changed=run('refreshBeastExchange()');assert.equal(changed?.ok,true);
  const trades=[];
  for(const key of materialKeys){
    const offered=run(`beastScrollOfferCount('${key}')`),costEach=run(`beastScrollTradeCost('${key}')`),stockBefore=run(`S.items.${key}`);
    const qty=Math.min(offered,Math.floor(stockBefore/costEach),500-run('S.beastExchange.scrollUsed'));
    if(qty<1)continue;
    const trade=run(`exchangeWildMaterialForScrolls('${key}',${qty})`);assert.equal(trade?.ok,true);
    const used=run(`useStorageScroll(${qty})`);assert.equal(used?.ok,true);
    trades.push({key,qty,costEach,stockBefore});purchased+=qty;
  }
  rows.push({refresh,waited,elapsedOnlineSec:elapsed,offered:changed.offers,trades,scrollUsed:run('S.beastExchange.scrollUsed'),cap:run("resCap('tech')")});
}
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
const final=run("({tick:S.tick,army:armyCount(),food:S.res.food,tech:S.res.tech,cap:resCap('tech'),scrollUsed:S.beastExchange.scrollUsed,items:{...S.items},charges:S.beastExchange.refreshCharges,clock:S.beastExchange.refreshClock})");
assert.equal(final.army,initial.army);assert.equal(final.scrollUsed,initial.scrollUsed+purchased);assert.equal(final.cap,reload.run("resCap('tech')"));
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const suffix=tiger?'-tiger':'';
const saveFile=`docs/codex/reports/data/p270-nuclear-scroll-exchange${suffix}-save.json`;
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P270',sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds and resource units',initial,rows,purchased,elapsedOnlineSec:elapsed,minFood,final,saveFile,saveSha256:sha(finalRaw)};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/p270-nuclear-scroll-exchange${suffix}.json`),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({initial,purchased,refreshes:rows.length,elapsedOnlineSec:elapsed,minFood,final,saveFile}));
