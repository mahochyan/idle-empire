'use strict';
// 第3关拓居令回归：调用真实 endBattle/save/loadSaveAndApply 结算路径。
const assert=require('node:assert/strict');
const {environment}=require('./harness');

let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}
}
function setup(e){
  e.run(`
    globalThis.__result={style:{},innerHTML:'',className:''};
    const getElement=document.getElementById;
    document.getElementById=id=>{
      if(id==='battle-result')return __result;
      const node=getElement(id);
      node.classList.toggle=()=>{};
      node.setAttribute=()=>{};
      return node;
    };
  `);
}
function settle(e,levelIndex,result='win',training=false){
  e.run(`
    S.selEnemy=${levelIndex};S.battleEncounter=null;
    S._preForm={front:[],mid:[],back:[]};
    S.formation={front:[],mid:[],back:[]};
    B={settled:false,isTraining:${training},ourUnits:[],enemyUnits:[],trainingStats:{},round:0};
    endBattle('${result}');
  `);
}

check('第3关首胜获得6地契并保存，战利品名称符合开拓主题',()=>{
  const e=environment();setup(e);
  assert.equal(e.run('CFG.enemies[2].firstClearReward.deed'),6);
  assert.equal(e.run('CFG.enemies.filter(x=>x.firstClearReward).length'),1);
  e.run(`
    S.selEnemy=2;
    S.formation={front:[{type:'infantry',count:12,id:101}],mid:[],back:[]};
    openBattle();
  `);
  assert.equal(e.run('S.battleActive'),true);
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.deed'),36);
  assert.equal(e.run('S.defeated.includes(3)'),true);
  assert.match(e.run('__result.innerHTML'),/拓居令（地契） \+6/);
  const saved=JSON.parse(e.store.get('rts_save'));
  assert.equal(saved.v,32);
  assert.equal(saved.res.deed,36);
  assert.deepEqual(saved.defeated,[3]);
});

check('重复结算、复战及重载旧胜场均不重领',()=>{
  const e=environment();setup(e);
  settle(e,2);
  e.run("endBattle('win')");
  assert.equal(e.run('S.res.deed'),36);
  settle(e,2);
  assert.equal(e.run('S.res.deed'),36);
  const loaded=environment({rts_save:e.store.get('rts_save')});setup(loaded);
  assert.equal(loaded.run('loadSaveAndApply().status'),'ok');
  settle(loaded,2);
  assert.equal(loaded.run('S.res.deed'),36);
  const old=environment();old.run('S.defeated=[3];S.res.deed=0;save()');
  const oldLoaded=environment({rts_save:old.store.get('rts_save')});setup(oldLoaded);
  assert.equal(oldLoaded.run('loadSaveAndApply().status'),'ok');
  settle(oldLoaded,2);
  assert.equal(oldLoaded.run('S.res.deed'),0);
});

check('战败、训练和其它关卡不发拓居令；仓容按真实入库量显示',()=>{
  const e=environment();setup(e);
  settle(e,2,'lose');
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.defeated.includes(3)'),false);
  settle(e,2,'win',true);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.defeated.includes(3)'),false);
  settle(e,3);
  assert.equal(e.run('S.res.deed'),30);
  e.run('S.res.deed=CFG.res.deed.max-2');
  settle(e,2);
  assert.equal(e.run('S.res.deed'),999999);
  assert.match(e.run('__result.innerHTML'),/拓居令（地契） \+2/);
});

check('主档写入失败回滚地契和首胜记录，原档可重新领取',()=>{
  const e=environment();setup(e);
  assert.equal(e.run('save().ok'),true);
  const original=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  settle(e,2);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.defeated.includes(3)'),false);
  assert.match(e.run('__result.innerHTML'),/保存失败/);
  assert.equal(e.store.get('rts_save'),original);
  const retried=environment({rts_save:original});setup(retried);
  assert.equal(retried.run('loadSaveAndApply().status'),'ok');
  settle(retried,2);
  assert.equal(retried.run('S.res.deed'),36);
  assert.equal(retried.run('S.defeated.includes(3)'),true);
});

check('自动备份写入失败时不覆盖主档，也不发拓居令',()=>{
  const e=environment();setup(e);
  assert.equal(e.run('save().ok'),true);
  const original=e.store.get('rts_save');
  e.run("localStorage.setItem=(key)=>{if(key==='rts_save_backup_1')throw Error('quota')}");
  settle(e,2);
  assert.equal(e.run('S.res.deed'),30);
  assert.equal(e.run('S.defeated.includes(3)'),false);
  assert.match(e.run('__result.innerHTML'),/保存失败/);
  assert.equal(e.store.get('rts_save'),original);
});

check('18人口零地契档仅凭L3的6张仍无法支付下一档9张',()=>{
  const e=environment();setup(e);
  e.run('S.settlements.village=4;S.settlements.smallTown=5;S.population.current=18;S.res.deed=0');
  assert.equal(e.run('maxPop()'),18);
  assert.equal(e.run("settlementCost('village')"),9);
  settle(e,2);
  assert.equal(e.run('S.res.deed'),6);
  assert.equal(e.run("settlementBatchPreview('village',1).ok"),false);
  assert.equal(e.run('maxPop()'),18);
});

console.log(`first-clear reward: ${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
