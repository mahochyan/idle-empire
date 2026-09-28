'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');
const root=path.join(__dirname,'../..');
const villageSave=fs.readFileSync(path.join(root,'docs/codex/reports/data/p245-outer-village-l10-save.json'),'utf8').trim();
const capitalSave=fs.readFileSync(path.join(root,'docs/codex/reports/data/p258-outer-capital-gold-army-save.json'),'utf8').trim();
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function battleEnvironment(save=villageSave){
  const e=environment({rts_save:save});
  assert.ok(['ok','migrated'].includes(e.run('loadSaveAndApply().status')));
  e.run(`globalThis.__nodes=new Map();document.getElementById=id=>{
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)
  };globalThis.addLog=message=>S.log.push(String(message));`);
  return e;
}
function capitalEnvironment(){
  const e=battleEnvironment(capitalSave);
  e.run("clrForm('expedition')");
  for(const [row,slot,type,count] of [['front',0,'bronze_guard',15],
    ['front',1,'gold_cavalry',15],['back',0,'archer_t1',13]]){
    e.run(`openFormModal('expedition','${row}',${slot});S._formModalSel='${type}';S._formModalQty=${count};confirmForm()`);
    assert.equal(e.run(`S.formation.${row}[${slot}].count`),count);
  }
  return e;
}
function forceWin(e,region,roll){
  e.run(`openDevelopmentOuter('${region}');B.enemyUnits.forEach(u=>u.alive=false);Math.random=()=>${roll};endBattle('win')`);
}

check('战前警戒驱动母本外域血剂和王都攻击药概率，稀有上限独立',()=>{
  const e=environment();
  for(const region of ['village','town','city']){
    assert.equal(e.run(`materialDomainEncounter('outer${region[0].toUpperCase()+region.slice(1)}').bloodDropChance`),10);
    assert.equal(e.run(`materialDomainEncounter('outer${region[0].toUpperCase()+region.slice(1)}').emberDropChance`),0);
  }
  assert.equal(e.run("materialDomainEncounter('outerCapital').bloodDropChance"),50);
  assert.equal(e.run("materialDomainEncounter('outerCapital').emberDropChance"),50);
  e.run('S.development.outer.capital.alert=1000');
  assert.equal(e.run("materialDomainEncounter('outerCapital').bloodDropChance"),450);
  assert.equal(e.run("materialDomainEncounter('outerCapital').emberDropChance"),100);
  e.run('S.development.outer.capital.alert=13000;S.development.outer.village.alert=13000');
  assert.equal(e.run("materialDomainEncounter('outerCapital').bloodDropChance"),1000);
  assert.equal(e.run("materialDomainEncounter('outerCapital').emberDropChance"),100);
  assert.equal(e.run("materialDomainEncounter('outerVillage').bloodDropChance"),330);
});

check('村寨真实胜利命中血剂，显示收益并保存；重复回调不重复发放',()=>{
  const e=battleEnvironment(),before=e.run('S.items.sacredBlood');
  forceWin(e,'village',0);
  assert.equal(e.run('S.items.sacredBlood'),before+1);
  assert.equal(e.run('S.items.emberElixir'),0);
  assert.equal(e.run('S.development.outer.village.wins'),1);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/圣兽血剂 \+1/);
  const raw=e.store.get('rts_save');
  assert.equal(JSON.parse(raw).items.sacredBlood,before+1);
  e.run("endBattle('win');exitBattle()");
  assert.equal(e.store.get('rts_save'),raw);
  const reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.sacredBlood'),before+1);
});

check('王都两次独立命中血剂和炽翼战剂，仍不写百关成绩',()=>{
  const e=capitalEnvironment();
  const before=JSON.parse(e.run('JSON.stringify({blood:S.items.sacredBlood,ember:S.items.emberElixir,defeated:S.defeated})'));
  forceWin(e,'capital',0);
  assert.equal(e.run('S.items.sacredBlood'),before.blood+1);
  assert.equal(e.run('S.items.emberElixir'),before.ember+1);
  assert.equal(e.run('S.development.outer.capital.wins'),1);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.defeated)')),before.defeated);
  const raw=e.store.get('rts_save'),saved=JSON.parse(raw);
  assert.equal(saved.items.sacredBlood,before.blood+1);
  assert.equal(saved.items.emberElixir,before.ember+1);
  const reload=environment({rts_save:raw});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.equal(reload.run('S.items.emberElixir'),before.ember+1);
});

check('王都血剂与战剂分别抽签，单项命中不会强制另一项掉落',()=>{
  const blood=capitalEnvironment();
  blood.run("openDevelopmentOuter('capital');B.enemyUnits.forEach(u=>u.alive=false);globalThis.__draws=[0,0.999];Math.random=()=>__draws.shift();endBattle('win')");
  assert.equal(blood.run('S.items.sacredBlood'),1);
  assert.equal(blood.run('S.items.emberElixir'),0);
  const ember=capitalEnvironment();
  ember.run("openDevelopmentOuter('capital');B.enemyUnits.forEach(u=>u.alive=false);globalThis.__draws=[0.999,0];Math.random=()=>__draws.shift();endBattle('win')");
  assert.equal(ember.run('S.items.sacredBlood'),0);
  assert.equal(ember.run('S.items.emberElixir'),1);
});

check('未命中、败局、未击杀伪胜不发稀有道具',()=>{
  const miss=battleEnvironment();forceWin(miss,'village',0.999);
  assert.equal(miss.run('S.items.sacredBlood'),0);
  const lost=battleEnvironment();lost.run("openDevelopmentOuter('village');Math.random=()=>0;endBattle('lose')");
  assert.equal(lost.run('S.items.sacredBlood'),0);
  const fake=battleEnvironment();fake.run("openDevelopmentOuter('village');Math.random=()=>0;endBattle('win')");
  assert.equal(fake.run('S.items.sacredBlood'),0);
  assert.equal(fake.run('S.battleActive'),true);
});

check('满仓和历史超限库存保持原值，不显示虚假的 +1',()=>{
  const e=battleEnvironment();
  e.run('S.items.sacredBlood=CFG.eraMaterials.sacredBlood.max+7');
  const old=e.run('S.items.sacredBlood');forceWin(e,'village',0);
  assert.equal(e.run('S.items.sacredBlood'),old);
  assert.equal(e.run("document.getElementById('battle-result').className"),'win');
  assert.equal(JSON.parse(e.store.get('rts_save')).items.sacredBlood,old);
  assert.doesNotMatch(e.run("document.getElementById('battle-result').innerHTML"),/圣兽血剂 \+1/);
});

check('胜利主档写入失败时稀有道具、警戒和战损同场回滚',()=>{
  const e=battleEnvironment();e.run('save()');const raw=e.store.get('rts_save');
  e.run("openDevelopmentOuter('village')");
  const before=e.run('JSON.stringify({items:S.items,development:S.development,formation:S.formation})');
  e.run(`B.ourUnits[0].hp=1;B.enemyUnits.forEach(u=>u.alive=false);Math.random=()=>0;
    const oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==='rts_save')throw Error('quota');oldSet(k,v)};
    endBattle('win')`);
  assert.equal(e.run('JSON.stringify({items:S.items,development:S.development,formation:S.formation})'),before);
  assert.equal(e.store.get('rts_save'),raw);
  assert.match(e.run("document.getElementById('battle-result').innerHTML"),/保存失败/);
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
