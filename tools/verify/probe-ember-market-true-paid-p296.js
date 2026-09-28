'use strict';
// Continue a paid save through actual god-domain wins, dynamic market refresh, and the source-priced ember purchase.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p295-aegis-elixir-paid-save.json',raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'5909b1e9fcab59140edb76bde9ce21736d387f4f0b73b384bf0076210d5b80d1');
const sourceData=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${sourceData.ts}+(S.tick-${sourceData.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const resourceSnapshot=()=>JSON.parse(run('JSON.stringify({food:S.res.food,gold:S.res.gold,goldCoin:S.res.goldCoin,tech:S.res.tech,copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})'));
const initial={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  aegis:run('S.items.aegisElixir'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),
  core:run('S.items.godCore'),marketCycles:run('S.marketSpecial.cycles'),marketClockSec:run('S.marketSpecial.clockSec'),
  tick:run('S.tick'),resources:resourceSnapshot()};
const battles=[];
for(let n=0;n<40&&run('S.items.sacredBlood')<20;n++){
  const before={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
    aegis:run('S.items.aegisElixir'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom')};
  run("openMaterialDomain('phantomFlower')");
  assert.equal(run('S.battleActive'),true,'phantom battle opens');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false,'phantom battle settles');
  const result=run("document.getElementById('battle-result').className");
  const after={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
    aegis:run('S.items.aegisElixir'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom')};
  battles.push({result,before,after,callbacks});
  assert.equal(result,'win',`battle ${n+1}`);
  assert.ok(after.blood>before.blood,'source blood grows after win');
  assert.equal(after.alert,before.alert+100);
  run('exitBattle()');
}
assert.ok(run('S.items.sacredBlood')>=20,'blood cost reachable');
const preMarket={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),
  cycles:run('S.marketSpecial.cycles'),clockSec:run('S.marketSpecial.clockSec')};
const marketCfg=JSON.parse(run('JSON.stringify(CFG.market.special)'));
const slotChance=marketCfg.weights.emberElixir/marketCfg.totalWeight;
const cycleChance=1-(1-slotChance)**marketCfg.slots;
const marketMath={slotChance,cycleChance,idealMeanWaitSec:marketCfg.refreshSec/cycleChance,
  idealMedianWaitSec:Math.ceil(Math.log(0.5)/Math.log(1-cycleChance))*marketCfg.refreshSec,
  chanceWithinTwoRefreshes:1-(1-cycleChance)**2};
run(`globalThis.__marketSeed=291;Math.random=()=>{let x=__marketSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__marketSeed=x>>>0;return __marketSeed/4294967296}`);
let elapsedSec=0,steps=0;
while(run('S.marketSpecial.offers.emberElixir')<1&&steps<5000){
  const advance=run('offlineAdvanceSec(60,1)');
  assert.equal(advance.elapsed,60,'market production minute completed');
  elapsedSec+=60;steps++;
}
assert.ok(run('S.marketSpecial.offers.emberElixir')>=1,'ember market offer reaches shelf');
const preBuy={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  offers:run('S.marketSpecial.offers.emberElixir'),cycles:run('S.marketSpecial.cycles'),
  clockSec:run('S.marketSpecial.clockSec')};
const bought=run("buyMarketSpecial('emberElixir')");
assert.equal(bought.ok,true,JSON.stringify(bought));
assert.equal(run('S.items.sacredBlood'),preBuy.blood-20);
assert.equal(run('S.items.emberElixir'),preBuy.ember+1);
assert.equal(run('S.marketSpecial.offers.emberElixir'),preBuy.offers-1);
const terminal={blood:run('S.items.sacredBlood'),ember:run('S.items.emberElixir'),
  aegis:run('S.items.aegisElixir'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom'),
  core:run('S.items.godCore'),market:JSON.parse(run('JSON.stringify(S.marketSpecial)')),
  tick:run('S.tick'),resources:resourceSnapshot()};
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.items.emberElixir'),terminal.ember);
assert.equal(reload.run('S.items.sacredBlood'),terminal.blood);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const savePath='p296-ember-market-true-paid-save.json',reportPath='p296-ember-market-true-paid-report.json';
const report={batch:'P296',kind:'fixed-stream real god-domain blood supply and paid ember market exchange',
  source,sourceSha256:sha(raw),battleRng:{kind:'continuous xorshift32',seed:1},marketRng:{kind:'xorshift32',seed:291},
  marketAdvance:{stepSec:60,ratio:1,elapsedSec,steps},marketMath,initial,battles,preMarket,preBuy,bought,terminal,
  savePath,saveSha256:sha(output)};
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({batch:report.batch,battles:battles.length,initial,preMarket,marketAdvance:report.marketAdvance,marketMath,
  preBuy,bought,terminal,saveSha256:report.saveSha256},null,2));
