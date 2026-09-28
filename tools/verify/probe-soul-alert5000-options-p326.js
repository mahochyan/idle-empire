'use strict';
// 同一P326满编档隔离测试剩余普通／精英敌位的实际战损与胜负。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const mode=process.argv[3]||'legacy-linear';assert.ok(['legacy-linear','source-sensitivity','current-source'].includes(mode));
const sourceFile=mode==='current-source'?'docs/codex/reports/data/p327-soul-source-first-star-restored-save.json':
  'docs/codex/reports/data/p326-soul-first-star-restored-save.json';
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(source),mode==='current-source'?'b1d153baefd1eb6979eefcd8d758582bc5c3026b1bb844052eed2c0138f3dd49':
  '19881b1be6100c28efbb5e59bfbb878d79aa04d9604342700e978ed48267c594');
const origin=JSON.parse(source),tiers=[540299,540399],trials=[];
for(const id of tiers)assert.ok(origin.soulRealmTeam.slots.includes(id));
function battle(id,seed,capture=false){
  const env=environment({rts_save:source}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  if(mode==='legacy-linear')run(`globalThis.__sourceEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){
      const e=__sourceEncounter(key,alert,tierId);
      if(key!=='soulStone'||!e)return e;
      const a=alert===null?S.killValues.soulRealm:alert,tier=soulRealmTier(tierId),base=CFG.soulRealm.tiers[0];
      const hpScale=tier.hp*tier.count/(base.hp*base.count),statScale=1+a*0.05/100;
      e.units={soul_wraith:[Math.max(1,Math.floor(100*hpScale*(1+a*0.15/100)))]};
      e.attackMass=Math.max(1,Math.floor(100*tier.count/base.count));
      e.bossMult={atk:tier.atk/base.atk*statScale,def:tier.def/base.def*statScale};
      return e;
    };`);
  if(mode==='source-sensitivity')run(`globalThis.__localEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){
      const e=__localEncounter(key,alert,tierId);
      if(key!=='soulStone'||!e)return e;
      const a=alert===null?S.killValues.soulRealm:alert,tier=soulRealmTier(tierId),base=CFG.soulRealm.tiers[0],step=Math.floor(a/1000);
      const hpCount=tier.hp*tier.count/(base.hp*base.count);
      e.units={soul_wraith:[Math.max(1,Math.floor(100*hpCount*Math.pow(1.4,step)*Math.pow(1.3,step)))]};
      e.attackMass=Math.max(1,Math.floor(100*tier.count/base.count*Math.pow(1.3,step)));
      e.bossMult={atk:tier.atk/base.atk*Math.pow(1.2,step),def:tier.def/base.def*Math.pow(1.2,step)};
      return e;
    };`);
  // P326/P327旧条件样本固定使用入场人数出手，不能被后续英魂减员规则改写。
  run(`globalThis.__historicalEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){const e=__historicalEncounter(key,alert,tierId);
      if(key==='soulStone'&&e)e.attackMassFallsWithHp=false;return e};`);
  const slot=origin.soulRealmTeam.slots.indexOf(id);
  const before=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm})');
  assert.equal(before.army,672);assert.equal(before.deployed,626);assert.equal(before.stone,3);assert.equal(before.alert,5000);
  assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
  assert.equal(run('B.enemyCfg.soulTierId'),id);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp})');
  if(result==='win'){
    const tier=run(`soulRealmTier(${id})`);
    assert.equal(after.stone-before.stone,run(`soulRealmReward(soulRealmTier(${id}),${before.alert})`));
    assert.equal(after.alert-before.alert,tier.alert);
    assert.equal(run(`S.soulRealmTeam.slots[${slot}]`),null);
  }else{
    assert.equal(after.stone,before.stone);assert.equal(after.alert,before.alert);
    assert.equal(run(`S.soulRealmTeam.slots[${slot}]`),id);
  }
  const saved=capture&&result==='win'?env.store.get('rts_save'):null;
  run('exitBattle()');
  return{id,slot,seed,before,enemy,result,after,callbacks,...(saved?{saveText:saved}:{})};
}
const count=Number(process.argv[2]||128);assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=512);
for(const id of tiers)for(let seed=1;seed<=count;seed++)trials.push(battle(id,seed));
const summary=tiers.map(id=>{
  const rows=trials.filter(t=>t.id===id),wins=rows.filter(t=>t.result==='win');
  return{id,tested:rows.length,wins:wins.length,minEnemyHp:Math.min(...rows.map(t=>t.after.enemyHp)),
    minArmy:Math.min(...rows.map(t=>t.after.army)),minWinLoss:wins.length?Math.min(...wins.map(t=>t.before.army-t.after.army)):null};
});
const selectedWins=[];
for(const id of mode==='source-sensitivity'?[]:tiers){
  const winner=trials.find(t=>t.id===id&&t.result==='win');
  if(!winner)continue;
  const paid=battle(id,winner.seed,true);assert.equal(paid.result,'win');
  const reload=environment({rts_save:paid.saveText});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.soulStone'),paid.after.stone);
  const prefix=mode==='current-source'?'p327':'p326';
  const saveFile=`docs/codex/reports/data/${prefix}-soul-alert5000-${id}-win-save.json`;
  fs.writeFileSync(path.join(root,saveFile),paid.saveText,'utf8');
  selectedWins.push({id,seed:paid.seed,before:paid.before,after:paid.after,saveFile,saveSha256:sha(paid.saveText)});
}
const report={batch:mode==='current-source'?'P327':'P326',sourceFile,sourceSha256:sha(source),kind:mode==='source-sensitivity'?'historical source-growth-ratio sensitivity through real local battle functions':'isolated fixed-seed actual-battle comparison of remaining normal and elite slots',mode,
  unit:'simulated battle callbacks, soldiers, material items and battle HP',seeds:`independent xorshift32 1..${count} per target`,
  summary,selectedWins,trials,
  limits:['The same paid save is reused independently for each target/seed; wins cannot be added together as a continuous route.',
    'This compares only the existing formation and equipment; fixed-seed fractions are not natural player win rates.',
    ...(mode==='source-sensitivity'?['The source factor wrapper was a developer-side hypothesis when P326 ran, not source combat equivalence or a paid continuation.']:[]),
    ...(mode==='legacy-linear'?['The linear wrapper reproduces the P326 historical player rule; current player code now uses source growth factors.']:[])]};
const reportFile=mode==='current-source'?'docs/codex/reports/data/p327-soul-alert5000-current-source.json':
  mode==='legacy-linear'?'docs/codex/reports/data/p326-soul-alert5000-options.json':
  'docs/codex/reports/data/p326-soul-alert5000-source-sensitivity.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(source));
console.log(JSON.stringify({summary,selectedWins,reportFile},null,2));
