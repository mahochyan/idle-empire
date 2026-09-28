'use strict';
// Independent real-action branches from the paid P329 refreshed soul-realm save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p329-soul-refreshed-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd');
const origin=JSON.parse(raw);
assert.equal(origin.killValues.soulRealm,6050);
assert.equal(origin.items.soulStone,39);
const slot=origin.soulRealmTeam.slots.indexOf(540399);
assert.ok(slot>=0);
const all=[...origin.formation.front,...origin.formation.mid];
const by=(type,count)=>{const u=all.find(x=>x.type===type&&x.count===count);assert.ok(u);return u};
const E55=by('electro_trooper',55),A55=by('armored_trooper',55),E46=by('electro_trooper',46);
const L55=by('alloy_special',55),S46=by('star_trooper',46),S55=by('star_trooper',55);
const S54=by('star_trooper',54),G40=by('gold_cavalry',40);
const variants=[
  {key:'original',front:[S55,S54,A55,E55]},
  {key:'electro-armor-alloy',front:[E55,A55,E46,L55]},
  {key:'star-for-small-electro',front:[E55,A55,S55,L55]},
  {key:'star-for-alloy',front:[E55,A55,E46,S55]},
  {key:'star-lead',front:[S55,A55,E46,L55]},
  {key:'star-and-electro',front:[S55,S54,E55,E46]},
  {key:'star-pair-alloy',front:[S55,S54,L55,E55]},
  {key:'star-triple-armor',front:[S46,S55,S54,A55]},
  {key:'star-triple-electro',front:[S46,S55,S54,E55]},
  {key:'armor-gold-star',front:[A55,G40,L55,S55]}
];
const signature=groups=>groups.map(u=>`${u.type}:${u.count}`).sort().join('|');
const originalSignature=signature(all);
function setupDate(run,save){
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}+(S.tick-${save.tick})*1000}};
    addLog=msg=>{S.log.push({time:'probe',msg:String(msg)});if(S.log.length>200)S.log.splice(0,S.log.length-200)};`);
}
function prepBranch(key){
  if(key==='none')return{key,text:raw,paid:{seconds:0,steel:0,core:0,blood:0},sha256:sha(raw)};
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');setupDate(r,origin);
  const before=r('({tick:S.tick,steel:S.res.steel,core:S.items.godCore,blood:S.items.sacredBlood,food:S.res.food})');
  if(key.startsWith('blood-')){
    const unitType=key.slice(6);
    assert.equal(r(`useSacredBlood('${unitType}',3).ok`),true);
    assert.equal(r(`S.bloodline.${unitType}`),(origin.bloodline[unitType]||0)+3);
  }else{
    assert.ok(['gatling','mortar'].includes(key));
    assert.equal(r("setPopAlloc('tech',0).ok"),true);
    assert.equal(r("setPopAlloc('steel',902).ok"),true);
    const required=key==='gatling'?24000:36000;
    const elapsed=r(`(()=>{let n=0;while(S.res.steel<${required}&&n<2000){tick();n++}return n})()`);
    assert.ok(elapsed<2000&&r('S.res.steel')>=required,`${key} steel production`);
    for(let i=0;i<12;i++)assert.equal(r(`forgeWeapon('${key}').ok`),true,`${key} step ${i+1}`);
    assert.equal(r(`S.weaponForge.${key}.level`),2);
  }
  assert.equal(r('save().ok'),true);
  const text=e.store.get('rts_save'),after=JSON.parse(text);
  const reload=environment({rts_save:text});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.ok(after.res.food>0);
  return{key,text,sha256:sha(text),paid:{seconds:after.tick-before.tick,
    steel:key==='gatling'?24000:key==='mortar'?36000:0,
    core:before.core-after.items.godCore,blood:before.blood-after.items.sacredBlood,
    foodBefore:before.food,foodAfter:after.res.food,steelAfter:after.res.steel}};
}
function prepFormation(branch,variant){
  const mid=all.filter(u=>!variant.front.includes(u));
  assert.equal(mid.length,4);assert.equal(signature([...variant.front,...mid]),originalSignature);
  if(variant.key==='original')return{key:`${branch.key}/${variant.key}`,text:branch.text,
    front:variant.front.map(u=>`${u.type}:${u.count}`),sha256:branch.sha256};
  const e=environment({rts_save:branch.text}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');setupDate(r,JSON.parse(branch.text));
  r("clrForm('expedition')");assert.equal(r('formSoldierCount()'),0);
  for(const[row,groups]of Object.entries({front:variant.front,mid,back:origin.formation.back}))groups.forEach((u,index)=>{
    assert.ok(r(`poolAvail('${u.type}')`)>=u.count);
    r(`openFormModal('expedition','${row}',${index});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(r(`S.formation.${row}[${index}]?.type`),u.type);
    assert.equal(r(`S.formation.${row}[${index}]?.count`),u.count);
  });
  assert.equal(r('formSoldierCount()'),626);
  assert.equal(r('save().ok'),true);
  const text=e.store.get('rts_save'),reload=environment({rts_save:text});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(signature([...reload.run('S.formation.front'),...reload.run('S.formation.mid')]),originalSignature);
  return{key:`${branch.key}/${variant.key}`,text,front:variant.front.map(u=>`${u.type}:${u.count}`),sha256:sha(text)};
}
function battle(p,seed,capture=false){
  const e=environment({rts_save:p.text}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  const save=JSON.parse(p.text);
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}+(S.tick-${save.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=r('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,stone:S.items.soulStone})');
  assert.equal(before.deployed,626);assert.equal(before.alert,6050);assert.equal(before.stone,39);
  assert.equal(r(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  assert.ok(['win','lose'].includes(result));
  const after=r(`({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,
    stone:S.items.soulStone,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots[${slot}]})`);
  if(result==='win'){assert.equal(after.slot,null);assert.ok(after.stone>39);assert.equal(after.alert,6250)}
  else{assert.equal(after.slot,540399);assert.equal(after.alert,6050);assert.equal(after.stone,39)}
  r('exitBattle()');
  return{variant:p.key,seed,result,before,enemy,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}: {})};
}
const perVariant=Number(process.argv[2]||24);
assert.ok(Number.isSafeInteger(perVariant)&&perVariant>=1&&perVariant<=256);
const branches=['none','blood-star_trooper','blood-electro_trooper','blood-armored_trooper','gatling','mortar'].map(prepBranch);
const prepared=branches.flatMap(g=>variants.map(v=>prepFormation(g,v)));
const trials=[];
for(const p of prepared)for(let seed=1;seed<=perVariant;seed++)trials.push(battle(p,seed));
const summary=prepared.map(p=>{
  const rows=trials.filter(x=>x.variant===p.key),wins=rows.filter(x=>x.result==='win');
  const sorted=rows.map(x=>x.after.enemyHp).sort((a,b)=>a-b);
  return{key:p.key,front:p.front,tested:rows.length,wins:wins.length,
    minEnemyHp:sorted[0],medianEnemyHp:sorted[Math.floor(sorted.length/2)],
    firstWinSeed:wins[0]?.seed??null,preparedSha256:p.sha256};
});
const wins=trials.filter(x=>x.result==='win');let selectedWin=null;
if(wins.length){
  const winner=wins[0],p=prepared.find(x=>x.key===winner.variant),paid=battle(p,winner.seed,true);
  assert.equal(paid.result,'win');
  const saveFile='docs/codex/reports/data/p330-soul-alert6050-first-win-save.json';
  const reload=environment({rts_save:paid.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),paid.after.stone);
  fs.writeFileSync(path.join(root,saveFile),paid.saveText,'utf8');
  selectedWin={variant:winner.variant,seed:winner.seed,before:paid.before,after:paid.after,
    saveFile,saveSha256:sha(paid.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P330',kind:'paid independent equipment, bloodline and legal formation branches at soul alert 6050',
  sourceFile,sourceSha256:sha(raw),unit:'simulated online seconds, resources, soldiers and battle HP',
  seeds:`independent xorshift32 1..${perVariant} per prepared variant`,slot,
  branches:branches.map(({key,paid,sha256})=>({key,paid,sha256})),summary,trials,selectedWin,
  limits:['Every seed restarts from its prepared paid branch; results are conditional probes, not win-rate estimates.',
    'The six upgrade branches are independent alternatives and their paid assets are not combined.',
    'Ten legal formations do not exhaust possible lineups, future research or additional material farming.']};
const output='docs/codex/reports/data/p330-soul-alert6050-options.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),branches:report.branches,
  best:summary.slice().sort((a,b)=>a.minEnemyHp-b.minEnemyHp).slice(0,12),
  totalWins:wins.length,totalTrials:trials.length,selectedWin,output},null,2));
