'use strict';
// 对同一实付305人战前档逐个合法调阵，固定种子筛选守御4000，不注入属性或材料。
// node tools/verify/probe-guardian-formation-p74.js [--limit=840] [--seed=9]
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const raw=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p74-guardian4000-roster-paid.json'),'utf8');
const limitArg=process.argv.find(x=>x.startsWith('--limit='));
const limit=limitArg?Number(limitArg.slice('--limit='.length)):840;
const seedArg=process.argv.find(x=>x.startsWith('--seed='));
const seed=seedArg?Number(seedArg.slice('--seed='.length)):9;
assert.ok(Number.isSafeInteger(limit)&&limit>=1&&limit<=840);
assert.ok(Number.isSafeInteger(seed)&&seed>=1&&seed<=0xffffffff);
const e=environment({rts_save:raw});
const run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('armyCount()'),305);
assert.equal(run('S.killValues.godGuardian'),4000);
assert.equal(run('formSlots()'),12);
const troops=[['alloy_special',55],['armored_trooper',55],['electro_trooper',55],
  ['gold_cavalry',40],['bronze_guard',15],['iron_spearman',15],['silver_heavy',15]];
const rows=[];
const permutations=[];
function permute(prefix,remaining){
  if(prefix.length===4){permutations.push(prefix);return;}
  for(const troop of remaining)permute([...prefix,troop],remaining.filter(x=>x!==troop));
}
permute([],troops.map(x=>x[0]));
assert.equal(permutations.length,840);
function place(row,type,count,slot){
  assert.ok(run(`S.pool.${type}`)>=count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
for(const front of permutations.slice(0,limit)){
  e.store.set('rts_save',raw);
  assert.equal(run('loadSaveAndApply().status'),'ok');
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    clrForm('expedition');`);
  front.forEach((type,i)=>place('front',type,troops.find(x=>x[0]===type)[1],i));
  troops.filter(x=>!front.includes(x[0])).forEach(([type,count],i)=>place('mid',type,count,i));
  place('back','archer',55,0);
  assert.equal(run('S.formation.front.length'),4);
  assert.equal(run('S.formation.mid.length'),3);
  assert.equal(run('armyCount()'),305);
  const before=run('S.killValues.godGuardian');
  run("openMaterialDomain('guardianStone')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++;}
  assert.equal(run('S.battleActive'),false);
  const result=run('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  rows.push({front,mid:troops.filter(x=>!front.includes(x[0])).map(x=>x[0]),win:result.kill>before,
    round:result.round,enemyHp:result.enemyHp,armyAfter:result.army,stone:result.stone,callbacks});
  run('exitBattle()');
}
const ranked=rows.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'battle rounds; soldiers; fixed xorshift seed',seed,attempted:rows.length,
  wins:rows.filter(r=>r.win).length,best:ranked.slice(0,12),worst:ranked.at(-1),
  baseline:rows.find(r=>r.front.join(',')==='alloy_special,armored_trooper,electro_trooper,gold_cavalry')},null,2));
