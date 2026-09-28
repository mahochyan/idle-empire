'use strict';
// P275新首阶实付档后续固定流；使用现有编队动作将星际兵留在后排/后备，不注入材料或兵力。
const fs=require('node:fs');const path=require('node:path');const {environment}=require('../../tests/progression/harness');
const outputName=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length)||'p275-awakening-corrected-pressure.json';
if(!/^p[0-9]+-[a-z0-9-]+\.json$/.test(outputName))throw Error('invalid output name');
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
const summary={start:{fruit:8,alert:800,level:1,soldiers:462},steps:rows.length,first:rows[0],last:rows.at(-1),
  wins:rows.filter(r=>r.result==='win').length,trialWins:rows.filter(r=>r.kind==='trial'&&r.result==='win').length};
fs.writeFileSync(path.join(__dirname,'../../docs/codex/reports/data',outputName),JSON.stringify({summary,rows},null,2));
console.log(JSON.stringify(summary,null,2));
