'use strict';
// Replays real village battles from a paid L10 save; no army or resource injection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const refill=process.argv.includes('--paid-refill');
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8').trim();
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const sourceHash=Object.fromEntries(runtimeFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file),'utf8'))]));
const game=environment({rts_save:raw});
assert.equal(game.run('loadSaveAndApply().status'),'migrated');
assert.equal(game.store.get('rts_save_premigration'),raw,'migration did not preserve the original v32 save');
assert.equal(JSON.parse(game.store.get('rts_save')).v,34);
game.run(`
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.__timerNow=0;globalThis.__nextTickMs=CFG.tickMs;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;
    __timers.set(id,{fn,at:__timerNow+Math.max(0,Number(delay)||0)});return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{
    let selected=null;
    for(const [id,timer]of __timers)
      if(!selected||timer.at<selected.timer.at||timer.at===selected.timer.at&&id<selected.id)
        selected={id,timer};
    if(!selected)return false;
    while(__nextTickMs<=selected.timer.at){__timerNow=__nextTickMs;tick();__nextTickMs+=CFG.tickMs}
    __timerNow=selected.timer.at;__timers.delete(selected.id);selected.timer.fn();return true
  };
  globalThis.__nodes=new Map();
  document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)
  };
  globalThis.addLog=message=>S.log.push(String(message));
  globalThis.__rng=1009+11*9176;
  Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
  globalThis.__charges=[];
  const originalPay=payTrainingCost;
  payTrainingCost=(cost,n)=>{originalPay(cost,n);__charges.push({cost:{...cost},n,tick:S.tick})};
`);
const take=()=>JSON.parse(game.run(`JSON.stringify({
  tick:S.tick,mainline:S.defeated.length,merit:S.merit,
  wins:S.development.outer.village.wins,alert:S.development.outer.village.alert,
  essence:{shield:S.essence.shield_essence,spear:S.essence.spear_essence,sword:S.essence.sword_essence},
  resources:{food:S.res.food,wood:S.res.wood,stone:S.res.stone,copper:S.res.copper,iron:S.res.iron,deed:S.res.deed,medal:S.res.medal},
  formation:S.formation,pool:S.pool,army:formSoldierCount(),
  garrison:{phase:S.garrison.phase,nextCheckTick:S.garrison.nextCheckTick,
    cooldownUntil:S.garrison.cooldownUntil,logCount:S.garrisonLog.length}
})`));
const results=[];
const targets={bronze_guard:15,infantry_t1:15,archer_t1:13};
function owned(type){return game.run(`(S.pool['${type}']||0)+expeditionCount('${type}')+garrisonCount('${type}')`)}
function rebuild(){
  const before=take(),chargesBefore=game.run('__charges.length');
  let waited=0,stalled=0,lastCount=0;
  while(Object.entries(targets).some(([type,count])=>owned(type)<count)&&waited<20000){
    for(const [type,count]of Object.entries(targets)){
      const needed=count-owned(type)-game.run(`S.queue['${type}']?.count||0`);
      if(needed>0){
        const result=game.run(`train('${type}',${needed})`);
        assert.equal(result?.ok,true,`cannot queue ${type}: ${JSON.stringify(result)}`);
      }
    }
    game.run('for(let i=0;i<10;i++)tick()');waited+=10;
    const count=Object.keys(targets).reduce((sum,type)=>sum+owned(type),0);
    stalled=count>lastCount?0:stalled+10;lastCount=count;
    if(stalled>=3600)break;
  }
  const complete=Object.entries(targets).every(([type,count])=>owned(type)>=count);
  if(complete){
    for(const [row,slot,type,count]of [['front',0,'bronze_guard',15],
      ['front',1,'infantry_t1',15],['back',0,'archer_t1',13]]){
      const current=game.run(`S.formation.${row}[${slot}]?.count||0`);
      if(current>=count)continue;
      game.run(`openFormModal('expedition','${row}',${slot});
        S._formModalSel='${type}';S._formModalQty=${count-current};confirmForm()`);
      assert.equal(game.run(`S.formation.${row}[${slot}].count`),count);
    }
    assert.equal(game.run('save().ok'),true,'refilled formation save failed');
  }
  return{complete,waited,stalled,before,after:take(),
    charges:game.run(`__charges.slice(${chargesBefore})`),
    reasons:Object.fromEntries(Object.keys(targets).map(type=>[type,
      game.run(`S.queue['${type}']?.reason||''`)]))};
}
for(let attempt=1;attempt<=15;attempt++){
  const before=take();
  game.run("openDevelopmentOuter('village')");
  if(!game.run('S.battleActive')){results.push({attempt,entrance:'blocked',before});break}
  let callbacks=0;
  while(game.run('S.battleActive')&&callbacks<2000){
    assert.equal(game.run('__step()'),true,'battle callback missing');callbacks++;
  }
  assert.ok(callbacks<2000,'battle callback limit');
  const outcome=game.run("document.getElementById('battle-result').className");
  const after=take();
  const save=game.store.get('rts_save');
  const reloaded=environment({rts_save:save});
  assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
  assert.equal(reloaded.run('S.development.outer.village.wins'),after.wins);
  assert.equal(reloaded.run('S.merit'),after.merit);
  results.push({attempt,outcome,callbacks,before,after,saveSha256:hash(save)});
  game.run('exitBattle()');
  if(outcome!=='win')break;
  if(refill){
    const recovery=rebuild();
    results.at(-1).recovery=recovery;
    if(!recovery.complete)break;
  }
}
for(const file of runtimeFiles)assert.equal(hash(fs.readFileSync(path.join(root,file),'utf8')),
  sourceHash[file],`${file} changed during replay`);
const finalSave=game.store.get('rts_save');
const finalReload=environment({rts_save:finalSave});
assert.equal(finalReload.run('loadSaveAndApply().status'),'ok');
assert.equal(finalReload.run('S.development.outer.village.wins'),results.at(-1).after.wins);
const report={batch:'P399',mode:refill?'real paid L10 village consecutive battles with paid refill':
    'real paid L10 village consecutive battles without refill',
  sourceFile,sourceSha256:hash(raw),runtimeSha256:sourceHash,
  gameClock:'battle callbacks advance tick by scheduled milliseconds; online recovery uses tick(); no offline settlement',
  finalSaveSha256:hash(finalSave),results};
const output=path.join(root,`docs/codex/reports/data/p399-regional-essence-${refill?'paid-refill':'unreplenished'}.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,`docs/codex/reports/data/p399-regional-essence-${refill?'paid-refill':'unreplenished'}-save.json`),finalSave);
console.log(JSON.stringify({attempts:results.length,results:results.map(({attempt,outcome,callbacks,before,after})=>({
  attempt,outcome,callbacks,armyBefore:before.army,armyAfter:after.army,merit:after.merit,
  essence:after.essence,wins:after.wins,alert:after.alert,
  recovery:results[attempt-1].recovery&&{complete:results[attempt-1].recovery.complete,
    waited:results[attempt-1].recovery.waited,stalled:results[attempt-1].recovery.stalled,
    charges:results[attempt-1].recovery.charges.length,
    reasons:results[attempt-1].recovery.reasons}}))},null,2));
