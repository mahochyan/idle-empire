'use strict';
// 从科研精通20级的真实新档，按现有兵池与编队动作逐关挑战；不预置关卡胜利或兵力。
// 可用自然档导出的临时 snapshot 复跑战斗细节；完整验收不使用 --snapshot-in。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const inArg=process.argv.find(s=>s.startsWith('--snapshot-in='));
const outArg=process.argv.find(s=>s.startsWith('--snapshot-out='));
const finalOutArg=process.argv.find(s=>s.startsWith('--snapshot-final='));
const maxArg=process.argv.find(s=>s.startsWith('--max-stage='));
const maxStage=maxArg?Number(maxArg.slice('--max-stage='.length)):45;
assert.ok(Number.isSafeInteger(maxStage)&&maxStage>=1&&maxStage<=100,'关卡上限须为1～100');
const randomArg=process.argv.find(s=>s.startsWith('--random='));
const battleRandom=randomArg?Number(randomArg.slice('--random='.length)):0.5;
assert.ok(Number.isFinite(battleRandom)&&battleRandom>=0&&battleRandom<1,'固定战斗随机值须在[0,1)');
const seedArg=process.argv.find(s=>s.startsWith('--seed='));
assert.ok(!seedArg||!randomArg,'随机种子与固定值只能二选一');
const seed=seedArg?Number(seedArg.slice('--seed='.length)):null;
assert.ok(seed===null||Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff,'种子须为非零32位整数');
const alloyFront=process.argv.includes('--alloy-front');
const replenish=process.argv.includes('--replenish');
const reserveArmor=process.argv.includes('--reserve-armor');
const silverReserve=process.argv.includes('--silver-reserve');
const armorRefill39=process.argv.includes('--armor-refill39');
assert.ok(!replenish||alloyFront,'逐关补兵路线需使用合金前排');
assert.ok(!reserveArmor||alloyFront&&replenish,'装甲预备队须使用逐关补兵路线');
assert.ok(!silverReserve||reserveArmor,'白银预备队须与装甲预备队对照同一路线');
assert.ok(!armorRefill39||reserveArmor,'装甲补训须与装甲预备队对照同一路线');
let run;
if(inArg){
  const saveText=fs.readFileSync(inArg.slice('--snapshot-in='.length),'utf8');
  const e=environment({rts_save:saveText});
  assert.ok(['ok','migrated'].includes(e.run('loadSaveAndApply().status')),'第45关前存档未能安全读取或迁移');
  run=e.run;
}else{
  for(const flag of ['--steel-mastery-early','--steel-mastery-20','--steel-mastery-hunt-10','--iron-store=300'])
    assert.ok(process.argv.includes(flag),`须带${flag}保持同一新档路线`);
  const prior=fs.readFileSync(path.join(__dirname,'probe-scholar-mastery-full.js'),'utf8');
  ({run}=new Function('require','console','__dirname',prior+'\nreturn {run};')(
    require,{log(){},error:console.error},__dirname));
}
assert.equal(run('S.population.current'),102);
assert.equal(run('S.defeated.length'),0);
assert.equal(run('S.scholarMasteryLv'),20);
assert.ok(run('S.res.medal')>=0);
if(!inArg)assert.equal(run('S.res.medal'),774);
const start=run('S.tick');
const originalSave=run("localStorage.getItem('rts_save')");
if(outArg)fs.writeFileSync(outArg.slice('--snapshot-out='.length),originalSave,'utf8');
const initialArmy=run(`({formation:JSON.parse(JSON.stringify(S.formation)),
  armor:S.pool.armored_trooper||0,archer:S.pool.archer||0,electro:S.pool.electro_trooper||0,
  regMax:regMax(),slots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')}})`);
// 战斗异步回调在开发探针中同步抽取；伤害、结算和存档仍调用游戏的真实函数。
run(`globalThis.__stageTimers=new Map();globalThis.__nextStageTimer=1;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextStageTimer++;__stageTimers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__stageTimers.delete(id);
  globalThis.__stageStep=()=>{const first=__stageTimers.entries().next().value;
    if(!first)return false;__stageTimers.delete(first[0]);first[1]();return true};
  globalThis.__stageNodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__stageNodes.has(id))__stageNodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __stageNodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__stageTrainingSpend=[];
  const __stagePayTrainingCost=payTrainingCost;
  globalThis.payTrainingCost=(cost,count)=>{
    for(const [resource,unitCost] of Object.entries(cost||{})){
      if(Object.prototype.hasOwnProperty.call(CFG.res,resource))
        __stageTrainingSpend.push({resource,amount:unitCost*count});
    }
    return __stagePayTrainingCost(cost,count);
  };
  ${seed===null?`Math.random=()=>${battleRandom};`:`globalThis.__stageRng=${seed};Math.random=()=>{
    let x=__stageRng;x^=x<<13;x^=x>>>17;x^=x<<5;__stageRng=x>>>0;return __stageRng/4294967296;};`}
  clrForm('expedition');`);
function place(row,type,count,idx=0){
  const available=run(`S.pool['${type}']||0`);
  assert.ok(available>=count,`现有${type}不足${count}人，仅${available}人`);
  assert.ok(run(`rowSlots('${row}')`)>idx,`${row}[${idx}] 阵位尚未开放`);
  run(`openFormModal('expedition','${row}',${idx});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true,
    `${type} 未编入已解锁的 ${row} 阵位`);
}
function assign(jobs){
  const previous=run('({...S.popAlloc})');
  for(const [key,count] of Object.entries(previous))if(count>0){
    const result=run(`setPopAlloc('${key}',0)`);
    assert.equal(result?.ok,true,`清退${key}岗位失败：${JSON.stringify(result)}`);
  }
  for(const [key,count] of Object.entries(jobs))if(count>0){
    const result=run(`setPopAlloc('${key}',${count})`);
    assert.equal(result?.ok,true,`分配${key}岗位失败：${JSON.stringify(result)}`);
  }
}
function waitFor(condition,max=50000){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}
    return {n,reached:!!(${condition})}})()`);
  assert.equal(result.reached,true,`${condition} 在${max}在线秒内未达：${JSON.stringify(run(`({second:S.tick,food:S.res.food,steel:S.res.steel,stone:S.res.stone,coal:S.res.coal,alloyPool:S.pool.alloy_special,alloyQueue:S.queue.alloy_special,alloyCap:unitCap('alloy_special')})`))}`);
  return result.n;
}
const refills=[];
function recruitTo(key,target){
  const have=run(`S.pool['${key}']||0`),missing=target-have;
  if(missing<=0)return 0;
  const cost=run(`CFG.units['${key}'].cost`);
  if(cost.steel&&run('S.res.steel')<cost.steel*missing){
    assign({food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(`S.res.steel>=${cost.steel*missing}`);
  }
  // 训练逐秒扣费，不能在刚好攒齐粮时继续让冶钢岗位把粮耗尽。
  assign({food:102});
  if(cost.food)waitFor(`S.res.food>=${cost.food*missing+2000}`);
  for(const rk of ['wood','stone','copper','iron','silver','gold'])if(cost[rk])
    assert.ok(run(`S.res.${rk}`)>=cost[rk]*missing,`${key}训练缺${rk}，当前路线未补该材料`);
  const before=run(`S.pool['${key}']||0`);
  const result=run(`train('${key}',${missing})`);
  assert.equal(result?.ok,true,`${key}训练入队失败：${JSON.stringify(result)}`);
  assert.equal(result.qty,missing,`${key}训练队列截断`);
  waitFor(`(S.pool['${key}']||0)>=${target}`);
  assert.equal(run(`S.pool['${key}']`),target);
  assert.equal(run(`S.pool['${key}']`)-before,missing);
  return missing;
}
function refillArmor(target){
  let trained=0;
  while(run('S.pool.armored_trooper||0')<target){
    const missing=target-run('S.pool.armored_trooper||0');
    const batch=Math.min(3,missing),fee=batch*2000;
    assert.ok(run("unitCap('armored_trooper')")>=target,'蒸汽兵坊上限不足');
    for(const rk of ['copper','iron','steel'])
      assert.ok(run(`resCap('${rk}')`)>=fee,`${rk} 仓容不足以训练 ${batch} 名装甲兵`);
    assign({food:10,stone:30,coal:30,copper:30});
    waitFor(`S.res.copper>=${fee}`);
    assign({food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(`S.res.iron>=${fee}&&S.res.steel>=${fee}`);
    assign({food:102});
    const before=run('S.pool.armored_trooper||0');
    const result=run(`train('armored_trooper',${batch})`);
    assert.equal(result?.ok,true,`装甲兵训练失败：${JSON.stringify(result)}`);
    assert.equal(result.qty,batch,'装甲兵训练队列截断');
    waitFor(`(S.pool.armored_trooper||0)>=${before+batch}`);
    trained+=batch;
  }
  return trained;
}
function prepareAlloySquad(forStage){
  run("clrForm('expedition')");
  const before=run(`({second:S.tick,food:S.res.food,steel:S.res.steel,wood:S.res.wood,stone:S.res.stone})`);
  const alloy=recruitTo('alloy_special',40),archer=recruitTo('archer',40);
  const armorTrained=armorRefill39&&forStage===39?refillArmor(40):0;
  place('front','alloy_special',40);
  place('mid','archer',20);
  place('back','archer',20);
  // 保留自然档原有的装甲兵，直到法师压力关才投入已开放的第二前排位。
  const armor=reserveArmor&&[29,39].includes(forStage)?
    Math.min(forStage===39&&armorRefill39?40:20,run('S.pool.armored_trooper||0')):0;
  if(armor)place('front','armored_trooper',armor,1);
  const silver=silverReserve&&forStage===39?recruitTo('silver_heavy',run("unitCap('silver_heavy')")):0;
  if(silverReserve&&forStage===39)place('front','silver_heavy',run('S.pool.silver_heavy'),2);
  const after=run(`({second:S.tick,food:S.res.food,steel:S.res.steel,wood:S.res.wood,stone:S.res.stone})`);
  refills.push({forStage,alloy,archer,armor,armorTrained,silver,before,after});
}
if(alloyFront)prepareAlloySquad(1);
else{
  place('front','armored_trooper',20);
  place('mid','archer',20);
  place('back','archer',20);
}
const rows=[];
let blockedAt=null;
for(let stage=1;stage<=maxStage;stage++){
  assert.equal(run('S.defeated.length'),stage-1,'关卡不可跳过');
  const before=run(`({soldiers:armyCount(),deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),formation:JSON.parse(JSON.stringify(S.formation)),
    merit:S.merit,res:{wood:S.res.wood,stone:S.res.stone,food:S.res.food},
    slots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')}})`);
  run(`selEnemy(${stage-1});openBattle()`);
  assert.equal(run('S.battleActive'),true,`第${stage}关未开始`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__stageStep()'),true,`第${stage}关战斗回调丢失`);
    callbacks++;
  }
  assert.equal(run('S.battleActive'),false,`第${stage}关1000步仍未结算`);
  const after=run(`({soldiers:armyCount(),deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),formation:JSON.parse(JSON.stringify(S.formation)),
    merit:S.merit,res:{wood:S.res.wood,stone:S.res.stone,food:S.res.food},
    slots:{front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')},
    won:S.defeated.includes(${stage}),round:B.round})`);
  const row={stage,name:run(`CFG.enemies[${stage-1}].name`),win:after.won,round:after.round,callbacks,
    armyBefore:before.soldiers,armyAfter:after.soldiers,deployedBefore:before.deployed,deployedAfter:after.deployed,
    formationAfter:after.formation,
    slotsBefore:before.slots,slotsAfter:after.slots,
    meritGain:after.merit-before.merit,
    reward:Object.fromEntries(Object.keys(before.res).map(k=>[k,after.res[k]-before.res[k]]))};
  rows.push(row);
  run('exitBattle()');
  if(!after.won){blockedAt=stage;break}
  if(alloyFront&&replenish&&stage<maxStage)prepareAlloySquad(stage+1);
}
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,run('targetSaveVersion()'));
assert.equal(saved.defeated.length,rows.filter(x=>x.win).length);
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.defeated.length'),saved.defeated.length);
assert.equal(restored.run("['front','mid','back'].map(row=>rowSlots(row)).join('/')"),
  run("['front','mid','back'].map(row=>rowSlots(row)).join('/')"));
if(finalOutArg)fs.writeFileSync(finalOutArg.slice('--snapshot-final='.length),JSON.stringify(saved),'utf8');
const trainingSpend=run(`(()=>{const paid={};for(const event of __stageTrainingSpend)paid[event.resource]=(paid[event.resource]||0)+event.amount;return paid})()`);
console.log(JSON.stringify({unit:'online seconds; soldier count; battle rounds',
  source:inArg?'natural-save-reload':'full-natural-new-game',alloyFront,replenish,reserveArmor,silverReserve,armorRefill39,battleRandom:seed===null?battleRandom:null,seed,start,finish:run('S.tick'),
  population:saved.population.current,initialArmy,attempted:rows.length,wins:saved.defeated.length,
  recruitTotals:{alloy:refills.reduce((n,r)=>n+r.alloy,0),archer:refills.reduce((n,r)=>n+r.archer,0),silver:refills.reduce((n,r)=>n+r.silver,0),armor:refills.reduce((n,r)=>n+r.armorTrained,0)},
  trainingSpend,
  battleLosses:rows.reduce((n,r)=>n+r.deployedBefore-r.deployedAfter,0),
  blockedAt,finalArmy:run('armyCount()'),finalSlots:run(`({front:rowSlots('front'),mid:rowSlots('mid'),back:rowSlots('back')})`),
  finalResources:run(`({wood:S.res.wood,stone:S.res.stone,food:S.res.food,steel:S.res.steel})`),
  refills,rows},null,2));
