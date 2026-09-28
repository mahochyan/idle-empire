'use strict';
// 从P273已付款知识6级档按本批首兵团费用和守卫公式重跑真实异果→首阶链路。
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input=fs.readFileSync(path.join(root,'docs/codex/reports/data/p273-nuclear-knowledge-six-paid-save.json'),'utf8');
const e=environment({rts_save:input}),run=e.run;
if(run('loadSaveAndApply().status')!=='migrated')throw Error('expected protected migration');
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
const harvest=[];
for(let i=0;i<30&&run('S.items.trialFruit')<55;i++){
  run("openMaterialDomain('trialFruit')");if(!run('S.battleActive'))throw Error('material battle blocked');
  const b=finish();harvest.push({round:i+1,...b,fruit:run('S.items.trialFruit'),alert:run('S.killValues.godSilence'),soldiers:run('formSoldierCount()')});
  run('exitBattle()');if(b.result!=='win')break;
}
if(run('S.items.trialFruit')<55)throw Error('insufficient earned fruit');
run("rmForm('expedition','back',3);formModalTarget={which:'expedition',row:'back',idx:3};S._formModalSel='star_trooper';S._formModalQty=1;confirmForm();save()");
if(!run("S.formation.back.some(u=>u.type==='star_trooper')"))throw Error('star soldier not deployed');
const cost=run('awakeningTrialCost()'),beforeFruit=run('S.items.trialFruit');
if(cost!==55)throw Error('source first-unit cost not applied: '+cost);
const paid=run("openAwakeningTrial('easy')");if(!paid.ok)throw Error('trial rejected: '+JSON.stringify(paid));
const guard=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
const trial=finish(),after={level:run('S.awakening.star_trooper.level'),stars:run('S.awakening.star_trooper.stars'),
  fruit:run('S.items.trialFruit'),soldiers:run('formSoldierCount()'),starSurvivors:run("S.formation.back.find(u=>u.type==='star_trooper')?.count||0"),mainline:run('S.defeated.length')};
const save=e.store.get('rts_save'),sha256=crypto.createHash('sha256').update(save).digest('hex');
const reload=environment({rts_save:save});
if(reload.run('loadSaveAndApply().status')!=='ok'||reload.run('S.awakening.star_trooper.level')!==after.level||
    reload.run('S.items.trialFruit')!==after.fruit)throw Error('terminal save did not reload');
const data={source:'P273 knowledge6 paid save',harvest,trial:{...trial,cost,beforeFruit,guard,...after},saveSha256:sha256};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p275-awakening-source-paid.json'),JSON.stringify(data,null,2));
if(trial.result==='win')fs.writeFileSync(path.join(root,'docs/codex/reports/data/p275-awakening-source-paid-save.json'),save);
console.log(JSON.stringify({harvestBattles:harvest.length,first:harvest[0],last:harvest.at(-1),trial:data.trial,saveSha256:sha256},null,2));
if(trial.result!=='win')process.exitCode=1;
