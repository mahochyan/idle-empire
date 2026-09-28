'use strict';
// Isolated sensitivity probe. Stars below are injected into VM state; no paid save is produced.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const seeds=[1,2,3,5,8,13,21,34,55,89,144];
const variants=[
  {key:'baseline',atk:0,hp:0,def:0},
  {key:'attack-10',atk:10,hp:0,def:0},
  {key:'attack-20',atk:20,hp:0,def:0},
  {key:'attack-40',atk:40,hp:0,def:0},
  {key:'attack-100',atk:100,hp:0,def:0},
  {key:'defense-10',atk:0,hp:0,def:10},
  {key:'defense-20',atk:0,hp:0,def:20},
  {key:'defense-40',atk:0,hp:0,def:40},
  {key:'defense-100',atk:0,hp:0,def:100},
  {key:'health-20',atk:0,hp:20,def:0},
  {key:'health-40',atk:0,hp:40,def:0},
  {key:'health-100',atk:0,hp:100,def:0},
  {key:'attack-10-defense-10',atk:10,hp:0,def:10},
  {key:'attack-10-defense-20',atk:10,hp:0,def:20},
  {key:'attack-40-defense-40',atk:40,hp:0,def:40},
  {key:'attack-100-defense-100',atk:100,hp:0,def:100}
];
const rows=[];
for(const variant of variants)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  for(const stat of ['atk','hp','def'])run(`S.armsUp.star_trooper.${stat}.stars=${variant[stat]}`);
  run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const payment=run("openAwakeningTrial('easy')");
  assert.equal(payment?.ok,true,`${variant.key} seed ${seed}: ${JSON.stringify(payment)}`);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  rows.push({variant:variant.key,seed,enemy,result:run("document.getElementById('battle-result').className"),
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),callbacks,
    soldiers:run('formSoldierCount()'),level:run('S.awakening.star_trooper.level')});
}
const byVariant=variants.map(v=>{
  const set=rows.filter(r=>r.variant===v.key);
  return{key:v.key,stars:{atk:v.atk,hp:v.hp,def:v.def},hypotheticalSteelCost:(v.atk+v.hp+v.def)*4000000,
    wins:set.filter(r=>r.result==='win').length,minEnemyHpLeft:Math.min(...set.map(r=>r.enemyHpLeft)),
    maxEnemyHpLeft:Math.max(...set.map(r=>r.enemyHpLeft))};
});
const report={batch:'P282',kind:'hypothetical VM sensitivity probe; no production or armsUp payment',source,sourceSha256,
  seeds,byVariant,rows};
const output='docs/codex/reports/data/p282-awakening-arms-up-preflight.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256,byVariant,output},null,2));
