'use strict';
// Isolated sensitivity only. Stars/city are directly varied inside unsaved VMs;
// this probe cannot be used as evidence of paid progression.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const paid35=process.argv.includes('--paid35');
const sourceFile=paid35?'p397-star-beast-star35-paid-save.json':
  'p395-star7-fighter-equipped-paid-save.json';
const raw=fs.readFileSync(path.join(dir,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const expectedSha=paid35?
  JSON.parse(fs.readFileSync(path.join(dir,'p397-star-beast-star35-paid.json'),'utf8')).finalSaveSha256:
  'dcf21b0932e2bd640c3a37804da1fc3d685165c47b2f2f3c1c50f3ccb16d93f1';
assert.equal(sha(raw),expectedSha);
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
function fight(stars,tier,seed){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const baseline=run(`({city:S.settlements.city,stars:S.steamMilitaryStars,
    deployed:formSoldierCount(),alert:S.killValues.starBeast})`);
  if(stars!==baseline.stars){
    run(`S.settlements.city=4000;S.steamMilitaryStars=${stars}`);
    assert.ok(run('steamMilitaryFieldSize()')>=baseline.deployed);
  }
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
    synthetic:stars!==baseline.stars};
}
const rows=[];
for(const stars of paid35?[35]:[25,30,35,40,45,50])
  for(const tier of [7,8,9]){
    const trials=Array.from({length:16},(_,i)=>fight(stars,tier,i+1));
    rows.push({stars,tier,synthetic:stars!==Number(JSON.parse(raw).steamMilitaryStars),
      wins:trials.filter(x=>x.result==='win').length,
      closestEnemyHp:Math.min(...trials.map(x=>x.enemyHpLeft)),
      meanEnemyHp:trials.reduce((n,x)=>n+x.enemyHpLeft,0)/trials.length,
      enemyInitialHp:trials[0].enemyInitialHp,
      lossRange:[Math.min(...trials.map(x=>x.loss)),Math.max(...trials.map(x=>x.loss))],
      trials});
  }
if(!paid35){
  assert.equal(rows.find(x=>x.stars===25&&x.tier===7).wins,0);
  assert.equal(rows.find(x=>x.stars===25&&x.tier===7).closestEnemyHp,289725);
}else assert.equal(rows.find(x=>x.stars===35&&x.tier===7).wins,16);
assert.equal(sha(fs.readFileSync(path.join(dir,sourceFile),'utf8')),sha(raw));
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),
  runtimeSha256[f],`${f} changed during run`);
const out={sourceFile,sourceSha256:sha(raw),runtimeSha256,rows,
  scope:paid35?'All rows use the paid 35-star save and real battles. Each seed reloads independently.':
    'Only 25-star source is paid. 30–50 stars and city4000 are unsaved direct VM sensitivity inputs.'};
fs.writeFileSync(path.join(dir,paid35?'p397-star-beast-star35-pressure.json':
  'p397-star-beast-late-pressure.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(rows.map(({trials,...row})=>row),null,2));
