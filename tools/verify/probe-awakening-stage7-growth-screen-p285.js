'use strict';
// Isolated stage-7 sensitivity from the paid full-roster save. Upgrade levels are unpaid.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const variants=[
  {key:'baseline',set:''},
  {key:'star-atk-1',set:'S.armsUp.star_trooper.atk.stars=1'},
  {key:'star-def-1',set:'S.armsUp.star_trooper.def.stars=1'},
  {key:'star-hp-1',set:'S.armsUp.star_trooper.hp.stars=1'},
  {key:'star-all-1',set:'for(const k of ["atk","def","hp"])S.armsUp.star_trooper[k].stars=1'},
  {key:'star-all-10',set:'for(const k of ["atk","def","hp"])S.armsUp.star_trooper[k].stars=10'},
  {key:'star-all-40',set:'for(const k of ["atk","def","hp"])S.armsUp.star_trooper[k].stars=40'},
  {key:'star-all-40-nano-40',set:'for(const k of ["atk","def","hp"])S.armsUp.star_trooper[k].stars=40;S.weaponForge.nanoArmor.level=40'},
  {key:'star-all-100-nano-40',set:'for(const k of ["atk","def","hp"])S.armsUp.star_trooper[k].stars=100;S.weaponForge.nanoArmor.level=40'},
  {key:'nano-20',set:'S.weaponForge.nanoArmor.level=20'},
  {key:'nano-40',set:'S.weaponForge.nanoArmor.level=40'},
  {key:'energy-10-nano-10',set:'S.weaponForge.energyArmor.level=10'},
  {key:'rifle-sniper-10',set:'S.weaponForge.electroRifle.level=10;S.weaponForge.electroSniper.level=10'}
];
const seeds=Array.from({length:11},(_,i)=>i+1),rows=[];
for(const variant of variants)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.awakening.star_trooper.level'),6);
  assert.equal(run('S.items.trialFruit'),25);
  if(variant.set)run(variant.set);
  run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  function finish(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);return{result:run("document.getElementById('battle-result').className"),
      callbacks,enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')};}
  let fruitWins=0;
  for(let i=0;i<2;i++){run("openMaterialDomain('trialFruit')");assert.equal(run('S.battleActive'),true);
    const battle=finish();if(battle.result==='win')fruitWins++;run('exitBattle()');if(battle.result!=='win')break;}
  let trial=null;
  if(fruitWins===2){run(`globalThis.__rng=${seed}`);const paid=run("openAwakeningTrial('easy')");assert.equal(paid.ok,true);
    trial={paidFruit:paid.cost,...finish(),level:run('S.awakening.star_trooper.level'),
      soldiers:run('formSoldierCount()'),star:run("expeditionCount('star_trooper')"),fruit:run('S.items.trialFruit')};}
  rows.push({variant:variant.key,seed,fruitWins,trial});
}
const byVariant=variants.map(v=>{const set=rows.filter(r=>r.variant===v.key),trials=set.map(r=>r.trial).filter(Boolean),hp=trials.map(r=>r.enemyHpLeft);
  return{variant:v.key,conditional:v.key!=='baseline',fruitWins:set.reduce((n,r)=>n+r.fruitWins,0),trialStarts:trials.length,
    trialWins:trials.filter(r=>r.result==='win').length,minEnemyHpLeft:Math.min(...hp),maxEnemyHpLeft:Math.max(...hp)};});
const output='docs/codex/reports/data/p285-awakening-stage7-growth-screen.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P285',kind:'VM-only unpaid stat sensitivity on paid full-roster source; fruit battles and trial use real actions; trial RNG restarts at matched seed after fruit battles',
  source,sourceSha256,seeds,byVariant,rows},null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256,byVariant,output},null,2));
