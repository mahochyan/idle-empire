'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');

const input=path.join(__dirname,'../../docs/codex/reports/data/p81-wyrm3000-replenished-paid.json');
const raw=fs.readFileSync(input,'utf8'),e=environment({rts_save:raw});
const version=e.run('targetSaveVersion()');
// 历史P82原件是v30；后续schema重放另存文件，绝不覆盖该实付证据。
const output=path.join(__dirname,'../../docs/codex/reports/data/'+(version===30?'p82-arms-up-first-invest-paid.json':'p82-arms-up-first-invest-replay-v'+version+'.json'));
assert.equal(e.run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
const before=e.run('JSON.stringify({tick:S.tick,steel:S.res.steel,army:armyCount(),population:S.population.current,knowledgeCap:resCap("tech")})');
assert.equal(e.run("setPopAlloc('tech',104).ok"),true);
assert.equal(e.run("setPopAlloc('steel',20).ok"),true);
let seconds=0;
while(e.run('S.res.steel')<4000&&seconds<1000){e.run('tick()');seconds++}
assert.equal(seconds,95);
const earned=e.run('S.res.steel');
assert.equal(e.run("investArmsUp('electro_trooper','atk').ok"),true);
assert.equal(e.run('S.res.steel'),earned-4000);
assert.equal(e.run('S.armsUp.electro_trooper.atk.progress'),1);
assert.equal(e.run('S.armsUp.electro_trooper.atk.stars'),0);
assert.equal(e.run('armyCount()'),437);
const saved=e.store.get('rts_save'),reloaded=environment({rts_save:saved});
assert.equal(reloaded.run('loadSaveAndApply().status'),'ok');
assert.equal(reloaded.run('S.armsUp.electro_trooper.atk.progress'),1);
assert.equal(reloaded.run('armyCount()'),437);
fs.writeFileSync(output,saved);
console.log(JSON.stringify({input:path.basename(input),before:JSON.parse(before),seconds,steelEarned:earned-229,steelPaid:4000,
  after:JSON.parse(e.run('JSON.stringify({tick:S.tick,steel:S.res.steel,army:armyCount(),population:S.population.current,knowledgeCap:resCap("tech"),armsUp:S.armsUp.electro_trooper})')),
  output:path.basename(output),sha256:crypto.createHash('sha256').update(saved).digest('hex'),reload:'ok'},null,2));
