'use strict';
// Verify that every P270 report still points to the exact current input and paid save.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const prefix='docs/codex/reports/data/';
const names=['p270-nuclear-mixed','p270-nuclear-scroll-hunt','p270-nuclear-scroll-exchange',
  'p270-nuclear-scroll-hunt-tigerPelt','p270-nuclear-scroll-exchange-tiger','p270-nuclear-research-paid'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let elapsed=0,scrolls=0,winHunts=0;
let previousSaveFile=null;
const rows=[];
for(const name of names){
  const report=JSON.parse(fs.readFileSync(path.join(root,prefix+name+'.json'),'utf8'));
  if(previousSaveFile)assert.equal(report.sourceFile,previousSaveFile,`${name} source path`);
  const sourceRaw=fs.readFileSync(path.join(root,report.sourceFile),'utf8');
  assert.equal(sha(sourceRaw),report.sourceSha256,`${name} source hash`);
  const outputFile=report.saveFile||report.lastRecovered?.saveFile;
  const outputHash=report.saveSha256||report.lastRecovered?.sha256;
  assert.ok(outputFile&&outputHash);
  const outputRaw=fs.readFileSync(path.join(root,outputFile),'utf8');
  assert.equal(sha(outputRaw),outputHash,`${name} paid save hash`);
  const e=environment({rts_save:outputRaw});
  assert.equal(e.run('loadSaveAndApply().status'),'ok',`${name} reloaded`);
  assert.equal(e.run('popCurrent()'),1002);
  assert.ok(e.run("S.res.food")>0);
  previousSaveFile=outputFile;
  elapsed+=report.elapsedOnlineSec;
  scrolls+=report.purchases||report.purchased||0;
  winHunts+=(report.rows||[]).filter(x=>x.win).length;
  rows.push({name,sourceSha256:report.sourceSha256,outputSha256:outputHash,elapsedOnlineSec:report.elapsedOnlineSec,
    army:e.run('armyCount()'),cap:e.run("resCap('tech')"),scrollUsed:e.run('S.beastExchange.scrollUsed')});
}
assert.equal(scrolls,11);assert.equal(winHunts,80);assert.equal(elapsed,379171);
const final=environment({rts_save:fs.readFileSync(path.join(root,previousSaveFile),'utf8')});
assert.equal(final.run('loadSaveAndApply().status'),'ok');
assert.equal(final.run("scienceUnlocked('sci_nuclear_age')"),true);
assert.equal(final.run('S.pool.star_trooper'),1);
assert.equal(final.run('S.res.medal'),23856);
assert.equal(final.run("resCap('tech')"),100368153);
console.log(JSON.stringify({rows,scrolls,winHunts,elapsedOnlineSec:elapsed,elapsedHours:elapsed/3600,
  final:{army:final.run('armyCount()'),starScience:final.run("scienceUnlocked('sci_nuclear_age')"),starPool:final.run('S.pool.star_trooper'),medal:final.run('S.res.medal'),techCap:final.run("resCap('tech')")}}));
