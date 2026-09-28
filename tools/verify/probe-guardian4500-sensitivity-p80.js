'use strict';
// P80：从同一份实付档复制隔离副本，条件筛选现有装备的下一档等级；不保存条件数据。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const raw=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p79-electric16-paid.json'),'utf8');
const scenarios=[
  ['current',{}],
  ['steamArmor3',{steamArmor:3}],
  ['energyArmor2',{energyArmor:2}],
  ['electroRifle2',{electroRifle:2}],
  ['electroSniper2',{electroSniper:2}],
  ['steamArmor3_energyArmor2',{steamArmor:3,energyArmor:2}],
];
const result=[];
for(const [name,levels] of scenarios){
  const trials=[];
  for(let seed=1;seed<=12;seed++){
    const e=environment({rts_save:raw}),run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    assert.equal(run('S.killValues.godGuardian'),4500);
    run('S.formation.front.forEach((u,i)=>u.count=[55,45,55,55][i])');
    assert.equal(run('armyCount()'),515);
    for(const [key,level] of Object.entries(levels))run(`S.weaponForge.${key}.level=${level}`);
    run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
      globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
      globalThis.clearTimeout=id=>__timers.delete(id);
      globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
      globalThis.__nodes=new Map();document.getElementById=id=>{
        if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
          classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __nodes.get(id)};
      globalThis.addLog=m=>S.log.push(String(m));
      globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
    const before=run('({kill:S.killValues.godGuardian,stone:S.items.guardianStone})');
    run("openMaterialDomain('guardianStone')");
    assert.equal(run('S.battleActive'),true);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);
    const after=run('({kill:S.killValues.godGuardian,stone:S.items.guardianStone,army:armyCount(),round:B.round,enemyHp:B.enemyUnits[0]?.hp})');
    trials.push({seed,win:after.kill>before.kill,round:after.round,armyLost:515-after.army,drop:after.stone-before.stone,enemyHp:after.enemyHp,callbacks});
  }
  const wins=trials.filter(x=>x.win);
  result.push({name,levels,wins:wins.length,best:trials.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp)[0],
    ...(process.argv.includes('--detail')?{trials}:{})});
}
console.log(JSON.stringify({kind:'unpaid 515-soldier conditional sensitivity; no saves or rewards carried forward',unit:'rounds; soldiers; items',result},null,2));
