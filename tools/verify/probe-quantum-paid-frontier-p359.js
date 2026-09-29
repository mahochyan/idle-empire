'use strict';
// P359: spend only existing stock in a paid P338 descendant, then price the remaining quantum capacity frontier.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const inputFiles={
  p338:'p338-soul-production-knowledge-restored-save.json',
  p351:'p351-wild-short-session-8h-save.json'
};
const inputs=Object.fromEntries(Object.entries(inputFiles).map(([key,file])=>{
  const raw=fs.readFileSync(path.join(data,file),'utf8');
  return [key,{file,raw,sha256:hash(raw)}];
}));
function readState(run){return run(`({tick:S.tick,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,
  medalCap:resCap('medal'),bone:S.res.bone,food:S.res.food,pop:popCurrent(),
  army:armyCount(),deployed:formSoldierCount(),queue:Object.values(S.queue).reduce((n,u)=>n+(u?.count||0),0),
  allocation:{...S.popAlloc},techRate:prodRate('tech'),foodNet:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost,
  mastery:S.storageMasteryLv,library:S.buildings.library.lv,institute:S.buildings.institute.lv,
  scrollUsed:S.beastExchange.scrollUsed,scrollStock:S.items.storageScroll,
  levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge},
  items:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,revivalLeaf:S.items.revivalLeaf},
  next:{steam:eraStorageCost('steamKnowledge'),electric:eraStorageCost('electricKnowledge'),nuclear:eraStorageCost('nuclearKnowledge')},
  quantum:scienceUnlocked('sci_quantum_age'),nuclear:scienceUnlocked('sci_nuclear_age'),
  quantumCost:activeSciences().sci_quantum_age.cost,
  starAttack:S.armsUp.star_trooper.atk.stars,defeated:S.defeated.length})`)}

const source=JSON.parse(inputs.p351.raw);
const e=environment({rts_save:inputs.p351.raw}),run=e.run;
const load=run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(load));
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
  static now(){return ${source.ts}+(S.tick-${source.tick})*1000}};`);
const before=readState(run);
assert.equal(before.nuclear,true);
assert.equal(before.quantum,false);
assert.ok(before.medal>=3000000);
assert.equal(before.starAttack,120);
assert.equal(before.defeated,99);
assert.equal(before.mastery,100);
assert.equal(before.library,1000);
assert.equal(before.institute,1000);
assert.equal(before.scrollStock,38);
const blockedBefore=run("researchScience('sci_quantum_age')");
assert.equal(blockedBefore.ok,false);
assert.equal(blockedBefore.reason,'insufficient-tech');
assert.equal(run('S.res.tech'),before.tech);
assert.equal(run('S.res.medal'),before.medal);

const scrollAction=run(`useStorageScroll(${before.scrollStock})`);
assert.equal(scrollAction.ok,true);
const afterScroll=readState(run);
assert.equal(afterScroll.scrollStock,0);
assert.equal(afterScroll.scrollUsed,before.scrollUsed+before.scrollStock);
assert.ok(afterScroll.techCap>before.techCap);
assert.equal(run('loadSaveAndApply().status'),'ok');
const steamAction=run("upgradeEraStorage('steamKnowledge')");
assert.equal(steamAction.ok,true);
const afterSteam=readState(run);
assert.equal(afterSteam.levels.steam,before.levels.steam+1);
assert.equal(afterSteam.tech,before.tech-before.next.steam.tech);
assert.equal(afterSteam.items.godCrystal,before.items.godCrystal-before.next.steam.godCrystal);
assert.ok(afterSteam.techCap>afterScroll.techCap);
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(afterSteam.scrollStock,0);
// All currently owned capacity scrolls are used; rare-item stocks cannot pay any next knowledge-storage level.
assert.ok(afterSteam.items.godCrystal<afterSteam.next.steam.godCrystal);
assert.ok(afterSteam.items.guardianStone<afterSteam.next.electric.guardianStone);
assert.ok(afterSteam.items.revivalLeaf<afterSteam.next.nuclear.revivalLeaf);

const fill=run(`(()=>{let seconds=0,minFood=S.res.food;
  while(S.res.tech<resCap('tech')&&seconds<20000){tick();seconds++;minFood=Math.min(minFood,S.res.food)}
  return{seconds,minFood,filled:S.res.tech>=resCap('tech')}})()`);
assert.equal(fill.filled,true);
assert.ok(fill.minFood>0);
const stockLimit=readState(run);
assert.ok(stockLimit.techCap<3000000000);
assert.equal(stockLimit.tech,stockLimit.techCap);
const blockedAfter=run("researchScience('sci_quantum_age')");
assert.equal(blockedAfter.ok,false);
assert.equal(blockedAfter.reason,'insufficient-tech');
assert.equal(run('S.res.tech'),stockLimit.tech);
assert.equal(run('S.res.medal'),stockLimit.medal);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("S.eraStorage.steamKnowledge"),stockLimit.levels.steam);
assert.equal(reload.run('S.beastExchange.scrollUsed'),stockLimit.scrollUsed);
assert.equal(reload.run('S.res.tech'),stockLimit.tech);
assert.equal(reload.run("scienceUnlocked('sci_quantum_age')"),false);

// Conditional capacity lower bounds: isolated mutations only, immediately restored, never saved as player progress.
const frontier=run(`(()=>{
  const initial={steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
    nuclear:S.eraStorage.nuclearKnowledge,scroll:S.beastExchange.scrollUsed};
  const sum=(from,to)=>(from+1+to)*(to-from)/2;
  const price=(key,from,to)=>{
    const cfg=CFG.eraStorage[key],steps=sum(from,to);
    return{tech:cfg.techBase*steps,material:(cfg.lateMaterialBase??cfg.lateCrystalBase)*steps}};
  const results=[];
  for(const scroll of [initial.scroll,CFG.beastExchange.scrollUseLimit]){
    S.beastExchange.scrollUsed=scroll;
    let best=null;
    for(let steam=initial.steam;steam<=100;steam++){
      S.eraStorage.steamKnowledge=steam;
      for(let electric=initial.electric;electric<=100;electric++){
        S.eraStorage.electricKnowledge=electric;
        S.eraStorage.nuclearKnowledge=100;
        if(resCap('tech')<3000000000)continue;
        let lo=initial.nuclear,hi=100;
        while(lo<hi){const mid=Math.floor((lo+hi)/2);
          S.eraStorage.nuclearKnowledge=mid;
          if(resCap('tech')>=3000000000)hi=mid;else lo=mid+1}
        S.eraStorage.nuclearKnowledge=lo;
        const st=price('steamKnowledge',initial.steam,steam),
          el=price('electricKnowledge',initial.electric,electric),
          nu=price('nuclearKnowledge',initial.nuclear,lo);
        const tech=st.tech+el.tech+nu.tech;
        if(best===null||tech<best.tech)best={scroll,extraScroll:scroll-initial.scroll,
          levels:{steam,electric,nuclear:lo},cap:resCap('tech'),tech,
          materials:{godCrystal:st.material,guardianStone:el.material,revivalLeaf:nu.material}};
      }
    }
    results.push(best);
  }
  for(const result of results){
    const targets=[['steamKnowledge',initial.steam,result.levels.steam,'godCrystal'],
      ['electricKnowledge',initial.electric,result.levels.electric,'guardianStone'],
      ['nuclearKnowledge',initial.nuclear,result.levels.nuclear,'revivalLeaf']];
    const actual={tech:0,materials:{godCrystal:0,guardianStone:0,revivalLeaf:0}};
    for(const [key,from,to,material] of targets)for(let level=from;level<to;level++){
      S.eraStorage[key]=level;const cost=eraStorageCost(key);
      actual.tech+=cost.tech;actual.materials[material]+=cost[material]||0;
    }
    if(actual.tech!==result.tech||Object.keys(actual.materials).some(key=>actual.materials[key]!==result.materials[key]))throw Error('conditional price mismatch');
  }
  S.eraStorage.steamKnowledge=initial.steam;
  S.eraStorage.electricKnowledge=initial.electric;
  S.eraStorage.nuclearKnowledge=initial.nuclear;
  S.beastExchange.scrollUsed=initial.scroll;
  return{goal:3000000000,initial,results,restoredCap:resCap('tech')};
})()`);
assert.equal(frontier.restoredCap,stockLimit.techCap);
for(const row of frontier.results){
  assert.ok(row.cap>=frontier.goal);
  row.deficit=Object.fromEntries(Object.entries(row.materials)
    .map(([key,qty])=>[key,Math.max(0,qty-stockLimit.items[key])]));
}
assert.equal(hash(fs.readFileSync(path.join(data,inputs.p351.file),'utf8')),inputs.p351.sha256);
assert.equal(hash(fs.readFileSync(path.join(data,inputs.p338.file),'utf8')),inputs.p338.sha256);
const sourceHashes=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-quantum-paid-frontier-p359.js']
  .map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const report={batch:'P359',kind:'paid on-hand storage actions and conditional fixed-scroll quantum capacity frontier',
  units:'resource/item units and simulated online seconds',
  inputs:Object.fromEntries(Object.entries(inputs).map(([key,{raw,...rest}])=>[key,rest])),
  sourceHashes,load,before,blockedBefore,scrollAction,afterScroll,steamAction,afterSteam,
  fill,stockLimit,blockedAfter,frontier,finalSaveSha256:hash(finalRaw),
  limitation:'P351 already spent 835200 offline and 98474 online seconds; frontier assumes unpaid future scrolls/materials and does not establish a payable quantum route'};
const reportFile='p359-quantum-paid-frontier.json',saveFile='p359-quantum-stock-cap-paid-save.json';
fs.writeFileSync(path.join(data,reportFile),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(data,saveFile),finalRaw);
console.log(JSON.stringify({reportFile,saveFile,input:report.inputs,load,before,afterScroll,afterSteam,
  fill,stockLimit,blockedAfter,frontier:frontier.results,finalSaveSha256:report.finalSaveSha256},null,2));
