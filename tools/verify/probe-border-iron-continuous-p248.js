'use strict';
// P248: continuous live combat/recruitment with an iron-point config candidate.
// The candidate is injected into each isolated VM; production is actual tick().
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const formal=process.argv.includes('--formal');
const outputFile=formal?'docs/codex/reports/data/p249-border-iron-formal.json':
  'docs/codex/reports/data/p248-border-iron-continuous.json';
const sourceSave=fs.readFileSync(path.join(root,sourceFile),'utf8').trim();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const target={bronze_guard:15,infantry_t1:15,archer_t1:13};
const candidate={key:'borderIron',site:'iron',name:'边疆铁脉关隘',needScience:'sci_iron',
  developmentBorder:true,boss:false,units:{infantry:[6,5],archer:[3,2]},
  alertPerWin:20,levelPerWin:1,reward:{}};
const realDate=global.Date;
global.Date=class extends realDate {
  constructor(...args){super(...(args.length?args:[1790400000001]))}
  static now(){return 1790400000001}
};

function boot(save){
  const env=environment({rts_save:save}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(formal)assert.deepEqual(plain(run('CFG.developmentBorder.iron')),candidate);
  else run(`CFG.developmentBorder.iron=${JSON.stringify(candidate)}`);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const entry=__timers.entries().next().value;if(!entry)return false;__timers.delete(entry[0]);entry[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)
    };
    globalThis.addLog=message=>S.log.push(String(message));
    globalThis.__paid={};globalThis.__minPayFood=S.res.food;
    globalThis.__realPay=payTrainingCost;
    payTrainingCost=(cost,n)=>{__realPay(cost,n);__minPayFood=Math.min(__minPayFood,S.res.food);
      for(const [key,value] of Object.entries(cost))__paid[key]=(__paid[key]||0)+value*n};`);
  assert.equal(run('S.sciences.includes("sci_iron")'),true);
  assert.equal(run('S.defeated.includes(19)'),false);
  assert.equal(run('S.popAlloc.iron'),0);
  return{env,run};
}
function own(run,key){return run(`(S.pool['${key}']||0)+expeditionCount('${key}')+garrisonCount('${key}')`)}
function state(run){return plain(run('({tick:S.tick,res:{...S.res},point:{...S.development.border.sites.iron},collection:{...S.development.border.collection},formation:S.formation,defeated:[...S.defeated]})'))}
function formArmy(run){
  run("clrForm('expedition')");
  for(const [row,slot,key,count] of [['front',0,'bronze_guard',15],
    ['front',1,'infantry_t1',15],['back',0,'archer_t1',13]]){
    assert.ok(run(`rowSlots('${row}')`)>slot);
    assert.ok(run(`poolAvail('${key}')`)>=count);
    run(`openFormModal('expedition','${row}',${slot});
      S._formModalSel='${key}';S._formModalQty=${count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),count);
  }
  assert.equal(run('armyCount()'),43);
}
function reload(ctx){
  assert.equal(ctx.run('save().ok'),true);
  const raw=ctx.env.store.get('rts_save'),fresh=boot(raw);
  assert.deepEqual(state(fresh.run),state(ctx.run));
  for(const key of Object.keys(target))assert.equal(own(fresh.run,key),own(ctx.run,key));
  return{...fresh,sha256:sha(raw)};
}
function seed(run,flow,attempt){
  run(`globalThis.__rng=${(flow*1009+(10+attempt)*9176)>>>0};
    Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
}
function fight(ctx,flow,attempt){
  const {run,env}=ctx;
  formArmy(run);
  seed(run,flow,attempt);
  const before=state(run);
  const ownedBefore=Object.fromEntries(Object.keys(target).map(key=>[key,own(run,key)]));
  run("openDevelopmentBorder('iron')");
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run('({alert:B.enemyCfg.alert,groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})'));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=state(run);
  assert.deepEqual(after.defeated,before.defeated);
  assert.equal(after.res.coin,before.res.coin);
  if(won){
    assert.equal(after.point.level,Math.min(500,before.point.level+1));
    assert.equal(after.point.wins,before.point.wins+1);
  }else assert.deepEqual(after.point,before.point);
  const loss=Object.fromEntries(Object.keys(target).map(key=>[key,ownedBefore[key]-own(run,key)]));
  const saved=env.store.get('rts_save');
  assert.deepEqual(state(boot(saved).run),after);
  run('exitBattle()');
  return{won,callbacks,before,after,enemy,loss,battleSaveSha256:sha(saved)};
}
function recover(ctx,battle){
  const {run}=ctx;
  if(run('S.development.border.collection.activeSite')!=='iron')
    assert.equal(run("selectDevelopmentSite('iron').ok"),true);
  const ironBefore=run('S.res.iron');
  const requested={};
  for(const [key,n] of Object.entries(target)){
    const missing=Math.max(0,n-own(run,key)-run(`S.queue['${key}']?.count||0`));
    requested[key]=missing;
    if(missing)assert.equal(run(`train('${key}',${missing}).ok`),true);
  }
  const ready=()=>Object.entries(target).every(([key,n])=>own(run,key)>=n);
  let seconds=0;
  while(!ready()&&seconds<3600){run('tick()');seconds++}
  const ironAfter=run('S.res.iron');
  const next=reload(ctx);
  return{next,record:{ready:ready(),seconds,requested,
    minFoodAfterPayment:run('__minPayFood'),paid:plain(run('({...__paid})')),
    ironActual:ironAfter-ironBefore,after:state(run),saveSha256:next.sha256}};
}

try{
  const flows=[];
  for(let flow=1;flow<=16;flow++){
    let ctx=boot(sourceSave);
    const rows=[];
    for(let attempt=1;attempt<=30;attempt++){
      const battle=fight(ctx,flow,attempt);
      if(!battle.won){rows.push({attempt,battle,recovery:null});break}
      const recovered=recover(ctx,battle);
      rows.push({attempt,battle,recovery:recovered.record});
      ctx=recovered.next;
      if(!recovered.record.ready)break;
    }
    flows.push({flow,rows,final:state(ctx.run),finalSaveSha256:ctx.sha256});
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',sourceFile,'tools/verify/probe-border-iron-continuous-p248.js'];
  const result={batch:formal?'P249':'P248',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{sourceSaveSha256:sha(sourceSave),candidate,formal,army:target,
      maxWins:30,maxRecoverySeconds:3600,ironWorkers:0,
      collection:'activate iron point after first victory, online tick only',
      coinReward:'none; original mother gold coin has no current player currency mapping'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),flows};
  const dest=path.join(root,outputFile);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:formal?'P249':'P248',flows:flows.map(f=>({flow:f.flow,
    wins:f.rows.filter(r=>r.battle.won).length,
    ready:f.rows.filter(r=>r.recovery?.ready).length,
    totalRecoverySeconds:f.rows.reduce((n,r)=>n+(r.recovery?.seconds||0),0),
    totalPointIron:f.rows.reduce((n,r)=>n+(r.recovery?.ironActual||0),0),
    finalLevel:f.final.point.level,finalIron:f.final.res.iron,
    minFoodPay:Math.min(...f.rows.map(r=>r.recovery?.minFoodAfterPayment??Infinity))})),outputFile},null,2));
}finally{global.Date=realDate}
