'use strict';
// Continue the P396 paid save through the next actual, source-priced storage level.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceFile='p396-quantum-paid-bridge-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(raw);
assert.equal(sourceHash,'f80351aca309c5268575a583b7ca8e46a763407d2a52d476a1e666e4049a6fdd');
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const source=JSON.parse(raw);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[${source.ts}+(S.tick-${source.tick})*1000]))}
  static now(){return ${source.ts}+(S.tick-${source.tick})*1000}
};
globalThis.__timers=new Map();globalThis.__nextTimer=1;
globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
globalThis.clearTimeout=id=>__timers.delete(id);
globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
  __timers.delete(first[0]);first[1].fn();return true};
globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};`);
const state=()=>run(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,cap:resCap('tech'),
  army:armyCount(),deployed:formSoldierCount(),blood:S.items.sacredBlood,
  cleanser:S.items.domainCleanser,crystal:S.items.godCrystal,
  alert:S.killValues.godRevival,steam:S.eraStorage.steamKnowledge})`);
const result={sourceFile,sourceHash,clock:{onlineSeconds:0,offlineSeconds:0},start:state(),
  nextCost:run("eraStorageCost('steamKnowledge')"),battles:[],cleanses:[]};
assert.equal(result.start.steam,33);
assert.equal(result.nextCost.godCrystal,340);
while(state().crystal<result.nextCost.godCrystal&&result.battles.length<8){
  const before=state();
  const exchange=run('exchangeDomainCleanser(1)');
  assert.equal(exchange.ok,true,JSON.stringify(exchange));
  assert.notEqual(exchange.repeat,true);
  const use=run("useDomainCleanser('godCrystal')");
  assert.equal(use.ok,true,JSON.stringify(use));
  assert.notEqual(use.repeat,true);
  result.cleanses.push({before,exchange,use,after:state()});
  const expected=run("materialDomainEncounter('godCrystal').reward.godCrystal");
  run("openMaterialDomain('godCrystal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000);
  const outcome=run("document.getElementById('battle-result').className");
  run('exitBattle()');
  const after=state();
  result.battles.push({before,expected,outcome,callbacks,after,
    crystalGain:after.crystal-before.crystal,armyLoss:before.army-after.army});
  assert.equal(outcome,'win');
  assert.equal(after.crystal-before.crystal,expected);
  run('for(let i=0;i<6;i++)tick()');
  result.clock.onlineSeconds+=6;
}
assert.ok(state().crystal>=result.nextCost.godCrystal);
const beforePay=state();
result.payment=run("upgradeEraStorage('steamKnowledge')");
assert.equal(result.payment.ok,true,JSON.stringify(result.payment));
result.afterPay=state();
assert.equal(result.afterPay.steam,34);
assert.equal(result.afterPay.tech,beforePay.tech-result.nextCost.tech);
assert.equal(result.afterPay.crystal,beforePay.crystal-result.nextCost.godCrystal);
assert.ok(result.afterPay.cap>beforePay.cap);
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save');
const reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run("resCap('tech')"),result.afterPay.cap);
assert.equal(reload.run('S.eraStorage.steamKnowledge'),34);
result.finalHash=sha(finalRaw);
result.finalFile='p397-quantum-next-gate-paid-save.json';
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),sourceHash);
fs.writeFileSync(path.join(dir,result.finalFile),finalRaw);
fs.writeFileSync(path.join(dir,'p397-quantum-next-gate.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start:result.start,battles:result.battles.map(x=>({
  outcome:x.outcome,crystalGain:x.crystalGain,armyLoss:x.armyLoss})),
  payment:result.payment,afterPay:result.afterPay,clock:result.clock,
  finalFile:result.finalFile,finalHash:result.finalHash},null,2));
