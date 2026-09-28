'use strict';
// P276: P275首阶实付档补训100星际兵之后的固定流战斗压力。
const fs=require('node:fs');const path=require('node:path');const {environment}=require('../../tests/progression/harness');
const inputFile=process.argv.find(x=>x.startsWith('--input='))?.slice('--input='.length)||'p276-awakening-star-paid-save.json';
const label=process.argv.find(x=>x.startsWith('--label='))?.slice('--label='.length)||'front';
const outputPrefix=process.argv.find(x=>x.startsWith('--output-prefix='))?.slice('--output-prefix='.length)||'p276';
const seed=Number(process.argv.find(x=>x.startsWith('--seed='))?.slice('--seed='.length)||1);
if(!/^[a-z0-9-]+$/.test(label)||!/^[a-z0-9-]+$/.test(outputPrefix)||!Number.isSafeInteger(seed)||seed<1)throw Error('invalid probe arguments');
const input=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data',inputFile),'utf8');
const e=environment({rts_save:input}),run=e.run;if(run('loadSaveAndApply().status')!=='ok')throw Error('load failed');
// P280 因果对照仅覆盖隔离VM内的临时战斗技，输入存档与玩家实现保持原样。
if(process.argv.includes('--disable-star-skill'))run('applyAwakeningOpeningSkills=()=>({defReduced:0,trueDamage:0})');
if(process.argv.includes('--disable-guard-skill'))run('applyEasyTrialGuardAttackSkill=()=>0');
if(process.argv.includes('--disable-trial-attrition'))run('const originalCombatAttackMass=combatAttackMass;combatAttackMass=u=>u.attackMassFallsWithHp?u.attackMass:originalCombatAttackMass(u)');
if(process.argv.includes('--disable-guard-hp-scale'))run('CFG.awakening.combatSkills.easyGuardTrueHit.localHpScale=1');
if(process.argv.includes('--disable-trial-defense'))run('applyTrialGuardDefensePassives=()=>({changed:false})');
if(process.argv.includes('--disable-trial-defense-caps'))run('CFG.awakening.combatSkills.trialGuardDefense.statCapMultiplier=Infinity;CFG.awakening.combatSkills.trialGuardDefense.defenseCapGuardAtkPct=Infinity');
if(process.argv.includes('--disable-trial-defense-body'))run('CFG.awakening.combatSkills.trialGuardDefense.attackFloorPct=0;CFG.awakening.combatSkills.trialGuardDefense.defenseFloorPct=0;CFG.awakening.combatSkills.trialGuardDefense.alliesAttackPerThousand=0');
if(process.argv.includes('--disable-trial-guard-attack-floor'))run('CFG.awakening.combatSkills.trialGuardDefense.attackFloorPct=0');
if(process.argv.includes('--disable-trial-guard-defense-floor'))run('CFG.awakening.combatSkills.trialGuardDefense.defenseFloorPct=0');
run(`Date.now=()=>1790496000000;globalThis.__timers=new Map();globalThis.__timerId=1;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};addLog=m=>S.log.push(String(m));
  globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
function finish(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){if(!run('__step()'))throw Error('timer exhausted');callbacks++}
  if(run('S.battleActive'))throw Error('battle did not finish');return{result:run("document.getElementById('battle-result').className"),callbacks,
    enemyHpLeft:run('B.enemyUnits?.reduce((n,u)=>n+Math.max(0,u.hp),0)??null')};}
const forgeKey=process.argv.find(x=>x.startsWith('--forge='))?.slice('--forge='.length);
let forge=null;
if(forgeKey){
  const before=run(`({state:{...S.weaponForge['${forgeKey}']},items:{...S.items},res:{...S.res}})`);
  const steps=run(`weaponForgeSteps('${forgeKey}')`);
  if(!Number.isSafeInteger(steps)||steps<1||steps>100)throw Error('invalid forge steps');
  for(let i=0;i<steps;i++){
    const result=run(`forgeWeapon('${forgeKey}')`);
    if(!result?.ok)throw Error('forge failed at '+i+': '+JSON.stringify(result));
  }
  forge={key:forgeKey,steps,before,after:run(`({state:{...S.weaponForge['${forgeKey}']},items:{...S.items},res:{...S.res}})`)};
}
const initial=run("({fruit:S.items.trialFruit,alert:S.killValues.godSilence,level:S.awakening.star_trooper.level,soldiers:formSoldierCount(),star:expeditionCount('star_trooper')})");
const maxSteps=Number(process.argv.find(x=>x.startsWith('--max-steps='))?.slice('--max-steps='.length)||80);
if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>80)throw Error('invalid max steps');
const rows=[];
for(let i=0;i<maxSteps;i++){
  const cost=run('S.awakening.star_trooper.level*10+S.formation.front[0]?.count');
  const kind=run('S.items.trialFruit')>=cost?'trial':'fruit';
  if(kind==='trial'){
    const payment=run("openAwakeningTrial('easy')");
    if(!payment.ok){rows.push({step:i+1,kind,error:payment.reason});break}
  }else run("openMaterialDomain('trialFruit')");
  if(!run('S.battleActive')){rows.push({step:i+1,kind,error:'battle-not-open'});break}
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,attackMass:B.enemyUnits[0].attackMass})');
  const result=finish();rows.push({step:i+1,kind,...result,enemy,fruit:run('S.items.trialFruit'),alert:run('S.killValues.godSilence'),
    soldiers:run('formSoldierCount()'),star:run("expeditionCount('star_trooper')"),level:run('S.awakening.star_trooper.level')});
  run('exitBattle()');if(result.result!=='win')break;
  if(kind==='trial'){
    if(!run("expeditionCount('star_trooper')")){rows.at(-1).starLost=true;break}
  }
  if(run('S.awakening.star_trooper.level')>=20)break;
  if(!run('S.formation.front[0]')){rows.at(-1).frontlineDepleted=true;break}
}
const summary={start:initial,seed,forge,steps:rows.length,first:rows[0],last:rows.at(-1),
  wins:rows.filter(r=>r.result==='win').length,trialWins:rows.filter(r=>r.kind==='trial'&&r.result==='win').length};
const expectedResult=process.argv.find(x=>x.startsWith('--expect-last='))?.slice('--expect-last='.length);
const expectedLevel=process.argv.find(x=>x.startsWith('--expect-level='))?.slice('--expect-level='.length);
const expectedEnemyHp=process.argv.find(x=>x.startsWith('--expect-enemy-hp='))?.slice('--expect-enemy-hp='.length);
if(expectedResult&&summary.last?.result!==expectedResult)throw Error(`last result ${summary.last?.result} != ${expectedResult}`);
if(expectedLevel!==undefined&&summary.last?.level!==Number(expectedLevel))throw Error(`last level ${summary.last?.level} != ${expectedLevel}`);
if(expectedEnemyHp!==undefined&&summary.last?.enemyHpLeft!==Number(expectedEnemyHp))throw Error(`enemy HP ${summary.last?.enemyHpLeft} != ${expectedEnemyHp}`);
if(process.argv.some(x=>x==='--save-terminal')){
  if(!run('save().ok'))throw Error('terminal save failed');
  const save=e.store.get('rts_save');
  const filename=`${outputPrefix}-awakening-101star-${label}-terminal-save.json`;
  fs.writeFileSync(path.join(__dirname,'../../docs/codex/reports/data',filename),save,'utf8');
  const restored=environment({rts_save:save});
  if(restored.run('loadSaveAndApply().status')!=='ok')throw Error('terminal reload failed');
  summary.terminalSave=filename;
}
fs.writeFileSync(path.join(__dirname,`../../docs/codex/reports/data/${outputPrefix}-awakening-101star-${label}-pressure.json`),JSON.stringify({summary,rows},null,2));
console.log(JSON.stringify(summary,null,2));
