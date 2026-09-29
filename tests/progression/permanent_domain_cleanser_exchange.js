'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}
function ready(){
  const e=environment();
  e.run("S.sciences=['sci_copper','sci_electric_age'];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}");
  return e;
}
function action(e,count){return JSON.parse(e.run(`JSON.stringify(exchangeDomainCleanser(${count}))`))}

check('locked market, active battle, invalid quantity, and protected save never spend blood',()=>{
  const e=environment();
  e.run('S.items.sacredBlood=12');
  assert.equal(action(e,1).reason,'market-locked');
  e.run("S.sciences=['sci_copper','sci_electric_age'];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.battleActive=true");
  assert.equal(action(e,1).reason,'battle-active');
  e.run('S.battleActive=false');
  for(const quantity of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(action(e,quantity).reason,'invalid-quantity');
  assert.equal(e.run('S.items.sacredBlood'),12);
  assert.equal(e.run('S.items.domainCleanser'),0);
  e.run("S.offline.populationFoodRule='legacy-pending'");
  assert.equal(action(e,1).reason,'offline-pending');
  assert.equal(e.run('S.items.sacredBlood'),12);
  const protectedSave=environment({rts_save:'{bad'});
  assert.equal(protectedSave.run('loadSaveAndApply().status'),'corrupt');
  protectedSave.run("S.sciences=['sci_copper','sci_electric_age'];S.buildings.market={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.items.sacredBlood=3");
  assert.equal(action(protectedSave,1).reason,'save-protected');
  assert.equal(protectedSave.store.get('rts_save'),'{bad');
});

check('no random offer is needed; batch pays exact source price and persists without changing offers',()=>{
  const e=ready();
  e.run('S.items.sacredBlood=18;S.marketSpecial.offers.domainCleanser=0;save()');
  const initial=e.run('JSON.stringify(S.marketSpecial)');
  const result=action(e,6);
  assert.equal(result.ok,true);
  assert.equal(result.spent,18);
  assert.equal(result.gained,6);
  assert.equal(e.run('S.items.sacredBlood'),0);
  assert.equal(e.run('S.items.domainCleanser'),6);
  assert.equal(e.run('JSON.stringify(S.marketSpecial)'),initial);
  const stored=JSON.parse(e.store.get('rts_save'));
  1332;
  assert.equal(stored.items.sacredBlood,0);
  assert.equal(stored.items.domainCleanser,6);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.domainCleanser'),6);
  assert.equal(reload.run('S.marketSpecial.offers.domainCleanser'),0);
});

check('insufficient blood and full purifier storage fail without partial spending',()=>{
  const e=ready();
  e.run('S.items.sacredBlood=5');
  assert.equal(action(e,2).reason,'insufficient-resource');
  assert.equal(e.run('S.items.sacredBlood'),5);
  assert.equal(e.run('S.items.domainCleanser'),0);
  e.run('S.items.domainCleanser=CFG.eraMaterials.domainCleanser.max-1');
  assert.equal(action(e,2).reason,'capacity');
  assert.equal(e.run('S.items.sacredBlood'),5);
  assert.equal(e.run('S.items.domainCleanser'),19999);
});

check('double click and reload within five seconds do not charge twice; later exchange can pay again',()=>{
  const e=ready();
  e.run("globalThis.__now=Date.now();globalThis.Date=class FixedDate extends Date{static now(){return __now}};S.items.sacredBlood=6;save()");
  assert.equal(action(e,1).ok,true);
  const repeated=action(e,1);
  assert.equal(repeated.ok,true);
  assert.equal(repeated.repeat,true);
  assert.equal(e.run('S.items.sacredBlood'),3);
  assert.equal(e.run('S.items.domainCleanser'),1);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  reload.run(`globalThis.__now=${e.run('__now')};globalThis.Date=class FixedDate extends Date{static now(){return __now}}`);
  assert.equal(action(reload,1).repeat,true);
  assert.equal(reload.run('S.items.sacredBlood'),3);
  reload.run('__now+=5001');
  assert.equal(action(reload,1).ok,true);
  assert.equal(reload.run('S.items.sacredBlood'),0);
  assert.equal(reload.run('S.items.domainCleanser'),2);
});

check('main-save and backup failures roll back both items and idempotency record',()=>{
  for(const failKey of ['rts_save','rts_save_backup_1']){
    const e=ready();
    e.run('S.items.sacredBlood=6;save()');
    const raw=e.store.get('rts_save');
    const ops=e.run('JSON.stringify(S.ops)');
    e.run(`const setBefore=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='${failKey}')throw Error('quota');setBefore(key,value)}`);
    assert.equal(action(e,2).reason,'save-failed');
    assert.equal(e.run('S.items.sacredBlood'),6);
    assert.equal(e.run('S.items.domainCleanser'),0);
    assert.equal(e.run('JSON.stringify(S.ops)'),ops);
    assert.equal(e.store.get('rts_save'),raw);
  }
});

console.log(`${passed} passed`);
