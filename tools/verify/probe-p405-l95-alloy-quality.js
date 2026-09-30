'use strict';
// Independent paid alloy-quality branch from P405's L94 winning save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const out='docs/codex/reports/data';
const input=`${out}/p405-mainline-l81-onward-final-save.json`;
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const hashBytes=x=>crypto.createHash('sha256').update(x).digest('hex');
const hash=f=>hashBytes(fs.readFileSync(path.join(root,f)));
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
assert.equal(sourceHash[input],'9415fc6b96e2e98077b3bdc66bc0a5c41e3fd7a29e2c8423985dfd45c27b46fa');
const source=fs.readFileSync(path.join(root,input),'utf8').trim();
assert.equal(hashBytes(source),'c24e919013b413dc697804e686da2b1006361c10faf9209d1694839e2301d8cc');
assert.equal(JSON.parse(source).defeated.length,94);
const game=session(source),steps=[];
const n=expr=>game.run(expr);
let minFood=n('S.res.food');
function waitUntil(expr,maxSeconds,label){
  let seconds=0;
  while(!n(expr)&&seconds<maxSeconds){game.wait(10);seconds+=10;minFood=Math.min(minFood,n('S.res.food'))}
  assert.ok(n(expr),`${label} timeout after ${seconds}s: ${JSON.stringify(n("({res:{...S.res},pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue)),workers:{...S.popAlloc},alloyCap:unitCap('alloy_special'),lock:trainLockReason('alloy_special'),rate:{food:prodRate('food'),coal:prodRate('coal'),iron:prodRate('iron'),steel:prodRate('steel')}})"))}`);
  assert.ok(minFood>0,`${label} starvation`);
  return seconds;
}
function build(key){
  const from=n(`bldSt('${key}').lv`);
  const cost=n(from===0?`buildingInitialCost('${key}')`:`upCost('${key}')`);
  const payable=Object.entries(cost).filter(([rk])=>rk!=='time');
  const waited=waitUntil(payable.map(([rk,v])=>`S.res.${rk}>=${v}`).join('&&'),20000,`${key} resources`);
  const result=n(`buildAct('${key}')`);assert.equal(result.ok,true,`${key} paid`);
  const buildSeconds=waitUntil(`bldSt('${key}').lv===${from+1}&&bldSt('${key}').state==='idle'`,500,`${key} built`);
  game.saveReload(`${key} ${from+1}`);
  steps.push({action:'build',key,from,to:from+1,cost,waited,buildSeconds});
}
function research(id){
  const cost=n(`activeSciences()['${id}'].cost`);
  const waited=waitUntil(Object.entries(cost).filter(([,v])=>v>0)
    .map(([rk,v])=>rk==='merit'?`S.merit>=${v}`:`S.res.${rk}>=${v}`).join('&&'),20000,`${id} resources`);
  const result=n(`researchScience('${id}')`);
  assert.equal(result.ok,true,`${id} paid`);
  assert.equal(n(`S.sciences.includes('${id}')`),true);
  game.saveReload(id);
  steps.push({action:'science',id,cost,waited});
}
let failure=null,battle=null,ready=null,final=null;
try{
  game.setWorkers({food:12,wood:4,stone:3});
  build('academy');
  game.setWorkers({food:13,tech:6});
  research('sci_steel');
  game.setWorkers({food:12,wood:4,stone:3});
  build('academy');
  game.setWorkers({food:13,tech:6});
  research('sci_alloy_age');
  game.setWorkers({food:12,wood:4,stone:3});
  for(let lv=1;lv<=4;lv++)build('alloy_armory');
  assert.ok(n("unitCap('alloy_special')")>=15);
  game.setWorkers({food:14,stone:1,coal:1,iron:1,steel:2});
  const queued=n("train('alloy_special',15)");
  assert.equal(queued.ok,true);assert.equal(queued.qty,15);
  const trainSeconds=waitUntil("(S.pool.alloy_special||0)>=15",60000,'15 alloy recruits');
  game.saveReload('alloy recruited');
  steps.push({action:'train',unit:'alloy_special',count:15,seconds:trainSeconds});
  const fills=[];
  for(const [type,target,workers]of [
    ['archer_silverbow',54,{food:13,wood:4,stone:2}],
    ['bronze_guard',20,{food:11,coal:4,copper:2,stone:2}],
    ['iron_spearman',20,{food:11,coal:2,iron:2,stone:2,wood:2}],
    ['silver_heavy',40,{food:14,coal:1,silver:1,stone:1,wood:2}],
    ['gold_cavalry',14,{food:14,coal:1,gold:1,stone:1,wood:2}]])
    fills.push(game.fill(type,target,workers));
  steps.push({action:'refill',fills});
  const army=[['front','gold_cavalry',14],['front','alloy_special',15],
    ['front','silver_heavy',15],['front','silver_heavy',15],
    ['mid','silver_heavy',10],['mid','iron_spearman',10],
    ['mid','iron_spearman',10],['mid','bronze_guard',15],
    ['back','archer_silverbow',15],['back','archer_silverbow',15],
    ['back','archer_silverbow',15],['back','archer_silverbow',9]];
  game.form(army);
  assert.equal(n('formSoldierCount()'),158);
  ready={path:`${out}/p405-l95-alloy-quality-ready-save.json`};
  fs.writeFileSync(path.join(root,ready.path),game.saveReload('L95 alloy ready')+'\n');
  ready.sha256=hash(ready.path);
  const alloyBefore=game.own('alloy_special');
  battle=game.battle(95);
  battle.losses.alloy_special=alloyBefore-game.own('alloy_special');
  assert.equal(battle.losses.alloy_special,15);
  final={path:`${out}/p405-l95-alloy-quality-final-save.json`};
  fs.writeFileSync(path.join(root,final.path),game.saveReload('L95 alloy outcome')+'\n');
  final.sha256=hash(final.path);
  console.log(JSON.stringify({online:game.online(),minFood,paidTraining:game.charges(),ready,battle,final},null,2));
}catch(error){failure=String(error.stack||error);console.error(failure)}
const summary={batch:'P405',input,inputSha256:sourceHash[input],rawSha256:hashBytes(source),sourceHash,
  method:'Independent L94 win loaded; real building, science, workers, queued production, formation, fixed 0.5 battle and reload',
  units:'online is simulated tick seconds; battleMs is simulated callback milliseconds; menu actions instant in harness',
  steps,totalOnline:game.online(),minFood,paidTraining:game.charges(),ready,battle,final,failure};
fs.writeFileSync(path.join(root,out,'p405-l95-alloy-quality.json'),JSON.stringify(summary,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash);
if(failure)process.exitCode=1;
