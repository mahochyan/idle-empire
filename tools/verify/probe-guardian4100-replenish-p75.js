'use strict';
// P75：守御4000真实首胜后，按战损实付补兵，再挑战4100。胜利才写第二胜档。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p75-guardian4000-first-win-paid.json'),'utf8');
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.killValues.godGuardian'),4100);
assert.equal(run('S.items.guardianStone'),207);
assert.equal(run('armyCount()'),452);
const start=run('S.tick');
const wanted={electro_trooper:100,alloy_special:55,armored_trooper:55};
const lost={};
for(const [uk,n] of Object.entries(wanted)){
  const have=run(`(S.pool.${uk}||0)+S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type==='${uk}').reduce((a,u)=>a+u.count,0)`);
  assert.ok(have<=n);
  lost[uk]=n-have;
}
assert.deepEqual(lost,{electro_trooper:25,alloy_special:29,armored_trooper:9});
const need={};
for(const [uk,n] of Object.entries(lost))for(const [rk,v] of Object.entries(run(`CFG.units.${uk}.cost`)))need[rk]=(need[rk]||0)+n*v;
assert.equal(need.copper,218000);assert.equal(need.iron,218000);assert.equal(need.steel,220900);
let simulated=0,phaseChanges=0;
const phaseTime={coal:0,stone:0,copper:0,steel:0,training:0};
function tickUntil(cond,phase,max=120000){
  const x=run(`(()=>{let n=0;while(!(${cond})&&n<${max}){tick();n++}return{n,ok:!!(${cond})}})()`);
  simulated+=x.n;phaseTime[phase]+=x.n;
  assert.equal(x.ok,true,`等待超时 ${cond}: ${JSON.stringify(run("({tick:S.tick,res:S.res,army:armyCount(),queue:S.queue})"))}`);
}
function tickWhile(cond,phase,max=120000){
  const n=run(`(()=>{let n=0;while((${cond})&&n<${max}){tick();n++}return n})()`);
  simulated+=n;phaseTime[phase]+=n;assert.ok(n<max,`阶段超时 ${cond}`);
}
function assign(target){
  const current=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(current))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  for(const [rk,n] of Object.entries(target))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true);
  assert.equal(run('popAllocTotal()'),126);
  phaseChanges++;
}
while(run('S.res.copper')<need.copper){
  const old=run('S.res.copper');
  assign({food:90,stone:36});tickUntil('S.res.stone>=240000','stone');
  assign({food:90,coal:36});tickUntil('S.res.coal>=240000','coal');
  assign({food:90,copper:36});tickWhile(`S.res.copper<${need.copper}&&S.res.stone>=72&&S.res.coal>=72`,'copper');
  assert.ok(run('S.res.copper')>old,'铜循环无增量');
  assert.ok(phaseChanges<30,'铜循环超预期');
}
while(run('S.res.steel')<need.steel){
  const old=run('S.res.steel');
  assign({food:90,stone:36});tickUntil('S.res.stone>=210000','stone');
  assign({food:90,coal:36});tickUntil('S.res.coal>=210000','coal');
  assign({food:90,steel:36});tickWhile(`S.res.steel<${need.steel}&&S.res.stone>=36&&S.res.coal>=36&&S.res.iron>=36`,'steel');
  assert.ok(run('S.res.steel')>old,'钢循环无增量');
  assert.ok(phaseChanges<45,'钢循环超预期');
}
assert.ok(run('S.res.iron')>=need.iron);
assert.ok(run('S.res.food')>=need.food);
assign({food:126});
const beforeTrain=run('({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food})');
for(const [uk,n] of Object.entries(lost)){
  const q=run(`train('${uk}',${n})`);
  assert.equal(q?.ok,true);assert.equal(q.qty,n);
}
for(const [uk,n] of Object.entries(lost))tickUntil(`(S.pool.${uk}||0)>=${n}`,'training',100);
assert.equal(run('armyCount()'),515);
for(const rk of ['copper','iron','steel'])assert.equal(Math.round(beforeTrain[rk]-run(`S.res.${rk}`)),need[rk]);
assert.ok(beforeTrain.food-run('S.res.food')<=need.food,'补兵粮费之外发生异常扣减');
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
const replay=environment({rts_save:raw});
assert.equal(replay.run('loadSaveAndApply().status'),'ok');
assert.equal(replay.run('armyCount()'),515);
assert.equal(replay.run('S.killValues.godGuardian'),4100);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),raw);
function place(test,row,type,count,slot){
  assert.ok(test.run(`S.pool.${type}`)>=count);
  test.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(test.run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
const results=[];let firstWin=null;
for(let seed=1;seed<=12;seed++){
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
  [['electro_trooper',55],['electro_trooper',45],['alloy_special',55],['armored_trooper',55]].forEach(([type,count],i)=>place(test,'front',type,count,i));
  [['gold_cavalry',40],['bronze_guard',15],['iron_spearman',15],['silver_heavy',15]].forEach(([type,count],i)=>place(test,'mid',type,count,i));
  for(let i=0;i<4;i++)place(test,'back','archer',55,i);
  assert.equal(trun('armyCount()'),515);
  const old=trun('S.items.guardianStone');
  trun("openMaterialDomain('guardianStone')");
  assert.equal(trun('S.battleActive'),true);
  let callbacks=0;
  while(trun('S.battleActive')&&callbacks<1000){assert.equal(trun('__step()'),true);callbacks++;}
  assert.equal(trun('S.battleActive'),false);
  const after=trun('({round:B.round,hp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill===4200;
  results.push({seed,win,round:after.round,enemyHp:after.hp,armyAfter:after.army,
    stoneGain:after.stone-old,callbacks});
  if(win&&!firstWin){
    assert.equal(trun('save().ok'),true);
    firstWin=test.store.get('rts_save');
    const check=environment({rts_save:firstWin});
    assert.equal(check.run('loadSaveAndApply().status'),'ok');
    assert.equal(check.run('S.killValues.godGuardian'),4200);
    if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),firstWin);
  }
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'simulated online seconds; resources; soldiers; battle rounds',
  sourceTick:start,prebattleTick:saved.tick,elapsed:saved.tick-start,simulated,lost,need,phaseTime,phaseChanges,
  prebattleArmy:515,prebattleSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  wins:results.filter(x=>x.win).length,firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,6),worst:ranked.at(-1),results},null,2));
