'use strict';
// Read-only replay: historical P97 post-campaign v31 snapshot against the
// *current* stage-100 battle implementation. This is not a new-save route.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p97-natural-stage-frontier-final-save.json');
const raw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const result=[];
for(const random of [0.1,0.5,0.9]){
  const e=environment({rts_save:raw});
  const loaded=e.run('loadSaveAndApply()');
  assert.equal(loaded.status,'migrated');
  assert.equal(e.run("scienceUnlocked('sci_nuclear_age')"),false);
  assert.equal(e.run('Object.keys(S.upgradedUnits).length'),0);
  e.run(`
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();
    document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id);
    };
    globalThis.addLog=m=>S.log.push(String(m));
    Math.random=()=>${random};
    S.selEnemy=99;
  `);
  const before=e.run('armyCount()'),deployedBefore=e.run('Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0)');
  e.run('openBattle()');
  assert.equal(e.run('S.battleActive'),true);
  for(let n=0;n<600&&e.run('S.battleActive');n++)
    assert.equal(e.run('__step()'),true,'battle callback missing');
  assert.equal(e.run('S.battleActive'),false,'battle did not settle');
  const row=JSON.parse(e.run('JSON.stringify({round:B.round,settled:B.settled,armyAfter:armyCount(),deployedAfter:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),resultClass:document.getElementById("battle-result").className,defeated:S.defeated.length,sciences:S.sciences.length})'));
  result.push({random,armyBefore:before,deployedBefore,...row});
}
const out={source:'P97 historical post-campaign v31 save',sourceSha256:sha(raw),
  currentFiles:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js'].map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))])),
  limitations:'Post-campaign save already has 100 defeated and prior rewards; this only tests current stage-100 battle with the same non-nuclear army, not a new-save 1–100 route.',
  rows:result};
const outputPath=path.join(root,'docs/codex/reports/data/p237-current-stage100-replay.json');
fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({output:outputPath,rows:result},null,2));
