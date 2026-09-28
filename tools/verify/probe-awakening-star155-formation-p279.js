'use strict';
// Legal formation-action comparison from one paid 155-star-soldier checkpoint.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const batch=process.argv.find(arg=>arg.startsWith('--batch='))?.slice('--batch='.length)||'p279';
if(!/^p[0-9]+$/.test(batch))throw Error('invalid batch');
const nanoLevel=Number(process.argv.find(arg=>arg.startsWith('--nano-level='))?.slice('--nano-level='.length)||0);
if(!Number.isSafeInteger(nanoLevel)||nanoLevel<0||nanoLevel>40)throw Error('invalid nano level');
const source='docs/codex/reports/data/p279-awakening-star155-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const save=JSON.parse(raw);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const g=(type,count)=>({type,count});
const e55=g('electro_trooper',55),e46=g('electro_trooper',46),armor=g('armored_trooper',55),alloy=g('alloy_special',55);
const s46=g('star_trooper',46),s55=g('star_trooper',55),s54=g('star_trooper',54),gold=g('gold_cavalry',40);
const variants=[
  {key:'baseline',front:[e55,armor,e46,alloy],mid:[s46,s55,s54,gold]},
  {key:'one-star-first',front:[s54,armor,e46,alloy],mid:[s46,s55,e55,gold]},
  {key:'one-star-middle',front:[e55,armor,s54,alloy],mid:[s46,s55,e46,gold]},
  {key:'two-stars-front',front:[e55,armor,s55,s54],mid:[s46,alloy,e46,gold]},
  {key:'three-stars-front',front:[s55,s54,s46,armor],mid:[e55,e46,alloy,gold]},
  {key:'three-stars-rear-front',front:[armor,s55,s54,s46],mid:[e55,e46,alloy,gold]}
];
const signature=groups=>groups.map(u=>`${u.type}:${u.count}`).sort().join('|');
const baseSignature=signature([...save.formation.front,...save.formation.mid]);
for(const v of variants)assert.equal(signature([...v.front,...v.mid]),baseSignature,v.key+' inventory');
const results=[];
for(const variant of variants)for(let seed=1;seed<=11;seed++){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  if(nanoLevel)run(`Object.assign(S.weaponForge.nanoArmor,{researched:true,level:${nanoLevel},equipped:true})`);
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}}};
    globalThis.__timers=new Map();globalThis.__id=1;setTimeout=fn=>{const id=__id++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run("clrForm('expedition')");
  const formation={front:variant.front,mid:variant.mid,back:save.formation.back};
  for(const [row,groups]of Object.entries(formation))groups.forEach((u,slot)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count,variant.key+' '+row+slot+' pool');
    run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}]?.count`),u.count,variant.key+' '+row+slot+' legal placement');
  });
  assert.equal(run('armyCount()'),671);
  assert.equal(run('formSoldierCount()'),626);
  assert.equal(run("expeditionCount('star_trooper')"),155);
  const cost=run('awakeningTrialCost()');
  const payment=run("openAwakeningTrial('easy')");assert.equal(payment?.ok,true,variant.key+' payment');
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true,'timer exhausted');callbacks++}
  assert.equal(run('S.battleActive'),false);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const soldiers=run('formSoldierCount()'),star=run("expeditionCount('star_trooper')"),level=run('S.awakening.star_trooper.level');
  run('exitBattle()');
  const row={variant:variant.key,seed,cost,enemy,result,enemyHpLeft,callbacks,soldiers,star,level};
  if(result==='win'&&!nanoLevel){
    assert.equal(level,6);
    assert.equal(run('save().ok'),true);
    const terminal=e.store.get('rts_save');
    const file=`docs/codex/reports/data/${batch}-awakening-${variant.key}-seed${seed}-level6-win-save.json`;
    fs.writeFileSync(path.join(root,file),terminal,'utf8');
    const reload=environment({rts_save:terminal});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    row.terminal={file,sha256:sha(terminal)};
  }
  results.push(row);
}
if(batch==='p279'&&!nanoLevel)for(let seed=1;seed<=11;seed++){
  const old=JSON.parse(fs.readFileSync(path.join(root,`docs/codex/reports/data/p279-awakening-101star-star155-level6-seed${seed}-pressure.json`),'utf8')).summary;
  const base=results.find(x=>x.variant==='baseline'&&x.seed===seed);
  assert.equal(base.enemyHpLeft,old.last.enemyHpLeft,'baseline seed '+seed);
}
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const summary={batch:batch.toUpperCase(),source,sourceSha256:sha(raw),unit:'soldiers, battle HP and items',
  conditionalNanoLevel:nanoLevel,variants:variants.map(x=>x.key),tested:results.length,
  wins:results.filter(x=>x.result==='win').length,
  byVariant:variants.map(v=>({key:v.key,wins:results.filter(x=>x.variant===v.key&&x.result==='win').length,
    minEnemyHpLeft:Math.min(...results.filter(x=>x.variant===v.key).map(x=>x.enemyHpLeft)),
    maxEnemyHpLeft:Math.max(...results.filter(x=>x.variant===v.key).map(x=>x.enemyHpLeft))})),results};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/${batch}-awakening-star155-formation${nanoLevel?`-nano${nanoLevel}`:''}.json`),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:summary.sourceSha256,tested:summary.tested,wins:summary.wins,byVariant:summary.byVariant},null,2));
