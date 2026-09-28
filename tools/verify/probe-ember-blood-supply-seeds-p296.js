'use strict';
// Real battle and reward calls from the same paid save; 11 continuous RNG streams, no injected items or soldiers.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p295-aegis-elixir-paid-save.json',raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'5909b1e9fcab59140edb76bde9ce21736d387f4f0b73b384bf0076210d5b80d1');
const rows=[];
for(const strategy of ['no-cleanser','cleanse-at-2100'])for(let seed=1;seed<=11;seed++){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const battles=[];let cleansersUsed=0;
  while(run('S.items.sacredBlood')<20&&battles.length<40){
    if(strategy==='cleanse-at-2100'&&run('S.killValues.godPhantom')>=2100&&run('S.items.domainCleanser')>0){
      const spent=run("useDomainCleanser('phantomFlower')");
      assert.equal(spent.ok,true,JSON.stringify(spent));
      cleansersUsed++;
    }
    const before={blood:run('S.items.sacredBlood'),alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()')};
    run("openMaterialDomain('phantomFlower')");
    assert.equal(run('S.battleActive'),true);
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
    assert.equal(run('S.battleActive'),false);
    const result=run("document.getElementById('battle-result').className");
    const after={blood:run('S.items.sacredBlood'),alert:run('S.killValues.godPhantom'),soldiers:run('formSoldierCount()')};
    battles.push({result,before,after,callbacks});
    if(result!=='win')break;
    assert.ok(after.blood>before.blood);
    assert.equal(after.alert,before.alert+100);
    run('exitBattle()');
  }
  rows.push({strategy,seed,completed:run('S.items.sacredBlood')>=20,wins:battles.filter(x=>x.result==='win').length,
    lastResult:battles.at(-1)?.result||null,blood:run('S.items.sacredBlood'),soldiers:run('formSoldierCount()'),
    alert:run('S.killValues.godPhantom'),ember:run('S.items.emberElixir'),aegis:run('S.items.aegisElixir'),
    cleansersUsed,cleanserLeft:run('S.items.domainCleanser'),battles});
}
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const summary=Object.fromEntries(['no-cleanser','cleanse-at-2100'].map(strategy=>{
  const subset=rows.filter(x=>x.strategy===strategy),completed=subset.filter(x=>x.completed);
  return[strategy,{completed:completed.length,failed:subset.length-completed.length,
    soldierRangeCompleted:completed.length?[Math.min(...completed.map(x=>x.soldiers)),Math.max(...completed.map(x=>x.soldiers))]:null,
    firstFailureAlert:[...new Set(subset.filter(x=>!x.completed).map(x=>x.alert))],
    cleansersUsed:subset.reduce((n,x)=>n+x.cleansersUsed,0)}];
}));
const report={batch:'P296',kind:'fixed-stream paid-save blood supply sensitivity',source,sourceSha256:sha(raw),
  rng:'continuous xorshift32 per stream, seeds 1–11',goalBlood:20,strategies:['no-cleanser','cleanse-at-2100'],summary,rows};
const output='p296-ember-blood-supply-seeds.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({output,summary,rows:rows.map(({strategy,seed,completed,wins,lastResult,blood,soldiers,alert,ember,aegis,cleansersUsed})=>
  ({strategy,seed,completed,wins,lastResult,blood,soldiers,alert,ember,aegis,cleansersUsed}))},null,2));
