'use strict';
// Conditional remaining-hunt screen from the paid P323 exhausted-route save; each trial is isolated.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p323-soul-realm-route-185battles-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'6f04dad92881333a94885c45c659de87aaf19f0e3f0f6556f4b36ecf86026d27');
const cases={
  bullHorn:[3640,3800,3900,3990],
  snakeGall:[3000],
  tigerPelt:[3170,3300,3400,3490],
  wyrmSinew:[3740,3800,3900,3990],
  bone:[4210,4300,4400,4490],
  turtleShell:[4000]
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
const rows=Object.entries(cases).flatMap(([key,alerts])=>alerts.flatMap(alert=>Array.from({length:32},(_,i)=>fight(key,alert,i+1))));
const summary=Object.entries(cases).flatMap(([key,alerts])=>alerts.map(alert=>{
  const x=rows.filter(row=>row.key===key&&row.alert===alert),wins=x.filter(row=>row.result==='win');
  return{key,alert,trials:x.length,wins:wins.length,bonePerWin:wins[0]?.boneGain??null,
    winLossMin:wins.length?Math.min(...wins.map(row=>row.loss)):null,
    winLossMax:wins.length?Math.max(...wins.map(row=>row.loss)):null,
    minEnemyHp:Math.min(...x.map(row=>row.enemyHp))};
}));
const report={batch:'P323',kind:'isolated conditional alert screen; not paid continuous fights',sourceFile,sourceSha256:sha(raw),
  seeds:'xorshift32 1..32 independently for each fight',unit:'alert points, resource units, soldiers',summary,rows};
const dataFile='docs/codex/reports/data/p323-medal-remaining-frontier.json';
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,summary,dataFile},null,2));
