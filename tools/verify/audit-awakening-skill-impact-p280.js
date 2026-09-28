'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const dir=path.join(__dirname,'../../docs/codex/reports/data');
function read(name){return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))}
function hp(name){
  const report=read(name),row=report.summary.last;
  assert.equal(report.summary.steps,1,name);
  assert.equal(row.kind,'trial',name);
  assert.equal(row.result,'lose',name);
  assert.equal(row.level,5,name);
  assert.equal(row.soldiers,0,name);
  return row.enemyHpLeft;
}
const input=fs.readFileSync(path.join(dir,'p279-awakening-star155-paid-save.json'));
const inputSha256=crypto.createHash('sha256').update(input).digest('hex');
assert.equal(inputSha256,'5624c6aff153cb687b1e5d2a3b58402e5d34c69a2152c6a6a636e8c38f07e79b');
const rows=[];
for(let seed=1;seed<=11;seed++){
  const historical=hp(`p279-awakening-101star-star155-level6-seed${seed}-pressure.json`);
  const base=hp(`p280-impact-awakening-101star-base-seed${seed}-pressure.json`);
  const star=hp(`p280-impact-awakening-101star-star-seed${seed}-pressure.json`);
  const guard=hp(`p280-impact-awakening-101star-guard-seed${seed}-pressure.json`);
  const both=hp(`p280-final-awakening-101star-seed${seed}-pressure.json`);
  assert.equal(base,historical,`historical seed ${seed}`);
  rows.push({seed,base,star,guard,both});
}
const stats={};
for(const key of ['base','star','guard','both']){
  const values=rows.map(row=>row[key]);
  stats[key]={wins:0,min:Math.min(...values),max:Math.max(...values),
    mean:values.reduce((sum,value)=>sum+value,0)/values.length};
}
const report={inputSha256,seeds:rows.length,baselineMatchesHistorical:true,
  starImprovesVsBase:rows.filter(row=>row.star<row.base).length,
  bothImprovesVsBase:rows.filter(row=>row.both<row.base).length,
  stats,rows};
fs.writeFileSync(path.join(dir,'p280-awakening-skill-impact-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({inputSha256,seeds:report.seeds,starImprovesVsBase:report.starImprovesVsBase,
  bothImprovesVsBase:report.bothImprovesVsBase,stats},null,2));
