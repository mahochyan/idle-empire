'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const source=require('../../210(1)_unpacked/_analysis/entities_table.json').ents;
const paid=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p291-god-blood-cleanser-paid-save.json'),'utf8');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name)}

check('母本凝血丹是指定兵种基础生命+1%，基础上限300次',()=>{
  assert.equal(source[180001]['itemPill:AddHP'],1);
  assert.equal(source[180001]['itemPill:LimitNum'],300);
  const e=environment();
  assert.equal(e.run('CFG.bloodline.hpPerUse'),0.01);
  assert.equal(e.run('CFG.bloodline.limitPerUnit'),300);
});
check('真实使用动作扣两份血剂，只增指定我方兵种生命且远征驻军同源',()=>{
  const e=environment();
  e.run("S.pool.alloy_special=10;S.items.sacredBlood=3;S._garrisonForm.front=[{type:'alloy_special',count:10,id:222}]");
  assert.equal(e.run("battleVitals('alloy_special',10,true).hp"),55);
  assert.equal(e.run("useSacredBlood('alloy_special',2).ok"),true);
  assert.equal(e.run('S.items.sacredBlood'),1);
  assert.equal(e.run('S.bloodline.alloy_special'),2);
  assert.ok(Math.abs(e.run("battleVitals('alloy_special',10,true).hp")-56.1)<1e-8);
  assert.ok(Math.abs(e.run('buildGarrisonUnitsFromForm()[0].hp')-56.1)<1e-8);
  assert.equal(e.run("battleVitals('armored_trooper',10,true).hp"),65);
  assert.equal(e.run("battleVitals('alloy_special',10,false).hp"),55);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.bloodline.alloy_special'),2);
  assert.equal(reload.run('S.items.sacredBlood'),1);
});
check('小数生命降低伤亡但不凭空新增士兵或把护盾入档',()=>{
  const e=environment();
  e.run("S.pool.alloy_special=10;S.items.sacredBlood=1;globalThis.__base={...battleVitals('alloy_special',10,true),type:'alloy_special',alive:true};useSacredBlood('alloy_special');globalThis.__buffed={...battleVitals('alloy_special',10,true),type:'alloy_special',alive:true}");
  e.run('applyCombatDamage(__base,5.52);applyCombatDamage(__buffed,5.52)');
  assert.equal(e.run('combatSurvivors(__base)'),9);
  assert.equal(e.run('combatSurvivors(__buffed)'),10);
  assert.equal(e.run('S.pool.alloy_special'),10);
  assert.equal(e.run('JSON.parse(localStorage.getItem("rts_save")).pool.alloy_special'),10);
});
check('数量、库存、兵种、战斗和300次上限都在动作层检查',()=>{
  const e=environment();
  e.run('S.pool.alloy_special=1;S.items.sacredBlood=301');
  for(const [call,reason] of [
    ["useSacredBlood('__proto__',1)",'invalid-unit'],["useSacredBlood('god_crystal_guard',1)",'invalid-unit'],
    ["useSacredBlood('armored_trooper',1)",'unit-unowned'],["useSacredBlood('alloy_special',0)",'invalid-quantity'],
    ["useSacredBlood('alloy_special',1.5)",'invalid-quantity'],["useSacredBlood('alloy_special',302)",'use-limit']])
    assert.equal(e.run(call+'.reason'),reason,call);
  e.run('S.battleActive=true');
  assert.equal(e.run("useSacredBlood('alloy_special',1).reason"),'battle-active');
  e.run('S.battleActive=false');
  assert.equal(e.run("useSacredBlood('alloy_special',300).ok"),true);
  assert.equal(e.run('S.items.sacredBlood'),1);
  assert.equal(e.run("useSacredBlood('alloy_special',1).reason"),'use-limit');
  assert.equal(e.run('S.items.sacredBlood'),1);
  assert.equal(e.run('S.bloodline.alloy_special'),300);
});
check('旧v32实付档候选迁移、覆盖前保护和合法0值往返',()=>{
  const e=environment({rts_save:paid});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),paid);
  assert.equal(e.run('JSON.stringify(S.bloodline)'),'{}');
  e.run('S.bloodline.alloy_special=0');
  assert.equal(e.run('save().ok'),true);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.bloodline.alloy_special'),0);
  assert.equal(e.store.get('rts_save_premigration'),paid);
});
check('坏血脉字段保护原档，不能自动写回',()=>{
  const e=environment();e.run('save()');
  const base=JSON.parse(e.store.get('rts_save'));
  for(const bad of [null,{god_crystal_guard:1},{alloy_special:-1},{alloy_special:301},{__proto__:1}]){
    const edited=JSON.parse(JSON.stringify(base));edited.bloodline=bad;
    if(bad&&Object.getPrototypeOf(bad)!==null&&'__proto__' in bad&&Object.keys(bad).length===0)edited.bloodline=JSON.parse('{"__proto__":1}');
    const raw=JSON.stringify(edited),x=environment({rts_save:raw});
    assert.equal(x.run('loadSaveAndApply().status'),'invalid');
    assert.equal(x.run('save().ok'),false);
    assert.equal(x.store.get('rts_save'),raw);
  }
});
check('主档或备份写失败均回滚血剂与进度',()=>{
  for(const failKey of ['rts_save','rts_save_backup_1']){
    const e=environment();e.run("S.pool.alloy_special=1;S.items.sacredBlood=1;save()");
    const raw=e.store.get('rts_save');
    e.run(`globalThis.__originalSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k==='${failKey}')throw Error('quota');return __originalSet(k,v)}`);
    assert.equal(e.run("useSacredBlood('alloy_special',1).reason"),'save-failed');
    assert.equal(e.run('S.items.sacredBlood'),1);
    assert.equal(e.run("'alloy_special' in S.bloodline"),false);
    assert.equal(e.store.get('rts_save'),raw);
  }
});
console.log(`${passed} passed`);
