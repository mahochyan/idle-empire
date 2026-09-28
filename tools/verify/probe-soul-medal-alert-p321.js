'use strict';
// Conditional alert sweep from the paid arcane-mage save. Alert jumps are sensitivity tests, not earned progress.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p321-arcane-mage-paid-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'e446f6c97d2fbedd7bdc0ce306a0b2e21cd3282fd71489bb1a32b95b16c47a65');
const origin=JSON.parse(raw);
assert.equal(origin.killValues.wildTurtle,3000);
function fight(alert,seed){
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    S.killValues.wildTurtle=${alert};`);
  assert.equal(r('validateSave(serializeSave()).ok'),true);
  const before=r('({bone:S.res.bone,army:formSoldierCount()})');
  r("openMaterialDomain('turtleShell')");assert.equal(r('S.battleActive'),true);
  let steps=0;while(r('S.battleActive')&&steps++<2000)assert.equal(r('__step()'),true);
  assert.ok(steps<2000);
  const after=r('({bone:S.res.bone,army:formSoldierCount(),result:document.getElementById("battle-result").className,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),alert:S.killValues.wildTurtle})');
  return{alert,seed,result:after.result,loss:before.army-after.army,boneGain:after.bone-before.bone,enemyHp:after.enemyHp,nextAlert:after.alert};
}
const alerts=[3000,3200,3500,3800,3900,3990,4000,4100,4200,4280,4290,4300,4400,4490,4500];
const rows=alerts.flatMap(alert=>Array.from({length:16},(_,i)=>fight(alert,i+1)));
const summary=alerts.map(alert=>{
  const x=rows.filter(row=>row.alert===alert),wins=x.filter(row=>row.result==='win');
  return{alert,trials:x.length,wins:wins.length,lossMin:Math.min(...x.map(row=>row.loss)),lossMax:Math.max(...x.map(row=>row.loss)),
    winLossMean:wins.length?wins.reduce((n,row)=>n+row.loss,0)/wins.length:null,
    bonePerWin:wins[0]?.boneGain??null,minEnemyHp:Math.min(...x.map(row=>row.enemyHp))};
});
const model=environment({rts_save:raw});assert.equal(model.run('loadSaveAndApply().status'),'ok');
let hypotheticalBone=origin.res.bone,hypotheticalMedal=origin.res.medal;
let secondResearchThreshold=null;
const noLossUpperBound=[];
for(let alert=3000;alert<4500;alert+=10){
  const reward=model.run(`materialDomainEncounter('turtleShell',${alert}).reward.bone`);
  hypotheticalBone+=reward;
  const trades=Math.floor(hypotheticalBone/68);
  hypotheticalBone-=trades*68;hypotheticalMedal+=trades*136;
  noLossUpperBound.push({alert,reward,medal:hypotheticalMedal});
  if(secondResearchThreshold===null&&hypotheticalMedal>=200000)secondResearchThreshold={wins:noLossUpperBound.length,alertAfter:alert+10};
}
const report={batch:'P321',kind:'conditional fixed-seed alert sensitivity, not a paid repeated route',sourceFile,sourceSha256:sha(raw),
  unit:'alert points, resource units, soldiers',seeds:'xorshift32 seeds 1..16',summary,
  noLossUpperBound:{assumption:'every turtle hunt wins, all bones exchanged at level 30, no losses or resource costs',secondResearchThreshold,medalAt4500:hypotheticalMedal,boneRemainder:hypotheticalBone},rows};
const dataFile='docs/codex/reports/data/p321-medal-alert-sensitivity.json';
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,summary,noLossUpperBound:report.noLossUpperBound,dataFile},null,2));
