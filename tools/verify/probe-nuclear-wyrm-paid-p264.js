'use strict';
// P264: one real material fight, followed by real industrial replenishment from P262.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const inputFile='docs/codex/reports/data/p262-nuclear-pop1002-paid-save.json';
const raw=fs.readFileSync(path.join(root,inputFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const original=JSON.parse(JSON.stringify(run('S.formation')));
const before=run("({tick:S.tick,army:armyCount(),wild:S.killValues.wildWyrm,sinew:S.items.wyrmSinew,res:{...S.res}})");
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
  globalThis.__rng=13;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
run("openMaterialDomain('wyrmSinew')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
assert.equal(run("document.getElementById('battle-result').className"),'win');
const after=run("({tick:S.tick,army:armyCount(),wild:S.killValues.wildWyrm,sinew:S.items.wyrmSinew,formation:S.formation,pool:S.pool,res:{...S.res}})");
assert.equal(after.wild,before.wild+10);
assert.ok(after.sinew>before.sinew);
assert.equal(after.tick,before.tick);
const target={};
for(const row of ['front','mid','back'])for(const u of original[row])target[u.type]=(target[u.type]||0)+u.count;
const owned={};
for(const row of ['front','mid','back'])for(const u of after.formation[row])owned[u.type]=(owned[u.type]||0)+u.count;
for(const [type,count] of Object.entries(after.pool))owned[type]=(owned[type]||0)+count;
const missing={};
for(const [type,count] of Object.entries(target))if(count-(owned[type]||0)>0)missing[type]=count-(owned[type]||0);
const need={};
for(const [type,count] of Object.entries(missing))for(const [rk,amount] of Object.entries(run(`CFG.units.${type}.cost`)))need[rk]=(need[rk]||0)+count*amount;
assert.equal(Object.values(missing).reduce((n,x)=>n+x,0),before.army-after.army);
const battleSave=e.store.get('rts_save');
const reload=environment({rts_save:battleSave});
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('armyCount()'),after.army);
if(process.argv.includes('--battle-only')){console.log(JSON.stringify({before,after:{tick:after.tick,army:after.army,wild:after.wild,sinew:after.sinew,formation:after.formation},missing,need,callbacks,battleSaveSha256:sha(battleSave)}));process.exit(0)}
let waited=0,minFood=run('S.res.food');
const phaseSeconds={copper:0,coal:0,steel:0,training:0};
function assign(key){
  const jobs=run('({...S.popAlloc})');
  for(const [rk,n] of Object.entries(jobs))if(n>0)assert.equal(run(`setPopAlloc('${rk}',0)`)?.ok,true);
  assert.equal(run("setPopAlloc('food',159)")?.ok,true);
  assert.equal(run(`setPopAlloc('${key}',843)`)?.ok,true);
  assert.equal(run('popAllocTotal()'),1002);
  assert.ok(run("prodRate('food')-totalUpkeep()-popCurrent()*CFG.popFoodCost")>0);
}
function waitUntil(cond,phase,max=5000){
  const x=run(`(()=>{let n=0,min=S.res.food;while(!(${cond})&&n<${max}){tick();n++;if(S.res.food<min)min=S.res.food}return{n,ok:!!(${cond}),min}})()`);
  assert.equal(x.ok,true,`${phase}: ${cond} timeout`);
  waited+=x.n;phaseSeconds[phase]+=x.n;minFood=Math.min(minFood,x.min);
}
assert.deepEqual(missing,{alloy_special:17,armored_trooper:10});
assert.deepEqual(need,{food:25500,steel:21700,copper:20000,iron:20000});
assert.ok(run('S.res.iron')>=need.iron);
assert.ok(run('S.res.food')>=need.food);
assert.ok(run('S.res.stone')>=120000);
assert.ok(run('S.res.coal')>=80000);
assign('copper');waitUntil(`S.res.copper>=${need.copper}`,'copper');
assign('coal');waitUntil('S.res.coal>=150000','coal');
assign('steel');waitUntil(`S.res.steel>=${need.steel}`,'steel');
const trainBefore=run('({...S.res})');
assign('stone');
run(`globalThis.__trainingPaid={};globalThis.__originalPayTrainingCost=payTrainingCost;
  payTrainingCost=(cost,n)=>{for(const [key,value] of Object.entries(cost))__trainingPaid[key]=(__trainingPaid[key]||0)+value*n;return __originalPayTrainingCost(cost,n)}`);
for(const [type,count] of Object.entries(missing)){
  const result=run(`train('${type}',${count})`);
  assert.equal(result?.ok,true,`train ${type}: ${JSON.stringify(result)}`);
  assert.equal(result.qty,count);
}
for(const [type,count] of Object.entries(missing))waitUntil(`(S.pool.${type}||0)>=${count}`,'training',200);
for(const [key,value] of Object.entries(need))assert.equal(run(`__trainingPaid.${key}`),value,`paid ${key}`);
for(const rk of ['copper','iron','steel'])assert.ok(Math.abs(trainBefore[rk]-run(`S.res.${rk}`)-need[rk])<1e-5,`paid ${rk}`);
assert.equal(run('armyCount()'),before.army);
run("clrForm('expedition')");
function place(row,type,count,slot){
  assert.ok(run(`poolAvail('${type}')`)>=count);
  run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),count);
}
for(const row of ['front','mid','back'])original[row].forEach((u,i)=>place(row,u.type,u.count,i));
assert.equal(run('armyCount()'),before.army);
assert.equal(run('S.killValues.wildWyrm'),3010);
assert.equal(run('S.items.wyrmSinew'),97);
assert.equal(run('save().ok'),true);
const preSecond=e.store.get('rts_save');
const preReload=environment({rts_save:preSecond});
assert.equal(preReload.run('loadSaveAndApply().status'),'ok');
assert.equal(preReload.run('armyCount()'),437);
const preFile='docs/codex/reports/data/p264-nuclear-wyrm-replenished-save.json';
fs.writeFileSync(path.join(root,preFile),preSecond,'utf8');
const pre={tick:run('S.tick'),res:run('({...S.res})'),army:run('armyCount()'),wild:run('S.killValues.wildWyrm'),sinew:run('S.items.wyrmSinew')};
run("openMaterialDomain('wyrmSinew')");
assert.equal(run('S.battleActive'),true);
let secondCallbacks=0;
while(run('S.battleActive')&&secondCallbacks<1500){assert.equal(run('__step()'),true);secondCallbacks++}
assert.equal(run('S.battleActive'),false);
const second={win:run("document.getElementById('battle-result').className")==='win',tick:run('S.tick'),army:run('armyCount()'),
  wild:run('S.killValues.wildWyrm'),sinew:run('S.items.wyrmSinew'),round:run('B.round'),callbacks:secondCallbacks};
const secondSave=e.store.get('rts_save');
const secondReload=environment({rts_save:secondSave});
assert.equal(secondReload.run('loadSaveAndApply().status'),'ok');
assert.equal(secondReload.run('armyCount()'),second.army);
const secondFile='docs/codex/reports/data/p264-nuclear-wyrm-second-save.json';
fs.writeFileSync(path.join(root,secondFile),secondSave,'utf8');
const report={batch:'P264',sourceFile:inputFile,sourceSha256:sha(raw),unit:'simulated online seconds, resource units and soldiers',
  first:{seed:13,callbacks,before:{tick:before.tick,army:before.army,wild:before.wild,sinew:before.sinew},
    after:{tick:after.tick,army:after.army,wild:after.wild,sinew:after.sinew},missing,need,battleSaveSha256:sha(battleSave)},
  recovery:{elapsedOnlineSeconds:waited,phaseSeconds,minFood,trainBefore,pre,saveFile:preFile,saveSha256:sha(preSecond)},
  second:{...second,loss:pre.army-second.army,drop:second.sinew-pre.sinew,saveFile:secondFile,saveSha256:sha(secondSave)}};
const reportFile='docs/codex/reports/data/p264-nuclear-wyrm-replenishment.json';
fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({first:report.first,recovery:{elapsedOnlineSeconds:waited,phaseSeconds,minFood,pre},second:report.second}));
