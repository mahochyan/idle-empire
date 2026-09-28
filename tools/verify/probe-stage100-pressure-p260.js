'use strict';
// P260: same paid, uncleared stage-100 checkpoint; real formations and real battle callbacks.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const inputFile='docs/codex/reports/data/p242-stage100-recovered-save.json';
const input=fs.readFileSync(path.join(root,inputFile),'utf8').trim();
const electroFile='docs/codex/reports/data/p261-stage100-electro-paid-save.json';
const electroInput=fs.readFileSync(path.join(root,electroFile),'utf8').trim();
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const configurations={
  current:{infantry:[1,1,1],archer:[1,1,1],cavalry_t1:[1,1,1],mage_t1:[1,1]},
  x2:{infantry:[2,2,2],archer:[2,2,2],cavalry_t1:[2,2,2],mage_t1:[2,2]},
  x3:{infantry:[3,3,3],archer:[3,3,3],cavalry_t1:[3,3,3],mage_t1:[3,3]},
  x5:{infantry:[5,5,5],archer:[5,5,5],cavalry_t1:[5,5,5],mage_t1:[5,5]},
  x8:{infantry:[8,8,8],archer:[8,8,8],cavalry_t1:[8,8,8],mage_t1:[8,8]},
  x12:{infantry:[12,12,12],archer:[12,12,12],cavalry_t1:[12,12,12],mage_t1:[12,12]},
  x16:{infantry:[16,16,16],archer:[16,16,16],cavalry_t1:[16,16,16],mage_t1:[16,16]},
  x20:{infantry:[20,20,20],archer:[20,20,20],cavalry_t1:[20,20,20],mage_t1:[20,20]},
  x25:{infantry:[25,25,25],archer:[25,25,25],cavalry_t1:[25,25,25],mage_t1:[25,25]},
  x30:{infantry:[30,30,30],archer:[30,30,30],cavalry_t1:[30,30,30],mage_t1:[30,30]},
  x40:{infantry:[40,40,40],archer:[40,40,40],cavalry_t1:[40,40,40],mage_t1:[40,40]}
};
function place(run,row,type,count,slot=0){
  assert.ok(run(`rowSlots('${row}')`)>slot);
  assert.ok(run(`poolAvail('${type}')`)>=count);
  run(`openFormModal('expedition','${row}',${slot});
    S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
  assert.equal(run(`S.formation.${row}[${slot}].count`),count);
}
function fight(configKey,formation,seed){
  const conditional=formation==='starConditional'||formation==='fullConditional';
  const late=formation==='electro'||formation==='mixed'||conditional;
  const world=environment({rts_save:late?electroInput:input}),run=world.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const item=__timers.entries().next().value;
      if(!item)return false;__timers.delete(item[0]);item[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));`);
  assert.equal(run('S.defeated.length'),99);
  assert.equal(run("scienceUnlocked('sci_nuclear_age')"),false);
  assert.equal(run('Object.keys(S.upgradedUnits).length'),0);
  if(conditional)run("S.sciences.push('sci_nuclear_age');S.pool.star_trooper=40");
  run("clrForm('expedition')");
  place(run,'front',formation==='armored'||formation==='mixed'||formation==='fullConditional'?
    'armored_trooper':formation==='electro'?'electro_trooper':formation==='starConditional'?'star_trooper':'alloy_special',40);
  if(formation==='mixed'||formation==='fullConditional')place(run,'front','electro_trooper',40,1);
  if(formation==='fullConditional')place(run,'front','star_trooper',40,2);
  place(run,'mid','archer',20);
  place(run,'back','archer',20);
  assert.equal(run('save().ok'),true);
  const prepared=world.store.get('rts_save');
  const armyBefore=conditional?204:late?164:125;
  assert.equal(run('armyCount()'),armyBefore);
  const candidate=configurations[configKey];
  run(`CFG.enemies[99].units=${JSON.stringify(candidate)}`);
  run(`globalThis.__rng=${seed};globalThis.__draws=0;
    Math.random=()=>{__draws++;let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296}`);
  run('selEnemy(99);openBattle()');
  assert.equal(run('S.battleActive'),true);
  const enemy=plain(run(`({groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
    hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){
    assert.equal(run('__step()'),true,'battle callback missing');callbacks++;
  }
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=plain(run(`({defeated:[...S.defeated],army:armyCount(),formation:S.formation,
    sciences:[...S.sciences],upgradedUnits:{...S.upgradedUnits},res:{...S.res}})`));
  assert.equal(after.defeated.includes(100),won);
  assert.equal(after.sciences.includes('sci_nuclear_age'),conditional);
  assert.equal(Object.keys(after.upgradedUnits).length,0);
  const battleSave=world.store.get('rts_save');
  const fresh=environment({rts_save:battleSave});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(plain(fresh.run('S.defeated.slice()')),after.defeated);
  assert.equal(fresh.run('armyCount()'),after.army);
  return{configKey,formation,conditional,seed,won,round:run('B.round'),callbacks,
    loss:armyBefore-after.army,enemy,preparedSaveSha256:sha(prepared),battleSaveSha256:sha(battleSave)};
}
const rows=[];
for(const [configKey] of Object.entries(configurations))
  for(const formation of ['alloy','armored','electro','mixed',
    ...(new Set(['x25','x30','x40']).has(configKey)?['starConditional','fullConditional']:[])])
    for(let flow=1;flow<=16;flow++)rows.push(fight(configKey,formation,(flow*1009+9176)>>>0));
const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js',inputFile,electroFile,'tools/verify/probe-stage100-pressure-p260.js'];
const output='docs/codex/reports/data/p260-stage100-pressure.json';
const result={batch:'P260',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  unit:'soldiers and real asynchronous combat callbacks; no production ticks',
  policy:{configurations,paidFormations:['alloy','armored','electro','mixed'],
    conditionalFormations:['starConditional','fullConditional'],flows:'1..16 deterministic PRNG',
    inputSha256:sha(input),electroInputSha256:sha(electroInput),candidate:'isolated CFG.enemies[99].units',
    formation:'paid troops on P242/P261; star scenarios inject 40 star troops and nuclear science for sensitivity only'},
  inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),rows};
fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({batch:'P260',summary:Object.keys(configurations).flatMap(configKey=>
  ['alloy','armored','electro','mixed',
    ...(new Set(['x25','x30','x40']).has(configKey)?['starConditional','fullConditional']:[])].map(formation=>{
    const arm=rows.filter(r=>r.configKey===configKey&&r.formation===formation);
    const wins=arm.filter(r=>r.won);
    return{configKey,formation,wins:wins.length,meanWinLoss:wins.length?
      wins.reduce((n,r)=>n+r.loss,0)/wins.length:null,
      maxWinLoss:wins.length?Math.max(...wins.map(r=>r.loss)):null};
  })),output},null,2));
