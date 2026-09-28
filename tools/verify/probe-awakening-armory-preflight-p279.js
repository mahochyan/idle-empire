'use strict';
// Read-only cost/capacity preflight. The level mutations live only inside this disposable VM.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const source='docs/codex/reports/data/p278-awakening-energy4-paid-save.json';
const raw=fs.readFileSync(path.join(root,source),'utf8');
const sha=crypto.createHash('sha256').update(raw).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
const initial=run("({lv:bldSt('electric_armory').lv,lock:upgradeLockReason('electric_armory'),cap:unitCap('star_trooper'),res:{...S.res},capacity:{wood:resCap('wood'),stone:resCap('stone'),food:resCap('food'),copper:resCap('copper'),iron:resCap('iron'),steel:resCap('steel')}})");
assert.equal(initial.lv,32);assert.equal(initial.cap,101);assert.equal(initial.lock,'');
const rows=[],sum={wood:0,stone:0,food:0,time:0};
for(let lv=32;lv<50;lv++){
  // Only evaluate the existing upCost() and unitCap() functions; this VM is discarded.
  run(`S.buildings.electric_armory.lv=${lv}`);
  const cost=run("upCost('electric_armory')");
  const lock=run("upgradeLockReason('electric_armory')");
  const cap=run("unitCap('star_trooper')");
  assert.equal(lock,'',`Lv${lv} upgrade lock`);
  for(const [k,v]of Object.entries(cost)){
    assert.ok(Number.isFinite(v)&&v>=0);
    sum[k]+=v;
    if(k!=='time')assert.ok(v<=initial.capacity[k],`Lv${lv+1} ${k} single payment exceeds capacity`);
  }
  rows.push({from:lv,to:lv+1,cost,starCapBefore:cap});
}
run('S.buildings.electric_armory.lv=50');
const conditionalCap=run("unitCap('star_trooper')");
assert.equal(conditionalCap,155);
const result={batch:'P279',kind:'conditional preflight only; no actions, payment or save',source,sourceSha256:sha,
  initial,rows,sum,conditionalCap,extraStarCap:conditionalCap-initial.cap,
  extraStarCost:{copper:54*8000,iron:54*8000,steel:54*8000}};
const file=path.join(root,'docs/codex/reports/data/p279-awakening-armory-preflight.json');
fs.writeFileSync(file,JSON.stringify(result,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:sha,initial,levels:rows.length,sum,conditionalCap,
  extraStarCap:result.extraStarCap,extraStarCost:result.extraStarCost},null,2));
