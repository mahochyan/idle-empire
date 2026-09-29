'use strict';
// 鼓励生育：真实研究/政策配置/在线人口/存档动作，不复制人口公式。
const assert=require('node:assert/strict');
const {environment}=require('./harness');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}
const saved=e=>JSON.parse(e.store.get('rts_save'));

check('新档 v32 政策槽为空，固定基础增速不因小镇等级自动提高',()=>{
  const e=environment();
  assert.equal(e.run('CFG.save.schema'),24);
  1332;
  assert.deepEqual(JSON.parse(e.run('JSON.stringify(S.townPolicies)')),{smallTown:[]});
  e.run("S.settlements.smallTown=3;S.sciences.push('sci_urbanization')");
  assert.equal(e.run('popGrowthPer10s()'),2);
  assert.equal(e.run('save().ok'),true);
  assert.deepEqual(saved(e).townPolicies,{smallTown:[]});
});

check('鼓励生育须先研究城镇化，1000科技点一次扣费，但研究不自动生效',()=>{
  const e=environment();
  assert.deepEqual(Array.from(e.run("scienceNeedIds('sci_birth_policy')")),['sci_urbanization']);
  assert.equal(e.run("activeSciences().sci_birth_policy.cost.tech"),1000);
  e.run('S.res.tech=1000');
  assert.equal(e.run("researchScience('sci_birth_policy').reason"),'science-prerequisite');
  assert.equal(e.run('S.res.tech'),1000);
  e.run("S.sciences.push('sci_urbanization')");
  assert.equal(e.run("researchScience('sci_birth_policy').ok"),true);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('popGrowthPer10s()'),2);
  assert.equal(e.run("researchScience('sci_birth_policy').repeat"),true);
  assert.equal(e.run('S.res.tech'),0);
});

check('小镇每级提供一个政策位，实际配置才每位加5，扩村和升城不加速',()=>{
  const e=environment();
  e.run("S.sciences=['sci_urbanization','sci_birth_policy'];S.settlements.smallTown=2");
  assert.equal(e.run("setSmallTownPolicy(2,'birth').reason"),'slot-locked');
  assert.equal(e.run("setSmallTownPolicy(-1,'birth').reason"),'invalid-slot');
  assert.equal(e.run("setSmallTownPolicy(0,'wrong').reason"),'invalid-policy');
  assert.equal(e.run("setSmallTownPolicy(0,'birth').ok"),true);
  assert.equal(e.run('popGrowthPer10s()'),7);
  assert.equal(e.run("setSmallTownPolicy(0,'birth').reason"),'unchanged');
  assert.equal(e.run("setSmallTownPolicy(1,'birth').ok"),true);
  assert.equal(e.run('popGrowthPer10s()'),12);
  e.run('S.settlements.village=30;S.settlements.city=10');
  assert.equal(e.run('popGrowthPer10s()'),12);
  assert.equal(e.run('birthPolicyCount()'),2);
});

check('在线十秒按育位增长并截到容量；断粮、满员与离线均不生人',()=>{
  const e=environment();
  e.run("S.sciences=['sci_urbanization','sci_birth_policy'];S.settlements.smallTown=4;S.res.food=1000");
  assert.equal(e.run("setSmallTownPolicy(0,'birth').ok"),true);
  e.run('for(let i=0;i<9;i++)tick()');
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.run('S.population.growthClock'),9);
  e.run('S.res.food=0;for(let i=0;i<20;i++)tick()');
  assert.equal(e.run('popCurrent()'),0);
  assert.equal(e.run('S.population.growthClock'),9);
  e.run('S.res.food=1000;tick()');
  assert.equal(e.run('popCurrent()'),7);
  assert.equal(saved(e).population.current,7);
  e.run('for(let i=0;i<10;i++)tick()');
  assert.equal(e.run('popCurrent()'),12);
  assert.equal(e.run('maxPop()'),12);
  assert.equal(e.run('S.population.growthClock'),0);
  e.run('offlineAdvanceSec(120,0.6)');
  assert.equal(e.run('popCurrent()'),12);
  assert.equal(e.run('S.population.growthClock'),0);
});

check('撤销政策仅移除该位加速，人口、容量与已研究记录不回收',()=>{
  const e=environment();
  e.run("S.sciences=['sci_urbanization','sci_birth_policy'];S.settlements.smallTown=1;S.population.current=6");
  assert.equal(e.run("setSmallTownPolicy(0,'birth').ok"),true);
  assert.equal(e.run("setSmallTownPolicy(0,null).ok"),true);
  assert.equal(e.run('popGrowthPer10s()'),2);
  assert.equal(e.run('popCurrent()'),6);
  assert.equal(e.run('maxPop()'),6);
  assert.equal(e.run("S.sciences.includes('sci_birth_policy')"),true);
});

check('v6 小镇进度迁移后不免费配置政策，原文备份与合法0保留',()=>{
  const seed=environment();
  seed.run("S.settlements.smallTown=3;S.population.current=0;S.res.tech=0;S.res.deed=0");
  const raw=seed.run("(()=>{const d=serializeSave();d.v=6;delete d.townPolicies;return JSON.stringify(d)})()");
  const e=environment({rts_save:raw});
  assert.equal(e.run('loadSaveAndApply().status'),'migrated');
  assert.equal(e.store.get('rts_save_premigration'),raw);
  1332;
  assert.deepEqual(saved(e).townPolicies,{smallTown:[]});
  assert.equal(e.run('S.settlements.smallTown'),3);
  assert.equal(e.run('S.population.current'),0);
  assert.equal(e.run('S.res.tech'),0);
  assert.equal(e.run('S.res.deed'),0);
  assert.equal(e.run('popGrowthPer10s()'),2);
});

check('v32 缺失、未知、越界政策与未来 v33 均保护主档且不自动写回',()=>{
  const seed=environment();
  const base=JSON.parse(seed.run('JSON.stringify(serializeSave())'));
  const variants=[
    d=>delete d.townPolicies,
    d=>{d.townPolicies={smallTown:['wrong']};d.settlements.smallTown=1},
    d=>{d.townPolicies={smallTown:['birth']};d.settlements.smallTown=0},
    d=>{d.townPolicies={smallTown:['birth']};d.settlements.smallTown=1},
    d=>{d.v=37}
  ];
  variants.forEach((mutate,i)=>{
    const d=structuredClone(base);mutate(d);
    const raw=JSON.stringify(d),e=environment({rts_save:raw});
    assert.equal(e.run('loadSaveAndApply().status'),i===4?'future':'invalid');
    assert.equal(e.run('saveProtected()'),true);
    e.run('for(let j=0;j<61;j++)tick()');
    assert.equal(e.store.get('rts_save'),raw);
  });
});

check('政策研究和配置写档失败均回滚；迁移前副本失败保持 v6 原文',()=>{
  const science=environment();
  science.run("S.sciences.push('sci_urbanization');S.res.tech=1000;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(science.run("researchScience('sci_birth_policy').reason"),'save-failed');
  assert.equal(science.run('S.res.tech'),1000);
  assert.equal(science.run("S.sciences.includes('sci_birth_policy')"),false);
  const policy=environment();
  policy.run("S.sciences=['sci_urbanization','sci_birth_policy'];S.settlements.smallTown=1;localStorage.setItem=(key)=>{if(key==='rts_save')throw Error('quota')}");
  assert.equal(policy.run("setSmallTownPolicy(0,'birth').reason"),'save-failed');
  assert.equal(policy.run('popGrowthPer10s()'),2);
  assert.deepEqual(JSON.parse(policy.run('JSON.stringify(S.townPolicies)')),{smallTown:[]});
  const seed=environment();
  const raw=seed.run("(()=>{const d=serializeSave();d.v=6;delete d.townPolicies;return JSON.stringify(d)})()");
  const migrating=environment({rts_save:raw});
  migrating.run("localStorage.setItem=(key)=>{if(key==='rts_save_premigration')throw Error('quota')}");
  assert.equal(migrating.run('loadSaveAndApply().status'),'migrated_readonly');
  assert.equal(migrating.store.get('rts_save'),raw);
  assert.equal(migrating.run('saveProtected()'),true);
  assert.deepEqual(JSON.parse(migrating.run('JSON.stringify(S.townPolicies)')),{smallTown:[]});
});

console.log(`${passed} passed / ${failed} failed`);
if(failed)process.exitCode=1;
