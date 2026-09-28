'use strict';
// Spend the 18 blood items already owned by the paid, recovered P317 branch.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const data=path.resolve(__dirname,'../../docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source='p317-electro20-crystal-alert5100-recovered-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
assert.equal(sha(raw),'67e10b621ff201166e36fec04d6d02e3b66b9bf86f357b71586390195dbc83ac');
const origin=JSON.parse(raw);
assert.equal(origin.items.sacredBlood,18);
assert.equal(origin.items.emberElixir,0);
assert.equal(origin.killValues.godRevival,5100);
assert.equal(origin.killValues.godSlaughter,5000);
const variants=[
  {key:'electro18',uses:{electro_trooper:18}},
  {key:'star18',uses:{star_trooper:18}},
  {key:'armored18',uses:{armored_trooper:18}},
  {key:'electro9-star9',uses:{electro_trooper:9,star_trooper:9}}
];
function prepare(variant){
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}}}`);
  const before=r("({blood:S.items.sacredBlood,army:armyCount(),deployed:formSoldierCount(),alerts:{crystal:S.killValues.godRevival,core:S.killValues.godSlaughter},hp:{electro:battleVitals('electro_trooper',1,true).hp,star:battleVitals('star_trooper',1,true).hp,armored:battleVitals('armored_trooper',1,true).hp}})");
  for(const [unit,count] of Object.entries(variant.uses)){
    const result=r(`useSacredBlood('${unit}',${count})`);
    assert.equal(result?.ok,true,JSON.stringify({variant:variant.key,result}));
  }
  const after=r("({blood:S.items.sacredBlood,army:armyCount(),deployed:formSoldierCount(),alerts:{crystal:S.killValues.godRevival,core:S.killValues.godSlaughter},bloodline:{...S.bloodline},hp:{electro:battleVitals('electro_trooper',1,true).hp,star:battleVitals('star_trooper',1,true).hp,armored:battleVitals('armored_trooper',1,true).hp}})");
  assert.equal(before.blood-after.blood,18);
  assert.equal(after.army,before.army);assert.equal(after.deployed,before.deployed);
  assert.deepEqual(after.alerts,before.alerts);
  for(const [unit,count] of Object.entries(variant.uses)){
    const label={electro_trooper:'electro',star_trooper:'star',armored_trooper:'armored'}[unit];
    const base=r(`CFG.units.${unit}.hpPerSoldier`);
    assert.ok(Math.abs(after.hp[label]-before.hp[label]-base*0.01*count)<1e-9,unit+' hp increase');
  }
  const saveText=e.store.get('rts_save'),reload=environment({rts_save:saveText});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.sacredBlood'),0);
  for(const [unit,count] of Object.entries(variant.uses))assert.equal(reload.run(`S.bloodline.${unit}`),count);
  const save=`p318-${variant.key}-blood-paid-save.json`;
  fs.writeFileSync(path.join(data,save),saveText);
  return{key:variant.key,uses:variant.uses,before,after,save,saveText,sha256:sha(saveText)};
}
const prepared=variants.map(prepare);
function fight(state,domain,seed,capture=false){
  const e=environment({rts_save:state.saveText}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  r(`openMaterialDomain('${domain}')`);
  assert.equal(r('S.battleActive'),true,`${state.key} ${domain} ${seed}`);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),enemyHp:B.enemyUnits[0].hp,crystal:S.items.godCrystal,core:S.items.godCore,medal:S.res.medal,blood:S.items.sacredBlood,crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter})');
  r('exitBattle()');
  return{variant:state.key,domain,seed,enemy,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}:{} )};
}
const prior=JSON.parse(fs.readFileSync(path.join(data,'p317-ember-alert5100-refill.json'),'utf8'));
assert.equal(prior.finalSaveSha256,sha(raw));
const trials=[];
for(const state of prepared)for(const domain of ['godCrystal','medal'])for(let seed=1;seed<=128;seed++)trials.push(fight(state,domain,seed));
const summarize=rows=>({tested:rows.length,wins:rows.filter(t=>t.result==='win').length,
  minEnemyHp:Math.min(...rows.map(t=>t.after.enemyHp)),meanEnemyHp:rows.reduce((a,t)=>a+t.after.enemyHp,0)/rows.length,
  minRemainingArmy:Math.min(...rows.map(t=>t.after.army))});
const baseline=Object.fromEntries(['godCrystal','medal'].map(domain=>[domain,summarize(prior.trials.filter(t=>t.domain===domain&&t.seed<=128))]));
const byVariant=prepared.map(state=>({key:state.key,uses:state.uses,before:state.before,after:state.after,save:state.save,
  saveSha256:state.sha256,domains:Object.fromEntries(['godCrystal','medal'].map(domain=>[domain,summarize(trials.filter(t=>t.variant===state.key&&t.domain===domain))]))}));
const winners=trials.filter(t=>t.result==='win');
let selectedWin=null;
if(winners.length){
  // Keep the paid winning branch with the smallest soldier loss for the next audit.
  const chosen=winners.reduce((best,row)=>row.after.army>best.after.army?row:best),state=prepared.find(s=>s.key===chosen.variant);
  const actual=fight(state,chosen.domain,chosen.seed,true);
  assert.equal(actual.result,'win');
  const reload=environment({rts_save:actual.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  const save=`p318-${chosen.variant}-${chosen.domain}-alert${chosen.domain==='godCrystal'?5100:5000}-win-save.json`;
  fs.writeFileSync(path.join(data,save),actual.saveText);
  selectedWin={variant:chosen.variant,domain:chosen.domain,seed:chosen.seed,after:actual.after,callbacks:actual.callbacks,save,sha256:sha(actual.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const report={batch:'P318',kind:'real spending of 18 owned sacred blood items from paid full-roster alert-5100 save; paired deterministic fights',
  source,sourceSha256:sha(raw),baseline,byVariant,selectedWin,
  trials:trials.map(({variant,domain,seed,enemy,result,after,callbacks})=>({variant,domain,seed,enemy,result,after,callbacks})),
  limitations:['All fights branch independently from the same paid safe save; defeated branches do not refill for free.',
    '128 fixed streams per variant and domain are diagnostic paired samples, not player win-rate estimates.',
    'The source attack infusion of 20 was obtained via repeated reset of a favorable rare-drop stream in P306; the 18 blood stock is also path-dependent.']};
const output='p318-bloodline-alert5100-paid.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,baseline,byVariant,selectedWin,report:output},null,2));
