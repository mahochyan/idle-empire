'use strict';
// Source-backed, isolated check of the mother game's alert-reduction item at the current core wall.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input='p285-awakening-stage6-full-roster-paid-save.json';
const source='docs/codex/reports/data/'+input;
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(sourceSha256,'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const entityPath='210(1)_unpacked/_analysis/entities_table.json';
const entityRaw=fs.readFileSync(path.join(root,entityPath),'utf8');
const entities=JSON.parse(entityRaw).ents;
assert.deepEqual(entities['540001']['godWar:Get'],[[160010,40],[170011,1]]);
assert.equal(entities['540001']['godWar:KillValueID'],580051);
assert.equal(entities['180005']['itemPill:Add'],100);
assert.match(entities['180005']['itemPill:Effect'],/杀戮值-100/);
assert.deepEqual(entities['380049']['market:Need'],[180001,3]);
assert.deepEqual(entities['380049']['market:Get'],[180005,1]);
assert.deepEqual(entities['380009']['market:Need'],[160006,9999]);
assert.deepEqual(entities['380009']['market:Get'],[180001,1]);
const deob=fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/deob_main.js'),'utf8');
const tierStart=deob.indexOf('getKillPerMonster');
assert(tierStart>=0);
const tierBody=deob.slice(tierStart,tierStart+3400);
assert.match(tierBody,/0x1194[^]*?_0x559962=0x7[^]*?0x1388[^]*?_0x559962=0xa/);
const useStart=deob.indexOf('0x2bf25===_0x4dc99b');
assert(useStart>=0);
const useBody=deob.slice(useStart,useStart+1400);
assert.match(useBody,/0xc8/);
assert.match(useBody,/\[_0x4dc99b\]\[0x0\]-=0x1/);
assert.match(useBody,/\[_0x478075\]\[0x0\]-=_0x34833a/);
assert.match(useBody,/\[_0x478075\]\[0x0\]<0x64/);
const start=JSON.parse(raw).killValues.godSlaughter;
assert.equal(start,5000);
const alerts=[4800,4900,5000];
const seeds=Array.from({length:11},(_,i)=>i+1);
const rows=[];
for(const alert of alerts)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  assert.equal(run('S.killValues.godSlaughter'),start);
  assert.equal(run('godDomainTier(4900,CFG.godDomain.monsterTiers)'),7);
  assert.equal(run('godDomainTier(5000,CFG.godDomain.monsterTiers)'),10);
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
    enemy:set[0].enemy,coreGain:set.map(r=>r.core-47),survivorsOnWin:set.filter(r=>r.result==='win').map(r=>r.soldiers)};
});
const output='docs/codex/reports/data/p287-core-alert-cleanse-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P287',kind:'Conditional alert adjustment in isolated VM; no potion acquisition or payment',
  source,sourceSha256,entityPath,entitySha256:crypto.createHash('sha256').update(entityRaw).digest('hex'),alerts,seeds,byAlert,rows},null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256,byAlert:byAlert.map(({alert,enemy,wins,coreGain,survivorsOnWin})=>({alert,enemy,wins,coreGain,survivorsOnWin})),output},null,2));
