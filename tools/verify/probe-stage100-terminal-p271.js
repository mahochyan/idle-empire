'use strict';
// Same-strength paid stage-99 saves; only the final boss count is conditionally scaled.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sources={prenuclear:'docs/codex/reports/data/p271-stage99-prenuclear-seed1-save.json',
  fulltech:'docs/codex/reports/data/p271-stage99-fulltech-seed1-save.json'};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const raw=Object.fromEntries(Object.entries(sources).map(([k,file])=>[k,fs.readFileSync(path.join(root,file),'utf8')]));
const scales=[1,20,40,60,80,100,120];
const rows=[];
for(const variant of ['prenuclear','fulltech','starConditional'])for(const scale of scales)for(let seed=1;seed<=16;seed++){
  const e=environment({rts_save:raw[variant==='prenuclear'?'prenuclear':'fulltech']}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.defeated.length'),99);
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    CFG.enemies[99].units=Object.fromEntries(Object.entries(CFG.enemies[99].units).map(([type,counts])=>[type,counts.map(()=>${scale})]));`);
  if(variant==='starConditional'){
    assert.equal(run("scienceUnlocked('sci_nuclear_age')"),true);
    // Stat-only sensitivity: replace the paid 55-alloy regiment with 55 untrained star soldiers.
    run("S.formation.front[2].type='star_trooper'");
  }
  const before=run("({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),defeated:S.defeated.length,starScience:scienceUnlocked('sci_nuclear_age')})");
  assert.equal(before.deployed,516);
  run('selEnemy(99);openBattle()');assert.equal(run('S.battleActive'),true);
  const enemy=run("({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run("({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),defeated:S.defeated.length,round:B.round,enemyRemainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})");
  assert.equal(after.tick,before.tick);assert.equal(after.defeated,before.defeated+(won?1:0));
  rows.push({variant,scale,seed,won,enemy,round:after.round,loss:before.deployed-after.deployed,enemyRemainingHp:after.enemyRemainingHp,callbacks});
}
const summary=[];
for(const variant of ['prenuclear','fulltech','starConditional'])for(const scale of scales){
  const entries=rows.filter(x=>x.variant===variant&&x.scale===scale),wins=entries.filter(x=>x.won);
  summary.push({variant,scale,wins:wins.length,of:entries.length,enemyPeople:entries[0].enemy.people,enemyHp:entries[0].enemy.hp,
    enemyAttackMass:entries[0].enemy.attackMass,meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    minEnemyRemainingHp:Math.min(...entries.map(x=>x.enemyRemainingHp))});
}
const report={batch:'P271',sources:Object.fromEntries(Object.entries(sources).map(([k,file])=>[k,{file,sha256:sha(raw[k])}])),
  method:'isolated real battle callbacks; stage-100 enemy regiment size is conditional, starConditional replaces one 55-alloy regiment without payment',scales,summary,rows};
const output='docs/codex/reports/data/p271-stage100-terminal-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
for(const [k,file] of Object.entries(sources))assert.equal(sha(fs.readFileSync(path.join(root,file),'utf8')),report.sources[k].sha256);
console.log(JSON.stringify({sources:report.sources,summary,output}));
