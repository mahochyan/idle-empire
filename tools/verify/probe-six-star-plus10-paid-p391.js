'use strict';
// Spend actual materials to fill the ten free places in the current 12 groups.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p391-steam-military-six-star-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'6a6150b11c74f19933c235092993bebe5ebcc59404df1d809cfda031d4845bda');
const NativeDate=Date,now=JSON.parse(raw).ts;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[now]));}
  static now(){return now;}
};
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
run(`globalThis.__rng=391;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
  __rng=x>>>0;return __rng/4294967296}`);
const initial=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  field:steamMilitaryFieldSize(),stars:S.steamMilitaryStars,res:{...S.res},
  items:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore}})`);
assert.equal(initial.stars,6);
assert.equal(initial.deployed,626);
const val=k=>run(`S.res.${k}`),cap=k=>run(`resCap('${k}')`);
let seconds=0,minFood=initial.res.food,phase='none';
const phases={stone:0,coal:0,copper:0,iron:0,steel:0,training:0};
function assign(resource){
  for(const [k,n]of Object.entries(run('({...S.popAlloc})')))
    if(n>0)assert.equal(run(`setPopAlloc('${k}',0)`)?.ok,true,k);
  assert.equal(run("setPopAlloc('food',100)")?.ok,true);
  assert.equal(run(`setPopAlloc('${resource}',902)`)?.ok,true);
  phase=resource;
}
function advanceUntil(expression,max,stop='false'){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${expression})&&!(${stop})&&n<${max}){
    tick();n++;min=Math.min(min,S.res.food)}return{n,min,done:!!(${expression})}})()`);
  seconds+=x.n;minFood=Math.min(minFood,x.min);phases[phase]+=x.n;
  assert.ok(x.min>0);return x;
}
function fillBasic(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource));
  assign(resource);
  assert.ok(advanceUntil(`S.res.${resource}>=${amount}`,10000).done,resource+' timeout');
}
function fillProcessed(resource,amount){
  if(val(resource)>=amount)return;
  assert.ok(amount<=cap(resource));
  let cycles=0;
  while(val(resource)<amount&&cycles++<100){
    if(val('stone')<100000)fillBasic('stone',Math.min(1200000,cap('stone')));
    if(val('coal')<100000)fillBasic('coal',Math.min(450000,cap('coal')));
    if(resource==='steel'&&val('iron')<100000)
      fillProcessed('iron',Math.min(1000000,cap('iron')));
    const before=val(resource);
    assign(resource);
    const stop='S.res.stone<20000||S.res.coal<20000'+(resource==='steel'?'||S.res.iron<20000':'');
    advanceUntil(`S.res.${resource}>=${amount}`,5000,stop);
    assert.ok(val(resource)>before,resource+' stalled');
  }
  assert.ok(val(resource)>=amount,resource+' exhausted');
}
for(const resource of ['steel','iron','copper'])fillProcessed(resource,72000);
const electro=run("train('electro_trooper',9)");
assert.equal(electro.ok,true,JSON.stringify(electro));
phase='training';
assert.ok(advanceUntil("poolAvail('electro_trooper')>=9",1000).done);
const gold=run("train('gold_cavalry',1)");
assert.equal(gold.ok,true,JSON.stringify(gold));
assert.ok(advanceUntil("poolAvail('gold_cavalry')>=1",1000).done);
run("adjForm('expedition','mid',0,9)");
run("adjForm('expedition','mid',3,1)");
assert.equal(run('S.formation.mid[0].count'),55);
assert.equal(run('S.formation.mid[3].count'),41);
assert.equal(run('formSoldierCount()'),636);
assert.equal(run('save().ok'),true);
const finalRaw=e.store.get('rts_save'),finalFile='p391-six-star-plus10-paid-save.json';
fs.writeFileSync(path.join(data,finalFile),finalRaw);
const restored=environment({rts_save:finalRaw});
assert.equal(restored.run('loadSaveAndApply().status'),'ok');
assert.equal(restored.run('formSoldierCount()'),636);
const final=run(`({tick:S.tick,army:armyCount(),deployed:formSoldierCount(),
  field:steamMilitaryFieldSize(),stars:S.steamMilitaryStars,res:{...S.res},
  items:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,ring:S.items.sacredRingCore}})`);
assert.equal(final.res.medal,initial.res.medal);
assert.deepEqual(final.items,initial.items);

function battle(seed){
  const env=environment({rts_save:finalRaw}),r=env.run;
  assert.equal(r('loadSaveAndApply().status'),'ok');
  r(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  const before={army:r('armyCount()'),deployed:r('formSoldierCount()'),alert:r('S.killValues.starBeast'),
    ring:r('S.items.sacredRingCore')};
  r("openMaterialDomain('starBeast2')");
  assert.equal(r('S.battleActive'),true);
  let callbacks=0;
  while(r('S.battleActive')&&callbacks<8000){assert.equal(r('__step()'),true);callbacks++}
  assert.ok(callbacks<8000);
  const result=r("document.getElementById('battle-result').className");
  const after={army:r('armyCount()'),deployed:r('formSoldierCount()'),alert:r('S.killValues.starBeast'),
    ring:r('S.items.sacredRingCore'),origin:r('S.items.starOriginStone'),
    illusion:r('S.items.illusionStone'),daily:r("dailyCount('starBeast2')")};
  const enemyHpLeft=r('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  assert.equal(r('save().ok'),true);
  const battleRaw=env.store.get('rts_save'),reload=environment({rts_save:battleRaw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.sacredRingCore'),after.ring);
  if(result==='win')fs.writeFileSync(path.join(data,`p391-six-star-plus10-beast2-seed${seed}-paid-save.json`),battleRaw);
  return{seed,before,result,after,enemyHpLeft,callbacks,saveSha256:sha(battleRaw)};
}
const rows=Array.from({length:16},(_,i)=>battle(i+1));
const ledger={batch:'P391',source,sourceSha256:sha(raw),
  runtimeSha256:Object.fromEntries(['config.js','levels.js','math.js','garrison.js','technology.js']
    .map(file=>[file,sha(fs.readFileSync(path.join(root,file),'utf8'))])),
  initial,trainingCost:{copper:72000,iron:72000,steel:72000,gold:100,food:1000},
  seconds,minFood,phases,final,finalSave:{file:finalFile,sha256:sha(finalRaw)},rows,
  scope:'Actual production, training, adjForm, save/load. Fixed independent battle seeds 1–16. No direct resource, formation, combat or config injection.'};
const output='p391-six-star-plus10-paid-ledger.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({seconds,minFood,phases,initial:{army:initial.army,deployed:initial.deployed},
  final:{army:final.army,deployed:final.deployed},wins:rows.filter(x=>x.result==='win').length,
  rows:rows.map(x=>({seed:x.seed,result:x.result,enemyHpLeft:x.enemyHpLeft,
    loss:x.before.army-x.after.army,ring:x.after.ring})),output},null,2));
