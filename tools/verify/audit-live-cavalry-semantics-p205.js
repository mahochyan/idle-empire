'use strict';
// P205: audit current wind cavalry range and crit semantics from paid P201 saves.
// It calls real expedition and garrison helpers without changing player source or S.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const outputPath=path.join(root,'docs/codex/reports/data/p205-live-cavalry-semantics.json');
const p201=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(p201.batch,'P201');
const inputFiles=['config.js','levels.js','math.js','garrison.js',
  'technology.js','tests/progression/harness.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'tools/verify/audit-live-cavalry-semantics-p205.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
for(const file of ['config.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js']) {
  const old=p201.inputs.find(x=>x.file===file);
  assert.ok(old);
  assert.equal(inputs.find(x=>x.file===file).sha256,old.sha256,
    `${file} 与P201实战基线不同，须重新审计`);
}
// L31 may be under separate tuning, so compare the exact inspected L29/L30
// opponent configuration instead of hard-gating the whole levels.js hash.
function selectCases() {
  const cases=[];
  for(const seed of [1,15]) {
    const profile=p201.profiles.find(x=>x.seed===seed&&x.route==='t2SecondBack73');
    assert.ok(profile);
    const stage=profile.stages.find(x=>x.stage===29);
    assert.ok(stage?.l29PreparedSave);
    assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
    cases.push({kind:'L29-pre-battle',seed,stage:29,save:stage.l29PreparedSave,
      saveSha256:stage.beforeSaveSha256,expectedEnemy:stage.enemy.config,
      expectedWind:15});
    if(seed===15) {
      const l30=profile.stages.find(x=>x.stage===30);
      assert.equal(l30?.battle?.won,true);
      assert.equal(sha(profile.finalSave),profile.finalSaveSha256);
      cases.push({kind:'L30-post-win-replay',seed,stage:30,save:profile.finalSave,
        saveSha256:profile.finalSaveSha256,expectedEnemy:l30.enemy.config,
        expectedWind:profile.final.owned.cavalry_wind});
    }
  }
  return cases;
}
const cases=selectCases();
function installBrowserStandIn(run) {
  run(`globalThis.__p205Timers=new Map();globalThis.__p205TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p205TimerId++;__p205Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p205Timers.delete(id);
    globalThis.__p205Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p205Nodes.has(id))__p205Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p205Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function inspect(item) {
  const world=environment({rts_save:item.save});
  const run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installBrowserStandIn(run);
  const before=plain(run(`({defeated:[...S.defeated],formation:JSON.parse(JSON.stringify(S.formation)),
    resources:{...S.res},essence:{...S.essence},
    wind:(S.pool.cavalry_wind||0)+expeditionCount('cavalry_wind')+
      garrisonCount('cavalry_wind')})`));
  assert.equal(before.wind,item.expectedWind);
  assert.ok(before.formation.front.some(x=>x.type==='cavalry_wind'&&x.count>0));
  assert.equal(before.defeated.at(-1),item.kind==='L29-pre-battle'?28:30);
  const currentEnemy=plain(run(`(()=>{const e=CFG.enemies[${item.stage-1}];
    return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
      bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(currentEnemy,item.expectedEnemy,
    `${item.kind}：敌阵与P201保存时不同`);
  run(`selEnemy(${item.stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  const initialized=plain(run(`({our:B.ourUnits.map(u=>({type:u.type,tag:u.tag,row:u.row,
    hp:u.hp,atk:u.atk,def:u.def})),
    enemy:B.enemyUnits.map(u=>({type:u.type,row:u.row,hp:u.hp})),
    rounds:B.round,maxRound:B.maxRound})`));
  assert.ok(initialized.enemy.some(x=>x.row==='front'&&x.hp>0));
  assert.ok(initialized.enemy.some(x=>x.row==='back'&&x.hp>0));
  const wind=initialized.our.find(x=>x.type==='cavalry_wind');
  const archer=initialized.our.find(x=>x.type==='archer_t1');
  assert.ok(wind&&archer);
  assert.equal(wind.tag,'wind');
  assert.equal(wind.row,'front');
  const range=plain(run(`(()=>{const wind=B.ourUnits.find(u=>u.type==='cavalry_wind');
    const archer=B.ourUnits.find(u=>u.type==='archer_t1');
    Math.random=()=>0.99;
    return{flags:{wind:isRanged(wind.type),archer:isRanged(archer.type)},
      expedition:{wind:getTarget(wind,B.enemyUnits)?.row,
        archer:getTarget(archer,B.enemyUnits)?.row},
      garrison:{wind:getGarrisonTarget(wind,B.enemyUnits)?.row,
        archer:getGarrisonTarget(archer,B.enemyUnits)?.row}}})()`));
  assert.deepEqual(range.flags,{wind:false,archer:true});
  assert.deepEqual(range.expedition,{wind:'front',archer:'back'});
  assert.deepEqual(range.garrison,{wind:'front',archer:'back'});
  const crit=plain(run(`(()=>{const wind=B.ourUnits.find(u=>u.type==='cavalry_wind');
    const foe=B.enemyUnits.find(u=>u.row==='front'&&u.hp>0);
    Math.random=()=>0;
    const expeditionWind=calcDmg({...wind,damageRemainder:0},foe,true);
    const expeditionSpearControl=calcDmg({...wind,tag:'spear',damageRemainder:0},foe,true);
    globalThis.__p205CritFlags=[];
    const originalFinalize=finalizeCombatDamage;
    finalizeCombatDamage=(actor,raw,isCrit)=>{
      __p205CritFlags.push({type:actor.type,tag:actor.tag,isCrit});
      return originalFinalize(actor,raw,isCrit)};
    const garrisonWindDamage=calcGarrisonDmg({...wind,damageRemainder:0},foe);
    const garrisonSpearControlDamage=calcGarrisonDmg(
      {...wind,tag:'spear',damageRemainder:0},foe);
    return{expedition:{wind:expeditionWind,
      spearTagControl:expeditionSpearControl},
      garrison:{windDamage:garrisonWindDamage,
        spearTagControlDamage:garrisonSpearControlDamage,
        critFlags:__p205CritFlags}}})()`));
  assert.equal(crit.expedition.wind.crit,false);
  assert.equal(crit.expedition.spearTagControl.crit,true);
  assert.deepEqual(crit.garrison.critFlags.map(x=>x.isCrit),[false,true]);
  assert.equal(world.store.get('rts_save'),item.save,
    `${item.kind}：审计不应写回主档`);
  return{kind:item.kind,seed:item.seed,stage:item.stage,
    inputSaveSha256:item.saveSha256,
    state:{lastCleared:before.defeated.at(-1),windOwned:before.wind,
      formation:before.formation,resources:before.resources},
    initialized,range,crit,storageUnchanged:true};
}
const observations=cases.map(inspect);
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
if(prior) {
  assert.equal(prior.batch,'P205');
  const stable=value=>JSON.parse(JSON.stringify(value,function(key,item){
    if(key==='id'&&this&&typeof this.type==='string'&&Number.isInteger(this.count))
      return undefined;
    return item;
  }));
  assert.deepEqual(stable(observations),stable(prior.observations),
    'P205 复跑真实调用结果不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const artifact={batch:'P205',sourceHead:head.stdout.trim(),
  method:'Load exact P201 paid L29 pre-battle saves (seeds 1/15) and post-L30 win save (seed 15); initialize true B via openBattle, then call real expedition/garrison target and damage helpers on B actors. Fixed RNG 0.99 exposes reachable backline; RNG 0 tests advertised 10% critical. A spear-tag clone is a positive branch control only. No S or localStorage mutation persisted.',
  note:'This is a read-only semantic audit, not a candidate balance run or player win-rate estimate.',
  sourceCases:cases.map(({save,...rest})=>rest),observations,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P205',observations:observations.map(x=>({kind:x.kind,
  seed:x.seed,saveSha256:x.inputSaveSha256,windOwned:x.state.windOwned,
  targetRows:x.range,crit:x.crit,storageUnchanged:x.storageUnchanged})),
  output:outputPath},null,2));
