'use strict';
// Isolated formation screen on a legitimately paid L50-ready save.
// Each trial starts from the same unchanged input and uses real formation actions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p403-l50-ready-save.json';
const output='docs/codex/reports/data/p403-l50-silver-formations.json';
const inputBytes=fs.readFileSync(path.join(root,input));
const raw=inputBytes.toString('utf8').trim();
const clockMs=JSON.parse(raw).ts;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceHash=sha(inputBytes);
const layouts={
  original:[['front','iron_spearman'],['front','bronze_guard'],['front','silver_heavy'],
    ['mid','iron_spearman'],['mid','bronze_guard'],['back','archer_silverbow'],['back','archer_silverbow']],
  silver_first:[['front','silver_heavy'],['front','bronze_guard'],['front','iron_spearman'],
    ['mid','bronze_guard'],['mid','iron_spearman'],['back','archer_silverbow'],['back','archer_silverbow']],
  bronze_first:[['front','bronze_guard'],['front','silver_heavy'],['front','iron_spearman'],
    ['mid','iron_spearman'],['mid','bronze_guard'],['back','archer_silverbow'],['back','archer_silverbow']],
  four_front_silver:[['front','silver_heavy'],['front','bronze_guard'],['front','bronze_guard'],['front','iron_spearman'],
    ['mid','iron_spearman'],['back','archer_silverbow'],['back','archer_silverbow']],
  four_front_bronze:[['front','bronze_guard'],['front','bronze_guard'],['front','silver_heavy'],['front','iron_spearman'],
    ['mid','iron_spearman'],['back','archer_silverbow'],['back','archer_silverbow']],
  four_front_iron:[['front','iron_spearman'],['front','iron_spearman'],['front','bronze_guard'],['front','silver_heavy'],
    ['mid','bronze_guard'],['back','archer_silverbow'],['back','archer_silverbow']],
  silver_mid:[['front','iron_spearman'],['front','iron_spearman'],['front','bronze_guard'],['front','bronze_guard'],
    ['mid','silver_heavy'],['back','archer_silverbow'],['back','archer_silverbow']]
};
function trial(name,layout){
  const env=environment({rts_save:raw}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(env.store.get('rts_save'),raw);
  assert.equal(run('S.defeated.length'),49);
  run(`(()=>{
    const NativeDate=Date;
    globalThis.Date=class extends NativeDate{
      constructor(...args){super(...(args.length?args:[${clockMs}]))}
      static now(){return ${clockMs}}
    };
    Math.random=()=>0.5;
    const timers=new Map();let timerId=1;
    globalThis.setTimeout=fn=>{const id=timerId++;timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>timers.delete(id);
    globalThis.__p403Step=()=>{const next=timers.entries().next().value;
      if(!next)return false;timers.delete(next[0]);next[1]();return true};
    const nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:'',
        scrollHeight:0,scrollTop:0,className:'',
        classList:{add(){},remove(){},toggle(){},contains(){return false}},
        setAttribute(){},appendChild(){},remove(){}});
      return nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
  })()`);
  run("clrForm('expedition')");
  const indexes={front:0,mid:0,back:0};
  for(const[row,type]of layout){
    const index=indexes[row]++;
    assert.ok(run(`rowSlots('${row}')`)>index,`${name}: ${row} slot`);
    assert.ok(run(`S.pool['${type}']||0`)>=10,`${name}: ${type} pool`);
    run(`openFormModal('expedition','${row}',${index});
      S._formModalSel='${type}';S._formModalQty=10;confirmForm()`);
    assert.equal(run(`S.formation.${row}[${index}]?.type==='${type}'&&S.formation.${row}[${index}]?.count===10`),true,`${name}: placed`);
  }
  const formation=JSON.parse(JSON.stringify(run('S.formation')));
  assert.equal(run('save().ok'),true,`${name}: form save`);
  const readySave=env.store.get('rts_save');
  const readySha256=sha(readySave);
  const pre=JSON.parse(JSON.stringify(run(`({res:S.res,defeated:S.defeated,army:armyCount()})`)));
  run('selEnemy(49);openBattle()');
  assert.equal(run('S.battleActive'),true,`${name}: open`);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1500){assert.equal(run('__p403Step()'),true,`${name}: callback`);callbacks++}
  assert.equal(run('S.battleActive'),false,`${name}: settled`);
  const won=run('hasLevelDefeated(49)'),round=run('B.round'),winner=run('B.winner');
  run('exitBattle()');
  assert.equal(run('save().ok'),true,`${name}: result save`);
  const after=JSON.parse(JSON.stringify(run(`({res:S.res,defeated:S.defeated,army:armyCount(),
    formation:S.formation})`)));
  const finalSave=env.store.get('rts_save');
  const fresh=environment({rts_save:finalSave});
  assert.equal(fresh.run('loadSaveAndApply().status'),'ok');
  assert.equal(fresh.run('S.defeated.length'),won?50:49);
  return{name,formation,pre,readySha256,won,round,winner,callbacks,after,
    finalSha256:sha(finalSave),finalSave:won?finalSave:null};
}
const results=Object.entries(layouts).map(([name,layout])=>trial(name,layout));
assert.equal(sha(fs.readFileSync(path.join(root,input))),sourceHash);
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P403',input,inputSha256:sourceHash,
  method:'Independent v36 save reload, real formation changes and combat callbacks; fixed RNG 0.5; no economy/injection',
  results},null,2)+'\n');
console.log(JSON.stringify(results.map(({name,won,round,after})=>({name,won,round,army:after.army})),null,2));
