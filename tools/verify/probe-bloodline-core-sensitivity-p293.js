'use strict';
// Conditional combat sensitivity only: sets bloodline counts without acquiring or paying for them.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const entities=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
assert.equal(entities[180002]['itemPill:AddATK'],10);
assert.equal(entities[180002]['itemPill:LimitNum'],30);
assert.deepEqual(entities[380019]['market:Need'],[180001,20]);
assert.deepEqual(entities[380019]['market:Get'],[180002,1]);
assert.deepEqual(entities[380029]['market:Need'],[180002,3]);
assert.deepEqual(entities[380029]['market:Get'],[180003,1]);
const staticCoreSources=Object.entries(entities).flatMap(([id,entity])=>Object.entries(entity)
  .filter(([key,value])=>key.endsWith(':Get')&&JSON.stringify(value).includes('[170011,')).map(([key])=>({id,key})));
const source='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const alerts=[4900,5000],usesList=[0,1,10,30,100,300],seeds=Array.from({length:11},(_,i)=>i+1);
const rows=[];
for(const alert of alerts)for(const uses of usesList)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  run(`S.killValues.godSlaughter=${alert};S.bloodline.star_trooper=${uses};Date.now=()=>1790496000000;
    globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const hpPerSoldier=run("battleVitals('star_trooper',1,true).hp");
  const beforeSoldiers=run('formSoldierCount()'),beforeCore=run('S.items.godCore');
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  rows.push({alert,uses,seed,hpPerSoldier,callbacks,result:run("document.getElementById('battle-result').className"),
    soldiersLost:beforeSoldiers-run('formSoldierCount()'),coreGain:run('S.items.godCore')-beforeCore,
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')});
}
const byCondition=[];
for(const alert of alerts)for(const uses of usesList){
  const set=rows.filter(r=>r.alert===alert&&r.uses===uses);
  byCondition.push({alert,uses,hpPerSoldier:set[0].hpPerSoldier,wins:set.filter(r=>r.result==='win').length,
    minSoldiersLost:Math.min(...set.map(r=>r.soldiersLost)),maxSoldiersLost:Math.max(...set.map(r=>r.soldiersLost)),
    winSeeds:set.filter(r=>r.result==='win').map(r=>r.seed)});
}
// A separate source-formula candidate: 180002 adds 10% of configured base ATK per use, at most 30 uses.
// Only the star trooper receives this conditional bonus. No pill is acquired or paid in this probe.
const attackDosesList=[0,1,3,10,30],attackRows=[];
for(const alert of alerts)for(const attackDoses of attackDosesList)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  run(`S.killValues.godSlaughter=${alert};Date.now=()=>1790496000000;
    globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__baseWeaponAttack=weaponAttack;
    weaponAttack=uk=>__baseWeaponAttack(uk)+(uk==='star_trooper'?CFG.units.star_trooper.atk*0.1*${attackDoses}:0);
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const beforeSoldiers=run('formSoldierCount()');
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  attackRows.push({alert,attackDoses,seed,callbacks,result:run("document.getElementById('battle-result').className"),
    soldiersLost:beforeSoldiers-run('formSoldierCount()')});
}
const byAttack=[];
for(const alert of alerts)for(const attackDoses of attackDosesList){
  const set=attackRows.filter(r=>r.alert===alert&&r.attackDoses===attackDoses);
  byAttack.push({alert,attackDoses,wins:set.filter(r=>r.result==='win').length,
    minSoldiersLost:Math.min(...set.map(r=>r.soldiersLost)),maxSoldiersLost:Math.max(...set.map(r=>r.soldiersLost)),
    winSeeds:set.filter(r=>r.result==='win').map(r=>r.seed)});
}
// The same count can be invested in different owned unit types. Compare actual formation roles.
const allocationUnits=['electro_trooper','armored_trooper','alloy_special','star_trooper','gold_cavalry','archer'];
const allocationUses=[30,300],allocationRows=[];
for(const alert of alerts)for(const unitType of allocationUnits)for(const uses of allocationUses)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  run(`S.killValues.godSlaughter=${alert};S.bloodline['${unitType}']=${uses};Date.now=()=>1790496000000;
    globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const beforeSoldiers=run('formSoldierCount()');
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  allocationRows.push({alert,unitType,uses,seed,callbacks,result:run("document.getElementById('battle-result').className"),
    soldiersLost:beforeSoldiers-run('formSoldierCount()')});
}
const byAllocation=[];
for(const alert of alerts)for(const unitType of allocationUnits)for(const uses of allocationUses){
  const set=allocationRows.filter(r=>r.alert===alert&&r.unitType===unitType&&r.uses===uses);
  byAllocation.push({alert,unitType,uses,wins:set.filter(r=>r.result==='win').length,
    minSoldiersLost:Math.min(...set.map(r=>r.soldiersLost)),maxSoldiersLost:Math.max(...set.map(r=>r.soldiersLost)),
    winSeeds:set.filter(r=>r.result==='win').map(r=>r.seed)});
}
for(const alert of alerts)assert.deepEqual(byAttack.find(r=>r.alert===alert&&r.attackDoses===0).winSeeds,
  byCondition.find(r=>r.alert===alert&&r.uses===0).winSeeds);
for(const alert of alerts)for(const uses of allocationUses)assert.deepEqual(
  byAllocation.find(r=>r.alert===alert&&r.unitType==='star_trooper'&&r.uses===uses).winSeeds,
  byCondition.find(r=>r.alert===alert&&r.uses===uses).winSeeds);
assert.equal(byCondition.find(r=>r.alert===4900&&r.uses===0).wins,1);
assert.equal(byCondition.find(r=>r.alert===5000&&r.uses===0).wins,0);
assert.equal(byCondition.find(r=>r.alert===4900&&r.uses===300).wins,2);
assert.equal(byAllocation.find(r=>r.alert===4900&&r.unitType==='electro_trooper'&&r.uses===300).wins,10);
assert.equal(byAttack.find(r=>r.alert===4900&&r.attackDoses===30).wins,3);
assert.ok(byAllocation.filter(r=>r.alert===5000).every(r=>r.wins===0));
assert.ok(byAttack.filter(r=>r.alert===5000).every(r=>r.wins===0));
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const output='docs/codex/reports/data/p293-bloodline-core-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P293',kind:'conditional bloodline allocation and source attack-pill core-fight sensitivity; no acquisition or payment',
  source,sourceSha256:sha(raw),staticCoreSources,alerts,usesList,attackDosesList,allocationUnits,allocationUses,seeds,byCondition,rows,byAttack,attackRows,byAllocation,allocationRows},null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),staticCoreSources,byCondition,byAttack,byAllocation,output},null,2));
