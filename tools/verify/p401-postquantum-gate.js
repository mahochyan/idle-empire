'use strict';
// P401: continue the P400 naturally paid armament save without changing gameplay state by fiat.
// Source 450924 is audited as a reference cost, not called as a missing in-game science.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const sourceName='p400-armament-natural-invested-save.json';
const sourceRaw=fs.readFileSync(path.join(dataDir,sourceName),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(sourceRaw);
assert.equal(sourceHash,'e466af613d8048e4d68fb7993956a02491271c50c429a28775e0dad9222b2a9d');
const source=JSON.parse(sourceRaw);
const referencePath=path.join(root,'210(1)_unpacked/_analysis/entities_table.json');
const referenceRaw=fs.readFileSync(referencePath,'utf8');
const reference=JSON.parse(referenceRaw).ents['450924'];
assert.equal(reference['developScience:LimitID'],450224);
assert.deepEqual(reference['developScience:Need'],[[160003,100000000000],[160010,30000000]]);
const target={tech:100000000000,medal:30000000};
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));

const env=environment({rts_save:sourceRaw}),run=env.run;
const loaded=run('loadSaveAndApply()');
assert.equal(loaded.status,'migrated');
assert.equal(env.store.get('rts_save_premigration'),sourceRaw);
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[__clockMs]))}
  static now(){return __clockMs}
};`);
const state=()=>run(`({tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,
  medalCap:resCap('medal'),bone:S.res.bone,boneCap:resCap('bone'),
  revivalLeaf:S.items.revivalLeaf,storageScroll:S.items.storageScroll,
  scrollUsed:S.beastExchange.scrollUsed,quantumKnowledge:S.eraStorage.quantumKnowledge,
  armament:scienceUnlocked('sci_astral_armament'),stage100:S.defeated.includes(100),
  exchangeLevel:S.beastExchange.level})`);
const report={baseline:'7cb00487d186c5eb049dac3d582fc5cc5ea12d0c',
  sourceName,sourceHash,referenceHash:sha(referenceRaw),reference450924:reference,
  runtimeHash,loadStatus:loaded.status,premigrationSourcePreserved:true,target,start:state(),scienceConfigured:false};
report.channels=run(`({onlineTechPerSecond:prodRate('tech'),offlineRatio:CFG.offline.ratio,
  foodNetPerSecond:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost,
  nextRevivalLeafReward:materialDomainEncounter('revivalLeaf').reward.revivalLeaf,
  revivalDomainUnlocked:scienceUnlocked(CFG.godDomains.revivalLeaf.needScience),
  beastExchangeLevel:S.beastExchange.level})`);
assert.ok(report.channels.onlineTechPerSecond>0);
assert.ok(report.channels.foodNetPerSecond>0);
assert.equal(report.channels.revivalDomainUnlocked,true);
assert.equal(report.start.armament,true);
assert.equal(report.start.stage100,true);
assert.ok(report.start.techCap<target.tech);
assert.ok(report.start.medal<target.medal);
assert.equal(run(`Object.entries(activeSciences()).some(([id,sc])=>
  id!=='sci_astral_armament'&&sc.cost?.tech===100000000000&&sc.cost?.medal===30000000)`),false);
assert.equal(run(`Object.keys(activeSciences()).some(id=>/engine|singularity|dimension|次元|引擎|奇点/.test(id+' '+activeSciences()[id].name))`),false);

// Confirm the paid save's medal stock can be brought to the source threshold
// by one existing, genuine beast-bone exchange. The original file is untouched.
const perTrade={bone:run('beastBoneTradeCost()'),medal:run('beastBoneTradeReward()')};
const trades=Math.ceil((target.medal-report.start.medal)/perTrade.medal);
assert.ok(Number.isSafeInteger(trades)&&trades>0);
assert.ok(trades*perTrade.bone<=report.start.bone);
assert.ok(report.start.medal+trades*perTrade.medal<=report.start.medalCap);
const exchanged=run(`exchangeBonesForMedals(${trades})`);
assert.equal(exchanged.ok,true,JSON.stringify(exchanged));
const afterExchange=state();
assert.equal(afterExchange.medal,report.start.medal+trades*perTrade.medal);
assert.equal(afterExchange.bone,report.start.bone-trades*perTrade.bone);
assert.ok(afterExchange.medal>=target.medal);
report.medalExchange={perTrade,trades,result:exchanged,after:afterExchange};

// The first immediately available growth action is Lv.8 knowledge storage.
// It is a real action, so verify its refusal and lack of mutation exactly.
const next=run(`eraStorageCost('quantumKnowledge')`);
assert.deepEqual({...next},{tech:4000000000,revivalLeaf:4800});
const beforeRefusal=state();
const refusal=run(`upgradeEraStorage('quantumKnowledge')`);
assert.equal(refusal.ok,false);
assert.equal(refusal.reason,'insufficient-resources');
assert.deepEqual(state(),beforeRefusal);
report.nextStorage={cost:next,refusal,knowledgeShortfall:next.tech-beforeRefusal.tech,
  leafShortfall:next.revivalLeaf-beforeRefusal.revivalLeaf,
  currentCapacityEnoughForCost:beforeRefusal.techCap>=next.tech};

// A pure arithmetic projection of the existing capacity formula, checked
// against the real runtime at the current state. It never changes S.
const capInputs=run(`(()=>{const r=CFG.res.tech,x=expandedResCap('tech'),pk=producerKey('tech'),st=pk?bldSt(pk):null;
  const base=(x?x.max:r.max)+(x?x.maxPerLv:(r.maxPerLv||0))*(st&&st.state==='idle'?st.lv:0)+
    CFG.buildings.library.storagePerLv*bldSt('library').lv+
    CFG.buildings.institute.storagePerLv*bldSt('institute').lv;
  return{base,mastery:S.storageMasteryLv,masteryPerLevel:CFG.storageMastery.perLevel,
    levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,
      nuclear:S.eraStorage.nuclearKnowledge,quantum:S.eraStorage.quantumKnowledge},
    perLevel:{steam:CFG.eraStorage.steamKnowledge.perLevel,
      electric:CFG.eraStorage.electricKnowledge.perLevel,
      nuclear:CFG.eraStorage.nuclearKnowledge.perLevel,
      quantum:CFG.eraStorage.quantumKnowledge.perLevel},
    maxLevel:{steam:CFG.eraStorage.steamKnowledge.maxLevel,
      electric:CFG.eraStorage.electricKnowledge.maxLevel,
      nuclear:CFG.eraStorage.nuclearKnowledge.maxLevel,
      quantum:CFG.eraStorage.quantumKnowledge.maxLevel},
    scrollUsed:S.beastExchange.scrollUsed,scrollMax:CFG.beastExchange.scrollUseLimit,
    scrollPerUse:CFG.beastExchange.scrollCapacityPerUse,
    starArrayPercent:starArrayKnowledgePercent()}})()`);
function projectedCap(levels=capInputs.levels,scrollUsed=capInputs.scrollUsed){
  let cap=Math.floor(capInputs.base*(1+capInputs.mastery*capInputs.masteryPerLevel));
  for(const era of ['steam','electric','nuclear','quantum'])
    cap=Math.floor(cap*(1+levels[era]*capInputs.perLevel[era]));
  cap=Math.floor(cap*(1+capInputs.starArrayPercent/100));
  return Number(BigInt(cap)*BigInt(10000+scrollUsed*100)/10000n);
}
assert.equal(projectedCap(),afterExchange.techCap);
const maxLevels=Object.fromEntries(Object.keys(capInputs.levels).map(k=>[k,capInputs.maxLevel[k]]));
const quantumOnlyMax=projectedCap({...capInputs.levels,quantum:capInputs.maxLevel.quantum});
const scrollOnlyMax=projectedCap(capInputs.levels,capInputs.scrollMax);
const allKnowledgeResearchMax=projectedCap(maxLevels,capInputs.scrollUsed);
const allKnowledgeResearchAndScrollMax=projectedCap(maxLevels,capInputs.scrollMax);
let quantumTrackFirstCapWall=null;
for(let level=capInputs.levels.quantum;level<capInputs.maxLevel.quantum;level++){
  const cap=projectedCap({...capInputs.levels,quantum:level});
  const cost=run(`CFG.eraStorage.quantumKnowledge.techBase`)*(level+1);
  if(cap<cost){quantumTrackFirstCapWall={atLevel:level,nextLevel:level+1,cap,cost,shortfall:cost-cap};break}
}
assert.ok(quantumTrackFirstCapWall);
assert.ok(allKnowledgeResearchMax>=target.tech);
report.capacityProjection={inputs:capInputs,current:projectedCap(),
  sourceTechCost:target.tech,shortfallAtCurrentCap:target.tech-afterExchange.techCap,
  quantumOnlyMax,scrollOnlyMax,allKnowledgeResearchMax,
  allKnowledgeResearchAndScrollMax,quantumTrackFirstCapWall,
  caution:'Hypothetical capacity arithmetic only. No storage level, scroll or star-array action was granted or paid.'};

assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const finalName='p401-postquantum-medal-ready-save.json';
fs.writeFileSync(path.join(dataDir,finalName),finalRaw);
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
const reloadState=reload.run(`({tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,
  bone:S.res.bone,quantumKnowledge:S.eraStorage.quantumKnowledge,
  revivalLeaf:S.items.revivalLeaf,armament:scienceUnlocked('sci_astral_armament')})`);
assert.equal(reloadState.medal,afterExchange.medal);
assert.equal(reloadState.tech,afterExchange.tech);
assert.equal(reloadState.techCap,afterExchange.techCap);
assert.equal(reloadState.quantumKnowledge,afterExchange.quantumKnowledge);
assert.equal(reloadState.revivalLeaf,afterExchange.revivalLeaf);
assert.equal(reloadState.armament,true);
report.final={name:finalName,hash:sha(finalRaw),reload:reloadState};
assert.equal(sha(fs.readFileSync(path.join(dataDir,sourceName),'utf8')),sourceHash);
for(const [f,hash] of Object.entries(runtimeHash))assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),hash);
fs.writeFileSync(path.join(dataDir,'p401-postquantum-gate.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({target,start:report.start,channels:report.channels,medalExchange:report.medalExchange,
  nextStorage:report.nextStorage,capacityProjection:report.capacityProjection,final:report.final},null,2));
