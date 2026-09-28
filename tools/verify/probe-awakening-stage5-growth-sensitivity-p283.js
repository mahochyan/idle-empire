'use strict';
// Conditional VM-only growth sensitivity for the stage-5 guard after its source passives.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p277-awakening-steam3-energy3-rifle2-sniper2-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const seeds=[1,2,3,4,5,6,7,8,9,10,11];
const variants=[
  {key:'baseline',set:''},
  {key:'star-attack-10',set:'S.armsUp.star_trooper.atk.stars=10'},
  {key:'star-attack-40',set:'S.armsUp.star_trooper.atk.stars=40'},
  {key:'star-attack-100',set:'S.armsUp.star_trooper.atk.stars=100'},
  {key:'star-defense-40',set:'S.armsUp.star_trooper.def.stars=40'},
  {key:'star-attack-defense-40',set:'S.armsUp.star_trooper.atk.stars=40;S.armsUp.star_trooper.def.stars=40'},
  {key:'energy-armor-4',set:'S.weaponForge.energyArmor.level=4'},
  {key:'energy-armor-10',set:'S.weaponForge.energyArmor.level=10'},
  {key:'electro-rifle-sniper-10',set:'S.weaponForge.electroRifle.level=10;S.weaponForge.electroSniper.level=10'},
  {key:'nano-armor-1',set:'Object.assign(S.weaponForge.nanoArmor,{researched:true,level:1,equipped:true})'},
  {key:'nano-armor-10',set:'Object.assign(S.weaponForge.nanoArmor,{researched:true,level:10,equipped:true})'},
  {key:'energy-nano-10',set:'S.weaponForge.energyArmor.level=10;Object.assign(S.weaponForge.nanoArmor,{researched:true,level:10,equipped:true})'},
  {key:'high-electric-gear',set:'S.weaponForge.energyArmor.level=10;S.weaponForge.electroRifle.level=10;S.weaponForge.electroSniper.level=10;Object.assign(S.weaponForge.nanoArmor,{researched:true,level:10,equipped:true})'}
];
const rows=[];
for(const variant of variants)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(variant.set)run(variant.set);
  const stats=run("({starAttack:weaponAttack('star_trooper'),starDefense:weaponDefense('star_trooper'),electroAttack:weaponAttack('electro_trooper'),electroDefense:weaponDefense('electro_trooper')})");
  run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  function finish(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);return{callbacks,result:run("document.getElementById('battle-result').className"),
      enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')};}
  run("openMaterialDomain('trialFruit')");
  assert.equal(run('S.battleActive'),true);
  const fruit=finish();
  assert.equal(fruit.result,'win',`${variant.key} seed ${seed} fruit gate`);
  run('exitBattle()');
  const payment=run("openAwakeningTrial('easy')");
  assert.equal(payment?.ok,true,`${variant.key} seed ${seed} trial payment: ${JSON.stringify(payment)}`);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  const trial=finish();
  rows.push({variant:variant.key,seed,stats,fruit,trial,paidFruit:payment.cost,enemy,
    level:run('S.awakening.star_trooper.level'),soldiers:run('formSoldierCount()')});
}
const byVariant=variants.map(v=>{
  const set=rows.filter(r=>r.variant===v.key),hp=set.map(r=>r.trial.enemyHpLeft);
  return{key:v.key,conditional:true,wins:set.filter(r=>r.trial.result==='win').length,
    minEnemyHpLeft:Math.min(...hp),maxEnemyHpLeft:Math.max(...hp),stats:set[0].stats};
});
const report={batch:'P283',kind:'hypothetical VM sensitivity; no resource payment, research, forge or star investment',source,sourceSha256,
  seeds,byVariant,rows};
const output='docs/codex/reports/data/p283-awakening-stage5-growth-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256,byVariant,output},null,2));
