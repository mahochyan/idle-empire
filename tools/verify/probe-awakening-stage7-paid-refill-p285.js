'use strict';
// Stage-7 fixed-stream pressure from the actual paid level-6 replenishment save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw});
assert.equal(e.run('loadSaveAndApply().status'),'ok');
assert.equal(e.run('S.awakening.star_trooper.level'),6);
assert.equal(e.run('formSoldierCount()'),626);
const probe=path.join(__dirname,'probe-awakening-101star-pressure-p276.js'),rows=[];
for(let seed=1;seed<=11;seed++){
  const label=`stage7-paid-full-seed${seed}`;
  execFileSync(process.execPath,[probe,`--input=${source}`,`--label=${label}`,'--output-prefix=p285',`--seed=${seed}`,'--max-steps=3'],
    {cwd:root,stdio:'pipe'});
  const output=`p285-awakening-101star-${label}-pressure.json`;
  const report=JSON.parse(fs.readFileSync(path.join(data,output),'utf8'));
  const trial=report.rows.find(r=>r.kind==='trial');
  rows.push({seed,output,fruitWins:report.rows.filter(r=>r.kind==='fruit'&&r.result==='win').length,
    trial:trial?{result:trial.result,enemyHpLeft:trial.enemyHpLeft,level:trial.level,
      soldiers:trial.soldiers,star:trial.star,fruit:trial.fruit,callbacks:trial.callbacks}:null,
    last:report.summary.last});
}
const summary={batch:'P285',kind:'paid full-roster source; real fruit battles and trial payments, independent fixed streams',
  source,sourceSha256:sha(raw),rows,trialStarts:rows.filter(r=>r.trial).length,
  trialWins:rows.filter(r=>r.trial?.result==='win').length};
const output='p285-awakening-stage7-paid-refill-summary.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(summary,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:summary.sourceSha256,trialStarts:summary.trialStarts,trialWins:summary.trialWins,
  rows:rows.map(r=>({seed:r.seed,fruitWins:r.fruitWins,trial:r.trial})),output},null,2));
