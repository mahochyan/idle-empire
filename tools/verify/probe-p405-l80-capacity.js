'use strict';
// P405 L80: pay for warehouse, camp capacity and a larger pre-steam army; no runtime edits.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {session}=require('./probe-p405-mainline-continuous');
const root=path.resolve(__dirname,'../..');
const input='docs/codex/reports/data/p405-mainline-continuous-final-save.json';
const output='docs/codex/reports/data/p405-l80-capacity.json';
const sourceFiles=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-p405-mainline-continuous.js',input];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const sourceHash=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const raw=fs.readFileSync(path.join(root,input),'utf8').trim();
const s=session(raw),run=s.run;
assert.equal(run('S.defeated.length'),79);
const paidBuild={},steps=[];
const constructionWorkers={food:12,wood:4,stone:3};
function addCost(target,cost){for(const [rk,n]of Object.entries(cost))if(rk!=='time')target[rk]=(target[rk]||0)+n}
function waitUntil(expr,max,label){
  let elapsed=0;
  while(!run(expr)&&elapsed<max){s.wait(10);elapsed+=10}
  assert.equal(!!run(expr),true,`${label} timed out after ${elapsed} seconds: ${JSON.stringify(s.state())}`);
  return elapsed;
}
function build(key,target){
  while(run(`bldSt('${key}').lv`)<target){
    const level=run(`bldSt('${key}').lv`)+1;
    const cost=JSON.parse(run(`JSON.stringify(bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}'))`));
    assert.equal(run(`upgradeLockReason('${key}')`),'',`${key} Lv${level} cap`);
    for(const [rk,n]of Object.entries(cost))if(rk!=='time')
      assert.ok(n<=run(`resCap('${rk}')`),`${key} Lv${level} ${rk} cost ${n} exceeds cap`);
    const seconds=waitUntil(`Object.entries(bldSt('${key}').lv===0?buildingInitialCost('${key}'):upCost('${key}'))
      .every(([rk,n])=>rk==='time'||S.res[rk]>=n)`,20000,`${key} Lv${level} materials`);
    const result=JSON.parse(run(`JSON.stringify(buildAct('${key}'))`));
    assert.equal(result?.ok,true,`${key} Lv${level}: ${JSON.stringify(result)}`);
    addCost(paidBuild,cost);
    const work=waitUntil(`bldSt('${key}').lv>=${level}&&bldSt('${key}').state==='idle'`,300,`${key} Lv${level} finish`);
    s.saveReload(`${key} Lv${level}`);
    steps.push({kind:'build',key,level,cost,waitSeconds:seconds,buildSeconds:work,
      online:s.online(),caps:{wood:run("resCap('wood')"),stone:run("resCap('stone')"),food:run("resCap('food')")}});
  }
}
let failure=null,readyPath=null,finalPath=null,battle=null,fills=[];
try{
  s.setWorkers(constructionWorkers);
  // Farm's workshop cost jumps after Lv10; expand basic wood/stone capacity first.
  build('warehouse',12);
  build('barracks',2);
  build('large_granary',1);
  build('farm',20);
  build('archer_range',4);
  build('silver_armory',6);
  build('gold_armory',8);
  assert.equal(run('regMax()'),15);
  assert.equal(run("unitCap('archer_silverbow')"),54);
  assert.equal(run("unitCap('silver_heavy')"),40);
  assert.equal(run("unitCap('gold_cavalry')"),29);
  fills.push(s.fill('archer_silverbow',54,{food:13,wood:4,stone:2}));
  fills.push(s.fill('silver_heavy',40,{food:14,coal:1,silver:1,stone:1,wood:2}));
  fills.push(s.fill('gold_cavalry',29,{food:14,coal:1,gold:1,stone:1,wood:2}));
  s.form([
    ['front','gold_cavalry',15],['front','gold_cavalry',14],
    ['front','silver_heavy',15],['front','silver_heavy',15],
    ['mid','silver_heavy',10],['mid','iron_spearman',10],
    ['mid','iron_spearman',10],['mid','bronze_guard',15],
    ['back','archer_silverbow',15],['back','archer_silverbow',15],
    ['back','archer_silverbow',15],['back','archer_silverbow',9]
  ]);
  assert.equal(run('formSoldierCount()'),158);
  readyPath='docs/codex/reports/data/p405-l80-capacity-ready-save.json';
  fs.writeFileSync(path.join(root,readyPath),s.raw()+'\n');
  battle=s.battle(80);
  finalPath='docs/codex/reports/data/p405-l80-capacity-final-save.json';
  fs.writeFileSync(path.join(root,finalPath),s.raw()+'\n');
}catch(error){failure=String(error.stack||error);console.error(failure)}
const result={batch:'P405',input,inputSha256:sourceHash[input],sourceHash,
  method:'L79 real paid v36 save; actual worker assignment, building upgrades, queues, modal formation, L80 battle and independent reload; fixed Math.random 0.5',
  units:'online is simulated noncombat tick seconds; battleMs is simulated callback milliseconds; menu actions are instant in harness',
  constructionWorkers,paidBuild,steps,fills,trainingPaid:s.charges(),online:s.online(),battle,
  readyPath,readySha256:readyPath?hash(readyPath):null,
  finalPath,finalSha256:finalPath?hash(finalPath):null,failure};
fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
assert.deepEqual(Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),sourceHash);
console.log(JSON.stringify({online:result.online,paidBuild,trainingPaid:result.trainingPaid,
  ready:readyPath,battle:{won:battle?.won,round:battle?.round,armyBefore:battle?.armyBefore,
    armyAfter:battle?.armyAfter,enemyRemaining:battle?.enemyRemaining},failure}));
if(failure)process.exitCode=1;
