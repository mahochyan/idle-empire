'use strict';
// From the paid stage-6 full roster: farm blood, buy real cleansers, win guardian at paid reduced alert,
// replenish troop losses, produce knowledge, and pay electric knowledge 16->17. Fixed RNG is an existence route.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const original=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
const target=original.formation,targetByType={};
for(const groups of Object.values(target))for(const g of groups)targetByType[g.type]=(targetByType[g.type]||0)+g.count;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${original.ts}+(S.tick-${original.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));`);
const rng=seed=>run(`globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
const snapshot=()=>run("({tick:S.tick,tech:S.res.tech,techCap:resCap('tech'),medal:S.res.medal,stone:S.items.guardianStone,blood:S.items.sacredBlood,cleanser:S.items.domainCleanser,guardianAlert:S.killValues.godGuardian,phantomAlert:S.killValues.godPhantom,army:armyCount(),deployed:formSoldierCount(),food:S.res.food,steel:S.res.steel,iron:S.res.iron,copper:S.res.copper})");
const initial=snapshot();
assert.equal(initial.army,671);assert.equal(initial.deployed,626);assert.equal(initial.guardianAlert,4500);
assert.equal(initial.stone,19);assert.equal(initial.cleanser,0);
function fight(domain,seed){
  rng(seed);run(`openMaterialDomain('${domain}')`);assert.equal(run('S.battleActive'),true,domain+' opens');
  const enemy=run("({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,domain+' callbacks');
  const result=run("document.getElementById('battle-result').className");
  assert.equal(result,'win',domain+' fixed seed '+seed);
  const after=snapshot();run('exitBattle()');
  return{domain,seed,enemy,callbacks,after};
}
let seconds=0,minFood=initial.food;
const phases={market:0,food:0,stone:0,coal:0,copper:0,iron:0,steel:0,tech:0,training:0};
let phase='market';
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,key);
  if(resource==='food')assert.equal(run("setPopAlloc('food',1002)")?.ok,true);
  else{assert.equal(run("setPopAlloc('food',100)")?.ok,true);assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true)}
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const result=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=result.n;phases[phase]+=result.n;minFood=Math.min(minFood,result.min);
  assert.ok(result.min>0,'food depleted');return result;
}
function fillBasic(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  assign(resource);assert.ok(advanceUntil(`S.res.${resource}>=${targetValue}`,15000).done,resource+' fill timeout');
}
function fillProcessed(resource,targetValue){
  if(val(resource)>=targetValue)return;
  assert.ok(targetValue<=cap(resource),resource+' target exceeds cap');
  let cycles=0;
  while(val(resource)<targetValue&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${targetValue}`,7000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=targetValue,resource+' fill exhausted');
}
function fill(resource,targetValue){if(val(resource)>=targetValue)return;
  if(['copper','iron','steel'].includes(resource))fillProcessed(resource,targetValue);
  else fillBasic(resource,targetValue)}
function replenish(){
  run("clrForm('expedition')");assert.equal(run('formSoldierCount()'),0);
  const losses={},paidTraining={};
  for(const [unit,wanted] of Object.entries(targetByType)){
    const available=run(`poolAvail('${unit}')`),short=Math.max(0,wanted-available);
    losses[unit]=short;if(!short)continue;
    const cost=run(`({...CFG.units.${unit}.cost})`),order={steel:0,iron:1,copper:2,food:3,stone:4,wood:5};
    for(const [resource,per] of Object.entries(cost).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9))){
      fill(resource,per*short);paidTraining[resource]=(paidTraining[resource]||0)+per*short;
    }
    const queued=run(`train('${unit}',${short})`);assert.equal(queued?.ok,true,unit+' train '+JSON.stringify(queued));
    phase='training';assert.ok(advanceUntil(`poolAvail('${unit}')>=${wanted}`,3000).done,unit+' training');
  }
  for(const [row,groups] of Object.entries(target))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,row+slot+' form');
  });
  assert.equal(run('formSoldierCount()'),626);
  return{losses,paidTraining,after:snapshot()};
}
const cycles=[];
for(let cycle=1;cycle<=3;cycle++){
  const before=snapshot(),phantom=[];
  while(run('S.items.sacredBlood')<3&&phantom.length<10){
    const prior=snapshot(),result=fight('phantomFlower',1);
    assert.ok(result.after.blood>prior.blood);phantom.push(result);
  }
  assert.ok(run('S.items.sacredBlood')>=3,'blood cost');
  rng(291);phase='market';let marketSeconds=0;
  while(run('S.marketSpecial.offers.domainCleanser')<1&&marketSeconds<300000){
    const moved=run('offlineAdvanceSec(60,1)');assert.equal(moved.elapsed,60);
    marketSeconds+=60;seconds+=60;phases.market+=60;minFood=Math.min(minFood,val('food'));
  }
  assert.ok(run('S.marketSpecial.offers.domainCleanser')>=1,'market cleanser offer');
  const bought=run("buyMarketSpecial('domainCleanser')");assert.equal(bought?.ok,true,JSON.stringify(bought));
  assert.equal(run('S.items.domainCleanser'),1);
  const cleansed=run("useDomainCleanser('guardianStone')");assert.equal(cleansed?.ok,true,JSON.stringify(cleansed));
  assert.equal(cleansed.alert,4400);
  const beforeFight=snapshot(),guardian=fight('guardianStone',4);
  assert.equal(guardian.after.stone-beforeFight.stone,110);
  assert.equal(guardian.after.blood-beforeFight.blood,3,'guardian blood refund funds next cleanser');
  assert.equal(guardian.after.guardianAlert,4500);
  const recovery=cycle<3?replenish():null;
  cycles.push({cycle,before,phantom:phantom.map(x=>({seed:x.seed,enemy:x.enemy,after:x.after,callbacks:x.callbacks})),
    marketSeconds,bought,cleansed,beforeFight,guardian,recovery,after:snapshot()});
}
assert.ok(run('S.items.guardianStone')>=340,'stone for electric knowledge 17');
assert.equal(run('S.eraStorage.electricKnowledge'),16);
const upgradeCost=run("eraStorageCost('electricKnowledge')");
assert.deepEqual({...upgradeCost},{tech:34000000,guardianStone:340});
assign('tech');
assert.ok(advanceUntil('S.res.tech>=34000000',10000).done,'knowledge production');
const beforeUpgrade=snapshot(),upgraded=run("upgradeEraStorage('electricKnowledge')");
assert.equal(upgraded?.ok,true,JSON.stringify(upgraded));
assert.equal(run('S.eraStorage.electricKnowledge'),17);
assert.equal(beforeUpgrade.tech-run('S.res.tech'),34000000);
assert.equal(beforeUpgrade.stone-run('S.items.guardianStone'),340);
assert.ok(run("resCap('tech')")>beforeUpgrade.techCap);
assert.equal(run('save().ok'),true);
const terminal=snapshot(),out=e.store.get('rts_save'),reload=environment({rts_save:out});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.eraStorage.electricKnowledge'),17);
assert.equal(reload.run('S.items.guardianStone'),terminal.stone);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const saveFile='p304-electric-knowledge17-guardian-paid-save.json',reportFile='p304-electric-knowledge17-guardian-paid.json';
const report={batch:'P304',kind:'fixed deterministic paid three-cleanser guardian source and electric knowledge level17',
  unit:'resource units, soldier counts, seconds; market uses offlineAdvanceSec(60,1), all other production/training uses tick(); browser animation and player clicks excluded',
  source,sourceSha256:sha(raw),initial,cycles,upgradeCost,beforeUpgrade,upgraded,terminal,
  simulatedSeconds:seconds,marketRatio1Seconds:phases.market,onlineTickSeconds:seconds-phases.market,phases,minFood,saveFile,saveSha256:sha(out)};
fs.writeFileSync(path.join(data,saveFile),out,'utf8');
fs.writeFileSync(path.join(data,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,cycles:cycles.map(x=>({cycle:x.cycle,phantomBattles:x.phantom.length,
  marketSeconds:x.marketSeconds,guardianLoss:x.beforeFight.army-x.guardian.after.army,stone:x.after.stone,recovered:!!x.recovery})),
  upgradeCost,beforeUpgrade,terminal,simulatedSeconds:seconds,marketRatio1Seconds:phases.market,
  onlineTickSeconds:seconds-phases.market,phases,minFood,saveFile,saveSha256:report.saveSha256},null,2));
