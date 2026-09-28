'use strict';
// P207: paired L29 battles from exact P201 paid saves under isolated wind abilities.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const outputPath=path.join(root,'docs/codex/reports/data/p207-live-cavalry-abilities.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const seeds=Array.from({length:16},(_,i)=>i+1);
const modes={current:{range:false,crit:false},rangedOnly:{range:true,crit:false},
  critOnly:{range:false,crit:true},both:{range:true,crit:true}};
assert.equal(source.batch,'P201');
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'tools/verify/probe-live-cavalry-abilities-p207.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
for(const file of ['config.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js']){
  assert.equal(inputs.find(x=>x.file===file).sha256,
    source.inputs.find(x=>x.file===file)?.sha256,
    `${file} 与P201基线不同`);
}
const origins=[1,15].map(originSeed=>{
  const profile=source.profiles.find(x=>x.seed===originSeed&&x.route==='t2SecondBack73');
  assert.ok(profile);
  const stage=profile.stages.find(x=>x.stage===29);
  assert.ok(stage?.l29PreparedSave);
  assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
  return{originSeed,save:stage.l29PreparedSave,saveSha256:stage.beforeSaveSha256,
    enemy:stage.enemy.config,originalBattle:stage.battle};
});
function installHarness(run){
  run(`globalThis.__p207Timers=new Map();globalThis.__p207TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p207TimerId++;__p207Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p207Timers.delete(id);
    globalThis.__p207Step=()=>{const next=__p207Timers.entries().next().value;
      if(!next)return false;__p207Timers.delete(next[0]);next[1]();return true};
    globalThis.__p207Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p207Nodes.has(id))__p207Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p207Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
}
function restore(save){
  const world=environment({rts_save:save}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('saveProtected()'),false);
  installHarness(run);
  return{world,run};
}
function snapshot(run){
  return plain(run(`({tick:S.tick,resources:{...S.res},merit:S.merit,
    essence:{...S.essence},defeated:[...S.defeated],
    workers:{...S.popAlloc},queue:JSON.parse(JSON.stringify(S.queue)),
    army:armyCount(),owned:Object.fromEntries(
      ['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
        .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    formation:JSON.parse(JSON.stringify(S.formation))})`));
}
function formPaidArmy(run){
  run('Math.random=()=>0.5');run("clrForm('expedition')");
  assert.equal(run('regMax()'),15);
  assert.ok(run("rowSlots('front')")>=3&&run("rowSlots('back')")>=2);
  function place(row,index,type,count){
    assert.ok(run(`S.pool.${type}||0`)>=count,`${type} 实付兵池不足`);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&
      S.formation.${row}[${index}]?.count===${count}`),true);
  }
  place('front',0,'bronze_guard',15);place('front',1,'cavalry_wind',15);
  place('front',2,'infantry_t1',15);place('back',0,'archer_t1',13);
  place('back',1,'archer_t1',15);
  const formed=plain(run('JSON.parse(JSON.stringify(S.formation))'));
  const deployed={};
  for(const row of ['front','mid','back'])for(const u of formed[row])
    deployed[u.type]=(deployed[u.type]||0)+u.count;
  assert.deepEqual(deployed,{bronze_guard:15,cavalry_wind:15,
    infantry_t1:15,archer_t1:28});
  assert.equal(run('armyCount()'),73);
  return{formed,deployed};
}
function installCandidate(run,mode){
  run(`globalThis.__p207WindCritCount=0;
    globalThis.__p207WindTargets={front:0,mid:0,back:0,none:0,
      bypassFront:0,byType:{}};
    globalThis.__p207OriginalGetTarget=getTarget;
    getTarget=(attacker,enemies)=>{
      const target=__p207OriginalGetTarget(attacker,enemies);
      if(attacker.type==='cavalry_wind'){
        __p207WindTargets[target?.row||'none']++;
        if(target){
          __p207WindTargets.byType[target.type]=
            (__p207WindTargets.byType[target.type]||0)+1;
          const order={front:0,mid:1,back:2};
          const alive=enemies.filter(u=>u.alive!==false);
          const leading=Math.min(...alive.map(u=>order[u.row]));
          if(order[target.row]>leading)__p207WindTargets.bypassFront++;
        }
      }
      return target};`);
  if(mode.range)run(`globalThis.__p207OriginalIsRanged=isRanged;
    isRanged=type=>type==='cavalry_wind'||__p207OriginalIsRanged(type);`);
  if(mode.crit)run(`globalThis.__p207OriginalFinalize=finalizeCombatDamage;
    globalThis.__p207OriginalCalcDmg=calcDmg;
    finalizeCombatDamage=(attacker,raw,isCrit)=>{
      if(attacker.type==='cavalry_wind'&&!isCrit&&Math.random()<0.1){
        __p207WindCritCount++;
        return __p207OriginalFinalize(attacker,raw,true)}
      return __p207OriginalFinalize(attacker,raw,isCrit)};
    calcDmg=(attacker,defender,isOur)=>{
      const before=__p207WindCritCount;
      const result=__p207OriginalCalcDmg(attacker,defender,isOur);
      if(attacker.type==='cavalry_wind'&&__p207WindCritCount>before)
        result.crit=true;
      return result};`);
  const gates=plain(run(`({ranged:isRanged('cavalry_wind'),
    critShim:${mode.crit?'true':'false'}})`));
  assert.equal(gates.ranged,mode.range);
  return gates;
}
function seedRng(run,seed){
  const initial=(seed*1009+29*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p207Rng=${initial};Math.random=()=>{
    let x=__p207Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p207Rng=x>>>0;return __p207Rng/4294967296;}`);
}
function battle(origin,seed,modeName){
  const mode=modes[modeName];
  let active=restore(origin.save),run=active.run;
  const original=snapshot(run);
  assert.equal(original.defeated.at(-1),28);
  assert.equal(original.army,73);
  const currentEnemy=plain(run(`(()=>{const e=CFG.enemies[28];
    return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
      bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(currentEnemy,origin.enemy,'L29敌阵较P201时变化');
  const {formed,deployed}=formPaidArmy(run);
  const before=snapshot(run);
  assert.deepEqual(before.resources,original.resources,'编队改了资源');
  const gates=installCandidate(run,mode);
  seedRng(run,seed);
  run('selEnemy(28);openBattle()');
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('B.enemyCfg.id'),29);
  assert.equal(run("B.ourUnits.find(u=>u.type==='cavalry_wind')?.row"),'front');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p207Step()'),true,'异步回调丢失');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'战斗未结算');
  assert.equal(run('B.settled'),true);
  const round=run('B.round'),won=run('S.defeated.includes(29)');
  const windCritCount=run('__p207WindCritCount');
  const windTargetRows=plain(run('__p207WindTargets'));
  const enemyRemaining=plain(run(`({groups:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0).length,
    hp:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0)
      .reduce((n,u)=>n+u.hp,0),
    soldiers:B.enemyUnits.filter(u=>u.alive!==false&&u.hp>0)
      .reduce((n,u)=>n+combatSurvivors(u),0),
    byType:Object.fromEntries([...new Set(B.enemyUnits.map(u=>u.type))]
      .map(k=>[k,B.enemyUnits.filter(u=>u.type===k&&u.alive!==false&&u.hp>0)
        .reduce((n,u)=>n+u.hp,0)]))})`));
  run('exitBattle()');
  const after=snapshot(run);
  const lossByType=Object.fromEntries(Object.entries(deployed)
    .map(([type,n])=>[type,n-after.owned[type]]));
  for(const [type,n] of Object.entries(lossByType))
    assert.ok(n>=0&&n<=deployed[type],`${type}战损超界`);
  const actualReward=Object.fromEntries(Object.keys(currentEnemy.reward)
    .map(rk=>[rk,after.resources[rk]-before.resources[rk]]));
  const essenceDrops=Object.fromEntries([...new Set([
    ...Object.keys(before.essence),...Object.keys(after.essence)])]
    .map(k=>[k,(after.essence[k]||0)-(before.essence[k]||0)])
    .filter(([,n])=>n>0));
  const afterSave=active.world.store.get('rts_save');
  assert.equal(typeof afterSave,'string');
  active=restore(afterSave);
  assert.deepEqual(snapshot(active.run),after,'结算存档重载不一致');
  assert.equal(sha(origin.save),origin.saveSha256,'源战前档被改动');
  return{originSeed:origin.originSeed,seed,mode:modeName,gates,
    inputSaveSha256:origin.saveSha256,formation:formed,deployed,
    battle:{won,round,callbacks,windCritCount,windTargetRows,
      enemyRemaining,lossByType,
      lossTotal:Object.values(lossByType).reduce((a,b)=>a+b,0),
      nominalReward:currentEnemy.reward,actualReward,
      meritGain:after.merit-before.merit,essenceDrops},
    before:{resources:before.resources,queue:before.queue,army:before.army,
      owned:before.owned,merit:before.merit,essence:before.essence,
      defeated:before.defeated},
    after:{resources:after.resources,queue:after.queue,army:after.army,
      owned:after.owned,merit:after.merit,essence:after.essence,
      defeated:after.defeated,formation:after.formation},
    afterSaveSha256:sha(afterSave),afterSave,reloaded:true};
}
const runs=[];
for(const origin of origins)for(const seed of seeds)
  for(const modeName of Object.keys(modes))runs.push(battle(origin,seed,modeName));
for(const origin of origins){
  const baseline=runs.find(r=>r.originSeed===origin.originSeed&&
    r.seed===origin.originSeed&&r.mode==='current');
  assert.ok(baseline);
  const actual=baseline.battle,expected=origin.originalBattle;
  for(const key of ['won','round','callbacks','lossByType','lossTotal',
    'actualReward','meritGain','essenceDrops'])
    assert.deepEqual(actual[key],expected[key],
      `P201流${origin.originSeed}的${key}未复现`);
}
const paired=[];
for(const origin of origins)for(const seed of seeds){
  const rows=runs.filter(r=>r.originSeed===origin.originSeed&&r.seed===seed);
  assert.equal(rows.length,4);
  paired.push({originSeed:origin.originSeed,seed,
    sourceSaveSha256:origin.saveSha256,
    outcomes:Object.fromEntries(rows.map(r=>[r.mode,{won:r.battle.won,
      round:r.battle.round,losses:r.battle.lossTotal,
      windCritCount:r.battle.windCritCount,
      windTargetRows:r.battle.windTargetRows,
      enemyRemaining:r.battle.enemyRemaining,
      meritGain:r.battle.meritGain}]))});
}
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
if(prior){
  assert.equal(prior.batch,'P207');
  const numeric=value=>value.map(r=>({originSeed:r.originSeed,seed:r.seed,
    mode:r.mode,gates:r.gates,battle:r.battle,before:r.before,
    after:{...r.after,formation:Object.fromEntries(['front','mid','back']
      .map(row=>[row,r.after.formation[row].map(({id,...unit})=>unit)]))}}));
  assert.deepEqual(numeric(runs),numeric(prior.runs),'P207复跑数值不一致');
  assert.deepEqual(paired,prior.paired,'P207配对汇总复跑不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const report={batch:'P207',sourceHead:head.stdout.trim(),
  method:'Exact P201 paid L29 saves; live formation controls, openBattle, async callbacks, endBattle, exitBattle, save/reload. Isolated VM shims only: isRanged includes cavalry_wind and/or wind attacks gain an extra 10% critical roll through native finalizeCombatDamage, with calcDmg crit flag reflected. No CFG or save injection.',
  scope:{seeds,modes,origins:origins.map(({save,...rest})=>rest),
    noOffline:true,noGarrison:true,
    rng:'xorshift32 initial=(seed*1009+29*9176)>>>0',
    inferenceLimit:'fixed streams, not player win rates'},
  paired,runs,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:'P207',paired,
  output:outputPath},null,2));
