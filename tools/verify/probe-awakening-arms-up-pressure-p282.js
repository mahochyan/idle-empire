'use strict';
// Replay the real paid save against its untouched source with identical battle seeds.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sources={
  baseline:'docs/codex/reports/data/p279-awakening-star155-paid-save.json',
  attackOneStar:'docs/codex/reports/data/p282-awakening-arms-up-one-star-paid-save.json'
};
const seeds=[1,2,3,5,8,13,21,34,55,89,144];
const rows=[];
const hashes={};
for(const [variant,file]of Object.entries(sources)){
  const raw=fs.readFileSync(path.join(root,file),'utf8');
  hashes[variant]=crypto.createHash('sha256').update(raw).digest('hex');
  for(const seed of seeds){
    const e=environment({rts_save:raw}),run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    const before=run("({attack:weaponAttack('star_trooper'),fruit:S.items.trialFruit,level:S.awakening.star_trooper.level,army:armyCount()})");
    run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
      setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
      __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
      globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
          classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __nodes.get(id)};addLog=m=>S.log.push(String(m));
      globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
    const payment=run("openAwakeningTrial('easy')");
    assert.equal(payment?.ok,true,`${variant} seed ${seed}: ${JSON.stringify(payment)}`);
    const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);
    rows.push({variant,seed,before,paidFruit:payment.cost,enemy,
      result:run("document.getElementById('battle-result').className"),
      enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),callbacks,
      soldiers:run('formSoldierCount()'),level:run('S.awakening.star_trooper.level')});
  }
}
const byVariant=Object.keys(sources).map(variant=>{
  const set=rows.filter(r=>r.variant===variant);
  return{variant,wins:set.filter(r=>r.result==='win').length,
    minEnemyHpLeft:Math.min(...set.map(r=>r.enemyHpLeft)),maxEnemyHpLeft:Math.max(...set.map(r=>r.enemyHpLeft)),
    meanEnemyHpLeft:set.reduce((n,r)=>n+r.enemyHpLeft,0)/set.length};
});
const pairs=seeds.map(seed=>{
  const baseline=rows.find(r=>r.variant==='baseline'&&r.seed===seed);
  const paid=rows.find(r=>r.variant==='attackOneStar'&&r.seed===seed);
  assert.equal(JSON.stringify(baseline.enemy),JSON.stringify(paid.enemy));
  assert.equal(baseline.paidFruit,paid.paidFruit);
  return{seed,baselineResult:baseline.result,paidResult:paid.result,
    baselineEnemyHpLeft:baseline.enemyHpLeft,paidEnemyHpLeft:paid.enemyHpLeft,
    deltaEnemyHpLeft:paid.enemyHpLeft-baseline.enemyHpLeft};
});
const report={batch:'P282',unit:'soldiers, battle HP and items',sources,hashes,seeds,byVariant,pairs,rows};
const output='docs/codex/reports/data/p282-awakening-arms-up-one-star-pressure.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({hashes,byVariant,pairs,output},null,2));
