'use strict';
// P87: 用P86相同的已付款v31档和守御挑战，验证小数伤害修正对十星攻击成长及战损的影响。
// 运行：node tools/verify/probe-iron-arms-fractional-damage-p87.js
// 战斗仅在隔离VM回放；奖励和战损不写回输入快照或用户主档。
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const input=path.join(__dirname,'../../docs/codex/reports/data/p86-iron-arms-ten-star-paid.json');
const priorPath=path.join(__dirname,'../../docs/codex/reports/data/p86-iron-star-guardian-comparison.json');
const output=path.join(__dirname,'../../docs/codex/reports/data/p87-iron-arms-damage-precision.json');
const expectedInputSha='0ed64ed872717188b6ec872b6a5f7b679b793bb41bee2c76770eaca115d07bd5';
const expectedPriorSha='34174c5c18133842e93b30d048a4025d8fe6df427ccc744ef9407007e8f33370';
const inputRaw=fs.readFileSync(input,'utf8');
const inputSha=crypto.createHash('sha256').update(inputRaw).digest('hex');
const priorRaw=fs.readFileSync(priorPath,'utf8');
const priorSha=crypto.createHash('sha256').update(priorRaw).digest('hex');
assert.equal(inputSha,expectedInputSha,'P86付款输入快照发生变化，先复核数据链');
assert.equal(priorSha,expectedPriorSha,'P86旧公式对照数据发生变化，先复核基线');
const prior=JSON.parse(priorRaw);

function guardianTrials(snapshot,starOverride){
  const sourceSave=JSON.parse(snapshot);
  sourceSave.armsUp.iron_spearman.atk.stars=starOverride;
  const trialRaw=JSON.stringify(sourceSave),results=[];
  for(let seed=1;seed<=12;seed++){
    const trial=environment({rts_save:trialRaw}),run=trial.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
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
    const before=run(`({army:armyCount(),iron:weaponAttack('iron_spearman')})`);
    run("openMaterialDomain('guardianStone')");
    assert.equal(run('S.battleActive'),true);
    const ironInitial=run(`(()=>{const u=B.ourUnits.find(x=>x.type==='iron_spearman'),enemyDef=B.enemyUnits[0].def;
      const rawBase=combatAttackMass(u)*u.atk*DAMAGE_COEF*(100/(100+enemyDef*8));
      return{atk:u.atk,row:u.row,attackMass:combatAttackMass(u),enemyDef,rawBase,
        rawWithRandom:[rawBase*0.9,rawBase*1.1]}})()`);
    run(`globalThis.__ironDmg=[];const __realCalcDmg=calcDmg;
      calcDmg=(attacker,defender,isOur)=>{const result=__realCalcDmg(attacker,defender,isOur);
        if(isOur&&attacker.type==='iron_spearman')__ironDmg.push(result.dmg);
        return result};`);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++;}
    assert.equal(run('S.battleActive'),false);
    const after=run(`({kill:S.killValues.godGuardian,army:armyCount(),round:B.round,
      enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0)})`);
    const ironDamage=run('({hits:__ironDmg.length,total:__ironDmg.reduce((a,b)=>a+b,0),max:Math.max(0,...__ironDmg)})');
    results.push({seed,win:after.kill>4500,round:after.round,armyLost:before.army-after.army,
      enemyHp:after.enemyHp,callbacks,ironInitial,ironDamage});
  }
  return results;
}

const source={oneStar:guardianTrials(inputRaw,1),tenStar:guardianTrials(inputRaw,10)};
const old={oneStar:prior.guardian.baseline,tenStar:prior.guardian.withTenStars};
const sum=rows=>({hits:rows.reduce((n,x)=>n+x.ironDamage.hits,0),damage:rows.reduce((n,x)=>n+x.ironDamage.total,0),
  wins:rows.filter(x=>x.win).length,armyLost:rows.reduce((n,x)=>n+x.armyLost,0)});
const report={input:path.basename(input),inputSha256:inputSha,prior:path.basename(priorPath),priorSha256:priorSha,
  currentFormula:'远征／驻军共用结算：保留原整数最低伤害与±3扰动，将取整丢弃的原始小数伤害按出手者累积；累计满1时追加1点普攻伤害。余数仅挂在本场B单位，不写入S／存档。',
  comparison:'同一已付款v31快照，隔离控制铁枪攻击星数1或10，种子1～12；每场奖励与战损均丢弃。旧公式结果取自已哈希固定的P86实战报告。',
  oldFormula:{oneStar:sum(old.oneStar),tenStar:sum(old.tenStar),identicalPairs:old.oneStar.every((x,i)=>x.ironDamage.total===old.tenStar[i].ironDamage.total&&x.enemyHp===old.tenStar[i].enemyHp&&x.armyLost===old.tenStar[i].armyLost)},
  current:{oneStar:sum(source.oneStar),tenStar:sum(source.tenStar),damageNondecreasingEveryPair:source.oneStar.every((x,i)=>source.tenStar[i].ironDamage.total>=x.ironDamage.total),
    increasedSeedCount:source.oneStar.filter((x,i)=>source.tenStar[i].ironDamage.total>x.ironDamage.total).length,
    source},
  finalDamage:{oneStar:source.oneStar.reduce((n,x)=>n+x.ironDamage.total,0),tenStar:source.tenStar.reduce((n,x)=>n+x.ironDamage.total,0)}};
assert.equal(source.oneStar.length,12);
assert.equal(source.tenStar.length,12);
assert.ok(report.current.tenStar.damage>report.current.oneStar.damage,'十星攻击实战总伤必须高于一星');
assert.ok(report.current.damageNondecreasingEveryPair,'固定种子配对中十星攻击不能降低铁枪总伤');
assert.ok(report.current.increasedSeedCount>0,'至少一个固定种子应观察到额外伤害');
const reportRaw=JSON.stringify(report,null,2)+'\n';
fs.writeFileSync(output,reportRaw);
console.log(JSON.stringify({input:report.input,inputSha256:inputSha,report:path.basename(output),
  reportSha256:crypto.createHash('sha256').update(reportRaw).digest('hex'),old:report.oldFormula,
  current:{...report.current,source:undefined},finalDamage:report.finalDamage},null,2));
