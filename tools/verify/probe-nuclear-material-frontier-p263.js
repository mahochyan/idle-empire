'use strict';
// P263: read-only current-code battle screen from P262's paid 1002-person checkpoint.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p262-nuclear-pop1002-paid-save.json';
const outputFile='docs/codex/reports/data/p263-nuclear-material-frontier.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const keys=['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew','guardianStone','godCrystal'];
const rows=[];
for(const key of keys)for(let seed=1;seed<=16;seed++){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const domain=run(`specialEncounterConfig('${key}')`);
  assert.ok(domain);
  const killKey=domain.killValueKey;
  const material=key==='bone'?'boarHeart':key;
  const before=run(`({kill:S.killValues['${killKey}'],army:armyCount(),stock:S.items['${material}'],tick:S.tick})`);
  run(`openMaterialDomain('${key}')`);
  assert.equal(run('S.battleActive'),true,`${key}: battle did not open`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const after=run(`({kill:S.killValues['${killKey}'],army:armyCount(),stock:S.items['${material}'],tick:S.tick,round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})`);
  const win=run("document.getElementById('battle-result').className")==='win';
  assert.equal(after.tick,before.tick);
  if(win){
    if(Number.isFinite(before.kill))assert.ok(after.kill>before.kill);
    assert.ok(after.stock>=before.stock);
  }
  const saved=e.store.get('rts_save');
  if(win){
    const reload=environment({rts_save:saved});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    if(Number.isFinite(after.kill))assert.equal(reload.run(`S.killValues['${killKey}']`),after.kill);
  }
  rows.push({key,seed,win,round:after.round,loss:before.army-after.army,drop:after.stock-before.stock,
    remainingEnemyHp:after.enemyHp,callbacks,killBefore:before.kill,killAfter:after.kill,saveSha256:sha(saved)});
}
const report={batch:'P263',sourceFile,sourceSha256:sha(raw),policy:'current paid formation and current enemy configuration; isolated fixed PRNG streams; no battles retained in input save',rows};
fs.writeFileSync(path.join(root,outputFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceFile,sourceSha256:report.sourceSha256,summary:keys.map(key=>{const r=rows.filter(x=>x.key===key),w=r.filter(x=>x.win);return{key,wins:w.length,of:r.length,firstKillValue:r[0].killBefore,minEnemyHp:Math.min(...r.map(x=>x.remainingEnemyHp)),meanWinLoss:w.length?w.reduce((n,x)=>n+x.loss,0)/w.length:null}})}));
