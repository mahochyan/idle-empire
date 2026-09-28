'use strict';
// Compare medal-domain alert pressure; default source uses conditional alert levels, paid source uses its current alert.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input=process.argv.find(arg=>arg.startsWith('--input='))?.slice('--input='.length)||'p279-awakening-star155-paid-save.json';
if(!['p279-awakening-star155-paid-save.json','p284-awakening-stage5-nano10-paid-save.json',
  'p285-awakening-stage6-full-roster-paid-save.json'].includes(input))throw Error('invalid input');
const source='docs/codex/reports/data/'+input;
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const nanoLevel=Number(process.argv.find(arg=>arg.startsWith('--nano-level='))?.slice('--nano-level='.length)||0);
if(!Number.isSafeInteger(nanoLevel)||nanoLevel<0||nanoLevel>40)throw Error('invalid nano level');
const count=Number(process.argv.find(arg=>arg.startsWith('--count='))?.slice('--count='.length)||17);
if(!Number.isSafeInteger(count)||count<1||count>30)throw Error('invalid alert count');
const start=JSON.parse(raw).killValues.godSlaughter;
const alerts=Array.from({length:count},(_,i)=>start+i*100);
const seeds=Array.from({length:11},(_,i)=>i+1);
const rows=[];
for(const alert of alerts)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  assert.equal(run('S.killValues.godSlaughter'),start);
  if(nanoLevel)run(`Object.assign(S.weaponForge.nanoArmor,{researched:true,level:${nanoLevel},equipped:true})`);
  run(`S.killValues.godSlaughter=${alert};Date.now=()=>1790496000000;
    globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  const enemy=run('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def})');
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  rows.push({alert,seed,enemy,callbacks,result:run("document.getElementById('battle-result').className"),
    enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)'),
    soldiers:run('formSoldierCount()'),core:run('S.items.godCore')});
}
const byAlert=alerts.map(alert=>{
  const set=rows.filter(r=>r.alert===alert),hp=set.map(r=>r.enemyHpLeft);
  return{alert,wins:set.filter(r=>r.result==='win').length,minEnemyHpLeft:Math.min(...hp),
    maxEnemyHpLeft:Math.max(...hp),meanEnemyHpLeft:hp.reduce((n,v)=>n+v,0)/hp.length,
    enemy:set[0].enemy};
});
const paid=input!=='p279-awakening-star155-paid-save.json';
const stem=input.startsWith('p285')?'p285-awakening-core-alert-level6-paid':input.startsWith('p284')?'p285-awakening-core-alert-cap-paid':'p284-awakening-core-alert-cap';
const output=`docs/codex/reports/data/${stem}${nanoLevel?`-nano${nanoLevel}`:''}.json`;
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:paid?'P285':'P284',kind:paid?'Paid source save; one-off full-roster battle at current alert, no preceding battle sequence simulated':'VM-only full-roster alert sensitivity; no prior wins or replenishment paid',
  source,sourceSha256,conditionalNanoLevel:nanoLevel,alerts,seeds,byAlert,rows},null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256,byAlert,output},null,2));
