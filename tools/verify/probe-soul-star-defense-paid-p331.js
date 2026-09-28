'use strict';
// Pay for 40 star-trooper defense stars in live actions, then test the P331 conditional bridge.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const data='docs/codex/reports/data/';
const sourceFile=data+'p329-soul-refreshed-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const origin=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run(`({tick:S.tick,res:{...S.res},steelCap:resCap('steel'),arms:JSON.parse(JSON.stringify(S.armsUp.star_trooper)),
  army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,
  slots:[...S.soulRealmTeam.slots]})`);
assert.equal(initial.steelCap,1922976);assert.equal(initial.arms.def.stars,0);
assert.equal(initial.army,672);assert.equal(initial.deployed,626);
assert.equal(initial.stone,39);assert.equal(initial.alert,6050);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${initial.tick})*1000}};
  addLog=msg=>{S.log.push({time:'probe',msg:String(msg)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};
  globalThis.__rng=331000;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
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
for(let star=1;star<=40;star++){
  for(const times of [400,400,200]){
    const cost=times*4000;
    fillProcessed('steel',cost);
    const before=val('steel');
    const action=run(`investArmsUp('star_trooper','def',${times})`);
    assert.equal(action?.ok,true,JSON.stringify(action));
    assert.equal(action.cost,cost);
    assert.ok(Math.abs(before-val('steel')-cost)<1e-5,'steel payment');
    payments.push({star,times,cost,secondsAfter:onlineSeconds,stars:action.stars,progress:action.progress});
  }
  assert.equal(run('S.armsUp.star_trooper.def.stars'),star);
  assert.equal(run('S.armsUp.star_trooper.def.progress'),0);
  if(star%10===0){
    assert.equal(run('save().ok'),true);
    const text=env.store.get('rts_save'),reload=environment({rts_save:text});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.armsUp.star_trooper.def.stars'),star);
    const file=data+`p331-soul-star-defense-${star}-paid-save.json`;
    fs.writeFileSync(path.join(root,file),text,'utf8');
    checkpoints.push({star,seconds:onlineSeconds,phases:{...phases},minFood,
      steel:val('steel'),stone:val('stone'),coal:val('coal'),iron:val('iron'),
      food:val('food'),defense:run("weaponDefense('star_trooper')"),file,sha256:sha(text)});
    console.log(JSON.stringify({checkpoint:star,seconds:onlineSeconds,defense:checkpoints.at(-1).defense,sha256:sha(text)}));
  }
}
assert.equal(payments.reduce((n,p)=>n+p.cost,0),160000000);
assert.equal(run('armyCount()'),672);assert.equal(run('formSoldierCount()'),626);
assert.equal(run('S.items.soulStone'),39);assert.equal(run('S.killValues.soulRealm'),6050);
const paidText=env.store.get('rts_save'),paid=JSON.parse(paidText),slot=paid.soulRealmTeam.slots.indexOf(540399);
assert.ok(slot>=0);
function battle(seed,capture=false){
  const e=environment({rts_save:paidText}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${paid.ts}+(S.tick-${paid.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  assert.equal(r(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after=r(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
    stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}]})`);
  if(result==='win'){assert.equal(after.slot,null);assert.ok(after.stone>39);assert.equal(after.alert,6250)}
  else{assert.equal(after.slot,540399);assert.equal(after.alert,6050);assert.equal(after.stone,39)}
  r('exitBattle()');
  return{seed,enemy,result,after,callbacks,rngEnd:r('__rng'),
    ...(capture?{saveText:e.store.get('rts_save')}: {})};
}
const trials=[];for(let seed=1;seed<=32;seed++)trials.push(battle(seed));
const winners=trials.filter(x=>x.result==='win');let selectedWin=null;
if(winners.length){
  const chosen=battle(winners[0].seed,true),saveFile=data+'p331-soul-star-defense-first-win-save.json';
  assert.equal(chosen.result,'win');
  const reload=environment({rts_save:chosen.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),chosen.after.stone);
  fs.writeFileSync(path.join(root,saveFile),chosen.saveText,'utf8');
  selectedWin={seed:chosen.seed,after:chosen.after,rngEnd:chosen.rngEnd,
    saveFile,sha256:sha(chosen.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P331',kind:'real paid 40-defense-star production and armament route, then independent current combat',
  sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds, resources, soldiers and battle HP',
  initial,onlineSeconds,phases,minFood,totalPaidSteel:160000000,payments,checkpoints,
  seedRule:'independent xorshift32 1..32 from the same paid 40-star save',
  trials,selectedWin,limits:['The input descends from earlier selected favorable battles; not a natural new-game route.',
    'Each battle seed restarts from one paid full-army save; wins are not combined into a continuous net-profit route.',
    'Simulated online production seconds exclude battle animation and player operation time.']};
const reportFile=data+'p331-soul-star-defense-paid.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),onlineSeconds,phases,minFood,totalPaidSteel:report.totalPaidSteel,
  checkpoints,wins:winners.length,minEnemyHp:Math.min(...trials.map(x=>x.after.enemyHp)),
  selectedWin,reportFile},null,2));
