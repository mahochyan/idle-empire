'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const dir=path.join(__dirname,'../../docs/codex/reports/data');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
const sourceSha256={
  firstStage:hash('p275-awakening-source-paid-save.json'),
  stage5:hash('p277-awakening-steam3-energy3-rifle2-sniper2-paid-save.json'),
  stage6:hash('p279-awakening-star155-paid-save.json')
};
assert.equal(sourceSha256.firstStage,'b93762778919200d62c76e70c1c88dee525e2f158d7d83927123b90675cdbe37');
assert.equal(sourceSha256.stage6,'5624c6aff153cb687b1e5d2a3b58402e5d34c69a2152c6a6a636e8c38f07e79b');
const early=read('p281-final-early-pressure.json');
assert.equal(early.summary.start.level,1);
assert.equal(early.summary.last.level,4);
assert.equal(early.summary.trialWins,3);
const rows=[];
for(let seed=1;seed<=11;seed++){
  const stage5=read(`p281-final-awakening-101star-stage5-seed${seed}-pressure.json`).summary;
  const stage6=read(`p281-final-awakening-101star-stage6-seed${seed}-pressure.json`).summary;
  const previous=read(`p280-final-awakening-101star-seed${seed}-pressure.json`).summary;
  const old=read(`p281-causal-awakening-101star-old-seed${seed}-pressure.json`).summary;
  const attrition=read(`p281-causal-awakening-101star-attrition-seed${seed}-pressure.json`).summary;
  const scale=read(`p281-causal-awakening-101star-scale-seed${seed}-pressure.json`).summary;
  assert.equal(stage5.seed,seed);assert.equal(stage6.seed,seed);assert.equal(previous.seed,seed);
  assert.equal(old.last.enemyHpLeft,previous.last.enemyHpLeft,`P280 baseline seed ${seed}`);
  assert.equal(stage5.start.level,4);assert.equal(stage6.start.level,5);
  assert.equal(stage6.last.result,'lose');assert.equal(stage6.last.level,5);
  rows.push({seed,stage5:{result:stage5.last.result,level:stage5.last.level,
    enemyHpLeft:stage5.last.enemyHpLeft,soldiers:stage5.last.soldiers},
    stage6:{result:stage6.last.result,enemyHpLeft:stage6.last.enemyHpLeft},
    priorStage6EnemyHpLeft:previous.last.enemyHpLeft,
    causal:{attritionOnly:attrition.last.enemyHpLeft,scaleOnly:scale.last.enemyHpLeft}});
}
const formation=read('p281-awakening-star155-formation.json');
assert.equal(formation.tested,66);assert.equal(formation.wins,0);
assert.equal(formation.sourceSha256,sourceSha256.stage6);
const hp=rows.map(row=>row.stage6.enemyHpLeft);
const priorHp=rows.map(row=>row.priorStage6EnemyHpLeft);
const stats=values=>({minEnemyHpLeft:Math.min(...values),maxEnemyHpLeft:Math.max(...values),
  meanEnemyHpLeft:values.reduce((sum,n)=>sum+n,0)/values.length});
const result={sourceSha256,
  early:{steps:early.summary.steps,wins:early.summary.wins,trialWins:early.summary.trialWins,
    lastLevel:early.summary.last.level,lastResult:early.summary.last.result},
  stage5:{tested:11,wins:rows.filter(row=>row.stage5.level===5).length},
  stage6:{tested:11,wins:0,...stats(hp),
    improvedSeedCount:rows.filter(row=>row.stage6.enemyHpLeft<row.priorStage6EnemyHpLeft).length},
  causal:{old:stats(priorHp),attritionOnly:stats(rows.map(row=>row.causal.attritionOnly)),
    scaleOnly:stats(rows.map(row=>row.causal.scaleOnly)),both:stats(hp),baselineMatchesP280:true},
  formations:{tested:formation.tested,wins:formation.wins,byVariant:formation.byVariant},rows};
assert.equal(result.stage5.wins,3);
assert.equal(result.stage6.improvedSeedCount,11);
fs.writeFileSync(path.join(dir,'p281-awakening-guard-mapping-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({early:result.early,stage5:result.stage5,stage6:result.stage6,formations:result.formations},null,2));
