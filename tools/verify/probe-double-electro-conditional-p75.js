'use strict';
// 仅开发敏感性：注入45名电磁兵和对应兵坊等级，判断是否值得做实付路线；绝不写回档。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p74-archer-roster-paid.json'),'utf8'));
assert.equal(source.v,29);
assert.equal(source.killValues.godGuardian,4000);
source.buildings.electric_armory.lv=32; // 条件构型，未支付建筑费用
source.pool.electro_trooper=(source.pool.electro_trooper||0)+45; // 条件构型，未支付训练费用
const raw=JSON.stringify(source);
const base={alloy_special:55,armored_trooper:55,gold_cavalry:40,bronze_guard:15,
  iron_spearman:15,silver_heavy:15};
const forms=[
  {name:'double-electro-alloy-armored',front:[['electro_trooper',55],['electro_trooper',45],['alloy_special',55],['armored_trooper',55]]},
  {name:'double-electro-alloy-gold',front:[['electro_trooper',55],['electro_trooper',45],['alloy_special',55],['gold_cavalry',40]]},
  {name:'double-electro-armored-gold',front:[['electro_trooper',55],['electro_trooper',45],['armored_trooper',55],['gold_cavalry',40]]}
];
function place(env,row,type,count,slot){
  const run=env.run;
  assert.ok(run(`S.pool.${type}`)>=count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}.some(u=>u.type==='${type}'&&u.count===${count})`),true);
}
const results=[];
for(const f of forms)for(let seed=1;seed<=12;seed++){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('armyCount()'),515);
  assert.ok(run("unitCap('electro_trooper')")>=100);
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    clrForm('expedition');`);
  f.front.forEach(([type,count],i)=>place(e,'front',type,count,i));
  Object.entries(base).filter(([type])=>!f.front.some(([t])=>t===type)).forEach(([type,count],i)=>place(e,'mid',type,count,i));
  for(let i=0;i<4;i++)place(e,'back','archer',55,i);
  assert.equal(run('armyCount()'),515);
  const before=run('S.killValues.godGuardian');
  run("openMaterialDomain('guardianStone')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++;}
  assert.equal(run('S.battleActive'),false);
  const after=run('({round:B.round,hp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  results.push({form:f.name,seed,win:after.kill>before,round:after.round,
    enemyHp:after.hp,armyAfter:after.army,callbacks});
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({mode:'conditional-unpaid',unit:'battle rounds; soldiers',attempted:results.length,
  wins:results.filter(x=>x.win).length,best:ranked.slice(0,8),worst:ranked.at(-1),results},null,2));
