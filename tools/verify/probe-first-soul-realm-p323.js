'use strict';
// Screen the first soul-realm fight from the immutable fully paid P323 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p323-soul-realm-final-40battles-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'63cbbfaedc190b6857ad954c95e76bb79465826c2beef89eacca4e8fe7964801');
const origin=JSON.parse(raw);
function fight(seed,alert=0,persist=false){
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  assert.equal(r("scienceUnlocked('sci_soul_realm')"),true);
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    S.killValues.soulRealm=${alert};`);
  assert.equal(r('validateSave(serializeSave()).ok'),true);
  const before=r('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,medal:S.res.medal})');
  r("openMaterialDomain('soulStone')");assert.equal(r('S.battleActive'),true);
  let steps=0;while(r('S.battleActive')&&steps++<2000)assert.equal(r('__step()'),true);
  assert.ok(steps<2000);
  const after=r('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,medal:S.res.medal,result:document.getElementById("battle-result").className,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})');
  const row={seed,alert,before,after,loss:before.army-after.army,stoneGain:after.stone-before.stone};
  if(persist){
    assert.equal(alert,0);
    r('exitBattle()');assert.equal(r('save().ok'),true);
    const saved=e.store.get('rts_save'),reload=environment({rts_save:saved});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.items.soulStone'),after.stone);
    assert.equal(reload.run('S.killValues.soulRealm'),after.alert);
    row.saveText=saved;
  }
  return row;
}
const rows=Array.from({length:32},(_,i)=>fight(i+1));
const wins=rows.filter(row=>row.after.result==='win');
const alerts=[0,500,900,1000,1500,1900,2000,3000,3900,4000,5000,6000];
const sensitivity=alerts.map(alert=>{
  const trials=Array.from({length:16},(_,i)=>fight(i+1,alert)),wins=trials.filter(row=>row.after.result==='win');
  return{alert,trials:trials.length,wins:wins.length,stonePerWin:wins[0]?.stoneGain??null,
    minLoss:wins.length?Math.min(...wins.map(row=>row.loss)):null,
    maxLoss:wins.length?Math.max(...wins.map(row=>row.loss)):null,
    minEnemyHp:Math.min(...trials.map(row=>row.after.enemyHp))};
});
const paid=fight(1,0,true),paidSaveFile='docs/codex/reports/data/p323-first-soul-realm-paid-save.json';
assert.equal(paid.after.result,'win');assert.equal(paid.loss,0);assert.equal(paid.stoneGain,1);
fs.writeFileSync(path.join(root,paidSaveFile),paid.saveText,'utf8');
const paidSaveSha256=sha(paid.saveText);delete paid.saveText;
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const report={batch:'P323',kind:'isolated first-soul-battle fixed-seed screen; no paid refill',sourceFile,sourceSha256:sha(raw),
  unit:'resource units, soldiers, alert points',seeds:'xorshift32 1..32',trials:rows.length,wins:wins.length,
  winLossMin:wins.length?Math.min(...wins.map(row=>row.loss)):null,winLossMax:wins.length?Math.max(...wins.map(row=>row.loss)):null,
  stonePerWin:wins[0]?.stoneGain??null,rows,sensitivity,paid:{...paid,saveFile:paidSaveFile,saveSha256:paidSaveSha256}};
const dataFile='docs/codex/reports/data/p323-first-soul-realm-screen.json';
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({batch:report.batch,sourceSha256:report.sourceSha256,trials:report.trials,wins:report.wins,
  winLossMin:report.winLossMin,winLossMax:report.winLossMax,stonePerWin:report.stonePerWin,
  first:rows[0],sensitivity,paid:report.paid,dataFile},null,2));
