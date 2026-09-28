'use strict';
// Recheck the unpacked reference's nine selectable soul targets and eligibility at the paid-save alerts.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const entityFile='210(1)_unpacked/_analysis/entities_table.json';
const codeFile='210(1)_unpacked/_analysis/deob_main.js';
const entityRaw=fs.readFileSync(path.join(root,entityFile)),codeRaw=fs.readFileSync(path.join(root,codeFile));
const entitySha256=sha(entityRaw),codeSha256=sha(codeRaw);
assert.equal(entitySha256,'f67b86147f0c2f1ebf09eddd49dad1e1806c0441c347c14647d8d0d8ef706c2e');
assert.equal(codeSha256,'b0bc24d680517c592e8bd123148814f4f9ee24c53ddb0db8165294e131b563c4');
const code=codeRaw.toString('utf8');
for(const marker of ['getGeneralTeam','getMonsterData_general','winGeneralBattle','MonsterTeam'])assert.ok(code.includes(marker),marker);
const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/reports/data/p286-soul-rank-source-audit.json'),'utf8'));
assert.equal(prior.sources.entitiesSha256,entitySha256);assert.equal(prior.sources.codeSha256,codeSha256);
const bosses=prior.bosses.map(b=>({id:b.id,name:b.Name,range:b.NeedKillValue,weight:b.Rate,
  stone:b.Get.find(([item])=>item===170091)?.[1],alertGain:b.AddKillValue}));
assert.equal(bosses.length,6);assert.ok(bosses.every(b=>b.stone>0&&b.weight>0));
const alerts=[0,1000,2000,3000,3900,4000,4050,4300,4550,5000,6000];
const rows=alerts.map(alert=>{
  const eligible=bosses.filter(b=>alert>=b.range[0]&&alert<=b.range[1]);
  const totalWeight=eligible.reduce((n,b)=>n+b.weight,0);assert.ok(totalWeight>0);
  const members=eligible.map(b=>({...b,perSlotWeight:b.weight/totalWeight,
    expectedSlots:9*b.weight/totalWeight,
    stonePerKill:Math.floor(b.stone*(1+0.3*Math.floor(alert/1000)))}));
  const weakest=members[0],weakestAtLeastOne=1-Math.pow(1-weakest.perSlotWeight,9);
  return{alert,nineIndependentPicks:true,eligible:members,totalWeight,weakestAtLeastOne,
    hpFactor:Math.pow(1.4,Math.floor(alert/1000)),attackDefenseFactor:Math.pow(1.2,Math.floor(alert/1000)),
    countFactor:Math.pow(1.3,Math.floor(alert/1000))};
});
const localAt4550=rows.find(x=>x.alert===4550);
assert.deepEqual(localAt4550.eligible.map(x=>x.id),[540299,540399,540499]);
assert.equal(localAt4550.totalWeight,1500);
const output='docs/codex/reports/data/p324-soul-reference-nine-slot-audit.json';
const report={batch:'P324',kind:'reference source and current paid-alert eligibility; no game code executed',
  sources:{entityFile,entitySha256,codeFile,codeSha256,priorAudit:'docs/codex/reports/data/p286-soul-rank-source-audit.json'},
  sourceRules:['getGeneralTeam samples nine MonsterTeam positions independently by Rate among NeedKillValue-eligible entries.',
    'winGeneralBattle pays Get for the selected and defeated position, then clears only that position.',
    'getMonsterData_general scales HP by 1.4, ATK and DEF by 1.2, and count by 1.3 per full 1000 alert.'],
  unit:'reference raw HP/ATK/count ratios and soul-stone items per defeated selected target; not local battle units',bosses,rows,
  caveat:'Expected slots and at-least-one probabilities assume the nine source picks are independent; they do not imply target victories.'};
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sources:report.sources,at4550:localAt4550,output},null,2));
