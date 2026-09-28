'use strict';
// A selected deterministic reachability witness: 16 real core battles, paid replenishment,
// medal trade/research, and 200 real nano-armor forge actions. Not a player win-rate claim.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({tick:S.tick,formation:JSON.parse(JSON.stringify(S.formation)),army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,alert:S.killValues.godSlaughter,fruit:S.items.trialFruit,level:S.awakening.star_trooper.level,res:{...S.res}})");
assert.equal(initial.army,671);assert.equal(initial.deployed,626);
assert.equal(initial.core,33);assert.equal(initial.alert,3400);assert.equal(initial.level,5);
const targetByType={};
for(const groups of Object.values(initial.formation))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}+(S.tick-${initial.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=4;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
let seconds=0,minFood=initial.res.food,phase='none';
const phases={food:0,stone:0,coal:0,copper:0,iron:0,steel:0,tech:0,training:0};
const paidTraining={};
run("globalThis.__basePayTrainingCost=payTrainingCost;payTrainingCost=(c,n)=>{const r=__basePayTrainingCost(c,n);for(const[k,v]of Object.entries(c))globalThis.__paidTraining[k]=(globalThis.__paidTraining[k]||0)+v*n;return r};globalThis.__paidTraining={}");
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{
    assert.equal(run("setPopAlloc('food',100)")?.ok,true);
    assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
  }
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const r=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=r.n;minFood=Math.min(minFood,r.min);phases[phase]+=r.n;
  assert.ok(r.min>0,'food depleted');return r;
}
function fillBasic(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),`${resource} target ${target} > capacity ${cap(resource)}`);
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${target}`,10000).done,resource+' fill timed out');
}
function fillProcessed(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),`${resource} target ${target} > capacity ${cap(resource)}`);
  let cycles=0;
  while(val(resource)<target&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${target}`,5000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=target,resource+' fill exhausted');
}
function fill(resource,target){
  if(val(resource)>=target)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,target);
  else fillBasic(resource,target);
}
function rebuildAndPay(){
  run("clrForm('expedition')");
  assert.equal(run('formSoldierCount()'),0);
  const loss={};
  for(const [unit,target]of Object.entries(targetByType)){
    const available=run(`poolAvail('${unit}')`),short=Math.max(0,target-available);
    loss[unit]=short;
    if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`);
    const order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,perUnit]of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      const amount=perUnit*short;
      fill(resource,amount);
      paidTraining[resource]=(paidTraining[resource]||0)+amount;
    }
    const queued=run(`train('${unit}',${short})`);
    assert.equal(queued?.ok,true,`${unit} queue: ${JSON.stringify(queued)}`);
    assert.equal(queued.qty,short);
    phase='training';
    const trained=advanceUntil(`poolAvail('${unit}')>=${target}`,1000);
    assert.ok(trained.done,`${unit} training timed out: ${JSON.stringify(run(`({pool:S.pool['${unit}'],queue:S.queue['${unit}'],res:{...S.res},target:${target},short:${short}})`))}`);
  }
  for(const [row,groups]of Object.entries(initial.formation))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,`${row}${slot} ${u.type} pool`);
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,`${row}${slot} formation`);
  });
  assert.equal(run('armyCount()'),initial.army);
  assert.equal(run('formSoldierCount()'),initial.deployed);
  assert.equal(run("expeditionCount('star_trooper')"),155);
  return loss;
}
const battles=[];
const investment={trade:null,researchCost:null,research:null,forgeStepsToNine:0,forgeStepsToTen:0};
for(let i=0;i<16;i++){
  const alert=3400+i*100,seed=i===15?1:4;
  assert.equal(run('S.killValues.godSlaughter'),alert);
  assert.equal(run('formSoldierCount()'),626);
  run(`globalThis.__rng=${seed}`);
  const before=run("({core:S.items.godCore,army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal})");
  run("openMaterialDomain('medal')");assert.equal(run('S.battleActive'),true);
  const enemy=run("({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true,'timer exhausted');callbacks++}
  assert.equal(run('S.battleActive'),false);
  const result=run("document.getElementById('battle-result').className");
  assert.equal(result,'win',`battle ${i+1} alert ${alert}`);
  run('exitBattle()');
  const after=run("({core:S.items.godCore,army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal})");
  const restored=rebuildAndPay();
  battles.push({step:i+1,alert,seed,enemy,callbacks,before,after,restored,secondsAfter:seconds});
  if(i===14){
    assert.equal(run('S.items.godCore'),789);
    const researchCost=run('({...CFG.weaponForge.nanoArmor.researchCost})');
    investment.researchCost=researchCost;
    const shortage=Math.max(0,researchCost.medal-val('medal'));
    const trades=Math.ceil(shortage/run('beastBoneTradeReward()'));
    if(trades){const result=run(`exchangeBonesForMedals(${trades})`);assert.equal(result?.ok,true,JSON.stringify(result));investment.trade={trades,...result}}
    fill('tech',researchCost.tech);
    const research=run("researchWeapon('nanoArmor')");assert.equal(research?.ok,true,JSON.stringify(research));investment.research=research;
    for(let level=1;level<=9;level++){
      const steps=run("weaponForgeSteps('nanoArmor')");
      for(let step=0;step<steps;step++)assert.equal(run("forgeWeapon('nanoArmor')")?.ok,true,`nano ${level}.${step+1}`);
      investment.forgeStepsToNine+=steps;
      assert.equal(run('S.weaponForge.nanoArmor.level'),level);
    }
    assert.equal(run('S.items.godCore'),101);
    assert.equal(run("setWeaponEquipped('nanoArmor',true)")?.ok,true);
  }
}
assert.equal(run('S.items.godCore'),159);
const finalSteps=run("weaponForgeSteps('nanoArmor')");
assert.equal(finalSteps,28);
investment.forgeStepsToTen=finalSteps;
for(let i=0;i<finalSteps;i++)assert.equal(run("forgeWeapon('nanoArmor')")?.ok,true,`nano 10.${i+1}`);
assert.equal(run('S.weaponForge.nanoArmor.level'),10);
assert.equal(run('S.items.godCore'),47);
assert.equal(run('S.items.trialFruit'),initial.fruit);
assert.equal(run('S.awakening.star_trooper.level'),initial.level);
assert.deepEqual(JSON.parse(JSON.stringify(run('({...__paidTraining})'))),paidTraining);
assert.equal(run('save().ok'),true);
const output=e.store.get('rts_save');
const file='docs/codex/reports/data/p284-awakening-stage5-nano10-paid-save.json';
fs.writeFileSync(path.join(root,file),output,'utf8');
const reload=environment({rts_save:output});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.weaponForge.nanoArmor.level'),10);
assert.equal(reload.run('S.weaponForge.nanoArmor.equipped'),true);
assert.equal(reload.run('S.items.godCore'),47);
assert.equal(reload.run('formSoldierCount()'),626);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const final=run("({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,alert:S.killValues.godSlaughter,fruit:S.items.trialFruit,level:S.awakening.star_trooper.level,forge:{...S.weaponForge.nanoArmor},res:{...S.res}})");
const report={batch:'P284',kind:'selected fixed streams; paid actions and natural battle casualties',source,sourceSha256:sha(raw),
  unit:'simulated online seconds, resources, soldiers',initial,phases,seconds,minFood,paidTraining,investment,battles,final,file,saveSha256:sha(output)};
const reportFile='docs/codex/reports/data/p284-awakening-stage5-nano10-paid.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,battleWins:battles.length,seconds,minFood,phases,paidTraining,
  investment,
  final:{army:final.army,deployed:final.deployed,core:final.core,alert:final.alert,fruit:final.fruit,level:final.level,
    nano:final.forge,tech:final.res.tech,medal:final.res.medal,bone:final.res.bone},file,saveSha256:report.saveSha256},null,2));
