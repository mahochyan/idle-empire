'use strict';
// Continue one paid P273 material checkpoint through nuclear knowledge levels 2–6 using real workers, ticks and upgrade payments.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p273-revival-no-loss-checkpoint-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const origin=JSON.parse(raw);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
  constructor(...args){super(...(args.length?args:[${origin.ts}+(S.tick-${origin.tick})*1000]))}
  static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}
};
globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const initial=run("({tick:S.tick,pop:popCurrent(),food:S.res.food,tech:S.res.tech,cap:resCap('tech'),leaf:S.items.revivalLeaf,level:S.eraStorage.nuclearKnowledge,alert:S.killValues.godRebirth,defeated:S.defeated.length,army:armyCount(),garrison:S.garrison.phase})");
assert.equal(initial.level,1);assert.ok(initial.leaf>=600);
assert.equal(initial.pop,1002);assert.equal(initial.defeated,99);assert.equal(initial.army,517);
assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
const upgrades=[];
for(let target=2;target<=6;target++){
  const cost=run("eraStorageCost('nuclearKnowledge')");
  assert.equal(cost.tech,20000000*target);
  if(target===6)assert.equal(cost.revivalLeaf,600);
  assert.ok(run("resCap('tech')")>=cost.tech,'knowledge cap must hold each one-payment cost');
  const produced=run(`(()=>{let seconds=0,minFood=S.res.food;while(S.res.tech<${cost.tech}&&seconds<100000){tick();seconds++;minFood=Math.min(minFood,S.res.food)}return{seconds,minFood,tech:S.res.tech,done:S.res.tech>=${cost.tech}}})()`);
  assert.equal(produced.done,true);assert.ok(produced.minFood>0);
  const before=run("({tick:S.tick,tech:S.res.tech,cap:resCap('tech'),leaf:S.items.revivalLeaf,level:S.eraStorage.nuclearKnowledge,army:armyCount()})");
  const paid=run("upgradeEraStorage('nuclearKnowledge')");
  assert.equal(paid.ok,true);
  const after=run("({tick:S.tick,tech:S.res.tech,cap:resCap('tech'),leaf:S.items.revivalLeaf,level:S.eraStorage.nuclearKnowledge,army:armyCount()})");
  assert.equal(after.level,target);assert.equal(before.tech-after.tech,cost.tech);
  assert.equal(before.leaf-after.leaf,cost.revivalLeaf||0);
  assert.ok(after.cap>before.cap); // Capacity is also checked against the loaded game's resCap after save/reload.
  upgrades.push({target,cost,produced,before,after});
}
const final=run("({tick:S.tick,pop:popCurrent(),food:S.res.food,tech:S.res.tech,cap:resCap('tech'),leaf:S.items.revivalLeaf,level:S.eraStorage.nuclearKnowledge,alert:S.killValues.godRebirth,defeated:S.defeated.length,army:armyCount(),garrison:S.garrison.phase})");
assert.equal(final.level,6);assert.equal(final.leaf,initial.leaf-600);
assert.equal(final.defeated,99);assert.equal(final.army,initial.army);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save'),reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.eraStorage.nuclearKnowledge'),6);
assert.equal(reload.run('S.items.revivalLeaf'),final.leaf);
assert.equal(reload.run("resCap('tech')"),final.cap);
assert.equal(hash(fs.readFileSync(path.join(root,sourceFile),'utf8')),hash(raw));
const saveFile='docs/codex/reports/data/p273-nuclear-knowledge-six-paid-save.json';
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const report={batch:'P273',sourceFile,sourceSha256:hash(raw),unit:'simulated online seconds, resource units, soldiers',initial,upgrades,final,
  totalOnlineSeconds:upgrades.reduce((n,x)=>n+x.produced.seconds,0),saveFile,saveSha256:hash(finalRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p273-nuclear-knowledge-six-paid.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,totalOnlineSeconds:report.totalOnlineSeconds,
  levels:upgrades.map(x=>({target:x.target,seconds:x.produced.seconds,cost:x.cost,cap:x.after.cap,leaf:x.after.leaf})),final,saveFile,saveSha256:report.saveSha256}));
