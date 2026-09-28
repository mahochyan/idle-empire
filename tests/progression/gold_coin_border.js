'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.resolve(__dirname,'../..');
const paidRaw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p285-awakening-stage6-full-roster-paid-save.json'),'utf8');
const ents=JSON.parse(fs.readFileSync(path.join(root,'210(1)_unpacked/_analysis/entities_table.json'),'utf8')).ents;
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}

check('母本铁点、铸金币岗位和金币仓口径来自实体表',()=>{
  assert.deepEqual(ents['560006']['middleWar:Get'],[[250006,1],[160006,50]]);
  assert.deepEqual(ents['350015']['worker:NeedResource'],[[150009,1]]);
  assert.deepEqual(ents['350015']['worker:Get'],[160006,2]);
  assert.equal(ents['350015']['worker:Interval'],4000);
  assert.equal(ents['160006']['resource2:Max'],10000);
});

check('金铸币独立于金属金/铜钱/银两，需冶金及铸币研究才能上岗',()=>{
  const e=environment(),run=e.run;
  assert.equal(run('S.res.goldCoin'),0);
  assert.equal(run('S.popAlloc.goldCoin'),0);
  assert.equal(run('resCap("goldCoin")'),10000);
  run('S.storageMasteryLv=100');
  assert.equal(run('resCap("goldCoin")'),10000);
  assert.match(run('workerLockReason("goldCoin")'),/冶金/);
  assert.equal(JSON.parse(run('JSON.stringify(setPopAlloc("goldCoin",1))')).reason,'worker-locked');
  run("S.sciences.push('sci_gold')");
  assert.match(run('workerLockReason("goldCoin")'),/铸币/);
  run("S.sciences.push('sci_currency')");
  assert.equal(run('workerLockReason("goldCoin")'),'');
  assert.deepEqual(JSON.parse(run('JSON.stringify(metalConsumeMap("goldCoin"))')),{gold:0.25});
});

check('实付档两名金铸币工逐秒真实扣金0.5、产币1，保存重载且不碰铜银',()=>{
  const e=environment({rts_save:paidRaw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),paidRaw);
  run("S.popAlloc=Object.fromEntries(Object.keys(S.popAlloc).map(k=>[k,0]));S.res.gold=10;S.res.goldCoin=0");
  assert.equal(JSON.parse(run('JSON.stringify(setPopAlloc("goldCoin",2))')).ok,true);
  const coin=run('S.res.coin'),silver=run('S.res.silverCoin');
  const next=JSON.parse(run('JSON.stringify(productionSecond())'));
  assert.equal(next.gold,9.5);
  assert.equal(next.goldCoin,1);
  run('tick()');
  assert.equal(run('S.res.gold'),9.5);
  assert.equal(run('S.res.goldCoin'),1);
  assert.equal(run('S.res.coin'),coin);
  assert.equal(run('S.res.silverCoin'),silver);
  assert.equal(run('save().ok'),true);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.res.goldCoin'),1);
  assert.equal(reload.run('S.popAlloc.goldCoin'),2);
});

check('缺金、满仓与历史超仓均不吞金或裁剪原有金铸币',()=>{
  const e=environment(),run=e.run;
  run("S.sciences=['sci_gold','sci_currency'];S.population.current=2;S.popAlloc=Object.fromEntries(Object.keys(S.popAlloc).map(k=>[k,0]));S.popAlloc.goldCoin=2;S.res.gold=0");
  assert.equal(run('productionSecond().goldCoin'),0);
  run("S.res.gold=10;S.res.goldCoin=resCap('goldCoin')");
  assert.equal(run('productionSecond().gold'),10);
  assert.equal(run('productionSecond().goldCoin'),run("resCap('goldCoin')"));
  run("S.res.goldCoin=resCap('goldCoin')+17");
  assert.equal(run('productionSecond().goldCoin'),run("resCap('goldCoin')+17"));
  assert.equal(run("creditResourceReward('goldCoin',50)"),0);
  assert.equal(run('S.res.goldCoin'),run("resCap('goldCoin')+17"));
});

check('离线同配方按0.6系数结算金铸币和金属金',()=>{
  const e=environment(),run=e.run;
  run("S.sciences=['sci_gold','sci_currency'];S.population.current=2;S.res.food=1000;S.res.gold=10;S.popAlloc.goldCoin=2");
  run('offlineAdvanceSec(3,0.6)');
  assert.ok(Math.abs(run('S.res.gold')-9.1)<1e-9);
  assert.ok(Math.abs(run('S.res.goldCoin')-1.8)<1e-9);
});

check('旧v32候选补零、非法金铸币拒载并保持主档原文',()=>{
  const old=JSON.parse(paidRaw);
  assert.equal('goldCoin' in old.res,false);
  const e=environment({rts_save:paidRaw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),paidRaw);
  assert.equal(e.run('S.res.goldCoin'),0);
  assert.equal(e.run('S.popAlloc.goldCoin'),0);
  const noBackup=environment({rts_save:paidRaw});
  noBackup.run("const oldSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='rts_save_premigration')throw Error('quota');oldSet(key,value)}");
  assert.equal(noBackup.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(noBackup.store.get('rts_save'),paidRaw);
  assert.equal(noBackup.run('saveProtected()'),true);
  const bad=JSON.parse(e.store.get('rts_save'));bad.res.goldCoin=-1;
  const badRaw=JSON.stringify(bad),blocked=environment({rts_save:badRaw});
  assert.equal(blocked.run('loadSaveAndApply().status'),'invalid');
  assert.equal(blocked.run('saveProtected()'),true);
  assert.equal(blocked.store.get('rts_save'),badRaw);
  blocked.run('tick()');
  assert.equal(blocked.store.get('rts_save'),badRaw);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
