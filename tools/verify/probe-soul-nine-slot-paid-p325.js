'use strict';
// 从 P324 有价满编档逐种子真实生成九敌位并选最低档，验证当前战力能否接续。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p324-soul-alert4550-restored-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'ba54521f29f3bad88494f67b277c47e95c109a522f88ad9650c3a06e2e4aa69f');
const origin=JSON.parse(raw),trials=[];
const mode=process.argv[3]||'legacy-linear';assert.ok(['legacy-linear','source-sensitivity'].includes(mode));
let continuous=null,continuousSave=null,intermediateSave=null,intermediateRng=null;
function trial(seed){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
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
  // P325/P326历史账均为固定入场出手规模；保留原口径供回放，不覆盖新玩家规则。
  run(`globalThis.__historicalEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){const e=__historicalEncounter(key,alert,tierId);
      if(key==='soulStone'&&e)e.attackMassFallsWithHp=false;return e};`);
  assert.equal(run('S.items.soulStone'),91);
  assert.equal(run('S.killValues.soulRealm'),4550);
  assert.equal(run('refreshSoulRealmTeam().ok'),true);
  const slots=Array.from(run('S.soulRealmTeam.slots'));
  const target=slots.includes(540299)?540299:slots.includes(540399)?540399:540499;
  const index=slots.indexOf(target);
  assert.ok(index>=0);
  const before=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm})');
  assert.equal(run(`openSoulRealmSlot(${index}).ok`),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");
  const after=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp})');
  if(result==='win'){
    const tier=run(`soulRealmTier(${target})`);
    assert.equal(after.stone-before.stone,Math.floor(tier.stone*(1+0.3*4)));
    assert.equal(after.alert-before.alert,tier.alert);
    assert.equal(run(`S.soulRealmTeam.slots[${index}]`),null);
    const saved=env.store.get('rts_save'),reload=environment({rts_save:saved});
    assert.equal(reload.run('loadSaveAndApply().status'),'ok');
    assert.equal(reload.run('S.items.soulStone'),after.stone);
    if(seed===1){
      const steps=[{slot:index,target,result,before,after,callbacks}];
      while(run('S.items.soulStone')<100&&steps.length<CFG_LIMIT){
        run('exitBattle()');
        const next=Array.from(run('S.soulRealmTeam.slots')).findIndex(id=>id===540299);
        if(next<0)break;
        const prior=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm})');
        assert.equal(run(`openSoulRealmSlot(${next}).ok`),true);
        let ticks=0;while(run('S.battleActive')&&ticks++<3000)assert.equal(run('__step()'),true);
        assert.ok(ticks<3000);
        const outcome=run("document.getElementById('battle-result').className");
        const current=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp})');
        steps.push({slot:next,target:540299,result:outcome,before:prior,after:current,callbacks:ticks});
        if(mode==='source-sensitivity'&&steps.length===2&&outcome==='win'){
          intermediateSave=env.store.get('rts_save');intermediateRng=run('__rng');
        }
        if(outcome!=='win')break;
      }
      let upgrade=null;
      if(run('S.items.soulStone')>=100){
        upgrade=run("upgradeSoulRank('arcane_mage')");
        assert.equal(upgrade.ok,true);
        assert.equal(run('S.soulRanks.arcane_mage.stars'),1);
        continuousSave=env.store.get('rts_save');
        const check=environment({rts_save:continuousSave});assert.equal(check.run('loadSaveAndApply().status'),'ok');
        assert.equal(check.run('S.soulRanks.arcane_mage.stars'),1);
      }
      continuous={seed,steps,upgrade,final:run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,soulRank:S.soulRanks.arcane_mage||null})')};
    }
    return{seed,target,index,slots,before,enemy,result,after,callbacks,saveText:saved};
  }
  assert.equal(after.stone,before.stone);
  assert.equal(after.alert,before.alert);
  assert.equal(run(`S.soulRealmTeam.slots[${index}]`),target);
  return{seed,target,index,slots,before,enemy,result,after,callbacks};
}
const count=Number(process.argv[2]||64);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=512);
const CFG_LIMIT=9;
for(let seed=1;seed<=count;seed++)trials.push(trial(seed));
const win=trials.find(t=>t.result==='win'),summary={batch:mode==='legacy-linear'?'P325':'P326',mode,source,sourceSha256:sha(raw),seeds:`independent xorshift32 seeds 1..${count}; same stream draws nine targets then battle`,
  targetPolicy:'select first normal target when present, else first elite, else first epic',
  count,wins:trials.filter(t=>t.result==='win').length,normalSlots:trials.filter(t=>t.target===540299).length,
  minEnemyHp:Math.min(...trials.map(t=>t.after.enemyHp)),
  selectedWin:win?{seed:win.seed,target:win.target,before:win.before,after:win.after,callbacks:win.callbacks}:null,
  continuous,
  limits:['Independent fixed seeds are conditional tests, not player win rates or a continuous paid route.',
    'This checks the existing P324 formation and equipment, not all legal options or full 50-hour growth.',
    ...(mode==='source-sensitivity'?['Source factor wrapper was a developer-side hypothesis when P326 ran; it is not proof of source combat equivalence.']:[]),
    ...(mode==='legacy-linear'?['The linear wrapper reproduces the P325 historical player rule; current player code now uses source growth factors.']:[])],
  trials:trials.map(({saveText,...rest})=>rest)};
const stem=mode==='legacy-linear'?'p325-soul-nine-slot':'p326-soul-source-growth';
const out=path.join(root,`docs/codex/reports/data/${stem}-paid-check.json`);
fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
if(win){
  const saveOut=path.join(root,`docs/codex/reports/data/${stem}-first-win-save.json`);
  fs.writeFileSync(saveOut,win.saveText);
  summary.selectedWin.saveSha256=sha(win.saveText);
  fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
}
if(continuousSave){
  const saveOut=path.join(root,`docs/codex/reports/data/${stem}-first-star-save.json`);
  fs.writeFileSync(saveOut,continuousSave);
  summary.continuous.saveSha256=sha(continuousSave);
  fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
}
if(intermediateSave){
  const saveOut=path.join(root,'docs/codex/reports/data/p327-soul-source-two-win-save.json');
  fs.writeFileSync(saveOut,intermediateSave);
  summary.continuous.intermediateSaveSha256=sha(intermediateSave);
  summary.continuous.intermediateRng=intermediateRng;
  fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
}
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
console.log(JSON.stringify({count,wins:summary.wins,normalSlots:summary.normalSlots,minEnemyHp:summary.minEnemyHp,selectedWin:summary.selectedWin,continuous:summary.continuous}));
