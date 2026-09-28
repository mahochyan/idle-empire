'use strict';
// Legal formation-action sweep from one paid equipment checkpoint, fixed RNG.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input=process.argv.find(x=>x.startsWith('--input='))?.slice('--input='.length)||'p277-awakening-steam3-energy2-paid-save.json';
const label=process.argv.find(x=>x.startsWith('--label='))?.slice('--label='.length)||'steam3-energy2';
assert.match(input,/^p277-awakening-[a-z0-9-]+\.json$/);
assert.match(label,/^[a-z0-9-]+$/);
const source='docs/codex/reports/data/'+input;
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const save=JSON.parse(raw);
const front=save.formation.front.map(u=>({type:u.type,count:u.count}));
const mid=save.formation.mid.map(u=>({type:u.type,count:u.count}));
const reserve=process.argv.find(x=>x.startsWith('--reserve='))?.slice('--reserve='.length)||'bronze_guard';
const seed=Number(process.argv.find(x=>x.startsWith('--seed='))?.slice('--seed='.length)||1);
assert.ok(['bronze_guard','iron_spearman','silver_heavy'].includes(reserve));
assert.ok(Number.isSafeInteger(seed)&&seed>=1);
mid[3]={type:reserve,count:15};
assert.deepEqual(front,[{type:'electro_trooper',count:55},{type:'electro_trooper',count:46},{type:'alloy_special',count:55},{type:'armored_trooper',count:55}]);
function permutations(xs){if(!xs.length)return[[]];return xs.flatMap((v,i)=>permutations([...xs.slice(0,i),...xs.slice(i+1)]).map(t=>[v,...t]));}
const midSweep=process.argv.includes('--mid-sweep');
const fullSweep=process.argv.includes('--full-sweep');
const single=process.argv.includes('--single');
const sweepName=single?'single':fullSweep?'full':midSweep?'mid':'front';
const frontOrders=permutations([0,1,2,3]);
const midOrders=permutations([0,1,2,3]);
const variants=single?[{order:[0,3,1,2],midOrder:[2,1,3,0]}]:
  fullSweep?frontOrders.flatMap(order=>midOrders.map(midOrder=>({order,midOrder}))):
  midSweep?midOrders.map(midOrder=>({order:[0,3,1,2],midOrder})):
  frontOrders.map(order=>({order,midOrder:[0,1,2,3]}));
const results=[];
let savedWins=0;
for(const {order,midOrder} of variants){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${save.ts}}};
    globalThis.__timers=new Map();globalThis.__id=1;setTimeout=fn=>{const id=__id++;__timers.set(id,fn);return id};
    clearTimeout=id=>__timers.delete(id);globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run("clrForm('expedition')");
  const target={front:order.map(i=>front[i]),mid:midOrder.map(i=>mid[i]),back:save.formation.back};
  for(const [row,groups]of Object.entries(target))groups.forEach((u,i)=>{
    assert.ok(run(`poolAvail('${u.type}')`)>=u.count);
    run(`openFormModal('expedition','${row}',${i});S._formModalSel='${u.type}';S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${i}]?.count`),u.count);
  });
  assert.equal(run('armyCount()'),617);
  assert.equal(run('formSoldierCount()'),587);
  assert.equal(run('save().ok'),true);
  function finish(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);return{result:run("document.getElementById('battle-result').className"),
      enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),callbacks};}
  run("openMaterialDomain('trialFruit')");
  assert.equal(run('S.battleActive'),true);
  const fruitFight=finish();run('exitBattle()');
  if(fruitFight.result!=='win'){results.push({order,midOrder,fruitFight});continue;}
  const payment=run("openAwakeningTrial('easy')");
  assert.equal(payment?.ok,true);
  const trial=finish();run('exitBattle()');
  const result={order,midOrder,first:front[order[0]],payment,fruitFight,trial,level:run('S.awakening.star_trooper.level'),
    soldiers:run('formSoldierCount()'),star:run("expeditionCount('star_trooper')")};
  if(trial.result==='win'){
    assert.equal(result.level,5);
    result.starLost=result.star===0;
    if(savedWins<3&&(!single||process.argv.includes('--save-terminal'))){
      assert.equal(run('save().ok'),true);
      const terminal=e.store.get('rts_save');
      const file=`docs/codex/reports/data/p277-awakening-${label}-${sweepName}-seed${seed}-${order.join('')}-${midOrder.join('')}-level5-win-save.json`;
      fs.writeFileSync(path.join(root,file),terminal,'utf8');
      const reload=environment({rts_save:terminal});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
      assert.equal(reload.run('S.awakening.star_trooper.level'),5);
      result.terminal={file,sha256:sha(terminal)};
      savedWins++;
    }
  }
  results.push(result);
}
assert.equal(results.length,variants.length);
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const wins=results.filter(x=>x.trial?.result==='win');
const summary={source,sourceSha256:sha(raw),unit:'resource items, soldiers, combat HP',midSweep,fullSweep,single,seed,reserve,tested:results.length,wins:wins.length,
  best:results.filter(x=>x.trial).sort((a,b)=>a.trial.enemyHpLeft-b.trial.enemyHpLeft).slice(0,5),
  worst:results.filter(x=>x.trial).sort((a,b)=>b.trial.enemyHpLeft-a.trial.enemyHpLeft)[0],results};
fs.writeFileSync(path.join(root,`docs/codex/reports/data/p277-awakening-${label}-${sweepName}-order-${reserve}${single?'-seed'+seed:''}.json`),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify({tested:summary.tested,wins:summary.wins,best:summary.best.map(x=>({order:x.order,midOrder:x.midOrder,first:x.first,trial:x.trial,level:x.level,soldiers:x.soldiers,star:x.star,terminal:x.terminal})),worst:summary.worst?.trial},null,2));
