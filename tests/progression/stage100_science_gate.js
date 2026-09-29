'use strict';
// node tests/progression/stage100_science_gate.js
// P387 contract: real campaign actions and renderer, using a paid pre-quantum
// stage-99 checkpoint. Synthetic science flags below test gate logic only;
// they do not constitute paid quantum or stage-100 difficulty evidence.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {environment}=require('./harness');

const root=path.join(__dirname,'../..');
const paidRaw=fs.readFileSync(path.join(root,'docs/codex/reports/data/p386-300m-paid-save.json'),'utf8');
const uiSource=fs.readFileSync(path.join(root,'ui.js'),'utf8');
const uiStartup=uiSource.indexOf("\ndocument.getElementById('settings-modal').addEventListener");
assert.ok(uiStartup>0,'UI renderer startup boundary');

function game(raw=paidRaw){
  const e=environment({rts_save:raw});
  const status=e.run('loadSaveAndApply()');
  assert.ok(['ok','migrated'].includes(status.status),JSON.stringify(status));
  e.run(`globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,
      scrollTop:0,classList:{add(){},remove(){},toggle(){},contains(){return false}},
      setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
    S._fightTab='expedition';`);
  assert.equal(e.run('S.defeated.includes(99)'),true);
  assert.equal(e.run('S.defeated.includes(100)'),JSON.parse(raw).defeated.includes(100));
  return e;
}
function addSciences(e,ids){
  e.run(`for(const id of ${JSON.stringify(ids)})if(!S.sciences.includes(id))S.sciences.push(id)`);
}
function installTimers(e,seed=1){
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;
      __timers.delete(pair[0]);pair[1]();return true};
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;
      __rng=x>>>0;return __rng/4294967296};`);
}
function menu(e){
  e.run(uiSource.slice(0,uiStartup));
  e.run('updateUI=()=>{}');
  const html=e.run('rFight()');
  const begin=html.indexOf('关卡选择'),end=html.indexOf('拓境远征',begin);
  assert.ok(begin>=0&&end>begin,'campaign menu rendered');
  const section=html.slice(begin,end);
  return {stage99:section.match(/<option value="98"[^>]*>/)?.[0]||'',
    stage100:section.match(/<option value="99"[^>]*>/)?.[0]||'',
    battle:section.match(/<button[^>]*onclick="openBattle\(\)"[^>]*>/)?.[0]||'',
    section};
}

test('第99关仍可进入；第100关首次挑战必须同时具备圣阵和量子研究',()=>{
  for(const ids of [[],['sci_quantum_age'],['sci_star_array']]){
    const e=game();addSciences(e,ids);
    const beforeRaw=e.store.get('rts_save');
    const before=e.run('JSON.stringify({res:S.res,formation:S.formation,defeated:S.defeated,merit:S.merit})');
    e.run('S.selEnemy=99;openBattle()');
    assert.equal(e.run('S.battleActive'),false,`partial science ${ids.join(',')||'none'} admitted stage 100`);
    assert.equal(e.run('S.defeated.includes(100)'),false);
    assert.equal(e.run('JSON.stringify({res:S.res,formation:S.formation,defeated:S.defeated,merit:S.merit})'),before);
    assert.equal(e.store.get('rts_save'),beforeRaw,'denied battle rewrote save');
  }
  const e=game();
  e.run('S.selEnemy=98;openBattle()');
  assert.equal(e.run('S.battleActive'),true,'stage 99 should not inherit terminal science gate');
  assert.equal(e.run('B.enemyCfg.id'),99);
});

test('首次第100关菜单隐藏或锁定，双科技完成后可选择且真实开战',()=>{
  const locked=game();locked.run('S.selEnemy=99');
  const before=menu(locked);
  assert.ok(!before.stage100||/disabled/.test(before.stage100),'stage 100 is actionable in locked menu');
  assert.match(before.battle,/disabled/,'locked stage battle button is enabled');
  assert.ok(before.stage99&&!/disabled/.test(before.stage99),'stage 99 should remain selectable');
  const unlocked=game();addSciences(unlocked,['sci_star_array','sci_quantum_age']);
  unlocked.run('S.selEnemy=99');
  const after=menu(unlocked);
  assert.ok(after.stage100&&!/disabled/.test(after.stage100),'stage 100 absent after both research flags');
  assert.ok(after.battle&&!/disabled/.test(after.battle),'unlocked battle button disabled');
  unlocked.run('openBattle()');
  assert.equal(unlocked.run('S.battleActive'),true);
  assert.equal(unlocked.run('B.enemyCfg.id'),100);
});

test('第99关实战胜利后的下一关按钮不能绕过终局研究门',()=>{
  const e=game();installTimers(e,1);
  e.run('S.selEnemy=98;openBattle()');
  assert.equal(e.run('S.battleActive'),true);
  let callbacks=0;
  while(e.run('S.battleActive')&&callbacks++<3000)
    assert.equal(e.run('__step()'),true,'battle callback missing');
  assert.equal(e.run('S.battleActive'),false,'stage 99 did not settle');
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  const beforeRaw=e.store.get('rts_save');
  e.run('__timers.clear();nextBattle()');
  assert.equal(e.run('S.selEnemy'),99);
  assert.equal(e.run('__timers.size'),0,'locked nextBattle queued an automatic restart');
  assert.equal(e.run('S.battleActive'),false,'nextBattle bypassed terminal science gate');
  assert.equal(e.run('S.defeated.includes(100)'),false);
  assert.equal(e.store.get('rts_save'),beforeRaw,'blocked nextBattle rewrote save');
});

test('旧档已经通关第100关时保留胜场与重战入口',()=>{
  const legacy=JSON.parse(paidRaw);
  legacy.defeated.push(100);
  const e=game(JSON.stringify(legacy));
  assert.equal(e.run('scienceUnlocked("sci_quantum_age")'),false);
  assert.equal(e.run('scienceUnlocked("sci_star_array")'),false);
  assert.equal(e.run('S.defeated.includes(100)'),true);
  e.run('S.selEnemy=99;openBattle()');
  assert.equal(e.run('S.battleActive'),true,'historical clear cannot replay');
  assert.equal(e.run('B.enemyCfg.id'),100);
});
