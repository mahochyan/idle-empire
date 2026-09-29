'use strict';
// P379: one preregistered seed, no outcome selection, from P363 paid 5500-alert save.
// All resources, soldiers and rewards move only through current game actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceFile='p363-crystal-steam24-paid-save.json';
const sourceRaw=fs.readFileSync(path.join(data,sourceFile),'utf8');
assert.equal(sha(sourceRaw),'e91a2e241a07a58409501ffa0ab0d30766a7d0ed15594159368ed2df72e6fb9c');
const source=JSON.parse(sourceRaw),fixedSeed=1;
const target=source.formation,targetByType={};
for(const groups of Object.values(target))for(const u of groups)
  targetByType[u.type]=(targetByType[u.type]||0)+u.count;
assert.equal(Object.values(targetByType).reduce((a,b)=>a+b,0),626);

function boot(raw){
  const world=environment({rts_save:raw}),{run}=world;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
  const save=JSON.parse(raw),initialTick=run('S.tick');
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {
      static now(){return ${save.ts}+(S.tick-${initialTick})*1000}};
    globalThis.__timers=new Map();globalThis.__timerId=1;
    globalThis.setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const item=__timers.entries().next().value;if(!item)return false;
      __timers.delete(item[0]);item[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>{S.log.push({time:'probe',msg:String(m)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=${fixedSeed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};
    globalThis.__trainingPaid={};globalThis.__trainedCount=0;
    const __payP379=payTrainingCost;
    payTrainingCost=function(cost,n){
      const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
      const result=__payP379(cost,n);
      for(const key of trainingCostKeys(cost)){
        const paid=before[key]-S.res[key],expected=cost[key]*n;
        if(Math.abs(paid-expected)>1e-6)throw Error('training debit mismatch '+key);
        __trainingPaid[key]=(__trainingPaid[key]||0)+paid;
      }
      __trainedCount+=n;return result;
    };`);
  return world;
}
function state(run){return run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  queue:Object.values(S.queue).reduce((n,q)=>n+(q?.count||0),0),
  resources:Object.fromEntries(['food','wood','stone','coal','copper','iron','steel','gold','tech']
    .map(k=>[k,S.res[k]])),
  caps:Object.fromEntries(['food','wood','stone','coal','copper','iron','steel']
    .map(k=>[k,resCap(k)])),
  crystal:S.items.godCrystal,alert:S.killValues.godRevival,
  medal:S.res.medal,sciences:S.sciences.length,stage99:S.defeated.includes(99),
  stage100:S.defeated.includes(100)})`)}
function saveAndReload(world,file){
  assert.equal(world.run('save().ok'),true);
  const raw=world.store.get('rts_save');
  fs.writeFileSync(path.join(data,file),raw);
  const check=boot(raw);
  const a=state(world.run),b=state(check.run);
  assert.equal(JSON.stringify(a),JSON.stringify(b),'保存重载状态不一致');
  return{file,sha256:sha(raw),state:a};
}

const world=boot(sourceRaw),{run}=world;
const initial=state(run);
assert.equal(initial.alert,5500);assert.equal(initial.deployed,626);
assert.equal(initial.army,672);assert.equal(initial.crystal,9);
run("openMaterialDomain('godCrystal')");
assert.equal(run('S.battleActive'),true);
const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
let callbacks=0;
while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
const result=run("document.getElementById('battle-result').className");
assert.ok(['win','lose'].includes(result));
const remainingEnemyHp=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
const settled=state(run);
assert.equal(settled.tick,initial.tick,'战斗动画不应推进生产时间');
assert.equal(result==='win'?settled.crystal>initial.crystal:settled.crystal===initial.crystal,true);
run('exitBattle()');
const battleSave=saveAndReload(world,'p379-unselected-battle-settled-save.json');
const battle={fixedSeed,selection:'fixed in probe source before running; no pilot or winner selection',
  enemy,remainingEnemyHp,callbacks,result,initial,settled,loss:initial.deployed-settled.deployed,
  crystalDelta:settled.crystal-initial.crystal,battleSave};
const phases={food:0,wood:0,stone:0,coal:0,copper:0,iron:0,steel:0,gold:0,tech:0,training:0};
let phase='training',onlineSeconds=0,minFood=settled.resources.food,
  minCoal=settled.resources.coal,minSteel=settled.resources.steel;
const value=key=>run(`S.res.${key}`),cap=key=>run(`resCap('${key}')`);
function assign(resource){
  for(const [key,n] of Object.entries(run('({...S.popAlloc})')))if(n>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key+' allocation clear');
  if(resource==='food'){
    assert.equal(run("setPopAlloc('food',999)")?.ok,true);
    assert.equal(run("setPopAlloc('wood',3)")?.ok,true);
  }
  else{
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
  }
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0,
    '净粮率必须为正');
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const out=run(`(()=>{let n=0,mf=S.res.food,mc=S.res.coal,ms=S.res.steel;
    while(!(${expression})&&!(${stop})&&n<${max}){
      tick();n++;mf=Math.min(mf,S.res.food);mc=Math.min(mc,S.res.coal);ms=Math.min(ms,S.res.steel)}
    return{n,done:!!(${expression}),stopped:!!(${stop}),minFood:mf,minCoal:mc,minSteel:ms}})()`);
  onlineSeconds+=out.n;phases[phase]+=out.n;
  minFood=Math.min(minFood,out.minFood);minCoal=Math.min(minCoal,out.minCoal);
  minSteel=Math.min(minSteel,out.minSteel);
  assert.ok(minFood>0,'补兵过程中粮食耗尽');
  return out;
}
function fillBasic(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),resource+' 单笔需求超过仓容');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${needed}`,20000).done,
    resource+' 采集20,000在线秒仍不足');
}
function fillProcessed(resource,needed){
  if(value(resource)>=needed)return;
  assert.ok(needed<=cap(resource),resource+' 单笔需求超过仓容');
  let cycles=0;
  while(value(resource)<needed&&cycles++<100){
    if(value('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(value('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&value('iron')<100000)
      fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=value(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+
      (resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${needed}`,10000,stop);
    assert.ok(value(resource)>before,resource+' 生产停滞');
  }
  assert.ok(value(resource)>=needed,resource+' 达不到本次训练付款');
}
function fill(resource,needed){
  if(value(resource)>=needed)return;
  if(['copper','iron','steel','gold'].includes(resource))fillProcessed(resource,needed);
  else fillBasic(resource,needed);
}
function restoreRoster(){
  const before=state(run),shortages={},expectedPaid={};
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  const order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
  for(const unit of ['archer',...Object.keys(targetByType).filter(key=>key!=='archer')]){
    const wanted=targetByType[unit],short=Math.max(0,wanted-run(`poolAvail('${unit}')`));
    shortages[unit]=short;if(!short)continue;
    assert.equal(run(`queueTotal('${unit}')`),0);
    const cost=run(`({...CFG.units['${unit}'].cost})`);
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);
      expectedPaid[resource]=(expectedPaid[resource]||0)+per*short;
    }
    assign('tech');
    const queued=run(`train('${unit}',${short})`);
    assert.equal(queued?.ok,true,unit+' 训练入队失败');
    assert.equal(queued.qty,short);
    phase='training';
    assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,25000).done,
      unit+' 训练25,000在线秒未完成');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' 库存不足');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';
      S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  const after=state(run),actualPaid=run('({...__trainingPaid})'),trained=run('__trainedCount');
  assert.equal(after.army,672);assert.equal(after.deployed,626);assert.equal(after.queue,0);
  assert.equal(after.alert,before.alert);assert.equal(after.crystal,before.crystal);
  assert.equal(trained,battle.loss);
  for(const [key,cost] of Object.entries(expectedPaid))
    assert.ok(Math.abs((actualPaid[key]||0)-cost)<1e-6,key+' 训练扣费不一致');
  return{before,after,shortages,trained,expectedPaid,actualPaid,onlineSeconds,
    phases,minFood,minCoal,minSteel};
}
const recovery=restoreRoster();
const recoveredSave=saveAndReload(world,'p379-unselected-battle-recovered-save.json');
assert.equal(recoveredSave.state.deployed,626);
const report={batch:'P379',source:{file:sourceFile,sha256:sha(sourceRaw)},targetByType,
  battle,recovery,recoveredSave,sourceHashes:Object.fromEntries(['config.js','levels.js','math.js','garrison.js',
    'technology.js','tests/progression/harness.js','tools/verify/probe-material-continuity-p379.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),
  scope:'One fixed unselected RNG stream, real high-alert material battle, legal production/training recovery and reload. No offline simulation or player save touched.'};
fs.writeFileSync(path.join(data,'p379-material-continuity.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({seed:fixedSeed,alert:initial.alert,result,enemy,
  remainingEnemyHp,loss:battle.loss,crystalDelta:battle.crystalDelta,afterBattle:settled,
  recovery:{onlineSeconds,retrained:recovery.trained,paid:recovery.actualPaid,
    minFood,minCoal,minSteel,final:recovery.after}},null,2));
