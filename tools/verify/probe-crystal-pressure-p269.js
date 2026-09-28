'use strict';
// Conditional combat sensitivity from the paid P268 save; each pressure/seed starts afresh.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p268-nuclear-capacity-buildings-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const fillRoster=process.argv.includes('--fill-roster');
if(process.argv.includes('--inspect')){
  const e=environment({rts_save:raw});assert.equal(e.run('loadSaveAndApply().status'),'ok');
  console.log(JSON.stringify(e.run("({army:armyCount(),food:S.res.food,foodCap:resCap('food'),stone:S.res.stone,stoneCap:resCap('stone'),coal:S.res.coal,coalCap:resCap('coal'),copper:S.res.copper,copperCap:resCap('copper'),iron:S.res.iron,ironCap:resCap('iron'),steel:S.res.steel,steelCap:resCap('steel'),netFood:prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost})")));
  process.exit(0);
}
const pressures=[4000,4100,4200,4300,4400,4500,4600,4700,4800,4900,5000];
const rows=[];
for(const pressure of pressures)for(let seed=1;seed<=16;seed++){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
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
    S.killValues.godRevival=${pressure};`);
  if(fillRoster){
    // Conditional ceiling only: extra soldiers are neither trained nor paid here.
    const added=run(`(()=>{let n=0;for(const type of ['electro_trooper','alloy_special','armored_trooper','gold_cavalry']){
      const row=CFG.units[type].row;
      let owned=0;for(const r of ['front','mid','back'])for(const unit of S.formation[r])if(unit.type===type)owned+=unit.count;
      let left=unitCap(type)-owned;
      for(const unit of S.formation[row])if(unit.type===type&&left>0){
        const add=Math.min(left,regMax()-unit.count);unit.count+=add;left-=add;n+=add;
      }
      if(left>0&&S.formation[row].length<rowSlots(row))throw Error('unexpected unused formation slot for '+type);
    }return n})()`);
    assert.equal(added,79);
  }
  const before=run('({army:armyCount(),crystal:S.items.godCrystal,tick:S.tick})');
  run("openMaterialDomain('godCrystal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const after=run('({army:armyCount(),crystal:S.items.godCrystal,tick:S.tick,kill:S.killValues.godRevival,round:B.round,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})');
  const win=run("document.getElementById('battle-result').className")==='win';
  assert.equal(after.tick,before.tick);
  assert.equal(after.kill,pressure+(win?100:0));
  rows.push({pressure,seed,win,round:after.round,loss:before.army-after.army,drop:after.crystal-before.crystal,remainingEnemyHp:after.enemyHp,callbacks});
}
const summary=pressures.map(pressure=>{
  const entries=rows.filter(row=>row.pressure===pressure),wins=entries.filter(row=>row.win);
  return{pressure,wins:wins.length,of:entries.length,meanWinLoss:wins.length?wins.reduce((n,row)=>n+row.loss,0)/wins.length:null,
    materialPerWin:wins.length?wins[0].drop:0,minEnemyHp:Math.min(...entries.map(row=>row.remainingEnemyHp))};
});
const report={batch:'P269',sourceFile,sourceSha256:sha(raw),unit:'soldiers, material units and alert points',method:fillRoster?'isolated conditional 516-soldier combats; 79 untrained/unpaid extra soldiers, each pressure conditionally set':'isolated current-strength single combats; each pressure is conditionally set, no continuous recovery or payment',summary,rows};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/p269-crystal-pressure${fillRoster?'-conditional-full-roster':''}.json`),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,summary}));
