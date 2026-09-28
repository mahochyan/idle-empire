'use strict';
// P15 候选奖励的早期闭环诊断：从真实零战斗18人口路线出发，分叉同一战前存档，
// 一条不发奖、一条只在真实首胜后由开发 harness 记候选地契；然后调用真实扩建与 tick。
// 这不是玩家代码实现，也不是四策略/短时上线验收。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {environment}=require('../../tests/progression/harness');

const sourcePath=path.join(__dirname,'probe-population-early-18.js');
const source=fs.readFileSync(sourcePath,'utf8');
const sourceRequire=createRequire(sourcePath);
const natural=new Function('require','console','__dirname',
  source+String.fromCharCode(10)+'return {run};')(
    sourceRequire,{log(){},error:console.error},__dirname);
const startSave=natural.run("localStorage.getItem('rts_save')");
assert.equal(natural.run('S.population.current'),18);
assert.equal(natural.run('maxPop()'),18);
assert.equal(natural.run('S.defeated.length'),0);
assert.equal(natural.run('S.res.deed'),0);

function checked(run,expression,label){
  const result=run(expression);
  assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
  return result;
}
function assign(run,target){
  const previous=run('({...S.popAlloc})');
  for(const key of Object.keys({...previous,...target}))if((previous[key]||0)>0)
    checked(run,`setPopAlloc('${key}',0)`,`清退${key}`);
  for(const [key,count] of Object.entries(target))if(count>0)
    checked(run,`setPopAlloc('${key}',${count})`,`分配${key}`);
  assert.ok(run('popAllocTotal()<=popCurrent()'));
}
function waitFor(run,condition,max=10000){
  const result=run(`(()=>{let n=0;while(!(${condition})&&n<${max}){tick();n++}
    return{n,ok:!!(${condition})}})()`);
  assert.equal(result.ok,true,`等待${condition}失败：${JSON.stringify(run(`({tick:S.tick,pop:S.population.current,capacity:maxPop(),res:S.res})`))}`);
  return result.n;
}

// 经济路线已走到18/18；只加建营地、训练并编队，仍按真实建造/训练/存档动作结算。
const prep=environment({rts_save:startSave});
const prepRun=prep.run;
assert.equal(prepRun('loadSaveAndApply().status'),'ok');
assign(prepRun,{wood:10,stone:3,food:5});
checked(prepRun,"buildAct('barracks')",'建营帐');
checked(prepRun,"buildAct('infantry_camp')",'建步兵营地');
checked(prepRun,"buildAct('archer_range')",'建弓兵营地');
waitFor(prepRun,"bldSt('barracks').lv===1&&bldSt('infantry_camp').lv===1&&bldSt('archer_range').lv===1");
waitFor(prepRun,'S.res.wood>=1490&&S.res.stone>=410&&S.res.food>=690');
checked(prepRun,"train('infantry',15)",'训练步兵');
checked(prepRun,"train('archer',13)",'训练猎人');
waitFor(prepRun,'S.pool.infantry>=15&&S.pool.archer>=13');
// 用真实长科技链解锁青铜装备，验证早期战力墙是否仅由基础步兵造成。
checked(prepRun,"researchScience('sci_large_granary')",'研究大粮仓');
checked(prepRun,"researchScience('sci_bronze_age')",'研究青铜时代');
waitFor(prepRun,'S.res.wood>=600&&S.res.stone>=560&&S.res.food>=300');
checked(prepRun,"buildAct('copper_store')",'建造铜仓');
checked(prepRun,"buildAct('bronze_workshop')",'建造青铜工坊');
waitFor(prepRun,"bldSt('copper_store').lv===1&&bldSt('bronze_workshop').lv===1");
assign(prepRun,{stone:6,food:3,coal:6,copper:3});
checked(prepRun,"train('bronze_guard',8)",'训练青铜刀盾兵');
waitFor(prepRun,'S.pool.bronze_guard>=8');
assert.equal(prepRun('regMax()'),10,'营帐首级应提供每团10人上限');
assert.equal(prepRun('S.population.current'),18,'军备准备不应免费增加村民');
assert.equal(prepRun('S.defeated.length'),0,'战前不得注入关卡胜利');
checked(prepRun,'save()','保存战前军备档');
const battleStart=prepRun("localStorage.getItem('rts_save')");
const battleStartTick=prepRun('S.tick');

function makeBranch(rewardMode){
  const withCandidateReward=rewardMode!=='none';
  const e=environment({rts_save:battleStart});
  const run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__p15Timers=new Map();globalThis.__p15TimerId=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__p15TimerId++;__p15Timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__p15Timers.delete(id);
    globalThis.__p15Step=()=>{const first=__p15Timers.entries().next().value;
      if(!first)return false;__p15Timers.delete(first[0]);first[1]();return true};
    globalThis.__p15Nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__p15Nodes.has(id))__p15Nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __p15Nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  function place(row,type,count,idx=0){
    if(count<=0)return;
    assert.ok(run(`rowSlots('${row}')`)>idx,`${row}[${idx}]尚未开放`);
    assert.ok(run(`S.pool['${type}']||0`)>=count,`${type}余量不足`);
    run(`openFormModal('expedition','${row}',${idx});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true,
      `${type}未编入${row}[${idx}]`);
  }
  function prepare(){
    run("clrForm('expedition')");
    let bronze=run('S.pool.bronze_guard||0');
    for(let i=0;i<run("rowSlots('front')")&&bronze>0;i++){
      const n=Math.min(run('regMax()'),bronze);place('front','bronze_guard',n,i);bronze-=n;
    }
    let infantry=run('S.pool.infantry||0');
    for(let i=0;i<run("rowSlots('front')")&&infantry>0;i++){
      if(run(`S.formation.front[${i}]`))continue;
      const n=Math.min(run('regMax()'),infantry);place('front','infantry',n,i);infantry-=n;
    }
    let archers=run('S.pool.archer||0');
    for(const row of ['back','mid'])for(let i=0;i<run(`rowSlots('${row}')`)&&archers>0;i++){
      const n=Math.min(run('regMax()'),archers);place(row,'archer',n,i);archers-=n;
    }
    const deployed=run(`S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0)`);
    assert.ok(deployed>0,'没有可出战士兵');
  }
  const rows=[];
  let blockedAt=null;
  for(let stage=1;stage<=10;stage++){
    assert.equal(run('S.defeated.length'),stage-1,'首胜路线不可跳关');
    prepare();
    const before=run(`({deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),
      soldiers:armyCount(),population:popCurrent(),capacity:maxPop(),deed:S.res.deed})`);
    run(`selEnemy(${stage-1});openBattle()`);
    assert.equal(run('S.battleActive'),true,`第${stage}关未开战`);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){
      assert.equal(run('__p15Step()'),true,`第${stage}关战斗回调丢失`);
      callbacks++;
    }
    assert.equal(run('S.battleActive'),false,`第${stage}关未结算`);
    const result=run(`({won:S.defeated.includes(${stage}),
      deployed:S.formation.front.concat(S.formation.mid,S.formation.back).reduce((n,u)=>n+u.count,0),
      soldiers:armyCount(),round:B.round})`);
    run('exitBattle()');
    let award=0,earlyMilestoneBonus=0,spent=0;
    if(result.won&&withCandidateReward){
      const firstClear=!run(`S.defeated.slice(0,-1).includes(${stage})`);
      if(firstClear){
        const enemy=run(`CFG.enemies.find(e=>e.id===${stage})`);
        award=Math.ceil(stage/10)+(enemy?.boss?5:0);
        if(rewardMode==='frontloaded'&&stage===3){earlyMilestoneBonus=6;award+=earlyMilestoneBonus;}
        const saved=run(`(()=>{S.res.deed+=${award};return save()})()`);
        assert.equal(saved?.ok,true,`候选地契保存失败：${JSON.stringify(saved)}`);
        while(run("settlementBatchPreview('village',1).ok")){
          const quote=run("settlementBatchPreview('village',1)");
          const upgraded=run(`upgradeSettlement('village',${quote.startLevel})`);
          assert.equal(upgraded?.ok,true,`真实村庄扩建失败：${JSON.stringify(upgraded)}`);
          spent+=upgraded.cost;
        }
      }
    }
    // 明确模拟胜后准备的10在线秒；容量有空位且有粮时才按当前真实规则出生。
    run('for(let i=0;i<10;i++)tick()');
    if(rewardMode==='frontloaded'&&stage===3&&run('popCurrent()')>before.population){
      checked(run,`setPopAlloc('wood',${run('S.popAlloc.wood+1')})`,'将新增村民投入木工');
    }
    rows.push({stage,win:result.won,round:result.round,callbacks,
      deployedBefore:before.deployed,deployedAfter:result.deployed,soldiersBefore:before.soldiers,
      soldiersAfter:result.soldiers,awardDeed:award,earlyMilestoneBonus,deedSpent:spent,
      deedAfter:run('S.res.deed'),capacity:run('maxPop()'),population:run('popCurrent()'),
      allocated:run('popAllocTotal()'),workers:run('({...S.popAlloc})'),woodRate:run("prodRate('wood')"),
      second:run('S.tick')});
    if(!result.won){blockedAt=stage;break;}
  }
  assert.equal(run('S.defeated.length'),rows.filter(x=>x.win).length);
  checked(run,'save()','保存路线终态');
  const saved=JSON.parse(run("localStorage.getItem('rts_save')"));
  assert.equal(saved.v,run('targetSaveVersion()'));
  const restored=environment({rts_save:JSON.stringify(saved)});
  assert.equal(restored.run('loadSaveAndApply().status'),'ok');
  assert.equal(restored.run('S.population.current'),saved.population.current);
  return {rewardMode,withCandidateReward,start: battleStartTick,startPopulation:18,startCapacity:18,
    attempted:rows.length,wins:rows.filter(x=>x.win).length,blockedAt,rows,
    finish:run('S.tick'),finalPopulation:run('popCurrent()'),finalCapacity:run('maxPop()'),
    finalDeed:run('S.res.deed'),finalSettlements:run('({...S.settlements})'),finalArmy:run('armyCount()'),
    saveVersion:saved.v,restoredPopulation:restored.run('S.population.current')};
}

const baseline=makeBranch('none');
const candidate=makeBranch('current');
const frontloaded=makeBranch('frontloaded');
assert.equal(baseline.attempted,candidate.attempted,'分叉路线关卡数应一致');
assert.deepEqual(baseline.rows.map(x=>x.win),candidate.rows.map(x=>x.win),
  '胜后发地契不得改变本关或后续既定军备的战斗胜负');
assert.equal(baseline.wins,candidate.wins,'无奖励与候选奖励的战斗结果应一致');
assert.equal(baseline.blockedAt,6,'青铜前排路线的真实早期战力边界发生在第6关');
assert.equal(candidate.rows[4].deedAfter,5,'当前候选公式到第5关仍不足首次村庄扩建');
assert.equal(candidate.rows[4].capacity,18);
assert.equal(frontloaded.rows[2].deedSpent,9,'前置里程碑奖励应只够真实扩建一次');
assert.equal(frontloaded.rows[2].capacity,19,'扩建应经真实聚落函数增加1容量');
assert.equal(frontloaded.rows[2].population,19,'扩建后10在线秒应真实出生1名村民');
assert.equal(frontloaded.rows[2].allocated,19,'新增村民应通过真实分工动作进入经济岗位');
assert.equal(frontloaded.rows[2].workers.wood,1,'新增劳动力应由真实分工动作进入木工');
assert.equal(frontloaded.rows[2].woodRate,3,'额外木工应按当前真实产率贡献3木/在线秒');
assert.deepEqual(baseline.rows.map(x=>x.win),frontloaded.rows.map(x=>x.win),
  '战后地契、出生与岗位分配不能回写并改变既定军备的战斗结果');
assert.deepEqual(baseline.rows.map(x=>[x.win,x.deployedBefore,x.deployedAfter,x.soldiersBefore,x.soldiersAfter]),
  frontloaded.rows.map(x=>[x.win,x.deployedBefore,x.deployedAfter,x.soldiersBefore,x.soldiersAfter]),
  '奖励、扩容和岗位分工不能改变既定兵力的关卡结果或战损');
function summarize(branch){
  return {rewardMode:branch.rewardMode,start:branch.start,attempted:branch.attempted,wins:branch.wins,
    blockedAt:branch.blockedAt,finalPopulation:branch.finalPopulation,finalCapacity:branch.finalCapacity,
    finalDeed:branch.finalDeed,saveVersion:branch.saveVersion,restoredPopulation:branch.restoredPopulation,
    stages:branch.rows.map(({stage,win,deployedBefore,deployedAfter,soldiersBefore,soldiersAfter,
      awardDeed,earlyMilestoneBonus,deedSpent,deedAfter,capacity,population,woodRate})=>({stage,win,
        deployedBefore,deployedAfter,soldiersBefore,soldiersAfter,awardDeed,earlyMilestoneBonus,
        deedSpent,deedAfter,capacity,population,woodRate}))};
}
console.log(JSON.stringify({units:'online seconds; people; soldiers; deeds',
  source:'real zero-battle 18-pop route + real bronze/infantry training, battle, settlement, allocation, and tick functions',
  currentCandidateFormula:'ceil(stage/10) + 5 for bosses; test overlay only after first-clear victory',
  earlyFeedbackProbe:'current candidate plus a proposed +6 border-expansion deed milestone on first-clear stage 3',
  assumedPostWinIdleSeconds:10,battleRandom:0.5,trainingPopulationNotInjected:true,
  baseline:summarize(baseline),candidate:summarize(candidate),frontloaded:summarize(frontloaded)},null,2));
