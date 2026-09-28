'use strict';
// P261: from P242 uncleared stage-100 save, pay for 40 electro troops using real production and training.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const inputFile='docs/codex/reports/data/p242-stage100-recovered-save.json';
const input=fs.readFileSync(path.join(root,inputFile),'utf8').trim();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
let world=environment({rts_save:input}),run=world.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
function install(){run(`globalThis.__nodes=new Map();document.getElementById=id=>{
  if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
  if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
  return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__paid={};globalThis.__minPayFood=S.res.food;
  globalThis.__realPay=payTrainingCost;
  payTrainingCost=(cost,n)=>{__realPay(cost,n);
    __minPayFood=Math.min(__minPayFood,S.res.food);
    for(const [k,v] of Object.entries(cost))__paid[k]=(__paid[k]||0)+v*n};`)}
install();
const start=plain(run(`({tick:S.tick,res:{...S.res},sciences:[...S.sciences],
  defeated:[...S.defeated],upgraded:{...S.upgradedUnits},army:armyCount(),
  electro:((S.pool.electro_trooper||0)+expeditionCount('electro_trooper'))})`));
assert.equal(start.defeated.length,99);
assert.equal(start.sciences.includes('sci_nuclear_age'),false);
assert.equal(start.electro,1);
assert.equal(run("trainLockReason('electro_trooper')"),'');
function action(expression,label){
  const result=plain(run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
  return result;
}
function waitFor(expression,max,label){
  let seconds=0,minFood=run('S.res.food');
  while(!run(expression)&&seconds<max){run('tick()');seconds++;minFood=Math.min(minFood,run('S.res.food'))}
  assert.ok(seconds<max,label+' timeout '+JSON.stringify(plain(run(`({tick:S.tick,
    res:{food:S.res.food,copper:S.res.copper,steel:S.res.steel,iron:S.res.iron,
      coal:S.res.coal,stone:S.res.stone},alloc:S.popAlloc,queue:S.queue.electro_trooper})`))));
  return{seconds,minFood};
}
function reload(label){
  assert.equal(run('save().ok'),true,label+' save');
  const raw=world.store.get('rts_save');
  const prior=plain(run(`({tick:S.tick,res:{...S.res},pop:{...S.popAlloc},
    armory:bldSt('electric_armory').lv,army:armyCount(),defeated:[...S.defeated]})`));
  world=environment({rts_save:raw});run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok',label+' reload');
  install();
  assert.deepEqual(plain(run(`({tick:S.tick,res:{...S.res},pop:{...S.popAlloc},
    armory:bldSt('electric_armory').lv,army:armyCount(),defeated:[...S.defeated]})`)),prior);
  return sha(raw);
}
const upgrades=[];
while(run("bldSt('electric_armory').lv")<12){
  const lv=run("bldSt('electric_armory').lv"),cost=plain(run("upCost('electric_armory')"));
  const waited=waitFor("Object.entries(upCost('electric_armory')).every(([k,v])=>k==='time'||S.res[k]>=v)",
    10000,'electric armory Lv'+(lv+1)+' payment');
  action("buildAct('electric_armory')",'electric armory Lv'+(lv+1));
  const built=waitFor(`bldSt('electric_armory').lv>=${lv+1}`,300,'electric armory Lv'+(lv+1));
  const checkpoint=reload('electric armory Lv'+(lv+1));
  upgrades.push({lv:lv+1,cost,waited,built,checkpoint});
}
assert.ok(run("unitCap('electro_trooper')")>=40);
function staff(jobs,label){
  const previous=plain(run('({...S.popAlloc})'));
  for(const [key,count] of Object.entries(previous))if(count>0)
    action(`setPopAlloc('${key}',0)`,label+' release '+key);
  for(const [key,count] of Object.entries(jobs))if(count>0)
    action(`setPopAlloc('${key}',${count})`,label+' assign '+key);
  assert.equal(run('popAllocTotal()'),run('popCurrent()'));
  return{previous,jobs};
}
const missing=40-start.electro,need=missing*run('CFG.units.electro_trooper.cost.copper');
assert.equal(missing,39);
const copperStaff=staff({food:32,stone:20,coal:25,copper:25},'copper phase');
const copperWait=waitFor(`S.res.copper>=${need}`,100000,'copper stock for electro troops');
const copperCheckpoint=reload('copper stock');
const steelStaff=staff({food:37,stone:20,coal:20,steel:25},'steel phase');
const steelWait=waitFor(`S.res.steel>=${need}`,100000,'steel stock for electro troops');
const steelCheckpoint=reload('steel stock');
assert.ok(run('S.res.iron')>=need);
const trainingStaff=staff({food:102},'training phase');
action(`train('electro_trooper',${missing})`,'electro training');
const trained=waitFor("(S.pool.electro_trooper||0)+expeditionCount('electro_trooper')>=40",1000,'electro training');
assert.deepEqual(plain(run('({...__paid})')),{copper:need,iron:need,steel:need});
run("clrForm('expedition')");
function place(row,type,count){
  assert.ok(run(`poolAvail('${type}')`)>=count);
  run(`openFormModal('expedition','${row}',0);
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[0].count`),count);
}
place('front','electro_trooper',40);
place('mid','archer',20);
place('back','archer',20);
const paid=plain(run('({...__paid})'));
const minFoodAfterPayment=run('__minPayFood');
const finalSaveSha256=reload('paid electro formation');
assert.equal(run('armyCount()'),164);
assert.equal(run('S.defeated.length'),99);
assert.equal(run("scienceUnlocked('sci_nuclear_age')"),false);
assert.equal(run('Object.keys(S.upgradedUnits).length'),0);
const final=plain(run(`({tick:S.tick,res:{...S.res},pop:{...S.popAlloc},
  armory:bldSt('electric_armory').lv,army:armyCount(),formation:S.formation,
  sciences:[...S.sciences],defeated:[...S.defeated],upgraded:{...S.upgradedUnits}})`));
const outputSave='docs/codex/reports/data/p261-stage100-electro-paid-save.json';
fs.writeFileSync(path.join(root,outputSave),world.store.get('rts_save'));
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',inputFile,'tools/verify/probe-stage100-electro-paid-p261.js'];
const output='docs/codex/reports/data/p261-stage100-electro-paid.json';
const result={batch:'P261',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  unit:'game simulated online seconds and paid resources',
  policy:{inputSha256:sha(input),targetElectro:40,missing,needEachMetal:need,
    initialArmory:1,finalArmory:12,outputSave,finalSaveSha256},
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
  start,upgrades,copperStaff,copperWait,copperCheckpoint,
  steelStaff,steelWait,steelCheckpoint,trainingStaff,trained,
  paid,minFoodAfterPayment,final};
fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P261',startTick:start.tick,finalTick:final.tick,
  upgrades:upgrades.length,copperWait,steelWait,trained,paid:result.paid,
  minFoodAfterPayment:result.minFoodAfterPayment,finalSaveSha256,outputSave,output},null,2));
