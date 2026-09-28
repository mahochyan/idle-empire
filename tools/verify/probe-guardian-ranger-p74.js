'use strict';
// 从470人实付档，走现行营地升阶、兵种研究、训练与守御4000战斗路径。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=path.resolve(__dirname,'../../docs/codex/reports/data/p74-archer-roster-paid.json');
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const e=environment({rts_save:fs.readFileSync(source,'utf8')});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('armyCount()'),470);
assert.equal(run("bldSt('archer_range').tier"),0);
const start=run('S.tick');
let ticks=0;
function wait(condition,max=50000){
  const r=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  ticks+=r.n;
  assert.equal(r.ok,true,`等待超时 ${condition}: ${JSON.stringify(run("({tick:S.tick,res:S.res,queue:S.queue.archer_t1,pool:S.pool.archer_t1,army:armyCount()})"))}`);
}
function assign(target){
  const current=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  for(const [rk,n] of Object.entries(target))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true);
  assert.equal(run('popAllocTotal()'),126);
}
assign({food:90,tech:36});
wait('S.res.tech>=200&&S.res.food>=14000');
const tierCost=run("tierUpgradeCost('archer_range')");
const beforeTier=run('({...S.res})');
assert.equal(run("buildTierUpgradeAct('archer_range')")?.ok,true);
for(const rk of ['wood','stone','food'])assert.equal(Math.round(beforeTier[rk]-run(`S.res.${rk}`)),tierCost[rk]);
wait("bldSt('archer_range').tier===1&&bldSt('archer_range').state==='idle'",100);
assert.equal(run('armyCount()'),250); // 220名旧猎人实退并返还材料
assert.equal(run('S.pool.archer'),0);
assert.equal(run("S.formation.back.some(u=>u.type==='archer')"),false);
const beforeResearch=run('({res:{...S.res},merit:S.merit})');
assert.equal(run("upgradeUnit('archer','archer_t1')")?.ok,true);
assert.equal(beforeResearch.res.tech-run('S.res.tech'),200);
assert.equal(beforeResearch.merit-run('S.merit'),5);
assert.equal(run('S.upgradedUnits.archer_t1'),true);
assert.equal(run("unitCap('archer_t1')"),222);
wait('S.res.food>=13000');
const queued=run("train('archer_t1',220)");
assert.equal(queued?.ok,true);
assert.equal(queued.qty,220);
wait('S.pool.archer_t1>=220',1000);
assert.equal(run('S.queue.archer_t1.count'),0);
assert.equal(run('armyCount()'),470);
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
const reload=environment({rts_save:raw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),470);
assert.equal(reload.run('S.upgradedUnits.archer_t1'),true);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),raw);
const troops={alloy_special:55,armored_trooper:55,electro_trooper:55,gold_cavalry:40,
  bronze_guard:15,iron_spearman:15,silver_heavy:15};
const fronts=[
  {name:'gold-front',types:['alloy_special','armored_trooper','electro_trooper','gold_cavalry']},
  {name:'iron-front',types:['alloy_special','armored_trooper','electro_trooper','iron_spearman']}
];
function place(test,row,type,count,slot){
  assert.ok(test.run(`S.pool.${type}`)>=count);
  test.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(test.run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
const results=[];
let firstWin=null;
for(const form of fronts)for(let seed=1;seed<=12;seed++){
  const test=environment({rts_save:raw}),trun=test.run;
  assert.equal(trun('loadSaveAndApply().status'),'ok');
  trun(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    clrForm('expedition');`);
  form.types.forEach((type,i)=>place(test,'front',type,troops[type],i));
  Object.keys(troops).filter(type=>!form.types.includes(type)).forEach((type,i)=>place(test,'mid',type,troops[type],i));
  for(let i=0;i<4;i++)place(test,'back','archer_t1',55,i);
  assert.equal(trun('armyCount()'),470);
  const before=trun('S.killValues.godGuardian');
  trun("openMaterialDomain('guardianStone')");
  assert.equal(trun('S.battleActive'),true);
  let callbacks=0;
  while(trun('S.battleActive')&&callbacks<1000){assert.equal(trun('__step()'),true);callbacks++;}
  assert.equal(trun('S.battleActive'),false);
  const after=trun('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill>before;
  results.push({formation:form.name,seed,win,round:after.round,enemyHp:after.enemyHp,
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
  prebattleTick:saved.tick,elapsed:saved.tick-start,ticks,tierCost,researchCost:{wood:200,stone:100,food:150,tech:200,merit:5},
  prebattleArmy:470,prebattleSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  wins:results.filter(x=>x.win).length,firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,8),worst:ranked.at(-1),results},null,2));
