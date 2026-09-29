'use strict';
// Continue P400's naturally paid 5b research save: invest in a deployed unit
// and verify the shared combat stats in a real material-domain battle.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'docs/codex/reports/data');
const sourceName='p400-armament-natural-route-save.json';
const raw=fs.readFileSync(path.join(dir,sourceName),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceHash=sha(raw);
assert.equal(sourceHash,'368dfa4d10f89469ae71cd2679183333526a7ed92b794fbb6e838dd375035f60');
const source=JSON.parse(raw),env=environment({rts_save:raw}),run=env.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__clockMs=${source.ts};globalThis.__RealDate=Date;
globalThis.Date=class extends __RealDate{
  constructor(...args){super(...(args.length?args:[__clockMs]))}
  static now(){return __clockMs}
};
globalThis.__timers=new Map();globalThis.__nextTimer=1;
globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
globalThis.clearTimeout=id=>__timers.delete(id);
globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
  __timers.delete(first[0]);first[1].fn();return true};
globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296};`);
assert.equal(run("scienceUnlocked('sci_astral_armament')"),true);
const before=run(`({tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,
  starOriginStone:S.items.starOriginStone,atkLevel:S.quantumArmament.star_trooper.atk,
  hpLevel:S.quantumArmament.star_trooper.hp,
  atk:battleMilitaryAttack('star_trooper'),
  hp:battleVitals('star_trooper',7,true).maxHp,
  army:armyCount(),deployed:formSoldierCount(),leaf:S.items.revivalLeaf,
  blood:S.items.sacredBlood,alert:S.killValues.godRebirth})`);
assert.equal(before.atkLevel,0);assert.equal(before.hpLevel,0);
assert.ok(before.steel>=16000&&before.starOriginStone>=20);
const atkPaid=run("upgradeQuantumArmament('star_trooper','atk')");
assert.equal(atkPaid.ok,true,JSON.stringify(atkPaid));
const hpPaid=run("upgradeQuantumArmament('star_trooper','hp')");
assert.equal(hpPaid.ok,true,JSON.stringify(hpPaid));
const afterUpgrade=run(`({tech:S.res.tech,medal:S.res.medal,steel:S.res.steel,
  starOriginStone:S.items.starOriginStone,atkLevel:S.quantumArmament.star_trooper.atk,
  hpLevel:S.quantumArmament.star_trooper.hp,
  atk:battleMilitaryAttack('star_trooper'),
  hp:battleVitals('star_trooper',7,true).maxHp,
  army:armyCount(),deployed:formSoldierCount()})`);
assert.equal(afterUpgrade.tech,before.tech);assert.equal(afterUpgrade.medal,before.medal);
assert.equal(afterUpgrade.steel,before.steel-16000);
assert.equal(afterUpgrade.starOriginStone,before.starOriginStone-20);
assert.equal(afterUpgrade.atkLevel,1);assert.equal(afterUpgrade.hpLevel,1);
assert.ok(afterUpgrade.atk>before.atk);assert.ok(afterUpgrade.hp>before.hp);
const exchange=run('exchangeDomainCleanser(1)');
assert.equal(exchange.ok,true,JSON.stringify(exchange));
assert.notEqual(exchange.repeat,true);
const cleanser=run("useDomainCleanser('revivalLeaf')");
assert.equal(cleanser.ok,true,JSON.stringify(cleanser));
assert.notEqual(cleanser.repeat,true);
const opened=run("openMaterialDomain('revivalLeaf')");
assert.equal(run('S.battleActive'),true,JSON.stringify(opened));
const entry=run(`({star:B.ourUnits.filter(x=>x.type==='star_trooper').map(x=>
    ({count:x.initialCount,atk:x.atk,maxHp:x.maxHp})),
  enemy:B.enemyUnits.map(x=>({type:x.type,count:x.initialCount,hp:x.hp}))})`);
assert.ok(entry.star.length>0);
assert.ok(entry.star.every(x=>x.atk===afterUpgrade.atk&&
  Math.abs(x.maxHp-run(`battleVitals('star_trooper',${x.count},true).maxHp`))<1e-8));
let callbacks=0;
while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
assert.ok(callbacks<10000);
const outcome=run("document.getElementById('battle-result').className");
assert.equal(outcome,'win');
run('exitBattle()');
const afterBattle=run(`({army:armyCount(),deployed:formSoldierCount(),leaf:S.items.revivalLeaf,
  steel:S.res.steel,starOriginStone:S.items.starOriginStone,
  atkLevel:S.quantumArmament.star_trooper.atk,hpLevel:S.quantumArmament.star_trooper.hp})`);
assert.equal(afterBattle.steel,afterUpgrade.steel);
assert.equal(afterBattle.starOriginStone,afterUpgrade.starOriginStone);
assert.equal(run('save().ok'),true);
const finalRaw=env.store.get('rts_save'),reload=environment({rts_save:finalRaw});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.quantumArmament.star_trooper.atk'),1);
assert.equal(reload.run('S.quantumArmament.star_trooper.hp'),1);
assert.equal(reload.run("battleMilitaryAttack('star_trooper')"),afterUpgrade.atk);
assert.equal(reload.run("battleVitals('star_trooper',7,true).maxHp"),afterUpgrade.hp);
assert.equal(sha(fs.readFileSync(path.join(dir,sourceName),'utf8')),sourceHash);
const finalName='p400-armament-natural-invested-save.json';
const report={sourceName,sourceHash,before,atkPaid,hpPaid,afterUpgrade,exchange,cleanser,
  entry,battle:{outcome,callbacks,afterBattle},finalName,finalHash:sha(finalRaw)};
fs.writeFileSync(path.join(dir,finalName),finalRaw);
fs.writeFileSync(path.join(dir,'p400-armament-natural-invested.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
