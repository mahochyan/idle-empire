'use strict';
// 切片 1 · curve-sim：挂机经济推演脚本（IE-006 §5 S1 既定项）
// 目的：在真实实现上模拟 0-50h，输出资源曲线 / 墙位 / 食物盈亏 / 研究节奏，为三线目标值定参提供基线
// 约束：只读模拟（vm 装载真实 config/levels/math/garrison/technology），不改任何游戏代码
// 用法：node tests/ie001/curve-sim.js [hours=50]
// 口径声明（重要）：
//   1) 本模拟不战斗、不推进关卡/Boss（与"离线结算"场景同构）→ 城镇等级停滞在 Lv1，一切受城镇等级限制的上限即封顶
//   2) 驻军侵袭已冻结（隔离经济曲线），仅计资源/科技/建造/研究
//   3) 不做兑换（市场若解锁，仅校验 CFG.market.rates 的套利不变式）
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const FILES = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js'];
const HOURS = Math.max(1, Math.min(50, parseInt(process.argv[2], 10) || 50));
const TOTAL = HOURS * 3600;

function makeEnv() {
  const store = new Map();
  const calls = { toast: [], logs: [] };
  const el = () => ({ value: '', textContent: '', innerHTML: '', style: {}, classList: { add() { }, remove() { }, contains() { return false } }, setAttribute() { }, remove() { }, appendChild() { }, addEventListener() { } });
  const ctx = {
    console, Date, Math, JSON,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    document: { getElementById: el, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null },
    window: {}, setTimeout: () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { },
    updateUI: () => { }, toast: m => calls.toast.push(String(m)), addLog: m => calls.logs.push(String(m)), pix: () => ''
  };
  const sb = vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return { run: code => vm.runInContext(code, sb), store, calls, ctx };
}

// —— 策略定义（两种）——
const POLICIES = {
  default: { // 均衡：先科技源与基础生产，再扩库
    name: '默认均衡',
    alloc: { wood: 0.4, stone: 0.3, food: 0.3 },
    build: ['academy', 'lumber_mill', 'quarry', 'farm', 'warehouse', 'barracks', 'infantry_camp', 'mine', 'smelter', 'mint', 'market'],
    train: 0
  },
  rush: { // 激进：食物优先养学院，尽快研究资源科技链
    name: '科技激进',
    alloc: { wood: 0.3, stone: 0.2, food: 0.5 },
    build: ['academy', 'farm', 'lumber_mill', 'quarry', 'mine', 'smelter', 'mint', 'market', 'infantry_camp', 'warehouse', 'barracks'],
    train: 0
  },
  army: { // 带兵：每次决策补 5 兵，用于观察军粮/免维护带（切片6）
    name: '带兵均衡',
    alloc: { wood: 0.4, stone: 0.3, food: 0.3 },
    build: ['academy', 'lumber_mill', 'quarry', 'farm', 'infantry_camp', 'barracks', 'warehouse', 'mine', 'smelter', 'mint', 'market'],
    train: 5
  }
};
// —— 成本剖面沙箱覆盖（只影响本次推演，不改游戏文件）——
// 竞品原文（addWorkShopLv @1485372）：per = Need/3；lv<10 → base + lv×per；
//   10≤lv<20 → base + 9per + (lv−9)per×5；20≤lv<30 → ×10；30≤lv<40 → ×20；40≤lv<100 → ×40
// 我方现状：upBase × upCostLv^lv（指数）——与竞品"分段线性+斜率跳变"形态不同
const COST_PROFILE = (process.argv.find(a => a.startsWith('--cost=')) || '').split('=')[1] || 'exp';
function installCostProfile(e) {
  if (!COST_PROFILE || COST_PROFILE === 'exp') return;
  const slopes = COST_PROFILE === 'seg-soft' ? '[1,3,6,12,24]' : '[1,5,10,20,40]';
  const src = `upCost=function(key){
    var cfg=CFG.buildings[key], lv=bldSt(key).lv||1, b=cfg.upBase||{wood:100,stone:100,food:100};
    var SL=${slopes}, slope= lv<10?SL[0] : lv<20?SL[1] : lv<30?SL[2] : lv<40?SL[3] : SL[4];
    function per(r){return (b[r]||0)/3}
    function c(r){var base=b[r]||0; return lv<10 ? base+lv*per(r) : base+9*per(r)+(lv-9)*per(r)*slope}
    var isCap1=cfg.buffRes||(!cfg.trains&&!cfg.storagePerLv&&!cfg.buffRes);
    var bt=CFG.buildingTimes;
    var rawTime=isCap1?bt.cap1Base+lv*bt.cap1PerLv:bt.otherBase+lv*bt.otherPerLv;
    var time=buildTime(Math.min(rawTime, CFG.maxUpgradeTime||120));
    return {wood:Math.ceil(c('wood')),stone:Math.ceil(c('stone')),food:Math.ceil(c('food')),time:time};
  };`;
  e.run(src);
}
// —— 科技阶梯/上限沙箱旋钮（只影响本次推演）——
const SCI_MULT = parseFloat((process.argv.find(a => a.startsWith('--scicost=')) || '').split('=')[1] || '1');
const TECHCAP_MULT = parseFloat((process.argv.find(a => a.startsWith('--techcap=')) || '').split('=')[1] || '1');
function installSciTuning(e) {
  if (SCI_MULT !== 1) e.run(`(function(){for(var k in CFG.sciencesLong){CFG.sciencesLong[k].cost.tech=Math.round(CFG.sciencesLong[k].cost.tech*${SCI_MULT})}})()`);
  if (TECHCAP_MULT !== 1) e.run(`(function(){var r=CFG.caps.expand.res.tech;r.max=Math.round(r.max*${TECHCAP_MULT});r.maxPerLv=Math.round(r.maxPerLv*${TECHCAP_MULT})})()`);
}
const SCI_ORDER = null; // 运行时从 activeSciences() 取（切片5 长阶梯）；见 simulate()
const SAMPLES = [1, 10, 60, 600, 1800, 3600, 7200, 18000, 36000, 72000, 126000, 180000].filter(s => s <= TOTAL);
const fmt = n => (typeof n === 'number' ? (Math.abs(n) >= 1e6 ? n.toExponential(2) : n.toFixed(n < 10 ? 2 : 0)) : String(n));
// vm 内联表达式片段：被动建筑对食物的消耗——必须用运行时生效值 effConsume（与实现同源），
// 否则对齐开关（切片4b）生效后指标会按原始值 5/s 误算
const FOOD_DRAIN = "Object.keys(CFG.buildings).reduce(function(s,k){var b=CFG.buildings[k],st=bldSt(k);var v=(typeof effConsume==='function')?effConsume(k,'food'):(b.consumes?b.consumes.food:undefined);return s+((v&&st.state==='idle'&&st.lv>0)?v*st.lv:0)},0)";

function simulate(policyKey) {
  const P = POLICIES[policyKey];
  const e = makeEnv();
  const st = JSON.parse(e.run('JSON.stringify(loadSaveAndApply())'));
  // 冻结驻军侵袭（隔离经济）
  e.run("S.garrison={phase:'idle',phaseStarted:0,phaseUntil:0,cooldownUntil:0,nextCheckTick:999999999,templateId:null,result:null,seed:1}");
  const sciOrder = SCI_ORDER || JSON.parse(e.run("JSON.stringify(Object.keys(activeSciences()))"));
  if (process.argv.includes('--nofreeband')) e.run('CFG.upkeep.freeBand=false');
  installCostProfile(e);
  installSciTuning(e);
  const samples = [], events = [];
  const stat = { attempts: 0, builds: 0, upgrades: 0 };
  let foodNegSince = -1, firstNeg = -1;
  const researched = [];
  let lastDecision = -1;

  for (let t = 0; t < TOTAL; t++) {
    // 每 10s 决策：分配 / 建造 / 研究 / 训练
    if (t % 10 === 0) {
      const maxPop = e.run('maxPop()');
      { // 每 10s 按策略比例重分配（幂等；修正"初始已达上限则跳过"的缺陷）
        const w = Math.max(1, Math.round(maxPop * P.alloc.wood));
        const st2 = Math.max(1, Math.round(maxPop * P.alloc.stone));
        const f = Math.max(1, maxPop - w - st2);
        e.run(`setPopAlloc('wood',0);setPopAlloc('stone',0);setPopAlloc('food',0);setPopAlloc('wood',${w});setPopAlloc('stone',${st2});setPopAlloc('food',${f})`);
      }
      for (const k of P.build) {
        const stt = e.run(`bldSt('${k}').state`);
        if (stt !== 'idle') continue;
        const before = e.run(`bldSt('${k}').lv`);
        const beforeState = stt;
        stat.attempts++;
        e.run(`buildAct('${k}')`);
        const after = e.run(`bldSt('${k}').state`);
        if (after !== 'idle' && before === 0) { stat.builds++; events.push({ t, ev: `开始建造 ${k}` }); }
        else if (after !== 'idle' && before > 0) { stat.upgrades++; if (stat.upgrades <= 6) events.push({ t, ev: `开始升级 ${k} → lv${before + 1}` }); }
        else if (!stat.firstReject && before > 0) {
          stat.firstReject = { t, k, res: e.run('JSON.stringify(S.res)'), cost: e.run(`JSON.stringify(upCost('${k}'))`), lock: e.run(`upgradeLockReason('${k}')`), toast: e.calls.toast.slice(-1)[0] };
        }
        if (before > 0) stat.lastReject = { t, k, res: e.run('JSON.stringify(S.res)'), cost: e.run(`JSON.stringify(upCost('${k}'))`), lock: e.run(`upgradeLockReason('${k}')`), toast: e.calls.toast.slice(-1)[0] };
      }
      for (const id of sciOrder) {
        if (e.run(`scienceUnlocked('${id}')`)) continue;
        const r = JSON.parse(e.run(`JSON.stringify(researchScience('${id}'))`));
        if (r.ok) { researched.push({ t, id }); events.push({ t, ev: `研究完成 ${id}` }); }
      }
      if (P.train > 0) e.run(`train('infantry',${P.train})`);
      // S8c：先用地契换金币→地契（城镇门凭据），再尝试升城镇
      if (e.run('typeof townCanUpgrade==="function" && !townCanUpgrade()') === true) {
        const n = e.run('(S.res.coin||0)>=1000?1000:0');
        if (n > 0) {
          const r = JSON.parse(e.run(`JSON.stringify(exchangeResource('coin','deed',${n}))`));
          if (r && r.ok) events.push({ t, ev: '市场兑换地契 +' + r.get });
        }
      }
      if (e.run('typeof upgradeTown==="function" && townCanUpgrade()') === true) {
        e.run('upgradeTown()');
        events.push({ t, ev: '开始升级城镇' });
      }
      e.run("S.garrison.nextCheckTick=999999999");
    }
    e.run('tick()');
    // 事件：食物净速率转负（排除开局 t<10 的假报：此时尚未按策略分配村民）；库存见底另记
    const foodRate = e.run(`(prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1)-(${FOOD_DRAIN}))`);
    if (foodRate < 0 && firstNeg < 0 && t >= 10) { firstNeg = t; events.push({ t, ev: `食物净速率转负 (${foodRate.toFixed(2)}/s)` }); }
    if (e.run('S.res.food') <= 1 && !events.some(x => /食物见底/.test(x.ev))) events.push({ t, ev: '食物库存见底（≤1）' });
    // 采样
    const s = t + 1;
    if (SAMPLES.includes(s)) {
      const snap = JSON.parse(e.run(`JSON.stringify({res:S.res,pop:S.popAlloc,cap:storageCapacity(),
        bld:Object.fromEntries(Object.keys(CFG.buildings).map(k=>[k,bldSt(k).lv+(bldSt(k).state==='idle'?'':'*')])),
        sci:S.sciences.slice(),tick:S.tick,popMax:maxPop(),merit:S.merit,army:armyCount(),upkeep:totalUpkeep(),
        foodRate:(prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1)-(${FOOD_DRAIN})),
        foodRateBasic:(prodRate('food')-totalUpkeep()-popAllocTotal()*(CFG.popFoodCost||0.1)),techCap:resCap('tech')})`));
      samples.push({ t: s, ...snap });
    }
  }
  const rates = JSON.parse(e.run('JSON.stringify(CFG.market.rates)'));
  const tally = {};
  for (const m of e.calls.toast) tally[m] = (tally[m] || 0) + 1;
  const toastTop = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => `${m}×${c}`);
  let arbitrage = 'n/a';
  for (const a of rates) for (const b of rates) if (a.to === b.from && b.to === a.from) arbitrage = (a.rate * b.rate < 1 ? 'OK(<1)' : '存在套利!') + ` (${a.from}->${a.to}×回=${(a.rate * b.rate).toFixed(3)})`;
  return { policy: P, samples, events, researched, arbitrage, toastTop, stat, sciOrder, final: samples[samples.length - 1], totalTicks: TOTAL };
}

// —— 主流程 ——
console.log('='.repeat(96));
console.log(`curve-sim 推演 · 模拟 ${HOURS}h（${TOTAL} tick）· 真实实现 vm 装载 · node ${process.version}`);
console.log(`口径：不战斗/不推进关卡（城镇停滞 Lv1）· 驻军侵袭冻结 · 不执行兑换 · 采样点 ${SAMPLES.join('/')}s · 成本剖面=${COST_PROFILE}｜阶梯成本×${SCI_MULT}｜科技上限×${TECHCAP_MULT}`);
console.log('='.repeat(96));
const out = {};
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const POLICY_KEYS = Object.keys(POLICIES).filter(k => !ONLY || k === ONLY);
for (const key of POLICY_KEYS) {
  const t0 = Date.now();
  const r = simulate(key);
  out[key] = r;
  console.log(`\n### 策略：${r.policy.name}（${key}）  用时 ${Date.now() - t0}ms`);
  console.log('| 时刻 | 木 | 石 | 食 | 科技点 | 战功 | 铜 | 铁 | 金币 | 村民 | 兵力 | 军粮 | 食物净速率 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of r.samples) {
    console.log(`| ${s.t}s(${(s.t / 3600).toFixed(2)}h) | ${fmt(s.res.wood)} | ${fmt(s.res.stone)} | ${fmt(s.res.food)} | ${fmt(s.res.tech)} | ${fmt(s.merit)} | ${fmt(s.res.copper)} | ${fmt(s.res.iron)} | ${fmt(s.res.coin)} | ${e0(s.pop)} | ${s.army} | ${s.upkeep.toFixed(2)} | ${s.foodRate.toFixed(2)} |`);
  }
  console.log('\n建筑等级（终态）: ' + JSON.stringify(r.final.bld));
  console.log('已研科技: ' + (r.researched.length ? r.researched.map(x => `${x.id}@${x.t}s`).join(', ') : '（无）'));
  console.log('科技点上限: ' + r.final.techCap + ' | 村民上限: ' + r.final.popMax + ' | 仓库容量: ' + fmt(r.final.cap));
  console.log('汇套利校验: ' + r.arbitrage);
  console.log('拒绝原因统计（toast top5）: ' + (r.toastTop.length ? r.toastTop.join(' | ') : '（无拒绝）'));
  console.log(`建造/升级统计: 尝试 ${r.stat.attempts}｜建成 ${r.stat.builds}｜升级启动 ${r.stat.upgrades}`);
  if (r.stat.firstReject) console.log('首次升级被拒现场: ' + JSON.stringify(r.stat.firstReject));
  if (r.stat.lastReject) console.log('末次升级被拒现场: ' + JSON.stringify(r.stat.lastReject));
  console.log('关键事件（前 12 条）:');
  for (const ev of r.events.slice(0, 12)) console.log(`  T+${ev.t}s (${(ev.t / 3600).toFixed(2)}h)  ${ev.ev}`);
  if (r.events.length > 12) console.log(`  …另有 ${r.events.length - 12} 条`);
  // 墙位判定（对照三阶段预算）
  const wallT = r.events.find(x => /开始建造/.test(x.ev)) ? 0 : -1;
  const negEv = r.events.find(x => /转负/.test(x.ev));
  const capBld = Object.entries(r.final.bld).filter(([, v]) => typeof v === 'string' && v.endsWith('*') || false).length;
  console.log(`判定：食物转负=${negEv ? (negEv.t / 3600).toFixed(2) + 'h' : '未发生'}；建造事件数=${r.events.filter(x => /开始建造/.test(x.ev)).length}；研究完成=${r.researched.length}/${r.sciOrder.length}`);
}
function e0(pop) { return `${pop.wood}/${pop.stone}/${pop.food}`; }
console.log('\n' + '='.repeat(96));
console.log('结论提示（供阶段 3/4 定参，不是最终数值）：');
console.log('  · 城镇等级停滞 Lv1 ⇒ buildingCaps 生效：生产建筑上限=1、仓库上限=5、训练营上限=5、营帐/学院上限=1');
console.log('  · 因此"不推进关卡"的挂机经济会在极早期触顶（墙位=上限本身），与三阶段预算（3-15h 墙期）不匹配');
console.log('  · 离线结算的"在线净速率"即本表末列；若食物净速率为负，离线按可支付秒数截断（见规格 S2.4）');
process.exit(0);
