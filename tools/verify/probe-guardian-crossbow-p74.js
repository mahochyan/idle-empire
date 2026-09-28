'use strict';
// P74：从实付游侠档，经已通关Boss复战取精魄，再实付重弩手与守御挑战。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=path.resolve(__dirname,'../../docs/codex/reports/data/p74-ranger-roster-paid.json');
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const e=environment({rts_save:fs.readFileSync(source,'utf8')}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('armyCount()'),470);
assert.equal(run("bldSt('archer_range').tier"),1);
const start=run('S.tick');
let ticks=0,boss40Wins=0;
function wait(cond,max=10000){
  const r=run(`(()=>{let n=0;while(!(${cond})&&n<${max}){tick();n++}return{n,ok:!!(${cond})}})()`);
  ticks+=r.n;assert.equal(r.ok,true,`等待超时 ${cond}`);
}
function assign(target){
  const current=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  for(const [rk,n] of Object.entries(target))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true);
  assert.equal(run('popAllocTotal()'),126);
}
function setupBattle(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
}
function place(env,row,type,count,slot){
  assert.ok(env.run(`S.pool.${type}`)>=count);
  env.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(env.run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
function finish(run){
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++;}
  assert.equal(run('S.battleActive'),false);
  return callbacks;
}
const troops={alloy_special:55,armored_trooper:55,electro_trooper:55,gold_cavalry:40,
  bronze_guard:15,iron_spearman:15,silver_heavy:15};
function form(env,front,archerType){
  const rr=env.run;
  rr("clrForm('expedition')");
  front.forEach((type,i)=>place(env,'front',type,troops[type],i));
  Object.keys(troops).filter(type=>!front.includes(type)).forEach((type,i)=>place(env,'mid',type,troops[type],i));
  for(let i=0;i<4;i++)place(env,'back',archerType,55,i);
}
setupBattle(run,9);
form(e,['alloy_special','armored_trooper','electro_trooper','gold_cavalry'],'archer_t1');
const essenceStart=run('S.essence.crossbow_essence||0');
while(run('(S.essence.crossbow_essence||0)')<2&&boss40Wins<10){
  const meritBefore=run('S.merit');
  run('selEnemy(39)');
  run('openBattle()');
  assert.equal(run('S.battleActive'),true);
  finish(run);
  assert.ok(run('S.merit')>meritBefore,'第40关复战失败');
  boss40Wins++;
  run('exitBattle()');
}
assert.ok(run('(S.essence.crossbow_essence||0)')>=2,'十场复战仍未掉够弩手精魄');
assert.ok(run('armyCount()')<=470);
const postBossArmy=run('armyCount()');
const oldRangers=run("S.pool.archer_t1+S.formation.back.filter(u=>u.type==='archer_t1').reduce((n,u)=>n+u.count,0)");
const lost={};
for(const [uk,n] of Object.entries(troops)){
  const remaining=run(`(S.pool.${uk}||0)+S.formation.front.concat(S.formation.mid).filter(u=>u.type==='${uk}').reduce((n,u)=>n+u.count,0)`);
  if(remaining<n)lost[uk]=n-remaining;
}
assign({food:90,tech:36});
wait('S.res.tech>=500&&S.res.food>=20000');
const tierCost=run("tierUpgradeCost('archer_range')"),beforeTier=run('({...S.res})');
assert.equal(run("buildTierUpgradeAct('archer_range')")?.ok,true);
for(const rk of ['wood','stone','food'])assert.equal(Math.round(beforeTier[rk]-run(`S.res.${rk}`)),tierCost[rk]);
wait("bldSt('archer_range').tier===2&&bldSt('archer_range').state==='idle'",100);
assert.equal(run('armyCount()'),postBossArmy-oldRangers);
// 先在旧游侠退役后的低维护窗口补齐第40关损失的前排。
assign({food:65,copper:30,steel:31});
const need={food:15000};
for(const [uk,n] of Object.entries(lost))for(const [rk,v] of Object.entries(run(`CFG.units.${uk}.cost`)))need[rk]=(need[rk]||0)+n*v;
wait(['food','steel','copper','iron'].filter(rk=>need[rk]).map(rk=>`S.res.${rk}>=${need[rk]}`).join('&&'),3000);
if(need.gold||need.silver){
  assign({food:65,silver:30,gold:31});
  wait(['gold','silver'].filter(rk=>need[rk]).map(rk=>`S.res.${rk}>=${need[rk]}`).join('&&'),3000);
}
for(const [uk,n] of Object.entries(lost)){
  const q=run(`train('${uk}',${n})`);
  assert.equal(q?.ok,true);
  assert.equal(q.qty,n);
}
for(const [uk,n] of Object.entries(lost))wait(`(S.pool.${uk}||0)>=${n}`,100);
assert.equal(run('armyCount()'),250,JSON.stringify({lost,need,postBossArmy,oldRangers}));
assign({food:90,tech:36});
const beforeResearch=run('({res:{...S.res},merit:S.merit,essence:S.essence.crossbow_essence})');
assert.equal(run("upgradeUnit('archer_t1','archer_crossbow')")?.ok,true);
assert.equal(beforeResearch.res.tech-run('S.res.tech'),500);
assert.equal(beforeResearch.merit-run('S.merit'),10);
assert.equal(beforeResearch.essence-run('S.essence.crossbow_essence'),2);
assert.equal(run('S.upgradedUnits.archer_crossbow'),true);
wait('S.res.food>=22000');
const q=run("train('archer_crossbow',220)");
assert.equal(q?.ok,true);assert.equal(q.qty,220);
wait('S.pool.archer_crossbow>=220',1000);
assert.equal(run('armyCount()'),470);
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
const reload=environment({rts_save:raw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),470);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),raw);
const fronts=[
  {name:'gold-front',types:['alloy_special','armored_trooper','electro_trooper','gold_cavalry']},
  {name:'iron-front',types:['alloy_special','armored_trooper','electro_trooper','iron_spearman']}
];
const results=[];let firstWin=null;
for(const f of fronts)for(let seed=1;seed<=12;seed++){
  const test=environment({rts_save:raw}),trun=test.run;
  assert.equal(trun('loadSaveAndApply().status'),'ok');
  setupBattle(trun,seed);
  form(test,f.types,'archer_crossbow');
  const before=trun('S.killValues.godGuardian');
  trun("openMaterialDomain('guardianStone')");
  assert.equal(trun('S.battleActive'),true);
  const callbacks=finish(trun);
  const after=trun('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill>before;
  results.push({formation:f.name,seed,win,round:after.round,enemyHp:after.enemyHp,
    armyAfter:after.army,stoneGain:after.stone-saved.items.guardianStone,callbacks});
  if(win&&!firstWin){
    assert.equal(trun('save().ok'),true);
    firstWin=test.store.get('rts_save');
    if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),firstWin);
  }
  trun('exitBattle()');
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'simulated online seconds; battle rounds; soldiers',sourceTick:start,
  prebattleTick:saved.tick,elapsed:saved.tick-start,ticks,boss40Wins,essenceStart,
  essenceEnd:saved.essence.crossbow_essence,tierCost,postBossArmy,lost,need,
  prebattleSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  wins:results.filter(x=>x.win).length,firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,8),worst:ranked.at(-1),results},null,2));
