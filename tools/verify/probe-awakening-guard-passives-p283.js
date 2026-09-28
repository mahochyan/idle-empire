'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const probe=path.join(__dirname,'probe-awakening-101star-pressure-p276.js');
const sources={
  stage5:'p277-awakening-steam3-energy3-rifle2-sniper2-paid-save.json',
  stage5NanoOnePaid:'p283-awakening-stage4-nano1-paid-save.json',
  stage6:'p279-awakening-star155-paid-save.json',
  stage6AttackOneStar:'p282-awakening-arms-up-one-star-paid-save.json'
};
const hashes=Object.fromEntries(Object.entries(sources).map(([key,file])=>
  [key,crypto.createHash('sha256').update(fs.readFileSync(path.join(data,file))).digest('hex')]));
const rows=[];
for(const [variant,input]of Object.entries(sources))for(let seed=1;seed<=11;seed++){
  const label=`${variant.toLowerCase()}-seed${seed}`;
  const maxSteps=variant.startsWith('stage5')?2:1;
  execFileSync(process.execPath,[probe,`--input=${input}`,`--label=${label}`,'--output-prefix=p283',`--seed=${seed}`,`--max-steps=${maxSteps}`],
    {cwd:root,stdio:'pipe'});
  const output=`p283-awakening-101star-${label}-pressure.json`;
  const report=JSON.parse(fs.readFileSync(path.join(data,output),'utf8'));
  const last=report.summary.last;
  assert.equal(report.summary.seed,seed);
  assert.equal(last.kind,'trial',`${variant} seed ${seed} did not reach trial`);
  rows.push({variant,seed,output,result:last.result,level:last.level,enemyHpLeft:last.enemyHpLeft,
    soldiers:last.soldiers,star:last.star,callbacks:last.callbacks,trialFruit:last.fruit});
}
const byVariant=Object.keys(sources).map(variant=>{
  const set=rows.filter(r=>r.variant===variant),hp=set.map(r=>r.enemyHpLeft);
  return{variant,wins:set.filter(r=>r.result==='win').length,
    minEnemyHpLeft:Math.min(...hp),maxEnemyHpLeft:Math.max(...hp),
    meanEnemyHpLeft:hp.reduce((n,v)=>n+v,0)/hp.length};
});
const before=JSON.parse(fs.readFileSync(path.join(data,'p281-awakening-guard-mapping-summary.json'),'utf8'));
const delta=Array.from({length:11},(_,i)=>{
  const seed=i+1,old=before.rows.find(r=>r.seed===seed),now=rows.find(r=>r.variant==='stage6'&&r.seed===seed);
  return{seed,oldEnemyHpLeft:old.stage6.enemyHpLeft,newEnemyHpLeft:now.enemyHpLeft,
    deltaEnemyHpLeft:now.enemyHpLeft-old.stage6.enemyHpLeft};
});
const report={batch:'P283',unit:'soldiers, battle HP, items',sources,hashes,byVariant,delta,rows};
const file='p283-awakening-guard-passives-summary.json';
fs.writeFileSync(path.join(data,file),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({hashes,byVariant,delta,file},null,2));
