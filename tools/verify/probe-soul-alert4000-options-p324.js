'use strict';
// Compare real, isolated formation and forge actions from the paid 69-stone save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const stage=process.argv[2]||'4050';
assert.ok(['4050','4550'].includes(stage));
const expected=stage==='4050'?{source:'p323-soul-stone-frontier-27battles-save.json',sha:'42fcfd5d8604752ec9cee1c60cfd0b575e7051a1eea2c41b6a26ea5adb451d31',stone:69,alert:4050}:
  {source:'p324-soul-alert4550-restored-save.json',sha:'ba54521f29f3bad88494f67b277c47e95c109a522f88ad9650c3a06e2e4aa69f',stone:91,alert:4550};
const sourceFile='docs/codex/reports/data/'+expected.source;
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),expected.sha);
const origin=JSON.parse(raw);
const roster=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p323-soul-stone-frontier-27battles-save.json'),'utf8'));
const original=[...roster.formation.front,...roster.formation.mid];
assert.equal(original.length,8);
const [E55,A55,E46,L55,S46,S55,S54,G40]=original;
const sig=groups=>groups.map(u=>`${u.type}:${u.count}`).sort().join('|');
const originalSig=sig(original);
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
const gearKeys=[null,'gatling','mortar'];
function setupDate(r,save){
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}+(S.tick-${save.tick})*1000}};
    addLog=msg=>{S.log.push({time:new __RealDate(Date.now()).toLocaleTimeString(),msg:String(msg)});
      if(S.log.length>200)S.log.splice(0,S.log.length-200)};
    globalThis.__rng=3240000;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296}`);
}
function gearBranch(key){
  if(!key)return{key:'none',text:raw,paid:{seconds:0,steel:0,core:0}};
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');setupDate(r,origin);
  const before=r('({tick:S.tick,steel:S.res.steel,core:S.items.godCore,food:S.res.food,stone:S.res.stone,coal:S.res.coal,iron:S.res.iron})');
  assert.equal(r("setPopAlloc('tech',0)").ok,true);
  assert.equal(r("setPopAlloc('iron',902)").ok,true);
  const ironSeconds=r('(()=>{let n=0;while(S.res.iron<40000&&n<1000){tick();n++}return n})()');
  assert.ok(ironSeconds<1000&&r('S.res.iron')>=40000);
  assert.equal(r("setPopAlloc('iron',0)").ok,true);
  assert.equal(r("setPopAlloc('steel',902)").ok,true);
  const required=key==='gatling'?24000:36000;
  const steelSeconds=r(`(()=>{let n=0;while(S.res.steel<${required}&&n<1000){tick();n++}return n})()`);
  assert.ok(steelSeconds<1000&&r('S.res.steel')>=required);
  assert.equal(r("setPopAlloc('steel',0)").ok,true);
  assert.equal(r("setPopAlloc('tech',902)").ok,true);
  assert.equal(r(`weaponForgeSteps('${key}')`),12);
  const beforeForgeSteel=r('S.res.steel');
  for(let i=0;i<12;i++)assert.equal(r(`forgeWeapon('${key}')`).ok,true);
  assert.equal(r(`S.weaponForge.${key}.level`),2);
  assert.equal(r('S.items.godCore'),before.core-24);
  assert.equal(beforeForgeSteel-r('S.res.steel'),required);
  assert.ok(r('S.res.food')>0);
  assert.equal(r('save().ok'),true);
  const text=e.store.get('rts_save'),after=JSON.parse(text);
  const reload=environment({rts_save:text});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run(`S.weaponForge.${key}.level`),2);
  return{key,text,paid:{seconds:after.tick-before.tick,steel:required,
    core:before.core-after.items.godCore,before,after:{tick:after.tick,steel:after.res.steel,core:after.items.godCore,
      food:after.res.food,stone:after.res.stone,coal:after.res.coal,iron:after.res.iron}},sha256:sha(text)};
}
function formationBranch(gear,variant){
  const mid=original.filter(u=>!variant.front.includes(u));
  assert.equal(mid.length,4);assert.equal(sig([...variant.front,...mid]),originalSig);
  if(variant.key==='original'&&stage==='4050')return{key:gear.key+'/'+variant.key,text:gear.text,front:variant.front,mid,sha256:sha(gear.text)};
  const e=environment({rts_save:gear.text}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');setupDate(r,JSON.parse(gear.text));
  r("clrForm('expedition')");assert.equal(r('formSoldierCount()'),0);
  for(const[row,groups]of Object.entries({front:variant.front,mid,back:roster.formation.back}))groups.forEach((u,slot)=>{
    assert.ok(r(`poolAvail('${u.type}')`)>=u.count,`${gear.key}/${variant.key} ${row}${slot} pool`);
    r(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(r(`S.formation.${row}[${slot}]?.type`),u.type);
    assert.equal(r(`S.formation.${row}[${slot}]?.count`),u.count);
  });
  assert.equal(r('formSoldierCount()'),626);
  assert.equal(r('save().ok'),true);
  const text=e.store.get('rts_save'),reload=environment({rts_save:text});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(sig([...reload.run('S.formation.front'),...reload.run('S.formation.mid')]),originalSig);
  return{key:gear.key+'/'+variant.key,text,front:variant.front,mid,sha256:sha(text)};
}
function battle(prepared,seed,capture=false){
  const e=environment({rts_save:prepared.text}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  const save=JSON.parse(prepared.text);
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}+(S.tick-${save.tick})*1000}};
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
  const before=r('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,stone:S.items.soulStone,core:S.items.godCore})');
  assert.equal(before.deployed,626);assert.equal(before.alert,expected.alert);assert.equal(before.stone,expected.stone);
  r("openMaterialDomain('soulStone')");assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),alert:S.killValues.soulRealm,stone:S.items.soulStone,core:S.items.godCore,enemyHp:B.enemyUnits[0].hp})');
  r('exitBattle()');
  return{variant:prepared.key,seed,before,enemy,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}: {})};
}
const gears=gearKeys.map(gearBranch),prepared=gears.flatMap(g=>variants.map(v=>formationBranch(g,v)));
const perVariant=Number(process.argv[3]||32);assert.ok(Number.isSafeInteger(perVariant)&&perVariant>=1&&perVariant<=512);
const trials=[];for(const p of prepared)for(let seed=1;seed<=perVariant;seed++)trials.push(battle(p,seed));
const summary=prepared.map(p=>{const rows=trials.filter(x=>x.variant===p.key);return{key:p.key,front:p.front.map(u=>`${u.type}:${u.count}`),
  tested:rows.length,wins:rows.filter(x=>x.result==='win').length,minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),
  meanEnemyHp:rows.reduce((n,x)=>n+x.after.enemyHp,0)/rows.length,minArmy:Math.min(...rows.map(x=>x.after.army)),
  preparedSha256:p.sha256};});
const wins=trials.filter(x=>x.result==='win');
let selectedWin=null;
if(wins.length){
  const winner=wins[0],p=prepared.find(x=>x.key===winner.variant),paid=battle(p,winner.seed,true);
  assert.equal(paid.result,'win');assert.ok(paid.after.stone>expected.stone);assert.ok(paid.after.alert>expected.alert);
  const saveFile=stage==='4050'?'docs/codex/reports/data/p324-soul-alert4000-first-win-save.json':
    'docs/codex/reports/data/p324-soul-alert4550-options-first-win-save.json';
  const reload=environment({rts_save:paid.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),paid.after.stone);
  fs.writeFileSync(path.join(root,saveFile),paid.saveText,'utf8');
  selectedWin={variant:paid.variant,seed:paid.seed,before:paid.before,after:paid.after,saveFile,saveSha256:sha(paid.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P324',kind:`paid ${expected.stone}-stone save, real forge and formation actions, isolated alert-${stage} battles`,sourceFile,sourceSha256:sha(raw),
  unit:'simulated online seconds, resources, soldiers and battle HP',seeds:`independent xorshift32 1..${perVariant} per prepared variant`,
  gears:gears.map(({key,paid,sha256})=>({key,paid,sha256:sha256||sha(raw)})),summary,trials,selectedWin,
  limits:['Fixed battle seeds are paired conditional comparisons, not player win rates.',
    'Paid gear branches are independent alternatives; their stock or wins are not combined.',
    'Ten legal formations do not exhaust possible rosters or tactics.']};
const output=`docs/codex/reports/data/p324-soul-alert${stage==='4050'?'4000':'4550'}-options.json`;
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),perVariant,gears:report.gears,summary,selectedWin,output},null,2));
