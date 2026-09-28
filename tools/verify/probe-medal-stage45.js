'use strict';
// 从真实第45关存档挑战重复区域。仅复现当前持有军队，不预置材料、兵力或警戒值。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {environment}=require('../../tests/progression/harness');
const saveArg=process.argv.find(x=>x.startsWith('--save='));
assert.ok(saveArg,'须提供真实第45关存档 --save=路径');
const finalArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const prebattleArg=process.argv.find(x=>x.startsWith('--snapshot-prebattle='));
const maxArg=process.argv.find(x=>x.startsWith('--battles='));
const maxBattles=maxArg?Number(maxArg.slice('--battles='.length)):20;
assert.ok(Number.isSafeInteger(maxBattles)&&maxBattles>=1&&maxBattles<=200);
// 开发侧诊断回合上限的敏感性，不更改玩家战斗配置或存档。
const roundArg=process.argv.find(x=>x.startsWith('--round-limit='));
const roundLimit=roundArg?Number(roundArg.slice('--round-limit='.length)):null;
assert.ok(roundLimit===null||Number.isSafeInteger(roundLimit)&&roundLimit>=1&&roundLimit<=100,
  '--round-limit 须为1～100的整数');
const domainArg=process.argv.find(x=>x.startsWith('--domain='));
const domain=domainArg?domainArg.slice('--domain='.length):'medal';
const domainSpec={
  medal:{stock:'res',kill:'godSlaughter'},
  bone:{stock:'res',kill:'wildBoar'},
  bullHorn:{stock:'items',kill:'wildBull'},
  snakeGall:{stock:'items',kill:'wildSnake'},
  tigerPelt:{stock:'items',kill:'wildTiger'},
  turtleShell:{stock:'items',kill:'wildTurtle'},
  wyrmSinew:{stock:'items',kill:'wildWyrm'},
  godCrystal:{stock:'items',kill:'godRevival'},
  guardianStone:{stock:'items',kill:'godGuardian'},
  phantomFlower:{stock:'items',kill:'godPhantom'}
}[domain];
assert.ok(domainSpec,'--domain 须为材料挑战的有效 key');
const replenish=process.argv.includes('--replenish');
const auxReserve=process.argv.includes('--aux-reserve');
const goldReserve=process.argv.includes('--gold-reserve');
const frontArmor=process.argv.includes('--front-armor');
const electricArg=process.argv.find(x=>x.startsWith('--electric-reserve='));
const electricTarget=electricArg?Number(electricArg.slice('--electric-reserve='.length)):(process.argv.includes('--electric-reserve')?8:0);
const rosterArg=process.argv.find(x=>x.startsWith('--main-roster='));
const mainRoster=rosterArg?Number(rosterArg.slice('--main-roster='.length)):40;
assert.ok(Number.isSafeInteger(mainRoster)&&mainRoster>=40&&mainRoster<=55,'主力单团目标须为40～55人');
assert.ok(Number.isSafeInteger(electricTarget)&&electricTarget>=0&&electricTarget<=mainRoster,'电磁预备队目标须为0～主力单团目标');
const electricReserve=electricTarget>0;
const frontSilver=process.argv.includes('--front-silver');
assert.ok(!auxReserve||replenish,'多兵团对照须使用补兵路线');
assert.ok(!goldReserve||replenish,'黄金重骑兵对照须使用补兵路线');
assert.ok(!electricReserve||replenish,'电磁预备队对照须使用补兵路线');
assert.ok(!frontSilver||(auxReserve&&frontArmor&&electricReserve&&!goldReserve),
  '前排银甲对照须有三辅助兵、前排装甲兵与电磁兵，且不加黄金骑兵');
const forgeArg=process.argv.find(x=>x.startsWith('--forge-armored='));
const forgeTarget=forgeArg?Number(forgeArg.slice('--forge-armored='.length)):0;
assert.ok(Number.isSafeInteger(forgeTarget)&&forgeTarget>=0&&forgeTarget<=3);
const electroForgeArg=process.argv.find(x=>x.startsWith('--forge-electro='));
const electroForgeTarget=electroForgeArg?Number(electroForgeArg.slice('--forge-electro='.length)):0;
assert.ok(Number.isSafeInteger(electroForgeTarget)&&electroForgeTarget>=0&&electroForgeTarget<=3);
const alloyArg=process.argv.find(x=>x.startsWith('--forge-alloy='));
const alloyTarget=alloyArg?Number(alloyArg.slice('--forge-alloy='.length)):0;
assert.ok(Number.isSafeInteger(alloyTarget)&&alloyTarget>=0&&alloyTarget<=3);
const conditionalStats={};
const steamChainArg=process.argv.find(x=>x.startsWith('--conditional-steam-chain='));
const conditionalSteamChain=steamChainArg?Number(steamChainArg.slice('--conditional-steam-chain='.length)):0;
assert.ok(Number.isSafeInteger(conditionalSteamChain)&&conditionalSteamChain>=0&&conditionalSteamChain<=3,
  '--conditional-steam-chain 须为0～3的条件等级');
assert.ok(!conditionalSteamChain||!finalArg,'条件装备战斗不得写成实付快照');
const conditionalNanoArmor=process.argv.includes('--conditional-nano-armor');
assert.ok(!conditionalNanoArmor||!finalArg,'条件纳米甲战斗不得写成实付快照');
for(const [flag,unit,stat] of [['--conditional-alloy-def=','alloy_special','def'],
  ['--conditional-armor-def=','armored_trooper','def'],
  ['--conditional-alloy-atk=','alloy_special','atk'],
  ['--conditional-armor-atk=','armored_trooper','atk'],
  ['--conditional-electro-atk=','electro_trooper','atk'],
  ['--conditional-electro-def=','electro_trooper','def']]){
  const arg=process.argv.find(x=>x.startsWith(flag));
  if(!arg)continue;
  const bonus=Number(arg.slice(flag.length));
  assert.ok(Number.isSafeInteger(bonus)&&bonus>=0&&bonus<=1000,`${flag}须为0～1000整数`);
  conditionalStats[`${unit}.${stat}`]=bonus;
}
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const seed=seedArg?Number(seedArg.slice('--seed='.length)):null;
assert.ok(seed===null||Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff);
assert.ok(!prebattleArg||!roundLimit&&!conditionalSteamChain&&!conditionalNanoArmor&&Object.keys(conditionalStats).length===0,
  '实付战前快照不得包含条件回合、装备或属性');
const e=environment({rts_save:fs.readFileSync(saveArg.slice('--save='.length),'utf8')});
const run=e.run;
assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),'第45关旧存档未能安全重载/迁移');
assert.equal(run('S.defeated.length'),45);
if(conditionalSteamChain)for(const [key,level] of [['gatling',1],['mortar',1],['steamArmor',conditionalSteamChain]])
  run(`S.weaponForge.${key}={researched:true,level:${level},progress:0,equipped:true}`);
if(conditionalNanoArmor)run('S.weaponForge.nanoArmor={researched:true,level:1,progress:0,equipped:true}');
for(const [key,bonus] of Object.entries(conditionalStats)){
  const [unit,stat]=key.split('.');
  run(`CFG.units.${unit}.${stat}+=${bonus}`);
}
const stockExpr=`S.${domainSpec.stock}.${domain}`;
const killExpr=`S.killValues.${domainSpec.kill}`;
const start=run(`({second:S.tick,population:S.population.current,medal:S.res.medal,godCore:S.items.godCore,stock:${stockExpr},kill:${killExpr},army:armyCount(),formation:S.formation})`);
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;
    if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  ${seed===null?'Math.random=()=>0.5;':`globalThis.__rng=${seed};Math.random=()=>{
    let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296;};`}
  clrForm('expedition');`);
function place(row,type,count,idx=0){
  assert.ok(run(`S.pool.${type}`)>=count,`${type} 库存不足`);
  assert.ok(run(`rowSlots('${row}')`)>idx,`${row}[${idx}] 尚未解锁`);
  run(`openFormModal('expedition','${row}',${idx});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
function assign(jobs){
  for(const [key,count] of Object.entries(run('({...S.popAlloc})')))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',0)`)?.ok,true,`清退 ${key} 岗位失败`);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    assert.equal(run(`setPopAlloc('${key}',${count})`)?.ok,true,`分配 ${key} 岗位失败`);
}
function upgradeRosterBuilding(key,target){
  while(run(`bldSt('${key}').lv`)<target){
    const cost=run(`upCost('${key}')`),level=run(`bldSt('${key}').lv`)+1;
    for(const rk of ['wood','stone','food'])if(cost[rk])
      assert.ok(run(`resCap('${rk}')`)>=cost[rk],`${key} 升级缺 ${rk} 仓容`);
    assign({food:20,wood:40,stone:42});
    waitFor(`S.res.wood>=${cost.wood||0}&&S.res.stone>=${cost.stone||0}&&S.res.food>=${cost.food||0}`,500000);
    const before=run('({...S.res})');
    const result=run(`buildAct('${key}')`);
    assert.equal(result?.ok,true,`${key} Lv${level} 建造失败：${JSON.stringify(result)}`);
    for(const rk of ['wood','stone','food'])if(cost[rk])
      assert.equal(Math.round(before[rk]-run(`S.res.${rk}`)),cost[rk],`${key} 未实扣 ${rk}`);
    waitFor(`bldSt('${key}').lv===${level}&&bldSt('${key}').state==='idle'`,200);
  }
}
function waitFor(condition,max=50000){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}
    return {n,reached:!!(${condition})}})()`);
  assert.equal(result.reached,true,`${condition} 在 ${max} 在线秒内未达`);
}
const recruited={alloy:0,armor:0,archer:0,bronze:0,iron:0,silver:0,electric:0,gold:0};
function recruitSimple(key,target){
  const have=run(`S.pool.${key}||0`),missing=target-have;
  if(missing<=0)return;
  const cost=run(`CFG.units.${key}.cost`);
  if(cost.steel&&run('S.res.steel')<cost.steel*missing){
    assign({food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(`S.res.steel>=${cost.steel*missing}`);
  }
  assign({food:102});
  if(cost.food)waitFor(`S.res.food>=${cost.food*missing+2000}`);
  for(const rk of ['wood','stone','iron','silver'])if(cost[rk])
    assert.ok(run(`S.res.${rk}`)>=cost[rk]*missing,`${key} 缺 ${rk}`);
  const result=run(`train('${key}',${missing})`);
  assert.equal(result?.ok,true,`${key} 训练失败：${JSON.stringify(result)}`);
  assert.equal(result.qty,missing,`${key} 训练队列截断`);
  waitFor(`(S.pool.${key}||0)>=${target}`);
  recruited[({alloy_special:'alloy',archer:'archer',bronze_guard:'bronze',iron_spearman:'iron',silver_heavy:'silver'})[key]]+=missing;
}
function recruitAux(){
  assert.equal(run("unitCap('bronze_guard')"),15);
  assert.equal(run("unitCap('iron_spearman')"),15);
  assert.equal(run("unitCap('silver_heavy')"),15);
  if(!goldReserve){
    const bronzeMissing=15-run('S.pool.bronze_guard||0');
    if(run('S.res.copper')<bronzeMissing*100){
      assign({food:10,stone:30,coal:30,copper:30});
      waitFor(`S.res.copper>=${bronzeMissing*100}`);
    }
  }
  const silverMissing=15-run('S.pool.silver_heavy||0');
  if(run('S.res.silver')<silverMissing*100){
    assign({food:10,stone:30,coal:30,silver:30});
    waitFor(`S.res.silver>=${silverMissing*100}`);
  }
  for(const type of goldReserve?['iron_spearman','silver_heavy']:['bronze_guard','iron_spearman','silver_heavy']){
    recruitSimple(type,15);
  }
}
function recruitGold(target){
  while(run("bldSt('gold_armory').lv")<Math.ceil((target-5)/3)){
    const cost=run("upCost('gold_armory')"),level=run("bldSt('gold_armory').lv")+1;
    for(const rk of ['wood','stone','food'])assert.ok(run(`resCap('${rk}')`)>=cost[rk],`${rk} 容量不足以扩黄金马厩`);
    for(const rk of ['wood','stone'])assert.ok(run(`S.res.${rk}`)>=cost[rk],`${rk} 库存不足以扩黄金马厩`);
    assign({food:102});
    waitFor(`S.res.food>=${cost.food}`,300000);
    const result=run("buildAct('gold_armory')");
    assert.equal(result?.ok,true,`黄金马厩 Lv${level} 建造失败：${JSON.stringify(result)}`);
    waitFor(`bldSt('gold_armory').lv===${level}&&bldSt('gold_armory').state==='idle'`,200);
  }
  const missing=target-run('S.pool.gold_cavalry||0');
  if(missing<=0)return;
  assert.ok(run("unitCap('gold_cavalry')")>=target,'黄金马厩持有上限不足');
  assert.ok(run("resCap('gold')")>=missing*100,'金属金仓容不足');
  assign({food:10,stone:30,coal:30,gold:30});
  waitFor(`S.res.gold>=${missing*100}`,300000);
  assign({food:102});
  waitFor(`S.res.food>=${missing*1000}`,300000);
  const result=run(`train('gold_cavalry',${missing})`);
  assert.equal(result?.ok,true,`黄金重骑兵训练失败：${JSON.stringify(result)}`);
  assert.equal(result.qty,missing,'黄金重骑兵训练队列截断');
  waitFor(`(S.pool.gold_cavalry||0)>=${target}`);
  recruited.gold+=missing;
}
function recruitArmor(target){
  while(run('S.pool.armored_trooper||0')<target){
    const missing=target-run('S.pool.armored_trooper||0');
    const batch=Math.min(3,missing),fee=batch*2000;
    for(const rk of ['copper','iron','steel'])assert.ok(run(`resCap('${rk}')`)>=fee,`${rk} 仓容不足`);
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
    recruited.armor+=batch;
  }
}
function recruitElectric(target){
  const before=run("S.pool.electro_trooper||0"),missing=target-before;
  if(missing<=0)return;
  assert.ok(run("unitCap('electro_trooper')")>=target,'电磁兵坊上限不足');
  const fee=missing*8000;
  for(const rk of ['copper','iron','steel'])assert.ok(run(`resCap('${rk}')`)>=fee,`${rk} 仓容不足`);
  if(run('S.res.copper')<fee){
    assign({food:10,stone:30,coal:30,copper:30});
    waitFor(`S.res.copper>=${fee}`,300000);
  }
  if(run('S.res.iron')<fee||run('S.res.steel')<fee){
    assign({food:10,stone:33,coal:26,iron:20,steel:12});
    waitFor(`S.res.iron>=${fee}&&S.res.steel>=${fee}`,300000);
  }
  const result=run(`train('electro_trooper',${missing})`);
  assert.equal(result?.ok,true,`电磁兵训练失败：${JSON.stringify(result)}`);
  assert.equal(result.qty,missing,'电磁兵训练队列截断');
  waitFor(`(S.pool.electro_trooper||0)>=${target}`);
  recruited.electric+=missing;
}
function upgradeElectricArmory(target){
  while(run("bldSt('electric_armory').lv")<target){
    const cost=run("upCost('electric_armory')"),level=run("bldSt('electric_armory').lv")+1;
    for(const rk of ['wood','stone','food'])assert.ok(run(`resCap('${rk}')`)>=cost[rk],`${rk} 容量不足以扩电磁兵坊`);
    for(const rk of ['wood','stone'])assert.ok(run(`S.res.${rk}`)>=cost[rk],`${rk} 库存不足以扩电磁兵坊`);
    assign({food:102});
    waitFor(`S.res.food>=${cost.food}`,300000);
    const result=run("buildAct('electric_armory')");
    assert.equal(result?.ok,true,`电磁兵坊 Lv${level} 建造失败：${JSON.stringify(result)}`);
    waitFor(`bldSt('electric_armory').lv===${level}&&bldSt('electric_armory').state==='idle'`,200);
  }
}
function prepare(){
  run("clrForm('expedition')");
  if(mainRoster>40){
    upgradeRosterBuilding('barracks',Math.ceil((mainRoster-5)/5));
    for(const key of ['alloy_armory','steam_armory','electric_armory'])
      upgradeRosterBuilding(key,Math.ceil((mainRoster-5)/3));
    while(run("unitCap('archer')")<mainRoster)
      upgradeRosterBuilding('archer_range',run("bldSt('archer_range').lv")+1);
  }
  recruitSimple('alloy_special',mainRoster);
  recruitArmor(mainRoster);
  recruitSimple('archer',mainRoster);
  if(auxReserve)recruitAux();
  if(goldReserve)recruitGold(40);
  if(electricReserve){
    if(electricTarget>run("unitCap('electro_trooper')"))upgradeElectricArmory(Math.ceil((electricTarget-5)/3));
    recruitElectric(electricTarget);
  }
  place('front','alloy_special',mainRoster);
  place(frontArmor?'front':'mid','armored_trooper',mainRoster,frontArmor?1:0);
  place('back','archer',mainRoster);
  if(auxReserve){
    if(!goldReserve)place(frontArmor?'mid':'front','bronze_guard',15,frontArmor?0:1);
    place(frontSilver?'front':(frontArmor?'mid':'front'),'silver_heavy',15,frontSilver?3:2);
    place('mid','iron_spearman',15,1);
  }
  if(electricReserve)place('front','electro_trooper',electricTarget,frontArmor?2:(auxReserve?3:1));
  if(goldReserve)place('front','gold_cavalry',40,frontArmor?3:(auxReserve?1:2));
}
function forgeArmored(target){
  if(!target)return null;
  assert.ok(run('S.res.medal')>=1000,'勋章不足以研发蒸汽装甲枪');
  assign({food:20,tech:82});
  waitFor('S.res.tech>=20000');
  const before=run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,iron:S.res.iron,steel:S.res.steel})");
  const research=run("researchWeapon('armored')");
  assert.equal(research?.ok,true,`蒸汽装甲枪研发失败：${JSON.stringify(research)}`);
  const steps=target===1?20:target===2?32:46;
  assert.ok(run('S.res.iron')>=steps*10000,'锻造缺铁');
  assert.ok(run("resCap('steel')")>=steps*500,'锻造钢仓不足');
  assign({food:10,stone:33,coal:26,iron:20,steel:12});
  waitFor(`S.res.steel>=${steps*500}`);
  for(let n=0;n<steps;n++){
    const result=run("forgeWeapon('armored')");
    assert.equal(result?.ok,true,`第 ${n+1} 次锻造失败：${JSON.stringify(result)}`);
  }
  assert.equal(run('S.weaponForge.armored.level'),target);
  assert.equal(run("setWeaponEquipped('armored',true)")?.ok,true);
  return {before,after:run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,iron:S.res.iron,steel:S.res.steel,attack:weaponAttack('armored_trooper')})"),steps};
}
function forgeAlloy(target){
  if(!target)return null;
  const steps=target===1?20:target===2?32:46;
  assert.ok(run('S.res.medal')>=160,'勋章不足以研发合金剑和合金甲');
  assign({food:20,tech:82});
  waitFor('S.res.tech>=10000');
  const before=run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,steel:S.res.steel})");
  assert.equal(run("researchWeapon('alloySword')")?.ok,true,'合金剑研发失败');
  assert.equal(run("researchWeapon('alloyArmor')")?.ok,true,'合金甲研发失败');
  assert.ok(run("resCap('steel')")>=steps*400,'钢仓容不足以双件锻造');
  assign({food:10,stone:33,coal:26,iron:20,steel:12});
  waitFor(`S.res.steel>=${steps*400}`);
  for(let n=0;n<steps;n++){
    assert.equal(run("forgeWeapon('alloySword')")?.ok,true,`合金剑第${n+1}次投入失败`);
    assert.equal(run("forgeWeapon('alloyArmor')")?.ok,true,`合金甲第${n+1}次投入失败`);
  }
  assert.equal(run('S.weaponForge.alloySword.level'),target);
  assert.equal(run('S.weaponForge.alloyArmor.level'),target);
  assert.equal(run("setWeaponEquipped('alloySword',true)")?.ok,true);
  assert.equal(run("setWeaponEquipped('alloyArmor',true)")?.ok,true);
  return {before,after:run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,attack:weaponAttack('alloy_special'),defense:weaponDefense('alloy_special')})"),steps};
}
function forgeElectro(target){
  if(!target)return null;
  const gear=run('CFG.weaponForge.electro');
  const before=run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,iron:S.res.iron,steel:S.res.steel,level:S.weaponForge.electro.level})");
  if(!run('S.weaponForge.electro.researched')){
    assert.ok(run('S.res.medal')>=gear.researchCost.medal,'勋章不足以研发电磁枪');
    assign({food:20,tech:82});
    waitFor(`S.res.tech>=${gear.researchCost.tech}`,300000);
    const payment=run('({tech:S.res.tech,medal:S.res.medal})');
    const research=run("researchWeapon('electro')");
    assert.equal(research?.ok,true,`电磁枪研发失败：${JSON.stringify(research)}`);
    assert.equal(payment.tech-run('S.res.tech'),gear.researchCost.tech,'电磁枪研发知识实扣不符');
    assert.equal(payment.medal-run('S.res.medal'),gear.researchCost.medal,'电磁枪研发勋章实扣不符');
  }
  let steps=0;
  while(run('S.weaponForge.electro.level')<target){
    if(run('S.res.iron')<gear.stepCost.iron){
      assign({food:10,stone:33,coal:26,iron:33});
      waitFor('S.res.iron>=200000',300000);
    }
    if(run('S.res.steel')<gear.stepCost.steel){
      assign({food:10,stone:33,coal:26,iron:20,steel:12});
      waitFor('S.res.steel>=5000',300000);
    }
    const payment=run('({iron:S.res.iron,steel:S.res.steel})');
    const result=run("forgeWeapon('electro')");
    assert.equal(result?.ok,true,`电磁枪第${steps+1}次投入失败：${JSON.stringify(result)}`);
    assert.equal(payment.iron-run('S.res.iron'),gear.stepCost.iron,'电磁枪锻造铁实扣不符');
    assert.equal(payment.steel-run('S.res.steel'),gear.stepCost.steel,'电磁枪锻造钢实扣不符');
    steps++;
    assert.ok(steps<=46,'电磁枪投入次数超过三级配置的46次');
  }
  assert.equal(run("setWeaponEquipped('electro',true)")?.ok,true);
  return {before,after:run("({second:S.tick,tech:S.res.tech,medal:S.res.medal,iron:S.res.iron,steel:S.res.steel,level:S.weaponForge.electro.level,attack:weaponAttack('electro_trooper')})"),steps};
}
const alloyGear=forgeAlloy(alloyTarget);
const forge=forgeArmored(forgeTarget);
const electroForge=forgeElectro(electroForgeTarget);
if(replenish)prepare();
else{
  place('front','alloy_special',28);
  place('mid','armored_trooper',27);
  place('back','archer',40);
}
if(prebattleArg){
  assert.equal(run('save().ok'),true,'战前状态保存失败');
  const prebattle=e.store.get('rts_save');
  const prebattleData=JSON.parse(prebattle);
  assert.equal(prebattleData.tick,run('S.tick'));
  const fresh=environment({rts_save:prebattle});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok');
  fs.writeFileSync(prebattleArg.slice('--snapshot-prebattle='.length),prebattle,'utf8');
}
const rows=[];
for(let n=1;n<=maxBattles;n++){
  const before=run(`({medal:S.res.medal,godCore:S.items.godCore,stock:${stockExpr},kill:${killExpr},army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation))})`);
  run(domain==='godCrystal'?"openGodDomain()":`openMaterialDomain('${domain}')`);
  assert.equal(run('S.battleActive'),true,`${domain} 挑战未开始`);
  if(roundLimit!==null)run(`B.maxRound=${roundLimit}`);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,reward:B.enemyCfg.reward.medal})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){
    assert.equal(run('__step()'),true,'战斗回调丢失');callbacks++;
  }
  assert.equal(run('S.battleActive'),false,'1000次回调仍未结算');
  const after=run(`({medal:S.res.medal,godCore:S.items.godCore,stock:${stockExpr},kill:${killExpr},army:armyCount(),formation:JSON.parse(JSON.stringify(S.formation)),round:B.round,enemyHp:B.enemyUnits[0].hp})`);
  rows.push({n,win:after.kill>before.kill,round:after.round,callbacks,enemy,
    stockGain:after.stock-before.stock,
    medalGain:after.medal-before.medal,godCoreGain:after.godCore-before.godCore,killGain:after.kill-before.kill,
    armyBefore:before.army,armyAfter:after.army,enemyAfterHp:after.enemyHp,formationAfter:after.formation});
  run('exitBattle()');
  if(after.kill<=before.kill)break;
  if(replenish&&n<maxBattles)prepare();
}
const saved=run("JSON.parse(localStorage.getItem('rts_save'))");
assert.equal(saved.v,29);
assert.equal(saved.defeated.length,45);
const restored=environment({rts_save:JSON.stringify(saved)});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('S.res.medal'),saved.res.medal);
assert.equal(restored.run('S.items.godCore'),saved.items.godCore);
assert.equal(restored.run(`S.${domainSpec.stock}.${domain}`),saved[domainSpec.stock][domain]);
assert.equal(restored.run(killExpr),saved.killValues[domainSpec.kill]);
if(electroForgeTarget){
  assert.equal(restored.run('S.weaponForge.electro.level'),electroForgeTarget);
  assert.equal(restored.run('S.weaponForge.electro.equipped'),true);
}
if(finalArg)fs.writeFileSync(finalArg.slice('--snapshot-final='.length),JSON.stringify(saved),'utf8');
console.log(JSON.stringify({unit:'battle rounds; soldiers; reward units; online seconds',domain,roundLimit,start,replenish,auxReserve,goldReserve,frontArmor,frontSilver,mainRoster,electricTarget,seed,forge,alloyGear,electroForge,conditionalStats,conditionalSteamChain,conditionalNanoArmor,recruited,
  attempted:rows.length,wins:rows.filter(r=>r.win).length,
  finish:{second:saved.tick,medal:saved.res.medal,godCore:saved.items.godCore,stock:saved[domainSpec.stock][domain],kill:saved.killValues[domainSpec.kill],army:run('armyCount()')},rows},null,2));
