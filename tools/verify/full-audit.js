'use strict';
// 全面审查：我方已实施机制 vs 竞品（线上真实运行数据）
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require(path.join(__dirname, '..', '..', 'tests', 'ie001', 'edge-reaper'));
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
reaper.installExitHooks(); if (!reaper.acquireLock()) { process.exit(3); } reaper.sweepHeadless();
const PORT = 9750 + Math.floor(Math.random() * 200), udd = path.join(os.tmpdir(), 'audit-' + Date.now());
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'https://mahochyan.github.io/idle-empire/'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); let ws;
function send(m, p = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result.value; }
const out = {};
async function audit(k, expr) { try { out[k] = await ev(expr); } catch (e) { out[k] = 'ERR:' + e.message.slice(0, 60); } }
(async () => {
  let t = null; for (let i = 0; i < 60 && !t; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); t = await r.json(); } catch (e) { } }
  const page = (t || []).find(x => x.type === 'page') || t[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => { const d = JSON.parse(ev.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); p.res(d.result); } };
  await send('Runtime.enable'); await sleep(6000);

  // 人口
  await audit('pop_growthFormula', 'popGrowthPer10s()');
  await audit('pop_base', 'CFG.pop.base');
  await audit('pop_per10sBase', 'CFG.pop.per10sBase');
  await audit('pop_per10sPerTown', 'CFG.pop.per10sPerTown');
  await audit('pop_maxPop', 'maxPop()');
  await audit('pop_townLv', 'S.townLv');
  await audit('pop_current', 'popCurrent()');
  await audit('pop_allocated', 'popAllocTotal()');
  await audit('pop_death', 'false');
  // 资源产率
  await audit('res_wood_perPop', 'CFG.res.wood.basePerPop');
  await audit('res_stone_perPop', 'CFG.res.stone.basePerPop');
  await audit('res_food_perPop_aligned', 'CFG.food.aligned?CFG.food.res.food.basePerPop:CFG.res.food.basePerPop');
  await audit('res_wood_prodRate', "prodRate('wood')");
  await audit('res_stone_prodRate', "prodRate('stone')");
  await audit('res_food_prodRate', "prodRate('food')");
  // 乘区
  await audit('buff_base', 'CFG.buildings.lumber_mill.buffBase');
  await audit('buff_perLv', 'CFG.buildings.lumber_mill.buffPerLv');
  await audit('lumber_lv', "bldSt('lumber_mill').lv");
  await audit('lumber_lvMax', 'CFG.ownMax.resource');
  await audit('lumber_prodMult', "1+buildingBuff('wood')");
  // 占人口
  await audit('passive_occupy_pop', 'CFG.passive.needPop');
  await audit('tech_occupy_pop', 'CFG.tech.occupyPop');
  // 上限
  await audit('cap_wood', "resCap('wood')");
  await audit('cap_tech', "resCap('tech')");
  await audit('cap_deed', "resCap('deed')");
  await audit('warehouse_lvMax', 'CFG.ownMax.warehouse');
  await audit('warehouse_perLv_storage', 'CFG.caps.expand.warehousePerLv');
  // 军粮
  await audit('upkeep_freeBand', 'CFG.upkeep.freeBand');
  await audit('upkeep_freeBase', 'CFG.upkeep.freeBase');
  await audit('upkeep_freePerBld', 'CFG.upkeep.freePerBarracksLv');
  await audit('upkeep_widths', 'JSON.stringify(CFG.upkeep.segWidths)');
  await audit('upkeep_slopes', 'JSON.stringify(CFG.upkeep.segSlopes)');
  await audit('upkeep_total', 'totalUpkeep()');
  await audit('army_count', 'armyCount()');
  // 科技
  await audit('sci_noMerit', 'CFG.tech.sciencesNoMerit');
  await audit('sci_ladder_count', 'Object.keys(activeSciences()).length');
  await audit('sci_income_per_lv', 'CFG.buildings.academy.produces.tech');
  await audit('academy_lv', "bldSt('academy').lv");
  await audit('academy_lvMax', 'CFG.ownMax.science');
  await audit('tech_cap', "resCap('tech')");
  await audit('sci_costs', 'JSON.stringify(Object.values(activeSciences()).map(s=>s.cost.tech))');
  // 地契
  await audit('deed_exchange_rate', "(CFG.market.rates.find(r=>r.from==='coin'&&r.to==='deed')||{}).rate");
  await audit('deed_max', "resCap('deed')");
  await audit('deed_l2', '(CFG.townGate.cost.find(c=>c.toLv===2)||{}).deed');
  await audit('deed_l10_tech', '(CFG.townGate.cost.find(c=>c.toLv===10)||{}).tech');
  await audit('town_gate_enabled', 'CFG.townGate.useDeed');
  // 兑换
  await audit('market_rate_count', 'CFG.market.rates.length');
  await audit('market_daily_limit', 'CFG.market.dailyLimit');
  // 离线
  await audit('offline_ratio', 'CFG.offline.ratio');
  await audit('offline_capSec', 'CFG.offline.capSec');
  await audit('offline_minSec', 'CFG.offline.minSec');
  // 占人口开关
  await audit('passive_needPop', 'CFG.passive.needPop');
  await audit('tech_occupyPop', 'CFG.tech.occupyPop');
  // tick
  await audit('tick_ms', 'CFG.tickMs');

  console.log(JSON.stringify(out, null, 2));
  reaper.killTreeSync(edge.pid); await sleep(300); reaper.sweepHeadless(true);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.log('失败:', e.message); try { reaper.killTreeSync(edge && edge.pid); } catch (_) { } process.exit(2); });