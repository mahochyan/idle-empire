'use strict';
// Independent real battles at the P338 paid checkpoint. Rewards never merge between seeds.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const source=JSON.parse(raw);
const count=Number(process.argv[2]||64);
assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=256);
const keys=['bone','bullHorn','snakeGall','tigerPelt','turtleShell','wyrmSinew'];
const selected=process.argv[3]?process.argv[3].split(','):keys;
assert.ok(selected.length&&selected.every(key=>keys.includes(key)));
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
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});return __nodes.get(id)};
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=r(`({army:armyCount(),deployed:formSoldierCount(),bone:S.res.bone,
    material:S.items[${JSON.stringify(key==='bone'?'boarHeart':key)}],
    alert:S.killValues[specialEncounterConfig(${JSON.stringify(key)}).killValueKey]})`);
  r(`openMaterialDomain(${JSON.stringify(key)})`);
  assert.equal(r('S.battleActive'),true,key+' must start');
  const enemy=r('({hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,amount:B.enemyUnits[0].initialCount})');
  let callbacks=0;
  while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true,key+' timers');
  assert.ok(callbacks<3000,key+' callback bound');
  const result=r("document.getElementById('battle-result').className");
  const after=r(`({army:armyCount(),deployed:formSoldierCount(),bone:S.res.bone,
    material:S.items[${JSON.stringify(key==='bone'?'boarHeart':key)}],
    alert:S.killValues[specialEncounterConfig(${JSON.stringify(key)}).killValueKey]})`);
  assert.ok(['win','lose','timeout'].includes(result));
  if(result!=='win'){
    assert.equal(after.bone,before.bone);
    assert.equal(after.material,before.material);
  }
  assert.ok(after.army<=before.army);
  return{key,seed,result,before,enemy,after,callbacks};
}
const trials=[];
for(const key of selected)for(let seed=1;seed<=count;seed++)trials.push(trial(key,seed));
const summary=selected.map(key=>{
  const rows=trials.filter(x=>x.key===key),wins=rows.filter(x=>x.result==='win');
  const median=a=>{if(!a.length)return null;a.sort((x,y)=>x-y);
    return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
  return{key,alert:rows[0].before.alert,enemy:rows[0].enemy,
    tested:rows.length,wins:wins.length,winSeeds:wins.map(x=>x.seed),
    medianSoldierLoss:median(wins.map(x=>x.before.army-x.after.army)),
    bonePerWin:wins[0]?wins[0].after.bone-wins[0].before.bone:0,
    materialPerWin:wins[0]?wins[0].after.material-wins[0].before.material:0};
});
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const out='docs/codex/reports/data/p341-beast-exchange-wild-supply.json';
fs.writeFileSync(path.join(root,out),JSON.stringify({sourceFile,sourceSha256,
  unit:'one real battle, soldiers and resources; independent xorshift seeds',
  seeds:`1..${count}`,summary,trials,limits:[
    'Independent conditional battles do not merge rewards, pay for roster recovery, or model rising alert.',
    'These samples are not a player win rate or proof of repeatable supply.']},null,2)+'\n');
console.log(JSON.stringify({sourceFile,sourceSha256,summary,out},null,2));
