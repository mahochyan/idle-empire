'use strict';
// 从守御4000实付首胜档不补兵，按现行规则探测4100，只有真实胜利才保存快照。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p75-guardian4000-first-win-paid.json'),'utf8');
const winArg=process.argv.find(x=>x.startsWith('--snapshot-first-win='));
const results=[];let firstWin=null;
for(let seed=1;seed<=12;seed++){
  const e=environment({rts_save:source}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.killValues.godGuardian'),4100);
  assert.equal(run('armyCount()'),452);
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
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=run('S.items.guardianStone');
  run("openMaterialDomain('guardianStone')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++;}
  assert.equal(run('S.battleActive'),false);
  const after=run('({round:B.round,enemyHp:B.enemyUnits[0].hp,kill:S.killValues.godGuardian,army:armyCount(),stone:S.items.guardianStone})');
  const win=after.kill===4200;
  results.push({seed,win,round:after.round,enemyHp:after.enemyHp,armyAfter:after.army,
    stoneGain:after.stone-before,callbacks});
  if(win&&!firstWin){
    assert.equal(run('save().ok'),true);
    firstWin=e.store.get('rts_save');
    const check=environment({rts_save:firstWin});
    assert.equal(check.run('loadSaveAndApply().status'),'ok');
    assert.equal(check.run('S.killValues.godGuardian'),4200);
    if(winArg)fs.writeFileSync(path.resolve(winArg.slice('--snapshot-first-win='.length)),firstWin);
  }
}
const ranked=results.slice().sort((a,b)=>Number(b.win)-Number(a.win)||a.enemyHp-b.enemyHp||b.armyAfter-a.armyAfter);
console.log(JSON.stringify({unit:'battle rounds; soldiers',wins:results.filter(x=>x.win).length,
  firstWinSha256:firstWin?crypto.createHash('sha256').update(firstWin).digest('hex'):null,
  best:ranked.slice(0,6),worst:ranked.at(-1),results},null,2));
