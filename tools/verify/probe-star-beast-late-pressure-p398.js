'use strict';
// P398 fixed-stream actual battles from independently reloaded paid star saves.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const stars=Number((process.argv.find(x=>x.startsWith('--star='))||'--star=50').slice(7));
assert.ok([40,45,50].includes(stars));
const sourceFile=`p398-star-beast-star${stars}-paid-save.json`;
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const ledger=JSON.parse(fs.readFileSync(path.join(dir,'p398-star-beast-star50-paid.json'),'utf8'));
const expectedSha=ledger.milestones.find(x=>x.target===stars)?.sha256;
assert.ok(expectedSha);
assert.equal(sha(raw),expectedSha);
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
function fight(tier,seed){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.steamMilitaryStars'),stars);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  const encounter=run(`materialDomainEncounter('starBeast${tier}')`);
  const before=run('armyCount()');
  run(`openMaterialDomain('starBeast${tier}')`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000,'battle callback bound');
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  return{stars,tier,seed,result,enemyHpLeft,
    enemyInitialHp:run('B.enemyUnits.reduce((n,u)=>n+u.maxHp,0)'),
    loss:before-run('armyCount()'),
    reward:run('S.items.sacredRingCore')-JSON.parse(raw).items.sacredRingCore,
    attackHpMultiplier:run('steamMilitaryStatMultiplier()'),
    expectedReward:encounter.reward.sacredRingCore,
    synthetic:false};
}
const rows=[];
for(const tier of [7,8,9]){
    const trials=Array.from({length:16},(_,i)=>fight(tier,i+1));
    rows.push({stars,tier,synthetic:false,
      wins:trials.filter(x=>x.result==='win').length,
      closestEnemyHp:Math.min(...trials.map(x=>x.enemyHpLeft)),
      meanEnemyHp:trials.reduce((n,x)=>n+x.enemyHpLeft,0)/trials.length,
      enemyInitialHp:trials[0].enemyInitialHp,
      lossRange:[Math.min(...trials.map(x=>x.loss)),Math.max(...trials.map(x=>x.loss))],
      trials});
  }
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),sha(raw));
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),
  runtimeSha256[f],`${f} changed during run`);
const out={sourceFile,sourceSha256:sha(raw),runtimeSha256,rows,
  scope:'All rows use a paid save and real battles. Each seed reloads independently; no resource, star, city, or win injection.'};
fs.writeFileSync(path.join(dir,`p398-star-beast-star${stars}-pressure.json`),
  JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(rows.map(({trials,...row})=>row),null,2));
