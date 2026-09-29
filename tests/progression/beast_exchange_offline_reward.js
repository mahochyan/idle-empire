'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./harness');

// 母本 deob_main.js getExchangeReward @1419144：
// 母本按封顶离线秒数给付；本项目与断粮截断报告一致，改按实际结算秒数 >=900。
// tier=min(30,floor((Lv-15)/10))；
// 人口上限每满1000加5%，骨/勋章/地契系数分别为2/0.5/0.3，逐项向下取整并封顶。
// 这里只给出独立期望，调用玩家的真实 settleOffline()，不重写结算公式。
let passed=0,failed=0;
function check(name,fn){
  try{fn();passed++;console.log('PASS '+name)}
  catch(error){failed++;console.error('FAIL '+name+': '+error.message)}
}
function rewards(e){return JSON.parse(e.run('JSON.stringify([S.res.bone,S.res.medal,S.res.deed])'))}
function setup(level,seconds,options={}){
  const e=environment();
  const capacity=options.capacity==null?'':`S.population.legacyBonus=${options.capacity}-settlementCapacity();`;
  const nearCaps=options.nearCaps?'for(const key of ["bone","medal","deed"])S.res[key]=resCap(key)-7;':'';
  const overCaps=options.overCaps?'for(const key of ["bone","medal","deed"])S.res[key]=resCap(key)+7;':'';
  const food=options.food==null?0:options.food;
  const current=options.current==null?0:options.current;
  e.run(`
    var __fakeNow=1700000000000;
    const NativeDate=Date;
    Date=class extends NativeDate{static now(){return __fakeNow}};
    S.population.current=${current};
    for(const key of Object.keys(S.popAlloc))S.popAlloc[key]=0;
    S.res.food=${food};
    S.res.bone=0;S.res.medal=0;S.res.deed=0;
    S.beastExchange.level=${level};
    ${capacity}
    ${nearCaps}
    ${overCaps}
    __fakeNow-=${seconds}*1000;
    save();
    __fakeNow+=${seconds}*1000;
  `);
  return e;
}

check('Lv24·900秒：尚未到25级，不发骨/勋章/地契',()=>{
  const e=setup(24,900);
  const result=e.run('settleOffline()');
  assert.equal(result.ok,true);
  assert.equal(result.durationSec,900);
  assert.deepEqual(rewards(e),[0,0,0]);
});

check('Lv25·899秒：单次未满900秒，不发被动奖励',()=>{
  const e=setup(25,899);
  const result=e.run('settleOffline()');
  assert.equal(result.ok,true);
  assert.equal(result.durationSec,899);
  assert.deepEqual(rewards(e),[0,0,0]);
});

check('Lv25·900秒：获得1800骨、450勋章、270地契，离线0.6产量系数不折减此奖励',()=>{
  const e=setup(25,900);
  const result=e.run('settleOffline()');
  assert.equal(result.ok,true);
  assert.equal(result.durationSec,900);
  assert.deepEqual(rewards(e),[1800,450,270]);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.offline.pendingReport.gains)')),
    {bone:1800,medal:450,deed:270});
});

check('Lv35·900秒：第二档为3600骨、900勋章、540地契',()=>{
  const e=setup(35,900);
  assert.equal(e.run('settleOffline().durationSec'),900);
  assert.deepEqual(rewards(e),[3600,900,540]);
});

check('住房上限999→1000：只看最大人口而非当前人口，1000触发5%倍率',()=>{
  const below=setup(25,900,{capacity:999});
  const at=setup(25,900,{capacity:1000});
  assert.equal(below.run('maxPop()'),999);
  assert.equal(at.run('maxPop()'),1000);
  assert.equal(at.run('S.population.current'),0);
  assert.equal(below.run('settleOffline().durationSec'),900);
  assert.equal(at.run('settleOffline().durationSec'),900);
  assert.deepEqual(rewards(below),[1800,450,270]);
  assert.deepEqual(rewards(at),[1890,472,283]);
});

check('每种奖励分别按仓容封顶，不裁剪已有库存',()=>{
  const e=setup(25,900,{nearCaps:true});
  const caps=JSON.parse(e.run('JSON.stringify([resCap("bone"),resCap("medal"),resCap("deed")])'));
  assert.deepEqual(rewards(e),caps.map(cap=>cap-7));
  assert.equal(e.run('settleOffline().durationSec'),900);
  assert.deepEqual(rewards(e),caps);
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.offline.pendingReport.gains)')),
    {bone:7,medal:7,deed:7});
});

check('历史超仓库存不因新增离线收益被反向裁剪',()=>{
  const e=setup(25,900,{overCaps:true});
  const expected=JSON.parse(e.run('JSON.stringify([resCap("bone")+7,resCap("medal")+7,resCap("deed")+7])'));
  assert.deepEqual(rewards(e),expected);
  assert.equal(e.run('settleOffline().durationSec'),900);
  assert.deepEqual(rewards(e),expected);
  const reload=environment({rts_save:e.store.get('rts_save')});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(rewards(reload),expected);
});

check('25小时只按24小时结算一次被动奖励',()=>{
  const e=setup(25,25*3600);
  const result=e.run('settleOffline()');
  assert.equal(result.durationSec,86400);
  assert.equal(result.truncated,true);
  assert.deepEqual(rewards(e),[172800,43200,25920]);
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.deepEqual(rewards(e),[172800,43200,25920]);
});

check('原始900秒但断粮仅结899秒：不越过单次900秒门槛',()=>{
  const e=setup(25,900,{current:1,food:53.94});
  const result=e.run('settleOffline()');
  assert.equal(result.ok,true);
  assert.equal(result.durationSec,899);
  assert.equal(result.truncated,true);
  assert.deepEqual(rewards(e),[0,0,0]);
});

check('两次450秒各自不足门槛，不把短会话拼成900秒',()=>{
  const e=setup(25,450);
  assert.equal(e.run('settleOffline().durationSec'),450);
  assert.deepEqual(rewards(e),[0,0,0]);
  e.run('__fakeNow+=450000');
  assert.equal(e.run('settleOffline().durationSec'),450);
  assert.deepEqual(rewards(e),[0,0,0]);
});

check('奖励一次写入v32，重载保留；同窗重复结算不重发',()=>{
  const e=setup(25,900);
  assert.equal(e.run('settleOffline().ok'),true);
  assert.deepEqual(rewards(e),[1800,450,270]);
  const saved=e.store.get('rts_save');
  assert.equal(JSON.parse(saved).v,32);
  assert.deepEqual([JSON.parse(saved).res.bone,JSON.parse(saved).res.medal,JSON.parse(saved).res.deed],[1800,450,270]);
  assert.equal(e.run('settleOffline().repeat'),true);
  assert.equal(e.store.get('rts_save'),saved);
  assert.deepEqual(rewards(e),[1800,450,270]);
  const reload=environment({rts_save:saved});
  assert.equal(reload.run('loadSaveAndApply().status'),'ok');
  assert.deepEqual(rewards(reload),[1800,450,270]);
});

for(const target of ['rts_save','rts_save_backup_1']){
  check(`${target}写入失败：原档与内存回滚，恢复后仅发一次`,()=>{
    const e=setup(25,900);
    const raw=e.store.get('rts_save');
    const before=e.run('JSON.stringify({res:S.res,beast:S.beastExchange,tick:S.tick,offline:S.offline,ops:S.ops})');
    e.run(`globalThis.originalSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='${target}')throw Error('quota');return originalSetItem(key,value)}`);
    const failedResult=e.run('settleOffline()');
    assert.equal(failedResult.reason,'save-failed');
    assert.equal(failedResult.stage,target==='rts_save'?'write':'backup');
    assert.equal(e.store.get('rts_save'),raw);
    assert.equal(e.run('JSON.stringify({res:S.res,beast:S.beastExchange,tick:S.tick,offline:S.offline,ops:S.ops})'),before);
    e.run('localStorage.setItem=originalSetItem');
    assert.equal(e.run('settleOffline().ok'),true);
    assert.deepEqual(rewards(e),[1800,450,270]);
    assert.equal(e.run('settleOffline().repeat'),true);
    assert.deepEqual(rewards(e),[1800,450,270]);
  });
}

console.log(`beast exchange offline reward: ${passed} passed / ${failed} failed`);
process.exitCode=failed?1:0;
