'use strict';
// P86: 从P84真实v31档接续，通过实际岗位动作、在线tick及兵装投入将铁枪攻击升至10星。
// 运行：node tools/verify/probe-iron-arms-ten-star-p86.js
// 守御对照只在每场隔离VM内把星数控制为1或10；不把试战奖励／战损写回实付快照。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const input=path.join(__dirname,'../../docs/codex/reports/data/p84-iron-arms-first-star-paid.json');
const output=path.join(__dirname,'../../docs/codex/reports/data/p86-iron-arms-ten-star-paid.json');
const reportPath=path.join(__dirname,'../../docs/codex/reports/data/p86-iron-star-guardian-comparison.json');
const expectedInputSha='73af57fab255ba015cd78ccda388d184721b4cea2f67bf3947c38a2ae04b6138';
const raw=fs.readFileSync(input,'utf8');
const inputSha=crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(inputSha,expectedInputSha,'P84输入快照发生变化，先复核数据链');
const source=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
const originalDateNow=Date.now;

function getSnapshot(env){return env.store.get('rts_save')}
function guardianTrials(snapshot,starOverride){
  const sourceSave=JSON.parse(snapshot);
  if(starOverride!==null)sourceSave.armsUp.iron_spearman.atk.stars=starOverride;
  const trialRaw=JSON.stringify(sourceSave),results=[];
  for(let seed=1;seed<=12;seed++){
    const trial=environment({rts_save:trialRaw}),step=trial.run;
    assert.equal(step('loadSaveAndApply().status'),'ok');
    assert.equal(step('armyCount()'),437);
    assert.equal(step('S.killValues.godGuardian'),4500);
    step(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
      globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
      globalThis.clearTimeout=id=>__timers.delete(id);
      globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
      globalThis.__nodes=new Map();document.getElementById=id=>{
        if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
          classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __nodes.get(id)};
      globalThis.addLog=m=>S.log.push(String(m));
      globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
    const before=step("({army:armyCount(),stone:S.items.guardianStone,iron:weaponAttack('iron_spearman')})");
    step("openMaterialDomain('guardianStone')");
    assert.equal(step('S.battleActive'),true);
    const ironInitial=step(`(()=>{const u=B.ourUnits.find(u=>u.type==='iron_spearman'),enemyDef=B.enemyUnits[0].def;
      const rawBase=combatAttackMass(u)*u.atk*DAMAGE_COEF*(100/(100+enemyDef*8));
      const baseAfterFloor=Math.max(1,Math.floor(rawBase));
      return{atk:u.atk,row:u.row,attackMass:combatAttackMass(u),enemyDef,rawBase,rawWithRandom:[rawBase*0.9,rawBase*1.1],
        baseAfterFloor,damageRangeAfterAdditiveNoise:[Math.max(1,baseAfterFloor-3),Math.max(1,baseAfterFloor+3)]}})()`);
    step(`globalThis.__ironDmg=[];const __realCalcDmg=calcDmg;
      calcDmg=(attacker,defender,isOur)=>{const result=__realCalcDmg(attacker,defender,isOur);
        if(isOur&&attacker.type==='iron_spearman')__ironDmg.push(result.dmg);
        return result};`);
    let callbacks=0;
    while(step('S.battleActive')&&callbacks<1000){assert.equal(step('__step()'),true);callbacks++;}
    assert.equal(step('S.battleActive'),false);
    const after=step(`({kill:S.killValues.godGuardian,stone:S.items.guardianStone,army:armyCount(),round:B.round,
      enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)})`);
    results.push({seed,win:after.kill>4500,round:after.round,armyLost:before.army-after.army,
      stoneGained:after.stone-before.stone,enemyHp:after.enemyHp,callbacks,ironInitial,
      ironDamage:step('({hits:__ironDmg.length,total:__ironDmg.reduce((a,b)=>a+b,0),max:Math.max(0,...__ironDmg)})')});
  }
  return results;
}

try{
  assert.equal(run('loadSaveAndApply().status'),'ok');
  Date.now=()=>source.ts+1000;
  run('Math.random=()=>0.5');
  const start=run(`({tick:S.tick,iron:S.res.iron,pop:S.population.current,army:armyCount(),enemy:S.killValues.godGuardian,
    atkStars:S.armsUp.iron_spearman.atk.stars,atkProgress:S.armsUp.iron_spearman.atk.progress,
    attack:weaponAttack('iron_spearman'),ironCap:resCap('iron')})`);
  for(const[key,value]of Object.entries({tick:7926168,iron:231747,pop:214,army:437,enemy:4500,atkStars:1,atkProgress:0,attack:12,ironCap:4521561}))assert.equal(start[key],value,key);

  // 真实分工：79粮工借助该晚期档已有的超仓粮库存，45铁／45石／45煤恰好闭合投入原料。
  const assignments=[['food',79],['copper',0],['silver',0],['gold',0],['steel',0],['iron',45],['stone',45],['coal',45]];
  for(const[rk,count]of assignments){const result=run(`setPopAlloc('${rk}',${count})`);assert.equal(result.ok,true,`${rk}分工失败`);}
  const economy=run(`({allocTotal:popAllocTotal(),free:popFree(),food:S.res.food,foodRate:prodRate('food'),ironRate:prodRate('iron'),
    foodNeed:totalUpkeep()+popCurrent()*CFG.popFoodCost,smelterBonus:buildingBuff('iron'),
    stone:S.res.stone,coal:S.res.coal,iron:S.res.iron})`);
  assert.equal(economy.allocTotal,214);
  assert.equal(economy.free,0);
  assert.ok(economy.food>0&&economy.foodNeed>economy.foodRate,'本路线应明确核算并实际消耗既有粮食库存');
  assert.ok(economy.food/(economy.foodNeed-economy.foodRate)>10*3600,'既有粮库存不足以支撑规划中的在线投入窗口');
  assert.ok(economy.ironRate>0);

  const stepCost=run("CFG.armsUp.iron_spearman.stepCost*CFG.armsUp.iron_spearman.stepsPerStar");
  assert.equal(stepCost,1000000);
  let elapsed=0;
  const payments=[];
  while(run('S.armsUp.iron_spearman.atk.stars')<10){
    while(run('S.res.iron')<stepCost){
      const count=run(`(()=>{let n=0;while(n<3600&&S.res.iron<${stepCost}){tick();n++}return n})()`);
      assert.ok(Number.isSafeInteger(count)&&count>0);
      elapsed+=count;
      assert.equal(run('S.tick'),start.tick+elapsed);
      assert.ok(run('S.res.food')>0,'粮食耗尽，路线已不可持续');
      assert.ok(run("Object.values(S.res).every(v=>Number.isFinite(v)&&v>=0)"),'检测到负数或非有限资源');
      assert.equal(run('saveProtected()'),false);
    }
    const beforeIron=run('S.res.iron');
    const payment=run("investArmsUp('iron_spearman','atk',1000)");
    assert.equal(payment.ok,true);
    assert.equal(payment.cost,stepCost);
    assert.equal(payment.progress,0);
    payments.push({stars:payment.stars,elapsed,tick:run('S.tick'),ironBefore:beforeIron,ironAfter:run('S.res.iron'),attack:run("weaponAttack('iron_spearman')")});
  }
  assert.equal(payments.length,9);
  assert.equal(run('S.armsUp.iron_spearman.atk.stars'),10);
  const paidSnapshot=getSnapshot(e);
  assert.ok(paidSnapshot);
  assert.equal(run('save().ok'),true);
  const finalState=run(`({tick:S.tick,pop:S.population.current,army:armyCount(),enemy:S.killValues.godGuardian,
    stars:S.armsUp.iron_spearman.atk.stars,progress:S.armsUp.iron_spearman.atk.progress,
    attack:weaponAttack('iron_spearman'),iron:S.res.iron,ironCap:resCap('iron'),food:S.res.food,
    stone:S.res.stone,coal:S.res.coal,alloc:S.popAlloc})`);
  assert.equal(finalState.tick,start.tick+elapsed);
  assert.equal(finalState.stars,10);
  assert.equal(finalState.army,437);
  assert.equal(finalState.enemy,4500);
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.armsUp.iron_spearman.atk.stars'),10);
  assert.equal(run('S.res.iron'),finalState.iron);
  assert.equal(run('S.tick'),finalState.tick);

  const baseline=guardianTrials(paidSnapshot,1);
  const withTenStars=guardianTrials(paidSnapshot,null);
  const outputRaw=getSnapshot(e);
  fs.writeFileSync(output,outputRaw);
  const summary={input:path.basename(input),inputSha256:inputSha,output:path.basename(output),
    outputSha256:crypto.createHash('sha256').update(outputRaw).digest('hex'),start,economy,
    route:{elapsedOnlineSeconds:elapsed,elapsedOnlineHours:elapsed/3600,ironSpent:payments.reduce((n,p)=>n+stepCost,0),
      payments,finalState,reload:'ok'},guardian:{kind:'同一10星付款终档隔离回放，仅攻击星数控制为1或10；固定种子；奖励与损失全部丢弃',
      baselineWins:baseline.filter(row=>row.win).length,tenStarWins:withTenStars.filter(row=>row.win).length,
      baseline,withTenStars}};
  const reportRaw=JSON.stringify(summary,null,2)+'\n';
  fs.writeFileSync(reportPath,reportRaw);
  console.log(JSON.stringify({input:summary.input,inputSha256:summary.inputSha256,
    output:summary.output,outputSha256:summary.outputSha256,report:path.basename(reportPath),
    reportSha256:crypto.createHash('sha256').update(reportRaw).digest('hex'),
    elapsedOnlineSeconds:elapsed,elapsedOnlineHours:elapsed/3600,ironSpent:summary.route.ironSpent,
    attackBeforeAfter:[baseline[0].ironInitial.atk,withTenStars[0].ironInitial.atk],
    wins:[summary.guardian.baselineWins,summary.guardian.tenStarWins],
    damageIdenticalEverySeed:baseline.every((row,index)=>row.ironDamage.total===withTenStars[index].ironDamage.total&&row.enemyHp===withTenStars[index].enemyHp&&row.armyLost===withTenStars[index].armyLost)},null,2));
}catch(error){
  console.error(error&&error.stack||error);
  process.exitCode=1;
}finally{
  Date.now=originalDateNow;
}
