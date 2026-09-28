'use strict';
// Isolated P337 route: produce and pay for 120 star-trooper attack stars, then fight with the unreset P335 RNG.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p335-soul-alert7050-full-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),'fc8eaa036fa8a1943b9c267c855f3ab39daa95c0cfedde2e21dbf07d89b5eb99');
const origin=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')));
const initial=run(`({tick:S.tick,res:{...S.res},steelCap:resCap('steel'),arms:JSON.parse(JSON.stringify(S.armsUp.star_trooper)),
  army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,
  slots:[...S.soulRealmTeam.slots]})`);
assert.equal(initial.steelCap,1922976);assert.equal(initial.arms.atk.stars,0);
assert.equal(initial.army,672);assert.equal(initial.deployed,626);
assert.equal(initial.stone,79);assert.equal(initial.alert,7050);
const rngStart=2740185912;
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${initial.tick})*1000}};
  addLog=msg=>{S.log.push({time:'probe',msg:String(msg)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=${rngStart};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
let onlineSeconds=0,minFood=initial.res.food,phase='none';
const phases={stone:0,coal:0,iron:0,steel:0},payments=[],checkpoints=[];
function val(k){return run(`S.res.${k}`)}
function cap(k){return run(`resCap('${k}')`)}
function assign(resource){
  for(const[k,n]of Object.entries(run('({...S.popAlloc})')))if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  onlineSeconds+=x.n;phases[phase]+=x.n;minFood=Math.min(minFood,x.min);
  assert.ok(x.min>0,'food depleted');return x;
}
function fillBasic(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),resource+' exceeds capacity');
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${target}`,15000).done,resource+' fill timed out');
}
function fillProcessed(resource,target){
  if(val(resource)>=target)return;
  assert.ok(target<=cap(resource),resource+' exceeds capacity');
  let cycles=0;
  while(val(resource)<target&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${target}`,7000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=target,resource+' fill exhausted');
}
for(let star=1;star<=120;star++){
  for(const times of [400,400,200]){
    const cost=times*4000;
    fillProcessed('steel',cost);
    const before=val('steel');
    const action=run(`investArmsUp('star_trooper','atk',${times})`);
    assert.equal(action?.ok,true,JSON.stringify(action));
    assert.equal(action.cost,cost);
    assert.ok(Math.abs(before-val('steel')-cost)<1e-5,'steel payment');
    payments.push({star,times,cost,secondsAfter:onlineSeconds,stars:action.stars,progress:action.progress});
  }
  assert.equal(run('S.armsUp.star_trooper.atk.stars'),star);
  assert.equal(run('S.armsUp.star_trooper.atk.progress'),0);
  if([40,80,100,120].includes(star)){
    assert.equal(run('save().ok'),true);
    const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.armsUp.star_trooper.atk.stars'),star);
    const file=data+`p337-soul-star-attack-${star}-paid-save.json`;
    fs.writeFileSync(path.join(root,file),saved,'utf8');
    checkpoints.push({star,seconds:onlineSeconds,phases:{...phases},minFood,
      stocks:run('({food:S.res.food,stone:S.res.stone,coal:S.res.coal,iron:S.res.iron,steel:S.res.steel})'),
      attack:run("weaponAttack('star_trooper')"),rng:run('__rng'),file,sha256:sha(saved)});
    console.log(JSON.stringify({checkpoint:star,seconds:onlineSeconds,attack:checkpoints.at(-1).attack,sha256:sha(saved)}));
  }
}
assert.equal(payments.reduce((n,p)=>n+p.cost,0),480000000);
assert.equal(run('armyCount()'),672);assert.equal(run('formSoldierCount()'),626);
assert.equal(run('S.items.soulStone'),79);assert.equal(run('S.killValues.soulRealm'),7050);
const rngBeforeBattle=run('__rng');
const paidText=env.store.get('rts_save'),slot=run('S.soulRealmTeam.slots.indexOf(540399)');
assert.ok(slot>=0);
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};`);
assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
assert.ok(callbacks<3000);
const result=run("document.getElementById('battle-result').className");
assert.ok(['win','lose'].includes(result));
const after=run(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
  stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}],rng:__rng})`);
if(result==='win'){assert.equal(after.slot,null);assert.ok(after.stone>79);assert.equal(after.alert,7250)}
else{assert.equal(after.slot,540399);assert.equal(after.alert,7050);assert.equal(after.stone,79)}
run('exitBattle()');
const battleSave=env.store.get('rts_save'),battleReload=environment({rts_save:battleSave});
assert.equal(battleReload.run('loadSaveAndApply().status'),'ok');
assert.equal(battleReload.run('S.armsUp.star_trooper.atk.stars'),120);
assert.equal(battleReload.run('S.items.soulStone'),after.stone);
assert.equal(battleReload.run('S.killValues.soulRealm'),after.alert);
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const battleFile=data+'p337-soul-star-attack-120-first-battle-save.json';
fs.writeFileSync(path.join(root,battleFile),battleSave,'utf8');
const report={batch:'P337',kind:'real online production and paid attack armament then same-stream soul elite battle',
  sourceFile,sourceSha256:sha(raw),initial,rngStart,unit:'simulated online seconds, steel, soldiers, stars and battle HP',
  onlineSeconds,phases,minFood,totalPaidSteel:480000000,payments,checkpoints,rngBeforeBattle,
  paidSaveSha256:sha(paidText),battle:{slot,enemy,result,after,callbacks,battleFile,battleSha256:sha(battleSave)},
  limits:['The input is a historical selected favorable battle lineage, not an untouched new-game run.',
    'Simulated online production seconds exclude battle animation, offline progress and player operation time.',
    'This verifies one battle after payment; it does not establish a repeatable net-profit soul-stone loop.']};
const reportFile=data+'p337-soul-alert7050-paid-attack.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),onlineSeconds,phases,minFood,totalPaidSteel:report.totalPaidSteel,
  checkpoints,battle:report.battle,reportFile},null,2));
