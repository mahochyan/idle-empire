'use strict';
// Paid science, steel, alloy and battle-quality branch from P405's L80 full-ready save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p405-mainline-l80-full-ready-save.json';
const sourceRaw=fs.readFileSync(path.join(data,source),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceHash='a3e1b814bc4f05db50b0fe1d9f7f7a59f5364fb6a3c6d27f60cc39b10020ea75';
assert.equal(hash(sourceRaw),sourceHash);
const l79Raw=fs.readFileSync(path.join(data,'p405-mainline-continuous-final-save.json'),'utf8');
assert.equal(hash(l79Raw),'0dc1cfc2a1d80bdd4e73df5f31c7b6ab5718dee901a2e9f892a62aa88752be6f');
const mainline=JSON.parse(fs.readFileSync(path.join(data,'p405-mainline-continuous.json'),'utf8'));
assert.equal(mainline.finalSha256,hash(l79Raw));
assert.equal(mainline.checkpoints.l80Ready.sha256,sourceHash);
assert.equal(mainline.stop.online,11200);
assert.deepEqual(mainline.stop.paid,{food:29000,silver:2000,gold:1300});
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeHash=Object.fromEntries(runtimeFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
const env=environment({rts_save:sourceRaw.trim()}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),79);
assert.equal(run('formSoldierCount()'),117);
run(`(()=>{
  const g=globalThis,NativeDate=Date;
  g.__p405quality={now:${JSON.parse(sourceRaw).ts},timerNow:0,nextTickMs:CFG.tickMs,timerId:1,timers:new Map(),debits:[]};
  g.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[g.__p405quality.now]))}
    static now(){return g.__p405quality.now}};
  g.Math.random=()=>0.5;
  const nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      className:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},
      setAttribute(){},appendChild(){},remove(){}});
    return nodes.get(id)
  };
  const originalTick=tick;g.tick=function(){const out=originalTick();g.__p405quality.now+=1000;return out};
  const originalPay=payTrainingCost;payTrainingCost=(cost,n)=>{
    const before=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,S.res[k]]));
    originalPay(cost,n);
    const paid=Object.fromEntries(trainingCostKeys(cost).map(k=>[k,before[k]-S.res[k]]));
    for(const k of trainingCostKeys(cost))if(Math.abs(paid[k]-cost[k]*n)>1e-6)throw Error('training cost mismatch '+k);
    g.__p405quality.debits.push({n,paid,tick:S.tick});
  };
  g.setTimeout=(fn,delay=0)=>{const p=g.__p405quality,id=p.timerId++;
    p.timers.set(id,{fn,at:p.timerNow+Math.max(0,Number(delay)||0)});return id};
  g.clearTimeout=id=>g.__p405quality.timers.delete(id);
  g.__p405qualityStep=()=>{
    const p=g.__p405quality;let selected=null;
    for(const [id,timer]of p.timers)
      if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
        selected={id,timer};
    if(!selected)return false;
    while(p.nextTickMs<=selected.timer.at){p.timerNow=p.nextTickMs;g.tick();p.nextTickMs+=CFG.tickMs}
    p.timerNow=Math.max(p.timerNow,selected.timer.at);
    p.timers.delete(selected.id);selected.timer.fn();return true;
  };
})()`);
const copy=x=>JSON.parse(JSON.stringify(x));
const snap=()=>copy(run(`({tick:S.tick,now:Date.now(),science:S.sciences.slice(),
  res:{...S.res},pop:{...S.popAlloc},academy:bldSt('academy').lv,
  cap:resCap('tech'),alloyArmory:bldSt('alloy_armory').lv,
  queue:S.queue.alloy_special?.count||0,pool:S.pool.alloy_special||0,
  army:armyCount(),deployed:formSoldierCount(),defeated:S.defeated.length,
  foodRate:prodRate('food'),upkeep:totalUpkeep(),foodNet:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost})`));
const report={baselineHead:'9fd54b76e3587aed069bdc4d5df61a0fd2b97778',source,sourceHash,
  l79Hash:hash(l79Raw),upstreamRefill:{onlineSeconds:11200,paid:mainline.stop.paid},
  runtimeHash,method:'fixed random 0.5, actual costs, tick production and callbacks, no injected game state',
  initial:snap(),onlineSeconds:0,battleCallbackMilliseconds:0,minFood:snap().res.food,
  ledger:[],qualityReady:null,battle:null,stop:null};
function note(action,detail,before){report.ledger.push({action,...detail,before,after:snap()})}
function waitUntil(expression,limit,label){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&n<${limit}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  report.onlineSeconds+=x.n;report.minFood=Math.min(report.minFood,x.min);
  assert.ok(x.done,`${label}: ${JSON.stringify(x)} ${JSON.stringify(snap())}`);
  assert.ok(x.min>0,`${label}: food exhausted`);
  return x.n;
}
function workers(target){
  const before=snap();for(const [k,n]of Object.entries(before.pop))if(n>0)
    assert.equal(run(`setPopAlloc(${JSON.stringify(k)},0)`)?.ok,true);
  for(const [k,n]of Object.entries(target))if(n>0)
    assert.equal(run(`setPopAlloc(${JSON.stringify(k)},${n})`)?.ok,true,`worker ${k}`);
  assert.ok(run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')>0,'food balance');
  note('workers',{target,foodNet:run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')},before);
}
function saveReload(label){
  assert.equal(run('save().ok'),true,label);
  const raw=env.store.get('rts_save'),fresh=environment({rts_save:raw});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok',label);
  for(const expr of ['S.res','S.sciences','S.buildings','S.pool','S.queue','S.formation','S.popAlloc','S.defeated'])
    assert.deepEqual(copy(fresh.run(expr)),copy(run(expr)),label+' '+expr);
  return raw;
}
function building(key,level){
  const before=snap(),cost=copy(run(`bldSt(${JSON.stringify(key)}).lv===0?buildingInitialCost(${JSON.stringify(key)}):upCost(${JSON.stringify(key)})`));
  const paid=copy(run(`buildAct(${JSON.stringify(key)})`));assert.equal(paid.ok,true,`${key} build`);
  const seconds=waitUntil(`bldSt(${JSON.stringify(key)}).lv===${level}&&bldSt(${JSON.stringify(key)}).state==='idle'`,1000,key);
  saveReload(`${key} ${level}`);note('building',{key,level,cost,seconds,paid},before);
}
function science(id){
  const before=snap(),cost=copy(run(`activeSciences()[${JSON.stringify(id)}].cost`));
  const seconds=waitUntil(`S.res.tech>=${cost.tech}`,10000,id+' knowledge');
  const paid=copy(run(`researchScience(${JSON.stringify(id)})`));assert.equal(paid.ok,true,id);
  assert.ok(run(`S.sciences.includes(${JSON.stringify(id)})`));
  saveReload(id);note('science',{id,cost,seconds,paid},before);
}
building('academy',2);
assert.equal(run("resCap('tech')"),9000);
workers({food:13,tech:6});
science('sci_steel');
building('academy',3);
assert.equal(run("resCap('tech')"),11000);
science('sci_alloy_age');
workers({food:14,stone:5});
waitUntil("S.res.stone>=buildingInitialCost('alloy_armory').stone",1000,'alloy armory stone');
building('alloy_armory',1);
assert.equal(run("unitCap('alloy_special')"),8);
// Eight extra recruits cross an upkeep band; fund a real farm upgrade before queuing them.
workers({food:14,wood:5});
waitUntil("S.res.wood>=upCost('farm').wood&&S.res.food>=resCap('food')",2000,'farm resources');
building('farm',4);
waitUntil("S.res.wood>=upCost('farm').wood&&S.res.food>=resCap('food')",2000,'second farm resources');
building('farm',5);
workers({food:14,stone:1,coal:1,iron:1,steel:2});
const beforeTraining=snap();
const train=copy(run("train('alloy_special',8)"));assert.equal(train.ok,true);
assert.equal(train.qty,8);
const trainSeconds=waitUntil("poolAvail('alloy_special')>=8",30000,'eight alloy soldiers');
saveReload('alloy trained');note('train',{unit:'alloy_special',count:8,seconds:trainSeconds,result:train},beforeTraining);
const debits=copy(run('__p405quality.debits'));
const alloyDebits=debits.reduce((sum,x)=>({units:sum.units+x.n,
  food:sum.food+(x.paid.food||0),steel:sum.steel+(x.paid.steel||0)}),{units:0,food:0,steel:0});
assert.deepEqual(alloyDebits,{units:8,food:12000,steel:800});
report.trainingDebits=alloyDebits;
const formation=[['front','gold_cavalry',10],['front','alloy_special',8],
  ['front','silver_heavy',10],['front','silver_heavy',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ['mid','iron_spearman',10],['mid','bronze_guard',10],
  ...Array(4).fill(null).map(()=>['back','archer_silverbow',10])];
const beforeFormation=snap();run("clrForm('expedition')");
const index={front:0,mid:0,back:0};
for(const [row,type,count]of formation){const slot=index[row]++;
  assert.ok(run(`(S.pool[${JSON.stringify(type)}]||0)>=${count}`));
  run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
    S._formModalSel=${JSON.stringify(type)};S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),count);
}
assert.equal(run('formSoldierCount()'),118);
const readyRaw=saveReload('quality ready');
report.qualityReady={army:run('formSoldierCount()'),sha256:hash(readyRaw),formation};
note('formation',{army:118},beforeFormation);
assert.equal(run('selEnemy(79)'),true);
const battleBefore=snap(),timerBefore=run('__p405quality.timerNow');
run('openBattle()');assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__p405qualityStep()'),true);callbacks++}
assert.ok(callbacks<10000);
const round=run('B.round'),won=run('hasLevelDefeated(79)');
const battleMs=run('__p405quality.timerNow')-timerBefore;
run('exitBattle()');const finalRaw=saveReload('L80 outcome');
report.battle={won,round,callbacks,battleMs,before:battleBefore,after:snap()};
report.battleCallbackMilliseconds=battleMs;
report.stop=won?'L80-win':'L80-loss';
report.qualityReady.name='p405-l80-quality-ready-save.json';
report.final={name:'p405-l80-quality-final-save.json',sha256:hash(finalRaw)};
report.ledgerName='p405-l80-quality-ledger.jsonl';
const ledgerRaw=report.ledger.map(row=>JSON.stringify(row)).join('\n')+'\n';
report.ledgerHash=hash(ledgerRaw);
for(const f of runtimeFiles)assert.equal(hash(fs.readFileSync(path.join(root,f))),runtimeHash[f],f+' changed during replay');
assert.equal(hash(fs.readFileSync(path.join(data,source))),sourceHash);
fs.writeFileSync(path.join(data,report.qualityReady.name),readyRaw+'\n');
fs.writeFileSync(path.join(data,report.final.name),finalRaw+'\n');
fs.writeFileSync(path.join(data,report.ledgerName),ledgerRaw);
report.qualityReady.fileSha256=hash(readyRaw+'\n');report.final.fileSha256=hash(finalRaw+'\n');
const {ledger,...summary}=report;
fs.writeFileSync(path.join(data,'p405-l80-quality-alloy.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({sourceHash,onlineSeconds:report.onlineSeconds,trainingDebits:report.trainingDebits,
  ready:report.qualityReady,stop:report.stop,battle:report.battle,final:report.final,minFood:report.minFood},null,2));
