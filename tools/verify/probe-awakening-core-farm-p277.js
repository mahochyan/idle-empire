'use strict';
// Real战术演算机 battle loop for the missing high-energy cores.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input=process.argv.find(x=>x.startsWith('--input='))?.slice('--input='.length)||'p277-awakening-steam3-energy2-paid-save.json';
const label=process.argv.find(x=>x.startsWith('--label='))?.slice('--label='.length)||'base';
const outputPrefix=process.argv.find(x=>x.startsWith('--output-prefix='))?.slice('--output-prefix='.length)||'p277';
assert.match(input,/^p27[789]-awakening-[a-z0-9-]+\.json$/);
assert.match(label,/^[a-z0-9-]+$/);
assert.match(outputPrefix,/^p27[78]$|^p284$/);
const source='docs/codex/reports/data/'+input;
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const count=Number(process.argv.find(x=>x.startsWith('--count='))?.slice(8)||1);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=100);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${JSON.parse(raw).ts}}};
  globalThis.__timers=new Map();globalThis.__id=1;setTimeout=fn=>{const id=__id++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const initial=run("({army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,alert:S.killValues.godSlaughter,fruit:S.items.trialFruit,level:S.awakening.star_trooper.level})");
const rows=[];
for(let i=0;i<count;i++){
  const before=run("({army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,alert:S.killValues.godSlaughter})");
  run("openMaterialDomain('medal')");assert.equal(run('S.battleActive'),true);
  const enemy=run("({hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})");
  let callbacks=0;while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true,'timer exhausted');callbacks++}
  assert.equal(run('S.battleActive'),false);
  const battle={result:run("document.getElementById('battle-result').className"),callbacks,
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')};
  run('exitBattle()');
  const after=run("({army:armyCount(),deployed:formSoldierCount(),core:S.items.godCore,alert:S.killValues.godSlaughter})");
  rows.push({step:i+1,before,enemy,battle,after});
  if(battle.result!=='win'||after.deployed<=0||!run('S.formation.front[0]'))break;
}
const summary={batch:outputPrefix.toUpperCase(),source,sourceSha256:sha(raw),unit:'soldiers, cores, combat HP',initial,count,steps:rows.length,
  wins:rows.filter(r=>r.battle.result==='win').length,last:rows.at(-1),rows};
if(rows.length===count&&rows.every(r=>r.battle.result==='win')){
  assert.equal(run('save().ok'),true);
  const terminal=e.store.get('rts_save');
  const file=`docs/codex/reports/data/${outputPrefix}-awakening-core-${label}-${count}-paid-save.json`;
  fs.writeFileSync(path.join(root,file),terminal,'utf8');
  const reload=environment({rts_save:terminal});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.godCore'),rows.at(-1).after.core);
  summary.terminal={file,sha256:sha(terminal)};
}
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
fs.writeFileSync(path.join(root,`docs/codex/reports/data/${outputPrefix}-awakening-core-${label}-${count}-pressure.json`),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({initial,count,steps:summary.steps,wins:summary.wins,first:rows[0],last:summary.last,terminal:summary.terminal},null,2));
