'use strict';
// Conditional alert and route screen from the paid P322 astral save; each trial is isolated.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p322-astral-route-137battles-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'3493925c7355e758df5ef9e3577fbaf1c2e36d9351a8d7c6232f647064967d51');
const cases={
  bullHorn:[3380,3400,3490,3500,3800,3990,4000],
  snakeGall:[2130,2500,3000,3490,3500,3990,4000],
  tigerPelt:[3000,3490,3500,3990,4000],
  wyrmSinew:[3500,3800,3990,4000],
  bone:[4000,4200,4300,4400,4490,4500]
};
function fight(key,alert,seed){
  const e=environment({rts_save:raw}),r=e.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const killKey=r(`specialEncounterConfig('${key}').killValueKey`);
  r(`S.killValues.${killKey}=${alert}`);
  assert.equal(r('validateSave(serializeSave()).ok'),true);
  const before=r('({bone:S.res.bone,army:formSoldierCount()})');
  r(`openMaterialDomain('${key}')`);assert.equal(r('S.battleActive'),true);
  let steps=0;while(r('S.battleActive')&&steps++<2000)assert.equal(r('__step()'),true);
  assert.ok(steps<2000);
  const after=r(`({bone:S.res.bone,army:formSoldierCount(),result:document.getElementById('battle-result').className,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),alert:S.killValues.${killKey}})`);
  return{key,alert,seed,result:after.result,loss:before.army-after.army,boneGain:after.bone-before.bone,enemyHp:after.enemyHp,nextAlert:after.alert};
}
const rows=Object.entries(cases).flatMap(([key,alerts])=>alerts.flatMap(alert=>Array.from({length:16},(_,i)=>fight(key,alert,i+1))));
const summary=Object.entries(cases).flatMap(([key,alerts])=>alerts.map(alert=>{
  const x=rows.filter(row=>row.key===key&&row.alert===alert),wins=x.filter(row=>row.result==='win');
  return{key,alert,trials:x.length,wins:wins.length,bonePerWin:wins[0]?.boneGain??null,
    winLossMin:wins.length?Math.min(...wins.map(row=>row.loss)):null,
    winLossMax:wins.length?Math.max(...wins.map(row=>row.loss)):null,
    minEnemyHp:Math.min(...x.map(row=>row.enemyHp))};
}));
const report={batch:'P323',kind:'isolated conditional alert screen; not paid continuous fights',sourceFile,sourceSha256:sha(raw),
  seeds:'xorshift32 1..16 independently for each fight',unit:'alert points, resource units, soldiers',summary,rows};
const dataFile='docs/codex/reports/data/p323-medal-route-frontier.json';
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,summary,dataFile},null,2));
