'use strict';
// Continue the pre-P291 paid nano-11 save. God-domain wins pay the newly restored source blood drop.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p290-second-core-nano11-paid-save.json',sourceRaw=fs.readFileSync(path.join(data,source),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(sourceRaw),'e656589c007c1b48a68503567ef43ae65e17e4c8884b27d2841fe7750d920d06');
const e=environment({rts_save:sourceRaw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.items.sacredBlood'),0);
assert.equal(run('S.items.domainCleanser'),0);
assert.equal(run('S.killValues.godPhantom'),0);
const initial={blood:run('S.items.sacredBlood'),cleanser:run('S.items.domainCleanser'),coin:run('S.res.goldCoin'),
  soldiers:run('formSoldierCount()'),phantomAlert:run('S.killValues.godPhantom'),core:run('S.items.godCore')};
const startTick=run('S.tick'),startTs=JSON.parse(sourceRaw).ts;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${startTs}+(S.tick-${startTick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));`);
const battles=[];
for(let n=0;n<3;n++){
  run('globalThis.__battleSeed=1;Math.random=()=>{let x=__battleSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__battleSeed=x>>>0;return __battleSeed/4294967296}');
  const before={blood:run('S.items.sacredBlood'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom')};
  run("openMaterialDomain('phantomFlower')");
  assert.equal(run('S.battleActive'),true,'phantom battle opens');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false,'phantom battle settles');
  const after={blood:run('S.items.sacredBlood'),soldiers:run('formSoldierCount()'),alert:run('S.killValues.godPhantom')};
  const result=run("document.getElementById('battle-result').className");
  battles.push({before,after,result,callbacks});
  assert.equal(result,'win');
  assert.equal(after.blood,before.blood+1);
  assert.equal(after.alert,before.alert+100);
  if(n<2)run('exitBattle()');
}
assert.equal(run('S.items.sacredBlood'),3);
run('exitBattle()');
run(`globalThis.__marketSeed=291;Math.random=()=>{let x=__marketSeed;x^=x<<13;x^=x>>>17;x^=x<<5;__marketSeed=x>>>0;return __marketSeed/4294967296}`);
let elapsed=0,cycles=0,offerSeen=false;
for(let i=0;i<5000;i++){
  if(run('S.marketSpecial.offers.domainCleanser')>0){offerSeen=true;break}
  const advance=run('offlineAdvanceSec(60,1)');
  assert.equal(advance.elapsed,60,'market food clamp');
  elapsed+=60;
  cycles=run('S.marketSpecial.cycles');
}
assert.equal(offerSeen,true,'cleanser offer eventually arrives');
const purchased=run("buyMarketSpecial('domainCleanser')");
assert.equal(purchased?.ok,true,JSON.stringify(purchased));
assert.equal(run('S.items.domainCleanser'),1);
assert.equal(run('S.items.sacredBlood'),0);
assert.equal(run('S.res.goldCoin')>=initial.coin,true,'no gold coin spent on blood');
assert.equal(run('save().ok'),true);
const terminal={blood:run('S.items.sacredBlood'),cleanser:run('S.items.domainCleanser'),coin:run('S.res.goldCoin'),
  soldiers:run('formSoldierCount()'),phantomAlert:run('S.killValues.godPhantom'),core:run('S.items.godCore'),market:JSON.parse(run('JSON.stringify(S.marketSpecial)'))};
const output=e.store.get('rts_save'),reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.items.domainCleanser'),1);
assert.equal(reload.run('S.items.sacredBlood'),0);
assert.equal(hash(fs.readFileSync(path.join(data,source),'utf8')),hash(sourceRaw));
const savePath='p291-god-blood-cleanser-paid-save.json',reportPath='p291-god-blood-cleanser-paid-report.json';
const report={batch:'P291',kind:'three real source-blood god wins, paid cleanser from blood without gold-coin purchases',
  source,sourceSha256:hash(sourceRaw),initial,battles,market:{elapsedSec:elapsed,cycles,offerSeen,ratio:1},terminal,
  savePath,saveSha256:hash(output)};
fs.writeFileSync(path.join(data,savePath),output,'utf8');
fs.writeFileSync(path.join(data,reportPath),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
