'use strict';
// Compare legal, cost-free formation actions from one paid full-roster alert-5000 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const source='p311-crystal-alert5000-recovered-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'cd8f150a7400007094c400deebfc338a82c5f5b9d255ac9c50ebb3dfc1b507a9');
const origin=JSON.parse(raw);
const original=[...origin.formation.front,...origin.formation.mid];
assert.equal(original.length,8);
const [E55,A55,E46,L55,S46,S55,S54,G40]=original;
const signature=groups=>groups.map(u=>`${u.type}:${u.count}`).sort().join('|');
const variants=[
  {key:'original',front:[E55,A55,E46,L55]},
  {key:'star-for-small-electro',front:[E55,A55,S55,L55]},
  {key:'star-for-alloy',front:[E55,A55,E46,S55]},
  {key:'star-lead',front:[S55,A55,E46,L55]},
  {key:'star-and-electro',front:[S55,S54,E55,E46]},
  {key:'star-pair-armor',front:[S55,S54,A55,E55]},
  {key:'star-pair-alloy',front:[S55,S54,L55,E55]},
  {key:'star-triple-armor',front:[S46,S55,S54,A55]},
  {key:'star-triple-electro',front:[S46,S55,S54,E55]},
  {key:'armor-gold-star',front:[A55,G40,L55,S55]}
];
const originalSig=signature(original);
const prepared=[];
for(const variant of variants){
  const mid=original.filter(u=>!variant.front.includes(u));
  assert.equal(mid.length,4);
  assert.equal(signature([...variant.front,...mid]),originalSig);
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}}}`);
  if(variant.key!=='original'){
    r('clrForm(\'expedition\')');
    for(const [row,groups]of Object.entries({front:variant.front,mid,back:origin.formation.back}))groups.forEach((u,slot)=>{
      assert.ok(r(`poolAvail('${u.type}')`)>=u.count,`${variant.key} ${row}${slot} pool`);
      r(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
      assert.equal(r(`S.formation.${row}[${slot}]?.type`),u.type,`${variant.key} ${row}${slot} type`);
      assert.equal(r(`S.formation.${row}[${slot}]?.count`),u.count,`${variant.key} ${row}${slot} count`);
    });
    assert.equal(r('save().ok'),true);
  }
  const before=r('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.godRevival,crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood})');
  assert.equal(JSON.stringify(before),JSON.stringify({army:671,deployed:626,alert:5000,crystal:177,medal:61656,blood:15}));
  const text=e.store.get('rts_save');
  const reload=environment({rts_save:text});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),626);
  assert.equal(signature([...reload.run('S.formation.front'),...reload.run('S.formation.mid')]),originalSig);
  prepared.push({key:variant.key,front:variant.front.map(u=>`${u.type}:${u.count}`),mid:mid.map(u=>`${u.type}:${u.count}`),text,sha256:sha(text)});
}
function battle(variant,seed,capture=false){
  const e=environment({rts_save:variant.text}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  const tick=r('S.tick'),ts=JSON.parse(variant.text).ts;
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${ts}+(S.tick-${tick})*1000}};
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
  r("openMaterialDomain('godCrystal')");
  assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<3000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<3000,'battle callbacks');
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.godRevival,crystal:S.items.godCrystal,medal:S.res.medal,blood:S.items.sacredBlood,enemyHp:B.enemyUnits[0].hp})');
  r('exitBattle()');
  return{variant:variant.key,seed,enemy,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}:{} )};
}
const trials=[];
for(const variant of prepared)for(let seed=1;seed<=64;seed++)trials.push(battle(variant,seed));
for(const key of ['original','star-pair-armor']){
  const variant=prepared.find(x=>x.key===key);
  for(let seed=65;seed<=256;seed++)trials.push(battle(variant,seed));
}
const byVariant=prepared.map(variant=>{
  const rows=trials.filter(x=>x.variant===variant.key);
  return{key:variant.key,front:variant.front,mid:variant.mid,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
    minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),maxEnemyHp:Math.max(...rows.map(x=>x.after.enemyHp)),
    meanEnemyHp:rows.reduce((sum,x)=>sum+x.after.enemyHp,0)/rows.length,
    minArmy:Math.min(...rows.map(x=>x.after.army)),maxArmy:Math.max(...rows.map(x=>x.after.army))};
});
const originalTrials=trials.filter(x=>x.variant==='original');
const pairedTrials=trials.filter(x=>x.variant==='star-pair-armor');
assert.equal(originalTrials.length,256);
assert.equal(pairedTrials.length,256);
const pairComparison={pairBetter:0,pairWorse:0,tied:0};
for(let i=0;i<256;i++){
  assert.equal(originalTrials[i].seed,pairedTrials[i].seed);
  const difference=pairedTrials[i].after.enemyHp-originalTrials[i].after.enemyHp;
  if(difference<0)pairComparison.pairBetter++;
  else if(difference>0)pairComparison.pairWorse++;
  else pairComparison.tied++;
}
const wins=trials.filter(x=>x.result==='win');
let selectedWin=null;
if(wins.length){
  const winner=wins[0],variant=prepared.find(x=>x.key===winner.variant),paid=battle(variant,winner.seed,true);
  assert.equal(paid.result,'win');
  assert.ok(paid.after.crystal>origin.items.godCrystal);
  assert.equal(paid.after.alert,5100);
  assert.ok(paid.after.medal>origin.res.medal);
  const name='p312-crystal-alert5000-formation-win-save.json';
  const reload=environment({rts_save:paid.saveText});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.godCrystal'),paid.after.crystal);
  fs.writeFileSync(path.join(data,name),paid.saveText);
  selectedWin={variant:winner.variant,seed:winner.seed,after:paid.after,callbacks:paid.callbacks,save:name,sha256:sha(paid.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const report={batch:'P312',kind:'same paid full roster, real formation actions, isolated direct alert-5000 battles',source,sourceSha256:sha(raw),
  unit:'soldiers, battle HP and items; 64 fixed seeds per formation plus 192 extra each for original and star-pair-armor do not estimate player odds',
  variants:prepared.map(({key,front,mid,sha256})=>({key,front,mid,preparedSha256:sha256})),byVariant,pairComparison,
  trials:trials.map(({variant,seed,enemy,result,after,callbacks})=>({variant,seed,enemy,result,after,callbacks})),selectedWin,
  limitations:['The battle streams are independently seeded from one paid save, not natural continuous RNG.',
    'Ten formations do not exhaust the legal formation space.',
    'Reordering only uses already owned soldiers; no combat, resources or UI source code was changed.']};
const output='p312-crystal-alert5000-formation.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,tested:trials.length,byVariant,pairComparison,selectedWin,report:output},null,2));
