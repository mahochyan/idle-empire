'use strict';
// Expand P171's paid L5→L10 route to the three remaining P167 RNG seeds.
// Source changes are made only in memory; player code and P171 stay intact.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

const p171Path=path.join(__dirname,'probe-paid-regiment-capacity-p171.js');
const outputPath=path.resolve(__dirname,'../../docs/codex/reports/data/p174-paid-regiment-seed-sweep.json');
function replaceOnce(source,needle,replacement,label){
  const i=source.indexOf(needle);
  assert.notEqual(i,-1,`P174找不到${label}`);
  assert.equal(source.indexOf(needle,i+needle.length),-1,`P174的${label}不唯一`);
  return source.slice(0,i)+replacement+source.slice(i+needle.length);
}
let source=fs.readFileSync(p171Path,'utf8');
source=replaceOnce(source,"const seeds=[1,42],policyName='food-food',maxWait=3600,postVictoryWait=600;",
  "const seeds=[2,3,12345],policyName='food-food',maxWait=3600,postVictoryWait=600;",'随机流名单');
source=replaceOnce(source,
  "const outputPath=path.join(root,'docs/codex/reports/data/p171-paid-regiment-capacity.json');",
  "const outputPath=path.join(root,'docs/codex/reports/data/p174-paid-regiment-seed-sweep.json');",
  '独立输出路径');
source=replaceOnce(source,
  "  'tools/verify/probe-paid-regiment-capacity-p171.js'];",
  "  'tools/verify/probe-paid-regiment-capacity-p171.js',\n  'tools/verify/probe-paid-regiment-seed-sweep-p174.js'];",
  '输入文件清单');
source=replaceOnce(source,"const artifact={batch:'P171'","const artifact={batch:'P174'",'数据批号');
source=replaceOnce(source,"console.log(JSON.stringify({batch:'P171'","console.log(JSON.stringify({batch:'P174'",'日志批号');
source=replaceOnce(source,'method:\'P170 in-memory real P167',
  'method:\'P174 in-memory reuse of P171 paid route from P170 real P167',
  '方法说明');
source=replaceOnce(source,
  'return{tick:s.tick,resources:s.resources,merit:s.merit,workers:s.workers,',
  'return{tick:s.tick,population:s.population,capacity:s.capacity,resources:s.resources,merit:s.merit,workers:s.workers,',
  '终态人口记录');
new Function('require','console','__dirname',source)(
  createRequire(p171Path),{log(){},error:console.error},path.dirname(p171Path));
const artifact=JSON.parse(fs.readFileSync(outputPath,'utf8'));
assert.equal(artifact.batch,'P174');
assert.deepEqual(artifact.scope.seeds,[2,3,12345]);
assert.equal(artifact.profiles.length,6);
for(const input of artifact.inputs){
  const actual=crypto.createHash('sha256')
    .update(fs.readFileSync(path.resolve(__dirname,'../..',input.file)))
    .digest('hex');
  assert.equal(actual,input.sha256,`${input.file}读取期间发生变更`);
}
for(const profile of artifact.profiles){
  assert.ok(profile.route.battles.length>0||profile.route.block,
    `种子${profile.seed}/${profile.branch}缺少结算或阻断信息`);
  assert.ok(Number.isFinite(profile.route.minFood));
  assert.ok(Number.isInteger(profile.route.final.population));
  assert.ok(Number.isInteger(profile.route.final.capacity));
}
console.log(JSON.stringify({batch:'P174',rawData:outputPath,
  profiles:artifact.profiles.map(profile=>({seed:profile.seed,branch:profile.branch,
    block:profile.route.block,firstLoss:profile.route.firstLoss,
    clearedL10:profile.route.clearedL10,minFood:profile.route.minFood,
    elapsedToL6:profile.route.firstBattleTick==null?null:
      profile.route.firstBattleTick-profile.route.initial.tick,
    elapsedToFinal:profile.route.final.tick-profile.route.initial.tick,
    finalPopulation:profile.route.final.population,
    finalCapacity:profile.route.final.capacity,
    rounds:profile.route.battles.map(battle=>battle.round),
    l10Remaining:profile.route.battles.at(-1)?.after.owned||null}))}));
