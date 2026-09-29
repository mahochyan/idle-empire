'use strict';
// P356: replay paid stage-99 checkpoints against the live final boss and one isolated pressure candidate.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const fileByVariant={
  preNuclear:'p271-stage99-prenuclear-seed1-save.json',
  awakened:'p285-awakening-stage6-full-roster-paid-save.json',
  star40:'p338-electric5-nuclear5-star-attack-40-paid-save.json',
  star80:'p338-electric5-nuclear5-star-attack-80-paid-save.json',
  star100:'p338-electric5-nuclear5-star-attack-100-paid-save.json',
  star120:'p338-electric5-nuclear5-star-attack-120-paid-save.json'
};
const deep=process.argv.includes('--deep');
const scales=deep?[170]:[1,170];
const variants=deep?['preNuclear','awakened','star40','star120']:Object.keys(fileByVariant);
const seeds=deep?128:16;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHashes=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-stage100-late-paid-p356.js']
  .map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const inputs=variants.map(variant=>{
  const file='docs/codex/reports/data/'+fileByVariant[variant];
  const raw=fs.readFileSync(path.join(root,file),'utf8');
  return {variant,file,raw,sha256:sha(raw)};
});
const rows=[];
for(const input of inputs)for(const scale of scales)for(let seed=1;seed<=seeds;seed++){
  const e=environment({rts_save:input.raw}),run=e.run;
  assert.ok(['ok','migrated'].includes(run('loadSaveAndApply().status')),input.variant+' load');
  assert.equal(run('S.defeated.includes(99)'),true,input.variant+' stage 99');
  assert.equal(run('S.defeated.includes(100)'),false,input.variant+' not stage 100');
  const before=run(`({tick:S.tick,deployed:formSoldierCount(),sciences:S.sciences.length,
    nuclear:scienceUnlocked('sci_nuclear_age'),quantum:scienceUnlocked('sci_quantum_age'),
    starAttack:S.armsUp?.star_trooper?.atk?.stars||0,
    awakening:S.awakening?.star_trooper?.level||0,
    starAttackStat:weaponAttack('star_trooper')})`);
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
    ${scale===1?'':`const boss=CFG.enemies.find(x=>x.id===100);
      boss.units=Object.fromEntries(Object.entries(boss.units).map(([type,counts])=>[type,counts.map(()=>${scale})]));`}`);
  run('selEnemy(99);openBattle()');
  assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({tick:S.tick,deployed:formSoldierCount(),round:B.round,
    enemyRemainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),
    defeated:S.defeated.includes(100)})`);
  assert.equal(after.tick,before.tick);
  assert.equal(after.defeated,won);
  assert.equal(run('loadSaveAndApply().status'),'ok',input.variant+' battle reload');
  assert.equal(run('S.defeated.includes(100)'),won);
  rows.push({variant:input.variant,scale,seed,before,enemy,won,round:after.round,
    loss:before.deployed-after.deployed,enemyRemainingHp:after.enemyRemainingHp,callbacks});
}
const summary=[];
for(const variant of variants)for(const scale of scales){
  const subset=rows.filter(x=>x.variant===variant&&x.scale===scale),wins=subset.filter(x=>x.won);
  summary.push({variant,scale,wins:wins.length,of:subset.length,
    before:subset[0].before,enemyPeople:subset[0].enemy.people,
    meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    worstLoss:Math.max(...subset.map(x=>x.loss)),
    minEnemyRemainingHp:Math.min(...subset.map(x=>x.enemyRemainingHp))});
}
const output='docs/codex/reports/data/'+(deep?'p356-stage100-late-paid-deep.json':'p356-stage100-late-paid.json');
const report={batch:'P356',kind:'current-code paid stage-99 final-boss replay; 170-per-group only in isolated VM',
  deep,scales,seeds,inputs:inputs.map(({raw,...input})=>input),sourceHashes,summary,rows};
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,summary},null,2));
