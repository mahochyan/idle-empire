'use strict';
// Conditional capacity arithmetic from the actually paid P396 save. No candidate
// levels, materials or scrolls are purchased by this probe.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const file='p396-quantum-paid-bridge-save.json',raw=fs.readFileSync(path.join(dir,file),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'f80351aca309c5268575a583b7ca8e46a763407d2a52d476a1e666e4049a6fdd');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const start=run(`({tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  scrollUsed:S.beastExchange.scrollUsed,scrollLimit:CFG.beastExchange.scrollUseLimit,
  stars:starArrayKnowledgePercent(),
  levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
    nuclear:S.eraStorage.nuclearKnowledge},
  stock:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,
    revivalLeaf:S.items.revivalLeaf},
  wildStock:Object.fromEntries(CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  next:{steam:eraStorageCost('steamKnowledge'),
    electric:eraStorageCost('electricKnowledge'),
    nuclear:eraStorageCost('nuclearKnowledge')}})`);
assert.equal(start.stars,0,'new star array bonus would change search');
const target=run('activeSciences().sci_quantum_age.cost.tech');
const cfg=run(`({steam:CFG.eraStorage.steamKnowledge,
  electric:CFG.eraStorage.electricKnowledge,
  nuclear:CFG.eraStorage.nuclearKnowledge,
  scroll:CFG.beastExchange.scrollCapacityPerUse})`);
const verify=environment({rts_save:raw});
assert.equal(verify.run('loadSaveAndApply().status'),'ok');
const base=verify.run(`S.eraStorage.steamKnowledge=0;S.eraStorage.electricKnowledge=0;
  S.eraStorage.nuclearKnowledge=0;S.beastExchange.scrollUsed=0;resCap('tech')`);
const sum=(a,b)=>b<a?0:(a+b)*(b-a+1)/2;
function capacity(s,e,n,u){
  let v=base;
  v=Math.floor(v*(1+s*cfg.steam.perLevel));
  v=Math.floor(v*(1+e*cfg.electric.perLevel));
  v=Math.floor(v*(1+n*cfg.nuclear.perLevel));
  return Math.floor(v*(1+u*cfg.scroll));
}
assert.equal(capacity(start.levels.steam,start.levels.electric,start.levels.nuclear,
  start.scrollUsed),start.cap);
function candidate(s,e,n,u){
  const sc=sum(start.levels.steam+1,s),ec=sum(start.levels.electric+1,e),
    nc=sum(start.levels.nuclear+1,n);
  const grossMaterials={godCrystal:sc*cfg.steam.lateCrystalBase,
    guardianStone:ec*cfg.electric.lateMaterialBase,
    revivalLeaf:nc*cfg.nuclear.lateMaterialBase};
  return{scrollUsed:u,extraScrolls:u-start.scrollUsed,
    levels:{steam:s,electric:e,nuclear:n},cap:capacity(s,e,n,u),
    extraTech:sc*cfg.steam.techBase+ec*cfg.electric.techBase+nc*cfg.nuclear.techBase,
    grossMaterials,
    missingFromCurrentStock:Object.fromEntries(Object.entries(grossMaterials)
      .map(([k,v])=>[k,Math.max(0,v-start.stock[k])]))};
}
const rows=[];
for(const u of [start.scrollUsed,start.scrollLimit]){
  let best=null,passing=0;
  for(let s=start.levels.steam;s<=cfg.steam.maxLevel;s++)
    for(let e=start.levels.electric;e<=cfg.electric.maxLevel;e++)
      for(let n=start.levels.nuclear;n<=cfg.nuclear.maxLevel;n++){
        if(capacity(s,e,n,u)<target)continue;
        passing++;
        const c=candidate(s,e,n,u);
        if(!best||c.extraTech<best.extraTech)best=c;
      }
  assert.ok(best,'no passing candidate');
  const actual=verify.run(`S.eraStorage.steamKnowledge=${best.levels.steam};
    S.eraStorage.electricKnowledge=${best.levels.electric};
    S.eraStorage.nuclearKnowledge=${best.levels.nuclear};
    S.beastExchange.scrollUsed=${u};resCap('tech')`);
  assert.equal(actual,best.cap);
  best.passing=passing;best.actualCapVerified=true;
  best.minimumAdditionalWildMaterials=Math.max(0,best.extraScrolls*20-
    Object.values(start.wildStock).reduce((a,b)=>a+b,0));
  rows.push(best);
}
const next=Object.fromEntries(Object.entries(start.next).map(([key,cost])=>{
  const level={...start.levels};level[key]++;
  const material=key==='steam'?'godCrystal':key==='electric'?'guardianStone':'revivalLeaf';
  return[key,{cost,capacityGain:capacity(level.steam,level.electric,level.nuclear,
    start.scrollUsed)-start.cap,materialShortfall:Math.max(0,cost[material]-start.stock[material]),
    techShortfall:Math.max(0,cost.tech-start.tech)}];
}));
const result={source:file,sourceSha256:sha(raw),start,target,base,
  currentCapGap:target-start.cap,next,rows,
  scope:'Conditional capacity and gross resource requirements only; no candidate action paid.'};
fs.writeFileSync(path.join(dir,'p396-quantum-final-capacity.json'),JSON.stringify(result,null,2)+'\n');
assert.equal(sha(fs.readFileSync(path.join(dir,file),'utf8')),sha(raw));
console.log(JSON.stringify({currentCapGap:result.currentCapGap,next,rows},null,2));
