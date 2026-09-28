'use strict';
// Spend only already-owned permanent attack consumables from the paid P315 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p315-crystal-alert5000-nano11-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'e2071b0213b2c2dcf4161fd32cacb09f7f351c97e0d1e5c805a44b9270632554');
const origin=JSON.parse(raw);
assert.equal(origin.items.emberElixir,20);
assert.equal(origin.killValues.godRevival,5000);
assert.equal(origin.killValues.godSlaughter,5000);
const variants=[
  {key:'electro20',uses:{electro_trooper:20}},
  {key:'star20',uses:{star_trooper:20}},
  {key:'armored20',uses:{armored_trooper:20}},
  {key:'electro10-star10',uses:{electro_trooper:10,star_trooper:10}}
];
function setupClock(run){run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}}`)}
function prepare(variant){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  setupClock(run);
  const before=run('({ember:S.items.emberElixir,army:armyCount(),deployed:formSoldierCount(),alerts:{crystal:S.killValues.godRevival,core:S.killValues.godSlaughter},attack:{electro:weaponAttack(\'electro_trooper\'),star:weaponAttack(\'star_trooper\'),armored:weaponAttack(\'armored_trooper\')}})');
  for(const[unit,count]of Object.entries(variant.uses)){
    const result=run(`useEmberElixir('${unit}',${count})`);
    assert.equal(result?.ok,true,JSON.stringify({variant:variant.key,result}));
  }
  const after=run('({ember:S.items.emberElixir,army:armyCount(),deployed:formSoldierCount(),alerts:{crystal:S.killValues.godRevival,core:S.killValues.godSlaughter},attack:{electro:weaponAttack(\'electro_trooper\'),star:weaponAttack(\'star_trooper\'),armored:weaponAttack(\'armored_trooper\')},infusions:{...S.attackInfusions}})');
  assert.equal(before.ember-after.ember,20);
  assert.equal(after.army,before.army);assert.equal(after.deployed,before.deployed);
  assert.equal(after.alerts.crystal,5000);assert.equal(after.alerts.core,5000);
  const text=e.store.get('rts_save');
  const reload=environment({rts_save:text});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.emberElixir'),0);
  for(const[unit,count]of Object.entries(variant.uses))assert.equal(reload.run(`S.attackInfusions.${unit}`),count);
  return{key:variant.key,uses:variant.uses,before,after,text,sha256:sha(text)};
}
const prepared=variants.map(prepare);
function fight(state,domain,seed,capture=false){
  const e=environment({rts_save:state.text}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  setupClock(run);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run(`openMaterialDomain('${domain}')`);
  assert.equal(run('S.battleActive'),true,`${state.key} ${domain} ${seed}`);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),deployed:formSoldierCount(),enemyHp:B.enemyUnits[0].hp,crystal:S.items.godCrystal,core:S.items.godCore,medal:S.res.medal,ember:S.items.emberElixir,blood:S.items.sacredBlood,crystalAlert:S.killValues.godRevival,coreAlert:S.killValues.godSlaughter})');
  run('exitBattle()');
  return{variant:state.key,domain,seed,enemy,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}:{} )};
}
const trials=[];
for(const state of prepared)for(const domain of ['godCrystal','medal'])for(let seed=1;seed<=128;seed++)trials.push(fight(state,domain,seed));
const byVariant=prepared.map(state=>({key:state.key,uses:state.uses,before:state.before,after:state.after,saveSha256:state.sha256,
  domains:['godCrystal','medal'].map(domain=>{const rows=trials.filter(t=>t.variant===state.key&&t.domain===domain);return{domain,tested:rows.length,
    wins:rows.filter(t=>t.result==='win').length,minEnemyHp:Math.min(...rows.map(t=>t.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,t)=>sum+t.after.enemyHp,0)/rows.length,
    minRemainingArmy:Math.min(...rows.map(t=>t.after.army))}})}));
const winners=trials.filter(t=>t.result==='win');
let paidWin=null;
if(winners.length){
  const selected=winners[0],state=prepared.find(x=>x.key===selected.variant);
  const result=fight(state,selected.domain,selected.seed,true);
  assert.equal(result.result,'win');assert.equal(result.after.ember,0);
  const loaded=environment({rts_save:result.saveText});assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  const name=`p317-${selected.variant}-${selected.domain}-alert5000-win-save.json`;
  fs.writeFileSync(path.join(data,name),result.saveText);
  paidWin={variant:selected.variant,domain:selected.domain,seed:selected.seed,after:result.after,callbacks:result.callbacks,save:name,sha256:sha(result.saveText)};
}
for(const state of prepared){
  const name=`p317-${state.key}-ember-paid-save.json`;
  fs.writeFileSync(path.join(data,name),state.text);
  state.save=name;
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const report={batch:'P317',kind:'paid use of 20 already-owned ember elixirs from P315, then isolated alert-5000 battles',
  source,sourceSha256:sha(raw),unit:'soldier counts, item units, battle HP; 128 fixed streams per variant and domain are not player odds',
  byVariant:byVariant.map((v,i)=>({...v,save:prepared[i].save})),paidWin,
  trials:trials.map(({variant,domain,seed,enemy,result,after,callbacks})=>({variant,domain,seed,enemy,result,after,callbacks})),
  limitations:['The 20 elixirs were present in the P315 paid lineage; P306 had selected favorable rare-drop streams, so stock is not typical player income.',
    'All battles branch independently from one paid safe save. Defeats do not restore soldiers in that branch or alter source files.',
    'No resource, unit, alert, enemy, formula, or probability was injected. Only RNG seeds are fixed for repeatable diagnosis.']};
const output='p317-ember-alert5000-paid.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,byVariant,paidWin,report:output},null,2));
