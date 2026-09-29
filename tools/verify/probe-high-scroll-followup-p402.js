'use strict';
// Continue the exact P402 RNG stream and paid v35 save for 20 additional refreshes.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const base='docs/codex/reports/data/';
const prior=JSON.parse(fs.readFileSync(path.join(root,base+'p402-high-scroll-natural.json'),'utf8'));
const raw=fs.readFileSync(path.join(root,base+'p402-high-scroll-natural-save.json'),'utf8');
const original=JSON.parse(raw);
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
for(const [file,hash] of Object.entries(prior.codeSha256))
  assert.equal(sha256(fs.readFileSync(path.join(root,file),'utf8')),hash,
    'follow-up must use exactly the same gameplay implementation as the first session');
assert.equal(sha256(raw),prior.finalSaveSha256);
assert.equal(original.ts,prior.final.clockMs);
const env=environment({rts_save:raw}),run=env.run;
run(`globalThis.__clockMs=${original.ts};globalThis.__OriginalDate=Date;
  globalThis.Date=class extends __OriginalDate {static now(){return __clockMs}};
  globalThis.__rng=${prior.final.rng};globalThis.__rngDraws=0;
  Math.random=()=>{__rngDraws++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
const loadStatus=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(loadStatus));
if(loadStatus==='migrated')assert.equal(env.store.get('rts_save_premigration'),raw);
const snap=()=>JSON.parse(JSON.stringify(run(`({tick:S.tick,clockMs:Date.now(),army:armyCount(),
  knowledgeCap:resCap('tech'),market:{level:S.beastExchange.level,charges:S.beastExchange.refreshCharges,
    refreshClock:S.beastExchange.refreshClock,usedTiers:{...S.beastExchange.scrollUsedTiers}},
  scrolls:Object.fromEntries([1,2,3,4,5].map(t=>[t,S.items[t===1?'storageScroll':'storageScroll'+t]])),
  materials:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  offers:{heart:S.beastExchange.heartOffers,heartQuality:S.beastExchange.heartQuality,
    wild:JSON.parse(JSON.stringify(S.beastExchange.wildOffers)),tiers:JSON.parse(JSON.stringify(S.beastExchange.tierOffers))},
  rng:__rng,draws:__rngDraws})`)));
const start=snap(),ledger=[];
let acquired=false,onlineSeconds=0,refreshes=0;
while(!acquired&&refreshes<20){
  let waitSeconds=0;
  while(run('S.beastExchange.refreshCharges')===0&&waitSeconds<1200){run('__clockMs+=1000;tick()');waitSeconds++}
  onlineSeconds+=waitSeconds;
  assert.ok(run('S.beastExchange.refreshCharges')>0);
  const before=snap(),refresh=run('refreshBeastExchange()');
  assert.equal(refresh.ok,true);
  refreshes++;
  const offers=snap().offers,purchases=[];
  for(const material of run('([...CFG.beastExchange.scrollMaterials])')){
    while(run(`beastScrollOfferCount('${material}')`)>0){
      const unitCost=run(`beastScrollTradeCost('${material}')`);
      if(run(`S.items.${material}`)<unitCost)break;
      const action=run(`exchangeWildMaterialForScrolls('${material}',1)`);
      assert.equal(action.ok,true,JSON.stringify(action));
      purchases.push({kind:'first',material,unitCost,action:JSON.parse(JSON.stringify(action))});
    }
  }
  for(const tier of [5,4,3,2]){
    if(run(`S.beastExchange.tierOffers[${tier}].count`)<1)continue;
    const unitCost=run(`beastTierScrollTradeCost(${tier})`);
    if(run('S.items.storageScroll')<unitCost)continue;
    const action=run(`exchangeTierScroll(${tier},1)`);
    assert.equal(action.ok,true,JSON.stringify(action));
    const use=run(`useTierStorageScroll(${tier},1)`);
    assert.equal(use.ok,true,JSON.stringify(use));
    purchases.push({kind:'tier',tier,unitCost,action:JSON.parse(JSON.stringify(action))},
      {kind:'use',tier,action:JSON.parse(JSON.stringify(use))});
    acquired=true;break;
  }
  ledger.push({refresh:refreshes,waitSeconds,before,offers,purchases,after:snap()});
}
const final=snap();
const gateBefore=run(`({knowledge:S.res.tech,knowledgeCap:resCap('tech'),revivalLeaf:S.items.revivalLeaf,
  quantumKnowledgeLevel:S.eraStorage.quantumKnowledge,nextCost:eraStorageCost('quantumKnowledge'),
  techRate:prodRate('tech')})`);
const beforeAttemptSave=env.store.get('rts_save');
const gateAttempt=run("upgradeEraStorage('quantumKnowledge')");
assert.equal(gateAttempt.ok,false);
assert.equal(env.store.get('rts_save'),beforeAttemptSave,'rejected upgrade must not write save');
const gateAfter=run(`({knowledge:S.res.tech,knowledgeCap:resCap('tech'),revivalLeaf:S.items.revivalLeaf,
  quantumKnowledgeLevel:S.eraStorage.quantumKnowledge})`);
assert.equal(gateAfter.knowledge,gateBefore.knowledge);
assert.equal(gateAfter.revivalLeaf,gateBefore.revivalLeaf);
assert.equal(gateAfter.quantumKnowledgeLevel,gateBefore.quantumKnowledgeLevel);
const gate={before:JSON.parse(JSON.stringify(gateBefore)),attempt:JSON.parse(JSON.stringify(gateAttempt)),
  after:JSON.parse(JSON.stringify(gateAfter))};
const nextLeafEncounter=JSON.parse(JSON.stringify(run(`(()=>{const e=materialDomainEncounter('revivalLeaf');
  return{killValue:e.killValue,nextKillValue:e.nextKillValue,units:e.units,bossMult:e.bossMult,reward:e.reward}})()`)));
const saved=env.store.get('rts_save'),parsed=JSON.parse(saved);
assert.equal(parsed.v,run('targetSaveVersion()'));
for(const tier of [2,3,4,5])assert.equal(parsed.beastExchange.scrollUsedTiers[tier],final.market.usedTiers[tier]);
const reload=environment({rts_save:saved});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),final.knowledgeCap);
assert.equal(sha256(fs.readFileSync(path.join(root,base+'p402-high-scroll-natural-save.json'),'utf8')),sha256(raw));
const report={baselineHead:'ba112c4224c13b8898a525abe5c559377a9fca52',loadStatus,
  source:base+'p402-high-scroll-natural-save.json',sourceSha256:sha256(raw),seed:402,
  rngContinuesFrom:prior.final.rng,random:'same xorshift32 stream, no seed search',
  policy:'20 more real refreshes at most; buy affordable I-scroll offers then highest affordable II–V; no further hunt or recruitment',
  units:'game resources and items; tick and onlineSeconds in seconds; clockMs in milliseconds',
  start,refreshes,onlineSeconds,acquired,ledger,final,gate,nextLeafEncounter,finalSaveSha256:sha256(saved),reloaded:true};
fs.writeFileSync(path.join(root,base+'p402-high-scroll-followup.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,base+'p402-high-scroll-followup-save.json'),saved);
console.log(JSON.stringify({refreshes,onlineSeconds,acquired,start:{scrolls:start.scrolls,materials:start.materials,cap:start.knowledgeCap},
  purchases:ledger.flatMap(x=>x.purchases),final:{scrolls:final.scrolls,usedTiers:final.market.usedTiers,
    materials:final.materials,cap:final.knowledgeCap,army:final.army,charges:final.market.charges},
  gate,nextLeafEncounter,finalSaveSha256:report.finalSaveSha256,reloaded:true},null,2));
