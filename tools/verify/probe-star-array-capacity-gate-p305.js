'use strict';
// Audit the source star-array prerequisite against the current paid save and real capacity/cost functions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceDir=path.join(root,'210(1)_unpacked/_analysis');
const dataDir=path.join(root,'docs/codex/reports/data');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const sourceText=fs.readFileSync(path.join(sourceDir,'deob_main.js'),'utf8');
const entityRaw=fs.readFileSync(path.join(sourceDir,'entities_table.json'),'utf8');
assert.equal(sha(sourceText),'b0bc24d680517c592e8bd123148814f4f9ee24c53ddb0db8165294e131b563c4');
assert.equal(sha(entityRaw),'f67b86147f0c2f1ebf09eddd49dad1e1806c0441c347c14647d8d0d8ef706c2e');
const entities=JSON.parse(entityRaw).ents;
const keys=[450123,450223,450323,320000,320004,530001];
const sourceEntities=Object.fromEntries(keys.map(id=>[id,entities[id]]));
for(const id of keys)assert.ok(sourceEntities[id],`source entity ${id}`);
assert.deepEqual(sourceEntities[450123]['developScience:Need'],[[160003,200000000],[160010,1000000]]);
assert.equal(sourceEntities[450123]['developScience:LimitID'],450023);
assert.deepEqual(sourceEntities[450223]['developScience:Need'],[[160003,300000000],[160010,2000000]]);
assert.equal(sourceEntities[450223]['developScience:LimitID'],450123);
assert.equal(sourceEntities[320004]['powerPos:Value'],4);
assert.equal(sourceEntities[320004]['powerPos:ExValue'],2);
const capacityOffset=sourceText.indexOf("'key':\"getResourceMax\"");
const arrayOffset=sourceText.indexOf("'key':'getPowerPosValue'");
const awakeningOffset=sourceText.indexOf("'key':'superArmyPer'");
const valueOffset=sourceText.indexOf("'key':\"getValue\"");
assert.ok([capacityOffset,arrayOffset,awakeningOffset,valueOffset].every(n=>n>=0));
const capacityCode=sourceText.slice(capacityOffset,capacityOffset+4700);
const arrayCode=sourceText.slice(arrayOffset,arrayOffset+800);
const awakeningCode=sourceText.slice(awakeningOffset,awakeningOffset+950);
const valueCode=sourceText.slice(valueOffset,valueOffset+410);
assert.ok(capacityCode.includes("getPowerPosValue'](0x4e204)"),'knowledge cap includes array property 320004');
assert.ok(arrayCode.includes('"IsOpen"')&&arrayCode.includes('"superArmyPer"'),'array needs an open slot and awakening multiplier');
assert.ok(awakeningCode.includes('0x14===')&&awakeningCode.includes('>=0x32')&&awakeningCode.includes('0.6'),'awakening stage 20 and 50 stars');
for(const threshold of ['0x64','0x96','0xc8','0xfa','0x12c'])
  assert.ok(awakeningCode.includes('>='+threshold),`awakening threshold ${threshold}`);
assert.ok(valueCode.includes("Math['floor'](_0x40361e[\"IndexID\"]/0x3)"),'slot index scales property');
const paidFile='p304-electric-knowledge17-guardian-paid-save.json';
const paidRaw=fs.readFileSync(path.join(dataDir,paidFile),'utf8');
assert.equal(sha(paidRaw),'596abcd27b71e8c90f1bac53b9fe5bca1b7a1b30f4c9c085d7b69fe3562eda99');
const env=environment({rts_save:paidRaw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const paidState=JSON.parse(JSON.stringify(run("({cap:resCap('tech'),tech:S.res.tech,medal:S.res.medal,scrollUsed:S.beastExchange.scrollUsed,awakening:{level:S.awakening.star_trooper.level,stars:S.awakening.star_trooper.stars},levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge},materials:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,revivalLeaf:S.items.revivalLeaf}})")));
assert.deepEqual(paidState.awakening,{level:6,stars:7});
assert.equal(paidState.cap,166765547);
const frontier=JSON.parse(JSON.stringify(run(`(()=>{
  const initial={steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge};
  const initialCap=resCap('tech'),results=[];
  const sum=(from,to)=>(from+1+to)*(to-from)/2;
  const price=(key,from,to)=>({tech:CFG.eraStorage[key].techBase*sum(from,to),material:(CFG.eraStorage[key].lateMaterialBase??CFG.eraStorage[key].lateCrystalBase)*sum(from,to)});
  for(const goal of [200000000,300000000,500000000]){
    let best=null;
    for(let steam=initial.steam;steam<=100;steam++){
      S.eraStorage.steamKnowledge=steam;
      for(let electric=initial.electric;electric<=100;electric++){
        S.eraStorage.electricKnowledge=electric;
        S.eraStorage.nuclearKnowledge=100;
        if(resCap('tech')<goal)continue;
        let lo=initial.nuclear,hi=100;
        while(lo<hi){const mid=Math.floor((lo+hi)/2);S.eraStorage.nuclearKnowledge=mid;if(resCap('tech')>=goal)hi=mid;else lo=mid+1}
        S.eraStorage.nuclearKnowledge=lo;
        const st=price('steamKnowledge',initial.steam,steam),el=price('electricKnowledge',initial.electric,electric),nu=price('nuclearKnowledge',initial.nuclear,lo);
        const tech=st.tech+el.tech+nu.tech;
        if(best===null||tech<best.tech)best={goal,levels:{steam,electric,nuclear:lo},cap:resCap('tech'),tech,materials:{godCrystal:st.material,guardianStone:el.material,revivalLeaf:nu.material}};
      }
    }
    if(!best)throw Error('missing frontier for '+goal);
    const actual={tech:0,materials:{godCrystal:0,guardianStone:0,revivalLeaf:0}};
    for(const [key,from,to,material] of [
      ['steamKnowledge',initial.steam,best.levels.steam,'godCrystal'],
      ['electricKnowledge',initial.electric,best.levels.electric,'guardianStone'],
      ['nuclearKnowledge',initial.nuclear,best.levels.nuclear,'revivalLeaf']]){
      for(let level=from;level<to;level++){
        S.eraStorage[key]=level;const cost=eraStorageCost(key);
        actual.tech+=cost.tech;actual.materials[material]+=cost[material]||0;
      }
    }
    if(actual.tech!==best.tech||Object.keys(actual.materials).some(key=>actual.materials[key]!==best.materials[key]))throw Error('cost mismatch');
    results.push(best);
  }
  S.eraStorage.steamKnowledge=initial.steam;S.eraStorage.electricKnowledge=initial.electric;S.eraStorage.nuclearKnowledge=initial.nuclear;
  return{results,restoredCap:resCap('tech'),initialCap};
})()`)));
assert.equal(frontier.restoredCap,paidState.cap);
assert.equal(frontier.results[0].tech,35100000);
assert.deepEqual(frontier.results[0].levels,{steam:22,electric:17,nuclear:6});
const output={batch:'P305',kind:'reference source and current paid-state capacity frontier; no materials or research paid',
  units:'resource units and item counts; no simulated time',
  sourceSha256:{'deob_main.js':sha(sourceText),'entities_table.json':sha(entityRaw),[paidFile]:sha(paidRaw)},
  sourceOffsetsUtf16:{getResourceMax:capacityOffset,getPowerPosValue:arrayOffset,superArmyPer:awakeningOffset,getValue:valueOffset},
  sourceEntities,sourceAwakeningThresholds:{level:20,starsForFirstBonus:50,firstMultiplier:0.6},paidState,
  frontier:frontier.results.map(row=>({...row,materialDeficit:Object.fromEntries(Object.entries(row.materials).map(([key,amount])=>[key,Math.max(0,amount-paidState.materials[key])]))}))};
const outputFile=path.join(dataDir,'p305-star-array-capacity-gate.json');
fs.writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceOffsetsUtf16:output.sourceOffsetsUtf16,paidState,frontier:output.frontier},null,2));
