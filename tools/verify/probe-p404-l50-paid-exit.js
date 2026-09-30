'use strict';
// P404: bounded, real-action L50 paid army trials from the P403 gold-ready save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p403-l50-gold-ready-save.json';
const out='docs/codex/reports/data/p404-l50-paid-exit.json';
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',input];
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,digest(f)]));
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const inputTs=JSON.parse(raw).ts;
const copy=x=>JSON.parse(JSON.stringify(x));
const trials=[];

function trial(name,plan){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(env.store.get('rts_save'),raw,'source save was rewritten on load');
  assert.equal(run('S.defeated.length'),49);
  run(`(()=>{
    const g=globalThis,NativeDate=Date;
    g.__p404={now:${inputTs},timerNow:0,nextTickMs:CFG.tickMs,timerId:1,timers:new Map(),training:[]};
    g.Date=class extends NativeDate{static now(){return g.__p404.now}};
    g.Math.random=()=>0.5;
    const nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:'',
        scrollHeight:0,scrollTop:0,className:'',
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return nodes.get(id)
    };
    g.addLog=m=>S.log.push(String(m));
    const origPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{g.__p404.training.push({cost:{...cost},n,tick:S.tick});return origPay(cost,n)};
    const origTick=tick;
    g.tick=function(){const result=origTick();g.__p404.now+=1000;return result};
    g.setTimeout=(fn,delay=0)=>{const p=g.__p404,id=p.timerId++;
      p.timers.set(id,{fn,at:p.timerNow+Math.max(0,Number(delay)||0)});return id};
    g.clearTimeout=id=>g.__p404.timers.delete(id);
    g.__p404Step=()=>{
      const p=g.__p404;let selected=null;
      for(const [id,timer]of p.timers)
        if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
          selected={id,timer};
      if(!selected)return false;
      while(p.nextTickMs<=selected.timer.at){p.timerNow=p.nextTickMs;g.tick();p.nextTickMs+=CFG.tickMs}
      p.timerNow=Math.max(p.timerNow,selected.timer.at);
      p.timers.delete(selected.id);selected.timer.fn();return true;
    };
  })()`);
  const events=[];
  let online=0,battleMs=0;
  const state=()=>copy(run(`({tick:S.tick,defeated:S.defeated.length,merit:S.merit,
    essence:{...S.essence},res:{...S.res},
    buildings:JSON.parse(JSON.stringify(S.buildings)),sciences:[...S.sciences],
    pool:{...S.pool},queue:JSON.parse(JSON.stringify(S.queue)),
    formation:JSON.parse(JSON.stringify(S.formation)),popAlloc:{...S.popAlloc}})`));
  const action=(expr,label)=>{
    const before=state(),result=copy(run(expr));
    events.push({label,online,expr,result,before,after:state()});
    assert.equal(result?.ok,true,`${label}: ${JSON.stringify(result)}`);
    return result;
  };
  const wait=seconds=>{assert.ok(Number.isSafeInteger(seconds)&&seconds>=0);
    run(`for(let i=0;i<${seconds};i++)tick()`);online+=seconds};
  const waitUntil=(expr,max,label)=>{
    let waited=0;
    while(!run(expr)&&waited<max){wait(10);waited+=10}
    events.push({label:'wait '+label,seconds:waited,online,satisfied:!!run(expr),state:state()});
    assert.equal(!!run(expr),true,`${label} timed out after ${waited}s`);
  };
  const setWorkers=target=>{
    const prev=copy(run('({...S.popAlloc})'));
    for(const [rk,n]of Object.entries(prev))if(n>0)action(`setPopAlloc('${rk}',0)`,'release '+rk);
    for(const [rk,n]of Object.entries(target))if(n>0)action(`setPopAlloc('${rk}',${n})`,'assign '+rk);
    assert.ok(run('popAllocTotal()<=popCurrent()'));
  };
  const reload=label=>{
    action('save()','save '+label);
    const saved=env.store.get('rts_save'),fresh=environment({rts_save:saved});
    assert.equal(fresh.run('loadSaveAndApply().status'),'ok',label);
    for(const expr of ['S.defeated.length','S.tick','S.res','S.merit','S.essence','S.sciences','S.buildings','S.formation','S.pool','S.queue'])
      assert.deepEqual(copy(fresh.run(expr)),copy(run(expr)),`${label}: ${expr}`);
    events.push({label:'reload '+label,online,sha256:crypto.createHash('sha256').update(saved).digest('hex')});
  };
  const own=type=>run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`);
  const fill=(type,target)=>{
    const missing=target-own(type)-run(`S.queue['${type}']?.count||0`);
    if(missing>0)action(`train('${type}',${missing})`,`queue ${missing} ${type}`);
    waitUntil(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')>=${target}`,20000,`train ${type} to ${target}`);
    assert.equal(own(type),target);
    reload(`trained ${type}`);
  };
  const build=(key,target)=>{
    while(run(`bldSt('${key}').lv`)<target){
      const next=run(`bldSt('${key}').lv`)+1;
      waitUntil(`(()=>{const c=bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}');return Object.entries(c).every(([rk,n])=>rk==='time'||S.res[rk]>=n)})()`,20000,`${key} Lv${next} materials`);
      action(`buildAct('${key}')`,`build ${key} Lv${next}`);
      waitUntil(`bldSt('${key}').lv>=${next}&&bldSt('${key}').state==='idle'`,300,`${key} Lv${next} complete`);
      reload(`${key} Lv${next}`);
    }
  };
  const place=(row,type,count,index)=>{
    assert.ok(run(`rowSlots('${row}')`)>index);
    assert.ok(run(`(S.pool['${type}']||0)>=${count}`));
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===${count}`),true);
    events.push({label:`place ${row}[${index}] ${count} ${type}`,online,state:state()});
  };
  const form=army=>{
    run("clrForm('expedition')");
    const indexes={front:0,mid:0,back:0};
    for(const [row,type,count]of army)place(row,type,count,indexes[row]++);
    reload('formation ready');
  };
  const combat=()=>{
    const before=state(),armyBefore=run('armyCount()'),timerBefore=run('__p404.timerNow');
    const types=['archer_silverbow','bronze_guard','iron_spearman','silver_heavy','gold_cavalry'];
    const ownedBefore=Object.fromEntries(types.map(type=>[type,own(type)]));
    run('selEnemy(49);openBattle()');
    assert.equal(run('S.battleActive'),true);
    const enemy=copy(run(`({name:B.enemyCfg.name,
      roster:B.enemyUnits.map(u=>({type:u.type,count:u.initialCount,hp:u.hp,atk:u.atk,def:u.def}))})`));
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__p404Step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false,'L50 callback bound');
    const won=run('hasLevelDefeated(49)'),round=run('B.round');
    battleMs+=run('__p404.timerNow')-timerBefore;
    run('exitBattle()');reload('L50 result');
    const after=state(),armyAfter=run('armyCount()');
    const ownedAfter=Object.fromEntries(types.map(type=>[type,own(type)]));
    const losses=Object.fromEntries(types.map(type=>[type,ownedBefore[type]-ownedAfter[type]]));
    events.push({label:'battle L50',online,won,round,callbacks,battleMs,
      armyBefore,armyAfter,ownedBefore,ownedAfter,losses,enemy,before,after});
    return{won,round,callbacks,armyBefore,armyAfter,losses,enemy};
  };
  let failure=null,readySave=null,battle=null,measurements={};
  try{
    measurements=plan({run,action,wait,waitUntil,setWorkers,reload,own,fill,build,form})||{};
    readySave=env.store.get('rts_save');
    battle=combat();
  }catch(error){failure=String(error.stack||error)}
  const finalSave=env.store.get('rts_save');
  const charges=copy(run('__p404.training'));
  const trainingPaid={};
  for(const row of charges)for(const [rk,n]of Object.entries(row.cost))trainingPaid[rk]=(trainingPaid[rk]||0)+n*row.n;
  const buildingPaid={};
  for(const event of events.filter(e=>e.label.startsWith('build ')))
    for(const rk of Object.keys(event.before.res)){
      const amount=event.before.res[rk]-event.after.res[rk];
      if(amount>0)buildingPaid[rk]=(buildingPaid[rk]||0)+amount;
    }
  const changed=(before,after)=>{
    if(JSON.stringify(before)===JSON.stringify(after))return undefined;
    if(before&&after&&!Array.isArray(before)&&!Array.isArray(after)&&
      typeof before==='object'&&typeof after==='object'){
      const diff={};
      for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
        const value=changed(before[key],after[key]);
        if(value!==undefined)diff[key]=value;
      }
      return diff;
    }
    return[before,after];
  };
  const ledger=events.map(e=>{
    const row={label:e.label,online:e.online};
    for(const key of ['expr','result','seconds','satisfied','sha256','won','round',
      'callbacks','battleMs','armyBefore','armyAfter','ownedBefore','ownedAfter','losses','enemy'])if(key in e)row[key]=e[key];
    if(e.before&&e.after)row.changed=changed(e.before,e.after);
    if(e.state&&e.label.startsWith('wait '))row.atTick=e.state.tick;
    return row;
  });
  const base=`docs/codex/reports/data/p404-l50-${name}`;
  if(readySave)fs.writeFileSync(path.join(root,base+'-ready-save.json'),readySave+'\n');
  fs.writeFileSync(path.join(root,base+'-final-save.json'),finalSave+'\n');
  const summary={name,input,inputSha256:sourceHash[input],online,battleMs,
    buildingPaid,trainingPaid,chargeCount:charges.length,measurements,battle,failure,
    readySave:readySave?base+'-ready-save.json':null,
    readySha256:readySave?digest(base+'-ready-save.json'):null,
    finalSave:base+'-final-save.json',finalSha256:digest(base+'-final-save.json'),
    final:state(),events:ledger};
  trials.push(summary);
  console.log(JSON.stringify({name,online,battleMs,buildingPaid,trainingPaid,
    battle:{won:battle?.won,round:battle?.round,armyBefore:battle?.armyBefore,
      armyAfter:battle?.armyAfter,losses:battle?.losses},failure,finalSave:summary.finalSave},null,2));
  return summary;
}

const extraBows=trial('extra-bows',({setWorkers,fill,form,run})=>{
  assert.equal(run("unitCap('archer_silverbow')"),42);
  assert.equal(run('regMax()'),10);
  setWorkers({food:13,wood:4,stone:2});
  fill('archer_silverbow',40);
  form([
    ['front','gold_cavalry',10],['front','silver_heavy',10],['front','bronze_guard',10],['front','iron_spearman',10],
    ['mid','iron_spearman',10],['mid','bronze_guard',10],
    ['back','archer_silverbow',10],['back','archer_silverbow',10],
    ['back','archer_silverbow',10],['back','archer_silverbow',10]
  ]);
});
if(!extraBows.battle?.won){
  trial('armory-and-bows',({setWorkers,fill,build,form,run})=>{
    setWorkers({food:9,wood:5,stone:5});
    const foodRateFarm1=run("prodRate('food')");
    build('farm',3);
    const foodRateFarm3=run("prodRate('food')");
    build('gold_armory',4);
    build('silver_armory',2);
    assert.equal(run("unitCap('gold_cavalry')"),17);
    assert.equal(run("unitCap('silver_heavy')"),20);
    setWorkers({food:13,wood:4,stone:2});
    fill('archer_silverbow',40);
    setWorkers({food:14,coal:1,stone:2,gold:2});
    const foodRateGold=run("prodRate('food')");
    fill('gold_cavalry',17);
    setWorkers({food:14,coal:1,stone:2,silver:2});
    fill('silver_heavy',20);
    form([
      ['front','gold_cavalry',10],['front','gold_cavalry',7],['front','silver_heavy',10],['front','silver_heavy',10],
      ['mid','iron_spearman',10],['mid','bronze_guard',10],['mid','iron_spearman',10],['mid','bronze_guard',10],
      ['back','archer_silverbow',10],['back','archer_silverbow',10],
      ['back','archer_silverbow',10],['back','archer_silverbow',10]
    ]);
    return{foodWorkersBeforeAfterFarm:9,foodRateFarm1,foodRateFarm3,
      foodWorkersGold:14,foodRateGold};
  });
}
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,digest(f)])),sourceHash,'source/input changed during P404 replay');
fs.writeFileSync(path.join(root,out),JSON.stringify({batch:'P404',head:process.env.GIT_HEAD||null,
  input,inputSha256:sourceHash[input],sourceHash,
  method:'Independent P403 paid gold-ready v36 save, real worker assignment, builds, queues, formation actions, fixed Math.random 0.5 and battle callbacks; no injected state',
  units:'online is simulated tick seconds; battleMs is callback milliseconds; menu actions are instantaneous in the harness',
  trials},null,2)+'\n');
if(trials.some(x=>x.failure))process.exitCode=1;
