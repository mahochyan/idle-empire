'use strict';
// Paired conditional battles after spending only the three Sacred Blood already in the paid save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceFile='docs/codex/reports/data/p324-soul-alert4550-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(raw),'ba54521f29f3bad88494f67b277c47e95c109a522f88ad9650c3a06e2e4aa69f');
const origin=JSON.parse(raw),units=[null,'star_trooper','electro_trooper','armored_trooper'];
function prepare(unit){
  if(!unit)return{key:'none',text:raw,sha256:sha(raw),spent:0};
  const e=environment({rts_save:raw}),r=e.run;assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
    addLog=msg=>{S.log.push({time:new __RealDate(Date.now()).toLocaleTimeString(),msg:String(msg)});
      if(S.log.length>200)S.log.splice(0,S.log.length-200)}`);
  const before=r('({blood:S.items.sacredBlood,uses:{...S.bloodline}})');
  assert.equal(before.blood,3);
  const used=r(`useSacredBlood('${unit}',3)`);assert.equal(used.ok,true,JSON.stringify(used));
  assert.equal(r('S.items.sacredBlood'),0);assert.equal(r('save().ok'),true);
  const text=e.store.get('rts_save'),reload=environment({rts_save:text});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');assert.equal(reload.run('S.items.sacredBlood'),0);
  assert.equal(reload.run(`S.bloodline.${unit}`),(before.uses[unit]||0)+3);
  return{key:unit,text,sha256:sha(text),spent:3};
}
function battle(prepared,seed,capture=false){
  const e=environment({rts_save:prepared.text}),r=e.run;assert.equal(r('loadSaveAndApply().status'),'ok');
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
  const before=r('({army:armyCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,blood:S.items.sacredBlood})');
  assert.equal(before.army,672);assert.equal(before.stone,91);assert.equal(before.alert,4550);
  r("openMaterialDomain('soulStone')");assert.equal(r('S.battleActive'),true);
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,blood:S.items.sacredBlood,enemyHp:B.enemyUnits[0].hp})');
  r('exitBattle()');
  return{variant:prepared.key,seed,before,result,after,callbacks,...(capture?{saveText:e.store.get('rts_save')}: {})};
}
const prepared=units.map(prepare),seeds=Number(process.argv[2]||128);
assert.ok(Number.isSafeInteger(seeds)&&seeds>=1&&seeds<=1024);
const trials=[];for(const p of prepared)for(let seed=1;seed<=seeds;seed++)trials.push(battle(p,seed));
const summary=prepared.map(p=>{const rows=trials.filter(x=>x.variant===p.key);return{key:p.key,spent:p.spent,
  preparedSha256:p.sha256,tested:rows.length,wins:rows.filter(x=>x.result==='win').length,
  minEnemyHp:Math.min(...rows.map(x=>x.after.enemyHp)),meanEnemyHp:rows.reduce((n,x)=>n+x.after.enemyHp,0)/rows.length};});
let selectedWin=null;const wins=trials.filter(x=>x.result==='win');
if(wins.length){const first=wins[0],p=prepared.find(x=>x.key===first.variant),paid=battle(p,first.seed,true);
  assert.equal(paid.result,'win');assert.ok(paid.after.stone>=100);
  const saveFile='docs/codex/reports/data/p324-soul-alert4550-bloodline-first-win-save.json';
  const reload=environment({rts_save:paid.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),paid.after.stone);
  fs.writeFileSync(path.join(root,saveFile),paid.saveText,'utf8');
  selectedWin={variant:first.variant,seed:first.seed,after:paid.after,saveFile,saveSha256:sha(paid.saveText)};
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P324',kind:'three available Sacred Blood actually spent per independent branch; paired conditional 4550 battles',
  sourceFile,sourceSha256:sha(raw),seeds:`xorshift32 1..${seeds} reset independently per branch`,unit:'battle HP and resources',summary,trials,selectedWin,
  limitations:['Fixed-seed branches are not natural win rates or one continuous random stream.','Three bloodline branches spend the same source inventory separately.']};
const output='docs/codex/reports/data/p324-soul-alert4550-bloodline.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:sha(raw),summary,selectedWin,output},null,2));
