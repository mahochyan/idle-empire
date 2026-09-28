'use strict';
// Conditional battle-only growth screen for the paid P279 stage-5 save.
// Equipment/star levels below are injected into isolated VM state; none are paid.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const seeds=Array.from({length:11},(_,i)=>i+1);
const nano=n=>`Object.assign(S.weaponForge.nanoArmor,{researched:true,level:${n},equipped:true})`;
const variants=[
  {key:'baseline',set:''},
  {key:'nano-1',set:nano(1)},
  {key:'nano-2',set:nano(2)},
  {key:'nano-4',set:nano(4)},
  {key:'nano-10',set:nano(10)},
  {key:'nano-20',set:nano(20)},
  {key:'nano-40',set:nano(40)},
  {key:'energy-nano-10',set:`S.weaponForge.energyArmor.level=10;${nano(10)}`},
  {key:'rifle-sniper-10',set:'S.weaponForge.electroRifle.level=10;S.weaponForge.electroSniper.level=10'},
  {key:'all-electric-gear-10',set:`S.weaponForge.energyArmor.level=10;S.weaponForge.electroRifle.level=10;S.weaponForge.electroSniper.level=10;${nano(10)}`},
  {key:'star-attack-defense-40',set:'S.armsUp.star_trooper.atk.stars=40;S.armsUp.star_trooper.def.stars=40'},
  {key:'star-attack-defense-100',set:'S.armsUp.star_trooper.atk.stars=100;S.armsUp.star_trooper.def.stars=100'}
];
const rows=[];
for(const variant of variants)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.awakening.star_trooper.level'),5);
  assert.equal(run('S.items.trialFruit'),130);
  if(variant.set)run(variant.set);
  const stats=run("({electroAttack:weaponAttack('electro_trooper'),electroDefense:weaponDefense('electro_trooper'),starAttack:weaponAttack('star_trooper'),starDefense:weaponDefense('star_trooper')})");
  run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const payment=run("openAwakeningTrial('easy')");
  assert.equal(payment?.ok,true,`${variant.key} seed ${seed} payment: ${JSON.stringify(payment)}`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  rows.push({variant:variant.key,seed,stats,paidFruit:payment.cost,callbacks,
    result:run("document.getElementById('battle-result').className"),
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),
    level:run('S.awakening.star_trooper.level'),soldiers:run('formSoldierCount()'),
    star:run("expeditionCount('star_trooper')")});
}
const byVariant=variants.map(v=>{
  const set=rows.filter(r=>r.variant===v.key),hp=set.map(r=>r.enemyHpLeft);
  return{variant:v.key,conditional:v.key!=='baseline',wins:set.filter(r=>r.result==='win').length,
    minEnemyHpLeft:Math.min(...hp),maxEnemyHpLeft:Math.max(...hp),
    meanEnemyHpLeft:hp.reduce((n,x)=>n+x,0)/hp.length,stats:set[0].stats};
});
const report={batch:'P284',kind:'VM-only equipment/star sensitivity; no research, forge, training or payment for injected levels',
  source,sourceSha256,seeds,byVariant,rows};
const output='docs/codex/reports/data/p284-awakening-stage6-growth-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256,byVariant,output},null,2));
