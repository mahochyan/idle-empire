'use strict';
// Bounded real-action continuation of the P402 high-scroll save. No state injection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceName='p402-high-scroll-followup-save.json';
const sourcePath=path.join(dir,sourceName);
const raw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(raw);
assert.equal(sourceHash,'b615a8158c53eaa1c2b0603f619fe17dcdaa86980b8967e647c0abd83340aa6c');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[__clockMs]))}
  static now(){return __clockMs}
};
globalThis.__timers=new Map();globalThis.__nextTimer=1;
globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
globalThis.clearTimeout=id=>__timers.delete(id);
globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
  __timers.delete(first[0]);first[1].fn();return true};
globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-')||id==='battle-vfx-layer')return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=403;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};`);
const snap=()=>JSON.parse(JSON.stringify(run(`({tick:S.tick,clockMs:Date.now(),knowledge:S.res.tech,
  knowledgeCap:resCap('tech'),techRate:prodRate('tech'),food:S.res.food,
  army:armyCount(),deployed:formSoldierCount(),leaf:S.items.revivalLeaf,
  blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
  alert:S.killValues.godRebirth,store:S.eraStorage.quantumKnowledge,
  rng:__rng})`)));
const initial=snap(),cost=run("eraStorageCost('quantumKnowledge')");
assert.equal(initial.store,7);
assert.deepEqual({...cost},{tech:4000000000,revivalLeaf:4800});
const beforeRefusal=env.store.get('rts_save');
const refusal=run("upgradeEraStorage('quantumKnowledge')");
assert.equal(refusal.ok,false);
assert.equal(env.store.get('rts_save'),beforeRefusal);
assert.equal(snap().store,initial.store);
const report={baselineHead:'3c856bc43bca4f9e84f8c7439e8f48db0b9dc91c',sourceName,sourceHash,
  runtimeHash,seed:403,policy:'current depleted formation; at most three real revival battles; cleanse each 4100 alert using real sacred blood; stop at first defeat; six online ticks between wins; no recruitment or offline time',
  initial,cost:{...cost},refusal:{...refusal},clock:{onlineSeconds:0,offlineSeconds:0},battles:[],stopReason:null};
for(let i=0;i<3;i++){
  const before=snap();
  if(before.alert>=4100){
    const exchange=run('exchangeDomainCleanser(1)');
    if(!exchange.ok||exchange.repeat){report.stopReason={kind:'cleanser-exchange',result:{...exchange}};break}
    const use=run("useDomainCleanser('revivalLeaf')");
    if(!use.ok||use.repeat){report.stopReason={kind:'cleanser-use',result:{...use}};break}
    report.battles.push({kind:'cleanse',before,exchange:{...exchange},use:{...use},after:snap()});
  }
  const entry=snap();
  const encounter=run("materialDomainEncounter('revivalLeaf')");
  const preview={reward:{...encounter.reward},firstEnemy:Object.entries(encounter.units)[0],alert:encounter.killValue};
  run("openMaterialDomain('revivalLeaf')");
  if(!run('S.battleActive')){report.stopReason={kind:'battle-open'};break}
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000,'battle callback bound');
  const outcome=run("document.getElementById('battle-result').className");
  run('exitBattle()');
  const after=snap();
  report.battles.push({kind:'battle',entry,preview,outcome,callbacks,after,
    leafGain:after.leaf-entry.leaf,bloodGain:after.blood-entry.blood,
    armyLoss:entry.army-after.army});
  if(outcome!=='win'){report.stopReason={kind:'battle-loss',at:i+1};break}
  assert.equal(after.leaf-entry.leaf,preview.reward.revivalLeaf);
  run('for(let j=0;j<6;j++){tick();__clockMs+=1000}');
  report.clock.onlineSeconds+=6;
}
if(!report.stopReason)report.stopReason={kind:'three-battle-bound'};
report.final=snap();
report.remaining={leaf:Math.max(0,cost.revivalLeaf-report.final.leaf),
  knowledge:Math.max(0,cost.tech-report.final.knowledge),
  knowledgeSecondsAtCurrentRate:report.final.techRate>0?
    Math.ceil(Math.max(0,cost.tech-report.final.knowledge)/report.final.techRate):null};
const engineCost=run('({...activeSciences().sci_astral_engine.cost})');
assert.deepEqual({...engineCost},{tech:100000000000,medal:30000000,merit:0});
const beforeEngine=env.store.get('rts_save');
const engineRefusal=run("researchScience('sci_astral_engine')");
assert.equal(engineRefusal.ok,false);
assert.equal(env.store.get('rts_save'),beforeEngine);
report.engineGate={cost:{...engineCost},refusal:{...engineRefusal},cap:report.final.knowledgeCap,
  capShortfall:engineCost.tech-report.final.knowledgeCap};
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
for(const [name,expression] of [['leaf','S.items.revivalLeaf'],['blood','S.items.sacredBlood'],
  ['alert','S.killValues.godRebirth'],['store','S.eraStorage.quantumKnowledge'],
  ['army','armyCount()']])assert.equal(reload.run(expression),report.final[name]);
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sourceHash);
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),runtimeHash[f]);
report.finalName='p403-high-scroll-leaf-bounded-save.json';
report.finalHash=sha(finalRaw);
fs.writeFileSync(path.join(dir,report.finalName),finalRaw);
fs.writeFileSync(path.join(dir,'p403-high-scroll-leaf-bounded.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceHash,initial,cost:{...cost},battles:report.battles,
  stopReason:report.stopReason,clock:report.clock,final:report.final,
  remaining:report.remaining,engineGate:report.engineGate,
  finalName:report.finalName,finalHash:report.finalHash},null,2));
