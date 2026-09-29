'use strict';
// Compare the same naturally paid late formation before/after two paid armament
// upgrades. The formal 100-per-group case uses unmodified player configuration.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const names={uninvested:'p400-armament-natural-route-save.json',invested:'p400-armament-natural-invested-save.json'};
const inputs=Object.fromEntries(Object.entries(names).map(([key,name])=>{
  const raw=fs.readFileSync(path.join(data,name),'utf8');
  return[key,{name,sha256:sha(raw),raw}];
}));
assert.equal(inputs.uninvested.sha256,'368dfa4d10f89469ae71cd2679183333526a7ed92b794fbb6e838dd375035f60');
assert.equal(inputs.invested.sha256,'e466af613d8048e4d68fb7993956a02491271c50c429a28775e0dad9222b2a9d');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(file=>
  [file,sha(fs.readFileSync(path.join(root,file)))]));
const scales=process.argv.includes('--pilot')?[100,180]:[100,120,180,240,260];
const seeds=process.argv.includes('--pilot')?[1,7,15]:Array.from({length:16},(_,i)=>i+1);

function setBattleRuntime(run,seed){
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;
      __timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',
        scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=message=>S.log.push(String(message));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}

function fight(profile,scale,seed){
  const env=environment({rts_save:inputs[profile].raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  const before=run(`({deployed:formSoldierCount(),army:armyCount(),
    science:scienceUnlocked('sci_astral_armament'),stage100:S.defeated.includes(100),
    atkLevel:S.quantumArmament.star_trooper.atk,hpLevel:S.quantumArmament.star_trooper.hp,
    starAttack:battleMilitaryAttack('star_trooper'),starHp:battleVitals('star_trooper',7,true).maxHp})`);
  assert.equal(before.science,true);assert.equal(before.stage100,true);
  assert.equal(before.deployed,626);
  assert.equal(before.atkLevel,profile==='invested'?1:0);
  assert.equal(before.hpLevel,profile==='invested'?1:0);
  setBattleRuntime(run,seed);
  if(scale!==100)run(`CFG.enemies[99].units=Object.fromEntries(
    Object.entries(CFG.enemies[99].units).map(([key,groups])=>[key,groups.map(()=>${scale})]))`);
  assert.equal(run('selEnemy(99)'),true);
  run('openBattle()');assert.equal(run('S.battleActive'),true);
  const enemy=run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})`);
  assert.equal(enemy.people,11*scale);
  const starEntry=run(`B.ourUnits.filter(u=>u.type==='star_trooper')
    .map(u=>({people:u.initialCount,attack:u.atk,hp:u.maxHp}))`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<4000);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run(`({deployed:formSoldierCount(),army:armyCount(),round:B.round,
    stage100:S.defeated.includes(100),enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})`);
  assert.equal(after.stage100,true);
  const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('formSoldierCount()'),after.deployed);
  assert.equal(reload.run('S.quantumArmament.star_trooper.atk'),before.atkLevel);
  assert.equal(reload.run('S.quantumArmament.star_trooper.hp'),before.hpLevel);
  return{profile,scale,seed,before,enemy,starEntry,won,after,
    loss:before.deployed-after.deployed,callbacks,saveSha256:sha(saved)};
}

const rows=[];
for(const profile of Object.keys(inputs))for(const scale of scales)
  for(const seed of seeds)rows.push(fight(profile,scale,seed));
const summary=[];
for(const scale of scales){
  const by={};
  for(const profile of Object.keys(inputs)){
    const r=rows.filter(x=>x.scale===scale&&x.profile===profile),wins=r.filter(x=>x.won);
    by[profile]={wins:wins.length,of:r.length,meanWinLoss:wins.length?
      wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,
      fullLosses:r.filter(x=>x.loss===x.before.deployed).length};
  }
  const pairs=seeds.map(seed=>{
    const a=rows.find(x=>x.scale===scale&&x.seed===seed&&x.profile==='uninvested');
    const b=rows.find(x=>x.scale===scale&&x.seed===seed&&x.profile==='invested');
    return{seed,beforeWin:a.won,afterWin:b.won,lossBefore:a.loss,lossAfter:b.loss,
      lossDelta:a.loss-b.loss};
  });
  summary.push({scale,totalEnemy:11*scale,by,winChanges:pairs.filter(x=>x.beforeWin!==x.afterWin),
    lossDelta:pairs.map(x=>x.lossDelta),pairs});
}
const report={batch:'P401',baseline:'7cb00487d186c5eb049dac3d582fc5cc5ea12d0c',
  kind:'real stage-100 replay on paid v34 saves, with isolated enemy count sensitivity',
  inputs:Object.fromEntries(Object.entries(inputs).map(([key,{raw,...rest}])=>[key,rest])),
  runtimeSha256,scales,seeds,summary,rows};
const file=process.argv.includes('--pilot')?'p401-stage100-armament-effect-pilot.json':
  'p401-stage100-armament-effect.json';
fs.writeFileSync(path.join(data,file),JSON.stringify(report,null,2)+'\n');
for(const x of Object.values(inputs))assert.equal(sha(fs.readFileSync(path.join(data,x.name))),x.sha256);
for(const file of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,file))),runtimeSha256[file]);
console.log(JSON.stringify({file,summary:summary.map(({scale,totalEnemy,by,winChanges,lossDelta})=>({
  scale,totalEnemy,by,winChanges,meanSavedSoldiers:lossDelta.reduce((a,b)=>a+b,0)/lossDelta.length,
  minSavedSoldiers:Math.min(...lossDelta),maxSavedSoldiers:Math.max(...lossDelta)}))},null,2));
