'use strict';
// P81：从铁脊蜥龙实胜档真实生产、训练并编回55名战损电磁兵。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p81-wyrm3000-first-win-paid.json'),'utf8');
const outArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.killValues.wildWyrm'),3010);
assert.equal(run('S.items.wyrmSinew'),97);
assert.equal(run('armyCount()'),382);
assert.equal(run("S.formation.front.filter(u=>u.type==='electro_trooper').reduce((a,u)=>a+u.count,0)"),29);
const start=run('S.tick');
const cost=run('CFG.units.electro_trooper.cost');
const needed={copper:55*cost.copper,iron:55*cost.iron,steel:55*cost.steel};
assert.deepEqual(needed,{copper:440000,iron:440000,steel:440000});
let simulated=0,phaseChanges=0;
const phaseTime={stone:0,coal:0,copper:0,steel:0,training:0};
function waitUntil(cond,phase,max=100000){
  const x=run(`(()=>{let n=0;while(!(${cond})&&n<${max}){tick();n++}return{n,ok:!!(${cond})}})()`);
  simulated+=x.n;phaseTime[phase]+=x.n;
  assert.equal(x.ok,true,`等待超时 ${cond}: ${JSON.stringify(run("({tick:S.tick,res:S.res,alloc:S.popAlloc})"))}`);
}
function waitWhile(cond,phase,max=100000){
  const n=run(`(()=>{let n=0;while((${cond})&&n<${max}){tick();n++}return n})()`);
  simulated+=n;phaseTime[phase]+=n;assert.ok(n<max,`阶段超时 ${cond}`);
}
function assign(key){
  const current=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',90)")?.ok,true);
  assert.equal(run(`setPopAlloc('${key}',124)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),214);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
  phaseChanges++;
}
while(run('S.res.copper')<needed.copper){
  const old=run('S.res.copper');
  assign('stone');waitUntil('S.res.stone>=260000','stone');
  assign('coal');waitUntil('S.res.coal>=250000','coal');
  assign('copper');waitWhile(`S.res.copper<${needed.copper}&&S.res.stone>=248&&S.res.coal>=248`,'copper');
  assert.ok(run('S.res.copper')>old,'铜料阶段无增量');
  assert.ok(phaseChanges<180,'铜煤生产循环超出预期');
}
while(run('S.res.steel')<needed.steel){
  const old=run('S.res.steel');
  assign('stone');waitUntil('S.res.stone>=260000','stone');
  assign('coal');waitUntil('S.res.coal>=250000','coal');
  assign('steel');waitWhile(`S.res.steel<${needed.steel}&&S.res.stone>=124&&S.res.coal>=124&&S.res.iron>=124`,'steel');
  assert.ok(run('S.res.steel')>old,'冶钢阶段无增量');
  assert.ok(phaseChanges<300,'冶钢生产循环超出预期');
}
assert.ok(run('S.res.iron')>=needed.iron);
const current=run('({...S.popAlloc})');
for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
assert.equal(run("setPopAlloc('food',90)")?.ok,true);
assert.equal(run("setPopAlloc('tech',124)")?.ok,true);
const beforeTrain=run('({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,tech:S.res.tech})');
const trained=run("train('electro_trooper',55)");
assert.equal(trained?.ok,true);assert.equal(trained.qty,55);
waitUntil('S.pool.electro_trooper>=55','training',100);
assert.equal(run('armyCount()'),437);
for(const key of ['copper','iron','steel'])assert.equal(Math.round(beforeTrain[key]-run(`S.res.${key}`)),needed[key]);
run("clrForm('expedition')");
function place(row,type,count,slot){
  assert.ok(run(`S.pool.${type}`)>=count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
[['electro_trooper',55],['electro_trooper',29],['alloy_special',17],['armored_trooper',31]].forEach(([type,count],i)=>place('front',type,count,i));
[['gold_cavalry',40],['bronze_guard',15],['iron_spearman',15],['silver_heavy',15]].forEach(([type,count],i)=>place('mid',type,count,i));
for(let i=0;i<4;i++)place('back','archer',55,i);
assert.equal(run('armyCount()'),437);
assert.equal(run('S.items.wyrmSinew'),97);
assert.equal(run('S.killValues.wildWyrm'),3010);
assert.equal(run('save().ok'),true);
const final=e.store.get('rts_save'),check=environment({rts_save:final});
assert.equal(check.run('loadSaveAndApply().status'),'ok');
assert.equal(check.run('armyCount()'),437);
assert.equal(check.run('S.items.wyrmSinew'),97);
if(outArg)fs.writeFileSync(path.resolve(outArg.slice('--snapshot-final='.length)),final);
console.log(JSON.stringify({unit:'simulated online seconds; resource units; soldiers',start,finalTick:run('S.tick'),simulated,phaseTime,phaseChanges,needed,beforeTrain,
  sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),finalSha256:crypto.createHash('sha256').update(final).digest('hex')},null,2));
