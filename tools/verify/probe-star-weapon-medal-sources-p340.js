'use strict';
// Independent conditional battles from one P338 paid checkpoint. No rewards are merged.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=JSON.parse(raw),count=Number(process.argv[2]||16);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=256);
const allKeys=['medal','godCrystal','phantomFlower','guardianStone','revivalLeaf','trialFruit','turtleShell','snakeGall'];
const keys=process.argv[3]?process.argv[3].split(','):allKeys;
assert.ok(keys.length>0&&keys.every(key=>allKeys.includes(key)));
function trial(key,seed){
  const e=environment({rts_save:raw}),r=e.run;
  assert.ok(['ok','migrated'].includes(r('loadSaveAndApply().status')));
  r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${source.ts}+(S.tick-${source.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const opening=r(`({army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal,core:S.items.godCore,
    bone:S.res.bone,alert:S.killValues[specialEncounterConfig('${key}').killValueKey||'godRevival']||0})`);
  r(`openMaterialDomain('${key}')`);assert.equal(r('S.battleActive'),true,key+' must start');
  const enemy=r('({hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,amount:B.enemyUnits[0].initialCount})');
  const reward=r('({reward:B.enemyCfg.reward,bonusReward:B.enemyCfg.bonusReward,bonusItemReward:B.enemyCfg.bonusItemReward})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true,key+' timers');
  assert.ok(callbacks<3000,key+' callback bound');
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal,core:S.items.godCore,bone:S.res.bone,enemyHp:B.enemyUnits.reduce((n,u)=>n+u.hp,0)})');
  assert.ok(['win','lose','timeout'].includes(result),key+' result');
  if(result!=='win'){
    assert.equal(after.medal,opening.medal);assert.equal(after.core,opening.core);
  }
  assert.ok(after.army<=opening.army,'battle cannot create permanent soldiers');
  return{key,seed,result,opening,enemy,reward,after,callbacks};
}
const trials=[];for(const key of keys)for(let seed=1;seed<=count;seed++)trials.push(trial(key,seed));
const summary=keys.map(key=>{const rows=trials.filter(x=>x.key===key),wins=rows.filter(x=>x.result==='win');
  return{key,enemy:rows[0].enemy,reward:rows[0].reward,tested:rows.length,wins:wins.length,
    firstWinSeed:wins[0]?.seed??null,medianLoss:wins.length?wins.map(x=>x.opening.army-x.after.army).sort((a,b)=>a-b)[Math.floor(wins.length/2)]:null,
    medalPerWin:wins[0]?wins[0].after.medal-wins[0].opening.medal:0,
    corePerWin:wins[0]?wins[0].after.core-wins[0].opening.core:0,
    bonePerWin:wins[0]?wins[0].after.bone-wins[0].opening.bone:0};});
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const out='docs/codex/reports/data/'+(keys.length===allKeys.length?'p340-star-weapon-medal-sources':'p340-star-weapon-medal-bosses-256')+'.json';
fs.writeFileSync(path.join(root,out),JSON.stringify({sourceFile,sourceSha256:sha(raw),
  unit:'one real battle, soldiers and resource units; independent xorshift seeds',seeds:`1..${count}`,
  summary,trials,limits:['Independent conditional battles do not merge rewards or pay for roster recovery.',
    'These samples are not player win rates or proof of long-term medal income.']},null,2)+'\n');
console.log(JSON.stringify({sourceFile,sourceSha256:sha(raw),summary,out},null,2));
