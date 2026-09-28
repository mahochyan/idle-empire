'use strict';
// P208: formal-runtime L29 battles from exact P201 paid saves, compared with frozen P207.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const p207Path=path.join(root,'docs/codex/reports/data/p207-live-cavalry-abilities.json');
const outputPath=path.join(root,'docs/codex/reports/data/p208-live-cavalry-formal.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const p207=JSON.parse(fs.readFileSync(p207Path,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const seeds=[1,15];
assert.equal(source.batch,'P201');
assert.equal(p207.batch,'P207');
const inputFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'docs/codex/reports/data/p207-live-cavalry-abilities.json',
  'tools/verify/probe-live-cavalry-formal-p208.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
for(const file of ['config.js','technology.js',
  'tests/progression/harness.js']){
  assert.equal(inputs.find(x=>x.file===file).sha256,
    source.inputs.find(x=>x.file===file)?.sha256,
    `${file} 与P201基线不同`);
}
assert.equal(inputs.find(x=>x.file==='math.js').sha256,
  '11a18712b9df7ceef67cee3f9fbb5205a9c92acaa9104919c2047e28c3ec6ad6');
assert.equal(inputs.find(x=>x.file==='garrison.js').sha256,
  'a16b5ec3ae6f6eec7619e0de8f7386f627c449c1f2ce9a8dfe3ebbf07a9bcc33');
assert.equal(inputs.find(x=>x.file==='docs/codex/reports/data/p207-live-cavalry-abilities.json').sha256,
  'bff9c21a3a861c3e27ed6a9559746b28bc503661cbab830b76bbb1ee7e23c60c');
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
  run(`globalThis.__p208Timers=new Map();globalThis.__p208TimerId=1;
    globalThis.setTimeout=fn=>{const id=__p208TimerId++;__p208Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p208Timers.delete(id);
    globalThis.__p208Step=()=>{const next=__p208Timers.entries().next().value;
      if(!next)return false;__p208Timers.delete(next[0]);next[1]();return true};
    globalThis.__p208Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p208Nodes.has(id))__p208Nodes.set(id,{style:{},innerHTML:'',
        textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
        toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p208Nodes.get(id)};
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
function installObservation(run){
  run(`globalThis.__p208WindCritCount=0;
    globalThis.__p208WindTargets={front:0,mid:0,back:0,none:0,
      bypassFront:0,byType:{}};
    globalThis.__p208OriginalGetTarget=getTarget;
    getTarget=(attacker,enemies)=>{
      const target=__p208OriginalGetTarget(attacker,enemies);
      if(attacker.type==='cavalry_wind'){
        __p208WindTargets[target?.row||'none']++;
        if(target){
          __p208WindTargets.byType[target.type]=
            (__p208WindTargets.byType[target.type]||0)+1;
          const order={front:0,mid:1,back:2};
          const alive=enemies.filter(u=>u.alive!==false);
          const leading=Math.min(...alive.map(u=>order[u.row]));
          if(order[target.row]>leading)__p208WindTargets.bypassFront++;
        }
      }
      return target};
    globalThis.__p208OriginalCalcDmg=calcDmg;
    calcDmg=(attacker,defender,isOur)=>{
      const result=__p208OriginalCalcDmg(attacker,defender,isOur);
      if(attacker.type==='cavalry_wind'&&result.crit)__p208WindCritCount++;
      return result};`);
  const gates=plain(run(`({ranged:isRanged('cavalry_wind'),
    critChance:combatBaseCritChance({type:'cavalry_wind',tag:'wind'})})`));
  assert.equal(gates.ranged,true);
  assert.equal(gates.critChance,0.1);
  return gates;
}
function seedRng(run,seed,stage){
  const initial=(seed*1009+stage*9176)>>>0;
  assert.ok(initial>0);
  run(`globalThis.__p208Rng=${initial};Math.random=()=>{
    let x=__p208Rng;x^=x<<13;x^=x>>>17;x^=x<<5;
    __p208Rng=x>>>0;return __p208Rng/4294967296;}`);
}
function battle(origin,seed,stage){
  let active=restore(origin.save),run=active.run;
  const original=snapshot(run);
  assert.equal(original.defeated.at(-1),stage-1);
  assert.equal(original.army,73);
  const currentEnemy=plain(run(`(()=>{const e=CFG.enemies[${stage-1}];
    return{id:e.id,name:e.name,units:e.units,boss:!!e.boss,
      bossMult:e.bossMult||null,reward:e.reward}})()`));
  assert.deepEqual(currentEnemy,origin.enemy,`L${stage}敌阵较P201时变化`);
  const {formed,deployed}=formPaidArmy(run);
  const before=snapshot(run);
  assert.deepEqual(before.resources,original.resources,'编队改了资源');
  const gates=installObservation(run);
  seedRng(run,seed,stage);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true);
  assert.equal(run('B.enemyCfg.id'),stage);
  assert.equal(run("B.ourUnits.find(u=>u.type==='cavalry_wind')?.row"),'front');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__p208Step()'),true,'异步回调丢失');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'战斗未结算');
  assert.equal(run('B.settled'),true);
  const round=run('B.round'),won=run(`S.defeated.includes(${stage})`);
  const windCritCount=run('__p208WindCritCount');
  const windTargetRows=plain(run('__p208WindTargets'));
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
  return{originSeed:origin.originSeed,seed,stage,mode:'formal',gates,
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
for(const origin of origins)for(const seed of seeds)runs.push(battle(origin,seed,29));
const comparisons=runs.map(r=>{
  const candidate=p207.runs.find(x=>x.originSeed===r.originSeed&&
    x.seed===r.seed&&x.mode==='both');
  assert.ok(candidate,`P207 缺来源${r.originSeed}流${r.seed}双能力候选`);
  assert.equal(candidate.inputSaveSha256,r.inputSaveSha256);
  const fields=['won','round','callbacks','windCritCount','windTargetRows',
    'enemyRemaining','lossByType','lossTotal','actualReward',
    'meritGain','essenceDrops'];
  const fieldMatch=Object.fromEntries(fields.map(k=>
    [k,JSON.stringify(r.battle[k])===JSON.stringify(candidate.battle[k])]));
  for(const key of ['resources','queue','army','owned','merit','essence','defeated'])
    fieldMatch[`after.${key}`]=
      JSON.stringify(r.after[key])===JSON.stringify(candidate.after[key]);
  return{originSeed:r.originSeed,seed:r.seed,
    candidate:{battle:candidate.battle,after:candidate.after,
      afterSaveSha256:candidate.afterSaveSha256},
    formal:{battle:r.battle,after:r.after,afterSaveSha256:r.afterSaveSha256},
    fieldMatch};
});
function owned(run,type){
  return run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
}
function saveReload(active,label){
  const before=snapshot(active.run);
  assert.equal(active.run('save().ok'),true,`${label}保存失败`);
  const saved=active.world.store.get('rts_save');
  assert.equal(typeof saved,'string');
  const reloaded=restore(saved);
  assert.deepEqual(snapshot(reloaded.run),before,`${label}重载状态不一致`);
  return{...reloaded,save:saved,saveSha256:sha(saved)};
}
function replenish(originBattle){
  const targets={bronze_guard:15,cavalry_wind:15,infantry_t1:15,archer_t1:28};
  let active=restore(originBattle.afterSave),run=active.run;
  assert.equal(run('S.defeated.at(-1)'),29);
  const before=snapshot(run),requested={},produced={},pausedQueueSeconds={};
  let minFoodTickEnd=before.resources.food;
  let block=null;
  for(const [type,target] of Object.entries(targets)){
    const have=owned(run,type),queued=run(`S.queue.${type}?.count||0`);
    const need=Math.max(0,target-have-queued);
    requested[type]=need;produced[type]=0;
    if(!need)continue;
    const lock=run(`trainLockReason('${type}')`);
    if(lock){block={type,phase:'lock',reason:lock,have,queued};break}
    const resourceBefore=plain(run('({...S.res})'));
    const action=plain(run(`train('${type}',${need})`));
    if(!action?.ok||action.qty!==need){
      block={type,phase:'queue',action,have,queued,cap:run(`unitCap('${type}')`)};
      break;
    }
    assert.deepEqual(plain(run('({...S.res})')),resourceBefore,'排队提前扣资源');
  }
  run(`globalThis.__p208Paid=[];globalThis.__p208OriginalPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{const type=Object.keys(CFG.units)
      .find(k=>CFG.units[k].cost===cost);__p208OriginalPay(cost,n);
      __p208Paid.push({type,count:n,cost:{...cost}})};`);
  const ready=()=>Object.entries(targets).every(([type,target])=>owned(run,type)>=target);
  let seconds=0;
  while(!block&&!ready()&&seconds<7200){
    const prior=plain(run('S.queue'));
    run('tick()');seconds++;
    minFoodTickEnd=Math.min(minFoodTickEnd,run('S.res.food'));
    const after=plain(run('S.queue'));
    for(const [type,q] of Object.entries(after)){
      if(q.count>0&&q.reason){const key=`${type}: ${q.reason}`;
        pausedQueueSeconds[key]=(pausedQueueSeconds[key]||0)+1}
      const made=(prior[type]?.count||0)-q.count;
      if(made>0)produced[type]=(produced[type]||0)+made;
    }
  }
  const paid=plain(run('__p208Paid'));
  const trainingDue={};
  for(const item of paid){
    assert.ok(Object.hasOwn(targets,item.type),`未知训练付款 ${item.type}`);
    for(const [rk,c] of Object.entries(item.cost))
      trainingDue[rk]=(trainingDue[rk]||0)+c*item.count;
  }
  for(const [type,count] of Object.entries(produced))
    assert.equal(paid.filter(x=>x.type===type).reduce((n,x)=>n+x.count,0),count,
      `${type} 实产与付款人数不符`);
  if(!block&&!ready())block={phase:'training-time-or-resource',seconds,
    queue:plain(run('S.queue')),resources:plain(run('S.res'))};
  active=saveReload(active,'L30补编');
  return{active,summary:{targets,before,requested,produced,paid,
    trainingDue,pausedQueueSeconds,minFoodTickEnd,seconds,
    ready:!block&&ready(),block,after:snapshot(active.run),
    afterSaveSha256:active.saveSha256,
    afterSave:active.save}};
}
let continuation=null;
const flow15=runs.find(r=>r.originSeed===15&&r.seed===15);
assert.ok(flow15);
if(flow15.battle.won){
  const recovery=replenish(flow15);
  let l30=null;
  if(recovery.summary.ready){
    const stage30=source.profiles.find(p=>p.seed===15&&p.route==='t2SecondBack73')
      .stages.find(s=>s.stage===30);
    assert.ok(stage30?.enemy?.config);
    l30=battle({originSeed:15,save:recovery.active.save,
      saveSha256:recovery.active.saveSha256,
      enemy:stage30.enemy.config},15,30);
  }
  continuation={sourceOriginSeed:15,sourceBattleSeed:15,
    recovery:recovery.summary,l30};
}else{
  continuation={sourceOriginSeed:15,sourceBattleSeed:15,
    recovery:null,l30:null,block:'formal L29 defeat'};
}
const prior=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
if(prior){
  assert.equal(prior.batch,'P208');
  const compact=list=>list.map(r=>({originSeed:r.originSeed,seed:r.seed,
    stage:r.stage,battle:r.battle,before:r.before,
    after:{...r.after,formation:Object.fromEntries(['front','mid','back']
      .map(row=>[row,r.after.formation[row].map(({id,...unit})=>unit)]))}}));
  assert.deepEqual(compact(runs),compact(prior.runs),'P208复跑战果不一致');
  for(let i=0;i<comparisons.length;i++)
    for(const [key,expected] of Object.entries(prior.comparisons[i].fieldMatch))
      assert.equal(comparisons[i].fieldMatch[key],expected,
        `P208复跑候选比较变化：${key}`);
  assert.deepEqual(continuation?.recovery?.requested,
    prior.continuation?.recovery?.requested,'P208复跑补编需求不一致');
  assert.deepEqual(continuation?.l30?.battle,
    prior.continuation?.l30?.battle,'P208复跑L30战果不一致');
}
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(head.status,0);
const report={batch:'P208',sourceHead:head.stdout.trim(),
  method:'Exact P201 paid L29 saves; formal math/garrison only, no combat behavior override. Live formation controls, openBattle, async callbacks, endBattle, exitBattle, save/reload. Compare frozen P207 both candidate. Continue formal origin15/flow15 win through live train/tick/payTrainingCost up to 7200s, save/reload, then L30.',
  scope:{seeds,origins:origins.map(({save,...rest})=>rest),
    noOffline:true,noGarrison:true,noResourceInjection:true,
    rng:'xorshift32 initial=(seed*1009+29*9176)>>>0',
    inferenceLimit:'fixed streams, not player win rates'},
  comparisons,runs,continuation,inputs};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({batch:'P208',runs:runs.map(r=>({originSeed:r.originSeed,
  seed:r.seed,won:r.battle.won,round:r.battle.round,loss:r.battle.lossTotal,
  enemyHp:r.battle.enemyRemaining.hp,crit:r.battle.windCritCount})),
  comparisons:comparisons.map(c=>({originSeed:c.originSeed,seed:c.seed,
    allMatch:Object.values(c.fieldMatch).every(Boolean),fieldMatch:c.fieldMatch})),
  recovery:continuation.recovery&&{ready:continuation.recovery.ready,
    seconds:continuation.recovery.seconds,requested:continuation.recovery.requested,
    block:continuation.recovery.block},
  l30:continuation.l30&&{won:continuation.l30.battle.won,
    round:continuation.l30.battle.round,loss:continuation.l30.battle.lossTotal},
  output:outputPath},null,2));
