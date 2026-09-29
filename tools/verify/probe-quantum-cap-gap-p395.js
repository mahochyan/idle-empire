'use strict';
// P395: conditional lower-cost capacity alternatives, measured against the paid
// P394 state. No candidate payment or material production is credited here.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceFile='p394-quantum-material-paid-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'8b140b350c72b47d03663ede93b04b00ee8435370d006d3e44101c4c04a4131c');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const start=run(`({tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  scrollUsed:S.beastExchange.scrollUsed,scrollLimit:CFG.beastExchange.scrollUseLimit,
  stars:starArrayKnowledgePercent(),levels:{steam:S.eraStorage.steamKnowledge,
    electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge},
  stock:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,
    revivalLeaf:S.items.revivalLeaf},wildStock:Object.fromEntries(
      CFG.beastExchange.scrollMaterials.map(k=>[k,S.items[k]])),
  next:{steam:eraStorageCost('steamKnowledge'),electric:eraStorageCost('electricKnowledge'),
    nuclear:eraStorageCost('nuclearKnowledge')},
  rate:prodRate('tech')})`);
assert.equal(start.stars,0);
const target=run('activeSciences().sci_quantum_age.cost.tech');
const cfg=run(`({steam:CFG.eraStorage.steamKnowledge,
  electric:CFG.eraStorage.electricKnowledge,nuclear:CFG.eraStorage.nuclearKnowledge,
  scroll:CFG.beastExchange.scrollCapacityPerUse})`);
const base=run(`S.eraStorage.steamKnowledge=0;S.eraStorage.electricKnowledge=0;
  S.eraStorage.nuclearKnowledge=0;S.beastExchange.scrollUsed=0;resCap('tech')`);
const sum=(a,b)=>b<a?0:(a+b)*(b-a+1)/2;
function cap(s,e,n,u){
  let v=base;
  v=Math.floor(v*(1+s*cfg.steam.perLevel));
  v=Math.floor(v*(1+e*cfg.electric.perLevel));
  v=Math.floor(v*(1+n*cfg.nuclear.perLevel));
  return Math.floor(v*(1+u*cfg.scroll));
}
assert.equal(cap(start.levels.steam,start.levels.electric,start.levels.nuclear,start.scrollUsed),start.cap);
function candidate(s,e,n,u){
  const sc=sum(start.levels.steam+1,s),ec=sum(start.levels.electric+1,e),nc=sum(start.levels.nuclear+1,n);
  return{scrollUsed:u,extraScrolls:u-start.scrollUsed,levels:{steam:s,electric:e,nuclear:n},
    cap:cap(s,e,n,u),extraTech:sc*cfg.steam.techBase+ec*cfg.electric.techBase+nc*cfg.nuclear.techBase,
    grossMaterials:{godCrystal:sc*cfg.steam.lateCrystalBase,
      guardianStone:ec*cfg.electric.lateMaterialBase,
      revivalLeaf:nc*cfg.nuclear.lateMaterialBase}};
}
const rows=[];
for(const u of [start.scrollUsed,200,300,400,500]){
  let best=null,passing=0;
  for(let s=start.levels.steam;s<=cfg.steam.maxLevel;s++)
    for(let e=start.levels.electric;e<=cfg.electric.maxLevel;e++)
      for(let n=start.levels.nuclear;n<=cfg.nuclear.maxLevel;n++){
        if(cap(s,e,n,u)<target)continue;
        passing++;
        const c=candidate(s,e,n,u);
        if(!best||c.extraTech<best.extraTech)best=c;
      }
  assert.ok(best);
  // Verify each selected conditional capacity with the actual game function.
  const verify=environment({rts_save:raw});
  assert.equal(verify.run('loadSaveAndApply().status'),'ok');
  const actual=verify.run(`S.eraStorage.steamKnowledge=${best.levels.steam};
    S.eraStorage.electricKnowledge=${best.levels.electric};
    S.eraStorage.nuclearKnowledge=${best.levels.nuclear};
    S.beastExchange.scrollUsed=${u};resCap('tech')`);
  assert.equal(actual,best.cap);
  best.currentMaterialShortfall=Object.fromEntries(Object.entries(best.grossMaterials)
    .map(([k,v])=>[k,Math.max(0,v-start.stock[k])]));
  best.minimumWildStockShortfallForScrolls=Math.max(0,best.extraScrolls*20-
    Object.values(start.wildStock).reduce((a,b)=>a+b,0));
  rows.push({...best,passing,actualCapVerified:true});
}
const next=Object.fromEntries(Object.entries(start.next).map(([key,cost])=>{
  const level={steam:start.levels.steam,electric:start.levels.electric,nuclear:start.levels.nuclear};
  level[key]++;
  const gain=cap(level.steam,level.electric,level.nuclear,start.scrollUsed)-start.cap;
  return[key,{cost,capacityGain:gain,capacityAfter:start.cap+gain,
    currentMaterialShortfall:Math.max(0,(cost.godCrystal||cost.guardianStone||cost.revivalLeaf||0)-
      (start.stock.godCrystal*(!!cost.godCrystal)+start.stock.guardianStone*(!!cost.guardianStone)+
        start.stock.revivalLeaf*(!!cost.revivalLeaf)))}];
}));
const result={source:sourceFile,sourceSha256:sha(raw),start,base,target,
  hardCurrentCapGap:target-start.cap,next,rows,
  scope:'Only cap candidates, not paid research/materials/scrolls. Quantum still needs a single 3B tech payment after capacity.'};
fs.writeFileSync(path.join(dir,'p395-quantum-cap-gap.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start,target,hardCurrentCapGap:result.hardCurrentCapGap,next,rows},null,2));
