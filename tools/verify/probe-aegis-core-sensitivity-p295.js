'use strict';
// Unpaid conditional sensitivity using real combat. Source compound bonuses are injected only in the isolated VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(raw),'63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae');
const entities=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
assert.equal(entities[180003]['itemPill:AddDEF'],1);
assert.equal(entities[180003]['itemPill:LimitNum'],30);
assert.deepEqual(entities[380029]['market:Need'],[180002,3]);
assert.deepEqual(entities[380029]['market:Get'],[180003,1]);
const alerts=[4900,5000],units=['electro_trooper','armored_trooper','star_trooper'];
const dosesList=[0,1,3,10,30],seeds=Array.from({length:11},(_,i)=>i+1),rows=[];
for(const alert of alerts)for(const unit of units)for(const doses of dosesList)for(const seed of seeds){
  const e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  run(`S.killValues.godSlaughter=${alert};Date.now=()=>1790496000000;
    globalThis.__timers=new Map();globalThis.__timerId=1;
    setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};clearTimeout=id=>__timers.delete(id);
    __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};addLog=m=>S.log.push(String(m));
    globalThis.__baseVitals=battleVitals;globalThis.__baseAttack=weaponAttack;globalThis.__baseDefense=weaponDefense;
    battleVitals=(uk,count,owned=false)=>{
      const v=__baseVitals(uk,count,owned);
      if(owned&&uk==='${unit}'){
        const add=CFG.units[uk].hpPerSoldier*0.05*${doses};
        v.hpPerSoldier+=add;v.hp+=count*add;v.maxHp=v.hp;
      }
      return v};
    weaponAttack=uk=>__baseAttack(uk)+(uk==='${unit}'?CFG.units[uk].atk*0.05*${doses}:0);
    weaponDefense=uk=>__baseDefense(uk)+(uk==='${unit}'?${doses}:0);
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=run('formSoldierCount()');
  run("openMaterialDomain('medal')");
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<4000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  rows.push({alert,unit,doses,seed,result:run("document.getElementById('battle-result').className"),
    soldiersLost:before-run('formSoldierCount()'),enemyHpLeft:run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)')});
}
const summary=[];
for(const alert of alerts)for(const unit of units)for(const doses of dosesList){
  const set=rows.filter(r=>r.alert===alert&&r.unit===unit&&r.doses===doses);
  summary.push({alert,unit,doses,wins:set.filter(r=>r.result==='win').length,
    winSeeds:set.filter(r=>r.result==='win').map(r=>r.seed),minSoldiersLost:Math.min(...set.map(r=>r.soldiersLost))});
}
for(const alert of alerts){
  const baseline=summary.filter(r=>r.alert===alert&&r.doses===0).map(r=>r.winSeeds);
  assert.deepEqual(baseline[0],baseline[1]);assert.deepEqual(baseline[1],baseline[2]);
  assert.equal(baseline[0].length,alert===4900?1:0);
}
assert.equal(sha(fs.readFileSync(path.join(root,source),'utf8')),sha(raw));
const output='docs/codex/reports/data/p295-aegis-core-sensitivity.json';
fs.writeFileSync(path.join(root,output),JSON.stringify({batch:'P295',kind:'unpaid conditional mother 180003 compound bonus, real battle implementation',
  source,sourceSha256:sha(raw),alerts,units,dosesList,seeds,summary,rows},null,2)+'\n','utf8');
console.log(JSON.stringify({output,summary},null,2));
