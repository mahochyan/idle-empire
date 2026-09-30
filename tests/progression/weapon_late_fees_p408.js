'use strict';
// Explicit isolated fee/legacy-save fixtures; not natural material acquisition proof.
// Lv9 crossing verifies our one-action/one-fee rule. The source's consecutive if
// statements can charge Need2 again within the same Lv9-to-10 call.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const root=path.resolve(__dirname,'../..');
const copy=value=>JSON.parse(JSON.stringify(value));
const hash=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const mappings=[['gatling',230062],['mortar',230063],['electroRifle',230072],
  ['electroSniper',230073],['starFighter',230082],['starMissile',230083]];
const resourceMap={150010:'steel',170011:'godCore'};
const costFromSource=list=>Object.fromEntries(list.map(([id,n])=>{
  assert.ok(resourceMap[id],`Unknown source material ${id}`);return[resourceMap[id],n];
}));
const checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true});console.log('PASS '+name)}
  catch(error){checks.push({name,ok:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack)}}
function fixture(key,level,progress,steel,core){
  const e=environment();
  e.run(`S.sciences=Object.keys(activeSciences());
    for(const w of Object.values(S.weaponForge))w.researched=true;
    S.weaponForge['${key}']={researched:true,level:${level},progress:${progress},equipped:true};
    S.res.steel=${steel};S.items.godCore=${core}`);
  return e;
}
function snapshot(e,key){return copy(e.run(`({steel:S.res.steel,core:S.items.godCore,state:S.weaponForge['${key}']})`))}
for(const [key,id]of mappings){
  const early=costFromSource(source[id]['weapon:Need']);
  const late=costFromSource(source[id]['weapon:Need2']);
  check(`${key}: source early fee and Lv10 Need2`,()=>{
    const e=environment();
    assert.deepEqual(copy(e.run(`weaponForgeStepCost('${key}',9)`)),early);
    assert.deepEqual(copy(e.run(`weaponForgeStepCost('${key}',10)`)),late);
    assert.deepEqual(copy(e.run(`weaponForgeStepCost('${key}',19)`)),late);
  });
  check(`${key}: actual 9→10 crossing uses old fee once, then core only`,()=>{
    const e=fixture(key,9,0,early.steel+123,early.godCore+late.godCore*2);
    e.run(`S.weaponForge['${key}'].progress=weaponForgeSteps('${key}')-1`);
    const first=copy(e.run(`forgeWeapon('${key}')`));
    assert.equal(first.ok,true);assert.equal(first.level,10);assert.equal(first.progress,0);
    assert.deepEqual(first.cost,early);
    const second=copy(e.run(`forgeWeapon('${key}')`));
    assert.equal(second.ok,true);assert.deepEqual(second.cost,late);
    assert.equal(e.run('S.res.steel'),123);assert.equal(e.run('S.items.godCore'),late.godCore);
    const third=copy(e.run(`forgeWeapon('${key}')`));
    assert.equal(third.ok,true);assert.deepEqual(third.cost,late);
    assert.equal(e.run('S.res.steel'),123);assert.equal(e.run('S.items.godCore'),0);
    assert.equal(e.run(`S.weaponForge['${key}'].progress`),2);
  });
  check(`${key}: core shortage cannot consume steel or change saved progress`,()=>{
    const e=fixture(key,10,3,100000,late.godCore-1);
    assert.equal(e.run('save().ok'),true);const raw=e.store.get('rts_save'),before=snapshot(e,key);
    const out=copy(e.run(`forgeWeapon('${key}')`));
    assert.equal(out.ok,false);assert.equal(out.reason,'insufficient-resources');
    assert.deepEqual(out.cost,late);assert.deepEqual(snapshot(e,key),before);
    assert.equal(e.store.get('rts_save'),raw);
  });
  check(`${key}: v36 high-level legacy state loads intact and pays new fee`,()=>{
    const e=fixture(key,12,7,0,late.godCore);
    assert.equal(e.run('save().ok'),true);const raw=e.store.get('rts_save');
    assert.equal(JSON.parse(raw).v,36);const restored=environment({rts_save:raw});
    assert.equal(restored.run('loadSaveAndApply().status'),'ok');
    assert.equal(restored.store.get('rts_save'),raw);
    assert.deepEqual(snapshot(restored,key),snapshot(e,key));
    const out=copy(restored.run(`forgeWeapon('${key}')`));
    assert.equal(out.ok,true);assert.deepEqual(out.cost,late);
    assert.equal(restored.run(`S.weaponForge['${key}'].level`),12);
    assert.equal(restored.run(`S.weaponForge['${key}'].progress`),8);
    assert.equal(restored.run(`S.weaponForge['${key}'].equipped`),true);
    const fresh=environment({rts_save:restored.store.get('rts_save')});
    assert.equal(fresh.run('loadSaveAndApply().status'),'ok');
    assert.equal(fresh.run('S.res.steel'),0);assert.equal(fresh.run('S.items.godCore'),0);
    assert.deepEqual(snapshot(fresh,key),snapshot(restored,key));
  });
  check(`${key}: failed primary save rolls back late fee and progress`,()=>{
    const e=fixture(key,10,4,100000,100);
    assert.equal(e.run('save().ok'),true);const raw=e.store.get('rts_save'),before=snapshot(e,key);
    e.run(`const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{
      if(key==='rts_save')throw Error('P408 simulated quota');originalSet(key,value)};`);
    const out=copy(e.run(`forgeWeapon('${key}')`));
    assert.equal(out.ok,false);assert.equal(out.reason,'save-failed');
    assert.deepEqual(snapshot(e,key),before);assert.equal(e.store.get('rts_save'),raw);
  });
}
const artifacts=['config.js','math.js','tests/progression/harness.js',
  'tests/progression/weapon_late_fees_p408.js','210(1)_unpacked/_analysis/entities_table.json'];
const result={scope:'Six real forge actions, Lv9/10 boundary, insufficient materials, v36 fixtures, rollback. Not natural gameplay reachability.',
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  environment:{node:process.version,platform:process.platform},
  hashes:Object.fromEntries(artifacts.map(rel=>[rel,hash(rel)])),checks,
  passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length};
const output='docs/codex/reports/data/p408-weapon-fee-'+(process.argv.includes('--baseline')?'baseline':'regression')+'.json';
// --stdout keeps historical P408 evidence intact when another change runs compatibility checks.
if(process.argv.includes('--stdout'))console.log(JSON.stringify(result));
else fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,passed:result.passed,failed:result.failed}));
if(result.failed)process.exitCode=1;
