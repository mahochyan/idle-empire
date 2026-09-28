'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const input='p284-awakening-stage5-nano10-paid-save.json';
const raw=fs.readFileSync(path.join(data,input));
const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
const probe=path.join(__dirname,'probe-awakening-101star-pressure-p276.js');
const rows=[];
for(let seed=1;seed<=11;seed++){
  const label=`nano10-paid-seed${seed}`;
  execFileSync(process.execPath,[probe,`--input=${input}`,`--label=${label}`,'--output-prefix=p284',`--seed=${seed}`,'--max-steps=1'],
    {cwd:root,stdio:'pipe'});
  const output=`p284-awakening-101star-${label}-pressure.json`;
  const report=JSON.parse(fs.readFileSync(path.join(data,output),'utf8'));
  const trial=report.summary.last;
  assert.equal(report.summary.seed,seed);
  assert.equal(report.summary.start.level,5);
  assert.equal(report.summary.start.soldiers,626);
  assert.equal(report.summary.start.star,155);
  assert.equal(trial.kind,'trial');
  rows.push({seed,output,result:trial.result,enemyHpLeft:trial.enemyHpLeft,
    level:trial.level,soldiers:trial.soldiers,star:trial.star,fruit:trial.fruit,callbacks:trial.callbacks});
}
const wins=rows.filter(r=>r.result==='win');
const report={batch:'P284',kind:'paid nano-10 source save; real trialFruit payment and real async battle, selected fixed seeds',
  input,sourceSha256,wins:wins.length,rows};
const output='p284-awakening-nano10-stage6-paid-pressure.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n','utf8');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(data,input))).digest('hex'),sourceSha256);
console.log(JSON.stringify({sourceSha256,wins:wins.length,winRows:wins,
  minEnemyHpLeft:Math.min(...rows.map(r=>r.enemyHpLeft)),maxEnemyHpLeft:Math.max(...rows.map(r=>r.enemyHpLeft)),output},null,2));
