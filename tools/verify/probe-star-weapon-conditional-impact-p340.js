'use strict';
// Unpaid gear sensitivity only. Starts every battle from the same real P338 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sourceFile=data+'p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=JSON.parse(raw),count=Number(process.argv[2]||32);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=128);
const scenarios=[{name:'baseline',weapons:[]},{name:'fighter',weapons:['starFighter']},
  {name:'fighter-missile',weapons:['starFighter','starMissile']}];
const keys=['medal','godCrystal'];
function trial(key,scenario,seed){
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
  for(const weapon of scenario.weapons)r(`S.weaponForge.${weapon}={researched:true,level:1,progress:0,equipped:true}`);
  const stat=r('({starAtk:weaponAttack("star_trooper"),starSkills:equippedWeaponSkills("star_trooper")})');
  const before=r('({army:armyCount(),medal:S.res.medal,core:S.items.godCore})');
  r(`openMaterialDomain('${key}')`);assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,count:B.enemyUnits[0].initialCount})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className");
  const after=r('({army:armyCount(),medal:S.res.medal,core:S.items.godCore,enemyHp:B.enemyUnits[0].hp})');
  return{key,scenario:scenario.name,seed,stat,before,enemy,result,after,callbacks};
}
const trials=[];for(const key of keys)for(const scenario of scenarios)for(let seed=1;seed<=count;seed++)trials.push(trial(key,scenario,seed));
const summary=[];for(const key of keys)for(const scenario of scenarios){const rows=trials.filter(x=>x.key===key&&x.scenario===scenario.name);
  const wins=rows.filter(x=>x.result==='win'),left=rows.map(x=>x.after.enemyHp).sort((a,b)=>a-b);
  summary.push({key,scenario:scenario.name,stat:rows[0].stat,tested:rows.length,wins:wins.length,
    firstWinSeed:wins[0]?.seed??null,minEnemyHp:left[0],medianEnemyHp:left[Math.floor(left.length/2)],
    medianLoss:wins.length?wins.map(x=>x.before.army-x.after.army).sort((a,b)=>a-b)[Math.floor(wins.length/2)]:null});
}
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const out=data+'p340-star-weapon-conditional-impact.json';
fs.writeFileSync(path.join(root,out),JSON.stringify({sourceFile,sourceSha256:sha(raw),seeds:`independent xorshift32 1..${count}`,
  unit:'one battle, soldiers, HP; gear is unearned in memory',summary,trials,
  limits:['New weapons were injected conditionally; no research, forge or equip payment occurred.',
    'Fixed independent seeds are combat sensitivity, not player win-rate estimates.']},null,2)+'\n');
console.log(JSON.stringify({sourceFile,sourceSha256:sha(raw),summary,out},null,2));
