'use strict';

const assert = require('node:assert/strict');
const {environment} = require('./harness');

let passed = 0;
let failed = 0;
function check(name, run) {
  try {
    run();
    passed++;
    console.log('PASS ' + name);
  } catch (error) {
    failed++;
    console.error('FAIL ' + name + '\n' + error.stack);
  }
}

const cases = [
  {unit:'bronze_guard', building:'bronze_workshop', science:'sci_bronze_age', material:'copper', food:300},
  {unit:'iron_spearman', building:'iron_forge', science:'sci_iron_age', material:'iron', food:500}
];

function prepareUnit(e, item) {
  const {unit,building,science} = item;
  assert.equal(e.run(`trainBuildingKey('${unit}')`), building);
  const tier = e.run(`CFG.units.${unit}.tier`);
  e.run(`S.sciences=[...new Set([...S.sciences,'sci_prospect','sci_coal','sci_copper','sci_iron','${science}'])];
    S.buildings.${building}={lv:1,state:'idle',timer:0,timerEnd:0,tier:${tier}};
    S.upgradedUnits.${unit}=true;
    S.res.wood=5000;S.res.stone=5000;S.res.food=5000;
    S.res.copper=0;S.res.iron=0`);
  assert.equal(e.run(`trainLockReason('${unit}')`), '', `${unit} 应能在无通关记录时训练`);
  assert.ok(e.run(`unitCap('${unit}')`) >= 2, `${unit} 至少须容纳 2 人以验证批量训练`);
}

function failureOnMasterWrite(e) {
  e.run(`const originalMilitarySetItem=localStorage.setItem;
    localStorage.setItem=(key,value)=>{
      if(key==='rts_save')throw new Error('simulated master write failure');
      originalMilitarySetItem(key,value);
    }`);
}

function militaryState(e) {
  return e.run('JSON.stringify({res:S.res,pool:S.pool,queue:S.queue})');
}

check('青铜与铁器军备由独立工坊训练，逐人费用为粮加对应金属', () => {
  const e = environment();
  for (const item of cases) {
    assert.equal(e.run(`CFG.buildings.${item.building}.trains`), item.unit);
    assert.equal(e.run(`CFG.units.${item.unit}.cost.food`), item.food);
    assert.equal(e.run(`CFG.units.${item.unit}.cost.${item.material}`), 100);
    assert.equal(e.run(`CFG.units.${item.unit}.cost.${item.material==='copper'?'iron':'copper'}||0`), 0);
  }
});

for (const item of cases) {
  check(`${item.unit}：排队不预扣；缺金属暂停且不扣粮或其它资源`, () => {
    const e = environment();
    prepareUnit(e, item);
    const beforeRes = e.run('JSON.stringify(S.res)');
    e.run(`train('${item.unit}',2)`);
    assert.equal(e.run(`S.queue.${item.unit}.count`), 2);
    assert.equal(e.run('JSON.stringify(S.res)'), beforeRes, '材料须在完成生产时才扣');
    e.run('processQueue(false)');
    assert.equal(e.run(`S.queue.${item.unit}.count`), 2);
    assert.equal(e.run(`S.pool.${item.unit}||0`), 0);
    assert.match(e.run(`S.queue.${item.unit}.reason`), /资源不足/);
    assert.equal(e.run('JSON.stringify(S.res)'), beforeRes);
  });

  check(`${item.unit}：半秒批量训练只有一人材料时只产一人、扣费一次`, () => {
    const e = environment();
    prepareUnit(e, item);
    e.run(`S.res.food=${item.food*2};S.res.${item.material}=100;train('${item.unit}',2)`);
    const wood = e.run('S.res.wood'), stone = e.run('S.res.stone');
    e.run('processQueue(false)');
    assert.equal(e.run(`S.pool.${item.unit}`), 1);
    assert.equal(e.run(`S.queue.${item.unit}.count`), 1);
    assert.equal(e.run(`S.res.${item.material}`), 0);
    assert.equal(e.run('S.res.food'), item.food);
    assert.equal(e.run('S.res.wood'), wood);
    assert.equal(e.run('S.res.stone'), stone);
    e.run('processQueue(false)');
    assert.equal(e.run(`S.pool.${item.unit}`), 1, '缺料期间不得重复产兵');
    assert.equal(e.run('S.res.food'), item.food, '缺料期间不得继续烧粮');
    e.run(`S.res.${item.material}=100;processQueue(false)`);
    assert.equal(e.run(`S.pool.${item.unit}`), 2);
    assert.equal(e.run(`S.queue.${item.unit}.count`), 0);
    assert.equal(e.run('S.res.food'), 0);
    assert.equal(e.run(`S.res.${item.material}`), 0);
  });
}

check('一秒标准训练分支同样在完成时检查并只扣一次铁与粮', () => {
  const e = environment();
  const item = cases[1];
  prepareUnit(e, item);
  e.run("CFG.unitTrainTime=1;S.res.food=1000;S.res.iron=100;train('iron_spearman',2)");
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.iron_spearman'), 1);
  assert.equal(e.run('S.queue.iron_spearman.count'), 1);
  assert.equal(e.run('S.res.food'), 500);
  assert.equal(e.run('S.res.iron'), 0);
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.iron_spearman'), 1);
  assert.equal(e.run('S.res.food'), 500);
  e.run('S.res.iron=100;processQueue(false)');
  assert.equal(e.run('S.pool.iron_spearman'), 2);
  assert.equal(e.run('S.queue.iron_spearman.count'), 0);
  assert.equal(e.run('S.res.food'), 0);
  assert.equal(e.run('S.res.iron'), 0);
});

for (const item of cases) {
  check(`${item.science}：真实研究动作执行前置、一次扣费与持久化`, () => {
    const e = environment();
    const prerequisite = item.material==='copper'?'sci_large_granary':'sci_iron_warehouse';
    const price = e.run(`activeSciences().${item.science}.cost.tech`);
    assert.equal(price, item.material==='copper'?1200:2500);
    assert.equal(e.run(`scienceNeedIds('${item.science}').includes('${prerequisite}')`), true);
    e.run(`S.res.tech=${price}`);
    assert.equal(e.run(`researchScience('${item.science}').reason`), 'science-prerequisite');
    assert.equal(e.run('S.res.tech'), price);
    assert.equal(e.run(`S.sciences.includes('${item.science}')`), false);
    e.run(`S.sciences.push('${prerequisite}')`);
    assert.equal(e.run(`researchScience('${item.science}').ok`), true);
    assert.equal(e.run('S.res.tech'), 0);
    assert.equal(e.run(`S.sciences.includes('${item.science}')`), true);
    assert.equal(e.run(`researchScience('${item.science}').repeat`), true);
    assert.equal(e.run('S.res.tech'), 0, '重复调用不得再次扣费');
    const loaded = environment(Object.fromEntries(e.store));
    assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
    assert.equal(loaded.run(`S.sciences.includes('${item.science}')`), true);
    assert.equal(loaded.run('S.res.tech'), 0);
  });

  check(`${item.science}：研究写档失败时科技点、研究记录和幂等记录全部回滚`, () => {
    const e = environment();
    const prerequisite = item.material==='copper'?'sci_large_granary':'sci_iron_warehouse';
    e.run(`S.sciences.push('${prerequisite}');S.res.tech=${item.material==='copper'?1200:2500}`);
    assert.equal(e.run('save().ok'), true);
    const master = e.store.get('rts_save');
    const before = e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})');
    failureOnMasterWrite(e);
    assert.equal(e.run(`researchScience('${item.science}').reason`), 'save-failed');
    assert.equal(e.run('JSON.stringify({tech:S.res.tech,sciences:S.sciences,ops:S.ops})'), before);
    assert.equal(e.store.get('rts_save'), master);
  });

  check(`${item.unit}：动作层在研究前拒绝建造和训练`, () => {
    const e = environment();
    e.run('S.res.wood=5000;S.res.stone=5000;S.res.food=5000');
    const before = e.run('JSON.stringify(S.res)');
    assert.equal(e.run(`buildAct('${item.building}').reason`), 'need-science');
    assert.equal(e.run(`S.buildings.${item.building}`), undefined);
    assert.equal(e.run('JSON.stringify(S.res)'), before);
    e.run(`S.buildings.${item.building}={lv:1,state:'idle',timer:0,timerEnd:0,tier:0}`);
    assert.match(e.run(`trainLockReason('${item.unit}')`), /需先研究/);
    assert.equal(e.run(`train('${item.unit}',1).reason`), 'locked');
    assert.equal(e.run(`S.queue.${item.unit}`), undefined);
    assert.equal(e.run('JSON.stringify(S.res)'), before);
  });

  check(`${item.unit}：研究、建造完工、训练按真实动作接通且无需通关`, () => {
    const e = environment();
    const prerequisite = item.material==='copper'?'sci_large_granary':'sci_iron_warehouse';
    e.run(`S.sciences.push('${prerequisite}');S.res.tech=${item.material==='copper'?1200:2500};
      S.res.wood=5000;S.res.stone=5000;S.res.food=5000;S.res.${item.material}=100`);
    assert.equal(e.run('S.defeated.length'), 0);
    assert.equal(e.run(`researchScience('${item.science}').ok`), true);
    assert.equal(e.run(`buildAct('${item.building}').ok`), true);
    assert.match(e.run(`trainLockReason('${item.unit}')`), /建设中/);
    assert.equal(e.run(`train('${item.unit}',1).reason`), 'locked');
    e.run(`advanceBuildingsBy(bldSt('${item.building}').timerEnd)`);
    assert.equal(e.run(`bldSt('${item.building}').lv`), 1);
    assert.equal(e.run(`trainLockReason('${item.unit}')`), '');
    const beforeFood = e.run('S.res.food');
    assert.equal(e.run(`train('${item.unit}',1).ok`), true);
    assert.equal(e.run(`S.res.${item.material}`), 100, '入队时不扣金属');
    e.run('processQueue(false)');
    assert.equal(e.run(`S.pool.${item.unit}`), 1);
    assert.equal(e.run(`S.res.${item.material}`), 0);
    assert.equal(e.run('S.res.food'), beforeFood-item.food);
    assert.equal(e.run('S.defeated.length'), 0);
  });
}

check('两种金属队列竞争粮食时，后序队列停工且不误扣铁', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  prepareUnit(e, cases[1]);
  e.run("S.res.food=500;S.res.copper=100;S.res.iron=100;train('bronze_guard',1);train('iron_spearman',1)");
  e.run('processQueue(false)');
  assert.equal(e.run('S.pool.bronze_guard'), 1);
  assert.equal(e.run('S.pool.iron_spearman||0'), 0);
  assert.equal(e.run('S.res.food'), 200);
  assert.equal(e.run('S.res.copper'), 0);
  assert.equal(e.run('S.res.iron'), 100);
  assert.equal(e.run('S.queue.iron_spearman.count'), 1);
  e.run('S.res.food=500;processQueue(false)');
  assert.equal(e.run('S.pool.iron_spearman'), 1);
  assert.equal(e.run('S.res.iron'), 0);
  assert.equal(e.run('S.res.food'), 0);
});

check('离线逐秒调用真实训练队列：有料产一人，缺铜暂停且不继续扣粮', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  e.run("CFG.popFoodCost=0;CFG.units.bronze_guard.upkeep=0;S.res.food=600;S.res.copper=100;train('bronze_guard',2)");
  const outcome = e.run("offlineAdvanceSec(2,0.6,'all')");
  assert.equal(outcome.elapsed, 2);
  assert.equal(e.run('S.pool.bronze_guard'), 1);
  assert.equal(e.run('S.queue.bronze_guard.count'), 1);
  assert.equal(e.run('S.res.copper'), 0);
  assert.equal(e.run('S.res.food'), 300);
  assert.equal(e.run('S.tick'), 2);
});

check('入队主档写入失败时队列与资源不变，旧主档仍可读', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  assert.equal(e.run('save().ok'), true);
  const master = e.store.get('rts_save'), before = militaryState(e);
  failureOnMasterWrite(e);
  e.run("train('bronze_guard',1)");
  assert.equal(militaryState(e), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('训练完成主档写入失败时已扣金属、粮、产兵与队列一起回滚', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  e.run("S.res.food=300;S.res.copper=100;train('bronze_guard',1)");
  const master = e.store.get('rts_save'), before = militaryState(e);
  failureOnMasterWrite(e);
  e.run('processQueue(true)');
  assert.equal(militaryState(e), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('旧步兵兵池和未完成队列继续按旧配方训练，金属库存不产生也不扣除', () => {
  const e = environment();
  e.run(`S.buildings.infantry_camp={lv:1,state:'idle',timer:0,timerEnd:0,tier:2};
    S.upgradedUnits.infantry_shield=true;S.pool.infantry_shield=1;
    S.queue.infantry_shield={count:2,timer:0,reason:''};
    S.res.wood=1000;S.res.stone=1000;S.res.food=1000;
    S.res.copper=0;S.res.iron=0`);
  assert.equal(e.run('save().ok'), true);
  const v4 = JSON.parse(e.store.get('rts_save'));
  v4.v = 4;
  delete v4.res.coal;
  delete v4.popAlloc.coal;
  delete v4.metalRecipeMode;
  const loaded = environment({rts_save:JSON.stringify(v4)});
  assert.equal(loaded.run('loadSaveAndApply().status'), 'migrated');
  assert.equal(JSON.parse(loaded.store.get('rts_save')).v, 32);
  assert.equal(loaded.run('S.pool.infantry_shield'), 1);
  assert.equal(loaded.run('S.queue.infantry_shield.count'), 2);
  loaded.run('processQueue(false)');
  assert.equal(loaded.run('S.pool.infantry_shield'), 3);
  assert.equal(loaded.run('S.queue.infantry_shield.count'), 0);
  assert.equal(loaded.run('S.res.copper'), 0);
  assert.equal(loaded.run('S.res.iron'), 0);
  loaded.run("refundUnitsByLine('infantry_camp',2)");
  assert.equal(loaded.run('S.res.copper'), 0, '旧兵退款不得凭新金属价格生铜');
  assert.equal(loaded.run('S.res.iron'), 0);
});

check('新军备兵池、队列、研究与金属余额保存后原样加载', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  prepareUnit(e, cases[1]);
  e.run(`S.res.food=1100;S.res.copper=100;S.res.iron=100;
    train('bronze_guard',1);train('iron_spearman',2);processQueue(false)`);
  assert.equal(e.run('S.pool.bronze_guard'), 1);
  assert.equal(e.run('S.pool.iron_spearman'), 1);
  assert.equal(e.run('S.queue.iron_spearman.count'), 1);
  const before = militaryState(e);
  assert.equal(e.run('save().ok'), true);
  const loaded = environment(Object.fromEntries(e.store));
  assert.equal(loaded.run('loadSaveAndApply().status'), 'ok');
  assert.equal(militaryState(loaded), before);
  assert.equal(loaded.run("S.sciences.includes('sci_bronze_age')"), true);
  assert.equal(loaded.run("S.sciences.includes('sci_iron_age')"), true);
  assert.equal(loaded.run("trainBuildingKey('bronze_guard')"), 'bronze_workshop');
  assert.equal(loaded.run("trainBuildingKey('iron_spearman')"), 'iron_forge');
});

check('遣散青铜兵只返还粮，不返还铜；历史超仓库存不被裁剪', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  e.run("S.pool.bronze_guard=1;S.res.food=0;S.res.copper=resCap('copper')+7;S.res.wood=resCap('wood')+9");
  const beforeCopper = e.run('S.res.copper'), beforeWood = e.run('S.res.wood');
  assert.equal(e.run("dismissN('bronze_guard',1).ok"), true);
  assert.equal(e.run('S.pool.bronze_guard'), 0);
  assert.equal(e.run('S.res.food'), 150);
  assert.equal(e.run('S.res.copper'), beforeCopper);
  assert.equal(e.run('S.res.wood'), beforeWood);
});

check('遣散铁兵与取消铁兵队列写档失败时兵力、队列和库存全部回滚', () => {
  const e = environment();
  prepareUnit(e, cases[1]);
  e.run("S.pool.iron_spearman=1;S.queue.iron_spearman={count:1,timer:0.5,reason:''};S.res.food=100;S.res.iron=13");
  assert.equal(e.run('save().ok'), true);
  const master = e.store.get('rts_save'), before = militaryState(e);
  failureOnMasterWrite(e);
  assert.equal(e.run("dismissN('iron_spearman',2).reason"), 'save-failed');
  assert.equal(militaryState(e), before);
  assert.equal(e.store.get('rts_save'), master);
});

check('新兵独立容量计入远征与驻军，双方伤害入口使用既有步兵战斗类', () => {
  const e = environment();
  prepareUnit(e, cases[0]);
  prepareUnit(e, cases[1]);
  e.run(`S.formation.front=[{type:'bronze_guard',count:3,id:1}];
    S._garrisonForm.front=[{type:'iron_spearman',count:2,id:2}];
    S.selEnemy=0;B.isTraining=false`);
  assert.equal(e.run('unitCapLeft("bronze_guard")'), e.run('unitCap("bronze_guard")')-3);
  assert.equal(e.run('unitCapLeft("iron_spearman")'), e.run('unitCap("iron_spearman")')-2);
  assert.equal(e.run('totalSoldiers()'), 5);
  assert.equal(e.run("combatBaseUnitType('bronze_guard')"), 'infantry');
  assert.equal(e.run("combatBaseUnitType('iron_spearman')"), 'infantry');
  e.run('initBattleState()');
  assert.equal(e.run('B.ourUnits[0].type'), 'bronze_guard');
  assert.equal(e.run('B.ourUnits[0].hp'), 6);
  assert.equal(e.run('combatAttackMass(B.ourUnits[0])'),3);
  assert.ok(Number.isFinite(e.run('calcDmg(B.ourUnits[0],B.enemyUnits[0],true).dmg')));
  const garrison=e.run('buildGarrisonUnitsFromForm()');
  assert.equal(garrison.length,1);
  assert.equal(garrison[0].type,'iron_spearman');
  assert.equal(garrison[0].hp,3);
  assert.equal(e.run('combatAttackMass(buildGarrisonUnitsFromForm()[0])'),2);
  assert.ok(Number.isFinite(e.run("calcGarrisonDmg(buildGarrisonUnitsFromForm()[0],buildGarrisonEnemyUnits({units:{infantry:[3]}})[0])")));
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
