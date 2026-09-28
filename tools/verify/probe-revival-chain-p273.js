'use strict';
// Continue the paid P272 save through actual consecutive revival-domain callbacks until first troop loss or defeat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p272-nuclear-first-knowledge-leaf-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const source=JSON.parse(raw);
run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${source.ts}+(S.tick-${source.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const roster=()=>run("Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0)");
const initial={alert:run('S.killValues.godRebirth'),leaf:run('S.items.revivalLeaf'),roster:roster(),mainline:run('S.defeated.length')};
const battles=[];
let lastNoLossRaw=null;
for(let i=0;i<200;i++){
  const before={alert:run('S.killValues.godRebirth'),leaf:run('S.items.revivalLeaf'),roster:roster()};
  run('globalThis.__timers.clear()');
  run("openMaterialDomain('revivalLeaf')");
  assert.equal(run('S.battleActive'),true);
  const enemy=run("({hp:B.enemyUnits[0].hp,def:B.enemyUnits[0].def,atk:B.enemyUnits[0].atk,reward:B.enemyCfg.reward.revivalLeaf})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  assert.ok(callbacks<2000);
  const result=run("document.getElementById('battle-result').className");
  const after={alert:run('S.killValues.godRebirth'),leaf:run('S.items.revivalLeaf'),roster:roster()};
  const healEvents=run("B.msgs.filter(row=>row.m.includes('圣辉自愈')).length");
  if(result==='win'){
    assert.equal(after.alert,before.alert+100);
    assert.equal(after.leaf-before.leaf,enemy.reward);
  }else{
    assert.equal(after.alert,before.alert);
    assert.equal(after.leaf,before.leaf);
  }
  assert.ok(after.roster<=before.roster);
  assert.equal(run('S.defeated.length'),initial.mainline);
  battles.push({number:i+1,result,before,enemy,after,healEvents,callbacks});
  if(result==='win'&&after.roster===before.roster)lastNoLossRaw=e.store.get('rts_save');
  if(result!=='win'||after.roster<before.roster)break;
}
assert.ok(battles.length>0);
assert.ok(lastNoLossRaw);
const finalRaw=e.store.get('rts_save'),reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.killValues.godRebirth'),battles.at(-1).after.alert);
assert.equal(reload.run('S.items.revivalLeaf'),battles.at(-1).after.leaf);
assert.equal(hash(fs.readFileSync(path.join(root,sourceFile),'utf8')),hash(raw));
const saveFile='docs/codex/reports/data/p273-revival-first-pressure-save.json';
fs.writeFileSync(path.join(root,saveFile),finalRaw,'utf8');
const noLossSaveFile='docs/codex/reports/data/p273-revival-no-loss-checkpoint-save.json';
fs.writeFileSync(path.join(root,noLossSaveFile),lastNoLossRaw,'utf8');
const report={batch:'P273',sourceFile,sourceSha256:hash(raw),unit:'battle callbacks, resource units, soldiers; no online seconds',
  initial,battles,stopReason:battles.at(-1).result!=='win'?'first-defeat':battles.at(-1).after.roster<battles.at(-1).before.roster?'first-troop-loss':'200-win-cap',
  saveFile,saveSha256:hash(finalRaw),noLossSaveFile,noLossSaveSha256:hash(lastNoLossRaw)};
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p273-revival-first-pressure.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,initial,stopReason:report.stopReason,battles:battles.length,
  first:battles[0],last:battles.at(-1),saveFile,saveSha256:report.saveSha256,noLossSaveFile,noLossSaveSha256:report.noLossSaveSha256}));
