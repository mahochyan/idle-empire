'use strict';
// P398: actual eighth then ninth star-beast wins, replenishment and alert calm
// from the same real-paid 50-star save. No direct S resource/army/progress edits.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/codex/reports/data');
const sourceFile='p398-star-beast-star50-paid-save.json',sourcePath=path.join(dir,sourceFile);
const raw=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const paidLedger=JSON.parse(fs.readFileSync(path.join(dir,'p398-star-beast-star50-paid.json'),'utf8'));
assert.equal(sha(raw),paidLedger.milestones.find(x=>x.target===50)?.sha256);
const source=JSON.parse(raw),targetFormation=source.formation;
const runtimeFiles=['config.js','levels.js','math.js','garrison.js','technology.js','tests/progression/harness.js'];
const runtimeSha256=Object.fromEntries(runtimeFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f),'utf8'))]));
const NativeDate=Date;
let nowMs=source.ts;
global.Date=class ProbeDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[nowMs]));}
  static now(){return nowMs;}
};
function boot(saved,seed=1){
  const env=environment({rts_save:saved}),run=env.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,{fn,delay});return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;
      __timers.delete(first[0]);first[1].fn();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
  return{env,run};
}
function state(run){return run(`({tick:S.tick,city:S.settlements.city,deed:S.res.deed,
  stars:S.steamMilitaryStars,multiplier:steamMilitaryStatMultiplier(),
  field:steamMilitaryFieldSize(),army:armyCount(),deployed:formSoldierCount(),
  alert:S.killValues.starBeast,daily:{...S.daily.counts},
  items:{origin:S.items.starOriginStone,illusion:S.items.illusionStone,
    ring:S.items.sacredRingCore},
  resources:{food:S.res.food,copper:S.res.copper,iron:S.res.iron,
    steel:S.res.steel,tech:S.res.tech,medal:S.res.medal}})`)}
function checkpoint(world){
  assert.equal(world.run('save().ok'),true);
  const saved=world.env.store.get('rts_save'),reload=boot(saved);
  assert.equal(JSON.stringify(state(reload.run)),JSON.stringify(state(world.run)));
  return saved;
}
function fight(saved,tier,seed){
  const world=boot(saved,seed),{run}=world,before=state(run);
  const encounter=run(`materialDomainEncounter('starBeast${tier}')`);
  run(`openMaterialDomain('starBeast${tier}')`);
  assert.equal(run('S.battleActive'),true);
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<10000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<10000);
  const result=run("document.getElementById('battle-result').className");
  const enemyHpLeft=run('B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)');
  const after=state(run),afterRaw=checkpoint(world);
  return{tier,seed,result,enemyHpLeft,
    enemyInitialHp:run('B.enemyUnits.reduce((n,u)=>n+u.maxHp,0)'),
    callbacks,loss:before.army-after.army,
    rewardEach:after.items.ring-before.items.ring,
    expectedReward:encounter.reward.sacredRingCore,
    before,after,sha256:sha(afterRaw),raw:afterRaw};
}
const out={sourceFile,sourceSha256:sha(raw),runtimeSha256,start:state(boot(raw).run),
  simulatedOnlineSeconds:0,simulatedOfflineSeconds:0};
// Seed 2 exercises the paid post-battle training path; prior conditional sweep
// showed all 16 fixed streams win at 50 stars, including this one.
const eighth=fight(raw,8,2);
assert.equal(eighth.result,'win',`eighth left ${eighth.enemyHpLeft} enemy HP`);
assert.equal(eighth.rewardEach,eighth.expectedReward);
assert.ok(eighth.loss>0);
out.eighth={...eighth,raw:undefined,file:'p398-star-beast-eight-win-paid-save.json'};
function restore(saved,loss){
  const world=boot(saved),{run}=world,before=state(run);
  const target={};
  for(const groups of Object.values(targetFormation))for(const u of groups)
    target[u.type]=(target[u.type]||0)+u.count;
  run("clrForm('expedition')");
  const need={};
  for(const [uk,count]of Object.entries(target))
    need[uk]=Math.max(0,count-run(`poolAvail(${JSON.stringify(uk)})`));
  const costs={};let seconds=0;
  for(const [uk,n]of Object.entries(need)){
    if(n<1)continue;
    const cost=run(`({...CFG.units[${JSON.stringify(uk)}].cost})`);
    for(const [resource,amount]of Object.entries(cost)){
      const due=amount*n;
      assert.ok(run(`S.res.${resource}`)>=due,`insufficient ${resource}`);
      costs[resource]=(costs[resource]||0)+due;
    }
    const queued=run(`train(${JSON.stringify(uk)},${n})`);
    assert.equal(queued.ok,true,JSON.stringify(queued));
    while(run(`poolAvail(${JSON.stringify(uk)})`)<target[uk]&&seconds<100){
      nowMs+=1000;run('tick()');seconds++;
    }
    assert.ok(run(`poolAvail(${JSON.stringify(uk)})`)>=target[uk],'training timeout');
  }
  for(const [row,groups]of Object.entries(targetFormation))groups.forEach((u,slot)=>{
    run(`openFormModal('expedition',${JSON.stringify(row)},${slot});
      S._formModalSel=${JSON.stringify(u.type)};S._formModalQty=${u.count};confirmForm()`);
    assert.equal(run(`S.formation.${row}[${slot}].count`),u.count);
  });
  const after=state(run),restored=checkpoint(world);
  assert.equal(after.army,before.army+loss);
  assert.equal(after.deployed,out.start.deployed);
  for(const [resource,due]of Object.entries(costs))
    assert.equal(before.resources[resource]-after.resources[resource],due,
      `training ${resource} debit`);
  out.simulatedOnlineSeconds+=seconds;
  return{before,need,costs,seconds,after,sha256:sha(restored),raw:restored};
}
const restored=restore(eighth.raw,eighth.loss);
out.restore={...restored,raw:undefined,file:'p398-star-beast-eight-refilled-paid-save.json'};
const calmWorld=boot(restored.raw),calmBefore=state(calmWorld.run);
const calm=calmWorld.run('calmStarBeastAlert()');
assert.equal(calm.ok,true,JSON.stringify(calm));
const calmAfter=state(calmWorld.run),calmRaw=checkpoint(calmWorld);
assert.equal(calmAfter.alert,0);
out.calm={action:calm,before:calmBefore,after:calmAfter,
  sha256:sha(calmRaw),file:'p398-star-beast-eight-calm-paid-save.json'};
const ninth=fight(calmRaw,9,1);
assert.equal(ninth.result,'win',`ninth left ${ninth.enemyHpLeft} enemy HP`);
assert.equal(ninth.rewardEach,ninth.expectedReward);
out.ninth={...ninth,raw:undefined,file:'p398-star-beast-nine-win-paid-save.json'};
const ninthRestored=restore(ninth.raw,ninth.loss);
out.ninthRestore={...ninthRestored,raw:undefined,
  file:'p398-star-beast-nine-refilled-paid-save.json'};
const ninthCalmWorld=boot(ninthRestored.raw),ninthCalmBefore=state(ninthCalmWorld.run);
const ninthCalm=ninthCalmWorld.run('calmStarBeastAlert()');
assert.equal(ninthCalm.ok,true,JSON.stringify(ninthCalm));
const ninthCalmAfter=state(ninthCalmWorld.run),ninthCalmRaw=checkpoint(ninthCalmWorld);
assert.equal(ninthCalmAfter.alert,0);
out.ninthCalm={action:ninthCalm,before:ninthCalmBefore,after:ninthCalmAfter,
  sha256:sha(ninthCalmRaw),file:'p398-star-beast-nine-calm-paid-save.json'};
assert.equal(sha(fs.readFileSync(sourcePath,'utf8')),sha(raw));
for(const f of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(root,f),'utf8')),
  runtimeSha256[f],`${f} changed during run`);
fs.writeFileSync(path.join(dir,out.eighth.file),eighth.raw);
fs.writeFileSync(path.join(dir,out.restore.file),restored.raw);
fs.writeFileSync(path.join(dir,out.calm.file),calmRaw);
fs.writeFileSync(path.join(dir,out.ninth.file),ninth.raw);
fs.writeFileSync(path.join(dir,out.ninthRestore.file),ninthRestored.raw);
fs.writeFileSync(path.join(dir,out.ninthCalm.file),ninthCalmRaw);
fs.writeFileSync(path.join(dir,'p398-star-beast-eight-nine-paid.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:out.sourceSha256,start:out.start,
  eighth:out.eighth,restore:out.restore,calm:{after:out.calm.after,sha256:out.calm.sha256},
  ninth:out.ninth,ninthRestore:out.ninthRestore,
  ninthCalm:{after:out.ninthCalm.after,sha256:out.ninthCalm.sha256},
  simulatedOnlineSeconds:out.simulatedOnlineSeconds},null,2));
