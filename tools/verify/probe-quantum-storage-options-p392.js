'use strict';
// Conditional warehouse search from a real paid save. Analytic candidates are checked by resCap().
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source=path.join(root,'docs/codex/reports/data/p390-star-array-entry-paid-save.json');
const env=environment({rts_save:fs.readFileSync(source,'utf8')});
const run=env.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply()').status));
const current=run(`({steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
  nuclear:S.eraStorage.nuclearKnowledge,scrolls:S.beastExchange.scrollUsed,
  crystal:S.items.godCrystal,guardian:S.items.guardianStone,leaf:S.items.revivalLeaf,
  starPercent:starArrayKnowledgePercent(),cap:resCap('tech')})`);
assert.equal(current.starPercent,0);
const base=run(`S.eraStorage.steamKnowledge=0;S.eraStorage.electricKnowledge=0;
  S.eraStorage.nuclearKnowledge=0;S.beastExchange.scrollUsed=0;resCap('tech')`);
const cfg=run(`({steam:CFG.eraStorage.steamKnowledge,electric:CFG.eraStorage.electricKnowledge,
  nuclear:CFG.eraStorage.nuclearKnowledge,scroll:CFG.beastExchange.scrollCapacityPerUse})`);
function cap(s,e,n){
  let c=base;
  for(const l of [s,e,n])c=Math.floor(c*(1+l*0.1));
  return Math.floor(c*(1+current.scrolls*cfg.scroll));
}
assert.equal(cap(current.steam,current.electric,current.nuclear),current.cap);
const sum=(from,to)=>to<from?0:(from+to)*(to-from+1)/2;
const target=3_000_000_000;
let best=null,checked=0;
const buckets=new Map();
for(let s=current.steam;s<=cfg.steam.maxLevel;s++)
  for(let e=current.electric;e<=cfg.electric.maxLevel;e++)
    for(let n=current.nuclear;n<=cfg.nuclear.maxLevel;n++){
      if(cap(s,e,n)<target)continue;
      checked++;
      const tech=cfg.steam.techBase*sum(current.steam+1,s)+
        cfg.electric.techBase*sum(current.electric+1,e)+
        cfg.nuclear.techBase*sum(current.nuclear+1,n);
      const crystal=(cfg.steam.lateCrystalBase??cfg.steam.lateMaterialBase)*sum(current.steam+1,s);
      const guardian=cfg.electric.lateMaterialBase*sum(current.electric+1,e);
      const leaf=cfg.nuclear.lateMaterialBase*sum(current.nuclear+1,n);
      const candidate={levels:{steam:s,electric:e,nuclear:n},cap:cap(s,e,n),tech,
        materials:{godCrystal:crystal,guardianStone:guardian,revivalLeaf:leaf}};
      if(!best||tech<best.tech)best=candidate;
      const key=Math.floor(tech/1_000_000_000);
      const old=buckets.get(key);
      if(!old||crystal+guardian+leaf<old.materials.godCrystal+old.materials.guardianStone+old.materials.revivalLeaf)
        buckets.set(key,candidate);
    }
assert.ok(best);
const options=[best,...[...buckets].sort((a,b)=>a[0]-b[0]).slice(0,6).map(x=>x[1])];
for(const x of options){
  const {steam,electric,nuclear}=x.levels;
  assert.equal(run(`S.eraStorage.steamKnowledge=${steam};S.eraStorage.electricKnowledge=${electric};
    S.eraStorage.nuclearKnowledge=${nuclear};S.beastExchange.scrollUsed=${current.scrolls};resCap('tech')`),x.cap);
}
console.log(JSON.stringify({source:path.relative(root,source),scope:'Conditional no-star warehouse route; keep all other paid-save state and 130 scrolls fixed. No upgrades or material earning paid.',
  current,base,target,candidatesChecked:checked,minTech:best,
  frontierExamples:options.slice(1)},null,2));
