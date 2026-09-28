'use strict';
// Conditional count, arms-star and approximate rank screen from P285. Injected growth is unpaid.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const variants=[
  {key:'paid-baseline',star:155,armory:50},
  {key:'mid-star-210',star:210,armory:69},
  {key:'mid-star-220',star:220,armory:72},
  {key:'star-atk-1',star:155,armory:50,armsAtk:1},
  {key:'star-atk-10',star:155,armory:50,armsAtk:10},
  {key:'star-atk-40',star:155,armory:50,armsAtk:40},
  {key:'mid-star-220-atk-1',star:220,armory:72,armsAtk:1},
  {key:'mid-star-220-atk-10',star:220,armory:72,armsAtk:10},
  {key:'star-rank-1-approx',star:155,armory:50,rank:1},
  {key:'star-rank-2-approx',star:155,armory:50,rank:2},
  {key:'star-rank-3-approx',star:155,armory:50,rank:3},
  {key:'star-rank-4-approx',star:155,armory:50,rank:4},
  {key:'star-rank-5-approx',star:155,armory:50,rank:5}
];
const seeds=Array.from({length:11},(_,i)=>i+1),rows=[];
function setup(variant,seed){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.awakening.star_trooper.level'),6);
  if(variant.star>155){
    run(`S.buildings.electric_armory.lv=${variant.armory};
      S.pool.gold_cavalry+=40;
      S.formation.mid[3]={type:'star_trooper',count:55,id:1790499000000};
      ${variant.star===220?'S.formation.mid[0].count=55;S.formation.mid[2].count=55;':''}`);
    assert.equal(run("expeditionCount('star_trooper')"),variant.star);
    assert.ok(run("unitCap('star_trooper')")>=variant.star);
  }
  // Mother-source rank grants +50% base attack and +100% base HP per rank.
  // Raising local CFG bases is only an approximate sensitivity screen, not a paid or exact port.
  if(variant.rank)run(`CFG.units.star_trooper.atk=40+20*${variant.rank};
    CFG.units.star_trooper.hpPerSoldier=4+4*${variant.rank}`);
  if(variant.armsAtk)run(`S.armsUp.star_trooper.atk.stars=${variant.armsAtk}`);
  run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  return{e,run};
}
function finish(run){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);return{result:run("document.getElementById('battle-result').className"),
    callbacks,enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),
    soldiers:run('formSoldierCount()')};}
for(const variant of variants)for(const seed of seeds){
  for(const mode of ['core','trial']){
    const {run}=setup(variant,seed);
    const initial={army:run('armyCount()'),deployed:run('formSoldierCount()'),star:run("expeditionCount('star_trooper')"),
      cap:run("unitCap('star_trooper')"),fruit:run('S.items.trialFruit'),core:run('S.items.godCore')};
    let fruitWins=0,paidFruit=0;
    if(mode==='trial'){
      for(let i=0;i<2;i++){run("openMaterialDomain('trialFruit')");assert.equal(run('S.battleActive'),true);
        const b=finish(run);if(b.result==='win')fruitWins++;run('exitBattle()');if(b.result!=='win')break;}
      if(fruitWins<2){rows.push({variant:variant.key,seed,mode,initial,fruitWins,trial:null});continue;}
      run(`globalThis.__rng=${seed}`);
      const payment=run("openAwakeningTrial('easy')");assert.equal(payment.ok,true);paidFruit=payment.cost;
    }else{run("openMaterialDomain('medal')");assert.equal(run('S.battleActive'),true);}
    const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
    const battle=finish(run);
    rows.push({variant:variant.key,seed,mode,initial,fruitWins,paidFruit,enemy,battle});
  }
}
const byVariant=variants.map(v=>{
  const set=rows.filter(r=>r.variant===v.key),core=set.filter(r=>r.mode==='core'),trial=set.filter(r=>r.mode==='trial');
  const summary=x=>({starts:x.length,wins:x.filter(r=>r.battle?.result==='win').length,
    minEnemyHpLeft:Math.min(...x.map(r=>r.battle?.enemyHpLeft??Infinity)),
    maxEnemyHpLeft:Math.max(...x.map(r=>r.battle?.enemyHpLeft??-Infinity))});
  return{variant:v.key,conditional:v.key!=='paid-baseline',star:v.star,armory:v.armory,rankApprox:v.rank||0,
    armsAtkStars:v.armsAtk||0,army:set[0].initial.army,
    deployed:set[0].initial.deployed,core:summary(core),trial:summary(trial),trialFruitWins:trial.reduce((n,r)=>n+r.fruitWins,0)};
});
const output='docs/codex/reports/data/p286-awakening-star-expansion-conditional.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P286',kind:'VM-only unpaid armory/army, arms stars, or approximate rank-stat injection; source paid save, real battle actions; matched seed reset before trial',
  source,sourceSha256:sha(raw),seeds,byVariant,rows},null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),byVariant,output},null,2));
