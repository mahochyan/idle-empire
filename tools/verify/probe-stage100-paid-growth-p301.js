'use strict';
// P301: compare paid pre-nuclear, newly trained nuclear, and later developed armies at the final boss.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const inputs={
  beforeNuclear:'docs/codex/reports/data/p271-stage99-prenuclear-seed1-save.json',
  nuclearNoStar:'docs/codex/reports/data/p271-stage99-fulltech-seed1-save.json',
  nuclearFirst:'docs/codex/reports/data/p271-stage100-star-paid-save.json',
  awakenedPaid:'docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json'
};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const raw=Object.fromEntries(Object.entries(inputs).map(([key,file])=>[key,fs.readFileSync(path.join(root,file),'utf8')]));
const pilot=process.argv.includes('--pilot');
const deep=process.argv.includes('--deep');
const scales=pilot?[100,160,220]:deep?[170]:[1,100,120,140,150,160,165,170,175,180,200,220,240];
const seeds=pilot?3:deep?128:16;
const rows=[];
for(const variant of Object.keys(inputs))for(const scale of scales)for(let seed=1;seed<=seeds;seed++){
  const e=environment({rts_save:raw[variant]}),run=e.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),`${variant} load`);
  assert.equal(run('S.defeated.includes(99)'),true);
  assert.equal(run('S.defeated.includes(100)'),false);
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
    const boss=CFG.enemies.find(x=>x.id===100);
    boss.units=Object.fromEntries(Object.entries(boss.units).map(([type,counts])=>[type,counts.map(()=>${scale})]));`);
  const before=run(`({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),
    nuclear:scienceUnlocked('sci_nuclear_age'),awakening:S.awakening?.star_trooper?.level||0,
    sciences:S.sciences.length,defeated:S.defeated.length})`);
  assert.equal(before.deployed,variant==='awakenedPaid'?626:516);
  assert.equal(before.nuclear,variant!=='beforeNuclear');
  run('selEnemy(99);openBattle()');
  assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({tick:S.tick,army:armyCount(),deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),
    defeated:S.defeated.length,round:B.round,enemyRemainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.defeated,before.defeated+(won?1:0));
  assert.equal(run('loadSaveAndApply().status'),'ok',`${variant} battle reload`);
  assert.equal(run('S.defeated.includes(100)'),won);
  rows.push({variant,scale,seed,before,enemy,won,round:after.round,
    loss:before.deployed-after.deployed,enemyRemainingHp:after.enemyRemainingHp,callbacks});
}
const summary=[];
for(const variant of Object.keys(inputs))for(const scale of scales){
  const subset=rows.filter(x=>x.variant===variant&&x.scale===scale),wins=subset.filter(x=>x.won);
  summary.push({variant,scale,wins:wins.length,of:subset.length,enemyPeople:subset[0].enemy.people,
    enemyHp:subset[0].enemy.hp,meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    minEnemyRemainingHp:Math.min(...subset.map(x=>x.enemyRemainingHp))});
}
const result={batch:'P301',unit:'soldiers, battle rounds and simulated online seconds',
  method:'real current stage-100 asynchronous combat and settlement; only final enemy group count changed in isolated VM',
  pilot,deep,scales,seeds,inputs:Object.entries(inputs).map(([variant,file])=>({variant,file,sha256:sha(raw[variant])})),
  sourceHashes:['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js',
    'tools/verify/probe-stage100-paid-growth-p301.js'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
  summary,rows};
const output=deep?'docs/codex/reports/data/p301-stage100-paid-growth-deep.json':'docs/codex/reports/data/p301-stage100-paid-growth.json';
if(!pilot)fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:result.batch,pilot,deep,summary,output:pilot?null:output},null,2));
