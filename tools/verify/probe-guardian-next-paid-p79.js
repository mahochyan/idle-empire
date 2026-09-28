'use strict';
// P79：从前一场已付胜利档逐笔生产、补兵并编队，再挑战下一档守御；仅胜利保存。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const inputArg=process.argv.find(x=>x.startsWith('--input='));
const inputPath=path.resolve(inputArg?inputArg.slice('--input='.length):path.resolve(__dirname,'../../docs/codex/reports/data/p78-guardian4200-first-win-paid.json'));
const source=fs.readFileSync(inputPath,'utf8');
const sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const seed=seedArg?Number(seedArg.slice('--seed='.length)):2;
assert.ok(Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff);
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const guardianBefore=run('S.killValues.godGuardian');
assert.ok(guardianBefore===4300||guardianBefore===4400);
const armyBefore=run('armyCount()');
assert.ok(armyBefore>0&&armyBefore<515);
const stoneBefore=run('S.items.guardianStone');
const sourceTick=run('S.tick');
const wanted={electro_trooper:100,alloy_special:55,armored_trooper:55};
const lost={};
for(const [uk,n] of Object.entries(wanted)){
  const have=run(`(S.pool.${uk}||0)+S.formation.front.concat(S.formation.mid,S.formation.back).filter(u=>u.type==='${uk}').reduce((a,u)=>a+u.count,0)`);
  assert.ok(have<=n);
  lost[uk]=n-have;
}
assert.equal(Object.values(lost).reduce((a,b)=>a+b,0),515-armyBefore);
const need={};
for(const [uk,n] of Object.entries(lost))for(const [rk,v] of Object.entries(run(`CFG.units.${uk}.cost`)))need[rk]=(need[rk]||0)+n*v;
assert.ok(need.copper>0&&need.iron>0&&need.steel>0);
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
  assert.equal(run('popAllocTotal()'),run('S.population.current'));
  phaseChanges++;
}
while(run('S.res.copper')<need.copper){
  const old=run('S.res.copper');
  assign({food:90,stone:36});tickUntil('S.res.stone>=240000','stone');
  assign({food:90,coal:36});tickUntil('S.res.coal>=240000','coal');
  assign({food:90,copper:36});tickWhile(`S.res.copper<${need.copper}&&S.res.stone>=72&&S.res.coal>=72`,'copper');
  assert.ok(run('S.res.copper')>old,'铜料阶段无增量');
  assert.ok(phaseChanges<120,'铜煤阶段循环超出预期');
}
while(run('S.res.steel')<need.steel){
  const old=run('S.res.steel');
  assign({food:90,stone:36});tickUntil('S.res.stone>=210000','stone');
  assign({food:90,coal:36});tickUntil('S.res.coal>=210000','coal');
  assign({food:90,steel:36});tickWhile(`S.res.steel<${need.steel}&&S.res.stone>=36&&S.res.coal>=36&&S.res.iron>=36`,'steel');
  assert.ok(run('S.res.steel')>old,'钢料阶段无增量');
  assert.ok(phaseChanges<180,'冶钢阶段循环超出预期');
}
assert.ok(run('S.res.iron')>=need.iron);
assert.ok(run('S.res.food')>=need.food);
assign({food:run('S.population.current')});
const beforeTrain=run('({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel,food:S.res.food})');
for(const [uk,n] of Object.entries(lost)){
  const q=run(`train('${uk}',${n})`);
  assert.equal(q?.ok,true);assert.equal(q.qty,n);
}
for(const [uk,n] of Object.entries(lost))tickUntil(`(S.pool.${uk}||0)>=${n}`,'training',100);
assert.equal(run('armyCount()'),515);
for(const rk of ['copper','iron','steel'])assert.equal(Math.round(beforeTrain[rk]-run(`S.res.${rk}`)),need[rk]);
assert.ok(beforeTrain.food-run('S.res.food')<=need.food);
function place(row,type,count,slot){
  assert.ok(run(`S.pool.${type}`)>=count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
run("clrForm('expedition')");
[['electro_trooper',55],['electro_trooper',45],['alloy_special',55],['armored_trooper',55]].forEach(([type,count],i)=>place('front',type,count,i));
[['gold_cavalry',40],['bronze_guard',15],['iron_spearman',15],['silver_heavy',15]].forEach(([type,count],i)=>place('mid',type,count,i));
for(let i=0;i<4;i++)place('back','archer',55,i);
assert.equal(run('armyCount()'),515);
assert.equal(run('save().ok'),true);
const prebattle=e.store.get('rts_save');
const preReload=environment({rts_save:prebattle});
assert.equal(preReload.run('loadSaveAndApply().status'),'ok');
assert.equal(preReload.run('armyCount()'),515);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),prebattle);
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
run("openMaterialDomain('guardianStone')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
const after=run('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
assert.equal(after.kill,guardianBefore+100,`守御${guardianBefore}未真实获胜`);
assert.equal(after.enemyHp,0);
assert.ok(after.stone>stoneBefore);
assert.equal(run('save().ok'),true);
const win=e.store.get('rts_save');
const winReload=environment({rts_save:win});
assert.equal(winReload.run('loadSaveAndApply().status'),'ok');
assert.equal(winReload.run('S.killValues.godGuardian'),guardianBefore+100);
assert.equal(winReload.run('S.items.guardianStone'),after.stone);
assert.equal(winReload.run('armyCount()'),after.army);
if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),win);
console.log(JSON.stringify({unit:'simulated online seconds; resource units; battle rounds; soldiers',inputPath,sourceSha256,sourceTick,prebattleTick:run('S.tick'),simulated,
  lost,need,phaseTime,phaseChanges,beforeTrain,prebattleSha256:crypto.createHash('sha256').update(prebattle).digest('hex'),
  battle:{seed,guardianBefore,callbacks,...after,armyLost:515-after.army,stoneGain:after.stone-stoneBefore},
  winSha256:crypto.createHash('sha256').update(win).digest('hex')},null,2));
