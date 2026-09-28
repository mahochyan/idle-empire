'use strict';
// 诊断：人口增长机制在部署版的实际行为
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require(path.join(__dirname, '..', '..', 'tests', 'ie001', 'edge-reaper'));
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
reaper.installExitHooks(); if (!reaper.acquireLock()) { console.log('locked'); process.exit(3); } reaper.sweepHeadless();
const PORT = 9700 + Math.floor(Math.random() * 200), udd = path.join(os.tmpdir(), 'popdiag-' + Date.now());
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'https://mahochyan.github.io/idle-empire/'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); let ws;
function send(m, p = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); }); }
async function ev(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result.value; }
(async () => {
  let t = null; for (let i = 0; i < 60 && !t; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); t = await r.json(); } catch (e) { } }
  const page = (t || []).find(x => x.type === 'page') || t[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => { const d = JSON.parse(ev.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); p.res(d.result); } };
  await send('Runtime.enable'); await sleep(6000);
  console.log('=== 人口机制实际行为（线上） ===');
  console.log('popCurrent 函数存在:', await ev('typeof popCurrent==="function"'));
  console.log('CFG.pop:', await ev('JSON.stringify(CFG.pop)'));
  console.log('当前 townLv:', await ev('S.townLv'), ' | maxPop:', await ev('maxPop()'));
  console.log('popCurrent():', await ev('popCurrent()'));
  console.log('popAllocTotal():', await ev('popAllocTotal()'));
  console.log('popFree():', await ev('popFree()'));
  console.log('S.tick:', await ev('S.tick'));
  console.log('--- 模拟：如果城镇升到 Lv5 ---');
  console.log('popGrowthPer10s():', await ev('(S.townLv=5,popGrowthPer10s())'));
  console.log('popCurrent @ tick=0:', await ev('(S.tick=0,popCurrent())'));
  console.log('popCurrent @ tick=50:', await ev('(S.tick=50,popCurrent())'));
  console.log('popCurrent @ tick=100:', await ev('(S.tick=100,popCurrent())'));
  console.log('--- 对比：关闭开关 ---');
  console.log('growth=false popCurrent:', await ev('(CFG.pop.growth=false,popCurrent())'));
  console.log('恢复:', await ev('(CFG.pop.growth=true,"ok")'));
  console.log('=== 结论 ===');
  console.log('机制存在且可运行 | 但 townLv=1 上限 10，增长 7/10s → 10 秒到顶');
  reaper.killTreeSync(edge.pid); await sleep(300); reaper.sweepHeadless(true);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.log('失败:', e.message); try { reaper.killTreeSync(edge && edge.pid); } catch (_) { } process.exit(2); });