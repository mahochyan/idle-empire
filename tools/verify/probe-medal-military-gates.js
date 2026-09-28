'use strict';
// 真实新档到科研精通20级后的军事门槛快照。只读；时间单位为在线秒。
// 与条件预置战斗探针分开，避免把未解锁的阵位或未招募的兵当成已获得。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
for(const flag of ['--steel-mastery-early','--steel-mastery-20','--steel-mastery-hunt-10','--iron-store=300'])
  assert.ok(process.argv.includes(flag),`须带${flag}保持同一新档对照路线`);
const prior=fs.readFileSync(path.join(__dirname,'probe-scholar-mastery-full.js'),'utf8');
const {run}=new Function('require','console','__dirname',prior+'\nreturn {run};')(
  require,{log(){},error:console.error},__dirname);
const rows=['front','mid','back'];
const currentSlots=Object.fromEntries(rows.map(row=>[row,run(`rowSlots('${row}')`)]));
const formation=run('S.formation');
const pool=run('S.pool');
const unitKeys=['alloy_special','armored_trooper','electro_trooper','archer'];
const units=Object.fromEntries(unitKeys.map(key=>[key,{
  owned:(pool[key]||0)+rows.reduce((sum,row)=>sum+formation[row].filter(u=>u.type===key).reduce((n,u)=>n+u.count,0),0),
  trainingCap:run(`unitCap('${key}')`),
  building:run(`trainBuildingKey('${key}')`),
  buildingLevel:run(`bldSt(trainBuildingKey('${key}')).lv`)
}]));
const unlocks=[5,10,15,20,25,30,35,40,45].map(stage=>{
  const row=rows[(stage/5-1)%3];
  return {stage,row,cleared:run(`hasLevelDefeated(${stage-1})`)};
});
assert.deepEqual(currentSlots,{front:1,mid:1,back:1});
assert.equal(run('S.defeated.length'),0);
assert.equal(unlocks.every(x=>!x.cleared),true);
assert.equal(run('S.scholarMasteryLv'),20);
assert.equal(run('S.res.medal'),774);
const regimentLimit=run('regMax()');
const barracksLevelFor55=Math.ceil((55-5)/5);
const militaryUnitLevelFor55=Math.ceil((55-5)/3);
const conditionalRosterSize=655;
console.log(JSON.stringify({unit:'online seconds; soldier count; stage number',
  second:run('S.tick'),population:run('S.population.current'),stageWins:run('S.defeated.length'),
  scholarMastery:run('S.scholarMasteryLv'),medal:run('S.res.medal'),
  currentSlots,regimentLimit,units,unlocks,
  stage45MaxSlots:12,barracksLevelFor55,militaryUnitLevelFor55,
  conditionalRosterSize,conditionalRosterUsesPreseededTroops:true,
  warning:'The 655-soldier fight is conditional, not a legal snapshot of this new-game route.'},null,2));
