'use strict';
// P329: 对警戒5450已付满编档做成对固定种子战斗，仅比较英魂群体出手是否随剩余生命减少。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const stage=process.argv[3]||'first-elite';
const cases={
  'first-elite':{file:'p328-soul-normal-3-save.json',sha:'3a70475cdd16e536d86647ba95c72227eb3f827ce6e52899271fae7168831f31',alert:5450,stone:18,report:'p329-soul-attrition-sensitivity.json'},
  'next-team':{file:'p329-soul-refreshed-save.json',sha:'9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd',alert:6050,stone:39,report:'p329-soul-next-team-sensitivity.json'}
};
assert.ok(Object.prototype.hasOwnProperty.call(cases,stage));
const selected=cases[stage],sourceFile='docs/codex/reports/data/'+selected.file;
const source=fs.readFileSync(path.join(root,sourceFile),'utf8');
assert.equal(sha(source),selected.sha);
const refFile='210(1)_unpacked/_analysis/deob_main.js',reference=fs.readFileSync(path.join(root,refFile),'utf8');
assert.equal(sha(reference),'b0bc24d680517c592e8bd123148814f4f9ee24c53ddb0db8165294e131b563c4');
for(const marker of ['getMonsterData_general','this["monsterNum"][_0x2585e2]-=0x1',"_0x447ae8['monsterDeath']++"])
  assert.ok(reference.includes(marker),marker);
const origin=JSON.parse(source),slot=origin.soulRealmTeam.slots.indexOf(540399);
assert.ok(slot>=0);assert.equal(origin.killValues.soulRealm,selected.alert);assert.equal(origin.items.soulStone,selected.stone);
const count=Number(process.argv[2]||128);assert.ok(Number.isSafeInteger(count)&&count>=1&&count<=512);
function one(seed,mode){
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
    addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run(`globalThis.__baseSoulEncounter=materialDomainEncounter;
    materialDomainEncounter=function(key,alert=null,tierId=null){const e=__baseSoulEncounter(key,alert,tierId);
      if(key==='soulStone'&&e)e.attackMassFallsWithHp=${mode==='attrition'};return e};`);
  assert.equal(run(`openSoulRealmSlot(${slot}).ok`),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,entryMass:B.enemyUnits[0].attackMass,attrition:B.enemyUnits[0].attackMassFallsWithHp})');
  assert.equal(enemy.attrition,mode==='attrition');
  let callbacks=0;while(run('S.battleActive')&&callbacks++<3000)assert.equal(run('__step()'),true);
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");assert.ok(['win','lose'].includes(result));
  const after=run('({army:armyCount(),deployed:formSoldierCount(),stone:S.items.soulStone,alert:S.killValues.soulRealm,enemyHp:B.enemyUnits[0].hp,slot:S.soulRealmTeam.slots['+slot+']})');
  if(result==='win'){assert.equal(after.alert,selected.alert+200);assert.ok(after.stone>selected.stone);assert.equal(after.slot,null)}
  else{assert.equal(after.alert,selected.alert);assert.equal(after.stone,selected.stone);assert.equal(after.slot,540399)}
  run('exitBattle()');
  return{seed,mode,enemy,result,after,callbacks,rngEnd:run('__rng')};
}
const trials=[];for(let seed=1;seed<=count;seed++)for(const mode of ['fixed','attrition'])trials.push(one(seed,mode));
const summary=['fixed','attrition'].map(mode=>{
  const rows=trials.filter(x=>x.mode===mode),wins=rows.filter(x=>x.result==='win'),losses=rows.filter(x=>x.result==='lose');
  const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  return{mode,tested:rows.length,wins:wins.length,losses:losses.length,
    medianWinCasualties:median(wins.map(x=>672-x.after.army)),medianLossEnemyHp:median(losses.map(x=>x.after.enemyHp)),
    firstWinSeed:wins[0]?.seed??null};
});
const report={batch:'P329',stage,kind:'paired initial seeds, real current combat with developer-side soul-only enemy attrition switch',
  sourceFile,sourceSha256:sha(source),referenceFile:refFile,referenceSha256:sha(reference),
  sourceEvidence:['getMonsterData_general returns both per-monster HP and Amount.',
    'The mother battle instantiates Amount individual monster units into Team2 and decrements monster count as those instances enter battle.',
    'A dead monster is removed from its battle team and increments monsterDeath; it cannot continue attacking.'],
  unit:'battle callbacks, soldiers, one aggregate enemy HP and soul-stone items',summary,trials,
  limits:['The source uses individual monster units; remaining-HP scaling is a local aggregate approximation, not exact source combat.',
    'Each fixed seed starts from the same paid save independently; this is not a continuous paid resource route or a population win rate.',
    'No player code, save or reward was changed by this probe.']};
const reportFile='docs/codex/reports/data/'+selected.report;
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(source));
console.log(JSON.stringify({summary,reportFile},null,2));
