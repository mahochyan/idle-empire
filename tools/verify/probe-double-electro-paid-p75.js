'use strict';
// P75：从P74真实470人档，逐级建电磁兵坊、分相生产铜/钢、招募第二队电磁兵，再按现行30回合实战。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=path.resolve(__dirname,'../../docs/codex/reports/data/p74-archer-roster-paid.json');
const preArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const e=environment({rts_save:fs.readFileSync(source,'utf8')}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.defeated.length'),45);
assert.equal(run('S.population.current'),126);
assert.equal(run('armyCount()'),470);
assert.equal(run("bldSt('electric_armory').lv"),17);
assert.equal(run('S.killValues.godGuardian'),4000);
const start=run('S.tick'),startResources=run('({...S.res})');
let simulated=0,builds=0,phaseChanges=0;
const paidBuild={wood:0,stone:0,food:0};
const phaseTime={building:0,coal:0,stone:0,copper:0,steel:0,training:0};
function tickUntil(condition,phase,max=120000){
  const r=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}return{n,ok:!!(${condition})}})()`);
  simulated+=r.n;phaseTime[phase]+=r.n;
  assert.equal(r.ok,true,`等待超时 ${condition}: ${JSON.stringify(run("({tick:S.tick,res:S.res,army:armyCount(),queue:S.queue.electro_trooper})"))}`);
}
function tickWhile(condition,phase,max=120000){
  const r=run(`(()=>{let n=0;while((${condition})&&n<${max}){tick();n++}return n})()`);
  simulated+=r;phaseTime[phase]+=r;
  assert.ok(r<max,`阶段超时 ${condition}`);
  return r;
}
function assign(target){
  const now=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(now))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true,`撤${rk}失败`);
  for(const [rk,n] of Object.entries(target))if(n>0)assert.equal(run(`setPopAlloc('${rk}',${n})`)?.ok,true,`派${rk}失败`);
  assert.equal(run('popAllocTotal()'),126);
  phaseChanges++;
}
assign({food:90,wood:15,stone:21});
while(run("bldSt('electric_armory').lv")<32){
  const level=run("bldSt('electric_armory').lv"),cost=run("upCost('electric_armory')");
  for(const rk of ['wood','stone','food'])assert.ok(run(`resCap('${rk}')`)>=cost[rk],`Lv${level+1} ${rk}单笔超仓`);
  tickUntil(`S.res.wood>=${cost.wood}&&S.res.stone>=${cost.stone}&&S.res.food>=${cost.food+2000}`,'building');
  const before=run('({...S.res})');
  const result=run("buildAct('electric_armory')");
  assert.equal(result?.ok,true,`兵坊Lv${level+1}升级失败: ${JSON.stringify(result)}`);
  for(const rk of ['wood','stone','food']){
    assert.equal(Math.round(before[rk]-run(`S.res.${rk}`)),cost[rk]);
    paidBuild[rk]+=cost[rk];
  }
  builds++;
  tickUntil(`bldSt('electric_armory').lv===${level+1}&&bldSt('electric_armory').state==='idle'`,'building',150);
}
assert.equal(run("unitCap('electro_trooper')"),101);
const needMetal=45*8000;
const cycleLog=[];
// 铜煤链：铜工36人每秒耗石/煤各72，产铜39.6。仓容不够一笔存全部辅料，分阶段逐秒生产。
while(run('S.res.copper')<needMetal){
  const beforeCopper=run('S.res.copper');
  assign({food:90,stone:36});
  tickUntil('S.res.stone>=240000','stone');
  assign({food:90,coal:36});
  tickUntil('S.res.coal>=240000','coal');
  assign({food:90,copper:36});
  tickWhile(`S.res.copper<${needMetal}&&S.res.stone>=72&&S.res.coal>=72`,'copper');
  const afterCopper=run('S.res.copper');
  assert.ok(afterCopper>beforeCopper,'铜料阶段无增量');
  cycleLog.push({phase:'copper',before:Math.round(beforeCopper),after:Math.round(afterCopper)});
  assert.ok(cycleLog.length<=8,'铜煤循环超出预期');
}
// 冶钢每钢工每秒耗铁/石/煤各1、产钢2；不足的石煤同样分阶段补齐。
while(run('S.res.steel')<needMetal){
  const beforeSteel=run('S.res.steel');
  assign({food:90,stone:36});
  tickUntil('S.res.stone>=210000','stone');
  assign({food:90,coal:36});
  tickUntil('S.res.coal>=210000','coal');
  assign({food:90,steel:36});
  tickWhile(`S.res.steel<${needMetal}&&S.res.stone>=36&&S.res.coal>=36&&S.res.iron>=36`,'steel');
  const afterSteel=run('S.res.steel');
  assert.ok(afterSteel>beforeSteel,'冶钢阶段无增量');
  cycleLog.push({phase:'steel',before:Math.round(beforeSteel),after:Math.round(afterSteel)});
  assert.ok(cycleLog.length<=12,'钢料循环超出预期');
}
assert.ok(run('S.res.iron')>=needMetal);
assign({food:126});
const beforeTrain=run('({copper:S.res.copper,iron:S.res.iron,steel:S.res.steel})');
const queued=run("train('electro_trooper',45)");
assert.equal(queued?.ok,true);assert.equal(queued.qty,45);
tickUntil('S.pool.electro_trooper>=45','training',200);
assert.equal(run('S.queue.electro_trooper.count'),0);
assert.equal(run('armyCount()'),515);
for(const rk of ['copper','iron','steel'])assert.equal(Math.round(beforeTrain[rk]-run(`S.res.${rk}`)),needMetal,`电磁兵未实付 ${rk}`);
assert.ok(run('prodRate("food")-totalUpkeep()-popCurrent()*CFG.popFoodCost')>0,
  `全部人口调粮后仍无法供养515人: ${JSON.stringify(run("({gross:prodRate('food'),upkeep:totalUpkeep(),population:popCurrent()*CFG.popFoodCost,food:S.res.food,cap:resCap('food')})"))}`);
assert.equal(run('save().ok'),true);
const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
const replay=environment({rts_save:raw});
assert.equal(replay.run('loadSaveAndApply().status'),'ok');
assert.equal(replay.run('armyCount()'),515);
assert.equal(replay.run("bldSt('electric_armory').lv"),32);
assert.equal(replay.run('S.killValues.godGuardian'),4000);
if(preArg)fs.writeFileSync(path.resolve(preArg.slice('--snapshot-prebattle='.length)),raw);
const baseline=saved.items.guardianStone;
const results=[];let firstWin=null;
function place(test,row,type,count,slot){
  assert.ok(test.run(`S.pool.${type}`)>=count);
  test.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(test.run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
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
  const fronts=[['electro_trooper',55],['electro_trooper',45],['alloy_special',55],['armored_trooper',55]];
  fronts.forEach(([type,count],i)=>place(test,'front',type,count,i));
  [['gold_cavalry',40],['bronze_guard',15],['iron_spearman',15],['silver_heavy',15]].forEach(([type,count],i)=>place(test,'mid',type,count,i));
  for(let i=0;i<4;i++)place(test,'back','archer',55,i);
  assert.equal(trun('armyCount()'),515);
  const before=trun('S.killValues.godGuardian');
  trun("openMaterialDomain('guardianStone')");
  assert.equal(trun('S.battleActive'),true);
  let callbacks=0;
  while(trun('S.battleActive')&&callbacks<1000){assert.equal(trun('__step()'),true);callbacks++;}
  assert.equal(trun('S.battleActive'),false);
  const after=trun('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill>before;
  results.push({seed,win,round:after.round,enemyHp:after.enemyHp,armyAfter:after.army,
    stoneGain:after.stone-baseline,callbacks});
  if(win&&!firstWin){
    assert.equal(trun('save().ok'),true);
    firstWin=test.store.get('rts_save');
    const won=environment({rts_save:firstWin});
    assert.equal(won.run('loadSaveAndApply().status'),'ok');
    assert.equal(won.run('S.killValues.godGuardian'),4100);
    if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),firstWin);
  }
  trun('exitBattle()');
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'simulated online seconds; resources; soldiers; battle rounds',sourceTick:start,
  prebattleTick:saved.tick,elapsed:saved.tick-start,simulated,builds,paidBuild,needMetal,phaseTime,phaseChanges,
  cycleLog,startResources,finalResources:saved.res,prebattleArmy:515,
  prebattleSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  wins:results.filter(x=>x.win).length,firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,6),worst:ranked.at(-1),results},null,2));
