'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const input=path.join(__dirname,'../../docs/codex/reports/data/p83-six-era-arms-first-invest-paid.json');
const output=path.join(__dirname,'../../docs/codex/reports/data/p84-iron-arms-first-star-paid.json');
const reportPath=path.join(__dirname,'../../docs/codex/reports/data/p84-iron-star-guardian-comparison.json');
const raw=fs.readFileSync(input,'utf8');
const e=environment({rts_save:raw});
assert.equal(e.run('loadSaveAndApply().status'),'ok');
// Fix only the isolated probe clock so the paid snapshot and formation IDs are reproducible.
e.run(`Date.now=()=>${JSON.parse(raw).ts+1000}`);
const before=JSON.parse(e.run(`JSON.stringify({tick:S.tick,iron:S.res.iron,population:S.population.current,
  army:armyCount(),enemy:S.killValues.godGuardian,atk:weaponAttack('iron_spearman'),
  arms:S.armsUp.iron_spearman.atk})`));
assert.equal(before.arms.progress,1);
assert.equal(before.arms.stars,0);
assert.equal(before.enemy,4500);
assert.ok(before.iron>=999000);
const payment=e.run("investArmsUp('iron_spearman','atk',999)");
assert.equal(payment.ok,true);
assert.equal(payment.cost,999000);
assert.equal(payment.stars,1);
assert.equal(payment.progress,0);
const paidOnly=e.store.get('rts_save');
function reformIronFront(env){
  const run=env.run;
  assert.equal(run("S.formation.front[2].type"),'alloy_special');
  assert.equal(run("S.formation.mid[2].type"),'iron_spearman');
  run("removeFormSlot('expedition','front',2)");
  run("removeFormSlot('expedition','mid',2)");
  run("openFormModal('expedition','front',3);S._formModalSel='iron_spearman';S._formModalQty=15;confirmForm()");
  run("openFormModal('expedition','mid',3);S._formModalSel='alloy_special';S._formModalQty=17;confirmForm()");
  assert.equal(run("S.formation.front[3].type"),'iron_spearman');
  assert.equal(run("S.formation.mid[3].type"),'alloy_special');
  assert.equal(run('armyCount()'),437);
  assert.equal(run('save().ok'),true);
}
reformIronFront(e);
const after=JSON.parse(e.run(`JSON.stringify({tick:S.tick,iron:S.res.iron,population:S.population.current,
  army:armyCount(),enemy:S.killValues.godGuardian,atk:weaponAttack('iron_spearman'),
  arms:S.armsUp.iron_spearman.atk,electro:S.armsUp.electro_trooper.atk,
  front:S.formation.front.map(u=>({type:u.type,count:u.count}))})`));
assert.equal(before.iron-after.iron,999000);
assert.equal(after.atk,before.atk+1);
assert.equal(after.tick,before.tick);
assert.equal(after.population,before.population);
assert.equal(after.army,before.army);
assert.equal(after.enemy,before.enemy);
assert.deepEqual(after.electro,{stars:0,progress:1});
const saved=e.store.get('rts_save');
const reload=environment({rts_save:saved});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.armsUp.iron_spearman.atk.stars'),1);
assert.equal(reload.run('S.armsUp.iron_spearman.atk.progress'),0);
assert.equal(reload.run('S.res.iron'),after.iron);
assert.equal(reload.run("S.formation.front[3].type"),'iron_spearman');

// Every trial starts from its own copy; outcomes and rewards are discarded.
function guardianTrials(snapshot,reform=false){
  const trials=[];
  for(let seed=1;seed<=12;seed++){
    const trial=environment({rts_save:snapshot}),run=trial.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    if(reform)reformIronFront(trial);
    assert.equal(run('armyCount()'),437);
    assert.equal(run('S.killValues.godGuardian'),4500);
    run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
      globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
      globalThis.clearTimeout=id=>__timers.delete(id);
      globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
      globalThis.__nodes=new Map();document.getElementById=id=>{
        if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
          classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __nodes.get(id)};
      globalThis.addLog=m=>S.log.push(String(m));
      globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
    const start=run('({army:armyCount(),stone:S.items.guardianStone})');
    run("openMaterialDomain('guardianStone')");
    assert.equal(run('S.battleActive'),true);
    const ironInitial=run("({atk:B.ourUnits.find(u=>u.type==='iron_spearman').atk,row:B.ourUnits.find(u=>u.type==='iron_spearman').row,enemyDef:B.enemyUnits[0].def})");
    run(`globalThis.__ironDmg=[];const __realCalcDmg=calcDmg;
      calcDmg=(attacker,defender,isOur)=>{const result=__realCalcDmg(attacker,defender,isOur);
        if(isOur&&attacker.type==='iron_spearman')__ironDmg.push(result.dmg);
        return result};`);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);
    const end=run('({kill:S.killValues.godGuardian,stone:S.items.guardianStone,army:armyCount(),round:B.round,enemyHp:B.enemyUnits[0]?.hp})');
    trials.push({seed,win:end.kill>4500,round:end.round,armyLost:start.army-end.army,
      stoneGained:end.stone-start.stone,enemyHp:end.enemyHp,callbacks,ironInitial,
      ironDamage:run('({hits:__ironDmg.length,total:__ironDmg.reduce((a,b)=>a+b,0),max:Math.max(0,...__ironDmg)})')});
  }
  return trials;
}
const baseline=guardianTrials(raw),withStar=guardianTrials(paidOnly);
const baselineReformed=guardianTrials(raw,true),withStarReformed=guardianTrials(saved);
fs.writeFileSync(output,saved);
const report={input:path.basename(input),inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),
  before,after,payment,output:path.basename(output),outputSha256:crypto.createHash('sha256').update(saved).digest('hex'),
  reload:'ok',guardian:{kind:'isolated real 437-soldier battles; no conditional troops or rewards carried',
    baselineWins:baseline.filter(x=>x.win).length,withStarWins:withStar.filter(x=>x.win).length,
    baselineReformedWins:baselineReformed.filter(x=>x.win).length,
    withStarReformedWins:withStarReformed.filter(x=>x.win).length,
    baseline,withStar,baselineReformed,withStarReformed}};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({input:report.input,payment,after,output:report.output,outputSha256:report.outputSha256,
  report:path.basename(reportPath),wins:[report.guardian.baselineWins,report.guardian.withStarWins,
    report.guardian.baselineReformedWins,report.guardian.withStarReformedWins],
  reformedEnemyHp:{baseline:baselineReformed.map(x=>x.enemyHp),withStar:withStarReformed.map(x=>x.enemyHp)}},null,2));
