'use strict';
// P276：从P275实付档检查觉醒第4阶后的实际补兵门槛。
const fs=require('node:fs');const path=require('node:path');const {environment}=require('../../tests/progression/harness');
const input=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p275-awakening-source-paid-save.json'),'utf8');
const e=environment({rts_save:input}),run=e.run;if(run('loadSaveAndApply().status')!=='ok')throw Error('load failed');
run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
function finish(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){if(!run('__step()'))throw Error('timer exhausted');callbacks++}
  if(run('S.battleActive'))throw Error('battle did not finish');return{result:run("document.getElementById('battle-result').className"),callbacks};}
function swapOut(){
  if(!run("S.formation.back.some(u=>u.type==='star_trooper')"))throw Error('star unavailable for reserve');
  run("rmForm('expedition','back',3);formModalTarget={which:'expedition',row:'back',idx:3};S._formModalSel='archer';S._formModalQty=55;confirmForm();save()");
  if(run("S.formation.back[3]?.type")!=='archer')throw Error('archer return failed');
}
function swapIn(){
  run("rmForm('expedition','back',3);formModalTarget={which:'expedition',row:'back',idx:3};S._formModalSel='star_trooper';S._formModalQty=1;confirmForm();save()");
  if(run("S.formation.back[3]?.type")!=='star_trooper')throw Error('star deploy failed');
}
const rows=[];swapOut();
for(let i=0;i<80;i++){
  const cost=run('S.awakening.star_trooper.level*10+S.formation.front[0]?.count');
  const kind=run('S.items.trialFruit')>=cost?'trial':'fruit';
  if(kind==='trial'){
    swapIn();const payment=run("openAwakeningTrial('easy')");
    if(!payment.ok){rows.push({step:i+1,kind,error:payment.reason});break}
  }else run("openMaterialDomain('trialFruit')");
  if(!run('S.battleActive')){rows.push({step:i+1,kind,error:'battle-not-open'});break}
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  const result=finish();rows.push({step:i+1,kind,...result,enemy,fruit:run('S.items.trialFruit'),alert:run('S.killValues.godSilence'),
    soldiers:run('formSoldierCount()'),star:run("S.formation.back.find(u=>u.type==='star_trooper')?.count||S.pool.star_trooper||0"),level:run('S.awakening.star_trooper.level')});
  run('exitBattle()');if(result.result!=='win')break;
  if(kind==='trial'){
    if(!run("S.formation.back.some(u=>u.type==='star_trooper')")){rows.at(-1).starLost=true;break}
    swapOut();
  }
  if(run('S.awakening.star_trooper.level')>=20)break;
  if(!run('S.formation.front[0]')){rows.at(-1).frontlineDepleted=true;break}
}
const snapshot=run("({formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},res:{...S.res},queue:JSON.parse(JSON.stringify(S.queue)),cap:Object.fromEntries(['infantry','archer','bronze_guard','iron_spearman','silver_heavy','gold_cavalry','alloy_special','armored_trooper','electro_trooper','star_trooper'].map(k=>[k,unitCapLeft(k)])),tick:S.tick})");
const actions=[];
function check(action,label){const result=run(action);if(!result?.ok)throw Error(label+': '+JSON.stringify(result));actions.push({label,result});return result}
check("setPopAlloc('tech',0)",'release tech workers');
check("setPopAlloc('steel',912)",'assign steel workers');
let productionSeconds=0;
while(run('S.res.steel')<5500&&productionSeconds<10000){run('tick()');productionSeconds++}
if(run('S.res.steel')<5500)throw Error('steel production stopped at '+run('S.res.steel'));
const resourcesBeforeTraining=run('({...S.res})');
check("train('alloy_special',55)",'queue alloy');
check("train('iron_spearman',15)",'queue iron');
let trainingSeconds=0;
while((run('S.pool.alloy_special')<55||run('S.pool.iron_spearman')<15)&&trainingSeconds<1000){run('tick()');trainingSeconds++}
if(run('S.pool.alloy_special')<55||run('S.pool.iron_spearman')<15)throw Error('training stalled: '+JSON.stringify(run('({...S.queue})')));
const resourcesAfterTraining=run('({...S.res})');
run("openFormModal('expedition','front',0);S._formModalSel='alloy_special';S._formModalQty=55;confirmForm();openFormModal('expedition','front',1);S._formModalSel='iron_spearman';S._formModalQty=15;confirmForm();save()");
if(run('S.formation.front.length')!==2||run('S.formation.front[0].count')!==55||run('S.formation.front[1].count')!==15)throw Error('re-form failed');
const afterReplenish=run("({formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},res:{...S.res},tick:S.tick,fruit:S.items.trialFruit,level:S.awakening.star_trooper.level})");
const nextKind=run("S.items.trialFruit>=S.awakening.star_trooper.level*10+S.formation.front[0].count")?'trial':'fruit';
if(nextKind==='trial')swapIn();
const nextOpen=run(nextKind==='trial'?"openAwakeningTrial('easy')":"openMaterialDomain('trialFruit')");
if(!run('S.battleActive'))throw Error('next battle open failed: '+JSON.stringify(nextOpen));
const nextBattle=finish();run('exitBattle()');
const afterNextBattle=run("({formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},res:{...S.res},fruit:S.items.trialFruit,level:S.awakening.star_trooper.level})");
if(nextBattle.result!=='win')throw Error('fruit domain lost after replenish');
swapIn();
const trialPayment=run("openAwakeningTrial('easy')");
if(!trialPayment?.ok||!run('S.battleActive'))throw Error('trial open failed: '+JSON.stringify(trialPayment));
const trialEnemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
const trialBattle=finish();run('exitBattle()');
const afterTrial=run("({formation:JSON.parse(JSON.stringify(S.formation)),pool:{...S.pool},res:{...S.res},fruit:S.items.trialFruit,level:S.awakening.star_trooper.level})");
const summary={start:{fruit:8,alert:800,level:1,soldiers:462},steps:rows.length,first:rows[0],last:rows.at(-1),
  wins:rows.filter(r=>r.result==='win').length,trialWins:rows.filter(r=>r.kind==='trial'&&r.result==='win').length,snapshot,
  replenish:{actions,productionSeconds,trainingSeconds,resourcesBeforeTraining,resourcesAfterTraining,afterReplenish},
  nextBattle:{kind:nextKind,...nextBattle,after:afterNextBattle},
  trial:{payment:trialPayment,enemy:trialEnemy,...trialBattle,after:afterTrial}};
console.log(JSON.stringify(summary,null,2));
