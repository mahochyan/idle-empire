'use strict';
// P395: one further real material -> storage payment from the same medal-ready save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dataDir=path.join(root,'docs/codex/reports/data');
const file='p395-quantum-storage-medal-combined-paid-save.json';
const raw=fs.readFileSync(path.join(dataDir,file),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'ecf78293015e46e05e70c38916a834c7063345f8ef11cb7ac29a337b0774b75e');
const input=JSON.parse(raw),initialTick=input.tick;
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate{
    constructor(...args){super(...(args.length?args:[${input.ts}+(S.tick-${initialTick})*1000]))}
    static now(){return ${input.ts}+(S.tick-${initialTick})*1000}
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
function state(r=run){return r(`({tick:S.tick,tech:S.res.tech,medal:S.res.medal,
  cap:resCap('tech'),food:S.res.food,crystal:S.items.godCrystal,
  blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,
  alert:S.killValues.godRevival,army:armyCount(),deployed:formSoldierCount(),
  steam:S.eraStorage.steamKnowledge})`)}
function checkpoint(){
  assert.equal(run('save().ok'),true);
  const saved=env.store.get('rts_save');
  const verify=environment({rts_save:saved});
  assert.equal(verify.run('loadSaveAndApply().status'),'ok');
  assert.equal(JSON.stringify(state(verify.run)),JSON.stringify(state()),'reload mismatch');
  return{sha256:sha(saved),raw:saved};
}
const start=state(),cost=run("eraStorageCost('steamKnowledge')");
assert.equal(start.steam,31);
assert.equal(cost.tech,9600000);
assert.equal(cost.godCrystal,320);
assert.equal(start.alert,5000);
assert.equal(start.army,672);
const cycles=[];
for(let i=0;i<8&&state().crystal<cost.godCrystal;i++){
  const before=state();
  const exchange=run('exchangeDomainCleanser(1)');
  const cleanse=run("useDomainCleanser('godCrystal')");
  assert.equal(exchange.ok,true,JSON.stringify(exchange));
  assert.equal(cleanse.ok,true,JSON.stringify(cleanse));
  assert.equal(exchange.repeat,undefined);
  assert.equal(cleanse.repeat,undefined);
  assert.equal(state().alert,before.alert-100);
  run("openMaterialDomain('godCrystal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000,'battle timeout');
  const outcome=run("document.getElementById('battle-result').className");
  run('exitBattle()');
  const after=state();
  const row={index:i+1,before,exchange,cleanse,outcome,callbacks,after,
    loss:before.army-after.army,gain:after.crystal-before.crystal,
    checkpoint:checkpoint().sha256};
  cycles.push(row);
  if(outcome!=='win')break;
  if(after.crystal<cost.godCrystal){
    run('for(let j=0;j<6;j++)tick()');
    row.cooldownSeconds=6;
    row.afterCooldown=state();
    row.cooldownCheckpoint=checkpoint().sha256;
  }
}
const beforeUpgrade=state();
assert.ok(beforeUpgrade.crystal>=cost.godCrystal,'crystal not enough to pay next storage');
assert.ok(beforeUpgrade.tech>=cost.tech);
const upgrade=run("upgradeEraStorage('steamKnowledge')");
assert.equal(upgrade.ok,true,JSON.stringify(upgrade));
const final=state();
assert.equal(final.steam,start.steam+1);
assert.equal(final.crystal,beforeUpgrade.crystal-cost.godCrystal);
assert.equal(final.tech,beforeUpgrade.tech-cost.tech);
assert.equal(final.medal,beforeUpgrade.medal);
assert.ok(final.cap>start.cap);
const saved=checkpoint();
const saveFile='p395-quantum-steam32-medal-combined-paid-save.json';
fs.writeFileSync(path.join(dataDir,saveFile),saved.raw);
assert.equal(sha(fs.readFileSync(path.join(dataDir,file),'utf8')),sha(raw));
for(const f of runtimeFiles)
  assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),runtimeSha256[f],`${f} changed during run`);
const result={source:file,sourceSha256:sha(raw),runtimeSha256,start,cost,cycles,
  beforeUpgrade,upgrade,final,saveFile,saveSha256:saved.sha256,
  scope:'Real cleanser payments, domain battle settlement and storage upgrade; no free resources or troops.'};
fs.writeFileSync(path.join(dataDir,'p395-quantum-steam32.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({start,cost,cycles:cycles.map(c=>({index:c.index,outcome:c.outcome,
  gain:c.gain,loss:c.loss,alert:c.after.alert})),final,saveSha256:saved.sha256},null,2));
