'use strict';
// Compare the local unpacked source graph (when present) or its committed P398
// snapshot with this game's real capacity formula. The snapshot is evidence,
// not an independent re-extraction of the source.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.join(__dirname,'../..');
const sourceFile=path.join(root,'210(1)_unpacked/_analysis/entities_table.json');
const output=path.join(root,'docs/codex/reports/data/p398-singularity-source-capacity.json');
const entities=fs.existsSync(sourceFile)&&process.env.P398_SOURCE_FIXTURE_ONLY!=='1'?
  require(sourceFile).ents:null;
const snapshot=entities?null:JSON.parse(fs.readFileSync(output,'utf8'));
if(snapshot)assert.equal(snapshot.source,'210(1)_unpacked/_analysis/entities_table.json');
const savePath=path.join(root,'docs/codex/reports/data/p397-quantum-stage100-paid-save.json');
const saveText=fs.readFileSync(savePath,'utf8');
const sourceIds=[450124,450224,450924,450025,450125,450225];
const nodes=entities?sourceIds.map(id=>{
  const entity=entities[id];
  assert.ok(entity?.__lists?.includes('developScience'),`source ${id} absent`);
  const needs=Object.fromEntries((entity['developScience:Need']||[]).map(([resource,amount])=>[resource,amount]));
  return{id,name:entity['developScience:Name'],prerequisite:entity['developScience:LimitID'],
    knowledge:needs[160003],medal:needs[160010],unlocks:entity['developScience:Unlocked']};
}):snapshot.nodes;
assert.deepEqual(nodes.map(node=>node.id),sourceIds);
for(let i=1;i<nodes.length;i++)assert.equal(nodes[i].prerequisite,nodes[i-1].id);
assert.equal(nodes[0].prerequisite,450024);
const directReceivers=entities?Object.entries(entities).flatMap(([id,entity])=>Object.entries(entity)
  .filter(([key,value])=>key.endsWith(':LimitID')&&value===450025)
  .map(([key])=>({id:Number(id),kind:key.split(':')[0]}))):snapshot.directReceivers;

const game=environment({rts_save:saveText});
assert.equal(game.run('loadSaveAndApply().status'),'ok');
const actual=game.run(`({knowledgeCapacity:resCap('tech'),knowledge:S.res.tech,medal:S.res.medal,
  quantum:scienceUnlocked('sci_quantum_age'),starArray:scienceUnlocked('sci_star_array'),
  academy:bldSt('academy').lv,library:bldSt('library').lv,institute:bldSt('institute').lv,
  storageMastery:S.storageMasteryLv,scrollUsed:S.beastExchange.scrollUsed,
  knowledgeResearch:Object.fromEntries(['steam','electric','nuclear','quantum'].map(era=>[era,S.eraStorage[era+'Knowledge']])),
  awakeningLevel:S.awakening.star_trooper.level,awakeningStars:S.awakening.star_trooper.stars})`);
assert.equal(actual.quantum,true);
const limits=game.run(`({science:CFG.ownMax.science,warehouse:CFG.ownMax.warehouse,
  storageMastery:CFG.storageMastery.maxLevel,scrollUsed:CFG.beastExchange.scrollUseLimit,
  eraKnowledge:Object.fromEntries(['steam','electric','nuclear','quantum'].map(era=>[era,CFG.eraStorage[era+'Knowledge'].maxLevel])),
  awakeningLevel:CFG.awakening.maxLevel,starScale:CFG.starArray.starScale.at(-1),
  starSlots:CFG.starArray.slots,starSlotLevel:CFG.starArray.maxLevel})`);
assert.equal(actual.academy,limits.science);
assert.equal(actual.library,limits.warehouse);
assert.equal(actual.institute,limits.warehouse);
assert.equal(actual.storageMastery,limits.storageMastery);
// All changes below occur only in the VM's in-memory candidate, never in the supplied save.
game.run(`for(const era of ['steam','electric','nuclear','quantum'])S.eraStorage[era+'Knowledge']=CFG.eraStorage[era+'Knowledge'].maxLevel;
  S.beastExchange.scrollUsed=CFG.beastExchange.scrollUseLimit;`);
const allStorageNoStar=game.run("resCap('tech')");
game.run(`S.awakening.star_trooper.level=CFG.starArray.awakeningLevel;
  S.awakening.star_trooper.stars=CFG.starArray.starScale.at(-1)[0];
  for(const slot of S.starArray.star_trooper.slots){slot.open=true;slot.type='knowledgeCap';slot.level=CFG.starArray.maxLevel}`);
const starArrayPercent=game.run('starArrayKnowledgePercent()');
const allConditionalMax=game.run("resCap('tech')");
assert.ok(allConditionalMax<nodes.at(-1).knowledge,'the terminal region capacity gap changed');
const report={baselineSave:'docs/codex/reports/data/p397-quantum-stage100-paid-save.json',
  baselineSaveSha256:crypto.createHash('sha256').update(saveText).digest('hex'),
  source:'210(1)_unpacked/_analysis/entities_table.json',nodes,directReceivers,
  cumulativeToEra:{knowledge:nodes.slice(0,4).reduce((sum,node)=>sum+node.knowledge,0),
    medal:nodes.slice(0,4).reduce((sum,node)=>sum+node.medal,0)},
  cumulativeThroughLastRegion:{knowledge:nodes.reduce((sum,node)=>sum+node.knowledge,0),
    medal:nodes.reduce((sum,node)=>sum+node.medal,0)},
  actual,limits,conditional:{allStorageNoStar,starArrayPercent,allConditionalMax,
    lastRegionKnowledgeGap:nodes.at(-1).knowledge-allConditionalMax,
    assumption:'VM-only maximum of current legal levels, 500 scrolls, awakening 20/300, and 20 knowledge-cap slots at level 10; none of those unowned upgrades were paid'},
  postQuantumResearch:game.run("Object.entries(activeSciences()).filter(([,cfg])=>cfg.need?.includes('sci_quantum_age')).map(([id,cfg])=>({id,name:cfg.name}))")};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({actualCapacity:actual.knowledgeCapacity,allStorageNoStar,starArrayPercent,
  allConditionalMax,lastRegionKnowledgeGap:report.conditional.lastRegionKnowledgeGap,
  directReceivers:directReceivers.length,output:path.relative(root,output)}));
