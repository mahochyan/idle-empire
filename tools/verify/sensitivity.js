'use strict';
// R3/R5 决策支持：食物经济与产出速率的敏感性分析（只读 —— 参数仅在 vm 沙箱内覆盖，不改游戏文件）
// 用法：node tools/verify/sensitivity.js
// 输出：各情景下 食物净速率 / 转负时刻 / 升级启动次数 / 10h 建筑等级 / 关键资源
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js'];
const HOURS = 10, TOTAL = HOURS * 3600;

function makeEnv() {
  const store = new Map(); const calls = { toast: [] };
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, classList: { add() { }, remove() { }, contains() { return false } }, setAttribute() { }, remove() { }, appendChild() { }, addEventListener() { } });
  const ctx = { console, Date, Math, JSON, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    document: { getElementById: el, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null }, window: {},
    setTimeout: () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { }, updateUI: () => { }, toast: m => calls.toast.push(String(m)), addLog: () => { }, pix: () => '' };
  const sb = vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return { run: c => vm.runInContext(c, sb), store, calls };
}

// 情景：仅覆盖参数（沙箱内），不改文件
const SCENARIOS = [
  { id: 'S0', name: '现状（基线）', apply: '' },
  { id: 'S1', name: 'R5-① 铸币耗粮 5→1', apply: "CFG.buildings.mint.consumes.food=1;" },
  { id: 'S2', name: 'R5-② 食物产出 ×3（basePerPop 0.75→2.25）', apply: "CFG.res.food.basePerPop=2.25;" },
  { id: 'S3', name: 'R5-①② 同时', apply: "CFG.buildings.mint.consumes.food=1;CFG.res.food.basePerPop=2.25;" },
  { id: 'S4', name: 'R3 全资源速率 ×3（木/石/食）', apply: "CFG.res.wood.basePerPop=3;CFG.res.stone.basePerPop=3;CFG.res.food.basePerPop=2.25;" }
];
const BUILD = ['academy', 'lumber_mill', 'quarry', 'farm', 'warehouse', 'barracks', 'infantry_camp', 'mine', 'smelter', 'mint', 'market'];
const SCI = ['sci_copper', 'sci_iron', 'sci_coin'];
const FOOD_DRAIN = "Object.keys(CFG.buildings).reduce(function(s,k){var b=CFG.buildings[k],st=bldSt(k);var v=(typeof effConsume==='function')?effConsume(k,'food'):(b.consumes?b.consumes.food:undefined);return s+((v&&st.state==='idle'&&st.lv>0)?v*st.lv:0)},0)";

function runScenario(sc) {
  const e = makeEnv();
  e.run('loadSaveAndApply();' + sc.apply);
  e.run("S.garrison={phase:'idle',phaseStarted:0,phaseUntil:0,cooldownUntil:0,nextCheckTick:999999999,templateId:null,result:null,seed:1}");
  let foodNegAt = -1, upgrades = 0, builds = 0, attempts = 0;
  for (let t = 0; t < TOTAL; t++) {
    if (t % 10 === 0) {
      const maxPop = e.run('maxPop()');
      const w = Math.max(1, Math.round(maxPop * 0.4)), s2 = Math.max(1, Math.round(maxPop * 0.3)), f = Math.max(1, maxPop - w - s2);
      e.run(`setPopAlloc('wood',0);setPopAlloc('stone',0);setPopAlloc('food',0);setPopAlloc('wood',${w});setPopAlloc('stone',${s2});setPopAlloc('food',${f})`);
      for (const k of BUILD) {
        if (e.run(`bldSt('${k}').state`) !== 'idle') continue;
        const before = e.run(`bldSt('${k}').lv`); attempts++;
        e.run(`buildAct('${k}')`);
        const after = e.run(`bldSt('${k}').state`);
        if (after !== 'idle' && before === 0) builds++; else if (after !== 'idle' && before > 0) upgrades++;
      }
      for (const id of SCI) { if (!e.run(`scienceUnlocked('${id}')`)) e.run(`researchScience('${id}')`); }
      e.run("S.garrison.nextCheckTick=999999999");
    }
    e.run('tick()');
    if (foodNegAt < 0) {
      const fr = e.run(`(prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1)-(${FOOD_DRAIN}))`);
      if (fr < 0) foodNegAt = t;
    }
  }
  const snap = JSON.parse(e.run(`JSON.stringify({res:S.res,foodRate:(prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1)-(${FOOD_DRAIN})),
    bld:Object.fromEntries(Object.keys(CFG.buildings).map(k=>[k,bldSt(k).lv])),sci:S.sciences.slice()})`));
  return { sc, foodNegAt, upgrades, builds, attempts, snap };
}

console.log(`敏感性分析 · ${HOURS}h · 默认均衡策略 · 参数仅在沙箱覆盖（未改任何游戏文件）`);
console.log('='.repeat(100));
const rows = [];
for (const sc of SCENARIOS) {
  const r = runScenario(sc);
  rows.push(r);
  const lv = r.snap.bld;
  console.log(`\n[${sc.id}] ${sc.name}`);
  console.log(`  食物净速率(含被动耗粮): ${r.snap.foodRate.toFixed(2)}/s ｜ 转负时刻: ${r.foodNegAt < 0 ? '未转负' : (r.foodNegAt / 3600).toFixed(2) + 'h'}`);
  console.log(`  建造/升级: 尝试 ${r.attempts}｜建成 ${r.builds}｜升级启动 ${r.upgrades}`);
  console.log(`  建筑等级: 仓库${lv.warehouse} 学院${lv.academy} 伐木场${lv.lumber_mill} 农田${lv.farm} 矿井${lv.mine} 冶炼${lv.smelter} 铸币${lv.mint} 市场${lv.market} 营帐${lv.barracks} 步兵营${lv.infantry_camp}`);
  console.log(`  资源: 木${Math.round(r.snap.res.wood)} 石${Math.round(r.snap.res.stone)} 食${Math.round(r.snap.res.food)} 科技${r.snap.res.tech} 铜${Math.round(r.snap.res.copper)} 铁${Math.round(r.snap.res.iron)} 金币${Math.round(r.snap.res.coin)} ｜ 已研 ${r.snap.sci.length}/3`);
}
console.log('\n' + '='.repeat(100));
console.log('对照摘要（升级启动次数 = 骨架能否"用得到上限"的直接指标）');
console.log('情景 | 食物净速率 | 转负 | 升级启动 | 仓库等级 | 学院等级');
for (const r of rows) console.log(`${r.sc.id} | ${r.snap.foodRate.toFixed(2)} | ${r.foodNegAt < 0 ? '未转负' : (r.foodNegAt / 3600).toFixed(2) + 'h'} | ${r.upgrades} | ${r.snap.bld.warehouse} | ${r.snap.bld.academy}`);
